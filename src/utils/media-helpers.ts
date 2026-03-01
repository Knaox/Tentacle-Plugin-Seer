import type { SeerrSearchResult } from "../api/types";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(path?: string | null, size = "w342"): string {
  if (!path) return "";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(path?: string | null, size = "w1280"): string {
  if (!path) return "";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function mediaTitle(item: SeerrSearchResult): string {
  return item.title ?? item.name ?? "";
}

export function mediaYear(item: SeerrSearchResult): string {
  const date = item.releaseDate ?? item.firstAirDate;
  return date ? date.slice(0, 4) : "";
}

export function isAnime(item: SeerrSearchResult): boolean {
  const hasAnimationGenre = item.genreIds?.includes(16) ?? false;
  const isJapanese = item.originCountry?.includes("JP") ?? false;
  return hasAnimationGenre && isJapanese;
}

/** Returns the i18n key for the media type. Use with t(key). */
export function mediaTypeKey(item: SeerrSearchResult): string {
  if (isAnime(item)) return "seer:typeAnime";
  if (item.mediaType === "movie") return "seer:typeMovie";
  if (item.mediaType === "tv") return "seer:typeSeries";
  return item.mediaType;
}
