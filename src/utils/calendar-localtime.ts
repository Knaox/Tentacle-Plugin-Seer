import type { CalendarItem } from "../api/types-releases";
import { localDayFromUtc } from "./episode-dates";

/**
 * Range chaque épisode au jour où il sort VRAIMENT chez celui qui regarde.
 *
 * La date de TMDB est celle du fuseau de la chaîne d'origine : un épisode
 * annoncé le 14 août est diffusé le 13 à 17 h 15 à Paris. L'agenda le plaçait
 * donc systématiquement un jour trop tard pour les séries japonaises.
 *
 * Point d'application UNIQUE, à l'entrée de la page : les vues semaine et mois,
 * comme le repli des saisons, continuent de grouper sur `item.date` sans avoir
 * à connaître l'existence des fuseaux horaires.
 */
export function applyLocalDays(items: readonly CalendarItem[]): CalendarItem[] {
  let changed = false;
  const out = items.map((item) => {
    const day = localDayFromUtc(item.airDateUtc);
    if (!day || day === item.date) return item;
    changed = true;
    // L'identifiant porte la date : le laisser tel quel ferait deux entrées
    // pour le même épisode d'un rafraîchissement à l'autre.
    return { ...item, date: day, id: item.id.replace(/:[^:]+$/, `:${day}`) };
  });
  /* Rien à corriger : on rend le tableau d'origine, pour ne pas invalider les
   * mémorisations des vues à chaque rendu. */
  return changed ? out : (items as CalendarItem[]);
}
