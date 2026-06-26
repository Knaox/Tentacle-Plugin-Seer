import { useQuery } from "@tanstack/react-query";
import { discoverTrending } from "../api/seer-client";

export function useTrending(page = 1, showBlocked = false) {
  return useQuery({
    queryKey: ["seer-trending", page, showBlocked],
    queryFn: () => discoverTrending(page, showBlocked),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}
