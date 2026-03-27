import { useQuery } from "@tanstack/react-query";
import { getProfiles, getProfileOptions } from "../api/seer-client";

export function useProfiles() {
  return useQuery({
    queryKey: ["seer-profiles"],
    queryFn: () => getProfiles(),
    staleTime: 60_000,
  });
}

export function useProfileOptions() {
  return useQuery({
    queryKey: ["seer-profile-options"],
    queryFn: () => getProfileOptions(),
    staleTime: 120_000,
  });
}
