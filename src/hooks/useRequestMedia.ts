import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRequest } from "../api/seer-client";
import type { MediaType, SeerrPagedResponse } from "../api/types";

interface RequestMediaPayload {
  mediaType: MediaType;
  tmdbId: number;
  seasons?: number[];
}

export function useRequestMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestMediaPayload) => createRequest(payload),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });

      // Optimistically mark the media as requested in discover/search caches
      const updateResults = (old: SeerrPagedResponse | undefined) => {
        if (!old?.results) return old;
        return {
          ...old,
          results: old.results.map((r) =>
            r.id === payload.tmdbId && r.mediaType === payload.mediaType
              ? { ...r, mediaInfo: { ...(r.mediaInfo || {}), status: 2 } }
              : r
          ),
        };
      };

      qc.setQueriesData({ queryKey: ["seer-discover"] }, updateResults);
      qc.setQueriesData({ queryKey: ["seer-search"] }, updateResults);

      // Invalidate detail cache to refetch with updated mediaInfo from Seerr
      qc.invalidateQueries({ queryKey: ["seer-media-detail", payload.mediaType, payload.tmdbId] });
    },
  });
}
