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
  AdminUserRow,
  UpdateAdminUserBody,
} from "./types";

/** Error thrown by backendFetch carrying optional i18n errorKey + extra context. */
export class SeerBackendApiError extends Error {
  status: number;
  errorKey?: string;
  limit?: number;
  constructor(message: string, status: number, opts?: { errorKey?: string; limit?: number }) {
    super(message);
    this.name = "SeerBackendApiError";
    this.status = status;
    this.errorKey = opts?.errorKey;
    this.limit = opts?.limit;
  }
}

/**
 * Formate une erreur backend en message traduit. Si l'erreur expose `errorKey`,
 * on l'utilise comme clé i18n avec `limit` injecté. Sinon on retombe sur `fallback`.
 */
export function formatSeerError(
  err: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string,
  fallbackKey = "seer:requestError",
): string {
  if (err instanceof SeerBackendApiError && err.errorKey) {
    return t(err.errorKey, err.limit !== undefined ? { limit: err.limit } : undefined);
  }
  if (err instanceof Error && err.message) return err.message;
  return t(fallbackKey);
}

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
export async function backendFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${getSeerBackendUrl()}/api/plugins/seer${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText })) as {
      message?: string; errorKey?: string; limit?: number;
    };
    throw new SeerBackendApiError(body.message || `HTTP ${res.status}`, res.status, {
      errorKey: body.errorKey,
      limit: body.limit,
    });
  }
  return res.json();
}

function getWatchRegion(): string {
  const lang = getCurrentLanguage();
  const map: Record<string, string> = { fr: "FR", en: "US", de: "DE", es: "ES", it: "IT", pt: "BR", ja: "JP" };
  return map[lang] ?? "US";
}

/* ── Search (Seerr proxy) ────────────────────────────────────────── */

export async function searchMedia(
  query: string,
  page = 1,
  showBlocked = false,
): Promise<SeerrPagedResponse> {
  const sb = showBlocked ? "&_showBlocked=1" : "";
  return proxyFetch(`/api/v1/search?query=${encodeURIComponent(query)}&page=${page}${sb}`);
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
  showBlocked = false,
): Promise<SeerrPagedResponse> {
  // Anime utilise l'endpoint TV avec le keyword TMDB "anime" (210024)
  const seerrType = mediaType === "anime" ? "tv" : mediaType;

  // Build params exactly like Seerr frontend does (key=value pairs)
  const params: Record<string, string> = {};
  params.page = String(page);

  // Sort — Seerr sends the full "field.order" string as sortBy
  const sortField = (() => {
    if (filters.sortBy === "release_date") {
      return seerrType === "movies" ? "primary_release_date" : "first_air_date";
    }
    if (filters.sortBy === "title") return "original_title";
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
    const key = seerrType === "movies" ? "primaryReleaseDateGte" : "firstAirDateGte";
    params[key] = `${filters.yearFrom}-01-01`;
  }
  if (filters.yearTo != null) {
    const key = seerrType === "movies" ? "primaryReleaseDateLte" : "firstAirDateLte";
    params[key] = `${filters.yearTo}-12-31`;
  }

  // Rating minimum
  if (filters.ratingMin != null) {
    params.voteAverageGte = String(filters.ratingMin);
    params.voteCountGte = "50";
  }

  // Original language
  if (filters.originalLanguage) {
    params.language = filters.originalLanguage;
  }

  // TV status
  if (seerrType === "tv" && filters.tvStatus.length > 0) {
    params.status = String(filters.tvStatus[0]);
  }

  // Keyword anime
  if (mediaType === "anime") {
    params.keywords = "210024";
  }

  // Bouton « Afficher quand même » : désactive le blocage par tags côté proxy.
  if (showBlocked) {
    params._showBlocked = "1";
  }

  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const endpoint = seerrType === "movies" ? "movies" : "tv";
  return proxyFetch(`/api/v1/discover/${endpoint}?${qs}`);
}

/** Fetch trending for HeroCarousel */
export async function discoverTrending(page = 1, showBlocked = false): Promise<SeerrPagedResponse> {
  const sb = showBlocked ? "&_showBlocked=1" : "";
  return proxyFetch(`/api/v1/discover/trending?page=${page}${sb}`);
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
  profileId?: string | null;
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
  q?: string,
): Promise<LocalRequestsResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  if (mediaType) params.set("type", mediaType);
  if (q && q.trim()) params.set("q", q.trim());
  return backendFetch(`/requests?${params}`);
}

