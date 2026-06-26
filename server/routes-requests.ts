/* ------------------------------------------------------------------ */
/*  Seer Plugin — Request routes (CRUD, retry, bulk)                   */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  createRequest, getRequestById, getUserRequests, getAllRequests,
  deleteRequestById, findDuplicate, enqueueCleanup,
  updateRequestStatus,
  findExistingTvRequest, addSeasonsToRequest,
  getOrCreateUserSettings, countRequestsToday,
} from "./db";
import type { CreateRequestBody, UnifiedRequest, RequestStatus, SeerRequest } from "./types";
import { fetchMediaDetail, isAnimeFromKeywords } from "./anime";
import { resolveJellyseerrUserId } from "./jellyseerr-user";
import { mapSeerrStatus } from "./worker-sync";
import { cached, invalidate } from "./cache";

interface JellyfinUser { userId: string; username: string; isAdmin: boolean; }

function getUser(request: FastifyRequest): JellyfinUser {
  return (request as any).user;
}

type WorkerCfg = { seerrUrl: string; seerrApiKey: string };

interface SeerrRequestRow {
  id: number;
  status: number;
  is4k?: boolean;
  createdAt?: string;
  updatedAt?: string;
  seasons?: Array<{ seasonNumber: number; status?: number }>;
  media?: {
    id: number;
    tmdbId: number;
    mediaType: "movie" | "tv";
    status?: number;
    downloadStatus?: Array<{ externalId: number; status: string }>;
  };
  requestedBy?: { id: number; jellyfinUserId?: string; jellyfinUsername?: string };
}

interface SeerrTmdbDetail {
  id?: number;
  title?: string;
  name?: string;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  releaseDate?: string;
  firstAirDate?: string;
}

