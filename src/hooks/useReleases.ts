import { useQuery } from "@tanstack/react-query";
import {
  getPersonalCalendar, getGlobalCalendar, getCalendarProviders, currentRegion,
} from "../api/client-releases";
import type { CalendarMediaFilter, CalendarResponse } from "../api/types-releases";

/** Tant qu'il reste des fiches à récupérer, on revient les chercher. */
const PARTIAL_POLL_MS = 10_000;

/**
 * Les sorties des demandes — suit les demandes, donc rafraîchi plus souvent que
 * le calendrier global. `everyone` bascule des siennes à celles de tous.
 */
export function usePersonalCalendar(
  from?: string, to?: string, enabled = true, includeSettled = false, everyone = false,
) {
  return useQuery({
    queryKey: ["seer-calendar-personal", from ?? "", to ?? "", includeSettled, everyone],
    queryFn: () => getPersonalCalendar(from, to, includeSettled, everyone),
    enabled,
    /* Le serveur annonce quand des fiches lui manquent encore et les récupère
     * en tâche de fond. Sans cette relance, la page gardait sa première réponse
     * — la plus incomplète — et il fallait la quitter pour la voir se remplir.
     * Le sondage s'éteint de lui-même dès que tout est là. */
    refetchInterval: (q: { state: { data?: CalendarResponse } }) =>
      (q.state.data?.partial ? PARTIAL_POLL_MS : (false as const)),
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
