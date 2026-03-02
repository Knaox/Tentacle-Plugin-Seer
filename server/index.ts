/* ------------------------------------------------------------------ */
/*  Seer Plugin — Backend module                                       */
/*  Loaded dynamically by Tentacle plugin backend loader               */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { resolve, dirname } from "path";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import {
  ensureTables,
  createRequest,
  getRequestById,
  getUserRequests,
  getAllRequests,
  deleteRequestById,
  findDuplicate,
  getQueueStatus,
  getUserStats,
  getGlobalStats,
} from "./db";
import { startWorker, stopWorker, isWorkerRunning } from "./worker";
import type { CreateRequestBody } from "./types";

const __pluginDir = dirname(dirname(fileURLToPath(import.meta.url)));

interface JellyfinUser {
  userId: string;
  username: string;
  isAdmin: boolean;
}

interface PluginBackendContext {
  pluginId: string;
  getPrisma: () => import("@prisma/client").PrismaClient;
  requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

function getUser(request: FastifyRequest): JellyfinUser {
  return (request as any).user;
}

/** Helper to read plugin config from installed.json */
function getPluginConfig(ctx: PluginBackendContext): Record<string, unknown> {
  try {
    const installedPath = resolve(__pluginDir, "installed.json");
    if (!existsSync(installedPath)) return {};
    const installed = JSON.parse(readFileSync(installedPath, "utf-8"));
    const plugin = installed.find(
      (p: { pluginId?: string; id?: string }) =>
        p.pluginId === ctx.pluginId || p.id === ctx.pluginId,
    );
    return plugin?.config || {};
  } catch {
    return {};
  }
}

async function getWorkerConfig(ctx: PluginBackendContext) {
  const config = getPluginConfig(ctx);
  const url = config.url as string;
  const apiKey = config.apiKey as string;
  if (!url || !apiKey) return null;
  return {
    seerrUrl: url.replace(/\/$/, ""),
    seerrApiKey: apiKey,
    interval: 60_000,
    syncEvery: 5,
  };
}

/* ── Main plugin registration ────────────────────────────────────── */

export default async function seerBackend(
  app: FastifyInstance,
  ctx: PluginBackendContext,
): Promise<void> {
  const prisma = ctx.getPrisma();

  // Ensure database tables exist
  await ensureTables(prisma);
  console.log("[SeerBackend] Database tables ready");

  // Start background worker
  startWorker(prisma, () => getWorkerConfig(ctx));

  // Cleanup on server shutdown
  app.addHook("onClose", async () => {
    stopWorker();
  });

  /* ── Authenticated routes ────────────────────────────────────────── */

  // All routes require auth
  app.addHook("preHandler", ctx.requireAuth);

  /* ── Requests ────────────────────────────────────────────────────── */

  app.get("/requests", async (request) => {
    const user = getUser(request);
    const query = request.query as {
      page?: string;
      limit?: string;
      status?: string;
      type?: string;
    };

    if (user.isAdmin && query.status === "all_users") {
      return getAllRequests(prisma, {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        mediaType: query.type,
      });
    }

    return getUserRequests(prisma, user.userId, {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      status: query.status,
      mediaType: query.type,
    });
  });

  app.post("/requests", async (request, reply) => {
    const user = getUser(request);
    const body = request.body as CreateRequestBody;

    if (!body.mediaType || !body.tmdbId || !body.title) {
      return reply.status(400).send({ message: "mediaType, tmdbId, and title are required" });
    }

    // Check for duplicates
    const dup = await findDuplicate(prisma, user.userId, body.tmdbId, body.mediaType);
    if (dup) {
      return reply.status(409).send({
        message: "A request for this media is already active",
        existing: dup,
      });
    }

    const req = await createRequest(prisma, {
      jellyfinUserId: user.userId,
      username: user.username,
      mediaType: body.mediaType,
      tmdbId: body.tmdbId,
      title: body.title,
      posterPath: body.posterPath,
      backdropPath: body.backdropPath,
      overview: body.overview,
      year: body.year,
      seasons: body.seasons,
    });

    return reply.status(201).send(req);
  });

  app.delete("/requests/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const req = await getRequestById(prisma, id);

    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }

    // Try to delete on Seerr side if it was sent
    if (req.seerrRequestId) {
      try {
        const config = await getWorkerConfig(ctx);
        if (config) {
          await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(10_000),
          });
        }
      } catch (err) {
        console.warn(`[SeerBackend] Failed to delete Seerr request #${req.seerrRequestId}:`, err);
      }
    }

    await deleteRequestById(prisma, id);
    return { success: true };
  });

  app.post("/requests/:id/retry", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const req = await getRequestById(prisma, id);

    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }

    // Delete from Seerr if it was sent
    if (req.seerrRequestId) {
      try {
        const config = await getWorkerConfig(ctx);
        if (config) {
          await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(10_000),
          });
        }
      } catch {
        // Best effort
      }
    }

    // Delete old request
    await deleteRequestById(prisma, id);

    // Create new request with high priority
    const newReq = await createRequest(prisma, {
      jellyfinUserId: req.jellyfinUserId,
      username: req.username,
      mediaType: req.mediaType,
      tmdbId: req.tmdbId,
      title: req.title,
      posterPath: req.posterPath,
      backdropPath: req.backdropPath,
      overview: req.overview,
      year: req.year,
      seasons: req.seasons,
      priority: 1,
    });

    return reply.status(201).send(newReq);
  });

  /* ── Queue status ────────────────────────────────────────────────── */

  app.get("/queue/status", async (request) => {
    const user = getUser(request);
    const status = await getQueueStatus(prisma, user.isAdmin ? undefined : user.userId);
    return {
      ...status,
      workerRunning: isWorkerRunning(),
    };
  });

  /* ── Stats ───────────────────────────────────────────────────────── */

  app.get("/stats", async (request) => {
    const user = getUser(request);
    if (user.isAdmin) {
      const [personal, global] = await Promise.all([
        getUserStats(prisma, user.userId),
        getGlobalStats(prisma),
      ]);
      return { personal, global };
    }
    return { personal: await getUserStats(prisma, user.userId) };
  });

  /* ── Worker control (admin only) ─────────────────────────────────── */

  app.post("/worker/trigger", { preHandler: ctx.requireAdmin }, async () => {
    // Force process the next queued request immediately
    const config = await getWorkerConfig(ctx);
    if (!config) return { message: "Seerr not configured" };

    const next = await getQueueStatus(prisma);
    return {
      workerRunning: isWorkerRunning(),
      processing: next.processing,
      queued: next.queued,
      triggered: true,
    };
  });

  console.log("[SeerBackend] Routes registered");
}
