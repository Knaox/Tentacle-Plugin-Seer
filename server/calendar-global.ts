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
import type { TmdbRef } from "./tmdb-cache";
import { tmdbKey } from "./tmdb-cache";
import { resolveTmdbMeta, scheduleTmdbBackfill } from "./tmdb-resolver";
import { mapLimit } from "./concurrency";
import { toDayString } from "./tmdb-fetch";
import {
  type CalendarItem, type CalendarResponse, type CalendarKind,
  makeItemId, sortCalendarItems, capPerSeries,
} from "./calendar-types";

const PAGES = 3;
const MAX_PER_SERIES = 2;
/** Fiches récupérées en direct pour un calendrier plateforme encore froid. */
const EPISODE_FETCH_BUDGET = 30;
/** Statut Jellyseerr d'un média bloqué par tags — retiré comme sur le catalogue. */
const MEDIA_STATUS_BLOCKLISTED = 6;
/** TMDB `status=0` = « Returning Series » : la série diffuse encore. */
const TMDB_STATUS_RETURNING = "0";

export interface GlobalCalendarOpts {
  scope: "all" | "provider";
  providerId?: number;
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

  if (opts.scope === "provider" && opts.providerId) {
    const shared = {
      watchProviders: String(opts.providerId),
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

    return {
      from: opts.from,
      to: opts.to,
      items: capPerSeries(sortCalendarItems(Array.from(merged.values())), MAX_PER_SERIES),
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
        providerIds: opts.providerId ? [opts.providerId] : [],
        requestId: null,
        requestStatus: null,
      });
    }
  }

  return { items: Array.from(unique.values()), scanned };
}

/**
 * Prochains épisodes des séries en cours de diffusion sur une plateforme.
 * Les dates viennent de la mémoire des fiches : gratuit une fois chaude, et
 * ce qui manque est complété en tâche de fond pour la prochaine consultation.
 */
async function buildProviderEpisodes(
  prisma: PrismaClient,
  cfg: WorkerCfg,
  rows: DiscoverResult[],
  opts: GlobalCalendarOpts,
): Promise<{ items: CalendarItem[]; partial: boolean }> {
  const refs: TmdbRef[] = [];
  const posters = new Map<number, DiscoverResult>();
  for (const r of rows) {
    if (!r.id || r.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED) continue;
    refs.push({ mediaType: "tv", tmdbId: r.id });
    posters.set(r.id, r);
  }
  if (refs.length === 0) return { items: [], partial: false };

  const { meta, missing } = await resolveTmdbMeta(prisma, cfg, refs, {
    maxFetch: EPISODE_FETCH_BUDGET,
    region: opts.region,
  });
  if (missing.length > 0) scheduleTmdbBackfill(prisma, cfg, missing, opts.region);

  const items: CalendarItem[] = [];
  for (const ref of refs) {
    const m = meta.get(tmdbKey(ref));
    const date = m?.nextAirDate;
    if (!m || !date || date < opts.from || date > opts.to) continue;

    const src = posters.get(ref.tmdbId);
    items.push({
      id: makeItemId("tv", ref.tmdbId, "episode", date),
      date,
      mediaType: "tv",
      tmdbId: ref.tmdbId,
      title: m.title || src?.name || "",
      posterPath: m.posterPath ?? src?.posterPath ?? null,
      backdropPath: m.backdropPath ?? src?.backdropPath ?? null,
      overview: m.overview ?? src?.overview ?? null,
      kind: "episode",
      seasonNumber: m.nextSeason,
      episodeNumber: m.nextEpisode,
      networks: m.networks,
      providerIds: opts.providerId ? [opts.providerId] : [],
      requestId: null,
      requestStatus: null,
    });
  }

  return { items, partial: missing.length > 0 };
}
