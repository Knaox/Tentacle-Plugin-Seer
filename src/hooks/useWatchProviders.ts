import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "../api/endpoints";
import type { MediaType } from "../api/types";
import { getCurrentLanguage } from "../utils/media-helpers";

interface WatchProvider {
  logo_path: string;
  provider_id: number;
  provider_name: string;
}

interface WatchProviderResult {
  flatrate?: WatchProvider[];
  buy?: WatchProvider[];
  rent?: WatchProvider[];
}

interface WatchProvidersResponse {
  results: Record<string, WatchProviderResult>;
}

export function useWatchProviders(mediaType: MediaType, tmdbId: number) {
  return useQuery({
    queryKey: ["seer-watch-providers", mediaType, tmdbId],
    queryFn: async () => {
      const data = await proxyFetch<WatchProvidersResponse>(
        `/api/v1/${mediaType}/${tmdbId}/watch/providers`,
      );
      const lang = getCurrentLanguage().toUpperCase();
      const region = data.results[lang] ?? data.results["FR"] ?? data.results["US"];
      if (!region) return [];
      const providers = region.flatrate ?? region.buy ?? region.rent ?? [];
      return providers.slice(0, 6);
    },
    enabled: tmdbId > 0,
    staleTime: 24 * 60 * 60_000,
  });
}
