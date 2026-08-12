import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAvailability, currentRegion } from "../api/client-releases";
import type { AvailabilityVerdict } from "../api/types-releases";
import type { MediaType } from "../api/types";

interface Item { mediaType?: string; id?: number }

/**
 * Verdicts de sortie pour une grille entière, en UNE requête.
 *
 * La grille ne l'attend pas : elle s'affiche, et les pastilles apparaissent
 * quand la réponse arrive. Les dates de sortie ne bougeant pratiquement jamais,
 * le résultat reste valable une journée entière côté navigateur.
 */
export function useAvailability(items: readonly Item[]) {
  const refs = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ mediaType: MediaType; tmdbId: number }> = [];
    for (const it of items) {
      if (it?.mediaType !== "movie" && it?.mediaType !== "tv") continue;
      if (typeof it.id !== "number" || it.id <= 0) continue;
      const key = `${it.mediaType}:${it.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ mediaType: it.mediaType, tmdbId: it.id });
    }
    return out;
  }, [items]);

  // Clé stable : le contenu, pas l'identité du tableau — sinon chaque rendu
  // de la grille relancerait la requête.
  const key = useMemo(() => refs.map((r) => `${r.mediaType}${r.tmdbId}`).join(","), [refs]);

  const query = useQuery({
    queryKey: ["seer-availability", currentRegion(), key],
    queryFn: () => getAvailability(refs),
    enabled: refs.length > 0,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return useMemo(() => {
    const map = new Map<string, AvailabilityVerdict>();
    for (const v of query.data?.results ?? []) map.set(`${v.mediaType}:${v.tmdbId}`, v);
    return map;
  }, [query.data]);
}

/** Verdict d'un seul titre — pour la fiche détail. */
export function useSingleAvailability(mediaType: MediaType | undefined, tmdbId: number | undefined) {
  const items = useMemo(
    () => (mediaType && tmdbId ? [{ mediaType, id: tmdbId }] : []),
    [mediaType, tmdbId],
  );
  const map = useAvailability(items);
  return mediaType && tmdbId ? map.get(`${mediaType}:${tmdbId}`) ?? null : null;
}
