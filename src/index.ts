export { seerPlugin } from "./plugin";
export { setSeerBackendUrl } from "./api/endpoints";

// Re-export types for consumers
export type {
  SeerrSearchResult,
  SeerrPagedResponse,
  SeerrMediaRequest,
  SeerrRequestsResponse,
  SeerrMovieDetail,
  SeerrTvDetail,
  SeerrSeason,
  SeerrCastMember,
  SeerrRequestStatus,
  DiscoverCategory,
  SortOption,
  MediaFilter,
  MediaType,
  LocalRequest,
  LocalRequestsResponse,
  QueueStatus,
  RequestStatus,
} from "./api/types";

// Re-export hooks
export { useSeerSearch } from "./hooks/useSearch";
export { useDiscoverMedia } from "./hooks/useDiscoverMedia";
export { useInfiniteDiscover } from "./hooks/useInfiniteDiscover";
export { useMyRequests, useDeleteRequest } from "./hooks/useRequests";
export { useRequestMedia } from "./hooks/useRequestMedia";
export { useMediaDetail } from "./hooks/useMediaDetail";
export { useMediaVideos } from "./hooks/useMediaVideos";
export { useMediaSimilar } from "./hooks/useMediaSimilar";
export { useWatchProviders } from "./hooks/useWatchProviders";
