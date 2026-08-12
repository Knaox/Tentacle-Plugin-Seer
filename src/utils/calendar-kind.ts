import type { CalendarKind } from "../api/types-releases";
import { STATUS_STYLE } from "../styles/status";

/**
 * Chaque type de sortie emprunte une teinte du dictionnaire de statuts du
 * plugin : aucune nouvelle variable de couleur, et le thème clair comme le
 * thème sombre sont pris en charge sans travail supplémentaire.
 */
export const KIND_STYLE: Record<CalendarKind, { chip: string; dot: string }> = {
  digital: { chip: STATUS_STYLE.available.chip, dot: STATUS_STYLE.available.solid },
  theatrical: { chip: STATUS_STYLE.retry_pending.chip, dot: STATUS_STYLE.retry_pending.solid },
  physical: { chip: STATUS_STYLE.queued.chip, dot: STATUS_STYLE.queued.solid },
  episode: { chip: STATUS_STYLE.downloading.chip, dot: STATUS_STYLE.downloading.solid },
  premiere: { chip: STATUS_STYLE.approved.chip, dot: STATUS_STYLE.approved.solid },
};

export const KIND_I18N: Record<CalendarKind, string> = {
  digital: "seer:releasesKindDigital",
  theatrical: "seer:releasesKindTheatrical",
  physical: "seer:releasesKindPhysical",
  episode: "seer:releasesKindEpisode",
  premiere: "seer:releasesKindPremiere",
};

/** « S2E5 » — vide pour un film. */
export function episodeLabel(season: number | null, episode: number | null): string {
  if (season == null && episode == null) return "";
  if (season != null && episode != null) return `S${season}E${episode}`;
  if (season != null) return `S${season}`;
  return `E${episode}`;
}
