import { useTranslation } from "react-i18next";
import { useTvSeasonEpisodes } from "../hooks/useTvSeasonEpisodes";
import { airTimeKey } from "../hooks/useAirTimes";
import {
  formatAirDateShort, formatAirTime, localDayFromUtc, relativeAirLabel, daysUntil,
} from "../utils/episode-dates";

/**
 * Épisodes d'une saison dépliée : numéro, titre, date de diffusion localisée,
 * badge « Dans X jours » pour les épisodes à venir, check pour les diffusés.
 *
 * Quand Sonarr suit la série, la date affichée est la VRAIE : celle de TMDB est
 * celle du fuseau de la chaîne, et tombe souvent un jour trop tard.
 */
interface Props {
  tvId: number;
  seasonNumber: number;
  /** « S1E2 » → instant ISO. Vide quand Sonarr ne connaît pas la série. */
  airTimes?: Map<string, string>;
}

export function EpisodeList({ tvId, seasonNumber, airTimes }: Props) {
  const { t } = useTranslation("seer");
  const { data: episodes, isLoading, isError } = useTvSeasonEpisodes(tvId, seasonNumber);

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        {/* Calque translaté plutôt que `background-position` animée : cette
            dernière repeint à chaque image (règle GPU du projet). */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative h-9 overflow-hidden rounded-lg bg-tentacle-fill-subtle">
            <div
              aria-hidden
              className="absolute inset-y-0 w-1/3"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
                animation: "seerIndeterminate 1.6s ease-in-out infinite",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !episodes || episodes.length === 0) {
    return <p className="py-3 text-center text-xs text-tentacle-text-quaternary">{t("seer:noEpisodeDates")}</p>;
  }

  return (
    <ul className="divide-y divide-tentacle-border-subtle">
      {episodes.map((ep) => {
        const at = airTimes?.get(airTimeKey(ep.seasonNumber ?? seasonNumber, ep.episodeNumber));
        // Le jour réel prime : l'heure de Sonarr peut le faire basculer.
        const airDate = localDayFromUtc(at) ?? ep.airDate;
        const time = formatAirTime(at);
        const days = daysUntil(airDate);
        const upcoming = days != null && days >= 0;
        const relative = upcoming ? relativeAirLabel(airDate, t) : "";
        return (
          <li key={ep.id} className="flex min-h-[44px] items-center gap-3 py-2">
            <span className={`w-7 flex-shrink-0 text-right text-xs font-semibold tabular-nums ${upcoming ? "text-tentacle-brand-light" : "text-tentacle-text-quaternary"}`}>
              {ep.episodeNumber}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-xs font-medium ${upcoming ? "text-tentacle-text-primary" : "text-tentacle-text-secondary"}`}>
                {ep.name || t("seer:episodeFallback", { number: ep.episodeNumber })}
              </p>
              {airDate && (
                <p className="text-[11px] text-tentacle-text-quaternary">
                  {time
                    ? t("seer:episodeAirTime", { date: formatAirDateShort(airDate), time })
                    : formatAirDateShort(airDate)}
                </p>
              )}
            </div>
            {upcoming ? (
              <span className="flex-shrink-0 rounded-full bg-[rgba(var(--brand-rgb),0.15)] px-2 py-0.5 text-[10px] font-bold text-tentacle-brand-light">
                {relative}
              </span>
            ) : airDate ? (
              <svg className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-label={t("seer:aired")}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <span className="flex-shrink-0 text-[10px] text-tentacle-text-disabled">{t("seer:dateTba")}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
