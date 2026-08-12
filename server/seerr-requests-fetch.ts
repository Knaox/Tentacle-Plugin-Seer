/* ------------------------------------------------------------------ */
/*  Seer Plugin — Pagination des demandes Jellyseerr                   */
/* ------------------------------------------------------------------ */

/*
 * L'ancien code enchaînait les pages : appel 1, attente, appel 2, attente…
 * Sur 428 demandes cela faisait 5 allers-retours strictement sérialisés avant
 * le moindre affichage.
 *
 * La première réponse porte pourtant `pageInfo.results` : dès qu'elle arrive on
 * connaît le nombre exact de pages restantes et on peut toutes les demander en
 * parallèle. 5 allers-retours deviennent 2. Le tri `sort=added` garantit un
 * ordre stable, donc le recollage est déterministe.
 */

import type { SeerrRequestRow, WorkerCfg } from "./seerr-unified";
import { mapLimit } from "./concurrency";

export interface SeerrRequestsPage {
  rows: SeerrRequestRow[];
  total: number;
}

const PAGE_CONCURRENCY = 4;

/**
 * Une page de demandes Jellyseerr.
 *
 * `seerUserId` à `null` retire le filtre `requestedBy` : l'endpoint renvoie
 * alors les demandes de TOUT LE MONDE. C'est ce que sert l'agenda quand on
 * choisit de voir l'activité du serveur entier plutôt que la sienne.
 */
export async function fetchSeerrRequestsPage(
  cfg: WorkerCfg,
  seerUserId: number | null,
  take: number,
  skip: number,
  filter = "all",
): Promise<SeerrRequestsPage> {
  // Endpoint général filtré par requestedBy — plus stable que /user/:id/requests
  const who = seerUserId == null ? "" : `&requestedBy=${seerUserId}`;
  const url =
    `${cfg.seerrUrl}/api/v1/request?take=${take}&skip=${skip}` +
    `&filter=${encodeURIComponent(filter)}&sort=added${who}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": cfg.seerrApiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Jellyseerr GET /request${who || " (tous)"} failed: ${res.status} ${body.slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as {
    pageInfo?: { results?: number };
    results?: SeerrRequestRow[];
  };
  return {
    rows: data.results ?? [],
    total: data.pageInfo?.results ?? data.results?.length ?? 0,
  };
}

export interface FetchAllOpts {
  take?: number;
  maxPages?: number;
  filter?: string;
}

/** Première page en série, toutes les suivantes en parallèle. */
export async function fetchAllSeerrRequests(
  cfg: WorkerCfg,
  /** `null` = toutes les demandes, tous utilisateurs confondus. */
  seerUserId: number | null,
  opts: FetchAllOpts = {},
): Promise<{ rows: SeerrRequestRow[]; total: number; truncated: boolean }> {
  const take = opts.take ?? 100;
  const maxPages = opts.maxPages ?? 25;
  const filter = opts.filter ?? "all";

  const first = await fetchSeerrRequestsPage(cfg, seerUserId, take, 0, filter);
  if (first.rows.length < take || first.total <= take) {
    return { rows: first.rows, total: first.total || first.rows.length, truncated: false };
  }

  const totalPages = Math.ceil(first.total / take);
  const wanted = Math.min(totalPages, maxPages);
  const skips = Array.from({ length: wanted - 1 }, (_, i) => (i + 1) * take);

  const pages = await mapLimit(skips, PAGE_CONCURRENCY, (skip) =>
    fetchSeerrRequestsPage(cfg, seerUserId, take, skip, filter),
  );

  const rows = [...first.rows];
  for (const page of pages) if (page) rows.push(...page.rows);

  return { rows, total: first.total, truncated: totalPages > maxPages };
}
