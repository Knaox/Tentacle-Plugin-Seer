/* ------------------------------------------------------------------ */
/*  Seer API Types                                                     */
/* ------------------------------------------------------------------ */

export type MediaType = "movie" | "tv";
export type DiscoverMediaType = "movies" | "tv";
export type SortOption = "popularity" | "vote_average" | "release_date" | "title";
export type SortOrder = "asc" | "desc";
export type TvStatus = 0 | 1 | 2 | 3 | 4 | 5;

export interface DiscoverFilters {
  genres: number[];
  watchProviders: number[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  originalLanguage: string | null;
  tvStatus: TvStatus[];
  sortBy: SortOption;
  sortOrder: SortOrder;
}

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

export interface SeerrCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profilePath?: string;
}

export interface SeerrProductionCompany {
  id: number;
  name: string;
  logoPath?: string;
}

export interface SeerrMovieDetail {
  id: number;
  title: string;
  originalTitle?: string;
  tagline?: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  voteAverage?: number;
  voteCount?: number;
  runtime?: number;
  budget?: number;
  revenue?: number;
  status?: string;
  originalLanguage?: string;
  certification?: string;
  genres?: { id: number; name: string }[];
  productionCompanies?: SeerrProductionCompany[];
  productionCountries?: { iso_3166_1: string; name: string }[];
  mediaInfo?: { status: number };
  credits?: {
    cast?: SeerrCastMember[];
    crew?: SeerrCrewMember[];
  };
}

export interface SeerrTvDetail {
  id: number;
  name: string;
  originalName?: string;
  tagline?: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  firstAirDate?: string;
  voteAverage?: number;
  voteCount?: number;
  numberOfSeasons?: number;
  status?: string;
  originalLanguage?: string;
  certification?: string;
  seasons?: SeerrSeason[];
  genres?: { id: number; name: string }[];
  productionCompanies?: SeerrProductionCompany[];
  productionCountries?: { iso_3166_1: string; name: string }[];
  networks?: { id: number; name: string; logoPath?: string }[];
  createdBy?: { id: number; name: string; profilePath?: string }[];
  mediaInfo?: {
    status: number;
    seasons?: { id: number; seasonNumber: number; status: number }[];
  };
  credits?: {
    cast?: SeerrCastMember[];
    crew?: SeerrCrewMember[];
  };
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
