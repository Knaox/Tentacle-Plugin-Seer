/* ------------------------------------------------------------------ */
/*  Seer Plugin — Server-side types                                    */
/* ------------------------------------------------------------------ */

export type RequestStatus =
  | "queued"
  | "processing"
  | "sent_to_seer"
  | "approved"
  | "downloading"
  | "available"
  | "retry_pending"
  | "failed"
  | "deleting"
  | "delete_failed"
  | "deleted";

export interface SeerRequest {
  id: string;
  jellyfinUserId: string;
  username: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  year: string | null;
  seasons: number[] | null;
  status: RequestStatus;
  seerrRequestId: number | null;
  seerrMediaId: number | null;
  seerrMediaStatus: number | null;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  completedAt: string | null;
  pendingCleanupId: string | null;
  profileId: string | null;
}

export interface CreateRequestBody {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string | null;
  year?: string | null;
  seasons?: number[];
  profileId?: string | null;
}

export type ProfileTargetMedia = "all" | "movie" | "tv" | "anime";

export interface SeerProfile {
  id: string;
  name: string;
  targetMediaType?: ProfileTargetMedia;
  radarrServerId?: number;
  radarrProfileId?: number;
  radarrRootFolder?: string;
  sonarrServerId?: number;
  sonarrProfileId?: number;
  sonarrRootFolder?: string;
  sonarrLanguageProfileId?: number;
  tags?: number[];
  isDefault?: boolean;
}

export interface ProxyPayload {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
}
