import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GenreFilter } from "./GenreFilter";
import { PlatformFilter } from "./PlatformFilter";
import { YearRangeFilter } from "./YearRangeFilter";
import { RatingSlider } from "./RatingSlider";
import { MOVIE_GENRES, TV_GENRES } from "../constants/genres";
import { LANGUAGES } from "../constants/languages";
import { TV_STATUSES } from "../constants/tv-statuses";
import type { DiscoverMediaType, DiscoverFilters, SortOption, SortOrder, TvStatus } from "../api/types";

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  mediaType: DiscoverMediaType;
  filters: DiscoverFilters;
  onToggleGenre: (id: number) => void;
  onToggleWatchProvider: (id: number) => void;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
  onRatingMinChange: (v: number | null) => void;
  onLanguageChange: (v: string | null) => void;
  onToggleTvStatus: (s: TvStatus) => void;
  onSortByChange: (v: SortOption) => void;
  onSortOrderChange: (v: SortOrder) => void;
  onReset: () => void;
  activeFilterCount: number;
}

const SORT_OPTIONS: { value: SortOption; key: string }[] = [
  { value: "popularity", key: "sortPopularity" },
  { value: "vote_average", key: "sortRating" },
  { value: "release_date", key: "sortRecent" },
  { value: "title", key: "sortTitle" },
];

export function FilterPanel({
  open,
  onClose,
  mediaType,
  filters,
  onToggleGenre,
  onToggleWatchProvider,
  onYearFromChange,
  onYearToChange,
  onRatingMinChange,
  onLanguageChange,
  onToggleTvStatus,
  onSortByChange,
  onSortOrderChange,
  onReset,
  activeFilterCount,
}: FilterPanelProps) {
  const { t } = useTranslation("seer");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const bridge = (window as unknown as Record<string, unknown>).__tentacle_bridge as
      { setOverlay?: (open: boolean) => void } | undefined;
    bridge?.setOverlay?.(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      bridge?.setOverlay?.(false);
    };
  }, [open, onClose]);

  const genres = mediaType === "movies" ? MOVIE_GENRES : TV_GENRES;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            animation: "fadeIn 300ms ease forwards",
          }}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 flex h-full w-full max-w-sm flex-col bg-tentacle-surface-modal transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          zIndex: 101,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.5), -2px 0 8px rgba(0,0,0,0.3)",
          borderLeft: "1px solid var(--border-subtle)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-tentacle-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-tentacle-text-primary">{t("filterTitle")}</h3>
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-tentacle-brand text-[10px] font-bold text-tentacle-cta-brand-fg">
                {activeFilterCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button onClick={onReset} className="text-xs text-tentacle-brand hover:text-tentacle-brand-light">
                {t("resetFilters")}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-tentacle-fill-subtle text-tentacle-text-tertiary hover:text-tentacle-text-primary"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--brand) transparent" }}>
          {/* Sort */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">
              {t("filterSort")}
            </h4>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSortByChange(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    filters.sortBy === opt.value
                      ? "bg-tentacle-cta-primary text-tentacle-cta-primary-fg shadow-sm"
                      : "bg-tentacle-fill-subtle text-tentacle-text-tertiary hover:bg-tentacle-fill-medium hover:text-tentacle-text-secondary"
                  }`}
                >
                  {t(opt.key)}
                </button>
              ))}
              <button
                onClick={() => onSortOrderChange(filters.sortOrder === "desc" ? "asc" : "desc")}
                className="flex items-center gap-1 rounded-lg bg-tentacle-fill-subtle px-2.5 py-1.5 text-xs font-medium text-tentacle-text-tertiary transition-colors hover:bg-tentacle-fill-medium hover:text-tentacle-text-secondary"
                title={filters.sortOrder === "desc" ? t("sortOrderDesc") : t("sortOrderAsc")}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {filters.sortOrder === "desc" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Genres */}
          <GenreFilter genres={genres} selected={filters.genres} onToggle={onToggleGenre} />

          {/* Platforms */}
          <PlatformFilter selected={filters.watchProviders} onToggle={onToggleWatchProvider} />

          {/* Year */}
          <YearRangeFilter
            yearFrom={filters.yearFrom}
            yearTo={filters.yearTo}
            onYearFromChange={onYearFromChange}
            onYearToChange={onYearToChange}
          />

          {/* Rating */}
          <RatingSlider value={filters.ratingMin} onChange={onRatingMinChange} />

          {/* Language */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">
              {t("filterLanguage")}
            </h4>
            <select
              value={filters.originalLanguage ?? ""}
              onChange={(e) => onLanguageChange(e.target.value || null)}
              className="w-full rounded-lg border border-tentacle-border-subtle bg-tentacle-fill-subtle px-3 py-2 text-xs text-tentacle-text-primary outline-none focus:border-[rgba(var(--brand-rgb),0.4)] focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.5)]"
            >
              <option value="" className="bg-tentacle-surface-1">{t("filterLanguageAll")}</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-tentacle-surface-1">
                  {t(l.key)}
                </option>
              ))}
            </select>
          </div>

          {/* TV Status (only for TV) */}
          {mediaType === "tv" && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">
                {t("filterTvStatus")}
              </h4>
              <div className="flex flex-wrap gap-2">
                {TV_STATUSES.map((s) => {
                  const active = filters.tvStatus.includes(s.value as TvStatus);
                  return (
                    <button
                      key={s.value}
                      onClick={() => onToggleTvStatus(s.value as TvStatus)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-[rgba(var(--brand-rgb),0.2)] text-tentacle-brand ring-1 ring-[rgba(var(--brand-rgb),0.5)]"
                          : "bg-tentacle-fill-subtle text-tentacle-text-tertiary hover:bg-tentacle-fill-medium hover:text-tentacle-text-secondary"
                      }`}
                    >
                      {t(s.key)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
