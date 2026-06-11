import { tentacleApiFetch, tentacleNavigate } from "./tentacle-fetch";

export interface ResolveResult {
  jellyfinId: string | null;
  /** RemoteTrailers Jellyfin de l'item résolu (backend ≥ 1.9.3, sinon absent). */
  remoteTrailers?: { Url?: string; Name?: string }[];
}

/** Résout un TMDB ID vers l'item Jellyfin correspondant (null si absent). */
export async function resolveTmdbMedia(tmdbId: number, mediaType: string): Promise<ResolveResult | null> {
  return tentacleApiFetch<ResolveResult>(
    `/api/tmdb/resolve?tmdbId=${tmdbId}&mediaType=${mediaType}`,
  );
}

/**
 * Navigue vers la page media Tentacle pour un item disponible.
 * Résout TMDB ID → Jellyfin ID via /api/tmdb/resolve.
 */
export async function navigateToMedia(tmdbId: number, mediaType: string): Promise<void> {
  const resolved = await resolveTmdbMedia(tmdbId, mediaType);
  if (!resolved?.jellyfinId) return;
  tentacleNavigate(`/media/${resolved.jellyfinId}`);
}
