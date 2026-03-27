/* ------------------------------------------------------------------ */
/*  Seer Plugin — Backend module (entry point)                         */
/*  Loaded dynamically by Tentacle plugin backend loader               */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Readable } from "stream";
import { resolve, dirname } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { ensureTables, getQueueStatus, getUserStats, getGlobalStats } from "./db";
import { startWorker, stopWorker, isWorkerRunning } from "./worker";
import { registerRequestRoutes } from "./routes-requests";
import { registerBulkRoutes } from "./routes-bulk";
import { registerProfileRoutes } from "./routes-profiles";

const __pluginDir = dirname(dirname(fileURLToPath(import.meta.url)));

interface PluginBackendContext {
  pluginId: string;
  getPrisma: () => import("@prisma/client").PrismaClient;
  requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

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
  } catch { return {}; }
}

async function getWorkerConfig(ctx: PluginBackendContext) {
  const config = getPluginConfig(ctx);
  const url = config.url as string;
  const apiKey = config.apiKey as string;
  if (!url || !apiKey) return null;
  const profiles = (config.profiles as any[] | undefined) ?? [];
  return { seerrUrl: url.replace(/\/$/, ""), seerrApiKey: apiKey, interval: 60_000, syncEvery: 2, profiles };
}

/* ── Main plugin registration ────────────────────────────────────── */

