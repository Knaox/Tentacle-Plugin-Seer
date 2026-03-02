import { proxyFetch, configUrl, setSeerrConfig, getSeerBackendUrl } from "./endpoints";
import type {
  SeerrPagedResponse,
  SeerrMovieDetail,
  SeerrTvDetail,
  DiscoverCategory,
  MediaType,
  LocalRequest,
  LocalRequestsResponse,
  QueueStatus,
  NotificationsResponse,
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

/* ── Search (Seerr proxy) ────────────────────────────────────────── */

export async function searchMedia(query: string, page = 1): Promise<SeerrPagedResponse> {
  return proxyFetch(`/api/v1/search?query=${encodeURIComponent(query)}&page=${page}&language=fr`);
}

/* ── Discover (Seerr proxy) ──────────────────────────────────────── */

export async function discoverMedia(
  category: DiscoverCategory,
  page = 1,
): Promise<SeerrPagedResponse> {
  const paths: Record<DiscoverCategory, string> = {
    movies: `/api/v1/discover/movies?page=${page}&language=fr`,
    tv: `/api/v1/discover/tv?page=${page}&language=fr`,
    anime: `/api/v1/discover/tv?page=${page}&language=fr&genre=16`,
    trending: `/api/v1/discover/trending?page=${page}&language=fr`,
  };
  return proxyFetch(paths[category]);
}

/* ── Media details (Seerr proxy) ─────────────────────────────────── */

export async function getMovieDetail(id: number): Promise<SeerrMovieDetail> {
  return proxyFetch(`/api/v1/movie/${id}?language=fr`);
}

export async function getTvDetail(id: number): Promise<SeerrTvDetail> {
  return proxyFetch(`/api/v1/tv/${id}?language=fr`);
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

/* ── Notifications ───────────────────────────────────────────────── */

export async function getNotifications(
  opts?: { unread?: boolean; limit?: number; page?: number },
): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  if (opts?.unread) params.set("unread", "true");
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.page) params.set("page", String(opts.page));
  return backendFetch(`/notifications?${params}`);
}

export async function getUnreadCount(): Promise<number> {
  const data = await backendFetch<{ count: number }>("/notifications/unread-count");
  return data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await backendFetch(`/notifications/${id}/read`, { method: "PUT" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await backendFetch("/notifications/read-all", { method: "POST" });
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
