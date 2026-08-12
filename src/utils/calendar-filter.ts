import type { CalendarItem, CalendarMediaFilter, ReleasesSort } from "../api/types-releases";

/**
 * Filtrer et ordonner un agenda.
 *
 * Deux règles gouvernent tout ce fichier.
 *
 * **Un critère inconnu n'exclut jamais.** Les fiches enregistrées avant que le
 * serveur ne retienne la note, la langue ou le genre n'en portent aucun, et le
 * remplissage de fond met des heures à repasser une grosse instance. Traiter
 * l'absence comme un refus viderait l'agenda pendant tout ce temps, sur une
 * page où le vide se lit comme une panne.
 *
 * **Le tri est INTRA-JOUR.** Un agenda se lit par date : réordonner globalement
 * par note produirait un calendrier où le 3 septembre précède le 12 août. La
 * date reste donc la clé primaire, et le critère choisi ne départage que les
 * sorties d'une même journée. C'est en vue mois que cela compte vraiment, où
 * une case n'affiche que les premières avant un « +N ».
 */

export interface ReleasesFilterState {
  providerIds: readonly number[];
  mediaFilter: CalendarMediaFilter;
  ratingMin: number | null;
  originalLanguage: string | null;
  /** Mode « Tout » seulement : ne garder que ce qui a été demandé. */
  requestedOnly: boolean;
  sortBy: ReleasesSort;
}

export const DEFAULT_RELEASES_FILTERS: ReleasesFilterState = {
  providerIds: [],
  mediaFilter: "both",
  ratingMin: null,
  originalLanguage: null,
  requestedOnly: false,
  sortBy: "date",
};

/** Le type demandé, sachant qu'un animé reste une série pour le serveur. */
function matchesType(item: CalendarItem, filtre: CalendarMediaFilter): boolean {
  if (filtre === "both") return true;
  if (filtre === "anime") return item.isAnime === true;
  return item.mediaType === filtre;
}

export function matchesReleaseFilters(item: CalendarItem, f: ReleasesFilterState): boolean {
  if (!matchesType(item, f.mediaFilter)) return false;

  // Un OU : cocher Netflix et Disney+ montre ce qui est sur l'une ou l'autre.
  if (f.providerIds.length > 0) {
    if (!item.providerIds.some((id) => f.providerIds.includes(id))) return false;
  }

  // Note ou langue inconnues : on n'en sait rien, on ne prétend pas le contraire.
  if (f.ratingMin != null && item.voteAverage != null && item.voteAverage < f.ratingMin) {
    return false;
  }
  if (f.originalLanguage && item.originalLanguage && item.originalLanguage !== f.originalLanguage) {
    return false;
  }
  if (f.requestedOnly && !item.requestStatus) return false;

  return true;
}

/** Départage DEUX SORTIES DU MÊME JOUR. Jamais deux dates différentes. */
export function compareInDay(a: CalendarItem, b: CalendarItem, sortBy: ReleasesSort): number {
  switch (sortBy) {
    case "popularity":
      return (b.popularity ?? -1) - (a.popularity ?? -1) || a.title.localeCompare(b.title);
    case "rating":
      return (b.voteAverage ?? -1) - (a.voteAverage ?? -1) || a.title.localeCompare(b.title);
    case "title":
    case "date":
    default:
      return a.title.localeCompare(b.title);
  }
}

/**
 * Tri complet, date d'abord.
 *
 * COPIE l'entrée. Le tri du serveur, lui, modifie son argument sur place — le
 * refaire ici reviendrait à réécrire l'objet du cache de requêtes, et revenir
 * au tri par titre ne restaurerait plus rien.
 */
export function sortReleases(
  items: readonly CalendarItem[],
  sortBy: ReleasesSort,
): CalendarItem[] {
  return [...items].sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : compareInDay(a, b, sortBy)),
  );
}

export function activeReleasesFilterCount(f: ReleasesFilterState): number {
  return (
    (f.providerIds.length > 0 ? 1 : 0) +
    (f.mediaFilter === "both" ? 0 : 1) +
    (f.ratingMin != null ? 1 : 0) +
    (f.originalLanguage ? 1 : 0) +
    (f.requestedOnly ? 1 : 0)
  );
}
