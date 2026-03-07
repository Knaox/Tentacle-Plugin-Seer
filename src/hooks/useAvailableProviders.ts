import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "../api/endpoints";
import { getCurrentLanguage } from "../utils/media-helpers";

export interface AvailableProvider {
  id: number;
  name: string;
  logoPath: string;
}

interface TmdbProvider {
  display_priority: number;
  logo_path: string;
  provider_name: string;
  provider_id: number;
}

/**
 * Fetch the list of streaming providers available in the user's region
 * from Jellyseerr/Overseerr (which proxies TMDB).
 */
export function useAvailableProviders() {
  return useQuery({
    queryKey: ["seer-available-providers"],
    queryFn: async () => {
      const region = getWatchRegion();
      // Jellyseerr exposes TMDB's watch provider list
      const data = await proxyFetch<{ results: TmdbProvider[] }>(
        `/api/v1/watchproviders/movies?watchRegion=${region}`,
      );
      return (data.results ?? [])
        .sort((a, b) => a.display_priority - b.display_priority)
        .slice(0, 20)
        .map((p): AvailableProvider => ({
          id: p.provider_id,
          name: p.provider_name,
          logoPath: p.logo_path,
        }));
    },
    staleTime: 24 * 60 * 60_000,
  });
}

function getWatchRegion(): string {
  const lang = getCurrentLanguage();
  const map: Record<string, string> = { fr: "FR", en: "US", de: "DE", es: "ES", it: "IT", pt: "BR", ja: "JP" };
  return map[lang] ?? "US";
}
