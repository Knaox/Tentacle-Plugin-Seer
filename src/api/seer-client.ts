import { proxyFetch, configUrl, setSeerrConfig, getSeerBackendUrl } from "./endpoints";
import { langParam, getCurrentLanguage } from "../utils/media-helpers";
import type {
  SeerrPagedResponse,
  SeerrMovieDetail,
  SeerrTvDetail,
  DiscoverCategory,
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

export async function discoverMedia(
  category: DiscoverCategory,
  page = 1,
  watchProviders?: number[],
  sortBy?: string,
): Promise<SeerrPagedResponse> {
  const lang = langParam();
  const wp = watchProviders && watchProviders.length > 0
    ? `&watchProviders=${watchProviders.join("|")}&watchRegion=${getWatchRegion()}`
    : "";
  const sortParam = sortBy ? `&sortBy=${sortBy}` : "";
  const paths: Record<DiscoverCategory, string> = {
    movies: `/api/v1/discover/movies?page=${page}&${lang}${wp}${sortParam}`,
    tv: `/api/v1/discover/tv?page=${page}&${lang}${wp}${sortParam}`,
    anime: `/api/v1/discover/tv?page=${page}&${lang}&genre=16${wp}${sortParam}`,
    trending: `/api/v1/discover/trending?page=${page}&${lang}${wp}`,
  };
  return proxyFetch(paths[category]);
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
    if (data.enabled && data.url) {
      setSeerrConfig(data.url, data.apiKey);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
