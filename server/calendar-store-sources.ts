/* ------------------------------------------------------------------ */
/*  Seer Plugin — Sources brutes du calendrier maître                  */
/* ------------------------------------------------------------------ */

/*
 * Chaque source est cachée SÉPARÉMENT (~1 h) du store assemblé : quand le
 * store se reconstruit vite parce qu'il s'est déclaré incomplet (fiches en
 * cours de récupération), il repart de ces réponses-là — zéro appel réseau
 * re-payé, seul l'assemblage en mémoire est refait.
 *
 * Contrainte mesurée sur l'API réelle (héritée de calendar-global) :
 * `watchProviders` ne se combine avec AUCUN filtre de date — la réponse tombe
 * à zéro. Les requêtes par plateformes passent donc par `status=0` (séries en
 * cours de diffusion), jamais par une fenêtre de dates.
 */

import { cached } from "./cache";
import { mapLimitStrict } from "./concurrency";
import { toDayString } from "./tmdb-fetch";
import { detectAnime } from "./tmdb-traits";
import type { WorkerCfg } from "./seerr-unified";
import { type CalendarItem, type CalendarKind, makeItemId } from "./calendar-types";

/** Statut Jellyseerr d'un média bloqué par tags — retiré comme sur le catalogue. */
const MEDIA_STATUS_BLOCKLISTED = 6;

const PAGES = 3;
const SRC_TTL_MS = 3_600_000;
const SRC_STALE_MS = 6 * 3_600_000;
/** TMDB `status=0` = « Returning Series » : la série diffuse encore. */
const TMDB_STATUS_RETURNING = "0";

/** Au-delà, le « OU » TMDB dilue trop chaque plateforme dans les 3 pages. */
const UNION_CHUNK = 8;
const UNION_PROVIDERS_MAX = 16;

/**
 * Plateformes à couvrir en PRIORITÉ dans l'union, quand la région les propose.
 * L'ordre du catalogue Jellyseerr n'est pas garanti pertinent ; sans cette
 * liste, un catalogue alphabétique pousserait des plateformes anecdotiques
 * dans l'union et Crunchyroll pouvait en sortir.
 * Netflix, Amazon Prime, Disney+, Crunchyroll, Apple TV+, Canal+, ADN, Max.
 */
const PRIORITY_PROVIDER_IDS = [8, 119, 337, 283, 350, 381, 415, 1899];

export interface DiscoverRow {
  id?: number;
  mediaType?: string;
  title?: string;
  name?: string;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  releaseDate?: string;
  firstAirDate?: string;
  mediaInfo?: { status?: number };
  /* Sans ces champs, tri et filtres seraient inertes sur les entrées issues de
   * la découverte : elles ne passent pas par la mémoire des fiches. */
  voteAverage?: number;
  popularity?: number;
  originalLanguage?: string;
  originCountry?: string[];
  genreIds?: number[];
}

/**
 * Un échec LÈVE, il ne rend jamais « [] » : un vide d'échec est indiscernable
 * d'un vrai vide, et le cache le graverait comme un succès pour des heures —
 * c'est exactement le scénario du calendrier maigre qui ne se soigne pas.
 * `cached()` sait quoi faire d'un chargeur qui rejette : rien n'est stocké, la
 * dernière bonne valeur continue d'être servie, et le backoff espace les essais.
 */
