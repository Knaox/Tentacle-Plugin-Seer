import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "../api/endpoints";
import { langParam } from "../utils/media-helpers";
import type { MediaType, SeerrSearchResult } from "../api/types";

interface SimilarResponse {
  results: SeerrSearchResult[];
}

export function useMediaSimilar(mediaType: MediaType, tmdbId: number) {
  return useQuery({
    queryKey: ["seer-media-similar", mediaType, tmdbId],
    queryFn: async () => {
      const data = await proxyFetch<SimilarResponse>(
        `/api/v1/${mediaType}/${tmdbId}/similar?${langParam()}`,
      );
      return data.results.slice(0, 10);
    },
    enabled: tmdbId > 0,
    staleTime: 24 * 60 * 60_000,
  });
}
