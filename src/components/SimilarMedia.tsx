import { useTranslation } from "react-i18next";
import { posterUrl, mediaTitle, mediaYear } from "../utils/media-helpers";
import type { SeerrSearchResult } from "../api/types";

interface SimilarMediaProps {
  items: SeerrSearchResult[];
  onSelect: (item: SeerrSearchResult) => void;
}

export function SimilarMedia({ items, onSelect }: SimilarMediaProps) {
  const { t } = useTranslation("seer");

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-white/40">
        {t("similarMedia")}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {items.map((item) => {
          const poster = posterUrl(item.posterPath, "w185");
          const title = mediaTitle(item);
          return (
            <button
              key={`${item.mediaType}-${item.id}`}
              onClick={() => onSelect(item)}
              className="flex w-24 flex-shrink-0 flex-col transition-transform hover:scale-105"
            >
              {poster ? (
                <img
                  src={poster}
                  alt={title}
                  className="aspect-[2/3] w-full rounded-lg object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-white/5 text-white/10">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                </div>
              )}
              <span className="mt-1 truncate text-[10px] font-medium text-white/60">
                {title}
              </span>
              <span className="text-[9px] text-white/30">{mediaYear(item)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
