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
 * Jour LOCAL d'un instant ISO, en 'YYYY-MM-DD'.
 *
 * C'est la correction qui compte : la date de TMDB est celle du fuseau de la
 * chaîne d'origine. Un épisode annoncé le 14 août sort en réalité le 13 à
 * 17 h 15 à Paris — l'agenda le rangeait donc un jour trop tard. Le calcul se
 * fait ici, côté navigateur : lui seul connaît le fuseau du spectateur.
 */
export function localDayFromUtc(iso?: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Heure locale localisée : "17:15" / "5:15 PM". Vide si l'instant est absent. */
export function formatAirTime(iso?: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    hour: "numeric", minute: "2-digit",
  }).format(at);
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
