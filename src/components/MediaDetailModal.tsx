import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMediaDetail } from "../hooks/useMediaDetail";
import { useMediaVideos } from "../hooks/useMediaVideos";
import { useMediaSimilar } from "../hooks/useMediaSimilar";
import { useWatchProviders } from "../hooks/useWatchProviders";
import { useRequestMedia } from "../hooks/useRequestMedia";
import { useToast } from "../hooks/useToast";
import { ModalDetailHeader } from "./ModalDetailHeader";
import { SeriesSeasonPicker } from "./SeriesSeasonPicker";
import { CastRow } from "./CastRow";
import { TrailerPlayer } from "./TrailerPlayer";
import { WatchProviders } from "./WatchProviders";
import { SimilarMedia } from "./SimilarMedia";
import { mediaTitle, mediaYear } from "../utils/media-helpers";
import type { SeerrSearchResult, SeerrTvDetail, SeerrMovieDetail } from "../api/types";

interface MediaDetailModalProps {
  item: SeerrSearchResult;
  onClose: () => void;
  onRequest: (item: SeerrSearchResult) => void;
  requesting: boolean;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

export function MediaDetailModal({ item, onClose, onRequest, requesting }: MediaDetailModalProps) {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [currentItem, setCurrentItem] = useState(item);
  const [navStack, setNavStack] = useState<SeerrSearchResult[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  const mediaType = currentItem.mediaType === "movie" ? "movie" as const : "tv" as const;
  const { data: detail, isLoading } = useMediaDetail(mediaType, currentItem.id);
  const { data: trailer } = useMediaVideos(mediaType, currentItem.id);
  const { data: similar } = useMediaSimilar(mediaType, currentItem.id);
  const { data: providers } = useWatchProviders(mediaType, currentItem.id);
  const requestMedia = useRequestMedia();

  const title = mediaTitle(currentItem) || t("seer:untitled");
  const year = mediaYear(currentItem);
  const tvDetail = detail as SeerrTvDetail | undefined;
  const movieDetail = detail as SeerrMovieDetail | undefined;

  // Enriched fields from detail
  const productionStatus = detail?.status;
  const originalLanguage = detail?.originalLanguage;
  const productionCompanies = (detail as Record<string, unknown>)?.productionCompanies as
    { id: number; name: string; logoPath?: string }[] | undefined;
  const director = mediaType === "movie"
    ? movieDetail?.credits?.crew?.find((c) => c.job === "Director") : null;
  const creators = mediaType === "tv" ? tvDetail?.createdBy : null;
  const networks = mediaType === "tv" ? tvDetail?.networks : null;
  const budget = mediaType === "movie" ? movieDetail?.budget : undefined;
  const revenue = mediaType === "movie" ? movieDetail?.revenue : undefined;

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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

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
      onSuccess: () => { toast.show("success", t("requestAdded")); handleClose(); },
      onError: () => toast.show("error", t("requestError")),
    });
  };

  const handleMovieRequest = () => {
    setRequestSuccess(false);
    onRequest(currentItem);
    setRequestSuccess(true);
    setTimeout(() => handleClose(), 600);
  };

  const handleSelectSimilar = (newItem: SeerrSearchResult) => {
    setNavStack((prev) => [...prev, currentItem]);
    setCurrentItem(newItem);
    setSynopsisExpanded(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    if (navStack.length === 0) { handleClose(); return; }
    const prev = navStack[navStack.length - 1];
    setNavStack((s) => s.slice(0, -1));
    setCurrentItem(prev);
    setSynopsisExpanded(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const overview = detail?.overview ?? currentItem.overview;
  const cast = detail?.credits?.cast;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={handleClose}
      style={{ animation: isClosing ? "fadeOut 200ms ease forwards" : "fadeIn 200ms ease forwards" }}
    >
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
      <div
        ref={scrollRef}
        className="relative max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[#12121a] sm:max-h-[90vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: isClosing ? "fadeOut 200ms ease forwards" : "fadeSlideUp 300ms ease forwards",
          scrollbarWidth: "thin",
          scrollbarColor: "#8b5cf6 transparent",
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

        <div className="space-y-7 px-5 pb-6">
          {/* Meta info grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-white/50">
            {director && (
              <span><span className="text-white/30">{t("detailDirector")}:</span> {director.name}</span>
            )}
            {creators && creators.length > 0 && (
              <span><span className="text-white/30">{t("detailCreator")}:</span> {creators.map((c) => c.name).join(", ")}</span>
            )}
            {productionStatus && (
              <span><span className="text-white/30">{t("detailStatus")}:</span> {productionStatus}</span>
            )}
            {originalLanguage && (
              <span><span className="text-white/30">{t("detailLanguage")}:</span> {originalLanguage.toUpperCase()}</span>
            )}
            {networks && networks.length > 0 && (
              <span><span className="text-white/30">{t("detailNetwork")}:</span> {networks.map((n) => n.name).join(", ")}</span>
            )}
            {budget != null && budget > 0 && (
              <span><span className="text-white/30">{t("detailBudget")}:</span> {formatCurrency(budget)}</span>
            )}
            {revenue != null && revenue > 0 && (
              <span><span className="text-white/30">{t("detailRevenue")}:</span> {formatCurrency(revenue)}</span>
            )}
          </div>

          {/* Production companies */}
          {productionCompanies && productionCompanies.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">{t("detailStudios")}</h4>
              <div className="flex flex-wrap gap-2">
                {productionCompanies.map((co) => (
                  <span key={co.id} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/50">{co.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Synopsis */}
          {overview && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">{t("synopsisTitle")}</h4>
              <p className={`text-base leading-relaxed text-white/60 ${synopsisExpanded ? "" : "line-clamp-3"}`}>{overview}</p>
              {overview.length > 200 && (
                <button
                  onClick={() => setSynopsisExpanded((v) => !v)}
                  className="mt-1 rounded text-xs text-purple-400 hover:text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  {synopsisExpanded ? t("showLess") : t("showMore")}
                </button>
              )}
            </div>
          )}

          {providers && providers.length > 0 && <WatchProviders providers={providers} />}
          {trailer && <TrailerPlayer videoKey={trailer.key} />}
          {cast && cast.length > 0 && <CastRow cast={cast} />}

          {/* Movie request action */}
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
                disabled={requesting || requestSuccess}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                {requesting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t("seer:requestingMovie")}
                  </>
                ) : requestSuccess ? (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {t("requestAdded")}
                  </>
                ) : t("seer:requestMovie")}
              </button>
            )
          )}

          {/* TV season picker */}
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
