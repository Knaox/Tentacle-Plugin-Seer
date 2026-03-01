import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyRequests, deleteRequest } from "../api/seer-client";

export function useMyRequests(page = 1, limit = 20) {
  return useQuery({
    queryKey: ["seer-my-requests", page, limit],
    queryFn: () => getMyRequests(page, limit),
    staleTime: 30_000,
  });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
    },
  });
}
