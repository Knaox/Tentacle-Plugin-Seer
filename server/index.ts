/* ------------------------------------------------------------------ */
/*  Seer Plugin — Backend module                                       */
/*  Loaded dynamically by Tentacle plugin backend loader               */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Readable } from "stream";
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
    const installedPath = resolve(__pluginDir, "..", "installed.json");
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

  /* ── Config (read-only, for all authenticated users) ──────────── */

  app.get("/config", async () => {
    const config = getPluginConfig(ctx);
    return { url: config.url || "", enabled: !!config.enabled, hasApiKey: !!config.apiKey };
  });

  /* ── Proxy (scoped to configured Seerr instance) ────────────────── */

  app.post("/proxy", async (request, reply) => {
    const body = request.body as { url: string; method?: string; headers?: Record<string, string>; body?: unknown };
    if (!body.url) return reply.status(400).send({ message: "url is required" });

    const config = getPluginConfig(ctx);
    const seerrUrl = (config.url as string)?.replace(/\/$/, "");
    if (!seerrUrl) return reply.status(503).send({ message: "Seerr not configured" });

    // Verify the target URL belongs to the configured Seerr instance
    let parsed: URL;
    try { parsed = new URL(body.url); } catch { return reply.status(400).send({ message: "Invalid URL" }); }
    if (parsed.origin !== new URL(seerrUrl).origin) {
      return reply.status(403).send({ message: "Proxy restricted to configured Seerr instance" });
    }

    try {
      const res = await fetch(body.url, {
        method: body.method || "GET",
        headers: body.headers,
        body: body.body ? JSON.stringify(body.body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      const text = await res.text();
      let json: unknown;
      try { json = JSON.parse(text); } catch { json = null; }
      return { status: res.status, ok: res.ok, data: json ?? text };
    } catch (err) {
      return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy failed" });
    }
  });

  /* ── Streaming proxy (transparent, no buffering) ────────────────── */

  app.all("/seerr/*", async (request, reply) => {
    const wildcard = (request.params as Record<string, string>)["*"];
    if (!wildcard || !wildcard.startsWith("api/v1/")) {
      return reply.status(400).send({ message: "Only api/v1/* paths are allowed" });
    }

    const config = getPluginConfig(ctx);
    const seerrUrl = (config.url as string)?.replace(/\/$/, "");
    const apiKey = config.apiKey as string;
    if (!seerrUrl || !apiKey) {
      return reply.status(503).send({ message: "Seerr not configured" });
    }

    // Build target URL, forward query params
    const query = request.query as Record<string, string>;
    const targetParams = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (k === "_lang") continue; // handled below
      targetParams.set(k, v);
    }
    const qs = targetParams.toString();
    const targetUrl = `${seerrUrl}/${wildcard}${qs ? `?${qs}` : ""}`;

    // Build headers
    const headers: Record<string, string> = {
      "X-Api-Key": apiKey,
    };
    if (query._lang) {
      headers["Accept-Language"] = query._lang;
    }

    // Forward body for POST/PUT/PATCH
    let body: string | undefined;
    if (request.body && ["POST", "PUT", "PATCH"].includes(request.method)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(request.body);
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
        signal: AbortSignal.timeout(15_000),
      });

      reply.status(response.status);
      // Forward content-type from Seerr
      const ct = response.headers.get("content-type");
      if (ct) reply.header("content-type", ct);

      if (!response.body) {
        return reply.send();
      }

      const nodeStream = Readable.fromWeb(response.body as any);
      return reply.send(nodeStream);
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return reply.status(504).send({ message: "Seerr timeout" });
      }
      return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy failed" });
    }
  });

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
