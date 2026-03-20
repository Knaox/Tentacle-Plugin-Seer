import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRequest } from "../api/seer-client";
import type { MediaType, SeerrPagedResponse, SeerrSearchResult } from "../api/types";

export interface RequestMediaPayload {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string | null;
  year?: string | null;
  seasons?: number[];
}

/** Met à jour le mediaInfo.status d'un item dans un array de résultats */
function markRequested(results: SeerrSearchResult[], tmdbId: number, mediaType: string): SeerrSearchResult[] {
  return results.map((r) =>
    r.id === tmdbId && r.mediaType === mediaType
      ? { ...r, mediaInfo: { ...(r.mediaInfo || {}), status: 2 } }
      : r,
  );
}

export function useRequestMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestMediaPayload) => createRequest(payload),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-queue-status"] });

      // Update simple queries (trending, search) — format SeerrPagedResponse
      const updateSimple = (old: SeerrPagedResponse | undefined) => {
        if (!old?.results) return old;
        return { ...old, results: markRequested(old.results, payload.tmdbId, payload.mediaType) };
      };

      // Update infinite queries (discover) — format { pages: SeerrPagedResponse[], pageParams: [] }
      const updateInfinite = (old: { pages: SeerrPagedResponse[]; pageParams: unknown[] } | undefined) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            results: markRequested(page.results, payload.tmdbId, payload.mediaType),
          })),
        };
      };

      qc.setQueriesData({ queryKey: ["seer-trending"] }, updateSimple);
      qc.setQueriesData({ queryKey: ["seer-search"] }, updateSimple);
      qc.setQueriesData({ queryKey: ["seer-discover"] }, updateInfinite);
      qc.invalidateQueries({ queryKey: ["seer-media-detail", payload.mediaType, payload.tmdbId] });
    },
  });
}
