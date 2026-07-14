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
import { MediaDetailBody } from "./MediaDetailBody";
import { TrailerModal } from "./TrailerModal";
import { mediaTitle, mediaYear } from "../utils/media-helpers";
import { openTrailersViaHost } from "../utils/external";
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

  // Lecture trailer : via le TrailerModal du HOST (l'embed YouTube ne
  // fonctionne pas dans l'iframe sandboxée), repli modale locale (mobile).
  const openTrailerAt = useCallback((index: number) => {
    const list = trailers ?? [];
    if (openTrailersViaHost(list, index)) return;
    setTrailerIndex(index);
    setTrailerOpen(true);
  }, [trailers]);

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
    // 1) Statuts de disponibilité par saison (présents seulement une fois dispo).
    if (tvDetail?.mediaInfo?.seasons) {
      for (const s of tvDetail.mediaInfo.seasons) map.set(s.seasonNumber, s.status);
    }
    // 2) Saisons couvertes par une demande active : Jellyseerr ne remplit
    //    mediaInfo.seasons qu'à la disponibilité ; une saison seulement demandée
    //    (en attente/traitement) n'est QUE dans mediaInfo.requests[].seasons. On la
    //    marque « en traitement » (3) pour la verrouiller, sans rétrograder une
    //    saison déjà disponible. (statut demande : 3=refusée, 4=échouée → ignorées)
    for (const r of tvDetail?.mediaInfo?.requests ?? []) {
      if (r.status === 3 || r.status === 4) continue;
      for (const se of r.seasons ?? []) {
        const existing = map.get(se.seasonNumber);
        if (existing === undefined || existing < 3) map.set(se.seasonNumber, 3);
      }
    }
    return map;
  }, [tvDetail?.mediaInfo?.seasons, tvDetail?.mediaInfo?.requests]);

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

        <MediaDetailBody
          currentItem={currentItem}
          detail={detail as SeerrMovieDetail | SeerrTvDetail | undefined}
          mediaType={mediaType}
          mediaStatus={mediaStatus}
          trailers={trailers ?? []}
          isLoading={isLoading}
          isTv={isTv}
          tvDetail={tvDetail}
          tvFullyAvailable={tvFullyAvailable}
          tvSeasons={tvSeasons}
          requestedSeasonMap={requestedSeasonMap}
          expandedSeason={expandedSeason}
          onExpandSeasonToggle={(seasonNumber) =>
            setExpandedSeason((cur) => (cur === seasonNumber ? null : seasonNumber))
          }
          onOpenTrailer={openTrailerAt}
          overview={overview}
          synopsisExpanded={synopsisExpanded}
          onToggleSynopsis={() => setSynopsisExpanded((v) => !v)}
          onSeasonRequest={handleSeasonRequest}
          requestingSeasons={requestMedia.isPending}
          isAnime={isAnime}
          lockedSeasons={lockedSeasons}
          defaultProfileId={defaultProfileId}
          requestSuccess={requestSuccess}
          movieProfileId={movieProfileId}
          onMovieProfileChange={setMovieProfileId}
          onMovieRequest={handleMovieRequest}
          providers={providers}
          cast={cast}
          similar={similar}
          onSelectSimilar={handleSelectSimilar}
        />
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
