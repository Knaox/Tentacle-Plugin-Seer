import { useTranslation } from "react-i18next";
import { useTvSeasonEpisodes } from "../hooks/useTvSeasonEpisodes";
import { formatAirDateShort, relativeAirLabel, daysUntil } from "../utils/episode-dates";

/**
 * Épisodes d'une saison dépliée : numéro, titre, date de diffusion localisée,
 * badge « Dans X jours » pour les épisodes à venir, check pour les diffusés.
 */
export function EpisodeList({ tvId, seasonNumber }: { tvId: number; seasonNumber: number }) {
  const { t } = useTranslation("seer");
  const { data: episodes, isLoading, isError } = useTvSeasonEpisodes(tvId, seasonNumber);

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-9 rounded-lg bg-white/[0.04]"
            style={{
              background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.4s infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (isError || !episodes || episodes.length === 0) {
    return <p className="py-3 text-center text-xs text-white/35">{t("seer:noEpisodeDates")}</p>;
  }

  return (
    <ul className="divide-y divide-white/[0.05]">
      {episodes.map((ep) => {
        const days = daysUntil(ep.airDate);
        const upcoming = days != null && days >= 0;
        const relative = upcoming ? relativeAirLabel(ep.airDate, t) : "";
        return (
          <li key={ep.id} className="flex min-h-[44px] items-center gap-3 py-2">
            <span className={`w-7 flex-shrink-0 text-right text-xs font-semibold tabular-nums ${upcoming ? "text-tentacle-brand-light" : "text-white/35"}`}>
              {ep.episodeNumber}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-xs font-medium ${upcoming ? "text-white" : "text-white/65"}`}>
                {ep.name || t("seer:episodeFallback", { number: ep.episodeNumber })}
              </p>
              {ep.airDate && (
                <p className="text-[11px] text-white/35">{formatAirDateShort(ep.airDate)}</p>
              )}
            </div>
            {upcoming ? (
              <span className="flex-shrink-0 rounded-full bg-tentacle-brand/15 px-2 py-0.5 text-[10px] font-bold text-tentacle-brand-light">
                {relative}
              </span>
            ) : ep.airDate ? (
              <svg className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-label={t("seer:aired")}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <span className="flex-shrink-0 text-[10px] text-white/25">{t("seer:dateTba")}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
