/* ------------------------------------------------------------------ */
/*  Seer Plugin — « Est-ce que c'est vraiment sorti, et par où ? »      */
/* ------------------------------------------------------------------ */

/*
 * Le problème : une carte affiche « 2026 » sans dire si le titre est annoncé,
 * au cinéma, ou réellement récupérable. On demande, il ne se passe rien, et on
 * ne comprend pas pourquoi.
 *
 * La réponse est dans les dates de sortie TYPÉES de TMDB. Trois canaux
 * cohabitent — salle, numérique, physique — et ils ne s'excluent PAS : un film
 * peut être encore à l'affiche et déjà pressé en Blu-ray. La première version
 * de ce fichier rendait un verdict unique ; elle taisait donc l'information la
 * plus utile, et pire, un film sorti en Blu-ray retombait sur « récupérable »,
 * c'est-à-dire sur AUCUNE pastille. On énumère désormais tous les canaux
 * connus et on laisse l'affichage décider combien il en montre.
 *
 * Deux règles de prudence, inchangées :
 *
 *   1. On ne dit JAMAIS « disponible ». Ce mot est déjà pris : sur Mes demandes
 *      il signifie « téléchargé, dans ta bibliothèque ». On nomme le canal
 *      (« En Blu-ray », « En ligne »), jamais un état de bibliothèque.
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

/*
 * Fenêtre de PERTINENCE d'un canal déjà sorti. Personne ne se demande si
 * « Fight Club » est pressé en Blu-ray : l'annoncer sur chaque fiche de plus de
 * vingt ans transformerait la grille en mur de pastilles inutiles.
 *
 * Quatre mois, soit à peu près le délai salle → vidéo : c'est la durée pendant
 * laquelle « c'est tout juste sorti » apprend encore quelque chose. Mesuré sur
 * le catalogue de l'instance (366 films) : 14 % des fiches portent alors une
 * mention, contre 25 % à un an — à ce niveau-là ce n'est plus un signal.
 * Passé ce délai on se tait, mais le titre reste « probablement récupérable »
 * (cf. outlookOf, qui lit les dates brutes et ignore cette fenêtre).
 */
const RECENT_WINDOW_DAYS = 120;

/** Différence en jours entre deux dates 'YYYY-MM-DD', sans passer par UTC. */
function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const a = new Date(ay, am - 1, ad).getTime();
  const b = new Date(by, bm - 1, bd).getTime();
  return Math.round((b - a) / 86_400_000);
}

export type AvailabilityKind =
  /** Récupérable, sans rien de plus à dire — aucune pastille. */
  | "released"
  /** Sortie numérique connue et à venir. */
  | "digital_soon"
  /** En salle, aucune sortie numérique annoncée. */
  | "theatrical"
  /** Pas encore sorti, date connue. */
  | "upcoming"
  /** Série dont la diffusion n'a pas commencé. */
  | "not_aired";

export type ChannelId = "theatrical" | "digital" | "physical" | "streaming";

/**
 * Un canal connu.
 *
 * `streaming` est le seul sans date : il ne décrit pas une sortie mais un état
 * présent — « c'est sur une plateforme d'abonnement en ce moment ». C'est
 * souvent la seule chose qu'on sache d'une série ou d'un titre ancien, et c'est
 * précisément celle qui manquait : les séries n'avaient aucun canal du tout.
 */
export interface AvailabilityChannel {
  id: ChannelId;
  /** 'YYYY-MM-DD', ou null pour un canal sans date de sortie. */
  date: string | null;
  released: boolean;
}

/**
 * Les chances qu'un fichier existe quelque part. Volontairement à trois
 * niveaux et sans chiffre : on ne promet rien, on oriente.
 */
export type AvailabilityOutlook = "likely" | "unlikely" | "not_yet";

export interface AvailabilityVerdict {
  mediaType: "movie" | "tv";
  tmdbId: number;
  /** Canaux connus, le plus probant d'abord. Vide = rien à dire. */
  channels: AvailabilityChannel[];
  outlook: AvailabilityOutlook;
  /** Plateformes d'abonnement — déjà en cache, aucun appel de plus. */
  providerIds: number[];
  /** Canal principal, dans le vocabulaire d'origine. */
  kind: AvailabilityKind;
  /** Date à afficher, si elle existe. Toujours 'YYYY-MM-DD'. */
  date: string | null;
  theatricalDate: string | null;
  digitalDate: string | null;
  physicalDate: string | null;
  /** Une demande a-t-elle une chance d'aboutir maintenant ? */
  obtainable: boolean;
}

/*
 * Ordre de mention. Un canal SORTI prime toujours sur un canal à venir, et
 * entre deux canaux sortis on cite d'abord celui qui rend le titre récupérable :
 * le physique et le numérique garantissent l'existence d'un fichier, la salle
 * non. Entre deux canaux à venir, la date la plus proche gagne.
 */
const RANK: Record<ChannelId, number> = { physical: 0, digital: 1, streaming: 2, theatrical: 3 };

