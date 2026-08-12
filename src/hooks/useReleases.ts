import { useQuery } from "@tanstack/react-query";
import {
  getPersonalCalendar, getGlobalCalendar, getCalendarProviders, currentRegion,
} from "../api/client-releases";
import type { CalendarMediaFilter } from "../api/types-releases";

/** Mes sorties — suit les demandes, donc rafraîchi plus souvent que le global. */
export function usePersonalCalendar(from?: string, to?: string, enabled = true) {
  return useQuery({
    queryKey: ["seer-calendar-personal", from ?? "", to ?? ""],
    queryFn: () => getPersonalCalendar(from, to),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Tout ce qui sort — identique pour tous les utilisateurs, et ces listes ne
 * bougent au mieux qu'une fois par jour : on les garde longtemps.
 */
export function useGlobalCalendar(
  opts: { providerId?: number; mediaType: CalendarMediaFilter; from?: string; to?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: [
      "seer-calendar-global",
      opts.providerId ?? "all", opts.mediaType, opts.from ?? "", opts.to ?? "", currentRegion(),
    ],
    queryFn: () => getGlobalCalendar(opts),
    enabled,
    staleTime: 60 * 60_000,
    gcTime: 6 * 60 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Catalogue des plateformes de la région (80 pour la France). */
export function useCalendarProviders(mediaType: "movie" | "tv" = "tv") {
  return useQuery({
    queryKey: ["seer-calendar-providers", mediaType, currentRegion()],
    queryFn: () => getCalendarProviders(mediaType),
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
  });
}
