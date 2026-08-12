import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useCallback, useRef } from "react";
import { discoverMedia } from "../api/client-catalog";
import type { DiscoverMediaType, DiscoverFilters, SeerrSearchResult, SeerrPagedResponse } from "../api/types";

const INITIAL_PAGES = 3;
const STALE_TIME = 5 * 60_000;

/**
 * Pagination du catalogue :
 * - trois pages en parallèle au montage ;
 * - dédoublonnage des résultats d'une page à l'autre (par identifiant) ;
 * - la page précédente reste affichée pendant qu'un filtre change ;
 * - cache de cinq minutes.
 */
export function useInfiniteDiscover(
  mediaType: DiscoverMediaType,
  filters: DiscoverFilters,
  showBlocked = false,
) {
  const queryKey = ["seer-discover", mediaType, filters, showBlocked];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      // On initial load, fetch first 3 pages in parallel (like Seerr initialSize: 3)
      if (pageParam === 1) {
        const pages = await Promise.all(
          Array.from({ length: INITIAL_PAGES }, (_, i) =>
            discoverMedia(mediaType, i + 1, filters, showBlocked),
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
      return discoverMedia(mediaType, pageParam, filters, showBlocked);
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

  /*
   * Le préchargement de deux pages d'avance a été RETIRÉ.
   *
   * Il écrivait sous « seer-discover-page », alors que la requête paginée vit
   * sous « seer-discover » et redemande tout par elle-même : ces pages n'ont
   * jamais été lues par personne. C'étaient donc deux appels complets gaspillés
   * à chaque page chargée — et surtout deux places prises dans une file qui
   * n'en compte que huit avant que Jellyseerr ne parte en latence (cf.
   * concurrency.ts). Pendant le défilement, le plugin retardait ses propres
   * pages en se faisant concurrence à lui-même.
   */

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
  // Vrai si un blocage par tags est configuré côté Jellyseerr.
  const blockedActive = query.data?.pages.some((p) => p.blockedActive) ?? false;

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
    blockedActive,
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
  };
}