function seerrRequestToUnified(
  sr: SeerrRequestRow,
  detail: SeerrTmdbDetail | null,
  localById: Map<number, SeerRequest>,
  fallbackUser: { jellyfinUserId: string; username: string },
): UnifiedRequest {
  const local = localById.get(sr.id);
  const status = mapSeerrStatus(sr.status, sr.media?.status, sr.media?.downloadStatus);
  const seasons = sr.seasons?.map((s) => s.seasonNumber).filter((n) => typeof n === "number") ?? null;
  const mediaType = (sr.media?.mediaType ?? "movie") as "movie" | "tv";
  const title = detail?.title ?? detail?.name ?? local?.title ?? `#${sr.id}`;
  const year = (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null;

  return {
    id: local?.id ?? `seerr-${sr.id}`,
    source: "seerr",
    jellyfinUserId: sr.requestedBy?.jellyfinUserId ?? fallbackUser.jellyfinUserId,
    username: sr.requestedBy?.jellyfinUsername ?? fallbackUser.username,
    mediaType,
    tmdbId: sr.media?.tmdbId ?? 0,
    title,
    posterPath: detail?.posterPath ?? local?.posterPath ?? null,
    backdropPath: detail?.backdropPath ?? local?.backdropPath ?? null,
    overview: detail?.overview ?? local?.overview ?? null,
    year: year || local?.year || null,
    seasons: seasons && seasons.length > 0 ? seasons : (local?.seasons ?? null),
    status,
    seerrRequestId: sr.id,
    seerrMediaId: sr.media?.id ?? null,
    seerrMediaStatus: sr.media?.status ?? null,
    retryCount: local?.retryCount ?? 0,
    maxRetries: local?.maxRetries ?? 10,
    lastError: local?.lastError ?? null,
    priority: local?.priority ?? 0,
    createdAt: sr.createdAt ?? local?.createdAt ?? new Date().toISOString(),
    updatedAt: sr.updatedAt ?? local?.updatedAt ?? new Date().toISOString(),
    sentAt: local?.sentAt ?? null,
    completedAt: local?.completedAt ?? null,
    profileId: local?.profileId ?? null,
    isAnime: local?.isAnime ?? false,
  };
}

function localToUnified(r: SeerRequest): UnifiedRequest {
  return {
    id: r.id,
    source: "local",
    jellyfinUserId: r.jellyfinUserId,
    username: r.username,
    mediaType: r.mediaType,
    tmdbId: r.tmdbId,
    title: r.title,
    posterPath: r.posterPath,
    backdropPath: r.backdropPath,
    overview: r.overview,
    year: r.year,
    seasons: r.seasons,
    status: r.status,
    seerrRequestId: r.seerrRequestId,
    seerrMediaId: r.seerrMediaId,
    seerrMediaStatus: r.seerrMediaStatus,
    retryCount: r.retryCount,
    maxRetries: r.maxRetries,
    lastError: r.lastError,
    priority: r.priority,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    sentAt: r.sentAt,
    completedAt: r.completedAt,
    profileId: r.profileId,
    isAnime: r.isAnime,
  };
}

async function fetchSeerrRequestsForUser(
  config: WorkerCfg,
  seerUserId: number,
  take: number,
  skip: number,
): Promise<{ rows: SeerrRequestRow[]; total: number }> {
  // Endpoint général GET /api/v1/request filtré par requestedBy — plus stable que /user/:id/requests
  const url = `${config.seerrUrl}/api/v1/request?take=${take}&skip=${skip}&filter=all&sort=added&requestedBy=${seerUserId}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jellyseerr GET /request?requestedBy=${seerUserId} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { pageInfo?: { results?: number }; results?: SeerrRequestRow[] };
  return { rows: data.results ?? [], total: data.pageInfo?.results ?? data.results?.length ?? 0 };
}

async function fetchSeerrTmdbDetail(
  config: WorkerCfg,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<SeerrTmdbDetail | null> {
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SeerrTmdbDetail;
  } catch { return null; }
}

interface SeerrSingleRequest {
  id: number;
  status: number;
  seasons?: Array<{ seasonNumber: number }>;
  media?: {
    id: number;
    tmdbId: number;
    mediaType: "movie" | "tv";
    status?: number;
  };
  requestedBy?: { id: number; jellyfinUserId?: string };
}

async function fetchSeerrRequestById(
  config: WorkerCfg, seerrId: number,
): Promise<SeerrSingleRequest | null> {
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/request/${seerrId}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SeerrSingleRequest;
  } catch { return null; }
}

/** Parse l'ID renvoyé par GET /requests : soit UUID local, soit "seerr-<n>". */
function parseRequestId(id: string): { kind: "local"; id: string } | { kind: "seerr"; seerrId: number } {
  if (id.startsWith("seerr-")) {
    const n = Number(id.slice(6));
    if (Number.isFinite(n)) return { kind: "seerr", seerrId: n };
  }
  return { kind: "local", id };
}

export function registerRequestRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {

  /* ── GET /requests/stats — stats agrégées depuis Jellyseerr + locales en attente ── */
  app.get("/requests/stats", async (request, reply) => {
    const user = getUser(request);
    const config = await getWorkerConfig();

    // Cache 60s par user — évite de répaginer toutes les demandes Jellyseerr à chaque ouverture
    return cached(`seer-cache:${user.userId}:stats`, 60_000, async () => {
      const byStatus: Record<string, number> = {};
      const byType: { movie: number; tv: number } = { movie: 0, tv: 0 };
      let total = 0;

      if (config) {
        try {
          const seerUserId = await resolveJellyseerrUserId(config, prisma, user.userId, user.username);
          let skip = 0;
          const take = 100;
          for (let i = 0; i < 25; i++) {
            const { rows } = await fetchSeerrRequestsForUser(config, seerUserId, take, skip);
            for (const sr of rows) {
              total++;
              const status = mapSeerrStatus(sr.status, sr.media?.status, sr.media?.downloadStatus);
              byStatus[status] = (byStatus[status] ?? 0) + 1;
              const mt = sr.media?.mediaType;
              if (mt === "movie") byType.movie++;
              else if (mt === "tv") byType.tv++;
            }
            if (rows.length < take) break;
            skip += take;
          }
        } catch (err) {
          request.log?.warn?.({ err }, "Seerr stats fetch failed");
        }
      }

      const localPending = await prisma.$queryRawUnsafe<Array<{ status: string; media_type: string }>>(
        `SELECT status, media_type FROM seer_requests
         WHERE jellyfin_user_id = ?
           AND seerr_request_id IS NULL
           AND status IN ('queued','processing','retry_pending','failed')`,
        user.userId,
      );
      for (const r of localPending) {
        total++;
        byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
        if (r.media_type === "movie") byType.movie++;
        else if (r.media_type === "tv") byType.tv++;
      }

      return { total, byStatus, byType };
    });
  });

  /* ── GET /requests — fusion Jellyseerr (source de vérité) + locales en attente ── */
  app.get("/requests", async (request, reply) => {
    const user = getUser(request);
    const query = request.query as { page?: string; limit?: string; status?: string; type?: string };

    if (user.isAdmin && query.status === "all_users") {
      const list = await getAllRequests(prisma, {
        page: Number(query.page) || 1, limit: Number(query.limit) || 20, mediaType: query.type,
      });
      return { ...list, results: list.results.map(localToUnified) };
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);

    const config = await getWorkerConfig();
    if (!config) {
      const local = await getUserRequests(prisma, user.userId, { page, limit, mediaType: query.type });
      return { ...local, results: local.results.map(localToUnified) };
    }

    // Cache 60s par user de la liste FUSIONNÉE complète (sans filtre/pagination).
    // Les changements de filtre n'entraînent donc aucun hit Jellyseerr supplémentaire.
    const merged: UnifiedRequest[] = await cached(
      `seer-cache:${user.userId}:list`,
      60_000,
      async () => {
        const { rowToRequest } = await import("./db-helpers");
        const localPendingRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT * FROM seer_requests
           WHERE jellyfin_user_id = ?
             AND status IN ('queued','processing','retry_pending','failed','deleting','delete_failed')
           ORDER BY created_at DESC`,
          user.userId,
        );
        const localPending = localPendingRows.map(rowToRequest);

        const localBySeerrId = new Map<number, SeerRequest>();
        const allLocalRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT * FROM seer_requests WHERE jellyfin_user_id = ? AND seerr_request_id IS NOT NULL`,
          user.userId,
        );
        for (const row of allLocalRows) {
          const r = rowToRequest(row);
          if (r.seerrRequestId) localBySeerrId.set(r.seerrRequestId, r);
        }

        let seerrUnified: UnifiedRequest[] = [];
        try {
          const seerUserId = await resolveJellyseerrUserId(config, prisma, user.userId, user.username);
          const take = 100;
          const allRows: SeerrRequestRow[] = [];
          let skip = 0;
          for (let i = 0; i < 25; i++) {
            const { rows } = await fetchSeerrRequestsForUser(config, seerUserId, take, skip);
            allRows.push(...rows);
            if (rows.length < take) break;
            skip += take;
          }

          const detailCache = new Map<string, SeerrTmdbDetail | null>();
          const tasks = allRows.map(async (sr) => {
            if (!sr.media) return null;
            const key = `${sr.media.mediaType}-${sr.media.tmdbId}`;
            if (!detailCache.has(key)) {
              detailCache.set(key, await fetchSeerrTmdbDetail(config, sr.media.mediaType, sr.media.tmdbId));
            }
            return seerrRequestToUnified(sr, detailCache.get(key) ?? null, localBySeerrId, {
              jellyfinUserId: user.userId, username: user.username,
            });
          });
          seerrUnified = (await Promise.all(tasks)).filter((x): x is UnifiedRequest => x !== null);
        } catch (err) {
          request.log?.warn?.({ err }, "Seerr fetch failed, falling back to local only");
        }

        const seerrSeenIds = new Set(seerrUnified.map((u) => u.seerrRequestId).filter(Boolean));
        const localFiltered = localPending
          .filter((l) => !l.seerrRequestId || !seerrSeenIds.has(l.seerrRequestId))
          .map(localToUnified);

        const out: UnifiedRequest[] = [...localFiltered, ...seerrUnified];
        out.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        return out;
      },
    );

    // Filtres + pagination sur la liste cachée (instant, pas d'I/O réseau)
    let filtered = merged;
    if (query.type) {
      filtered = filtered.filter((r) => r.mediaType === query.type);
    }
    if (query.status) {
      const wanted = new Set(query.status.split(",").map((s) => s.trim() as RequestStatus));
      filtered = filtered.filter((r) => wanted.has(r.status));
    }
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const sliced = filtered.slice(offset, offset + limit);

    return {
      results: sliced,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  });

  /* ── POST /requests — validation user (block/quota/type) ─────────── */
  app.post("/requests", async (request, reply) => {
    const user = getUser(request);
    const body = request.body as CreateRequestBody;

    if (!body.mediaType || !body.tmdbId || !body.title) {
      return reply.status(400).send({ message: "mediaType, tmdbId, and title are required" });
    }

    // 1) Charge ou crée les settings du user
    const settings = await getOrCreateUserSettings(prisma, user.userId, user.username);

    // 2) Blocage
    if (settings.blocked) {
      return reply.status(403).send({ errorKey: "seer:errUserBlocked", message: "User is blocked" });
    }

    // 3) Détection du type réel (anime ?)
    let isAnime = false;
    const config = await getWorkerConfig();
    if (body.mediaType === "tv" && config) {
      const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, "tv", body.tmdbId);
      if (detail && isAnimeFromKeywords(detail)) isAnime = true;
    }

    // 4) Permission par type
    if (body.mediaType === "movie" && !settings.allowMovies) {
      return reply.status(403).send({ errorKey: "seer:errMoviesDenied", message: "Movies denied" });
    }
    if (body.mediaType === "tv" && isAnime && !settings.allowAnime) {
      return reply.status(403).send({ errorKey: "seer:errAnimeDenied", message: "Anime denied" });
    }
    if (body.mediaType === "tv" && !isAnime && !settings.allowTv) {
      return reply.status(403).send({ errorKey: "seer:errTvDenied", message: "TV denied" });
    }

    // 5) Quota quotidien
    if (settings.dailyLimit !== null && settings.dailyLimit !== undefined) {
      const todayCount = await countRequestsToday(prisma, user.userId);
      if (todayCount >= settings.dailyLimit) {
        return reply.status(429).send({
          errorKey: "seer:errQuotaReached",
          limit: settings.dailyLimit,
          message: `Daily quota reached (${settings.dailyLimit})`,
        });
      }
    }

    // 6) TV : fusion saisons (existant)
    if (body.mediaType === "tv" && body.seasons?.length) {
      const existing = await findExistingTvRequest(prisma, user.userId, body.tmdbId);
      if (existing) {
        const existingSeasons = new Set(existing.seasons ?? []);
        const newSeasons = body.seasons.filter((s) => !existingSeasons.has(s));
        if (newSeasons.length === 0) {
          return reply.status(409).send({ message: "All seasons already requested", existing });
        }

        const merged = [...(existing.seasons ?? []), ...newSeasons].sort((a, b) => a - b);
        await addSeasonsToRequest(prisma, existing.id, merged);

        await createRequest(prisma, {
          jellyfinUserId: user.userId, username: user.username,
          mediaType: body.mediaType, tmdbId: body.tmdbId, title: body.title,
          posterPath: body.posterPath, backdropPath: body.backdropPath,
          overview: body.overview, year: body.year,
          seasons: newSeasons,
          profileId: body.profileId ?? existing.profileId,
          isAnime,
        });

        const updated = await getRequestById(prisma, existing.id);
        invalidate(`seer-cache:${user.userId}`);
        return reply.status(201).send(updated);
      }
    }

    // 7) Doublon film / 1ère TV
    const dup = await findDuplicate(prisma, user.userId, body.tmdbId, body.mediaType, body.seasons);
    if (dup) {
      return reply.status(409).send({ message: "A request for this media is already active", existing: dup });
    }

    const req = await createRequest(prisma, {
      jellyfinUserId: user.userId, username: user.username,
      mediaType: body.mediaType, tmdbId: body.tmdbId, title: body.title,
      posterPath: body.posterPath, backdropPath: body.backdropPath,
      overview: body.overview, year: body.year, seasons: body.seasons,
      profileId: body.profileId,
      isAnime,
    });

    invalidate(`seer-cache:${user.userId}`);
    return reply.status(201).send(req);
  });

  app.delete("/requests/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const body = (request.body as { seasons?: number[]; deleteFiles?: boolean } | null) ?? {};
    const deleteFiles = body.deleteFiles === true; // défaut: false (juste Jellyseerr)
    const parsed = parseRequestId(id);

    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
        return reply.status(403).send({ message: "Not your request" });
      }

      // Suppression « douce » : on route TOUT (film, série entière, saison) via la
      // cleanup queue. Le worker désactive la surveillance *arr (+ supprime les
      // fichiers si deleteFiles) sans jamais retirer la série/le film.
      const reqSeasons = req.seasons ?? [];
      const isSeasonSpecific = req.mediaType === "tv" && !!body.seasons && body.seasons.length > 0;
      // Défense : une suppression TV ne doit JAMAIS dépasser les saisons de CETTE
      // demande. Si aucune saison précise n'est fournie, on retombe sur les saisons
      // de la demande (et non sur « toute la série »). null seulement pour les films
      // ou les demandes TV sans saisons enregistrées (legacy).
      const removing = isSeasonSpecific
        ? body.seasons!
        : (req.mediaType === "tv" && reqSeasons.length > 0 ? reqSeasons : null);
      const remaining = isSeasonSpecific ? reqSeasons.filter((s) => !removing!.includes(s)) : [];
      // Partiel = on retire certaines saisons mais d'autres restent suivies.
      const partial = isSeasonSpecific && remaining.length > 0;

      await enqueueCleanup(prisma, {
        action: "delete", mediaType: req.mediaType, tmdbId: req.tmdbId, title: req.title,
        // En partiel on préserve la demande Jellyseerr et la ligne locale
        // (les saisons conservées restent suivies) ; on agit uniquement sur *arr.
        seerrRequestId: partial ? null : req.seerrRequestId,
        seerrMediaId: req.seerrMediaId,
        deleteFiles,
        seasons: removing,
        requestId: partial ? null : parsed.id,
      });

      if (partial) {
        await addSeasonsToRequest(prisma, parsed.id, remaining);
      } else {
        await updateRequestStatus(prisma, parsed.id, "deleting");
      }
      invalidate(`seer-cache:${user.userId}`);
      return { success: true, status: partial ? "updated" : "deleting" };
    }

    // ── Demande venant directement de Jellyseerr (pas de pendant local) ──
    const config = await getWorkerConfig();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });

    const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
    if (!seerrReq) return reply.status(404).send({ message: "Seerr request not found" });

    // Verrou ownership : on compare via seer_user_settings.jellyseerr_user_id
    if (!user.isAdmin) {
      const settingsRows = await prisma.$queryRawUnsafe<Array<{ jellyseerr_user_id: number | null }>>(
        `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
        user.userId,
      );
      const myId = settingsRows[0]?.jellyseerr_user_id ?? null;
      if (!myId || seerrReq.requestedBy?.id !== myId) {
        return reply.status(403).send({ message: "Not your request" });
      }
    }

    await enqueueCleanup(prisma, {
      action: "delete",
      mediaType: seerrReq.media?.mediaType ?? "movie",
      tmdbId: seerrReq.media?.tmdbId ?? 0,
      title: `#${seerrReq.id}`,
      seerrRequestId: seerrReq.id,
      seerrMediaId: seerrReq.media?.id ?? null,
      deleteFiles,
      seasons: body.seasons && body.seasons.length > 0 ? body.seasons : null,
      requestId: null,
    });

    invalidate(`seer-cache:${user.userId}`);
    return { success: true, status: "deleting" };
  });

  app.post("/requests/:id/retry", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const body = (request.body as { seasons?: number[]; profileId?: string | null; forceRedownload?: boolean } | null) ?? {};
    const forceRedownload = body.forceRedownload === true; // défaut: false
    const parsed = parseRequestId(id);

    const config = await getWorkerConfig();

    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
        return reply.status(403).send({ message: "Not your request" });
      }

      const newProfileId = body.profileId !== undefined ? body.profileId : req.profileId;

      if (config) {
        // Supprime toujours l'ancienne request Jellyseerr (sinon doublon).
        // Le media n'est supprimé que si forceRedownload est demandé.
        if (req.seerrRequestId) {
          await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
            method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(10_000),
          }).catch(() => {});
        }
        if (forceRedownload && req.seerrMediaId) {
          await fetch(`${config.seerrUrl}/api/v1/media/${req.seerrMediaId}`, {
            method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(10_000),
          }).catch(() => {});
        }
      }

      await deleteRequestById(prisma, parsed.id);

      const retrySeasons = body.seasons && body.seasons.length > 0 ? body.seasons : req.seasons;
      const newReq = await createRequest(prisma, {
        jellyfinUserId: req.jellyfinUserId, username: req.username,
        mediaType: req.mediaType, tmdbId: req.tmdbId, title: req.title,
        posterPath: req.posterPath, backdropPath: req.backdropPath,
        overview: req.overview, year: req.year, seasons: retrySeasons, priority: 1,
        profileId: newProfileId, isAnime: req.isAnime,
      });
      invalidate(`seer-cache:${user.userId}`);
      return reply.status(201).send(newReq);
    }

    // ── Retry d'une demande Jellyseerr sans pendant local ──
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
    if (!seerrReq) return reply.status(404).send({ message: "Seerr request not found" });

    // Ownership
    if (!user.isAdmin) {
      const settingsRows = await prisma.$queryRawUnsafe<Array<{ jellyseerr_user_id: number | null }>>(
        `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
        user.userId,
      );
      const myId = settingsRows[0]?.jellyseerr_user_id ?? null;
      if (!myId || seerrReq.requestedBy?.id !== myId) {
        return reply.status(403).send({ message: "Not your request" });
      }
    }

    const mediaType = seerrReq.media?.mediaType ?? "movie";
    const tmdbId = seerrReq.media?.tmdbId ?? 0;
    if (!tmdbId) return reply.status(400).send({ message: "Cannot retry: missing TMDB id" });

    // Récupère métadonnées (titre, poster) pour affichage local
    const detail = await fetchSeerrTmdbDetail(config, mediaType, tmdbId);
    const title = detail?.title ?? detail?.name ?? `#${seerrReq.id}`;

    // Supprime toujours l'ancienne request Jellyseerr (sinon doublon).
    // Le media n'est supprimé que si forceRedownload est explicitement demandé.
    await fetch(`${config.seerrUrl}/api/v1/request/${seerrReq.id}`, {
      method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
    if (forceRedownload && seerrReq.media?.id) {
      await fetch(`${config.seerrUrl}/api/v1/media/${seerrReq.media.id}`, {
        method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    }

    const retrySeasons = body.seasons && body.seasons.length > 0
      ? body.seasons
      : (seerrReq.seasons?.map((s) => s.seasonNumber) ?? null);

    const newReq = await createRequest(prisma, {
      jellyfinUserId: user.userId, username: user.username,
      mediaType, tmdbId, title,
      posterPath: detail?.posterPath ?? null,
      backdropPath: detail?.backdropPath ?? null,
      overview: detail?.overview ?? null,
      year: (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null,
      seasons: retrySeasons, priority: 1,
      profileId: body.profileId ?? null,
      isAnime: false,
    });
    invalidate(`seer-cache:${user.userId}`);
    return reply.status(201).send(newReq);
  });

  /* ── POST /requests/:id/mark — change le statut Jellyseerr du media ── */
  app.post("/requests/:id/mark", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const body = (request.body as { status?: "available" | "partial" | "unknown" } | null) ?? {};
    const target = body.status;
    if (!target || !["available", "partial", "unknown"].includes(target)) {
      return reply.status(400).send({ message: "status must be 'available', 'partial' or 'unknown'" });
    }

    const config = await getWorkerConfig();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });

    const parsed = parseRequestId(id);

    // Résoudre le seerrMediaId selon la source
    let seerrMediaId: number | null = null;
    let ownerJellyfinUserId: string | null = null;
    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      seerrMediaId = req.seerrMediaId;
      ownerJellyfinUserId = req.jellyfinUserId;
    } else {
      const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
      if (!seerrReq) return reply.status(404).send({ message: "Seerr request not found" });
      seerrMediaId = seerrReq.media?.id ?? null;
      // Trouver le jellyfinUserId via le mapping seer_user_settings
      if (seerrReq.requestedBy?.id) {
        const rows = await prisma.$queryRawUnsafe<Array<{ jellyfin_user_id: string }>>(
          `SELECT jellyfin_user_id FROM seer_user_settings WHERE jellyseerr_user_id = ? LIMIT 1`,
          seerrReq.requestedBy.id,
        );
        ownerJellyfinUserId = rows[0]?.jellyfin_user_id ?? null;
      }
    }

    if (!seerrMediaId) return reply.status(400).send({ message: "No Jellyseerr media linked" });

    // Ownership : owner ou admin
    if (!user.isAdmin && ownerJellyfinUserId && ownerJellyfinUserId !== user.userId) {
      return reply.status(403).send({ message: "Not your request" });
    }

    const res = await fetch(`${config.seerrUrl}/api/v1/media/${seerrMediaId}/${target}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
      body: JSON.stringify({ is4k: false }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return reply.status(502).send({
        message: `Jellyseerr mark ${target} failed: ${res.status} ${text.slice(0, 200)}`,
      });
    }

    // Réflecte localement (best-effort)
    if (parsed.kind === "local") {
      const localStatus = target === "available" ? "available"
        : target === "partial" ? "partially_available"
        : "sent_to_seer";
      await updateRequestStatus(prisma, parsed.id, localStatus);
    }

    invalidate(`seer-cache:${user.userId}`);
    return { success: true, target };
  });

  app.post("/requests/:id/retry-delete", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const req = await getRequestById(prisma, id);

    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }
    if (req.status !== "delete_failed" && req.status !== "deleting") {
      return reply.status(400).send({ message: "Request is not in a deletable state" });
    }

    await updateRequestStatus(prisma, id, "deleting", { lastError: "" });
    await enqueueCleanup(prisma, {
      action: "delete", mediaType: req.mediaType, tmdbId: req.tmdbId, title: req.title,
      seerrRequestId: req.seerrRequestId, seerrMediaId: req.seerrMediaId,
      deleteFiles: true, requestId: id,
    });

    return { success: true };
  });
}
