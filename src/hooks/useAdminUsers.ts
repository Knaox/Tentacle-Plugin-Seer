import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminUsers, updateAdminUser, syncAdminUsers, syncRequestsOwnership } from "../api/seer-client";
import type { AdminUserRow, UpdateAdminUserBody } from "../api/types";

export function useAdminUsers() {
  return useQuery<AdminUserRow[]>({
    queryKey: ["seer-admin-users"],
    queryFn: getAdminUsers,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { jellyfinUserId: string; patch: UpdateAdminUserBody }) =>
      updateAdminUser(args.jellyfinUserId, args.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-admin-users"] });
    },
  });
}

export function useSyncAdminUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncAdminUsers(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-admin-users"] });
    },
  });
}

export function useSyncRequestsOwnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncRequestsOwnership(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-stats-overview"] });
      qc.invalidateQueries({ queryKey: ["seer-admin-users"] });
    },
  });
}