async function discover(
  cfg: WorkerCfg, path: string, params: Record<string, string>, page: number,
): Promise<DiscoverRow[]> {
  const qs = new URLSearchParams({ ...params, page: String(page) });
  const res = await fetch(`${cfg.seerrUrl}/api/v1/discover/${path}?${qs}`, {
    headers: { "X-Api-Key": cfg.seerrApiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`discover/${path} → ${res.status}`);
  const data = (await res.json()) as { results?: DiscoverRow[] };
  return data.results ?? [];
}

async function discoverPages(
  cfg: WorkerCfg, path: string, params: Record<string, string>,
): Promise<DiscoverRow[]> {
  // Strict : une page en échec fait échouer la SOURCE. La variante tolérante
  // rendait des pages nulles en silence — trois pages muettes = faux vide.
  const pages = await mapLimitStrict(
    Array.from({ length: PAGES }, (_, i) => i + 1),
    3,
    (page) => discover(cfg, path, params, page),
  );
  return pages.flat();
}

/** Films à venir — la source historique du mode « Tout ». */
export async function discoverUpcomingMovies(cfg: WorkerCfg): Promise<DiscoverRow[]> {
  return cached(
    "seer:src:mov-up",
    SRC_TTL_MS,
    () => discoverPages(cfg, "movies/upcoming", {}),
    { staleMs: SRC_STALE_MS },
  );
}

/**
 * Films récemment sortis — la moitié PASSÉE de la fenêtre, qu'« upcoming »
 * ignore par définition.
 *
 * Si Jellyseerr ne relaie pas les bornes de date, le tri descendant renvoie
 * d'abord les titres « annoncés » à des dates fantaisistes (2030…) : la
 * fenêtre du build les jette, et cette source ne produit alors presque rien.
 * Dégradation assumée — les films passés restent couverts par les demandes.
 */
export async function discoverRecentMovies(
  cfg: WorkerCfg, from: string, to: string,
): Promise<DiscoverRow[]> {
  return cached(
    `seer:src:mov-recent:${from}:${to}`,
    SRC_TTL_MS,
    () => discoverPages(cfg, "movies", {
      sortBy: "primary_release_date.desc",
      primaryReleaseDateGte: from,
      primaryReleaseDateLte: to,
    }),
    { staleMs: SRC_STALE_MS },
  );
}

/** Débuts de séries — depuis le début d'horizon, donc premières passées incluses. */
export async function discoverTvFirsts(cfg: WorkerCfg, from: string): Promise<DiscoverRow[]> {
  return cached(
    `seer:src:tv-first:${from}`,
    SRC_TTL_MS,
    () => discoverPages(cfg, "tv", {
      sortBy: "first_air_date.asc",
      firstAirDateGte: from,
    }),
    { staleMs: SRC_STALE_MS },
  );
}

/**
 * Séries en cours de diffusion, toutes plateformes confondues, par popularité.
 * C'est ce qui remplit la SEMAINE du mode « Tout » : leurs prochains épisodes
 * tombent dans les jours qui viennent, là où les premières tombent dans les mois.
 */
export async function discoverTvReturning(cfg: WorkerCfg): Promise<DiscoverRow[]> {
  return cached(
    "seer:src:tv-ret",
    SRC_TTL_MS,
    () => discoverPages(cfg, "tv", {
      sortBy: "popularity.desc",
      status: TMDB_STATUS_RETURNING,
    }),
    { staleMs: SRC_STALE_MS },
  );
}

/** Séries en cours sur un lot de plateformes (le tube est un OU côté TMDB). */
async function discoverTvReturningByProviders(
  cfg: WorkerCfg, ids: number[], region: string,
): Promise<DiscoverRow[]> {
  if (ids.length === 0) return [];
  const key = [...ids].sort((a, b) => a - b).join("-");
  return cached(
    `seer:src:tv-prov:${key}:${region}`,
    SRC_TTL_MS,
    () => discoverPages(cfg, "tv", {
      watchProviders: ids.join("|"),
      watchRegion: region,
      sortBy: "first_air_date.desc",
      status: TMDB_STATUS_RETURNING,
    }),
    { staleMs: SRC_STALE_MS },
  );
}

/**
 * Séries en cours sur les plateformes marquantes de la région : les
 * prioritaires d'abord, complétées par l'ordre du catalogue, en lots de huit.
 * C'est ce qui garde au filtre « plateforme » sa densité d'épisodes même si
 * une série n'est ni populaire mondialement ni demandée sur l'instance.
 */
export async function discoverTvTopProviders(
  cfg: WorkerCfg, region: string,
): Promise<DiscoverRow[]> {
  const ids = await topRegionProviderIds(cfg, region);
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += UNION_CHUNK) chunks.push(ids.slice(i, i + UNION_CHUNK));
  const buckets = await mapLimitStrict(chunks, 2, (c) => discoverTvReturningByProviders(cfg, c, region));
  return buckets.flat();
}

/** Transforme des résultats de découverte en entrées, fenêtre appliquée. */
export function discoverRowsToItems(
  rows: DiscoverRow[], type: "movie" | "tv", from: string, to: string,
): CalendarItem[] {
  const out: CalendarItem[] = [];
  for (const r of rows) {
    if (!r.id) continue;
    if (r.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED) continue;

    const date = toDayString(r.releaseDate ?? r.firstAirDate);
    // Garde-fou : hors fenêtre = bruit TMDB (dates 2030…), on jette.
    if (!date || date < from || date > to) continue;

    const mediaType = (r.mediaType === "tv" || r.mediaType === "movie")
      ? (r.mediaType as "movie" | "tv")
      : type;
    const kind: CalendarKind = mediaType === "movie" ? "theatrical" : "premiere";

    out.push({
      id: makeItemId(mediaType, r.id, kind, date),
      date, mediaType, tmdbId: r.id,
      title: r.title ?? r.name ?? "",
      posterPath: r.posterPath ?? null,
      backdropPath: r.backdropPath ?? null,
      overview: r.overview ?? null,
      kind,
      seasonNumber: null,
      episodeNumber: null,
      networks: null,
      voteAverage: typeof r.voteAverage === "number" ? r.voteAverage : null,
      popularity: typeof r.popularity === "number" ? r.popularity : null,
      originalLanguage: r.originalLanguage ?? null,
      isAnime: detectAnime(r),
      // Complété par l'enrichissement final du build : recopier la plateforme
      // demandée jurerait qu'un film est sur toutes les plateformes cochées.
      providerIds: [],
      requestId: null,
      requestStatus: null,
    });
  }
  return out;
}

/** Les plateformes retenues pour l'union, prioritaires en tête. */
export async function topRegionProviderIds(cfg: WorkerCfg, region: string): Promise<number[]> {
  return cached(
    `seer:src:top-prov:${region}`,
    24 * 3_600_000,
    async () => {
      const catalog: number[] = [];
      let pannes = 0;
      for (const path of ["tv", "movies"] as const) {
        try {
          const res = await fetch(
            `${cfg.seerrUrl}/api/v1/watchproviders/${path}?watchRegion=${region}`,
            { headers: { "X-Api-Key": cfg.seerrApiKey }, signal: AbortSignal.timeout(10_000) },
          );
          if (!res.ok) throw new Error(`watchproviders/${path} → ${res.status}`);
          const data = (await res.json()) as Array<{ id?: number }>;
          for (const p of Array.isArray(data) ? data : []) {
            if (typeof p.id === "number" && !catalog.includes(p.id)) catalog.push(p.id);
          }
        } catch { pannes++; /* un catalogue indisponible ne vide pas l'autre */ }
      }
      /* Un catalogue muet sur deux : liste appauvrie mais utilisable. Les DEUX
       * muets : panne — lever plutôt que graver une liste vide 24 h. */
      if (pannes === 2) throw new Error("watchproviders : aucun catalogue ne répond");

      const out: number[] = [];
      for (const id of PRIORITY_PROVIDER_IDS) {
        if (catalog.includes(id) && !out.includes(id)) out.push(id);
      }
      for (const id of catalog) {
        if (out.length >= UNION_PROVIDERS_MAX) break;
        if (!out.includes(id)) out.push(id);
      }
      return out.slice(0, UNION_PROVIDERS_MAX);
    },
  );
}
