import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDiscoverMedia } from "../hooks/useDiscoverMedia";
import { useInfiniteDiscover } from "../hooks/useInfiniteDiscover";
import { useSeerSearch } from "../hooks/useSearch";
import { useRequestMedia } from "../hooks/useRequestMedia";
import type { RequestMediaPayload } from "../hooks/useRequestMedia";
import { MediaCard } from "./MediaCard";
import { MediaTypeFilter } from "./MediaTypeFilter";
import { SortSelector } from "./SortSelector";
import { PlatformFilter } from "./PlatformFilter";
import { HeroCarousel } from "./HeroCarousel";
import { MediaDetailModal } from "./MediaDetailModal";
import { SkeletonList } from "./SkeletonList";
import { EmptyState } from "./EmptyState";
import { mediaTitle, mediaYear } from "../utils/media-helpers";
import { useToast } from "../hooks/useToast";
import type { SeerrSearchResult, DiscoverCategory, MediaFilter, SortOption } from "../api/types";

export function DiscoverPage() {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [sort, setSort] = useState<SortOption>("popularity");
  const [platforms, setPlatforms] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<SeerrSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const category: DiscoverCategory = mediaFilter === "movie"
    ? "movies"
    : mediaFilter === "tv"
      ? "tv"
      : mediaFilter === "anime"
        ? "anime"
        : sort === "trending"
          ? "trending"
          : "movies";

  // Hero uses trending
  const { data: trendingData, isError: trendingError } = useDiscoverMedia("trending", 1);

  // Infinite scroll for discover
  const infinite = useInfiniteDiscover(category);
  const { data: searchData, isLoading: searchLoading } = useSeerSearch(debouncedQuery, 1);
  const requestMedia = useRequestMedia();

  const isSearching = debouncedQuery.length >= 2;
  const isLoading = isSearching ? searchLoading : infinite.isLoading;
  const hasError = infinite.isError || trendingError;
  const errorMessage = infinite.error?.message || "";

  // Flatten infinite pages
  const allDiscoverResults = infinite.data?.pages.flatMap((p) => p.results) ?? [];

  const rawResults = isSearching ? (searchData?.results ?? []) : allDiscoverResults;

  // Filter
  const filtered = rawResults.filter((item) => {
    if (item.mediaType === "person") return false;
    if (mediaFilter === "movie") return item.mediaType === "movie";
    if (mediaFilter === "tv") return item.mediaType === "tv";
    if (mediaFilter === "anime") return item.genreIds?.includes(16) ?? false;
    return true;
  });

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

  // Infinite scroll observer
  useEffect(() => {
    if (isSearching || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && infinite.hasNextPage && !infinite.isFetchingNextPage) {
          infinite.fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [isSearching, infinite.hasNextPage, infinite.isFetchingNextPage, infinite.fetchNextPage]);

  const handleRequest = useCallback((item: SeerrSearchResult) => {
    if (item.mediaType === "movie" || item.mediaType === "tv") {
      const payload: RequestMediaPayload = {
        mediaType: item.mediaType,
        tmdbId: item.id,
        title: mediaTitle(item) || "Unknown",
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

  const hasActiveFilters = mediaFilter !== "all" || platforms.length > 0;

  const resetFilters = () => {
    setMediaFilter("all");
    setSort("popularity");
    setPlatforms([]);
  };

  return (
    <div className="px-4 pt-4 md:px-8">
      {/* Hero Carousel — always visible except when searching */}
      {!isSearching && trendingData?.results && (
        <div className="-mx-4 -mt-4 mb-6 md:-mx-8">
          <HeroCarousel
            items={trendingData.results}
            onSelect={setSelectedItem}
            onRequest={handleRequest}
          />
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-4">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("seer:searchPlaceholder")}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 pr-24 text-sm text-white placeholder-white/30 outline-none backdrop-blur transition-all focus:border-purple-500/50 focus:bg-white/[0.07] focus:shadow-lg focus:shadow-purple-500/5"
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

      {/* Filters row 1: type */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <MediaTypeFilter value={mediaFilter} onChange={(v) => setMediaFilter(v)} />
        {!isSearching && (
          <SortSelector value={sort} onChange={(v) => setSort(v)} />
        )}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/30 transition-colors hover:text-white/60"
          >
            {t("resetFilters")}
          </button>
        )}
      </div>

      {/* Filters row 2: platforms */}
      {!isSearching && (
        <div className="mb-6">
          <PlatformFilter selected={platforms} onChange={setPlatforms} />
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <SkeletonList count={12} />
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
            onClick={() => { infinite.refetch(); }}
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
                onClick={setSelectedItem}
                requesting={requestMedia.isPending}
                style={{
                  opacity: 0,
                  animation: `fadeSlideUp 400ms cubic-bezier(0.25,0.46,0.45,0.94) ${i * 50}ms forwards`,
                }}
              />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          {!isSearching && (
            <div ref={sentinelRef} className="pt-4">
              {infinite.isFetchingNextPage && <SkeletonList count={6} />}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title={isSearching ? t("seer:noResults") : t("seer:noContent")}
          subtitle={isSearching ? undefined : t("noContentHint")}
        />
      )}

      {/* Detail modal */}
      {selectedItem && (
        <MediaDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onRequest={handleRequest}
          requesting={requestMedia.isPending}
        />
      )}
    </div>
  );
}
