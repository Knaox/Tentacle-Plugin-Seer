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
    3: { cls: "bg-purple-500/80", key: "statusApproved" },
    4: { cls: "bg-orange-500/80", key: "statusProcessing" },
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

function PosterFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-white/5">
      <svg className="h-10 w-10 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
    </div>
  );
}

export function MediaCard({ item, onRequest, onClick, requesting, style }: MediaCardProps) {
  const { t } = useTranslation("seer");
  const title = mediaTitle(item) || t("seer:untitled");
  const year = mediaYear(item);
  const type = t(mediaTypeKey(item));
  const poster = posterUrl(item.posterPath);
  const mediaStatus = item.mediaInfo?.status ?? 0;
  const hasMediaInfo = mediaStatus > 1;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl transition-all duration-300"
      style={{
        ...style,
        willChange: "transform",
      }}
      onClick={() => onClick?.(item)}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.transform = "scale(1.04) translateY(-6px)";
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
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <PosterFallback label={t("seer:noImage")} />
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
                className="w-full rounded-lg bg-purple-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
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
