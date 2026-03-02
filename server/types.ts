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
}

export interface SeerNotification {
  id: string;
  jellyfinUserId: string;
  type: string;
  title: string;
  message: string;
  posterPath: string | null;
  refId: string | null;
  read: boolean;
  createdAt: string;
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
}

export interface ProxyPayload {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
}
