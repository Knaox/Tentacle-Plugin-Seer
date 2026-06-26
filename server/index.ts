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
import { registerUsersRoutes } from "./routes-users";
import { cached } from "./cache";

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

/* ── Blocage par tags (Jellyseerr « Bloquer le contenu avec des tags ») ──
 *
 * Jellyseerr stocke les keywords TMDB bloqués dans `settings.main.blocklistedTags`
 * (IDs séparés par des virgules). On applique ce blocage sur 3 surfaces :
 *   1. Discover (movies/tv/anime) : on passe les tags en `excludeKeywords`
 *      → TMDB `without_keywords`, exclusion native à la source (pagination propre).
 *   2. Search / trending : TMDB multi-search n'accepte PAS `without_keywords`, et
 *      le job `process-blocklisted-tags` de Jellyseerr ne couvre qu'une fraction du
 *      catalogue. On filtre donc en lisant les keywords de chaque résultat
 *      (`/api/v1/{movie|tv}/{id}` → champ `keywords`), avec cache 7 j.
 *   3. Toutes surfaces : on retire aussi les médias déjà au statut BLOCKLISTED (6).
 *
 * Le filtrage est désactivable par requête via `?_showBlocked=1` (bouton
 * « Afficher quand même »). On renvoie alors `blockedCount`/`blockedActive` pour
 * que l'UI sache combien d'éléments sont masqués.
 *
 * `settings.main` et le détail ne sont lisibles qu'avec la clé d'API admin
 * (déjà détenue côté plugin).
 */
const MEDIA_STATUS_BLOCKLISTED = 6;
const KEYWORD_FETCH_CONCURRENCY = 8;

async function getBlocklistedTags(seerrUrl: string, apiKey: string): Promise<string> {
  return cached(`seerr:blocklistedTags:${seerrUrl}`, 5 * 60_000, async () => {
    try {
      const res = await fetch(`${seerrUrl}/api/v1/settings/main`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return "";
      const data = (await res.json()) as { blocklistedTags?: string };
      return (data.blocklistedTags ?? "").trim();
    } catch {
      return "";
    }
  });
}

/** Convertit la CSV `blocklistedTags` en Set d'IDs numériques. */
function parseTagSet(csv: string): Set<number> {
  const set = new Set<number>();
  for (const part of csv.split(",")) {
    const id = Number(part.trim());
    if (Number.isFinite(id) && id > 0) set.add(id);
  }
  return set;
}

/** IDs de keywords TMDB d'un média (cache 7 j — les keywords bougent très peu). */
async function getItemKeywordIds(
  seerrUrl: string,
  apiKey: string,
  mediaType: "movie" | "tv",
  id: number,
): Promise<number[]> {
  return cached(`seerr:kw:${mediaType}:${id}`, 7 * 86_400_000, async () => {
    try {
      const res = await fetch(`${seerrUrl}/api/v1/${mediaType}/${id}`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { keywords?: Array<{ id?: number }> };
      return Array.isArray(data.keywords)
        ? data.keywords.map((k) => k?.id).filter((x): x is number => typeof x === "number")
        : [];
    } catch {
      return [];
    }
  });
}

interface ResultItem {
  id?: number;
  mediaType?: string;
  mediaInfo?: { status?: number };
}

/**
 * Filtre une page de résultats (search/trending) en récupérant les keywords de
 * chaque film/série et en retirant ceux qui intersectent les tags bloqués.
 * Les `person` sont conservées (pas de keywords). Retourne la liste filtrée et
 * le nombre d'éléments masqués.
 */
async function filterResultsByTags(
  seerrUrl: string,
  apiKey: string,
  results: ResultItem[],
  blockedSet: Set<number>,
): Promise<{ kept: ResultItem[]; blockedCount: number }> {
  // 1) Retrait immédiat des éléments déjà marqués BLOCKLISTED par Jellyseerr.
  const afterStatus = results.filter((r) => r?.mediaInfo?.status !== MEDIA_STATUS_BLOCKLISTED);
  let blockedCount = results.length - afterStatus.length;

  // 2) Vérification par keywords (films/séries uniquement), bornée en concurrence.
  const blockedFlags = new Array<boolean>(afterStatus.length).fill(false);
  const checkable = afterStatus
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => (item.mediaType === "movie" || item.mediaType === "tv") && typeof item.id === "number");

  for (let i = 0; i < checkable.length; i += KEYWORD_FETCH_CONCURRENCY) {
    const batch = checkable.slice(i, i + KEYWORD_FETCH_CONCURRENCY);
    await Promise.all(
      batch.map(async ({ item, idx }) => {
        const kwIds = await getItemKeywordIds(
          seerrUrl,
          apiKey,
          item.mediaType as "movie" | "tv",
          item.id as number,
        );
        if (kwIds.some((id) => blockedSet.has(id))) blockedFlags[idx] = true;
      }),
    );
  }

  const kept = afterStatus.filter((_, idx) => !blockedFlags[idx]);
  blockedCount += afterStatus.length - kept.length;
  return { kept, blockedCount };
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
