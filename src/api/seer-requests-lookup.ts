import { backendFetch } from "./seer-client";
import type { MediaType } from "./types";

/**
 * Saisons demandées LOCALEMENT pour un contenu (source de vérité du plugin, pas
 * Jellyseerr) — sert à verrouiller les saisons déjà demandées dès l'ouverture de
 * la fiche, même avant que Jellyseerr n'ait enregistré la demande.
 * Fichier séparé de seer-client.ts (déjà > 300 lignes).
 */
export async function getLocalRequestedSeasons(mediaType: MediaType, tmdbId: number): Promise<number[]> {
  if (mediaType !== "tv" || !tmdbId) return [];
  const res = await backendFetch<{ seasons: number[] }>(
    `/requests/lookup?mediaType=tv&tmdbId=${tmdbId}`,
  );
  return res.seasons ?? [];
}