export async function deleteRequest(
  id: string,
  opts?: { seasons?: number[]; deleteFiles?: boolean },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (opts?.seasons) body.seasons = opts.seasons;
  if (opts?.deleteFiles !== undefined) body.deleteFiles = opts.deleteFiles;
  await backendFetch(`/requests/${id}`, {
    method: "DELETE",
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
  });
}

export async function retryRequest(
  id: string,
  opts?: { seasons?: number[]; profileId?: string | null; forceRedownload?: boolean },
): Promise<LocalRequest> {
  const body: Record<string, unknown> = {};
  if (opts?.seasons) body.seasons = opts.seasons;
  if (opts?.profileId !== undefined) body.profileId = opts.profileId;
  if (opts?.forceRedownload !== undefined) body.forceRedownload = opts.forceRedownload;
  return backendFetch(`/requests/${id}/retry`, {
    method: "POST",
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
  });
}

export async function retryDeleteRequest(id: string): Promise<void> {
  await backendFetch(`/requests/${id}/retry-delete`, { method: "POST" });
}

export async function markRequestStatus(
  id: string,
  status: "available" | "partial" | "processing" | "unknown",
): Promise<{ success: boolean; target: string }> {
  return backendFetch(`/requests/${id}/mark`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

/* ── Profiles ────────────────────────────────────────────────────── */

export async function getProfiles(): Promise<{ profiles: import("./types").SeerProfile[] }> {
  return backendFetch("/profiles");
}

export async function getProfileOptions(): Promise<{
  radarr: import("./types").ArrServerInfo[];
  sonarr: import("./types").ArrServerInfo[];
}> {
  return backendFetch("/profiles/options");
}

/* ── Bulk actions ────────────────────────────────────────────────── */

export async function bulkDeleteRequests(ids: string[]): Promise<{ deleted: number; errors: number }> {
  return backendFetch("/requests/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export async function bulkRetryRequests(ids: string[], profileId?: string | null): Promise<{ retried: number; errors: number }> {
  const body: Record<string, unknown> = { ids };
  if (profileId !== undefined) body.profileId = profileId;
  return backendFetch("/requests/bulk-retry", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* ── Queue ────────────────────────────────────────────────────────── */

export async function getQueueStatus(): Promise<QueueStatus> {
  return backendFetch("/queue/status");
}

/* ── Stats ────────────────────────────────────────────────────────── */

export async function getStats(): Promise<StatsResponse> {
  return backendFetch("/stats");
}

/* ── Stats overview (Jellyseerr source de vérité) ────────────────── */

export interface RequestsStatsOverview {
  total: number;
  byStatus: Record<string, number>;
  byType: { movie: number; tv: number };
}

export async function getRequestsStats(): Promise<RequestsStatsOverview> {
  return backendFetch("/requests/stats");
}

/* ── Admin users (permissions / quotas) ──────────────────────────── */

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  return backendFetch("/admin/users");
}

export async function updateAdminUser(
  jellyfinUserId: string,
  patch: UpdateAdminUserBody,
): Promise<AdminUserRow> {
  return backendFetch(`/admin/users/${encodeURIComponent(jellyfinUserId)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function syncAdminUsers(): Promise<{ synced: number; failed: number; created: number; total: number }> {
  return backendFetch("/admin/users/sync", { method: "POST" });
}

export interface SyncRequestsOwnershipResult {
  total: number;
  reassigned: number;
  recreated: number;
  alreadyOk: number;
  orphansCreated: number;
  failed: number;
  errors: Array<{ requestId: string; reason: string }>;
}

export async function syncRequestsOwnership(): Promise<SyncRequestsOwnershipResult> {
  return backendFetch("/admin/sync-requests-ownership", { method: "POST" });
}

/* ── Config check ────────────────────────────────────────────────── */

export async function isSeerConfigured(): Promise<boolean> {
  try {
    const res = await fetch(configUrl(), {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.enabled && data.url && (data.hasApiKey || data.apiKey)) {
      setConfigured(true);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
