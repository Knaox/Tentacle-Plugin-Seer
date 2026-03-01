import { proxyFetch, configUrl, setSeerrConfig } from "./endpoints";
import type {
  SeerrPagedResponse,
  SeerrMovieDetail,
  SeerrTvDetail,
  SeerrRequestsResponse,
  SeerrMediaRequest,
  DiscoverCategory,
  MediaType,
} from "./types";

function getToken(): string {
  return localStorage.getItem("tentacle_token") ?? "";
}

/* ---- Search ---- */

export async function searchMedia(query: string, page = 1): Promise<SeerrPagedResponse> {
  return proxyFetch(`/api/v1/search?query=${encodeURIComponent(query)}&page=${page}&language=fr`);
}

/* ---- Discover ---- */

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

/* ---- Media details ---- */

export async function getMovieDetail(id: number): Promise<SeerrMovieDetail> {
  return proxyFetch(`/api/v1/movie/${id}?language=fr`);
}

export async function getTvDetail(id: number): Promise<SeerrTvDetail> {
  return proxyFetch(`/api/v1/tv/${id}?language=fr`);
}

/* ---- Requests (direct to Seerr API) ---- */

export async function createRequest(body: {
  mediaType: MediaType;
  tmdbId: number;
  seasons?: number[];
}): Promise<SeerrMediaRequest> {
  return proxyFetch(`/api/v1/request`, {
    method: "POST",
    body: {
      mediaType: body.mediaType,
      mediaId: body.tmdbId,
      seasons: body.seasons,
    },
  });
}

export async function getMyRequests(
  page = 1,
  limit = 20,
): Promise<SeerrRequestsResponse> {
  const skip = (page - 1) * limit;
  return proxyFetch(`/api/v1/request?take=${limit}&skip=${skip}&sort=added&requestedBy=1`);
}

export async function deleteRequest(id: number): Promise<void> {
  await proxyFetch(`/api/v1/request/${id}`, { method: "DELETE" });
}

/* ---- Config check ---- */

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
