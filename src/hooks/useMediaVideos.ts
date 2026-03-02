import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "../api/endpoints";
import { langParam, getCurrentLanguage } from "../utils/media-helpers";
import type { MediaType } from "../api/types";

interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  iso_639_1: string;
}

interface TmdbVideosResponse {
  results: TmdbVideo[];
}

function findTrailer(videos: TmdbVideo[]): TmdbVideo | undefined {
  const lang = getCurrentLanguage();
  const trailers = videos.filter((v) => v.site === "YouTube" && v.type === "Trailer");
  return trailers.find((v) => v.iso_639_1 === lang) ?? trailers[0];
}

export function useMediaVideos(mediaType: MediaType, tmdbId: number) {
  return useQuery({
    queryKey: ["seer-media-videos", mediaType, tmdbId],
    queryFn: async () => {
      const data = await proxyFetch<TmdbVideosResponse>(
        `/api/v1/${mediaType}/${tmdbId}/videos?${langParam()}`,
      );
      return findTrailer(data.results) ?? null;
    },
    enabled: tmdbId > 0,
    staleTime: 24 * 60 * 60_000,
  });
}
