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
} from "./db";
import type { CreateRequestBody } from "./types";

interface JellyfinUser { userId: string; username: string; isAdmin: boolean; }

function getUser(request: FastifyRequest): JellyfinUser {
  return (request as any).user;
}

export function registerRequestRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<{ seerrUrl: string; seerrApiKey: string } | null>,
): void {

  app.get("/requests", async (request) => {
    const user = getUser(request);
    const query = request.query as { page?: string; limit?: string; status?: string; type?: string };

    if (user.isAdmin && query.status === "all_users") {
      return getAllRequests(prisma, {
        page: Number(query.page) || 1, limit: Number(query.limit) || 20, mediaType: query.type,
      });
    }

    return getUserRequests(prisma, user.userId, {
      page: Number(query.page) || 1, limit: Number(query.limit) || 20,
      status: query.status, mediaType: query.type,
    });
  });

  app.post("/requests", async (request, reply) => {
    const user = getUser(request);
    const body = request.body as CreateRequestBody;

    if (!body.mediaType || !body.tmdbId || !body.title) {
      return reply.status(400).send({ message: "mediaType, tmdbId, and title are required" });
    }

    // Pour les séries TV : ajouter les nouvelles saisons sans toucher à l'existant
    if (body.mediaType === "tv" && body.seasons?.length) {
      const existing = await findExistingTvRequest(prisma, user.userId, body.tmdbId);
      if (existing) {
        const existingSeasons = new Set(existing.seasons ?? []);
        const newSeasons = body.seasons.filter((s) => !existingSeasons.has(s));
        if (newSeasons.length === 0) {
          return reply.status(409).send({ message: "All seasons already requested", existing });
        }

        // Mettre à jour l'affichage local (toutes les saisons fusionnées)
        const merged = [...(existing.seasons ?? []), ...newSeasons].sort((a, b) => a - b);
        await addSeasonsToRequest(prisma, existing.id, merged);

        // Créer une demande séparée pour les NOUVELLES saisons uniquement
        // Le worker enverra juste celles-ci à Seerr (pas de suppression)
        const newReq = await createRequest(prisma, {
          jellyfinUserId: user.userId, username: user.username,
          mediaType: body.mediaType, tmdbId: body.tmdbId, title: body.title,
          posterPath: body.posterPath, backdropPath: body.backdropPath,
          overview: body.overview, year: body.year,
          seasons: newSeasons,
          profileId: body.profileId ?? existing.profileId,
        });

        const updated = await getRequestById(prisma, existing.id);
        return reply.status(201).send(updated);
      }
    }

    // Films ou première demande TV : vérifier les doublons
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
    });

    return reply.status(201).send(req);
  });

  app.delete("/requests/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const body = (request.body as { seasons?: number[] } | null) ?? {};
    const req = await getRequestById(prisma, id);

    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }

    // NE PAS supprimer la request Seerr ici — le cleanup worker s'en charge
    // dans le bon ordre (fichiers Sonarr/Radarr → media Seerr → request Seerr → local)

    const isSeasonSpecific = req.mediaType === "tv" && body.seasons && body.seasons.length > 0;
    const isFullSeries = req.mediaType === "tv" && !isSeasonSpecific;

    if (req.mediaType === "movie" || isFullSeries) {
      await updateRequestStatus(prisma, id, "deleting");
      await enqueueCleanup(prisma, {
        action: "delete", mediaType: req.mediaType, tmdbId: req.tmdbId, title: req.title,
        seerrRequestId: req.seerrRequestId, seerrMediaId: req.seerrMediaId,
        deleteFiles: true, requestId: id,
      });
    } else {
      await deleteRequestById(prisma, id);
    }

    return { success: true, status: "deleting" };
  });

  app.post("/requests/:id/retry", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const body = (request.body as { seasons?: number[]; profileId?: string | null } | null) ?? {};
    const req = await getRequestById(prisma, id);

    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }

    // Utiliser le nouveau profileId si fourni, sinon garder l'ancien
    const newProfileId = body.profileId !== undefined ? body.profileId : req.profileId;

    const config = await getWorkerConfig();

    // Supprimer la request Seerr + media Seerr (pour permettre une nouvelle demande)
    // PAS de suppression Sonarr/Radarr — on garde le media, on relance juste la recherche
    if (config) {
      if (req.seerrRequestId) {
        await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
          method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
          signal: AbortSignal.timeout(10_000),
        }).catch(() => {});
      }
      if (req.seerrMediaId) {
        await fetch(`${config.seerrUrl}/api/v1/media/${req.seerrMediaId}`, {
          method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
          signal: AbortSignal.timeout(10_000),
        }).catch(() => {});
      }
    }

    // Supprimer l'ancienne demande locale
    await deleteRequestById(prisma, id);

    // Recréer avec priorité haute — le worker enverra à Seerr qui relancera la recherche
    const retrySeasons = body.seasons && body.seasons.length > 0 ? body.seasons : req.seasons;
    const newReq = await createRequest(prisma, {
      jellyfinUserId: req.jellyfinUserId, username: req.username,
      mediaType: req.mediaType, tmdbId: req.tmdbId, title: req.title,
      posterPath: req.posterPath, backdropPath: req.backdropPath,
      overview: req.overview, year: req.year, seasons: retrySeasons, priority: 1,
      profileId: newProfileId,
    });

    return reply.status(201).send(newReq);
  });

  /** Relancer une suppression échouée (delete_failed → deleting) */
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
