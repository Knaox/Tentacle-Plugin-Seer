import { useInfiniteQuery } from "@tanstack/react-query";
import { discoverMedia } from "../api/seer-client";
import type { DiscoverCategory } from "../api/types";

export function useInfiniteDiscover(category: DiscoverCategory, watchProviders?: number[], sortBy?: string) {
  return useInfiniteQuery({
    queryKey: ["seer-discover-infinite", category, watchProviders, sortBy],
    queryFn: ({ pageParam }) => discoverMedia(category, pageParam, watchProviders, sortBy),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60_000,
  });
}
