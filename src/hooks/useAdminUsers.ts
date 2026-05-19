import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminUsers, updateAdminUser, syncAdminUsers } from "../api/seer-client";
import type { AdminUserRow, UpdateAdminUserBody } from "../api/types";

export function useAdminUsers() {
  return useQuery<AdminUserRow[]>({
    queryKey: ["seer-admin-users"],
    queryFn: getAdminUsers,
    staleTime: 15_000,
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
