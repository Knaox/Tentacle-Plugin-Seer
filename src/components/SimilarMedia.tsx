import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { posterUrl, mediaTitle, mediaYear } from "../utils/media-helpers";
import type { SeerrSearchResult } from "../api/types";

interface SimilarMediaProps {
  items: SeerrSearchResult[];
  onSelect: (item: SeerrSearchResult) => void;
}

export function SimilarMedia({ items, onSelect }: SimilarMediaProps) {
  const { t } = useTranslation("seer");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    return () => el.removeEventListener("scroll", updateArrows);
  }, [updateArrows, items.length]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          {t("similarMedia")}
        </h3>
        {(canScrollLeft || canScrollRight) && (
          <div className="flex gap-1">
            <button
              onClick={() => scroll(-1)}
              disabled={!canScrollLeft}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 disabled:opacity-20"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => scroll(1)}
              disabled={!canScrollRight}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 disabled:opacity-20"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.3) transparent", cursor: "grab" }}
        onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.cursor = "grabbing"; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.cursor = "grab"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.cursor = "grab"; }}
      >
        {items.map((item) => {
          const poster = posterUrl(item.posterPath, "w185");
          const title = mediaTitle(item);
          const year = mediaYear(item);
          const rating = item.voteAverage;
          return (
            <button
              key={`${item.mediaType}-${item.id}`}
              onClick={() => onSelect(item)}
              className="flex w-[100px] flex-shrink-0 flex-col transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500/50 rounded-lg"
            >
              <div className="relative">
                {poster ? (
                  <img
                    src={poster}
                    alt={title}
                    className="aspect-[2/3] w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-white/5 text-white/20">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                  </div>
                )}
                {rating != null && rating > 0 && (
                  <span className="absolute right-1 top-1 flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[8px] font-bold text-amber-400 backdrop-blur-sm">
                    <svg className="h-2 w-2" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    {rating.toFixed(1)}
                  </span>
                )}
              </div>
              <span className="mt-1 truncate text-[11px] font-medium text-white/60">
                {title}
              </span>
              <span className="text-[9px] text-white/30">{year}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
