import { getCurrentLanguage } from "./media-helpers";

const UNITS = ["o", "Ko", "Mo", "Go", "To"];
const UNITS_EN = ["B", "KB", "MB", "GB", "TB"];

/** « 12,4 Go » / « 12.4 GB ». Base 1000, comme l'affichent Sonarr et Radarr. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "";
  const lang = getCurrentLanguage();
  const units = lang.startsWith("fr") ? UNITS : UNITS_EN;

  let value = bytes;
  let i = 0;
  while (value >= 1000 && i < units.length - 1) {
    value /= 1000;
    i++;
  }
  const digits = value < 10 && i > 0 ? 1 : 0;
  return `${value.toLocaleString(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[i]}`;
}

/**
 * « 18 min », « 2 h 05 », « 3 j ». Volontairement approximatif : Sonarr révise
 * son estimation en permanence, afficher les secondes donnerait une fausse
 * impression de précision.
 */
export function formatEta(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "";
  const lang = getCurrentLanguage();
  const fr = lang.startsWith("fr");

  if (seconds < 60) return fr ? "< 1 min" : "< 1 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return `${hours} h${rest > 0 ? ` ${String(rest).padStart(2, "0")}` : ""}`;

  const days = Math.round(hours / 24);
  return fr ? `${days} j` : `${days} d`;
}
