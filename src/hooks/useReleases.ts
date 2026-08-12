import { useQuery } from "@tanstack/react-query";
import {
  getPersonalCalendar, getGlobalCalendar, getCalendarProviders, currentRegion,
} from "../api/client-releases";
import type { CalendarMediaFilter } from "../api/types-releases";

/** Mes sorties — suit les demandes, donc rafraîchi plus souvent que le global. */
export function usePersonalCalendar(
  from?: string, to?: string, enabled = true, includeSettled = false,
) {
  return useQuery({
    queryKey: ["seer-calendar-personal", from ?? "", to ?? "", includeSettled],
    queryFn: () => getPersonalCalendar(from, to, includeSettled),
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
  opts: { providerIds?: readonly number[]; mediaType: CalendarMediaFilter; from?: string; to?: string },
  enabled = true,
) {
  /* Clé triée, comme côté serveur : cocher Netflix puis Disney+ doit tomber
   * sur la même entrée de cache que l'ordre inverse. */
  const scope = opts.providerIds?.length
    ? [...opts.providerIds].sort((a, b) => a - b).join("-")
    : "all";

  return useQuery({
    queryKey: [
      "seer-calendar-global",
      scope, opts.mediaType, opts.from ?? "", opts.to ?? "", currentRegion(),
    ],
    queryFn: () => getGlobalCalendar(opts),
    enabled,
    staleTime: 60 * 60_000,
    gcTime: 6 * 60 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Catalogue des plateformes de la région, films et séries confondus. */
export function useCalendarProviders() {
  return useQuery({
    queryKey: ["seer-calendar-providers", currentRegion()],
    queryFn: getCalendarProviders,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
  });
}
