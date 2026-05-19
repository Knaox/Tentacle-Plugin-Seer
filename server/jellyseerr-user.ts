/* ------------------------------------------------------------------ */
/*  Seer Plugin — Jellyseerr user lookup + auto-import                 */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import { getOrCreateUserSettings, updateUserSettings } from "./db";

interface SeerConfig {
  seerrUrl: string;
  seerrApiKey: string;
}

interface JellyseerrUser {
  id: number;
  email?: string;
  username?: string;
  jellyfinUserId?: string;
  jellyfinUsername?: string;
  userType?: number;
}

/**
 * Résout l'ID Jellyseerr correspondant à un user Jellyfin :
 *  1) cache local (seer_user_settings.jellyseerr_user_id)
 *  2) lookup live par jellyfinUserId (user Jellyseerr déjà importé)
 *  3) réconciliation par username : si un user Jellyseerr "placeholder" existe
 *     avec le même username et SANS jellyfinUserId, on l'ATTACHE au user Jellyfin
 *     courant (PATCH /api/v1/user/{id}). Ça permet de récupérer l'historique
 *     d'un user dont le compte Jellyfin avait été supprimé puis recréé.
 *  4) import : POST /api/v1/user/import-from-jellyfin
 * Throw si rien ne marche — le worker retombera sur retry_pending.
 */
export async function resolveJellyseerrUserId(
  config: SeerConfig,
  prisma: PrismaClient,
  jellyfinUserId: string,
  username: string,
): Promise<number> {
  const settings = await getOrCreateUserSettings(prisma, jellyfinUserId, username);
  if (settings.jellyseerrUserId) return settings.jellyseerrUserId;

  // Lookup live par jellyfinUserId
  const found = await findJellyseerrUserByJellyfinId(config, jellyfinUserId);
  if (found) {
    await updateUserSettings(prisma, jellyfinUserId, {
      jellyseerrUserId: found.id,
      jellyseerrLastSync: new Date(),
    });
    return found.id;
  }

  // Réconciliation par username : un placeholder orphelin ?
  if (username) {
    const placeholder = await findOrphanPlaceholderByUsername(config, username);
    if (placeholder) {
      await relinkJellyseerrUserToJellyfin(config, placeholder.id, jellyfinUserId);
      await updateUserSettings(prisma, jellyfinUserId, {
        jellyseerrUserId: placeholder.id,
        jellyseerrLastSync: new Date(),
      });
      return placeholder.id;
    }
  }

  // Import depuis Jellyfin (suppose que le user Jellyfin existe encore)
  try {
    const imported = await importJellyseerrUserFromJellyfin(config, jellyfinUserId);
    if (imported) {
      await updateUserSettings(prisma, jellyfinUserId, {
        jellyseerrUserId: imported.id,
        jellyseerrLastSync: new Date(),
      });
      return imported.id;
    }
  } catch {
    // Tomberons sur le re-lookup ou l'erreur finale
  }

  // Dernier essai après import : Jellyseerr peut avoir importé sans renvoyer l'objet
  const refreshed = await findJellyseerrUserByJellyfinId(config, jellyfinUserId);
  if (refreshed) {
    await updateUserSettings(prisma, jellyfinUserId, {
      jellyseerrUserId: refreshed.id,
      jellyseerrLastSync: new Date(),
    });
    return refreshed.id;
  }

  throw new Error(`Unable to resolve Jellyseerr user for jellyfinUserId=${jellyfinUserId}`);
}

/** Cherche un user Jellyseerr local ("placeholder") par username, sans jellyfinUserId attaché. */
async function findOrphanPlaceholderByUsername(
  config: SeerConfig,
  username: string,
): Promise<JellyseerrUser | null> {
  const all = await listAllJellyseerrUsers(config);
  const target = username.trim().toLowerCase();
  return all.find((u) =>
    !u.jellyfinUserId &&
    (
      (u.username && u.username.trim().toLowerCase() === target) ||
      (u.jellyfinUsername && u.jellyfinUsername.trim().toLowerCase() === target)
    ),
  ) ?? null;
}

