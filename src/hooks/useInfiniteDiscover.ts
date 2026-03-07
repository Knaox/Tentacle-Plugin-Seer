import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useCallback, useRef } from "react";
import { discoverMedia } from "../api/seer-client";
import type { DiscoverMediaType, DiscoverFilters, SeerrSearchResult, SeerrPagedResponse } from "../api/types";

const INITIAL_PAGES = 3;
const PREFETCH_AHEAD = 2;
const STALE_TIME = 5 * 60_000;

/**
 * Replicate Seerr's useDiscover pattern with TanStack Query:
 * - 3 initial pages fetched in parallel on mount
 * - Prefetch 2 pages ahead when fetching next page
 * - Deduplication of results across pages (by ID)
 * - keepPreviousData to avoid flash when filters change
 * - Aggressive caching (5 min staleTime)
 */
export function useInfiniteDiscover(mediaType: DiscoverMediaType, filters: DiscoverFilters) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(new Set<string>());

  const queryKey = ["seer-discover", mediaType, filters];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      // On initial load, fetch first 3 pages in parallel (like Seerr initialSize: 3)
      if (pageParam === 1) {
        const pages = await Promise.all(
          Array.from({ length: INITIAL_PAGES }, (_, i) =>
            discoverMedia(mediaType, i + 1, filters),
          ),
        );
        // Return a merged response for the initial batch
        // TanStack sees this as page 1, but we pack all 3 inside
        return {
          page: INITIAL_PAGES,
          totalPages: pages[0]?.totalPages ?? 0,
          totalResults: pages[0]?.totalResults ?? 0,
          results: pages.flatMap((p) => p.results),
          _batchedPages: INITIAL_PAGES,
        } as SeerrPagedResponse & { _batchedPages?: number };
      }
      return discoverMedia(mediaType, pageParam, filters);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      // Account for the initial batch
      const lastFetchedPage = (lastPage as SeerrPagedResponse & { _batchedPages?: number })._batchedPages ?? lastPage.page;
      if (lastFetchedPage >= lastPage.totalPages) return undefined;
      return lastFetchedPage + 1;
    },
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  // Prefetch 2 pages ahead when new data arrives
  useEffect(() => {
    if (!query.data?.pages.length) return;

    const lastPage = query.data.pages[query.data.pages.length - 1];
    const lastFetchedPage = (lastPage as SeerrPagedResponse & { _batchedPages?: number })._batchedPages ?? lastPage.page;
    const totalPages = lastPage.totalPages;

    for (let i = 1; i <= PREFETCH_AHEAD; i++) {
      const nextPage = lastFetchedPage + i;
      if (nextPage > totalPages) break;

      const cacheKey = `${mediaType}-${JSON.stringify(filters)}-${nextPage}`;
      if (prefetchedRef.current.has(cacheKey)) continue;
      prefetchedRef.current.add(cacheKey);

      queryClient.prefetchQuery({
        queryKey: ["seer-discover-page", mediaType, filters, nextPage],
        queryFn: () => discoverMedia(mediaType, nextPage, filters),
        staleTime: STALE_TIME,
      });
    }
  }, [query.data, mediaType, filters, queryClient]);

  // Reset prefetch cache when filters change
  useEffect(() => {
    prefetchedRef.current.clear();
  }, [mediaType, filters]);

  // Deduplicate results across pages (like Seerr's Set<number>)
  const titles = useMemo(() => {
    if (!query.data?.pages) return [];
    const seen = new Set<string>();
    const results: SeerrSearchResult[] = [];
    for (const page of query.data.pages) {
      for (const item of page.results) {
        const key = `${item.mediaType}-${item.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(item);
        }
      }
    }
    return results;
  }, [query.data?.pages]);

  // Seerr-style loading states
  const isLoadingInitialData = query.isLoading;
  const isLoadingMore = query.isFetchingNextPage;
  const totalResults = query.data?.pages[0]?.totalResults;

  const isEmpty = !isLoadingInitialData && titles.length === 0;

  // Seerr's isReachingEnd logic
  const isReachingEnd = useMemo(() => {
    if (isEmpty) return true;
    if (!query.data?.pages.length) return false;
    const lastPage = query.data.pages[query.data.pages.length - 1];
    const lastFetchedPage = (lastPage as SeerrPagedResponse & { _batchedPages?: number })._batchedPages ?? lastPage.page;
    if (lastPage.results.length < 20) return true;
    if ((totalResults ?? 0) <= lastFetchedPage * 20) return true;
    if ((totalResults ?? 0) < 41) return true;
    return !query.hasNextPage;
  }, [isEmpty, query.data?.pages, query.hasNextPage, totalResults]);

  const fetchMore = useCallback(() => {
    if (!isReachingEnd && !isLoadingMore && query.hasNextPage) {
      query.fetchNextPage();
    }
  }, [isReachingEnd, isLoadingMore, query]);

  return {
    titles,
    isLoadingInitialData,
    isLoadingMore,
    isEmpty,
    isReachingEnd,
    fetchMore,
    totalResults,
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
  };
}
