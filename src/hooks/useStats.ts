import { useQuery } from "@tanstack/react-query";
import { getStats } from "../api/seer-client";

export function useStats() {
  return useQuery({
    queryKey: ["seer-stats"],
    queryFn: () => getStats(),
    staleTime: 60_000,
  });
}
