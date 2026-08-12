/* ------------------------------------------------------------------ */
/*  Seer Plugin — « Est-ce que c'est vraiment sorti ? »                */
/* ------------------------------------------------------------------ */

/*
 * Le problème : une carte affiche « 2026 » sans dire si le titre est annoncé,
 * au cinéma, ou réellement récupérable. On demande, il ne se passe rien, et on
 * ne comprend pas pourquoi.
 *
 * La réponse est dans les dates de sortie TYPÉES de TMDB : seule la date
 * numérique (type 4) dit qu'un film existe ailleurs qu'en salle.
 *
 * Deux règles de prudence :
 *
 *   1. On ne dit JAMAIS « disponible ». Ce mot est déjà pris : sur Mes demandes
 *      il signifie « téléchargé, dans ta bibliothèque ». Ici on nomme seulement
 *      ce qui EMPÊCHE la récupération — un titre récupérable n'affiche rien de
 *      plus que son année, comme aujourd'hui.
 *
 *   2. On n'invente pas. Sans dates typées, on ne peut rien affirmer : on se
 *      tait, sauf si la date de sortie annoncée est franchement dans le futur.
 */

import type { TmdbMeta } from "./tmdb-cache";
import { todayString } from "./tmdb-fetch";

/*
 * Au-delà de ce délai, une sortie salle ne dit plus rien : la fenêtre
 * salle → numérique est aujourd'hui de trois à quatre mois, et TMDB ne
 * renseigne tout simplement pas de date numérique pour les titres anciens.
 * Sans ce garde-fou, « Come and See » (1985, ressorti en 2016) était annoncé
 * « au cinéma » — et avec lui des milliers de films du catalogue.
 */
const THEATRICAL_WINDOW_DAYS = 180;

/** Différence en jours entre deux dates 'YYYY-MM-DD', sans passer par UTC. */
function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const a = new Date(ay, am - 1, ad).getTime();
  const b = new Date(by, bm - 1, bd).getTime();
  return Math.round((b - a) / 86_400_000);
}

export type AvailabilityKind =
  /** Récupérable — aucune pastille affichée. */
  | "released"
  /** Sortie numérique connue et à venir. */
  | "digital_soon"
  /** En salle, aucune sortie numérique annoncée. */
  | "theatrical"
  /** Pas encore sorti, date connue. */
  | "upcoming"
  /** Série dont la diffusion n'a pas commencé. */
  | "not_aired";

export interface AvailabilityVerdict {
  mediaType: "movie" | "tv";
  tmdbId: number;
  kind: AvailabilityKind;
  /** Date à afficher, si elle existe. Toujours 'YYYY-MM-DD'. */
  date: string | null;
  theatricalDate: string | null;
  digitalDate: string | null;
  /** Une demande a-t-elle une chance d'aboutir maintenant ? */
  obtainable: boolean;
}

const released = (meta: TmdbMeta): AvailabilityVerdict => ({
  mediaType: meta.mediaType,
  tmdbId: meta.tmdbId,
  kind: "released",
  date: null,
  theatricalDate: meta.theatricalDate,
  digitalDate: meta.digitalDate,
  obtainable: true,
});

export function classifyAvailability(meta: TmdbMeta, today = todayString()): AvailabilityVerdict {
  const base = {
    mediaType: meta.mediaType,
    tmdbId: meta.tmdbId,
    theatricalDate: meta.theatricalDate,
    digitalDate: meta.digitalDate,
  };

  if (meta.mediaType === "tv") {
    // Une série dont la diffusion n'a pas commencé n'a aucun épisode à récupérer.
    if (meta.releaseDate && meta.releaseDate > today) {
      return { ...base, kind: "not_aired", date: meta.releaseDate, obtainable: false };
    }
    // Sans date de première diffusion mais annoncée en production : idem.
    const status = (meta.tmdbStatus ?? "").toLowerCase();
    if (!meta.releaseDate && (status === "planned" || status === "in production" || status === "rumored")) {
      return { ...base, kind: "not_aired", date: null, obtainable: false };
    }
    return released(meta);
  }

  /* ── Films ── */

  // Sortie numérique passée : c'est le seul signal qui garantit l'existence
  // d'un fichier. Physique et TV comptent aussi.
  if (meta.digitalDate && meta.digitalDate <= today) return released(meta);
  if (meta.physicalDate && meta.physicalDate <= today) return released(meta);

  // Sortie numérique annoncée : on donne la date, c'est l'information la plus
  // utile qui soit — y compris quand TMDB dit encore « post-production ».
  if (meta.digitalDate) {
    return { ...base, kind: "digital_soon", date: meta.digitalDate, obtainable: false };
  }

  if (meta.theatricalDate) {
    if (meta.theatricalDate <= today) {
      // En salle RÉCEMMENT et rien d'annoncé en ligne : le cas qui piège.
      // Passé la fenêtre, l'absence de date numérique n'est plus un signal.
      if (daysBetween(meta.theatricalDate, today) <= THEATRICAL_WINDOW_DAYS) {
        return { ...base, kind: "theatrical", date: meta.theatricalDate, obtainable: false };
      }
      return released(meta);
    }
    return { ...base, kind: "upcoming", date: meta.theatricalDate, obtainable: false };
  }

  // Aucune date typée : on ne sait pas. On se tait, sauf si la sortie annoncée
  // est encore devant nous — là, c'est certain.
  if (meta.releaseDate && meta.releaseDate > today) {
    return { ...base, kind: "upcoming", date: meta.releaseDate, obtainable: false };
  }

  return released(meta);
}
