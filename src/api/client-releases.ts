/* ------------------------------------------------------------------ */
/*  Seer API — appels disponibilité / progression / calendrier         */
/* ------------------------------------------------------------------ */

import { backendFetch } from "./seer-client";
import { getCurrentLanguage } from "../utils/media-helpers";
import type { MediaType } from "./types";
import type {
  AvailabilityResponse, RequestsProgressResponse,
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

export async function getPersonalCalendar(from?: string, to?: string): Promise<CalendarResponse> {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const qs = p.toString();
  return backendFetch(`/calendar/personal${qs ? `?${qs}` : ""}`);
}

export async function getGlobalCalendar(opts: {
  providerId?: number;
  mediaType: CalendarMediaFilter;
  from?: string;
  to?: string;
}): Promise<CalendarResponse> {
  const p = new URLSearchParams({
    scope: opts.providerId ? "provider" : "all",
    mediaType: opts.mediaType,
    region: currentRegion(),
  });
  if (opts.providerId) p.set("providerId", String(opts.providerId));
  if (opts.from) p.set("from", opts.from);
  if (opts.to) p.set("to", opts.to);
  return backendFetch(`/calendar/global?${p}`);
}

export async function getCalendarProviders(
  mediaType: "movie" | "tv" = "tv",
): Promise<{ results: CalendarProvider[] }> {
  return backendFetch(`/calendar/providers?region=${currentRegion()}&mediaType=${mediaType}`);
}
