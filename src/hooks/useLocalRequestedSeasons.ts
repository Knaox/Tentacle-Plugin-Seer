import { useQuery } from "@tanstack/react-query";
import { getLocalRequestedSeasons } from "../api/seer-requests-lookup";
import type { MediaType } from "../api/types";

/**
 * Saisons demandées localement pour un titre TV. Fusionnées dans le détail pour
 * verrouiller une saison déjà demandée immédiatement (et durablement, y compris
 * après un refresh — la source est la DB locale, pas Jellyseerr). TV uniquement.
 */
export function useLocalRequestedSeasons(mediaType: MediaType, tmdbId: number) {
  return useQuery({
    queryKey: ["seer-local-seasons", mediaType, tmdbId],
    queryFn: () => getLocalRequestedSeasons(mediaType, tmdbId),
    enabled: mediaType === "tv" && tmdbId > 0,
    staleTime: 15_000,
  });
}
