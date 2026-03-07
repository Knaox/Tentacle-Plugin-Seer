/* ------------------------------------------------------------------ */
/*  Seer API Types                                                     */
/* ------------------------------------------------------------------ */

export type MediaType = "movie" | "tv";

export interface SeerrSearchResult {
  id: number;
  mediaType: MediaType | "person";
  title?: string;
  name?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage?: number;
  originCountry?: string[];
  genreIds?: number[];
  mediaInfo?: {
    status: number;
    requests?: SeerrMediaRequest[];
  };
}

export interface SeerrPagedResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: SeerrSearchResult[];
}

export interface SeerrMediaRequest {
  id: number;
  status: number;
  media: {
    id: number;
    mediaType: MediaType;
    tmdbId: number;
    status: number;
  };
  createdAt: string;
  updatedAt: string;
  requestedBy?: {
    id: number;
    displayName: string;
  };
}

export interface SeerrRequestsResponse {
  pageInfo: {
    pages: number;
    pageSize: number;
    results: number;
    page: number;
  };
  results: SeerrMediaRequest[];
}

export interface SeerrMovieDetail {
  id: number;
  title: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  voteAverage?: number;
  runtime?: number;
  genres?: { id: number; name: string }[];
  mediaInfo?: { status: number };
  credits?: { cast?: SeerrCastMember[] };
}

export interface SeerrTvDetail {
  id: number;
  name: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  firstAirDate?: string;
  voteAverage?: number;
  numberOfSeasons?: number;
  seasons?: SeerrSeason[];
  genres?: { id: number; name: string }[];
  mediaInfo?: {
    status: number;
    seasons?: { id: number; seasonNumber: number; status: number }[];
  };
  credits?: { cast?: SeerrCastMember[] };
}

export interface SeerrSeason {
  id: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  posterPath?: string;
}

export interface SeerrCastMember {
  id: number;
  name: string;
  character: string;
  profilePath?: string;
  order: number;
}

/** Seerr request status: 1=pending, 2=approved, 3=declined */
export type SeerrRequestStatus = 1 | 2 | 3;

export type DiscoverCategory = "movies" | "tv" | "anime" | "trending";
export type SortOption = "popularity" | "vote_average" | "release_date" | "trending";
export type SortOrder = "asc" | "desc";
export type MediaFilter = "all" | "movie" | "tv" | "anime";

/* ── Local request types (from Tentacle backend) ─────────────────── */

export type RequestStatus =
  | "queued"
  | "processing"
  | "sent_to_seer"
  | "approved"
  | "downloading"
  | "available"
  | "retry_pending"
  | "failed";

export interface LocalRequest {
  id: string;
  jellyfinUserId: string;
  username: string;
  mediaType: MediaType;
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

export interface LocalRequestsResponse {
  results: LocalRequest[];
  total: number;
  page: number;
  pages: number;
}

export interface QueueStatus {
  processing: LocalRequest | null;
  queued: number;
  retryPending: number;
  workerRunning: boolean;
}

/* ── Notification types ──────────────────────────────────────────── */

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

export interface NotificationsResponse {
  results: SeerNotification[];
  total: number;
  page: number;
  pages: number;
}

/* ── Stats types ─────────────────────────────────────────────────── */

export interface UserStats {
  totalRequests: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

export interface GlobalStats extends UserStats {
  topRequested: { title: string; tmdbId: number; count: number }[];
  topUsers: { username: string; count: number }[];
  successRate: number;
}

export interface StatsResponse {
  personal: UserStats;
  global?: GlobalStats;
}
