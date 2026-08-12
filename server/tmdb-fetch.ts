/* ------------------------------------------------------------------ */
/*  Seer Plugin — Récupération et lecture d'une fiche TMDB             */
/* ------------------------------------------------------------------ */

import type { TmdbMeta, TmdbRef } from "./tmdb-cache";
import type { WorkerCfg } from "./seerr-unified";

/**
 * Types de dates de sortie TMDB. C'est toute la réponse au problème « je vois
 * 2026 mais je ne sais pas si c'est dispo » : seul le type 4 (numérique) dit
 * qu'un film est réellement récupérable. Un film peut être « au cinéma » depuis
 * deux mois sans exister nulle part ailleurs.
 */
export const RELEASE_TYPE = {
  PREMIERE: 1,
  THEATRICAL_LIMITED: 2,
  THEATRICAL: 3,
  DIGITAL: 4,
  PHYSICAL: 5,
  TV: 6,
} as const;

export interface SeerrReleaseDate { type?: number; release_date?: string; note?: string }
export interface SeerrReleaseGroup { iso_3166_1?: string; release_dates?: SeerrReleaseDate[] }

export interface SeerrDetailRaw {
  id?: number;
  title?: string;
  name?: string;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  releaseDate?: string;
  firstAirDate?: string;
  status?: string;
  releases?: { results?: SeerrReleaseGroup[] };
  nextEpisodeToAir?: { airDate?: string; seasonNumber?: number; episodeNumber?: number } | null;
  lastEpisodeToAir?: { airDate?: string } | null;
  networks?: Array<{ id?: number; name?: string }>;
  watchProviders?: Array<{
    iso_3166_1?: string;
    flatrate?: Array<{ id?: number; providerId?: number }>;
  }>;
}

