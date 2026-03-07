import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../api/types";
import { posterUrl, mediaTitle, mediaYear, mediaTypeKey } from "../utils/media-helpers";

interface MediaCardProps {
  item: SeerrSearchResult;
  onRequest?: (item: SeerrSearchResult) => void;
  onClick?: (item: SeerrSearchResult) => void;
  requesting?: boolean;
  style?: React.CSSProperties;
}

function StatusBadge({ status }: { status: number }) {
  const { t } = useTranslation("seer");
  const config: Record<number, { cls: string; key: string }> = {
    2: { cls: "bg-amber-500/80", key: "statusPending" },
    3: { cls: "bg-blue-500/80", key: "statusProcessing" },
    4: { cls: "bg-orange-500/80", key: "statusPartiallyAvailable" },
    5: { cls: "bg-emerald-500/80", key: "statusAvailable" },
  };
  const c = config[status];
  if (!c) return null;
  return (
    <span className={`absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm ${c.cls}`}>
      {t(c.key)}
    </span>
  );
}

function PosterFallback({ label, mediaType }: { label: string; mediaType?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#1a1a2e]">
      {mediaType === "tv" ? (
        <svg className="h-10 w-10 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125Z" />
        </svg>
      ) : (
        <svg className="h-10 w-10 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5c0 .621-.504 1.125-1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m0-3.75h-1.5m0 0c-.621 0-1.125-.504-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125m0 3.75c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125" />
        </svg>
      )}
    </div>
  );
}

export function MediaCard({ item, onRequest, onClick, requesting, style }: MediaCardProps) {
  const { t } = useTranslation("seer");
  const [imgLoaded, setImgLoaded] = useState(false);
  const title = mediaTitle(item) || t("seer:untitled");
  const year = mediaYear(item);
  const type = t(mediaTypeKey(item));
  const poster = posterUrl(item.posterPath);
  const mediaStatus = item.mediaInfo?.status ?? 0;
  const hasMediaInfo = mediaStatus > 1;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl transition-all duration-300 focus-within:ring-2 focus-within:ring-purple-500/50"
      style={{
        ...style,
        willChange: "transform",
      }}
      onClick={() => onClick?.(item)}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.transform = "scale(1.05) translateY(-6px)";
        el.style.boxShadow = "0 12px 40px rgba(139, 92, 246, 0.15)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = "";
        el.style.boxShadow = "";
      }}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl">
        {poster ? (
          <img
            src={poster}
            alt={title}
            className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105"
            loading="lazy"
            style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 300ms ease, transform 300ms ease" }}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <PosterFallback label={t("seer:noImage")} mediaType={item.mediaType} />
        )}

        {/* Type badge */}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
          {type}
        </span>

        {/* Rating */}
        {item.voteAverage != null && item.voteAverage > 0 && (
          <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 backdrop-blur-sm">
            <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {item.voteAverage.toFixed(1)}
          </span>
        )}

        {/* Status badge */}
        {hasMediaInfo && <StatusBadge status={mediaStatus} />}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {item.overview && (
            <p className="mx-3 mb-2 line-clamp-3 text-[11px] leading-relaxed text-white/70">
              {item.overview}
            </p>
          )}
          <div className="m-3 mt-0">
            {item.mediaType === "movie" && !hasMediaInfo && onRequest ? (
              <button
                onClick={(e) => { e.stopPropagation(); onRequest(item); }}
                disabled={requesting}
                className="w-full rounded-lg bg-purple-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requesting ? t("seer:sending") : t("seer:request")}
              </button>
            ) : item.mediaType === "tv" && !hasMediaInfo ? (
              <div className="w-full rounded-lg bg-purple-600/80 py-2 text-center text-xs font-semibold text-white">
                {t("seer:viewSeasons")}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-2 px-0.5">
        <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
        {year && <p className="text-xs text-white/40">{year}</p>}
      </div>
    </div>
  );
}