function buildChannels(meta: TmdbMeta, today: string): AvailabilityChannel[] {
  const raw: Array<[ChannelId, string | null]> = [
    ["physical", meta.physicalDate],
    ["digital", meta.digitalDate],
    ["theatrical", meta.theatricalDate],
  ];

  const channels: AvailabilityChannel[] = [];
  for (const [id, date] of raw) {
    if (!date) continue;
    const released = date <= today;
    if (released) {
      /* Une salle ouverte il y a deux ans n'apprend plus rien, et l'absence de
       * date numérique n'est alors plus un signal. Les autres canaux se taisent
       * plus tard, mais ils se taisent aussi. */
      const window = id === "theatrical" ? THEATRICAL_WINDOW_DAYS : RECENT_WINDOW_DAYS;
      if (daysBetween(date, today) > window) continue;
    }
    channels.push({ id, date, released });
  }

  /*
   * Présent sur une plateforme d'abonnement : un fait d'aujourd'hui, que la
   * fenêtre de pertinence ne concerne pas. Sans lui, un titre ancien ou une
   * série — qui n'a jamais de date typée — n'affichait rien du tout alors que
   * les logos des plateformes s'alignaient juste à côté.
   *
   * On ne le dit PAS quand une sortie numérique récente est déjà annoncée :
   * les deux nommeraient la même chose.
   */
  const hasDigital = channels.some((c) => c.id === "digital" && c.released);
  if (!hasDigital && (meta.providerIds?.length ?? 0) > 0) {
    channels.push({ id: "streaming", date: null, released: true });
  }

  return channels.sort((a, b) => {
    if (a.released !== b.released) return a.released ? -1 : 1;
    if (a.released) return RANK[a.id] - RANK[b.id];
    return (a.date ?? "").localeCompare(b.date ?? "");
  });
}

/** Le canal principal, traduit dans le vocabulaire d'origine de la pastille. */
function kindOf(channels: AvailabilityChannel[], meta: TmdbMeta, today: string): AvailabilityKind {
  const first = channels[0];
  if (!first) {
    return meta.releaseDate && meta.releaseDate > today ? "upcoming" : "released";
  }
  if (first.released) return first.id === "theatrical" ? "theatrical" : "released";
  return first.id === "digital" ? "digital_soon" : "upcoming";
}

/*
 * On lit ici les dates BRUTES, pas les canaux : un film ressorti en salle cette
 * année reste évidemment récupérable si son Blu-ray date de 2010, alors que ce
 * canal-là est trop vieux pour être encore mentionné.
 */
function outlookOf(meta: TmdbMeta, today: string, channels: AvailabilityChannel[]): AvailabilityOutlook {
  /* Un fichier n'existe de façon sûre qu'à partir d'une sortie hors salle —
   * ou d'une mise en ligne sur une plateforme, qui la vaut bien. */
  const outOfTheaters =
    (meta.digitalDate != null && meta.digitalDate <= today) ||
    (meta.physicalDate != null && meta.physicalDate <= today) ||
    (meta.providerIds?.length ?? 0) > 0;
  if (outOfTheaters) return "likely";
  if (channels.some((c) => c.released)) return "unlikely";
  /* Aucun canal du tout : titre ancien sans dates typées, donc récupérable. */
  return channels.length === 0 ? "likely" : "not_yet";
}

export function classifyAvailability(meta: TmdbMeta, today = todayString()): AvailabilityVerdict {
  const base = {
    mediaType: meta.mediaType,
    tmdbId: meta.tmdbId,
    theatricalDate: meta.theatricalDate,
    digitalDate: meta.digitalDate,
    physicalDate: meta.physicalDate,
    providerIds: meta.providerIds ?? [],
  };

  if (meta.mediaType === "tv") {
    /* Une série n'a pas de dates typées — mais elle est souvent sur une
     * plateforme, et c'était le grand absent : les animés en cours de
     * diffusion n'affichaient rien, logos alignés juste à côté. */
    const notAired =
      (meta.releaseDate && meta.releaseDate > today) ||
      (!meta.releaseDate && isPlanned(meta.tmdbStatus));

    return {
      ...base,
      // Rien qui ne soit pas encore diffusé ne peut être « en streaming ».
      channels: notAired ? [] : buildChannels(meta, today),
      outlook: notAired ? "not_yet" : "likely",
      kind: notAired ? "not_aired" : "released",
      date: notAired ? meta.releaseDate : null,
      obtainable: !notAired,
    };
  }

  /* ── Films ── */

  const channels = buildChannels(meta, today);
  const kind = kindOf(channels, meta, today);
  const outlook = outlookOf(meta, today, channels);

  /* La date affichée est celle du canal mis en avant ; sans canal, la sortie
   * annoncée reste la seule information — et seulement si elle est devant nous. */
  const date =
    channels[0]?.date ??
    (meta.releaseDate && meta.releaseDate > today ? meta.releaseDate : null);

  return {
    ...base,
    channels,
    outlook,
    kind,
    date: kind === "released" && channels.length === 0 ? null : date,
    obtainable: outlook === "likely",
  };
}

/** Statuts TMDB d'une série dont la diffusion n'a pas commencé. */
function isPlanned(tmdbStatus: string | null): boolean {
  const status = (tmdbStatus ?? "").toLowerCase();
  return status === "planned" || status === "in production" || status === "rumored";
}
