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
 *  2) lookup live : GET /api/v1/user?take=1000 et match par jellyfinUserId
 *  3) import : POST /api/v1/user/import-from-jellyfin
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

  // Lookup live
  const found = await findJellyseerrUserByJellyfinId(config, jellyfinUserId);
  if (found) {
    await updateUserSettings(prisma, jellyfinUserId, {
      jellyseerrUserId: found.id,
      jellyseerrLastSync: new Date(),
    });
    return found.id;
  }

  // Import depuis Jellyfin
  const imported = await importJellyseerrUserFromJellyfin(config, jellyfinUserId);
  if (imported) {
    await updateUserSettings(prisma, jellyfinUserId, {
      jellyseerrUserId: imported.id,
      jellyseerrLastSync: new Date(),
    });
    return imported.id;
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
