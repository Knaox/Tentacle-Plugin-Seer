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
  SeerrRequestStatus,
  DiscoverCategory,
  SortOption,
  MediaFilter,
  MediaType,
} from "./api/types";

// Re-export hooks
export { useSeerSearch } from "./hooks/useSearch";
export { useDiscoverMedia } from "./hooks/useDiscoverMedia";
export { useMyRequests, useDeleteRequest } from "./hooks/useRequests";
export { useRequestMedia } from "./hooks/useRequestMedia";
export { useMediaDetail } from "./hooks/useMediaDetail";
