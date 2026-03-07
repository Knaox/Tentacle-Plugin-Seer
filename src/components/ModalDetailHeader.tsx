import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  posterUrl, backdropUrl, mediaTitle, mediaYear,
  formatRuntime, ratingColor,
} from "../utils/media-helpers";
import type { SeerrSearchResult, SeerrTvDetail, SeerrMovieDetail } from "../api/types";

interface ModalDetailHeaderProps {
  item: SeerrSearchResult;
  detail: SeerrMovieDetail | SeerrTvDetail | undefined;
  mediaType: "movie" | "tv";
  navStack: SeerrSearchResult[];
  onBack: () => void;
  onClose: () => void;
}

export function ModalDetailHeader({ item, detail, mediaType, navStack, onBack, onClose }: ModalDetailHeaderProps) {
  const { t } = useTranslation("seer");
  const [backdropLoaded, setBackdropLoaded] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);

  const title = mediaTitle(item) || t("seer:untitled");
  const year = mediaYear(item);
  const backdrop = backdropUrl(item.backdropPath);
  const poster = posterUrl(item.posterPath);
  const tvDetail = detail as SeerrTvDetail | undefined;
  const movieDetail = detail as SeerrMovieDetail | undefined;
  const rating = detail?.voteAverage ?? item.voteAverage;

  const originalTitle = mediaType === "movie" ? movieDetail?.originalTitle : tvDetail?.originalName;
  const showOriginalTitle = originalTitle && originalTitle !== title;
  const tagline = mediaType === "movie" ? movieDetail?.tagline : tvDetail?.tagline;
  const voteCount = detail?.voteCount;
  const certification = mediaType === "movie"
    ? movieDetail?.certification
    : (tvDetail as Record<string, unknown>)?.certification as string | undefined;

  return (
    <>
      {/* Backdrop */}
      <div className="relative h-64 w-full overflow-hidden rounded-t-2xl sm:h-80">
        {backdrop ? (
          <img
            src={backdrop}
            alt=""
            className="h-full w-full object-cover"
            style={{ opacity: backdropLoaded ? 1 : 0, transition: "opacity 300ms ease" }}
            onLoad={() => setBackdropLoaded(true)}
          />
        ) : (
          <div className="h-full w-full" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #12121a 100%)" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #12121a 0%, rgba(18,18,26,0.85) 30%, rgba(18,18,26,0.4) 60%, transparent 100%)" }} />
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        title={navStack.length > 0 ? mediaTitle(navStack[navStack.length - 1]) || "" : ""}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Nav breadcrumb */}
      {navStack.length > 0 && (
        <div className="absolute left-14 top-4 z-10">
          <button
            onClick={onBack}
            className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white/50 backdrop-blur-sm transition-colors hover:text-white/80"
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            {mediaTitle(navStack[navStack.length - 1])}
          </button>
        </div>
      )}

      {/* Header: poster + info */}
      <div className="flex gap-4 px-5 pb-4" style={{ marginTop: -80 }}>
        {poster ? (
          <img
            src={poster}
            alt={title}
            className="relative h-[225px] w-[150px] flex-shrink-0 rounded-xl object-cover shadow-xl"
            style={{ opacity: posterLoaded ? 1 : 0, transition: "opacity 300ms ease" }}
            onLoad={() => setPosterLoaded(true)}
          />
        ) : (
          <div className="relative flex h-[225px] w-[150px] flex-shrink-0 items-center justify-center rounded-xl bg-[#1a1a2e] shadow-xl">
            <svg className="h-12 w-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
              {mediaType === "tv" ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125Z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              )}
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1 pt-2">
          <h2 className="text-3xl font-bold text-white">{title}</h2>
          {showOriginalTitle && (
            <p className="mt-0.5 text-xs text-white/30">{originalTitle}</p>
          )}
          {tagline && (
            <p className="mt-1 text-sm italic text-white/50">{tagline}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/50">
            {year && <span>{year}</span>}
            {detail && "runtime" in detail && (detail as SeerrMovieDetail).runtime ? (
              <span>{formatRuntime((detail as SeerrMovieDetail).runtime!)}</span>
            ) : tvDetail?.numberOfSeasons ? (
              <span>{t("seasonsCount", { count: tvDetail.numberOfSeasons })}</span>
            ) : null}
            {certification && (
              <span className="rounded border border-white/20 px-1.5 py-0.5 text-[11px] font-semibold text-white/60">
                {certification}
              </span>
            )}
            {rating != null && rating > 0 && (
              <span className={`flex items-center gap-1 font-semibold ${ratingColor(rating)}`}>
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {rating.toFixed(1)}
                {voteCount != null && voteCount > 0 && (
                  <span className="font-normal text-white/30">
                    ({voteCount.toLocaleString()})
                  </span>
                )}
              </span>
            )}
          </div>
          {detail?.genres && detail.genres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {detail.genres.map((g) => (
                <span key={g.id} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">{g.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