export default async function seerBackend(
  app: FastifyInstance,
  ctx: PluginBackendContext,
): Promise<void> {
  const prisma = ctx.getPrisma();

  await ensureTables(prisma);
  console.log("[SeerBackend] Database tables ready");

  startWorker(prisma, () => getWorkerConfig(ctx));
  app.addHook("onClose", async () => { stopWorker(); });
  app.addHook("preHandler", ctx.requireAuth);

  /* ── Config ────────────────────────────────────────────────────── */

  app.get("/config", async (request) => {
    const config = getPluginConfig(ctx);
    const user = (request as any).user;
    // Admins voient toute la config (pour la page admin)
    if (user?.isAdmin) {
      return config;
    }
    // Users normaux : infos non-sensibles seulement
    return { url: config.url || "", enabled: !!config.enabled, hasApiKey: !!config.apiKey };
  });

  app.put("/config", { preHandler: ctx.requireAdmin }, async (request) => {
    // Sauvegarder la config dans installed.json via le host
    const installedPath = resolve(__pluginDir, "..", "installed.json");
    if (!existsSync(installedPath)) return { error: "installed.json not found" };
    const installed = JSON.parse(readFileSync(installedPath, "utf-8"));
    const plugin = installed.find(
      (p: { pluginId?: string; id?: string }) =>
        p.pluginId === ctx.pluginId || p.id === ctx.pluginId,
    );
    if (!plugin) return { error: "Plugin not found" };
    plugin.config = request.body;
    writeFileSync(installedPath, JSON.stringify(installed, null, 2));
    return plugin.config;
  });

  /* ── Proxy ─────────────────────────────────────────────────────── */

  app.post("/proxy", async (request, reply) => {
    const body = request.body as { url: string; method?: string; headers?: Record<string, string>; body?: unknown };
    if (!body.url) return reply.status(400).send({ message: "url is required" });

    const config = getPluginConfig(ctx);
    const seerrUrl = (config.url as string)?.replace(/\/$/, "");
    if (!seerrUrl) return reply.status(503).send({ message: "Seerr not configured" });

    let parsed: URL;
    try { parsed = new URL(body.url); } catch { return reply.status(400).send({ message: "Invalid URL" }); }
    if (parsed.origin !== new URL(seerrUrl).origin) {
      return reply.status(403).send({ message: "Proxy restricted to configured Seerr instance" });
    }

    try {
      const res = await fetch(body.url, {
        method: body.method || "GET", headers: body.headers,
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

  /* ── Streaming proxy ───────────────────────────────────────────── */

  app.all("/seerr/*", async (request, reply) => {
    const wildcard = (request.params as Record<string, string>)["*"];
    if (!wildcard || !wildcard.startsWith("api/v1/")) {
      return reply.status(400).send({ message: "Only api/v1/* paths are allowed" });
    }

    const config = getPluginConfig(ctx);
    const seerrUrl = (config.url as string)?.replace(/\/$/, "");
    const apiKey = config.apiKey as string;
    if (!seerrUrl || !apiKey) return reply.status(503).send({ message: "Seerr not configured" });

    const query = request.query as Record<string, string>;
    const qsParts: string[] = [];
    for (const [k, v] of Object.entries(query)) {
      if (k === "_lang") continue;
      qsParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    const qs = qsParts.join("&");
    const targetUrl = `${seerrUrl}/${wildcard}${qs ? `?${qs}` : ""}`;

    const headers: Record<string, string> = { "X-Api-Key": apiKey };
    if (query._lang) headers["Accept-Language"] = query._lang;

    let reqBody: string | undefined;
    if (request.body && ["POST", "PUT", "PATCH"].includes(request.method)) {
      headers["Content-Type"] = "application/json";
      reqBody = JSON.stringify(request.body);
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method, headers, body: reqBody,
        signal: AbortSignal.timeout(15_000),
      });
      reply.status(response.status);
      const ct = response.headers.get("content-type");
      if (ct) reply.header("content-type", ct);
      if (!response.body) return reply.send();
      return reply.send(Readable.fromWeb(response.body as any));
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return reply.status(504).send({ message: "Seerr timeout" });
      }
      return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy failed" });
    }
  });

  /* ── Request & bulk routes (from split modules) ────────────────── */

  const gwc = () => getWorkerConfig(ctx);
  registerRequestRoutes(app, prisma, gwc);
  registerBulkRoutes(app, prisma, gwc);
  registerProfileRoutes(app, () => getPluginConfig(ctx), () => {
    const c = getPluginConfig(ctx);
    const url = c.url as string; const apiKey = c.apiKey as string;
    if (!url || !apiKey) return null;
    return { seerrUrl: url.replace(/\/$/, ""), seerrApiKey: apiKey };
  });

  /* ── Watch providers, queue, stats, worker control ─────────────── */

  const providerCache = new Map<string, { providers: number[]; expires: number }>();

  app.post("/check-providers", async (request, reply) => {
    const body = request.body as { items: Array<{ tmdbId: number; mediaType: "movie" | "tv" }> };
    if (!body.items || !Array.isArray(body.items)) return reply.status(400).send({ message: "items array required" });

    const config = getPluginConfig(ctx);
    const seerrUrl = (config.url as string)?.replace(/\/$/, "");
    const apiKey = config.apiKey as string;
    if (!seerrUrl || !apiKey) return reply.status(503).send({ message: "Seerr not configured" });

    const result: Record<number, number[]> = {};
    const toFetch: Array<{ tmdbId: number; mediaType: string }> = [];

    for (const item of body.items.slice(0, 200)) {
      const key = `${item.mediaType}-${item.tmdbId}`;
      const cached = providerCache.get(key);
      if (cached && Date.now() < cached.expires) { result[item.tmdbId] = cached.providers; }
      else { toFetch.push(item); }
    }

    const BATCH = 5;
    for (let i = 0; i < toFetch.length; i += BATCH) {
      const batch = toFetch.slice(i, i + BATCH);
      const responses = await Promise.allSettled(
        batch.map(async (item) => {
          const res = await fetch(`${seerrUrl}/api/v1/${item.mediaType}/${item.tmdbId}`, {
            headers: { "X-Api-Key": apiKey }, signal: AbortSignal.timeout(8_000),
          });
          if (!res.ok) return { tmdbId: item.tmdbId, mediaType: item.mediaType, providers: [] as number[] };
          const data = (await res.json()) as {
            watchProviders?: Array<{ iso_3166_1: string; flatrate?: Array<{ id: number; providerId?: number }> }>;
          };
          const region = data.watchProviders?.find((w) => w.iso_3166_1 === "FR")
            ?? data.watchProviders?.find((w) => w.iso_3166_1 === "US");
          const ids = region?.flatrate?.map((p) => p.id ?? p.providerId ?? 0).filter(Boolean) ?? [];
          return { tmdbId: item.tmdbId, mediaType: item.mediaType, providers: ids };
        }),
      );
      for (const r of responses) {
        if (r.status === "fulfilled" && r.value) {
          const { tmdbId, mediaType, providers } = r.value;
          result[tmdbId] = providers;
          providerCache.set(`${mediaType}-${tmdbId}`, { providers, expires: Date.now() + 7 * 86400_000 });
        }
      }
    }
    return result;
  });

  app.get("/queue/status", async (request) => {
    const user = (request as any).user;
    const status = await getQueueStatus(prisma, user.isAdmin ? undefined : user.userId);
    return { ...status, workerRunning: isWorkerRunning() };
  });

  app.get("/stats", async (request) => {
    const user = (request as any).user;
    if (user.isAdmin) {
      const [personal, global] = await Promise.all([getUserStats(prisma, user.userId), getGlobalStats(prisma)]);
      return { personal, global };
    }
    return { personal: await getUserStats(prisma, user.userId) };
  });

  app.post("/worker/trigger", { preHandler: ctx.requireAdmin }, async () => {
    const config = await getWorkerConfig(ctx);
    if (!config) return { message: "Seerr not configured" };
    const next = await getQueueStatus(prisma);
    return { workerRunning: isWorkerRunning(), processing: next.processing, queued: next.queued, triggered: true };
  });

  console.log("[SeerBackend] Routes registered");
}
