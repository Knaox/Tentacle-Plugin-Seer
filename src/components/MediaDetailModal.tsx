import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMediaDetail } from "../hooks/useMediaDetail";
import { useMediaVideos } from "../hooks/useMediaVideos";
import { useMediaSimilar } from "../hooks/useMediaSimilar";
import { useWatchProviders } from "../hooks/useWatchProviders";
import { useRequestMedia } from "../hooks/useRequestMedia";
import { useToast } from "../hooks/useToast";
import { SeriesSeasonPicker } from "./SeriesSeasonPicker";
import { CastRow } from "./CastRow";
import { TrailerPlayer } from "./TrailerPlayer";
import { WatchProviders } from "./WatchProviders";
import { SimilarMedia } from "./SimilarMedia";
import {
  posterUrl, backdropUrl, mediaTitle, mediaYear,
  formatRuntime, ratingColor,
} from "../utils/media-helpers";
import type { SeerrSearchResult, SeerrTvDetail } from "../api/types";

interface MediaDetailModalProps {
  item: SeerrSearchResult;
  onClose: () => void;
  onRequest: (item: SeerrSearchResult) => void;
  requesting: boolean;
}

export function MediaDetailModal({ item, onClose, onRequest, requesting }: MediaDetailModalProps) {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Internal navigation: allow switching item within the modal (for similar media)
  const [currentItem, setCurrentItem] = useState(item);

  const mediaType = currentItem.mediaType === "movie" ? "movie" as const : "tv" as const;
  const { data: detail, isLoading } = useMediaDetail(mediaType, currentItem.id);
  const { data: trailer } = useMediaVideos(mediaType, currentItem.id);
  const { data: similar } = useMediaSimilar(mediaType, currentItem.id);
  const { data: providers } = useWatchProviders(mediaType, currentItem.id);
  const requestMedia = useRequestMedia();
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  const title = mediaTitle(currentItem) || t("seer:untitled");
  const year = mediaYear(currentItem);
  const backdrop = backdropUrl(currentItem.backdropPath);
  const poster = posterUrl(currentItem.posterPath);
  const tvDetail = detail as SeerrTvDetail | undefined;
  const rating = detail?.voteAverage ?? currentItem.voteAverage;

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const requestedSeasonMap = useMemo(() => {
    const map = new Map<number, number>();
    if (tvDetail?.mediaInfo?.seasons) {
      for (const s of tvDetail.mediaInfo.seasons) map.set(s.seasonNumber, s.status);
    }
    return map;
  }, [tvDetail?.mediaInfo?.seasons]);

  const handleSeasonRequest = (seasons: number[]) => {
    requestMedia.mutate({
      mediaType: "tv", tmdbId: currentItem.id, title,
      posterPath: currentItem.posterPath, backdropPath: currentItem.backdropPath,
      overview: currentItem.overview, year, seasons,
    }, {
      onSuccess: () => { toast.show("success", t("requestAdded")); onClose(); },
      onError: () => toast.show("error", t("requestError")),
    });
  };

  const handleMovieRequest = () => {
    onRequest(currentItem);
    setTimeout(() => onClose(), 300);
  };

  const handleSelectSimilar = (newItem: SeerrSearchResult) => {
    setCurrentItem(newItem);
    setSynopsisExpanded(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const overview = detail?.overview ?? currentItem.overview;
  const cast = detail?.credits?.cast;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
      style={{ animation: "fadeIn 200ms ease forwards" }}
    >
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
      <div
        ref={scrollRef}
        className="relative max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[#12121a] sm:max-h-[90vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "fadeSlideUp 300ms ease forwards" }}
      >
        {/* Backdrop */}
        <div className="relative h-64 w-full overflow-hidden rounded-t-2xl sm:h-80">
          {backdrop ? (
            <img src={backdrop} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #12121a 100%)" }} />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #12121a 0%, rgba(18,18,26,0.85) 30%, rgba(18,18,26,0.4) 60%, transparent 100%)" }} />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header: poster + info */}
        <div className="flex gap-4 px-5 pb-4" style={{ marginTop: -80 }}>
          {poster ? (
            <img src={poster} alt={title} className="relative h-[225px] w-[150px] flex-shrink-0 rounded-xl object-cover shadow-xl" />
          ) : (
            <div className="relative flex h-[225px] w-[150px] flex-shrink-0 items-center justify-center rounded-xl bg-[#1a1a2e] shadow-xl">
              <svg className="h-12 w-12 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
                {mediaType === "tv" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125Z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                )}
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1 pt-2">
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/40">
              {year && <span>{year}</span>}
              {detail && "runtime" in detail && detail.runtime ? (
                <span>{formatRuntime(detail.runtime)}</span>
              ) : tvDetail?.numberOfSeasons ? (
                <span>{t("seasonsCount", { count: tvDetail.numberOfSeasons })}</span>
              ) : null}
              {rating != null && rating > 0 && (
                <span className={`flex items-center gap-1 font-semibold ${ratingColor(rating)}`}>
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {rating.toFixed(1)}
                </span>
              )}
            </div>
            {detail?.genres && detail.genres.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {detail.genres.map((g) => (
                  <span key={g.id} className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white/60">{g.name}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-7 px-5 pb-6">
          {/* Synopsis expandable */}
          {overview && (
            <div>
              <p className={`text-sm leading-relaxed text-white/50 ${synopsisExpanded ? "" : "line-clamp-3"}`}>{overview}</p>
              {overview.length > 200 && (
                <button onClick={() => setSynopsisExpanded((v) => !v)} className="mt-1 text-xs text-purple-400 hover:text-purple-300">
                  {synopsisExpanded ? t("showLess") : t("showMore")}
                </button>
              )}
            </div>
          )}

          {providers && providers.length > 0 && <WatchProviders providers={providers} />}
          {trailer && <TrailerPlayer videoKey={trailer.key} />}
          {cast && cast.length > 0 && <CastRow cast={cast} />}

          {/* Action */}
          {currentItem.mediaType === "movie" && (
            detail?.mediaInfo?.status === 5 ? (
              <div className="w-full rounded-lg bg-emerald-500/20 py-3 text-center text-sm font-semibold text-emerald-400">
                {t("heroAvailable")}
              </div>
            ) : (detail?.mediaInfo?.status ?? 0) >= 2 ? (
              <div className="w-full rounded-lg bg-amber-500/20 py-3 text-center text-sm font-semibold text-amber-400">
                {t("alreadyRequested")}
              </div>
            ) : (
              <button
                onClick={handleMovieRequest}
                disabled={requesting}
                className="w-full rounded-lg bg-purple-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
              >
                {requesting ? t("seer:requestingMovie") : t("seer:requestMovie")}
              </button>
            )
          )}

          {currentItem.mediaType === "tv" && !isLoading && detail && (detail as SeerrTvDetail).seasons && (
            <SeriesSeasonPicker
              seasons={(detail as SeerrTvDetail).seasons ?? []}
              requestedSeasons={requestedSeasonMap}
              onRequest={handleSeasonRequest}
              requesting={requestMedia.isPending}
            />
          )}

          {isLoading && currentItem.mediaType === "tv" && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            </div>
          )}

          {similar && similar.length > 0 && (
            <SimilarMedia items={similar} onSelect={handleSelectSimilar} />
          )}
        </div>
      </div>
    </div>
  );
}