/** Crée un user "placeholder" Jellyseerr de type local (sans lien Jellyfin), pour préserver
 *  l'historique d'un demandeur dont le compte Jellyfin a été supprimé. Si un user du même
 *  username existe déjà, on le réutilise. */
export async function createPlaceholderJellyseerrUser(
  config: SeerConfig,
  username: string,
): Promise<JellyseerrUser> {
  const existing = await findOrphanPlaceholderByUsername(config, username);
  if (existing) return existing;

  const email = `${username.toLowerCase().replace(/[^a-z0-9._-]+/g, "")}@tentacle.local`;
  const res = await fetch(`${config.seerrUrl}/api/v1/user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ email, username }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr POST /user failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as JellyseerrUser;
}

/**
 * Vérifie quels jellyseerr_user_id en cache local pointent encore vers un user
 * réellement existant dans Jellyseerr. Met à NULL les caches stale.
 * Retourne le nombre d'invalidations effectuées.
 */
export async function invalidateStaleJellyseerrCache(
  config: SeerConfig,
  prisma: PrismaClient,
): Promise<number> {
  const seerUsers = await listAllJellyseerrUsers(config);
  const validIds = new Set(seerUsers.map((u) => u.id));

  const rows = await prisma.$queryRawUnsafe<Array<{ jellyfin_user_id: string; jellyseerr_user_id: number }>>(
    `SELECT jellyfin_user_id, jellyseerr_user_id FROM seer_user_settings WHERE jellyseerr_user_id IS NOT NULL`,
  );

  let invalidated = 0;
  for (const row of rows) {
    if (!validIds.has(row.jellyseerr_user_id)) {
      await prisma.$executeRawUnsafe(
        `UPDATE seer_user_settings SET jellyseerr_user_id = NULL, jellyseerr_last_sync = NULL WHERE jellyfin_user_id = ?`,
        row.jellyfin_user_id,
      );
      invalidated++;
    }
  }
  return invalidated;
}

/** Attache un jellyfinUserId à un user Jellyseerr existant via PATCH /api/v1/user/{id}. */
export async function relinkJellyseerrUserToJellyfin(
  config: SeerConfig,
  jellyseerrUserId: number,
  jellyfinUserId: string,
): Promise<void> {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/${jellyseerrUserId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ jellyfinUserId }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr PUT /user/${jellyseerrUserId} failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function findJellyseerrUserByJellyfinId(
  config: SeerConfig,
  jellyfinUserId: string,
): Promise<JellyseerrUser | null> {
  const all = await listAllJellyseerrUsers(config);
  const normalized = (id: string | undefined) => (id || "").toLowerCase().replace(/-/g, "");
  const target = normalized(jellyfinUserId);
  return all.find((u) => normalized(u.jellyfinUserId) === target) ?? null;
}

export async function listAllJellyseerrUsers(config: SeerConfig): Promise<JellyseerrUser[]> {
  const out: JellyseerrUser[] = [];
  let skip = 0;
  const take = 100;
  // Paginer (max 10 pages = 1000 users — suffisant)
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${config.seerrUrl}/api/v1/user?take=${take}&skip=${skip}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Jellyseerr GET /user failed: ${res.status}`);
    }
    const data = (await res.json()) as { pageInfo?: { results?: number; pages?: number }; results?: JellyseerrUser[] };
    const page = data.results ?? [];
    out.push(...page);
    if (page.length < take) break;
    skip += take;
  }
  return out;
}

async function importJellyseerrUserFromJellyfin(
  config: SeerConfig,
  jellyfinUserId: string,
): Promise<JellyseerrUser | null> {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/import-from-jellyfin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ jellyfinUserIds: [jellyfinUserId] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr import-from-jellyfin failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as JellyseerrUser[] | JellyseerrUser;
  if (Array.isArray(data) && data.length > 0) return data[0];
  if (!Array.isArray(data) && data && typeof data === "object") return data;
  return null;
}
