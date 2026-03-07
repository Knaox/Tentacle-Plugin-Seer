import { proxyFetch, configUrl, setConfigured, getSeerBackendUrl } from "./endpoints";
import { langParam, getCurrentLanguage } from "../utils/media-helpers";
import type {
  SeerrPagedResponse,
  SeerrMovieDetail,
  SeerrTvDetail,
  DiscoverMediaType,
  DiscoverFilters,
  MediaType,
  LocalRequest,
  LocalRequestsResponse,
  QueueStatus,
  StatsResponse,
} from "./types";

function getToken(): string {
  return localStorage.getItem("tentacle_token") ?? "";
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

/** Fetch from the Seer plugin backend (not Seerr proxy) */
async function backendFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${getSeerBackendUrl()}/api/plugins/seer${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function getWatchRegion(): string {
  const lang = getCurrentLanguage();
  const map: Record<string, string> = { fr: "FR", en: "US", de: "DE", es: "ES", it: "IT", pt: "BR", ja: "JP" };
  return map[lang] ?? "US";
}

/* ── Search (Seerr proxy) ────────────────────────────────────────── */

export async function searchMedia(query: string, page = 1): Promise<SeerrPagedResponse> {
  return proxyFetch(`/api/v1/search?query=${encodeURIComponent(query)}&page=${page}&${langParam()}`);
}

/* ── Discover (Seerr proxy) ──────────────────────────────────────── */

/**
 * Build discover URL params matching Seerr's exact API contract.
 *
 * IMPORTANT: We do NOT send `language` as a query param because Seerr's
 * backend maps it to BOTH display language AND `originalLanguage` filter
 * on TMDB. Sending language=fr would filter for French-original content
 * only, hiding all Japanese anime, English movies, etc.
 *
 * Display language is handled via the Accept-Language header in proxyFetch.
 * Original language filter is only sent when the user explicitly sets it.
 */
export async function discoverMedia(
  mediaType: DiscoverMediaType,
  page: number,
  filters: DiscoverFilters,
): Promise<SeerrPagedResponse> {
  // Build params exactly like Seerr frontend does (key=value pairs)
  const params: Record<string, string> = {};
  params.page = String(page);

  // Sort — Seerr sends the full "field.order" string as sortBy
  const sortField = (() => {
    if (filters.sortBy === "release_date") {
      return mediaType === "movies" ? "primary_release_date" : "first_air_date";
    }
    if (filters.sortBy === "title") {
      return "original_title";
    }
    return filters.sortBy;
  })();
  params.sortBy = `${sortField}.${filters.sortOrder}`;

  // Genres — comma separated
  if (filters.genres.length > 0) {
    params.genre = filters.genres.join(",");
  }

  // Watch providers — pipe separated, with region
  if (filters.watchProviders.length > 0) {
    params.watchProviders = filters.watchProviders.join("|");
    params.watchRegion = getWatchRegion();
  }

  // Year range — date strings
  if (filters.yearFrom != null) {
    const key = mediaType === "movies" ? "primaryReleaseDateGte" : "firstAirDateGte";
    params[key] = `${filters.yearFrom}-01-01`;
  }
  if (filters.yearTo != null) {
    const key = mediaType === "movies" ? "primaryReleaseDateLte" : "firstAirDateLte";
    params[key] = `${filters.yearTo}-12-31`;
  }

  // Rating minimum
  if (filters.ratingMin != null) {
    params.voteAverageGte = String(filters.ratingMin);
    params.voteCountGte = "50";
  }

  // Original language — uses the `language` param (Seerr maps it to originalLanguage)
  // Only sent when user explicitly picks a language filter
  if (filters.originalLanguage) {
    params.language = filters.originalLanguage;
  }

  // TV status
  if (mediaType === "tv" && filters.tvStatus.length > 0) {
    params.status = String(filters.tvStatus[0]);
  }

  // Build query string like Seerr does: key=encodeURIComponent(value)
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const endpoint = mediaType === "movies" ? "movies" : "tv";
  return proxyFetch(`/api/v1/discover/${endpoint}?${qs}`);
}

/** Fetch trending for HeroCarousel */
export async function discoverTrending(page = 1): Promise<SeerrPagedResponse> {
  return proxyFetch(`/api/v1/discover/trending?page=${page}`);
}

/* ── Media details (Seerr proxy) ─────────────────────────────────── */

export async function getMovieDetail(id: number): Promise<SeerrMovieDetail> {
  return proxyFetch(`/api/v1/movie/${id}?${langParam()}`);
}

export async function getTvDetail(id: number): Promise<SeerrTvDetail> {
  return proxyFetch(`/api/v1/tv/${id}?${langParam()}`);
}

/* ── Requests (Tentacle backend — queue system) ──────────────────── */

export async function createRequest(body: {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string | null;
  year?: string | null;
  seasons?: number[];
}): Promise<LocalRequest> {
  return backendFetch("/requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getMyRequests(
  page = 1,
  limit = 20,
  status?: string,
  mediaType?: string,
): Promise<LocalRequestsResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  if (mediaType) params.set("type", mediaType);
  return backendFetch(`/requests?${params}`);
}

export async function deleteRequest(id: string): Promise<void> {
  await backendFetch(`/requests/${id}`, { method: "DELETE" });
}

export async function retryRequest(id: string): Promise<LocalRequest> {
  return backendFetch(`/requests/${id}/retry`, { method: "POST" });
}

/* ── Queue ────────────────────────────────────────────────────────── */

export async function getQueueStatus(): Promise<QueueStatus> {
  return backendFetch("/queue/status");
}

/* ── Stats ────────────────────────────────────────────────────────── */

export async function getStats(): Promise<StatsResponse> {
  return backendFetch("/stats");
}

/* ── Config check ────────────────────────────────────────────────── */

export async function isSeerConfigured(): Promise<boolean> {
  try {
    const res = await fetch(configUrl(), {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.enabled && data.url && data.hasApiKey) {
      setConfigured(true);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
