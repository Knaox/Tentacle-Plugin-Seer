import { useQuery } from "@tanstack/react-query";
import { discoverTrending } from "../api/seer-client";

export function useTrending(page = 1) {
  return useQuery({
    queryKey: ["seer-trending", page],
    queryFn: () => discoverTrending(page),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}
