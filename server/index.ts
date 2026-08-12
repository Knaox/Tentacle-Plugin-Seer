/* ------------------------------------------------------------------ */
/*  Seer Plugin — Backend module (entry point)                         */
/*  Loaded dynamically by Tentacle plugin backend loader               */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Readable } from "stream";
import { resolve, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { ensureTables } from "./db";
import { startWorker, stopWorker } from "./worker";
import { registerRequestRoutes } from "./routes-requests";
import { registerBulkRoutes } from "./routes-bulk";
import { registerProfileRoutes } from "./routes-profiles";
import { registerUsersRoutes } from "./routes-users";
import { registerAvailabilityRoutes } from "./routes-availability";
import { registerProgressRoutes } from "./routes-progress";
import { registerCalendarRoutes } from "./routes-calendar";
import { registerMiscRoutes } from "./routes-misc";
import { cached, peek, put } from "./cache";
import {
  MEDIA_STATUS_BLOCKLISTED, getBlocklistedTags, parseTagSet,
  filterResultsByTags, type ResultItem,
} from "./blocklist";

const __pluginDir = dirname(dirname(fileURLToPath(import.meta.url)));

/** Durée de vie du cache des pages de catalogue, partagé par tous. */
const PROXY_TTL_MS = 5 * 60_000;

interface PluginBackendContext {
  pluginId: string;
  getPrisma: () => import("@prisma/client").PrismaClient;
  requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

/*
 * `installed.json` était relu et re-parsé À CHAQUE requête HTTP (et à chaque
 * tick du worker) : ~300 µs de lecture synchrone sur le thread d'événements,
 * sur le chemin de /requests, /seerr/*, /proxy et /config. On garde le contenu
 * en mémoire, invalidé par la date de modification du fichier — le PUT /config
 * réécrit le fichier, donc le mtime change et la relecture se fait toute seule.
 */
let cfgCache: { mtimeMs: number; value: Record<string, unknown> } | null = null;

function getPluginConfig(ctx: PluginBackendContext): Record<string, unknown> {
  try {
    const installedPath = resolve(__pluginDir, "..", "installed.json");
    if (!existsSync(installedPath)) return {};
    const mtimeMs = statSync(installedPath).mtimeMs;
    if (cfgCache && cfgCache.mtimeMs === mtimeMs) return cfgCache.value;

    const installed = JSON.parse(readFileSync(installedPath, "utf-8"));
    const plugin = installed.find(
      (p: { pluginId?: string; id?: string }) =>
        p.pluginId === ctx.pluginId || p.id === ctx.pluginId,
    );
    const value = plugin?.config || {};
    cfgCache = { mtimeMs, value };
    return value;
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
      return { ...config, isAdmin: true };
    }
    // Non-admins : infos non-sensibles. `isAdmin` dit au client quoi proposer.
    return { url: config.url || "", enabled: !!config.enabled, hasApiKey: !!config.apiKey, isAdmin: false };
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

    // Surfaces soumises au blocage par tags Jellyseerr.
    const isDiscoverMovies = /^api\/v1\/discover\/movies(\/|$)/.test(wildcard);
    const isDiscoverTv = /^api\/v1\/discover\/tv(\/|$)/.test(wildcard);
    const isDiscover = isDiscoverMovies || isDiscoverTv;
    // search + trending : pas de without_keywords TMDB → filtrage par keywords.
    const isSearchLike =
      /^api\/v1\/discover\/trending/.test(wildcard) || /^api\/v1\/search/.test(wildcard);
    const isFilterable = isDiscover || isSearchLike;

    // Bouton « Afficher quand même » → on n'applique aucun filtrage.
    const showBlocked = query._showBlocked === "1" || query._showBlocked === "true";

    // On ne charge les tags bloqués que pour les GET filtrables (cache 5 min).
    const blocklistedTags =
      isFilterable && request.method === "GET"
        ? await getBlocklistedTags(seerrUrl, apiKey)
        : "";
    const blockedSet = parseTagSet(blocklistedTags);
    const blockedActive = blockedSet.size > 0;

    const qsParts: string[] = [];
    let hasExcludeKeywords = false;
    for (const [k, v] of Object.entries(query)) {
      if (k === "_lang" || k === "_showBlocked") continue;
      if (k === "excludeKeywords") hasExcludeKeywords = true;
      qsParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    // Discover : exclusion native côté TMDB (without_keywords), sauf si « afficher quand même ».
    if (isDiscover && blockedActive && !showBlocked && !hasExcludeKeywords) {
      qsParts.push(`excludeKeywords=${encodeURIComponent(blocklistedTags)}`);
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

    /* Cache mutualisé des surfaces de navigation.
     *
     * Une page de catalogue est identique pour tout le monde : les mêmes
     * filtres donnent la même réponse, et le statut des médias qu'elle porte
     * dépend de la bibliothèque, pas de qui regarde. Chaque changement de
     * filtre repartait pourtant chez Jellyseerr, qui repart chez TMDB — et
     * deux personnes appliquant le même filtre payaient l'aller-retour
     * chacune. Cinq minutes suffisent : c'est court devant le rythme auquel
     * un catalogue bouge, et long devant une session de navigation.
     *
     * Les mutations et les surfaces personnelles ne passent pas par ici. */
    const cacheable = request.method === "GET" && isFilterable;
    const cacheKey = cacheable
      ? `seer:proxy:${targetUrl}:${headers["Accept-Language"] ?? ""}`
      : null;

    if (cacheKey) {
      const hit = peek<Record<string, unknown>>(cacheKey);
      if (hit) {
        reply.header("content-type", "application/json");
        return reply.send(hit);
      }
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method, headers, body: reqBody,
        signal: AbortSignal.timeout(15_000),
      });

      // On bufferise + filtre uniquement les réponses JSON des surfaces concernées
      // quand un blocage par tags est actif. Sinon : stream transparent (historique).
      const ct = response.headers.get("content-type");
      const shouldHandleJson =
        isFilterable &&
        blockedActive &&
        response.ok &&
        (ct ?? "").includes("application/json");

      if (shouldHandleJson) {
        const data = (await response.json().catch(() => null)) as
          | (Record<string, unknown> & { results?: ResultItem[] })
          | null;

        if (data && Array.isArray(data.results)) {
          if (showBlocked) {
            // On affiche tout, mais on indique combien d'éléments seraient masqués.
            const { blockedCount } = await filterResultsByTags(
              seerrUrl,
              apiKey,
              isDiscover ? [] : data.results, // discover déjà non-filtré ici → compteur via search-like
              blockedSet,
            );
            data.blockedCount = isDiscover ? 0 : blockedCount;
          } else if (isSearchLike) {
            // search/trending : filtrage par keywords (TMDB n'a pas without_keywords).
            const { kept, blockedCount } = await filterResultsByTags(
              seerrUrl,
              apiKey,
              data.results,
              blockedSet,
            );
            data.results = kept;
            data.blockedCount = blockedCount;
          } else {
            // discover : déjà filtré via excludeKeywords ; on retire en plus les
            // éventuels BLOCKLISTED résiduels. Compteur non significatif ici.
            const before = data.results.length;
            data.results = data.results.filter(
              (item) => item?.mediaInfo?.status !== MEDIA_STATUS_BLOCKLISTED,
            );
            data.blockedCount = before - data.results.length;
          }
          data.blockedActive = blockedActive;
        }

        if (cacheKey && response.ok && data) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ?? {});
      }

      /* Réponse cachable : on la lit pour pouvoir la garder. Le flux direct
         reste la règle partout ailleurs — ces réponses-là sont de simples
         pages de résultats, pas des médias. */
      if (cacheKey && response.ok && (ct ?? "").includes("application/json")) {
        const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (data) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ?? {});
      }

      reply.status(response.status);
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
  registerUsersRoutes(app, prisma, gwc, ctx.requireAdmin);
  registerAvailabilityRoutes(app, prisma, gwc);
  registerProgressRoutes(app, prisma, gwc, ctx.requireAdmin);
  registerCalendarRoutes(app, prisma, gwc);

  registerMiscRoutes(app, prisma, gwc, ctx.requireAdmin);

  console.log("[SeerBackend] Routes registered");
}
