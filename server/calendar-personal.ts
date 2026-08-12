/* ------------------------------------------------------------------ */
/*  Seer Plugin — Calendrier « mes sorties »                           */
/* ------------------------------------------------------------------ */

/*
 * Le piège de ce mode, c'est le volume : une instance peut compter des
 * centaines de demandes, et aller chercher la fiche de chacune ferait
 * exactement le N+1 qu'on vient de supprimer ailleurs.
 *
 * On élague donc AVANT d'enrichir, en n'utilisant que ce qu'on a déjà en main
 * (le statut du média, présent dans la liste) :
 *   - un film déjà disponible n'a plus de « prochaine sortie » à annoncer ;
 *   - une série terminée ne diffusera plus rien.
 * Il ne reste qu'une poignée de titres réellement en attente.
 */

import type { PrismaClient } from "@prisma/client";
import type { RequestStatus } from "./types";
import type { TmdbMeta, TmdbRef } from "./tmdb-cache";
import { tmdbKey } from "./tmdb-cache";
import type { WorkerCfg, JellyfinUser } from "./seerr-unified";
import type { MergedRows } from "./requests-list";
import { resolveTmdbMeta, scheduleTmdbBackfill, DEFAULT_REGION } from "./tmdb-resolver";
import { mapSeerrStatus } from "./worker-sync";
import {
  type CalendarItem, type CalendarResponse, type CalendarKind,
  makeItemId, sortCalendarItems, capPerSeries,
} from "./calendar-types";

/** Fiches récupérées en direct pour un calendrier froid. */
const FETCH_BUDGET = 25;
const MAX_PER_SERIES = 3;

/** Statuts Jellyseerr de média n'annonçant plus rien : 5 = disponible. */
const SETTLED_MEDIA_STATUS = new Set([5]);

export interface PersonalCalendarOpts {
  from: string;
  to: string;
  maxFetch?: number;
  region?: string;
}

export async function buildPersonalCalendar(
  prisma: PrismaClient,
  cfg: WorkerCfg,
  user: JellyfinUser,
  rows: MergedRows,
  opts: PersonalCalendarOpts,
): Promise<CalendarResponse> {
  const region = opts.region ?? DEFAULT_REGION;

  /* 1) Élagage sur les seules données déjà en main — aucun appel réseau. */
  const refs = new Map<string, TmdbRef>();
  const statusByKey = new Map<string, { status: RequestStatus; requestId: string | null }>();

  for (const sr of rows.seerrRows) {
    if (!sr.media?.tmdbId) continue;
    const ref: TmdbRef = { mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId };
    const key = tmdbKey(ref);

    if (sr.media.mediaType === "movie" && SETTLED_MEDIA_STATUS.has(sr.media.status ?? 0)) continue;

    refs.set(key, ref);
    if (!statusByKey.has(key)) {
      const local = rows.localBySeerrId.get(sr.id);
      statusByKey.set(key, {
        status: mapSeerrStatus(sr.status, sr.media.status, sr.media.downloadStatus),
        requestId: local?.id ?? `seerr-${sr.id}`,
      });
    }
  }

  for (const l of rows.localOnly) {
    if (!l.tmdbId) continue;
    const key = tmdbKey({ mediaType: l.mediaType, tmdbId: l.tmdbId });
    refs.set(key, { mediaType: l.mediaType, tmdbId: l.tmdbId });
    if (!statusByKey.has(key)) statusByKey.set(key, { status: l.status, requestId: l.id });
  }

  /* 2) Enrichissement borné : la mémoire des fiches sert déjà la plupart. */
  const list = Array.from(refs.values());
  const { meta, missing } = await resolveTmdbMeta(prisma, cfg, list, {
    maxFetch: opts.maxFetch ?? FETCH_BUDGET,
    region,
  });
  if (missing.length > 0) scheduleTmdbBackfill(prisma, cfg, missing, region);

  /* 3) Construction, purement en mémoire. */
  const items: CalendarItem[] = [];
  for (const ref of list) {
    const m = meta.get(tmdbKey(ref));
    if (!m) continue;
    const ctx = statusByKey.get(tmdbKey(ref));
    for (const item of metaToCalendarItems(m, opts.from, opts.to)) {
      items.push({
        ...item,
        requestId: ctx?.requestId ?? null,
        requestStatus: ctx?.status ?? null,
      });
    }
  }

  return {
    from: opts.from,
    to: opts.to,
    items: capPerSeries(sortCalendarItems(items), MAX_PER_SERIES),
    partial: missing.length > 0,
  };
}

type BareItem = Omit<CalendarItem, "requestId" | "requestStatus">;

/** Une fiche peut produire plusieurs entrées : au cinéma PUIS en ligne. */
export function metaToCalendarItems(m: TmdbMeta, from: string, to: string): BareItem[] {
  const out: BareItem[] = [];

  const push = (date: string | null, kind: CalendarKind, season?: number | null, episode?: number | null) => {
    if (!date || date < from || date > to) return;
    out.push({
      id: makeItemId(m.mediaType, m.tmdbId, kind, date),
      date,
      mediaType: m.mediaType,
      tmdbId: m.tmdbId,
      title: m.title,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      overview: m.overview,
      kind,
      seasonNumber: season ?? null,
      episodeNumber: episode ?? null,
      networks: m.networks,
      providerIds: m.providerIds,
    });
  };

  if (m.mediaType === "movie") {
    push(m.digitalDate, "digital");
    push(m.theatricalDate, "theatrical");
    push(m.physicalDate, "physical");
    // Aucune date typée : la date de sortie annoncée reste la meilleure info.
    if (out.length === 0) push(m.releaseDate, "premiere");
  } else {
    push(m.nextAirDate, "episode", m.nextSeason, m.nextEpisode);
    if (m.releaseDate && (!m.nextAirDate || m.releaseDate !== m.nextAirDate)) {
      push(m.releaseDate, "premiere");
    }
  }

  return out;
}
