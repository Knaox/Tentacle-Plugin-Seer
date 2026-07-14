import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { MediaTabBar } from "./MediaTabBar";
import { ActiveFilterPills } from "./ActiveFilterPills";
import { BlockedResultsBanner } from "./BlockedResultsBanner";
import type { DiscoverMediaType, DiscoverFilters, TvStatus } from "../api/types";

interface DiscoverSearchHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  isSearching: boolean;
  mediaType: DiscoverMediaType;
  onTabChange: (value: DiscoverMediaType) => void;
  onOpenFilterPanel: () => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  totalResults: number | null | undefined;
  isLoading: boolean;
  filters: DiscoverFilters;
  onRemoveGenre: (id: number) => void;
  onRemoveWatchProvider: (id: number) => void;
  onClearYears: () => void;
  onClearRating: () => void;
  onClearLanguage: () => void;
  onRemoveTvStatus: (s: TvStatus) => void;
  showBlockedBanner: boolean;
  blockedCount: number;
  showBlocked: boolean;
  onToggleShowBlocked: () => void;
}

/**
 * En-tête de la page Discover : barre de recherche, onglets média + bouton
 * filtres, pastilles de filtres actifs, bandeau « contenu masqué ». Extrait de
 * DiscoverPage pour rester sous 300 lignes — extraction pure, aucun changement
 * de comportement.
 */
export function DiscoverSearchHeader({
  query, onQueryChange, searchInputRef,
  isSearching, mediaType, onTabChange, onOpenFilterPanel,
  activeFilterCount, hasActiveFilters, onResetFilters,
  totalResults, isLoading,
  filters, onRemoveGenre, onRemoveWatchProvider, onClearYears, onClearRating, onClearLanguage, onRemoveTvStatus,
  showBlockedBanner, blockedCount, showBlocked, onToggleShowBlocked,
}: DiscoverSearchHeaderProps) {
  const { t } = useTranslation("seer");

  return (
    <>
      {/* Search bar */}
      <div className="relative mb-4 rounded-xl bg-tentacle-fill-subtle backdrop-blur-xl">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-tentacle-text-quaternary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("seer:searchPlaceholder")}
          className="w-full rounded-xl border border-tentacle-border-subtle bg-transparent py-3 pl-12 pr-24 text-sm text-tentacle-text-primary placeholder-tentacle-text-quaternary outline-none transition-all focus:border-tentacle-brand/30 focus:ring-2 focus:ring-tentacle-brand/50 focus:shadow-lg focus:shadow-tentacle-brand/5"
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            className="absolute right-16 top-1/2 -translate-y-1/2 text-tentacle-text-quaternary transition-colors hover:text-tentacle-text-secondary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {typeof navigator !== "undefined" && navigator.maxTouchPoints === 0 && !/Mobi|Android/i.test(navigator.userAgent) && (
          <kbd className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded border border-tentacle-border-subtle bg-tentacle-fill-subtle px-1.5 py-0.5 text-[10px] text-tentacle-text-quaternary">
            Ctrl+K
          </kbd>
        )}
      </div>

      {/* Tabs + Filter button row */}
      {!isSearching && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <MediaTabBar value={mediaType} onChange={onTabChange} />

          <button
            onClick={onOpenFilterPanel}
            className="relative flex items-center gap-1.5 rounded-lg border border-tentacle-border-subtle bg-tentacle-fill-subtle px-3 py-1.5 text-xs font-medium text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-medium hover:text-tentacle-text-secondary"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            {t("filterTitle")}
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-tentacle-brand text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-tentacle-text-quaternary transition-colors hover:text-tentacle-text-secondary"
            >
              {t("resetFilters")}
            </button>
          )}

          {totalResults != null && !isLoading && hasActiveFilters && (
            <span className="ml-auto text-xs text-tentacle-text-quaternary">
              {t("resultCount", { count: totalResults })}
            </span>
          )}
        </div>
      )}

      {/* Active filter pills */}
      {!isSearching && (
        <ActiveFilterPills
          mediaType={mediaType}
          filters={filters}
          totalResults={undefined}
          onRemoveGenre={onRemoveGenre}
          onRemoveWatchProvider={onRemoveWatchProvider}
          onClearYears={onClearYears}
          onClearRating={onClearRating}
          onClearLanguage={onClearLanguage}
          onRemoveTvStatus={onRemoveTvStatus}
          onReset={onResetFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {/* Bandeau « contenu masqué · afficher quand même » */}
      {showBlockedBanner && (
        <BlockedResultsBanner
          blockedCount={blockedCount}
          showBlocked={showBlocked}
          onToggle={onToggleShowBlocked}
        />
      )}
    </>
  );
}
