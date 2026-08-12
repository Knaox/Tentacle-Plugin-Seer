import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSeriesAirTimes } from "../api/client-releases";

/**
 * Les heures de diffusion d'une série, quand Sonarr la suit.
 *
 * TMDB ne renvoie que la date, et celle du fuseau de la chaîne d'origine.
 * Sonarr connaît l'instant exact — mais uniquement pour les séries qu'il
 * suit : une Map VIDE signifie « on ne sait pas », et l'appelant affiche alors
 * la date seule plutôt qu'une heure inventée.
 *
 * Ces heures ne bougent pratiquement jamais : une heure de fraîcheur suffit, et
 * la requête n'est émise que sur une fiche de série.
 */
export function useSeriesAirTimes(
  tmdbId: number | undefined, enabled: boolean,
): Map<string, string> {
  const query = useQuery({
    queryKey: ["seer-airtimes", tmdbId ?? 0],
    queryFn: () => getSeriesAirTimes(tmdbId as number),
    enabled: enabled && !!tmdbId && tmdbId > 0,
    staleTime: 60 * 60_000,
    gcTime: 6 * 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return useMemo(() => {
    const map = new Map<string, string>();
    for (const [key, at] of Object.entries(query.data?.times ?? {})) map.set(key, at);
    return map;
  }, [query.data]);
}

/** « S1E2 » — même clé que côté serveur. */
export function airTimeKey(season: number | null, episode: number | null): string {
  return season == null || episode == null ? "" : `S${season}E${episode}`;
}
