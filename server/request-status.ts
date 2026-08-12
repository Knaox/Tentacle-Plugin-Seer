/* ------------------------------------------------------------------ */
/*  Seer Plugin — Le statut AFFICHÉ d'une demande Jellyseerr           */
/* ------------------------------------------------------------------ */

/*
 * Une demande porte sur ce QU'ON A DEMANDÉ, pas sur la série entière.
 *
 * Jellyseerr, lui, ne connaît qu'un statut par MÉDIA : une série dont il manque
 * la saison 4 reste « partiellement disponible » pour toujours. Quiconque avait
 * demandé les saisons 1 et 2, toutes deux arrivées, lisait donc « Partiellement
 * disponible » sur une demande entièrement satisfaite — sans jamais savoir ce
 * qui manquait, puisque rien de ce qu'il avait demandé ne manquait.
 *
 * La granularité existe pourtant : `media.seasons[].status` donne la
 * disponibilité SAISON PAR SAISON. Il suffit de la croiser avec le périmètre de
 * la demande (`request.seasons`). C'est exactement ce que fait déjà le worker
 * pour les demandes suivies localement (`season-availability.ts`) ; ce module
 * étend le même raisonnement aux lignes lues chez Jellyseerr, qui sont la
 * source de vérité de « Mes demandes ».
 *
 * NE PAS confondre les deux tableaux de saisons :
 *   - `request.seasons[].status`  → l'état de la DEMANDE de saison (approuvée…)
 *   - `media.seasons[].status`    → la DISPONIBILITÉ de la saison  ← celui-ci
 */

import type { RequestStatus } from "./types";
import { mapSeerrStatus } from "./worker-sync";

/** status Jellyseerr d'une saison / d'un média : 5 = AVAILABLE. */
const AVAILABLE = 5;

/**
 * La forme MINIMALE dont ce module a besoin — volontairement structurelle :
 * les appelants passent leurs propres lignes Jellyseerr sans qu'un type ait à
 * traverser la moitié du serveur.
 */
export interface StatusRow {
  status: number;
  /** Saisons couvertes par la demande. */
  seasons?: Array<{ seasonNumber: number }>;
  media?: {
    status?: number;
    /** Disponibilité par saison de la série entière. */
    seasons?: Array<{ seasonNumber: number; status?: number }>;
    downloadStatus?: Array<{ status?: string }>;
  };
}

/**
 * Toutes les saisons demandées sont-elles disponibles ?
 *
 * Faux dès qu'on ne peut pas conclure — demande sans saison (film, ou série
 * demandée en bloc), Jellyseerr qui ne renvoie pas la granularité : mieux vaut
 * garder le statut global que promettre une disponibilité qu'on n'a pas vue.
 */
export function allRequestedSeasonsAvailable(row: StatusRow): boolean {
  const requested = (row.seasons ?? [])
    .map((s) => s.seasonNumber)
    .filter((n) => typeof n === "number");
  if (requested.length === 0) return false;

  const available = new Set(
    (row.media?.seasons ?? [])
      .filter((s) => s.status === AVAILABLE)
      .map((s) => s.seasonNumber),
  );
  if (available.size === 0) return false;

  return requested.every((n) => available.has(n));
}

/**
 * Le statut d'une ligne Jellyseerr, tel qu'il doit s'afficher.
 *
 * Deux corrections se superposent au mapping brut :
 *   1. l'épingle « Disponible » — une ligne locale posée à la main via
 *      « Marquer comme » l'emporte quand Jellyseerr a PERDU le média
 *      (availability-sync → UNKNOWN/DELETED, approbation fantôme) ; un état
 *      réel plus actif reprend toujours la main ;
 *   2. la disponibilité par-saison — voir l'en-tête du module.
 */
export function resolveRequestStatus(
  row: StatusRow,
  local?: { status: RequestStatus } | null,
): RequestStatus {
  let status = mapSeerrStatus(row.status, row.media?.status, row.media?.downloadStatus);

  if (
    local?.status === "available" &&
    (status === "approved" || status === "unavailable" || status === "deleted")
  ) {
    status = "available";
  }

  /* Uniquement depuis « partiellement disponible » : c'est le seul état où le
   * périmètre de la demande et celui du média divergent. Un téléchargement en
   * cours (media PROCESSING) reste un téléchargement en cours. */
  if (status === "partially_available" && allRequestedSeasonsAvailable(row)) {
    status = "available";
  }

  return status;
}
