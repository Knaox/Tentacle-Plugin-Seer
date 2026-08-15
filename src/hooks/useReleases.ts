import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPersonalCalendar, getGlobalCalendar, getCalendarProviders, currentRegion,
} from "../api/client-releases";
import { readPersistedGlobal, persistGlobal } from "../utils/releases-cache";
import type { CalendarResponse } from "../api/types-releases";

/** Tant qu'il reste des fiches à récupérer, on revient les chercher. */
const PARTIAL_POLL_MS = 10_000;

const partialPoll = (q: { state: { data?: CalendarResponse } }) =>
  (q.state.data?.partial ? PARTIAL_POLL_MS : (false as const));

/**
 * Les sorties des demandes — suit les demandes, donc rafraîchi plus souvent que
 * le calendrier global. `everyone` bascule des siennes à celles de tous.
 *
 * `placeholderData` garde la réponse précédente pendant qu'une nouvelle fenêtre
 * charge : élargir la plage ne démonte plus la vue — c'est ce démontage qui
 * faisait revenir « semaine précédente » à la semaine courante.
 */
export function usePersonalCalendar(
  from?: string, to?: string, enabled = true, includeSettled = false, everyone = false,
) {
  return useQuery({
    queryKey: [
      "seer-calendar-personal", from ?? "", to ?? "", includeSettled, everyone, currentRegion(),
    ],
    queryFn: () => getPersonalCalendar(from, to, includeSettled, everyone),
    enabled,
    /* Le serveur annonce quand des fiches lui manquent encore et les récupère
     * en tâche de fond. Sans cette relance, la page gardait sa première réponse
     * — la plus incomplète — et il fallait la quitter pour la voir se remplir. */
    refetchInterval: partialPoll,
    placeholderData: (prev: CalendarResponse | undefined) => prev,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Tout ce qui sort — le calendrier maître du serveur, identique pour tous.
 * Plus aucun filtre dans la clé : type, plateformes, note et langue se
 * départagent côté client, changer un filtre ne recharge rien.
 *
 * Au premier montage, la dernière réponse persistée sert de placeholder :
 * l'iframe du plugin meurt à chaque navigation, c'est le seul cache qui
 * survive — l'agenda se peint immédiatement, la revalidation suit.
 */
export function useGlobalCalendar(from?: string, to?: string, enabled = true) {
  const region = currentRegion();
  const query = useQuery({
    queryKey: ["seer-calendar-global", from ?? "", to ?? "", region],
    queryFn: () => getGlobalCalendar({ from, to }),
    enabled,
    refetchInterval: partialPoll,
    placeholderData: (prev: CalendarResponse | undefined) => prev ?? readPersistedGlobal(region),
    staleTime: 60 * 60_000,
    gcTime: 6 * 60 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data } = query;
  useEffect(() => {
    // Jamais une réponse incomplète : elle se peindrait au prochain montage
    // avec ses trous, et le sondage de complétion ne court pas pour un placeholder.
    if (data && !data.partial) persistGlobal(region, data);
  }, [data, region]);

  return query;
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
