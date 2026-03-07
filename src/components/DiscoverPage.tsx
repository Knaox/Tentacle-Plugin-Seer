import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTrending } from "../hooks/useDiscoverMedia";
import { useInfiniteDiscover } from "../hooks/useInfiniteDiscover";
import { useDiscoverFilters } from "../hooks/useDiscoverFilters";
import { useSeerSearch } from "../hooks/useSearch";
import { useRequestMedia } from "../hooks/useRequestMedia";
import type { RequestMediaPayload } from "../hooks/useRequestMedia";
import { MediaCard } from "./MediaCard";
import { MediaTabBar } from "./MediaTabBar";
import { FilterPanel } from "./FilterPanel";
import { ActiveFilterPills } from "./ActiveFilterPills";
import { HeroCarousel } from "./HeroCarousel";
import { MediaDetailModal } from "./MediaDetailModal";
import { SkeletonList } from "./SkeletonList";
import { EmptyState } from "./EmptyState";
import { mediaTitle, mediaYear } from "../utils/media-helpers";
import { useToast } from "../hooks/useToast";
import type { SeerrSearchResult, DiscoverMediaType } from "../api/types";

export function DiscoverPage() {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mediaType, setMediaType] = useState<DiscoverMediaType>("movies");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SeerrSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const savedScrollY = useRef(0);
  const [viewKey, setViewKey] = useState(0);

  const {
    filters, toggleGenre, toggleWatchProvider,
    setYearFrom, setYearTo, setRatingMin, setOriginalLanguage,
    toggleTvStatus, setSortBy, setSortOrder,
    resetFilters, resetGenres, activeFilterCount, hasActiveFilters,
  } = useDiscoverFilters();

  // Reset genres + tvStatus when switching tabs (different IDs for movies vs TV)
  const handleTabChange = useCallback((newType: DiscoverMediaType) => {
    if (newType !== mediaType) {
      resetGenres();
      setMediaType(newType);
      setViewKey((k) => k + 1);
    }
  }, [mediaType, resetGenres]);

  const openModal = useCallback((item: SeerrSearchResult) => {
    savedScrollY.current = window.scrollY;
    setSelectedItem(item);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedItem(null);
    requestAnimationFrame(() => window.scrollTo(0, savedScrollY.current));
  }, []);

  // Hero uses trending
  const { data: trendingData, isError: trendingError } = useTrending(1);

  // Seerr-style infinite discover
  const {
    titles,
    isLoadingInitialData,
    isLoadingMore,
    isEmpty,
    isReachingEnd,
    fetchMore,
    totalResults,
    isError,
    error,
    refetch,
  } = useInfiniteDiscover(mediaType, filters);

  const { data: searchData, isLoading: searchLoading } = useSeerSearch(debouncedQuery, 1);
  const requestMedia = useRequestMedia();

  const isSearching = debouncedQuery.length >= 2;
  const isLoading = isSearching ? searchLoading : isLoadingInitialData;
  const hasError = isError || trendingError;
  const errorMessage = error?.message || "";

  const rawResults = isSearching ? (searchData?.results ?? []) : titles;
  const filtered = rawResults.filter((item) => item.mediaType !== "person");

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Seerr-style scroll: IntersectionObserver at 800px from bottom
  useEffect(() => {
    if (isSearching || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchMore();
      },
      { rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [isSearching, fetchMore]);

  const handleRequest = useCallback((item: SeerrSearchResult) => {
    if (item.mediaType === "movie" || item.mediaType === "tv") {
      const payload: RequestMediaPayload = {
        mediaType: item.mediaType,
        tmdbId: item.id,
        title: mediaTitle(item) || t("seer:untitled"),
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        overview: item.overview,
        year: mediaYear(item),
      };
      requestMedia.mutate(payload, {
        onSuccess: () => toast.show("success", t("requestAdded")),
        onError: () => toast.show("error", t("requestError")),
      });
    }
  }, [requestMedia, toast, t]);

  return (
    <div className="px-4 pt-4 md:px-8">
      {/* Hero Carousel — always rendered; dimmed + blurred when searching */}
      {trendingData?.results && (
        <div className="-mx-4 -mt-4 mb-6 md:-mx-8 relative">
          <div
            className="transition-all duration-300"
            style={isSearching ? { filter: "blur(4px) brightness(0.3)", pointerEvents: "none", maxHeight: "200px", opacity: 0.5 } : { maxHeight: "500px", opacity: 1 }}
          >
            <HeroCarousel
              items={trendingData.results}
              onSelect={openModal}
              onRequest={handleRequest}
            />
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-4 rounded-xl bg-white/5 backdrop-blur-xl">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("seer:searchPlaceholder")}
          className="w-full rounded-xl border border-white/5 bg-transparent py-3 pl-12 pr-24 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-purple-500/30 focus:ring-2 focus:ring-purple-500/50 focus:shadow-lg focus:shadow-purple-500/5"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-16 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/60"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <kbd className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30">
          Ctrl+K
        </kbd>
      </div>

      {/* Tabs + Filter button row */}
      {!isSearching && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <MediaTabBar value={mediaType} onChange={handleTabChange} />

          <button
            onClick={() => setFilterPanelOpen(true)}
            className="relative flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            {t("filterTitle")}
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#8b5cf6] text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/30 transition-colors hover:text-white/60"
            >
              {t("resetFilters")}
            </button>
          )}

          {totalResults != null && !isLoading && hasActiveFilters && (
            <span className="ml-auto text-xs text-white/30">
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
          onRemoveGenre={toggleGenre}
          onRemoveWatchProvider={toggleWatchProvider}
          onClearYears={() => { setYearFrom(null); setYearTo(null); }}
          onClearRating={() => setRatingMin(null)}
          onClearLanguage={() => setOriginalLanguage(null)}
          onRemoveTvStatus={toggleTvStatus}
          onReset={resetFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {/* Results */}
      <div key={viewKey} style={{ animation: "viewCrossfade 200ms ease" }}>
      {isLoading ? (
        <SkeletonList count={20} />
      ) : hasError && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <svg className="h-10 w-10 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-sm font-medium text-white/60">{t("seer:connectionError")}</p>
          {errorMessage && (
            <p className="max-w-md text-center text-xs text-white/30">{errorMessage}</p>
          )}
          <button
            onClick={() => { refetch(); }}
            className="mt-2 rounded-lg bg-purple-600/80 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-600"
          >
            {t("seer:retry")}
          </button>
        </div>
      ) : filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((item, i) => (
              <MediaCard
                key={`${item.mediaType}-${item.id}`}
                item={item}
                onRequest={handleRequest}
                onClick={openModal}
                requesting={requestMedia.isPending}
                style={{
                  opacity: 0,
                  animation: `fadeSlideUp 400ms cubic-bezier(0.25,0.46,0.45,0.94) ${Math.min(i, 19) * 50}ms forwards`,
                }}
              />
            ))}
          </div>

          {/* Sentinel + loading skeletons (like Seerr's 20 placeholder cards) */}
          {!isSearching && (
            <div ref={sentinelRef} className="pt-4">
              {isLoadingMore && !isReachingEnd && <SkeletonList count={20} />}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title={isSearching ? t("seer:noResults") : t("seer:noContent")}
          subtitle={isSearching ? undefined : t("noContentHint")}
        />
      )}
      </div>

      {/* Detail modal */}
      {selectedItem && (
        <MediaDetailModal
          item={selectedItem}
          onClose={closeModal}
          onRequest={handleRequest}
          requesting={requestMedia.isPending}
        />
      )}

      {/* Filter slide-over */}
      <FilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        mediaType={mediaType}
        filters={filters}
        onToggleGenre={toggleGenre}
        onToggleWatchProvider={toggleWatchProvider}
        onYearFromChange={setYearFrom}
        onYearToChange={setYearTo}
        onRatingMinChange={setRatingMin}
        onLanguageChange={setOriginalLanguage}
        onToggleTvStatus={toggleTvStatus}
        onSortByChange={setSortBy}
        onSortOrderChange={setSortOrder}
        onReset={resetFilters}
        activeFilterCount={activeFilterCount}
      />
    </div>
  );
}
