import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMediaDetail } from "../hooks/useMediaDetail";
import { useMediaSimilar } from "../hooks/useMediaSimilar";
import { useWatchProviders } from "../hooks/useWatchProviders";
import { useRichTrailers } from "../hooks/useRichTrailers";
import { useRequestMedia } from "../hooks/useRequestMedia";
import { useToast } from "../hooks/useToast";
import { formatSeerError } from "../api/seer-client";
import { ModalDetailHeader } from "./ModalDetailHeader";
import { DetailActionBar } from "./DetailActionBar";
import { TrailerModal } from "./TrailerModal";
import { ExtrasRow } from "./ExtrasRow";
import { NextEpisodeBanner } from "./NextEpisodeBanner";
import { SeasonRow } from "./SeasonRow";
import { SeriesSeasonPicker } from "./SeriesSeasonPicker";
import { MovieRequestSection } from "./MovieRequestSection";
import { DetailMetaGrid } from "./DetailMetaGrid";
import { CastRow } from "./CastRow";
import { WatchProviders } from "./WatchProviders";
import { SimilarMedia } from "./SimilarMedia";
import { mediaTitle, mediaYear } from "../utils/media-helpers";
import type { SeerrSearchResult, SeerrTvDetail, SeerrMovieDetail } from "../api/types";

interface MediaDetailModalProps {
  item: SeerrSearchResult;
  onClose: () => void;
  onRequest: (item: SeerrSearchResult) => void;
  requesting: boolean;
  /** Saisons déjà demandées dans Tentacle (verrouillées, non décochables) */
  lockedSeasons?: number[];
  /** Profil par défaut pré-sélectionné */
  defaultProfileId?: string | null;
}

