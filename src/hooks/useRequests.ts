import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyRequests, deleteRequest, retryRequest, retryDeleteRequest, getQueueStatus, bulkDeleteRequests, bulkRetryRequests, markRequestStatus } from "../api/seer-client";
import { useToast } from "./useToast";
import type { LocalRequest } from "../api/types";

export function useMyRequests(
  page = 1,
  limit = 20,
  status?: string,
  mediaType?: string,
  q?: string,
) {
  const query = useQuery({
    queryKey: ["seer-my-requests", page, limit, status, mediaType, q],
    queryFn: () => getMyRequests(page, limit, status, mediaType, q),
    staleTime: 60_000,        // 1 min — backend cache de toute façon la liste 60s par user
    gcTime: 30 * 60_000,      // 30 min en mémoire après dernière utilisation
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,  // pas de flash blanc au changement de filtre/page
  });

  // Détecte les passages en retry_pending entre deux refreshes pour alerter l'utilisateur
  const { t } = useTranslation("seer");
  const toast = useToast();
  const previousStatuses = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const results = query.data?.results as LocalRequest[] | undefined;
    if (!results) return;
    const prev = previousStatuses.current;
    let notified = false;
    for (const r of results) {
      const old = prev.get(r.id);
      if (
        old &&
        old !== "retry_pending" &&
        old !== "failed" &&
        r.status === "retry_pending" &&
        !notified
      ) {
        toast.show("error", t("seer:requestRetryNotice"));
        notified = true;
      }
      prev.set(r.id, r.status);
    }
    // Nettoyer les IDs disparus
    const currentIds = new Set(results.map((r) => r.id));
    for (const key of Array.from(prev.keys())) {
      if (!currentIds.has(key)) prev.delete(key);
    }
  }, [query.data, t, toast]);

  return query;
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; seasons?: number[]; deleteFiles?: boolean }) =>
      deleteRequest(args.id, { seasons: args.seasons, deleteFiles: args.deleteFiles }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-queue-status"] });
    },
  });
}

export function useRetryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; seasons?: number[]; profileId?: string | null; forceRedownload?: boolean }) =>
      retryRequest(args.id, { seasons: args.seasons, profileId: args.profileId, forceRedownload: args.forceRedownload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-queue-status"] });
    },
  });
}

export function useRetryDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => retryDeleteRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-queue-status"] });
    },
  });
}

export function useBulkDeleteRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteRequests(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-queue-status"] });
    },
  });
}

export function useBulkRetryRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { ids: string[]; profileId?: string | null }) => bulkRetryRequests(args.ids, args.profileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-queue-status"] });
    },
  });
}

export function useMarkRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; status: "available" | "partial" | "unknown" }) =>
      markRequestStatus(args.id, args.status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-stats-overview"] });
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
