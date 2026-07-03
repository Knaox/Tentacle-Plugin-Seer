/* ------------------------------------------------------------------ */
/*  Seer Plugin — Actions sur une demande (retry, mark, retry-delete)  */
/* ------------------------------------------------------------------ */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  createRequest, getRequestById, deleteRequestById,
  updateRequestStatus, enqueueCleanup,
} from "./db";
import type { RequestStatus } from "./types";
import { invalidate } from "./cache";
import { kickWorkerNow } from "./worker";
import {
  getUser, type WorkerCfg, parseRequestId,
  fetchSeerrRequestById, fetchSeerrTmdbDetail,
} from "./seerr-unified";

export function registerRequestActionRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {

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
      kickWorkerNow();
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
    kickWorkerNow();
    return reply.status(201).send(newReq);
  });

  /* ── POST /requests/:id/mark — change le statut Jellyseerr du media ──
   * Écriture ONE-SHOT vers Jellyseerr : le plugin n'« épingle » jamais
   * l'état marqué. Si Jellyseerr change ensuite l'état de lui-même
   * (availability-sync, téléchargement…), l'affichage suit Jellyseerr. */
  app.post("/requests/:id/mark", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const body = (request.body as { status?: "available" | "partial" | "processing" | "unknown" } | null) ?? {};
    const target = body.status;
    if (!target || !["available", "partial", "processing", "unknown"].includes(target)) {
      return reply.status(400).send({ message: "status must be 'available', 'partial', 'processing' or 'unknown'" });
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

    // Réflecte localement (best-effort). Simple miroir de l'état Jellyseerr :
    // la synchro périodique (Jellyseerr → local) reprend la main ensuite.
    if (parsed.kind === "local") {
      const localStatus: RequestStatus = target === "available" ? "available"
        : target === "partial" ? "partially_available"
        : target === "processing" ? "downloading"
        : "unavailable";
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

    kickWorkerNow();
    return { success: true };
  });
}
