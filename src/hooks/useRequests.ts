import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyRequests, deleteRequest, retryRequest, getQueueStatus } from "../api/seer-client";

export function useMyRequests(
  page = 1,
  limit = 20,
  status?: string,
  mediaType?: string,
) {
  return useQuery({
    queryKey: ["seer-my-requests", page, limit, status, mediaType],
    queryFn: () => getMyRequests(page, limit, status, mediaType),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-queue-status"] });
    },
  });
}

export function useRetryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => retryRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-queue-status"] });
    },
  });
}

export function useQueueStatus() {
  return useQuery({
    queryKey: ["seer-queue-status"],
    queryFn: () => getQueueStatus(),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
