/* ------------------------------------------------------------------ */
/*  Seer Plugin — Admin user management routes                         */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { listUsersWithStats, getOrCreateUserSettings, getUserSettings, updateUserSettings } from "./db";
import {
  resolveJellyseerrUserId,
  listAllJellyseerrUsers,
  createPlaceholderJellyseerrUser,
  invalidateStaleJellyseerrCache,
} from "./jellyseerr-user";
import { invalidate } from "./cache";

interface JellyfinUser { userId: string; username: string; isAdmin: boolean; }

type WorkerCfg = { seerrUrl: string; seerrApiKey: string };

interface UpdateUserBody {
  blocked?: boolean;
  dailyLimit?: number | null;
  allowMovies?: boolean;
  allowTv?: boolean;
  allowAnime?: boolean;
}

export function registerUsersRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {

  app.get(
    "/admin/users",
    { preHandler: requireAdmin },
    async () => {
      return await listUsersWithStats(prisma);
    },
  );

  app.put(
    "/admin/users/:jellyfinUserId",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { jellyfinUserId } = request.params as { jellyfinUserId: string };
      const body = (request.body as UpdateUserBody) ?? {};

      // S'assure que la row existe SANS écraser le username existant
      const current = await getUserSettings(prisma, jellyfinUserId);
      const usernameForCreation = current?.username || jellyfinUserId;
      const existing = await getOrCreateUserSettings(prisma, jellyfinUserId, usernameForCreation);

      // Normalisation dailyLimit : 0/empty/string-vide → null
      let dailyLimit: number | null | undefined = body.dailyLimit;
      if (dailyLimit === 0 || (typeof dailyLimit === "string" && (dailyLimit as string) === "")) {
        dailyLimit = null;
      }
      if (typeof dailyLimit === "number" && Number.isNaN(dailyLimit)) dailyLimit = null;

      await updateUserSettings(prisma, jellyfinUserId, {
        blocked: body.blocked,
        dailyLimit,
        allowMovies: body.allowMovies,
        allowTv: body.allowTv,
        allowAnime: body.allowAnime,
      });

      // Renvoie la liste fraîche pour resync UI
      const all = await listUsersWithStats(prisma);
      const updated = all.find((u) => u.jellyfinUserId === jellyfinUserId);
      return updated ?? existing;
    },
  );

  app.post(
    "/admin/users/sync",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const config = await getWorkerConfig();
      if (!config) return reply.status(503).send({ message: "Seerr not configured" });

      // 0) Invalide les jellyseerr_user_id cachés qui ne pointent plus vers un user existant
      //    (ex: l'admin a supprimé le user côté Jellyseerr depuis la dernière sync)
      let invalidatedLinks = 0;
      try {
        invalidatedLinks = await invalidateStaleJellyseerrCache(config, prisma);
      } catch {
        // Si l'API user Jellyseerr est en panne, on passe l'étape — non bloquant
      }

      // 1) Tente d'abord l'API admin Jellyfin (source la plus complète)
      let users: Array<{ id: string; name: string }> = [];
      let jellyfinError: string | null = null;
      try {
        users = await fetchJellyfinUsers();
      } catch (err) {
        jellyfinError = err instanceof Error ? err.message : "Jellyfin fetch failed";
      }

      // 2) Fallback / complément : liste les users Jellyseerr (qui ont chacun un jellyfinUserId)
      try {
        const seerUsers = await listAllJellyseerrUsers(config);
        const known = new Set(users.map((u) => u.id));
        for (const su of seerUsers) {
          if (!su.jellyfinUserId || known.has(su.jellyfinUserId)) continue;
          users.push({
            id: su.jellyfinUserId,
            name: su.jellyfinUsername || su.username || su.jellyfinUserId,
          });
        }
      } catch {
        // Si Jellyseerr aussi échoue ET que Jellyfin a échoué, on relance l'erreur Jellyfin
        if (jellyfinError && users.length === 0) {
          return reply.status(503).send({ message: `Sync failed: ${jellyfinError}` });
        }
      }

      // 3) Crée une row seer_user_settings pour chacun (idempotent) — répare aussi les usernames
      //    précédemment corrompus (ex: stockés comme UUID Jellyfin si lookup avait échoué)
      let created = 0;
      const isUuid = /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i;
      for (const u of users) {
        const existing = await prisma.$queryRawUnsafe<Array<{ jellyfin_user_id: string; username: string }>>(
          `SELECT jellyfin_user_id, username FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
          u.id,
        );
        if (existing.length === 0) {
          created++;
          await getOrCreateUserSettings(prisma, u.id, u.name);
        } else if (u.name && u.name !== u.id && (
          isUuid.test(existing[0].username) || existing[0].username === u.id
        )) {
          // Répare un username qui est en fait un UUID
          await updateUserSettings(prisma, u.id, { username: u.name });
        }
      }

      // 4) Pour chaque user connu, tente le lookup/import Jellyseerr
      const all = await listUsersWithStats(prisma);
      let synced = 0;
      let failed = 0;
      for (const u of all) {
        try {
          await resolveJellyseerrUserId(config, prisma, u.jellyfinUserId, u.username);
          synced++;
        } catch {
          failed++;
        }
      }

      // 5) Nettoyage : retire les rows seer_user_settings dont le user n'existe plus
      //    NI côté Jellyfin NI côté Jellyseerr ET qui n'a aucune demande locale active.
      //    On garde les demandes pour la traçabilité — seule la row settings est supprimée.
      const aliveIds = new Set<string>(users.map((u) => u.id));
      let removed = 0;
      const allSettings = await prisma.$queryRawUnsafe<Array<{ jellyfin_user_id: string }>>(
        `SELECT jellyfin_user_id FROM seer_user_settings`,
      );
      for (const row of allSettings) {
        if (aliveIds.has(row.jellyfin_user_id)) continue;
        const hasReqs = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
          `SELECT COUNT(*) AS cnt FROM seer_requests
           WHERE jellyfin_user_id = ?
             AND status NOT IN ('deleted','delete_failed')`,
          row.jellyfin_user_id,
        );
        if (Number(hasReqs[0]?.cnt ?? 0) === 0) {
          await prisma.$executeRawUnsafe(
            `DELETE FROM seer_user_settings WHERE jellyfin_user_id = ?`,
            row.jellyfin_user_id,
          );
          removed++;
        }
      }

      return {
        synced, failed, created, removed, invalidatedLinks,
        total: all.length,
        jellyfinAdminOk: jellyfinError === null,
      };
    },
  );

  /* ────────────────────────────────────────────────────────────────
   * POST /admin/sync-requests-ownership
   * Pour chaque demande locale ayant un seerr_request_id, vérifie que
   * le propriétaire Jellyseerr correspond au demandeur Jellyfin.
   * Si non, tente :
   *   - PUT /api/v1/request/{id} avec userId: cible
   *   - sinon DELETE + POST avec userId: cible (sans toucher au media)
   *
   * Si le user Jellyfin n'existe plus (import-from-jellyfin échoue),
   * on crée un user "placeholder" Jellyseerr (username local) pour
   * conserver la trace. Quand l'user recrée son compte Jellyfin avec
   * le même username, resolveJellyseerrUserId réconciliera ce placeholder.
   * ──────────────────────────────────────────────────────────────── */
  app.post(
    "/admin/sync-requests-ownership",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const config = await getWorkerConfig();
      if (!config) return reply.status(503).send({ message: "Seerr not configured" });

      // 0) Invalide les jellyseerr_user_id cachés morts (user supprimé côté Jellyseerr).
      //    Sans ça, resolveJellyseerrUserId retournerait un ID stale et tout le sync
      //    pointerait vers un user inexistant.
      try {
        await invalidateStaleJellyseerrCache(config, prisma);
      } catch { /* non bloquant */ }

      let alreadyOk = 0;
      let reassigned = 0;
      let recreated = 0;
      let orphansCreated = 0;
      let failed = 0;
      const usersTouched = new Set<string>();
      const errors: Array<{ requestId: string; reason: string }> = [];

      // 1) Liste toutes les demandes locales avec un seerr_request_id
      const rows = await prisma.$queryRawUnsafe<Array<{
        id: string; jellyfin_user_id: string; username: string;
        seerr_request_id: number | null; seerr_media_id: number | null;
        media_type: string; tmdb_id: number; seasons: unknown;
      }>>(
        `SELECT id, jellyfin_user_id, username, seerr_request_id, seerr_media_id, media_type, tmdb_id, seasons
         FROM seer_requests
         WHERE seerr_request_id IS NOT NULL
           AND status NOT IN ('deleted','deleting','delete_failed')`,
      );

      // 2) Pour chaque user distinct, déterminer son meilleur username (priorité au plus
      //    récent et qui ne ressemble PAS à un UUID Jellyfin — préserve un placeholder
      //    propre quand le compte Jellyfin a été supprimé).
      const distinctUsers = new Map<string, string>();
      for (const r of rows) {
        if (distinctUsers.has(r.jellyfin_user_id)) continue;
        const best = await pickBestUsernameFor(prisma, r.jellyfin_user_id, r.username);
        distinctUsers.set(r.jellyfin_user_id, best);
      }

      // 3) Résoudre tous les jellyseerrUserId cibles
      const targetByJellyfin = new Map<string, number>();
      for (const [jfUserId, jfUsername] of distinctUsers) {
        try {
          const seerUserId = await resolveJellyseerrUserId(config, prisma, jfUserId, jfUsername);
          targetByJellyfin.set(jfUserId, seerUserId);
        } catch {
          // User Jellyfin probablement supprimé → créer un placeholder avec le vrai username
          try {
            const placeholder = await createPlaceholderJellyseerrUser(config, jfUsername);
            await updateUserSettings(prisma, jfUserId, {
              jellyseerrUserId: placeholder.id,
              jellyseerrLastSync: new Date(),
              username: jfUsername,
            });
            targetByJellyfin.set(jfUserId, placeholder.id);
            orphansCreated++;
          } catch (err) {
            errors.push({
              requestId: jfUserId,
              reason: err instanceof Error ? err.message : "placeholder creation failed",
            });
          }
        }
      }

      // 4) Pour chaque request, comparer et réassigner OU recréer si manquante côté Jellyseerr
      for (const r of rows) {
        if (!r.seerr_request_id) continue;
        const target = targetByJellyfin.get(r.jellyfin_user_id);
        if (!target) { failed++; continue; }

        // Parse seasons si JSON stocké
        let parsedSeasons: number[] | null = null;
        if (r.seasons) {
          try {
            parsedSeasons = typeof r.seasons === "string"
              ? JSON.parse(r.seasons)
              : (r.seasons as number[]);
          } catch { parsedSeasons = null; }
        }

        try {
          const result = await reassignSeerrRequestOwnership(
            config, r.seerr_request_id, target,
            {
              mediaType: r.media_type as "movie" | "tv",
              tmdbId: r.tmdb_id,
              seasons: parsedSeasons,
            },
          );
          if (result.method === "skip") {
            alreadyOk++;
          } else if (result.method === "create-missing") {
            recreated++;
            usersTouched.add(r.jellyfin_user_id);
            if (result.newRequestId) {
              await prisma.$executeRawUnsafe(
                `UPDATE seer_requests SET seerr_request_id = ? WHERE id = ?`,
                result.newRequestId, r.id,
              );
            }
          } else {
            reassigned++;
            usersTouched.add(r.jellyfin_user_id);
            if (result.method === "recreate" && result.newRequestId) {
              await prisma.$executeRawUnsafe(
                `UPDATE seer_requests SET seerr_request_id = ? WHERE id = ?`,
                result.newRequestId, r.id,
              );
            }
          }
        } catch (err) {
          failed++;
          errors.push({
            requestId: r.id,
            reason: err instanceof Error ? err.message : "reassign failed",
          });
        }
      }

      // 5) Invalider les caches des users touchés
      for (const uid of usersTouched) invalidate(`seer-cache:${uid}`);

      return {
        total: rows.length,
        reassigned,
        recreated,
        alreadyOk,
        orphansCreated,
        failed,
        errors: errors.slice(0, 20), // limiter le payload
      };
    },
  );
}

/** Sélectionne le meilleur username Jellyfin pour un jellyfin_user_id donné.
 *  Préfère un username depuis seer_requests qui ne ressemble PAS à un UUID,
 *  fallback : la valeur la plus récente, fallback : `fallback`. */
async function pickBestUsernameFor(
  prisma: PrismaClient,
  jellyfinUserId: string,
  fallback: string,
): Promise<string> {
  const isUuid = /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i;
  const rows = await prisma.$queryRawUnsafe<Array<{ username: string }>>(
    `SELECT username FROM seer_requests
     WHERE jellyfin_user_id = ? AND username IS NOT NULL AND username <> ''
     ORDER BY created_at DESC LIMIT 50`,
    jellyfinUserId,
  );
  for (const r of rows) {
    if (r.username && !isUuid.test(r.username) && r.username !== jellyfinUserId) {
      return r.username;
    }
  }
  // Aucun username valide en historique : essayer seer_user_settings
  const settings = await prisma.$queryRawUnsafe<Array<{ username: string }>>(
    `SELECT username FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
    jellyfinUserId,
  );
  if (settings[0]?.username && !isUuid.test(settings[0].username) && settings[0].username !== jellyfinUserId) {
    return settings[0].username;
  }
  // Fallback final : la valeur passée (peut être un UUID) ou rows[0] s'il existe
  return rows[0]?.username || fallback;
}

interface SeerrRequestPayload {
  id: number;
  status: number;
  serverId?: number;
  profileId?: number;
  rootFolder?: string;
  languageProfileId?: number;
  tags?: number[];
  seasons?: Array<{ seasonNumber: number }>;
  requestedBy?: { id: number };
  media?: { id: number; tmdbId: number; mediaType: "movie" | "tv" };
}

/**
 * Réassigne le propriétaire d'une demande Jellyseerr.
 * - Tente d'abord PUT /api/v1/request/{id} avec userId: target
 * - Si Jellyseerr ne propage pas le changement, fallback DELETE + POST avec userId: target
 *   (le media reste, pas de re-téléchargement)
 * - Si la demande n'existe plus côté Jellyseerr (404) → recréation complète depuis les
 *   infos locales (mediaType, tmdbId, seasons) avec le bon userId.
 */
async function reassignSeerrRequestOwnership(
  config: { seerrUrl: string; seerrApiKey: string },
  seerrRequestId: number,
  targetUserId: number,
  localMedia: { mediaType: "movie" | "tv"; tmdbId: number; seasons: number[] | null },
): Promise<{ method: "skip" | "put" | "recreate" | "create-missing"; newRequestId?: number }> {
  const headers = { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey };

  const cur = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(10_000),
  });

  // Demande disparue côté Jellyseerr → on la recrée depuis les infos locales
  if (cur.status === 404) {
    if (!localMedia.tmdbId) throw new Error("missing local tmdbId for re-creation");
    const createBody: Record<string, unknown> = {
      mediaType: localMedia.mediaType,
      mediaId: localMedia.tmdbId,
      userId: targetUserId,
    };
    if (localMedia.seasons?.length) createBody.seasons = localMedia.seasons;

    const postRes = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST", headers, body: JSON.stringify(createBody),
      signal: AbortSignal.timeout(15_000),
    });
    if (!postRes.ok) {
      const text = await postRes.text().catch(() => "");
      throw new Error(`re-create missing failed (${postRes.status}): ${text.slice(0, 200)}`);
    }
    const created = (await postRes.json()) as { id: number };
    return { method: "create-missing", newRequestId: created.id };
  }

  if (!cur.ok) {
    throw new Error(`GET request ${seerrRequestId} failed: ${cur.status}`);
  }
  const req = (await cur.json()) as SeerrRequestPayload;
  if (req.requestedBy?.id === targetUserId) return { method: "skip" };

  // 1) Tentative PUT (préserve l'id de request)
  const putBody: Record<string, unknown> = {
    mediaType: req.media?.mediaType,
    userId: targetUserId,
  };
  if (req.serverId != null) putBody.serverId = req.serverId;
  if (req.profileId != null) putBody.profileId = req.profileId;
  if (req.rootFolder) putBody.rootFolder = req.rootFolder;
  if (req.languageProfileId != null) putBody.languageProfileId = req.languageProfileId;
  if (req.tags?.length) putBody.tags = req.tags;

  const putRes = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "PUT", headers, body: JSON.stringify(putBody),
    signal: AbortSignal.timeout(15_000),
  });
  if (putRes.ok) {
    const updated = (await putRes.json().catch(() => null)) as SeerrRequestPayload | null;
    if (updated?.requestedBy?.id === targetUserId) {
      return { method: "put" };
    }
  }

  // 2) Fallback : supprimer la request (sans toucher au media), recréer avec userId
  await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});

  if (!req.media?.tmdbId || !req.media?.mediaType) {
    throw new Error("missing media info for recreate");
  }
  const createBody: Record<string, unknown> = {
    mediaType: req.media.mediaType,
    mediaId: req.media.tmdbId,
    userId: targetUserId,
  };
  if (req.seasons?.length) createBody.seasons = req.seasons.map((s) => s.seasonNumber);
  if (req.serverId != null) createBody.serverId = req.serverId;
  if (req.profileId != null) createBody.profileId = req.profileId;
  if (req.rootFolder) createBody.rootFolder = req.rootFolder;
  if (req.languageProfileId != null) createBody.languageProfileId = req.languageProfileId;
  if (req.tags?.length) createBody.tags = req.tags;

  const postRes = await fetch(`${config.seerrUrl}/api/v1/request`, {
    method: "POST", headers, body: JSON.stringify(createBody),
    signal: AbortSignal.timeout(15_000),
  });
  if (!postRes.ok) {
    const text = await postRes.text().catch(() => "");
    throw new Error(`recreate failed (${postRes.status}): ${text.slice(0, 200)}`);
  }
  const created = (await postRes.json()) as { id: number };
  return { method: "recreate", newRequestId: created.id };
}

/**
 * Récupère la liste de tous les utilisateurs Jellyfin via l'API admin.
 * Utilise JELLYFIN_URL + JELLYFIN_ADMIN_API_KEY depuis l'env du backend Tentacle.
 */
async function fetchJellyfinUsers(): Promise<Array<{ id: string; name: string }>> {
  const baseUrl = (process.env.JELLYFIN_URL || "").replace(/\/$/, "");
  const apiKey = process.env.JELLYFIN_ADMIN_API_KEY || "";
  if (!baseUrl || !apiKey) {
    throw new Error("Jellyfin not configured on Tentacle backend (JELLYFIN_URL or JELLYFIN_ADMIN_API_KEY missing)");
  }
  const res = await fetch(`${baseUrl}/Users`, {
    headers: { "X-Emby-Token": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Jellyfin GET /Users failed: ${res.status}`);
  }
  const data = (await res.json()) as Array<{
    Id: string; Name: string;
    Policy?: { IsDisabled?: boolean };
  }>;
  return data
    .filter((u) => !u.Policy?.IsDisabled)
    .map((u) => ({ id: u.Id, name: u.Name }));
}
