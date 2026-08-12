/* ------------------------------------------------------------------ */
/*  Seer Plugin — Types du calendrier des sorties                      */
/* ------------------------------------------------------------------ */

/*
 * RÈGLE ABSOLUE : une date de sortie est une CHAÎNE 'YYYY-MM-DD', et toutes les
 * comparaisons de fenêtre sont lexicographiques.
 *
 * `new Date("2026-06-13")` est interprété en UTC : en Europe/Paris, un soir
 * d'été, cela décale l'affichage d'un jour entier. Un calendrier qui se trompe
 * de jour ne sert à rien, donc on ne construit jamais de Date à partir d'une
 * date de sortie côté serveur.
 */

import type { RequestStatus } from "./types";

export type CalendarKind =
  | "digital"
  | "theatrical"
  | "physical"
  | "episode"
  | "premiere";

export interface CalendarItem {
  /** `${mediaType}:${tmdbId}:${kind}:${date}` — stable, sert de clé de rendu. */
  id: string;
  date: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  kind: CalendarKind;
  seasonNumber: number | null;
  episodeNumber: number | null;
  networks: string | null;
  providerIds: number[];
  /** Renseignés en mode personnel uniquement. */
  requestId: string | null;
  requestStatus: RequestStatus | null;
}

export interface CalendarResponse {
  from: string;
  to: string;
  items: CalendarItem[];
  /** true = des fiches manquent encore, le front peut repasser. */
  partial: boolean;
  /** Mode global : nombre de résultats examinés avant filtrage de la fenêtre. */
  scanned?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDayString(v: unknown): v is string {
  return typeof v === "string" && DATE_RE.test(v);
}

/** Décale une date 'YYYY-MM-DD' de N jours, sans jamais passer par UTC. */
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export function makeItemId(
  mediaType: string, tmdbId: number, kind: CalendarKind, date: string,
): string {
  return `${mediaType}:${tmdbId}:${kind}:${date}`;
}

/** Tri chronologique, puis alphabétique à date égale. */
export function sortCalendarItems(items: CalendarItem[]): CalendarItem[] {
  return items.sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1));
}

/**
 * Plafonne le nombre d'entrées futures par série : une série quotidienne
 * inonderait sinon toute la vue.
 */
export function capPerSeries(items: CalendarItem[], max: number): CalendarItem[] {
  const seen = new Map<number, number>();
  const out: CalendarItem[] = [];
  for (const item of items) {
    if (item.mediaType !== "tv") { out.push(item); continue; }
    const n = (seen.get(item.tmdbId) ?? 0) + 1;
    seen.set(item.tmdbId, n);
    if (n <= max) out.push(item);
  }
  return out;
}
