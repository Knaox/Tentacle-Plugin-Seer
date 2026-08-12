/* ------------------------------------------------------------------ */
/*  Seer API — appels disponibilité / progression / calendrier         */
/* ------------------------------------------------------------------ */

import { backendFetch } from "./seer-client";
import { getCurrentLanguage } from "../utils/media-helpers";
import type { MediaType } from "./types";
import type {
  AvailabilityResponse, RequestsProgressResponse, QueueResponse,
  CalendarResponse, CalendarProvider, CalendarMediaFilter,
} from "./types-releases";

/**
 * Les dates de sortie sont propres à un pays. Faute de réglage dédié, la langue
 * de l'interface est le meilleur indice : « fr » → dates françaises.
 */
export function currentRegion(): string {
  const lang = getCurrentLanguage();
  const region = lang.includes("-") ? lang.split("-")[1] : lang;
  return /^[a-z]{2}$/i.test(region) ? region.toUpperCase() : "FR";
}

/** Un seul appel pour tout un écran de grille, plutôt qu'un par carte. */
export async function getAvailability(
  items: Array<{ mediaType: MediaType; tmdbId: number }>,
): Promise<AvailabilityResponse> {
  if (items.length === 0) return { results: [] };
  return backendFetch("/availability", {
    method: "POST",
    body: JSON.stringify({ items, region: currentRegion() }),
  });
}

export async function getRequestsProgress(): Promise<RequestsProgressResponse> {
  return backendFetch("/requests/progress");
}

export async function getPersonalCalendar(
  from?: string, to?: string, includeSettled = false,
): Promise<CalendarResponse> {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  // Par défaut on masque ce qui est déjà arrivé : c'est un calendrier de ce
  // qui reste à venir. « Toutes mes demandes » lève ce filtre.
  if (includeSettled) p.set("all", "1");
  const qs = p.toString();
  return backendFetch(`/calendar/personal${qs ? `?${qs}` : ""}`);
}

export async function getGlobalCalendar(opts: {
  /** Vide = tout ce qui sort. Plusieurs valeurs se lisent comme un OU. */
  providerIds?: readonly number[];
  mediaType: CalendarMediaFilter;
  from?: string;
  to?: string;
}): Promise<CalendarResponse> {
  const p = new URLSearchParams({
    mediaType: opts.mediaType,
    region: currentRegion(),
  });
  if (opts.providerIds?.length) p.set("providerIds", opts.providerIds.join(","));
  if (opts.from) p.set("from", opts.from);
  if (opts.to) p.set("to", opts.to);
  return backendFetch(`/calendar/global?${p}`);
}

/** La file du serveur, demandes de tout le monde comprises. Admins seulement. */
export async function getServerDownloads(): Promise<QueueResponse> {
  return backendFetch("/downloads");
}

/**
 * Heures de diffusion d'une série, indexées « S1E2 ».
 * Objet vide quand Sonarr ne suit pas la série : on n'invente pas d'heure.
 */
export async function getSeriesAirTimes(tmdbId: number): Promise<{ times: Record<string, string> }> {
  return backendFetch(`/calendar/airtimes?tmdbId=${tmdbId}`);
}

/** Catalogue fusionné films + séries : un film peut être sur une plateforme
 *  absente de la liste séries. */
export async function getCalendarProviders(): Promise<{ results: CalendarProvider[] }> {
  return backendFetch(`/calendar/providers?region=${currentRegion()}`);
}
