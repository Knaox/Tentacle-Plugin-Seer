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
}

export interface SeerrSeason {
  id: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  posterPath?: string;
}

/** Seerr request status: 1=pending, 2=approved, 3=declined */
export type SeerrRequestStatus = 1 | 2 | 3;

export type DiscoverCategory = "movies" | "tv" | "anime" | "trending";
export type SortOption = "popularity" | "vote_average" | "release_date" | "trending";
export type MediaFilter = "all" | "movie" | "tv" | "anime";
