import { useTranslation } from "react-i18next";
import type { SeerrMediaRequest } from "../api/types";

interface RequestCardProps {
  request: SeerrMediaRequest;
  onDelete?: (id: number) => void;
  deleting?: boolean;
}

const REQUEST_STATUS_MAP: Record<number, string> = {
  1: "seer:statusQueued",
  2: "seer:statusApproved",
  3: "seer:statusFailed",
};

const MEDIA_STATUS_MAP: Record<number, string> = {
  1: "seer:statusQueued",
  2: "seer:statusProcessing",
  3: "seer:statusPartial",
  4: "seer:statusDownloading",
  5: "seer:statusAvailable",
};

export function RequestCard({ request, onDelete, deleting }: RequestCardProps) {
  const { t } = useTranslation("seer");
  const typeLabel = request.media.mediaType === "movie" ? t("seer:typeMovie") : t("seer:typeSeries");
  const date = new Date(request.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const requestStatusKey = REQUEST_STATUS_MAP[request.status] ?? "seer:statusQueued";
  const mediaStatusKey = MEDIA_STATUS_MAP[request.media.status] ?? "";

  // Use media status if available (more detailed), fallback to request status
  const displayStatusKey = request.media.status >= 2 ? mediaStatusKey : requestStatusKey;

  const statusColor =
    request.media.status === 5 ? "bg-emerald-500/20 text-emerald-400" :
    request.status === 2 ? "bg-purple-500/20 text-purple-400" :
    request.status === 3 ? "bg-red-500/20 text-red-400" :
    "bg-yellow-500/20 text-yellow-400";

  return (
    <div className="flex gap-4 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/8">
      {/* Icon placeholder */}
      <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-white/5">
        <span className="text-lg">{request.media.mediaType === "movie" ? "🎬" : "📺"}</span>
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-white/40">{typeLabel}</span>
            <span className="text-[10px] text-white/30">TMDB #{request.media.tmdbId}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
              {t(displayStatusKey)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/30">{date}</span>
          {onDelete && request.status !== 2 && request.media.status < 5 && (
            <button
              onClick={() => onDelete(request.id)}
              disabled={deleting}
              className="rounded-md bg-red-600/20 px-2.5 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-50"
            >
              {deleting ? "..." : t("seer:delete")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
