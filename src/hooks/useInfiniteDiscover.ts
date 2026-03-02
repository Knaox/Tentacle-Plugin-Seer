import { useInfiniteQuery } from "@tanstack/react-query";
import { discoverMedia } from "../api/seer-client";
import type { DiscoverCategory } from "../api/types";

export function useInfiniteDiscover(category: DiscoverCategory) {
  return useInfiniteQuery({
    queryKey: ["seer-discover-infinite", category],
    queryFn: ({ pageParam }) => discoverMedia(category, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60_000,
  });
}
