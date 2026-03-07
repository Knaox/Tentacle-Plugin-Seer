import { useTranslation } from "react-i18next";
import { MOVIE_GENRES, TV_GENRES } from "../constants/genres";
import { LANGUAGES } from "../constants/languages";
import { TV_STATUSES } from "../constants/tv-statuses";
import { PLATFORMS } from "../utils/platforms";
import type { DiscoverMediaType, DiscoverFilters, TvStatus } from "../api/types";

interface ActiveFilterPillsProps {
  mediaType: DiscoverMediaType;
  filters: DiscoverFilters;
  totalResults: number | undefined;
  onRemoveGenre: (id: number) => void;
  onRemoveWatchProvider: (id: number) => void;
  onClearYears: () => void;
  onClearRating: () => void;
  onClearLanguage: () => void;
  onRemoveTvStatus: (s: TvStatus) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}

function Pill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#8b5cf6]/15 px-2.5 py-1 text-[11px] font-medium text-[#8b5cf6]">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-white">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

export function ActiveFilterPills({
  mediaType,
  filters,
  totalResults,
  onRemoveGenre,
  onRemoveWatchProvider,
  onClearYears,
  onClearRating,
  onClearLanguage,
  onRemoveTvStatus,
  onReset,
  hasActiveFilters,
}: ActiveFilterPillsProps) {
  const { t } = useTranslation("seer");

  if (!hasActiveFilters) return null;

  const genres = mediaType === "movies" ? MOVIE_GENRES : TV_GENRES;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {/* Result count */}
      {totalResults != null && (
        <span className="mr-1 text-xs font-medium text-white/40">
          {t("resultCount", { count: totalResults })}
        </span>
      )}

      {/* Genre pills */}
      {filters.genres.map((gId) => {
        const genre = genres.find((g) => g.id === gId);
        return genre ? (
          <Pill key={`g-${gId}`} label={t(genre.key)} onRemove={() => onRemoveGenre(gId)} />
        ) : null;
      })}

      {/* Platform pills */}
      {filters.watchProviders.map((pId) => {
        const platform = PLATFORMS.find((p) => p.id === pId);
        return platform ? (
          <Pill key={`p-${pId}`} label={platform.name} onRemove={() => onRemoveWatchProvider(pId)} />
        ) : null;
      })}

      {/* Year pill */}
      {(filters.yearFrom != null || filters.yearTo != null) && (
        <Pill
          label={`${filters.yearFrom ?? "..."} - ${filters.yearTo ?? "..."}`}
          onRemove={onClearYears}
        />
      )}

      {/* Rating pill */}
      {filters.ratingMin != null && (
        <Pill label={`${filters.ratingMin.toFixed(1)}+`} onRemove={onClearRating} />
      )}

      {/* Language pill */}
      {filters.originalLanguage && (
        <Pill
          label={t(LANGUAGES.find((l) => l.code === filters.originalLanguage)?.key ?? "langEnglish")}
          onRemove={onClearLanguage}
        />
      )}

      {/* TV status pills (only on TV tab) */}
      {mediaType === "tv" && filters.tvStatus.map((s) => {
        const status = TV_STATUSES.find((ts) => ts.value === s);
        return status ? (
          <Pill key={`s-${s}`} label={t(status.key)} onRemove={() => onRemoveTvStatus(s)} />
        ) : null;
      })}

      {/* Reset all */}
      <button
        onClick={onReset}
        className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white/30 transition-colors hover:text-white/60"
      >
        {t("resetFilters")}
      </button>
    </div>
  );
}
