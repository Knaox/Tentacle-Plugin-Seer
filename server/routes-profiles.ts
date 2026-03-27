/* ------------------------------------------------------------------ */
/*  Seer Plugin — Profile routes (admin CRUD + quality options)        */
/* ------------------------------------------------------------------ */

import type { FastifyInstance } from "fastify";
import type { SeerProfile } from "./types";

const TIMEOUT = 30_000;

export function registerProfileRoutes(
  app: FastifyInstance,
  getPluginConfig: () => Record<string, unknown>,
  getSeerrConfig: () => { seerrUrl: string; seerrApiKey: string } | null,
): void {

  app.get("/profiles", async () => {
    const config = getPluginConfig();
    const profiles = (config.profiles as SeerProfile[] | undefined) ?? [];
    return { profiles };
  });

  app.get("/profiles/options", async (_request, reply) => {
    const seerr = getSeerrConfig();
    if (!seerr) return reply.status(503).send({ message: "Seerr not configured" });

    try {
      // Fetch Radarr + Sonarr en parallèle
      const [radarr, sonarr] = await Promise.all([
        fetchArrOptions(seerr, "radarr"),
        fetchArrOptions(seerr, "sonarr"),
      ]);
      console.log(`[SeerProfiles] Found ${radarr.length} Radarr, ${sonarr.length} Sonarr`);
      return { radarr, sonarr };
    } catch (err) {
      console.error("[SeerProfiles] Failed to fetch options:", err);
      return reply.status(502).send({
        message: err instanceof Error ? err.message : "Failed to fetch quality options",
      });
    }
  });
}

interface ArrServer {
  id: number;
  name: string;
  isDefault: boolean;
  profiles: Array<{ id: number; name: string }>;
  rootFolders: Array<{ id: number; path: string }>;
  tags: Array<{ id: number; label: string }>;
}

async function fetchArrOptions(
  seerr: { seerrUrl: string; seerrApiKey: string },
  type: "radarr" | "sonarr",
): Promise<ArrServer[]> {
  const headers = { "X-Api-Key": seerr.seerrApiKey };

  let servers: Array<{ id: number; name: string; isDefault: boolean; is4k?: boolean }> = [];

  try {
    const serviceRes = await fetch(`${seerr.seerrUrl}/api/v1/service/${type}`, {
      headers, signal: AbortSignal.timeout(TIMEOUT),
    });

    if (serviceRes.ok) {
      servers = await serviceRes.json() as typeof servers;
    } else {
      const settingsRes = await fetch(`${seerr.seerrUrl}/api/v1/settings/${type}`, {
        headers, signal: AbortSignal.timeout(TIMEOUT),
      });
      if (settingsRes.ok) {
        const settings = await settingsRes.json() as Array<Record<string, unknown>>;
        servers = settings.map((s, i) => ({
          id: (s.id as number) ?? i,
          name: (s.name as string) ?? `${type} ${i}`,
          isDefault: (s.isDefault as boolean) ?? i === 0,
          is4k: (s.is4k as boolean) ?? false,
        }));
      }
    }
  } catch (err) {
    console.warn(`[SeerProfiles] Failed to list ${type} servers:`, err instanceof Error ? err.message : err);
    return [];
  }

  const nonFourK = servers.filter((s) => !s.is4k);

  // Fetch détails de tous les serveurs en parallèle
  const results = await Promise.allSettled(
    nonFourK.map(async (s) => {
      const detailRes = await fetch(`${seerr.seerrUrl}/api/v1/service/${type}/${s.id}`, {
        headers, signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!detailRes.ok) return { ...s, profiles: [], rootFolders: [], tags: [] } as ArrServer;

      const detail = await detailRes.json() as Record<string, unknown>;
      const profiles = (detail.profiles as Array<{ id: number; name: string }>) ?? [];
      const rootFolders = (detail.rootFolders as Array<{ id: number; path: string }>) ?? [];
      const tags = (detail.tags as Array<{ id: number; label: string }>) ?? [];

      console.log(`[SeerProfiles] ${type}/${s.id} "${s.name}": ${profiles.length} profiles, ${tags.length} tags`);
      return { id: s.id, name: s.name, isDefault: s.isDefault, profiles, tags,
        rootFolders: rootFolders.map((f) => ({ id: f.id, path: f.path })),
      } as ArrServer;
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ArrServer> => r.status === "fulfilled")
    .map((r) => r.value);
}
