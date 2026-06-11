import { getCurrentLanguage } from "./media-helpers";

/** Minuit local du jour de `d` (compare des JOURS, pas des instants). */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "2026-06-13" → Date locale (évite le décalage UTC d'un `new Date(str)` ISO). */
export function parseAirDate(airDate?: string): Date | null {
  if (!airDate) return null;
  const [y, m, d] = airDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Jours restants avant diffusion : 0 = aujourd'hui, négatif = déjà diffusé. */
export function daysUntil(airDate?: string): number | null {
  const date = parseAirDate(airDate);
  if (!date) return null;
  const ms = startOfDay(date) - startOfDay(new Date());
  return Math.round(ms / 86_400_000);
}

/** Date complète localisée : "vendredi 13 juin 2026" / "Friday, June 13, 2026". */
export function formatAirDateLong(airDate?: string): string {
  const date = parseAirDate(airDate);
  if (!date) return "";
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(date);
}

/** Date courte localisée : "13 juin 2026" / "Jun 13, 2026". */
export function formatAirDateShort(airDate?: string): string {
  const date = parseAirDate(airDate);
  if (!date) return "";
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    day: "numeric", month: "short", year: "numeric",
  }).format(date);
}

/**
 * Libellé relatif i18n : "Aujourd'hui" / "Demain" / "Dans X jours" /
 * "" (déjà diffusé — l'appelant affiche la date). `t` = i18next du namespace seer.
 */
export function relativeAirLabel(airDate: string | undefined, t: (k: string, o?: Record<string, unknown>) => string): string {
  const days = daysUntil(airDate);
  if (days == null || days < 0) return "";
  if (days === 0) return t("seer:airsToday");
  if (days === 1) return t("seer:airsTomorrow");
  return t("seer:airsInDays", { count: days });
}