export function MediaDetailModal({ item, onClose, lockedSeasons, defaultProfileId }: MediaDetailModalProps) {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [currentItem, setCurrentItem] = useState(item);
  const [navStack, setNavStack] = useState<SeerrSearchResult[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [movieProfileId, setMovieProfileId] = useState<string | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [trailerIndex, setTrailerIndex] = useState(0);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);

  const mediaType = currentItem.mediaType === "movie" ? "movie" as const : "tv" as const;
  const { data: detail, isLoading } = useMediaDetail(mediaType, currentItem.id);
  const { data: similar } = useMediaSimilar(mediaType, currentItem.id);
  const { data: providers } = useWatchProviders(mediaType, currentItem.id);
  const mediaStatus = detail?.mediaInfo?.status ?? currentItem.mediaInfo?.status ?? 0;
  const { data: trailers } = useRichTrailers(mediaType, currentItem.id, mediaStatus);
  const requestMedia = useRequestMedia();

  const title = mediaTitle(currentItem) || t("seer:untitled");
  const year = mediaYear(currentItem);
  const tvDetail = detail as SeerrTvDetail | undefined;

  // Détection anime : genre Animation (16) + origine JP/KR, ou keyword TMDB anime
  const isAnime = useMemo(() => {
    const genres = detail?.genres?.map((g) => g.id) ?? currentItem.genreIds ?? [];
    const origins = (currentItem as any).originCountry ?? [];
    const hasAnimation = genres.includes(16);
    const isJapanese = origins.includes("JP") || origins.includes("KR") || detail?.originalLanguage === "ja";
    const keywords = ((detail as any)?.keywords as Array<{ id: number }>) ?? [];
    const hasAnimeKeyword = keywords.some((k) => k.id === 210024);
    return hasAnimeKeyword || (hasAnimation && isJapanese);
  }, [detail, currentItem]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const bridge = (window as unknown as Record<string, unknown>).__tentacle_bridge as
      { setOverlay?: (open: boolean) => void } | undefined;
    bridge?.setOverlay?.(true);
    return () => {
      document.body.style.overflow = "";
      bridge?.setOverlay?.(false);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !trailerOpen) handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose, trailerOpen]);

  const requestedSeasonMap = useMemo(() => {
    const map = new Map<number, number>();
    if (tvDetail?.mediaInfo?.seasons) {
      for (const s of tvDetail.mediaInfo.seasons) map.set(s.seasonNumber, s.status);
    }
    return map;
  }, [tvDetail?.mediaInfo?.seasons]);

  const handleSeasonRequest = (seasons: number[], profileId?: string | null) => {
    requestMedia.mutate({
      mediaType: "tv", tmdbId: currentItem.id, title,
      posterPath: currentItem.posterPath, backdropPath: currentItem.backdropPath,
      overview: currentItem.overview, year, seasons, profileId,
    }, {
      onSuccess: () => { toast.show("success", t("requestAdded")); handleClose(); },
      onError: (err) => toast.show("error", formatSeerError(err, t, "seer:requestError")),
    });
  };

  const handleMovieRequest = () => {
    setRequestSuccess(false);
    requestMedia.mutate({
      mediaType: "movie", tmdbId: currentItem.id, title,
      posterPath: currentItem.posterPath, backdropPath: currentItem.backdropPath,
      overview: currentItem.overview, year, profileId: movieProfileId,
    }, {
      onSuccess: () => {
        setRequestSuccess(true);
        toast.show("success", t("requestAdded"));
        setTimeout(() => handleClose(), 600);
      },
      onError: (err) => toast.show("error", formatSeerError(err, t, "seer:requestError")),
    });
  };

  const handleSelectSimilar = (newItem: SeerrSearchResult) => {
    setNavStack((prev) => [...prev, currentItem]);
    setCurrentItem(newItem);
    setSynopsisExpanded(false);
    setExpandedSeason(null);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    if (navStack.length === 0) { handleClose(); return; }
    const prev = navStack[navStack.length - 1];
    setNavStack((s) => s.slice(0, -1));
    setCurrentItem(prev);
    setSynopsisExpanded(false);
    setExpandedSeason(null);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const overview = detail?.overview ?? currentItem.overview;
  const cast = detail?.credits?.cast;
  const isTv = currentItem.mediaType === "tv";
  const tvSeasons = (tvDetail?.seasons ?? []).filter((s) => s.seasonNumber > 0);
  // Série entièrement disponible → mode consultation (saisons/épisodes/dates),
  // le picker de demande n'apparaît que s'il reste des saisons à demander.
  const tvFullyAvailable = isTv && mediaStatus === 5;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={handleClose}
      style={{ animation: isClosing ? "fadeOut 200ms ease forwards" : "fadeIn 200ms ease forwards" }}
    >
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
      <div
        ref={scrollRef}
        className="relative max-h-[94dvh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-2xl bg-tentacle-surface-1 pb-[env(safe-area-inset-bottom)] sm:max-h-[90vh] sm:rounded-2xl lg:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          animation: isClosing ? "fadeOut 200ms ease forwards" : "fadeSlideUp 300ms ease forwards",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--brand) transparent",
        }}
      >
        <ModalDetailHeader
          item={currentItem}
          detail={detail as SeerrMovieDetail | SeerrTvDetail | undefined}
          mediaType={mediaType}
          navStack={navStack}
          onBack={handleBack}
          onClose={handleClose}
        />

        <div className="space-y-6 px-4 pb-6 sm:px-6">
          <DetailActionBar
            mediaType={mediaType}
            tmdbId={currentItem.id}
            mediaStatus={mediaStatus}
            trailers={trailers ?? []}
            onOpenTrailer={() => { setTrailerIndex(0); setTrailerOpen(true); }}
          />

          {/* Prochain épisode (séries en cours) */}
          {isTv && tvDetail?.nextEpisodeToAir?.airDate && (
            <NextEpisodeBanner episode={tvDetail.nextEpisodeToAir} />
          )}

          {/* Synopsis */}
          {overview && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">{t("synopsisTitle")}</h4>
              <p className={`text-sm leading-relaxed text-white/65 sm:text-base ${synopsisExpanded ? "" : "line-clamp-3"}`}>{overview}</p>
              {overview.length > 200 && (
                <button
                  onClick={() => setSynopsisExpanded((v) => !v)}
                  className="mt-1 min-h-[32px] rounded text-xs font-medium text-tentacle-brand-light focus:outline-none focus:ring-2 focus:ring-tentacle-brand/50"
                >
                  {synopsisExpanded ? t("showLess") : t("showMore")}
                </button>
              )}
            </div>
          )}

          {/* Extras (trailers + teasers) AU-DESSUS des saisons, comme MediaDetail (core) */}
          {(trailers?.length ?? 0) > 0 && (
            <ExtrasRow
              trailers={trailers ?? []}
              onSelect={(i) => { setTrailerIndex(i); setTrailerOpen(true); }}
            />
          )}

          {/* Série 100% dispo → consultation : saisons + épisodes + dates */}
          {tvFullyAvailable && tvSeasons.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">{t("seer:seasonsTitle")}</h4>
              {tvSeasons.map((season) => (
                <SeasonRow
                  key={season.seasonNumber}
                  tvId={currentItem.id}
                  season={season}
                  status={requestedSeasonMap.get(season.seasonNumber)}
                  expanded={expandedSeason === season.seasonNumber}
                  onExpandToggle={() =>
                    setExpandedSeason((cur) => (cur === season.seasonNumber ? null : season.seasonNumber))
                  }
                />
              ))}
            </div>
          )}

          {/* Série incomplète → sélection de saisons à demander */}
          {isTv && !tvFullyAvailable && !isLoading && tvSeasons.length > 0 && (
            <SeriesSeasonPicker
              tvId={currentItem.id}
              seasons={tvSeasons}
              requestedSeasons={requestedSeasonMap}
              onRequest={handleSeasonRequest}
              requesting={requestMedia.isPending}
              isAnime={isAnime}
              lockedSeasons={lockedSeasons}
              defaultProfileId={defaultProfileId}
            />
          )}

          {isLoading && isTv && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-tentacle-brand border-t-transparent" />
            </div>
          )}

          {/* Film → demande (profil + CTA) ou badge déjà demandé */}
          {currentItem.mediaType === "movie" && (
            <MovieRequestSection
              mediaStatus={mediaStatus}
              isAnime={isAnime}
              requesting={requestMedia.isPending}
              requestSuccess={requestSuccess}
              profileId={movieProfileId}
              onProfileChange={setMovieProfileId}
              onRequest={handleMovieRequest}
            />
          )}

          {providers && providers.length > 0 && <WatchProviders providers={providers} />}
          {cast && cast.length > 0 && <CastRow cast={cast} />}
          <DetailMetaGrid detail={detail as SeerrMovieDetail | SeerrTvDetail | undefined} mediaType={mediaType} />
          {similar && similar.length > 0 && (
            <SimilarMedia items={similar} onSelect={handleSelectSimilar} />
          )}
        </div>
      </div>

      <TrailerModal
        open={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        trailers={trailers ?? []}
        initialIndex={trailerIndex}
      />
    </div>
  );
}
