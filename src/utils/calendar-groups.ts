import type { CalendarItem } from "../api/types-releases";
import { parseAirDate, formatAirDateLong } from "./episode-dates";
import { getCurrentLanguage } from "./media-helpers";

/**
 * Toutes les dates sont des chaînes 'YYYY-MM-DD'. On ne les convertit jamais
 * avec `new Date(chaîne)` — cette forme est lue en temps universel et décale
 * l'affichage d'un jour en soirée. `parseAirDate` fait le découpage manuel.
 */

export interface DayGroup {
  date: string;
  items: CalendarItem[];
}

export function groupByDay(items: readonly CalendarItem[]): DayGroup[] {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const bucket = map.get(item.date);
    if (bucket) bucket.push(item);
    else map.set(item.date, [item]);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, list]) => ({ date, items: list }));
}

/** Aujourd'hui en 'YYYY-MM-DD' local. */
export function today(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function addDays(day: string, delta: number): string {
  const parsed = parseAirDate(day);
  if (!parsed) return day;
  const next = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + delta);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${next.getFullYear()}-${p(next.getMonth() + 1)}-${p(next.getDate())}`;
}

/** En-tête de jour : « Aujourd'hui », « Demain », sinon la date complète. */
export function dayHeading(
  date: string,
  t: (k: string) => string,
): string {
  const ref = today();
  if (date === ref) return t("seer:releasesToday");
  if (date === addDays(ref, 1)) return t("seer:releasesTomorrow");
  return formatAirDateLong(date);
}

/** « août 2026 » — séparateur de mois dans la liste. */
export function monthHeading(date: string): string {
  const parsed = parseAirDate(date);
  if (!parsed) return "";
  return new Intl.DateTimeFormat(getCurrentLanguage(), { month: "long", year: "numeric" }).format(parsed);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/**
 * Matrice d'un mois pour la vue grille : semaines commençant le lundi,
 * cellules des mois voisins comprises pour que la grille reste pleine.
 */
export function monthMatrix(year: number, month: number): string[][] {
  const first = new Date(year, month, 1);
  // getDay() : 0 = dimanche. On veut lundi en tête.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);

  const p = (n: number) => String(n).padStart(2, "0");
  const weeks: string[][] = [];

  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      week.push(`${cur.getFullYear()}-${p(cur.getMonth() + 1)}-${p(cur.getDate())}`);
    }
    weeks.push(week);
    // Six lignes ne sont nécessaires que pour les mois qui débordent vraiment.
    const last = week[6];
    if (w >= 4 && Number(last.slice(5, 7)) !== month + 1) break;
  }
  return weeks;
}

/** Initiales des jours de la semaine, lundi d'abord, dans la langue courante. */
export function weekdayInitials(): string[] {
  const fmt = new Intl.DateTimeFormat(getCurrentLanguage(), { weekday: "short" });
  // 2024-01-01 était un lundi.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
}
