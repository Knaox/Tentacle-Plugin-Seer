import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTrending } from "../hooks/useDiscoverMedia";
import { useInfiniteDiscover } from "../hooks/useInfiniteDiscover";
import { useDiscoverFilters } from "../hooks/useDiscoverFilters";
import { useSeerSearch } from "../hooks/useSearch";
import { useRequestMedia } from "../hooks/useRequestMedia";
import type { RequestMediaPayload } from "../hooks/useRequestMedia";
import { formatSeerError } from "../api/seer-client";
import { MediaCard } from "./MediaCard";
import { FilterPanel } from "./FilterPanel";
import { DiscoverSearchHeader } from "./DiscoverSearchHeader";
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
  // « Afficher quand même » le contenu masqué par le blocage par tags Jellyseerr.
  const [showBlocked, setShowBlocked] = useState<boolean>(() => {
    try { return localStorage.getItem("seer_show_blocked") === "1"; } catch { return false; }
  });
  const toggleShowBlocked = useCallback(() => {
    setShowBlocked((prev) => {
      const next = !prev;
      try { localStorage.setItem("seer_show_blocked", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);
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
  const { data: trendingData, isError: trendingError } = useTrending(1, showBlocked);

  // Seerr-style infinite discover
  const {
    titles,
    isLoadingInitialData,
    isLoadingMore,
    isEmpty,
    isReachingEnd,
    fetchMore,
    totalResults,
    blockedActive,
    isError,
    error,
    refetch,
  } = useInfiniteDiscover(mediaType, filters, showBlocked);

  const { data: searchData, isLoading: searchLoading } = useSeerSearch(debouncedQuery, 1, showBlocked);
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
        onError: (err) => toast.show("error", formatSeerError(err, t, "seer:requestError")),
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

      <DiscoverSearchHeader
        query={query}
        onQueryChange={setQuery}
        searchInputRef={searchInputRef}
        isSearching={isSearching}
        mediaType={mediaType}
        onTabChange={handleTabChange}
        onOpenFilterPanel={() => setFilterPanelOpen(true)}
        activeFilterCount={activeFilterCount}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
        totalResults={totalResults}
        isLoading={isLoading}
        filters={filters}
        onRemoveGenre={toggleGenre}
        onRemoveWatchProvider={toggleWatchProvider}
        onClearYears={() => { setYearFrom(null); setYearTo(null); }}
        onClearRating={() => setRatingMin(null)}
        onClearLanguage={() => setOriginalLanguage(null)}
        onRemoveTvStatus={toggleTvStatus}
        showBlockedBanner={
          !isLoading && (isSearching
            ? !!searchData?.blockedActive && (showBlocked || (searchData?.blockedCount ?? 0) > 0)
            : blockedActive)
        }
        blockedCount={isSearching ? (searchData?.blockedCount ?? 0) : 0}
        showBlocked={showBlocked}
        onToggleShowBlocked={toggleShowBlocked}
      />

      {/* Results */}
      <div key={viewKey} style={{ animation: "viewCrossfade 200ms ease" }}>
      {isLoading ? (
        <SkeletonList count={20} />
      ) : hasError && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <svg className="h-10 w-10 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-sm font-medium text-tentacle-text-secondary">{t("seer:connectionError")}</p>
          {errorMessage && (
            <p className="max-w-md text-center text-xs text-tentacle-text-quaternary">{errorMessage}</p>
          )}
          <button
            onClick={() => { refetch(); }}
            className="mt-2 rounded-lg bg-tentacle-brand px-4 py-2 text-xs font-semibold text-tentacle-cta-brand-fg transition-opacity hover:opacity-90"
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