/** '2026-12-16T00:00:00.000Z' | '2026-12-16' → '2026-12-16'. null sinon. */
export function toDayString(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const day = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** Aujourd'hui en 'YYYY-MM-DD' LOCAL — jamais `toISOString()`, qui bascule en UTC. */
export function todayString(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Extrait les dates par type pour la région voulue.
 *
 * Région : celle demandée → 'US' → première disponible. Quand plusieurs dates
 * partagent un même type, on garde la PLUS ANCIENNE : c'est la date de première
 * mise à disposition, donc la bonne réponse à « depuis quand est-ce dispo ? ».
 * Si toutes sont futures, la plus ancienne est aussi la plus proche.
 */
export function pickReleaseDates(
  groups: SeerrReleaseGroup[] | undefined,
  region: string,
): { digital: string | null; theatrical: string | null; physical: string | null; region: string | null } {
  const empty = { digital: null, theatrical: null, physical: null, region: null };
  if (!Array.isArray(groups) || groups.length === 0) return empty;

  const wanted = region.toUpperCase();
  const group =
    groups.find((g) => g.iso_3166_1?.toUpperCase() === wanted) ??
    groups.find((g) => g.iso_3166_1?.toUpperCase() === "US") ??
    groups[0];
  if (!group?.release_dates?.length) return empty;

  const earliest = (types: readonly number[]): string | null => {
    let best: string | null = null;
    for (const r of group.release_dates ?? []) {
      if (typeof r.type !== "number" || !types.includes(r.type)) continue;
      const day = toDayString(r.release_date);
      if (day && (best === null || day < best)) best = day;
    }
    return best;
  };

  return {
    digital: earliest([RELEASE_TYPE.DIGITAL]),
    // Une sortie salle limitée ou une avant-première comptent comme « au cinéma ».
    theatrical: earliest([
      RELEASE_TYPE.THEATRICAL,
      RELEASE_TYPE.THEATRICAL_LIMITED,
      RELEASE_TYPE.PREMIERE,
    ]),
    physical: earliest([RELEASE_TYPE.PHYSICAL, RELEASE_TYPE.TV]),
    region: group.iso_3166_1?.toUpperCase() ?? null,
  };
}

const DAY = 86_400_000;

/**
 * TTL adaptatif — remplace deux tables à deux TTL par une fonction.
 *
 * Une série terminée ne changera plus : 30 jours. Un film dont la date
 * numérique n'est pas annoncée peut la recevoir n'importe quand : 3 jours.
 * Résultat : la grande majorité des fiches tient une semaine ou plus, donc le
 * worker n'en rafraîchit qu'une poignée par jour.
 */
export function computeTtlMs(meta: TmdbMeta, now = Date.now()): number {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const today = todayString(new Date(now));

  if (meta.mediaType === "tv") {
    const status = (meta.tmdbStatus ?? "").toLowerCase();
    if (status === "ended" || status === "canceled" || status === "cancelled") return 30 * DAY;
    if (meta.nextAirDate) {
      if (meta.nextAirDate <= today) return 6 * 3_600_000; // TMDB n'a pas encore basculé
      const diff = new Date(`${meta.nextAirDate}T00:00:00`).getTime() - now;
      return clamp(diff + DAY, 6 * 3_600_000, 7 * DAY);
    }
    return 2 * DAY; // en cours, pas de date annoncée
  }

  if (meta.digitalDate && meta.digitalDate <= today) return 30 * DAY;
  if (meta.theatricalDate && meta.theatricalDate <= today) return 3 * DAY; // la date numérique peut tomber
  if (meta.releaseDate && meta.releaseDate < today) return 30 * DAY;       // vieux titre, plus rien ne bouge
  return 12 * 3_600_000;                                                   // à venir
}

export function parseDetailToMeta(raw: SeerrDetailRaw, ref: TmdbRef, region: string): TmdbMeta {
  const isTv = ref.mediaType === "tv";
  const rel = isTv
    ? { digital: null, theatrical: null, physical: null, region: null }
    : pickReleaseDates(raw.releases?.results, region);

  const providerIds: number[] = [];
  for (const wp of raw.watchProviders ?? []) {
    if (wp.iso_3166_1?.toUpperCase() !== region.toUpperCase()) continue;
    for (const p of wp.flatrate ?? []) {
      const id = p.id ?? p.providerId;
      if (typeof id === "number" && id > 0) providerIds.push(id);
    }
  }

  const meta: TmdbMeta = {
    mediaType: ref.mediaType,
    tmdbId: ref.tmdbId,
    title: raw.title ?? raw.name ?? "",
    posterPath: raw.posterPath ?? null,
    backdropPath: raw.backdropPath ?? null,
    overview: raw.overview ?? null,
    releaseDate: toDayString(raw.releaseDate ?? raw.firstAirDate),
    tmdbStatus: raw.status ?? null,
    digitalDate: rel.digital,
    theatricalDate: rel.theatrical,
    physicalDate: rel.physical,
    releaseRegion: rel.region,
    nextAirDate: toDayString(raw.nextEpisodeToAir?.airDate),
    nextSeason: raw.nextEpisodeToAir?.seasonNumber ?? null,
    nextEpisode: raw.nextEpisodeToAir?.episodeNumber ?? null,
    lastAirDate: toDayString(raw.lastEpisodeToAir?.airDate),
    networks: (raw.networks ?? [])
      .map((n) => n?.name)
      .filter((n): n is string => !!n)
      .slice(0, 3)
      .join(", ") || null,
    providerIds: Array.from(new Set(providerIds)),
    expiresAt: new Date().toISOString(),
  };

  meta.expiresAt = new Date(Date.now() + computeTtlMs(meta)).toISOString();
  return meta;
}

export async function fetchTmdbMeta(
  cfg: WorkerCfg,
  ref: TmdbRef,
  region: string,
): Promise<TmdbMeta | null> {
  try {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/${ref.mediaType}/${ref.tmdbId}`, {
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return parseDetailToMeta((await res.json()) as SeerrDetailRaw, ref, region);
  } catch {
    return null;
  }
}
