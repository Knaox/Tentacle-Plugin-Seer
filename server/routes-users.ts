/* ------------------------------------------------------------------ */
/*  Seer Plugin — Admin user management routes                         */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { listUsersWithStats, getOrCreateUserSettings, getUserSettings, updateUserSettings } from "./db";
import { resolveJellyseerrUserId, listAllJellyseerrUsers } from "./jellyseerr-user";

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

      return { synced, failed, created, total: all.length, jellyfinAdminOk: jellyfinError === null };
    },
  );
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
