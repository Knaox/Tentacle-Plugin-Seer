/* ------------------------------------------------------------------ */
/*  Seer API — disponibilité, progression, calendrier                  */
/* ------------------------------------------------------------------ */

import type { MediaType, RequestStatus } from "./types";

/* ── Disponibilité réelle ─────────────────────────────────────────── */

/**
 * On ne dit jamais « disponible » : ce mot désigne déjà, sur Mes demandes, un
 * titre présent dans la bibliothèque. On nomme le CANAL — « En Blu-ray »,
 * « En ligne » — jamais un état de bibliothèque. « released » signifie
 * seulement « rien ne s'oppose à une demande ».
 */
export type AvailabilityKind =
  | "released"
  | "digital_soon"
  | "theatrical"
  | "upcoming"
  | "not_aired";

/** Salle, VOD-streaming, DVD-Blu-ray : trois canaux qui se cumulent. */
export type ChannelId = "theatrical" | "digital" | "physical";

export interface AvailabilityChannel {
  id: ChannelId;
  /** Toujours 'YYYY-MM-DD' — à lire avec parseAirDate, jamais new Date(). */
  date: string;
  released: boolean;
}

/** Les chances qu'un fichier existe. Trois niveaux, jamais un pourcentage. */
export type AvailabilityOutlook = "likely" | "unlikely" | "not_yet";

export interface AvailabilityVerdict {
  mediaType: MediaType;
  tmdbId: number;
  /** Canaux connus, le plus probant d'abord. Vide = rien à dire. */
  channels: AvailabilityChannel[];
  outlook: AvailabilityOutlook;
  /** Plateformes d'abonnement, servies avec le verdict — aucun appel de plus. */
  providerIds: number[];
  kind: AvailabilityKind;
  date: string | null;
  theatricalDate: string | null;
  digitalDate: string | null;
  physicalDate: string | null;
  obtainable: boolean;
}

export interface AvailabilityResponse {
  results: AvailabilityVerdict[];
  pending?: number;
}

/* ── Progression des téléchargements ──────────────────────────────── */

export interface DownloadProgress {
  /** null = taille inconnue → barre indéterminée, pas « 0 % ». */
  percent: number | null;
  size: number | null;
  sizeLeft: number | null;
  etaSeconds: number | null;
  estimatedCompletionAt: string | null;
  status: string;
  title: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
}

export interface ProgressItem {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  status: RequestStatus;
  download: DownloadProgress;
  downloads?: DownloadProgress[];
}

export interface RequestsProgressResponse {
  /** Ancre d'interpolation : sans elle, impossible d'animer sans requête. */
  updatedAt: string;
  items: ProgressItem[];
}

/* ── Calendrier des sorties ───────────────────────────────────────── */

export type CalendarKind =
  | "digital"
  | "theatrical"
  | "physical"
  | "episode"
  | "premiere";

export interface CalendarItem {
  id: string;
  /** Toujours 'YYYY-MM-DD' — à lire avec parseAirDate, jamais new Date(). */
  date: string;
  mediaType: MediaType;
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
  requestId: string | null;
  requestStatus: RequestStatus | null;
}

export interface CalendarResponse {
  from: string;
  to: string;
  items: CalendarItem[];
  partial: boolean;
  scanned?: number;
}

export interface CalendarProvider {
  id: number;
  name: string;
  logoPath: string | null;
}

export type CalendarMode = "personal" | "all" | "provider";
export type CalendarMediaFilter = "movie" | "tv" | "both";

/* ── Statistiques (renvoyées avec la liste) ───────────────────────── */

export interface RequestsStats {
  total: number;
  byStatus: Record<string, number>;
  byType: { movie: number; tv: number };
}
