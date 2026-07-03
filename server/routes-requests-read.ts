/* ------------------------------------------------------------------ */
/*  Seer Plugin — Routes de lecture (stats + liste fusionnée)          */
/* ------------------------------------------------------------------ */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { getAllRequests, getUserRequests } from "./db";
import type { UnifiedRequest, RequestStatus, SeerRequest } from "./types";
import { resolveJellyseerrUserId } from "./jellyseerr-user";
import { mapSeerrStatus } from "./worker-sync";
import { cached } from "./cache";
import {
  getUser, type WorkerCfg, type SeerrRequestRow, type SeerrTmdbDetail,
  seerrRequestToUnified, localToUnified,
  fetchSeerrRequestsForUser, fetchSeerrTmdbDetail,
} from "./seerr-unified";

export function registerRequestReadRoutes(
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
    const query = request.query as { page?: string; limit?: string; status?: string; type?: string; q?: string };

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

        // Demandes Jellyseerr dont la suppression est en file (job cleanup
        // pending) : affichées « deleting » tout de suite. Sans ce marquage,
        // un refetch juste après la suppression re-affichait l'ancien état
        // jusqu'à ce que le worker ait réellement supprimé côté Jellyseerr.
        try {
          const pendingDeletes = await prisma.$queryRawUnsafe<Array<{ seerr_request_id: number }>>(
            `SELECT seerr_request_id FROM seer_cleanup_queue
             WHERE status = 'pending' AND action = 'delete' AND seerr_request_id IS NOT NULL`,
          );
          const deletingIds = new Set(pendingDeletes.map((r) => Number(r.seerr_request_id)));
          if (deletingIds.size > 0) {
            for (const u of out) {
              if (u.seerrRequestId && deletingIds.has(u.seerrRequestId)) u.status = "deleting";
            }
          }
        } catch { /* best-effort */ }

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
    // Recherche par titre (sur toute la liste fusionnée, avant pagination).
    if (query.q) {
      const q = query.q.trim().toLowerCase();
      if (q) filtered = filtered.filter((r) => (r.title ?? "").toLowerCase().includes(q));
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

}
