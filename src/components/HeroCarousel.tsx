import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../api/types";
import { backdropUrl, posterUrl, mediaTitle, mediaYear } from "../utils/media-helpers";

interface HeroCarouselProps {
  items: SeerrSearchResult[];
  onSelect: (item: SeerrSearchResult) => void;
  onRequest: (item: SeerrSearchResult) => void;
}

export function HeroCarousel({ items, onSelect, onRequest }: HeroCarouselProps) {
  const { t } = useTranslation("seer");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const slides = items.slice(0, 5);

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    timerRef.current = setTimeout(advance, 6000);
    return () => clearTimeout(timerRef.current);
  }, [index, paused, advance, slides.length]);

  if (slides.length === 0) return null;
  const item = slides[index];
  const title = mediaTitle(item);
  const year = mediaYear(item);
  const backdrop = backdropUrl(item.backdropPath, "w1280");
  const poster = posterUrl(item.posterPath, "w342");
  const hasMediaInfo = item.mediaInfo && item.mediaInfo.status > 1;
  const isAvailable = item.mediaInfo?.status === 5;
  const isRequested = !isAvailable && (item.mediaInfo?.status ?? 0) >= 2;

  return (
    <div
      className="relative h-[380px] overflow-hidden sm:h-[440px] lg:h-[500px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity"
        style={{ backgroundImage: backdrop ? `url(${backdrop})` : undefined, transitionDuration: "600ms" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/70 to-[#0a0a0f]/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f]/80 via-[#0a0a0f]/30 to-transparent" />
      </div>

      {/* Content */}
      <div
        className="relative flex h-full items-end gap-5 px-6 pb-8 sm:px-10"
        style={{ animation: "fadeSlideUp 600ms ease forwards" }}
        key={index}
      >
        {/* Poster */}
        {poster && (
          <img
            src={poster}
            alt={title}
            className="hidden h-52 w-36 flex-shrink-0 rounded-xl object-cover shadow-2xl sm:block lg:h-60 lg:w-40"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h2
            className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
          >
            {title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
            {year && <span>{year}</span>}
            {item.voteAverage != null && item.voteAverage > 0 && (
              <span className="flex items-center gap-1 font-semibold text-amber-400">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {item.voteAverage.toFixed(1)}
              </span>
            )}
            {item.genreIds && item.genreIds.length > 0 && (
              <span className="text-white/60">
                {item.mediaType === "movie" ? t("typeMovie") : t("typeSeries")}
              </span>
            )}
          </div>
          {item.overview && (
            <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-white/80" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
              {item.overview}
            </p>
          )}
          <div className="mt-1 flex items-center gap-3">
            {isAvailable && (
              <span className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-400">
                {t("heroAvailable")}
              </span>
            )}
            {isRequested && (
              <span className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-400">
                {t("heroRequested")}
              </span>
            )}
            {!isAvailable && !isRequested && (
              <button
                onClick={(e) => { e.stopPropagation(); onRequest(item); }}
                className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                style={{
                  background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
                  boxShadow: "0 8px 30px rgba(139,92,246,0.4)",
                }}
              >
                {t("request")}
              </button>
            )}
            <button
              onClick={() => onSelect(item)}
              className="rounded-lg border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              {t("moreInfo")}
            </button>
          </div>
        </div>
      </div>

      {/* Indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 right-6 flex gap-1.5 sm:right-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                i === index ? "w-6 bg-purple-500" : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
