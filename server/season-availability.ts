/* ------------------------------------------------------------------ */
/*  Seer Plugin — Disponibilité par-saison + notifications riches      */
/* ------------------------------------------------------------------ */

import type { SeerRequest } from "./types";

/** status Jellyseerr media/season : 5 = AVAILABLE */
const AVAILABLE = 5;

/**
 * Suffixe « est sorti·e / sont sorti·e·s sur Tentacle TV » avec accord.
 * gender : "m" (film) | "f" (série/saison) ; plural pour plusieurs saisons.
 */
export function releasedSuffix(gender: "m" | "f", plural: boolean): string {
  const v = plural
    ? gender === "f" ? "sont sorties" : "sont sortis"
    : gender === "f" ? "est sortie" : "est sorti";
  return `${v} sur Tentacle TV`;
}

export interface SeasonEval {
  /** Saisons demandées (périmètre de la demande) */
  requested: number[];
  /** Saisons demandées effectivement disponibles (status 5) */
  available: number[];
  /** Toutes les saisons demandées sont disponibles */
  allAvailable: boolean;
}

/**
 * Croise les saisons DEMANDÉES (request.seasons) avec la disponibilité
 * PAR-SAISON renvoyée par Jellyseerr (mediaInfo.seasons[].status), au lieu du
 * statut global du média — qui reste « partiel » tant que d'autres saisons non
 * demandées manquent.
 */
/** Statut Jellyseerr d'une saison dont les données ont été retirées. */
const DELETED = 7;

/**
 * Saisons DEMANDÉES que Jellyseerr dit SUPPRIMÉES : les données ont été
 * retirées côté serveur, la saison est redevenue libre — la demande locale ne
 * doit plus la porter, sinon la fiche la verrouillerait encore.
 */
export function goneSeasons(
  requested: number[] | null,
  mediaSeasons: { seasonNumber: number; status: number }[] | undefined,
): number[] {
  const deleted = new Set(
    (mediaSeasons ?? []).filter((s) => s.status === DELETED).map((s) => s.seasonNumber),
  );
  return (requested ?? []).filter((s) => deleted.has(s)).sort((a, b) => a - b);
}

export function evaluateSeasons(
  requested: number[] | null,
  mediaSeasons: { seasonNumber: number; status: number }[] | undefined,
): SeasonEval {
  const req = requested ?? [];
  const availSet = new Set(
    (mediaSeasons ?? [])
      .filter((s) => s.status === AVAILABLE)
      .map((s) => s.seasonNumber),
  );
  const available = req.filter((s) => availSet.has(s)).sort((a, b) => a - b);
  return {
    requested: req,
    available,
    allAvailable: req.length > 0 && available.length === req.length,
  };
}

/**
 * Notif riche pour un lot de saisons DEVENUES disponibles.
 * title = nom de la série ; message = « Saison N est sortie sur Tentacle TV »
 * (ou « Saisons N, M sont sorties … »), avec mention « (2/3 saisons) » si la
 * demande n'est pas encore complète.
 */
export function seasonNotification(
  request: SeerRequest,
  newly: number[],
  totalAvailable: number,
): { title: string; message: string } {
  const sorted = [...newly].sort((a, b) => a - b);
  const multi = sorted.length > 1;
  const label = multi ? `Saisons ${sorted.join(", ")}` : `Saison ${sorted[0]}`;
  const requestedCount = request.seasons?.length ?? 0;
  const partial =
    requestedCount > 1 && totalAvailable < requestedCount
      ? ` (${totalAvailable}/${requestedCount} saisons)`
      : "";
  return {
    title: request.title,
    message: `${label} ${releasedSuffix("f", multi)}${partial}`,
  };
}
