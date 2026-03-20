/* ------------------------------------------------------------------ */
/*  Seer Plugin — Sonarr/Radarr service (via Jellyseerr settings)     */
/* ------------------------------------------------------------------ */

export interface ArrServerConfig {
  hostname: string;
  port: number;
  apiKey: string;
  useSsl: boolean;
  baseUrl: string;
}

let sonarrCache: { data: ArrServerConfig | null; expires: number } | null = null;
let radarrCache: { data: ArrServerConfig | null; expires: number } | null = null;

/** Récupère la config du serveur Sonarr ou Radarr par défaut via Seerr */
export async function getArrServerConfig(
  seerrUrl: string,
  apiKey: string,
  type: "sonarr" | "radarr",
): Promise<ArrServerConfig | null> {
  const cache = type === "sonarr" ? sonarrCache : radarrCache;
  if (cache && Date.now() < cache.expires) return cache.data;

  try {
    const res = await fetch(`${seerrUrl}/api/v1/settings/${type}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      setCacheForType(type, null);
      return null;
    }

    const servers = (await res.json()) as Record<string, unknown>[];
    const defaultServer = servers.find((s) => s.isDefault);
    if (!defaultServer) {
      setCacheForType(type, null);
      return null;
    }

    const data: ArrServerConfig = {
      hostname: defaultServer.hostname as string,
      port: defaultServer.port as number,
      apiKey: defaultServer.apiKey as string,
      useSsl: !!defaultServer.useSsl,
      baseUrl: (defaultServer.baseUrl as string) || "",
    };

    setCacheForType(type, data);
    return data;
  } catch {
    setCacheForType(type, null);
    return null;
  }
}

function setCacheForType(type: "sonarr" | "radarr", data: ArrServerConfig | null) {
  const entry = { data, expires: Date.now() + 600_000 };
  if (type === "sonarr") sonarrCache = entry;
  else radarrCache = entry;
}

function buildArrUrl(server: ArrServerConfig): string {
  const protocol = server.useSsl ? "https" : "http";
  const base = server.baseUrl ? `/${server.baseUrl.replace(/^\/|\/$/g, "")}` : "";
  return `${protocol}://${server.hostname}:${server.port}${base}`;
}

/** Récupère l'ID externe Sonarr/Radarr d'un média via l'endpoint Seerr */
export async function getMediaExternalId(
  seerrUrl: string,
  apiKey: string,
  mediaType: string,
  tmdbId: number,
): Promise<{ externalServiceId: number; serviceId: number } | null> {
  try {
    const res = await fetch(`${seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      mediaInfo?: { externalServiceId?: number; serviceId?: number };
    };
    if (!data.mediaInfo?.externalServiceId) return null;
    return {
      externalServiceId: data.mediaInfo.externalServiceId,
      serviceId: data.mediaInfo.serviceId ?? 0,
    };
  } catch {
    return null;
  }
}

/** Supprime une série de Sonarr (sans supprimer les fichiers) */
export async function deleteSonarrSeries(
  server: ArrServerConfig,
  seriesId: number,
  deleteFiles = false,
): Promise<boolean> {
  try {
    const url = `${buildArrUrl(server)}/api/v3/series/${seriesId}?deleteFiles=${deleteFiles}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[ArrService] Failed to delete Sonarr series #${seriesId}:`, err);
    return false;
  }
}

/** Supprime un film de Radarr (sans supprimer les fichiers) */
export async function deleteRadarrMovie(
  server: ArrServerConfig,
  movieId: number,
  deleteFiles = false,
): Promise<boolean> {
  try {
    const url = `${buildArrUrl(server)}/api/v3/movie/${movieId}?deleteFiles=${deleteFiles}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[ArrService] Failed to delete Radarr movie #${movieId}:`, err);
    return false;
  }
}

/** Supprime le média dans Seerr (reset pour permettre re-demande) */
export async function deleteSeerrMedia(
  seerrUrl: string,
  apiKey: string,
  mediaId: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${seerrUrl}/api/v1/media/${mediaId}`, {
      method: "DELETE",
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[ArrService] Failed to delete Seerr media #${mediaId}:`, err);
    return false;
  }
}
