/* ------------------------------------------------------------------ */
/*  Seer Plugin — Calendrier global (plateformes + « Tout »)           */
/* ------------------------------------------------------------------ */

/*
 * Trois contraintes mesurées sur l'API réelle :
 *
 *  1. `watchProviders` ne se combine avec AUCUN filtre de date : la réponse
 *     tombe à zéro résultat (`airDateGte` est carrément refusé).
 *
 *  2. Pour une plateforme, `first_air_date` répond à « quand cette série
 *     a-t-elle commencé », pas à « quand sort le prochain épisode » — la seule
 *     question qui intéresse quelqu'un qui regarde Crunchyroll. Trier par
 *     première diffusion ne renvoyait donc que des dates passées, et la fenêtre
 *     les rejetait toutes : zéro résultat.
 *     La bonne approche : `status=0` (séries EN COURS de diffusion sur la
 *     plateforme, 171 pour Crunchyroll), puis la date du prochain épisode de
 *     chacune, lue dans la mémoire des fiches — donc gratuite une fois chaude.
 *
 *  3. TMDB place en tête des titres « annoncés » à des dates fantaisistes
 *     (2030 et au-delà) ou sans date du tout. Sans garde-fou, la vue se
 *     remplit de bruit : on rejette tout ce qui sort de la fenêtre demandée.
 *
 * Ce mode ne dépend d'aucun utilisateur : une seule entrée de cache sert toute
 * l'instance, et les fiches récupérées profitent à tout le monde.
 */

import type { PrismaClient } from "@prisma/client";
import type { WorkerCfg } from "./seerr-unified";
import { mapLimit } from "./concurrency";
import { toDayString } from "./tmdb-fetch";
import { detectAnime } from "./tmdb-traits";
import { markRequested } from "./calendar-requested";
import { attachProviderIds, buildProviderEpisodes } from "./calendar-providers";
import {
  type CalendarItem, type CalendarResponse, type CalendarKind,
  makeItemId, sortCalendarItems, capPerSeries,
} from "./calendar-types";

const PAGES = 3;
const MAX_PER_SERIES = 2;
/** Statut Jellyseerr d'un média bloqué par tags — retiré comme sur le catalogue. */
const MEDIA_STATUS_BLOCKLISTED = 6;
/** TMDB `status=0` = « Returning Series » : la série diffuse encore. */
const TMDB_STATUS_RETURNING = "0";

export interface GlobalCalendarOpts {
  /**
   * Plateformes retenues. Vide = « tout ce qui sort ». Plusieurs valeurs se
   * lisent comme un OU — TMDB accepte le tube, et le multi coûte donc
   * exactement le même nombre d'appels que le mono.
   */
  providerIds: number[];
  mediaType: "movie" | "tv" | "both";
  region: string;
  from: string;
  to: string;
}

interface DiscoverResult {
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
  /* Sans ces champs, le tri et les filtres seraient INERTES en mode « Tout » :
   * cette vue ne passe pas par la mémoire des fiches, elle lit directement la
   * découverte — qui les porte déjà, sans un appel de plus. */
  voteAverage?: number;
  popularity?: number;
  originalLanguage?: string;
  originCountry?: string[];
  genreIds?: number[];
}

async function discover(
  cfg: WorkerCfg, path: string, params: Record<string, string>, page: number,
): Promise<DiscoverResult[]> {
  const qs = new URLSearchParams({ ...params, page: String(page) });
  try {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/discover/${path}?${qs}`, {
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: DiscoverResult[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

async function discoverPages(
  cfg: WorkerCfg, path: string, params: Record<string, string>,
): Promise<DiscoverResult[]> {
  const pages = await mapLimit(
    Array.from({ length: PAGES }, (_, i) => i + 1),
    3,
    (page) => discover(cfg, path, params, page),
  );
  return pages.flatMap((p) => p ?? []);
}

export async function buildGlobalCalendar(
  prisma: PrismaClient,
  cfg: WorkerCfg,
  opts: GlobalCalendarOpts,
): Promise<CalendarResponse> {
  const wantMovies = opts.mediaType === "movie" || opts.mediaType === "both";
  const wantTv = opts.mediaType === "tv" || opts.mediaType === "both";

  const tasks: Array<() => Promise<{ rows: DiscoverResult[]; type: "movie" | "tv" }>> = [];

  if (opts.providerIds.length > 0) {
    const shared = {
      // Le tube est un OU côté TMDB : « 8|337 » = Netflix ou Disney+.
      watchProviders: opts.providerIds.join("|"),
      watchRegion: opts.region,
    };

    // Séries : on passe par les prochains épisodes, seul calendrier qui ait un
    // sens pour une plateforme. Traité à part, plus bas.
    const seriesRows = wantTv
      ? await discoverPages(cfg, "tv", {
          ...shared,
          sortBy: "first_air_date.desc",
          status: TMDB_STATUS_RETURNING,
        })
      : [];

    if (wantMovies) {
      tasks.push(async () => ({
        type: "movie",
        rows: await discoverPages(cfg, "movies", { ...shared, sortBy: "primary_release_date.desc" }),
      }));
    }

    const movieBuckets = await mapLimit(tasks, 2, (t) => t());
    const episodes = await buildProviderEpisodes(prisma, cfg, seriesRows, opts);
    const movies = collectItems(movieBuckets, opts);

    const merged = new Map<string, CalendarItem>();
    for (const it of [...episodes.items, ...movies.items]) if (!merged.has(it.id)) merged.set(it.id, it);

    const items = capPerSeries(sortCalendarItems(Array.from(merged.values())), MAX_PER_SERIES);
    // Les vraies plateformes de chaque titre, lues en mémoire seulement.
    await attachProviderIds(prisma, cfg, items, opts.region);
    // Ce qui a déjà été demandé porte sa pastille, sinon il se perd dans le flot.
    await markRequested(prisma, items);

    return {
      from: opts.from,
      to: opts.to,
      items,
      partial: episodes.partial,
      scanned: seriesRows.length + movies.scanned,
    };
  }

  if (wantMovies) {
    tasks.push(async () => ({
      type: "movie",
      rows: await discoverPages(cfg, "movies/upcoming", {}),
    }));
  }
  if (wantTv) {
    tasks.push(async () => ({
      type: "tv",
      rows: await discoverPages(cfg, "tv", {
        sortBy: "first_air_date.asc",
        firstAirDateGte: opts.from,
      }),
    }));
  }

  const collected = await mapLimit(tasks, 2, (t) => t());
  const { items, scanned } = collectItems(collected, opts);
  await markRequested(prisma, items);

  return {
    from: opts.from,
    to: opts.to,
    items: capPerSeries(sortCalendarItems(items), MAX_PER_SERIES),
    partial: false,
    scanned,
  };
}

type Bucket = { rows: DiscoverResult[]; type: "movie" | "tv" } | null;

/** Transforme des résultats de découverte en entrées, fenêtre appliquée. */
function collectItems(
  buckets: Array<Bucket>,
  opts: GlobalCalendarOpts,
): { items: CalendarItem[]; scanned: number } {
  let scanned = 0;
  const unique = new Map<string, CalendarItem>();

  for (const bucket of buckets) {
    if (!bucket) continue;
    for (const r of bucket.rows) {
      scanned++;
      if (!r.id) continue;
      if (r.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED) continue;

      const date = toDayString(r.releaseDate ?? r.firstAirDate);
      // Garde-fou : hors fenêtre = bruit TMDB, on jette.
      if (!date || date < opts.from || date > opts.to) continue;

      const mediaType = (r.mediaType === "tv" || r.mediaType === "movie")
        ? (r.mediaType as "movie" | "tv")
        : bucket.type;
      const kind: CalendarKind = mediaType === "movie" ? "theatrical" : "premiere";
      const id = makeItemId(mediaType, r.id, kind, date);
      if (unique.has(id)) continue;

      unique.set(id, {
        id, date, mediaType, tmdbId: r.id,
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
        // Complété juste après depuis la mémoire des fiches : recopier ici la
        // plateforme demandée revenait à jurer qu'un film est sur les quatre
        // plateformes cochées.
        providerIds: [],
        requestId: null,
        requestStatus: null,
      });
    }
  }

  return { items: Array.from(unique.values()), scanned };
}

