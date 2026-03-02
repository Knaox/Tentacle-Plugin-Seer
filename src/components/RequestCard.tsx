import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest, RequestStatus } from "../api/types";
import { posterUrl } from "../utils/media-helpers";

interface RequestCardProps {
  request: LocalRequest;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
  deleting?: boolean;
  retrying?: boolean;
}

const STATUS_I18N: Record<RequestStatus, string> = {
  queued: "seer:statusQueued",
  processing: "seer:statusProcessing",
  sent_to_seer: "seer:statusSentToSeer",
  approved: "seer:statusApproved",
  downloading: "seer:statusDownloading",
  available: "seer:statusAvailable",
  retry_pending: "seer:statusRetryPending",
  failed: "seer:statusFailed",
};

const STATUS_COLOR: Record<RequestStatus, string> = {
  queued: "bg-yellow-500/20 text-yellow-400",
  processing: "bg-blue-500/20 text-blue-400",
  sent_to_seer: "bg-blue-500/20 text-blue-400",
  approved: "bg-purple-500/20 text-purple-400",
  downloading: "bg-orange-500/20 text-orange-400",
  available: "bg-emerald-500/20 text-emerald-400",
  retry_pending: "bg-yellow-500/20 text-yellow-400",
  failed: "bg-red-500/20 text-red-400",
};

/** Progress steps and which status index they correspond to */
const PROGRESS_STEPS: RequestStatus[] = [
  "queued",
  "sent_to_seer",
  "approved",
  "downloading",
  "available",
];

function getProgressIndex(status: RequestStatus): number {
  if (status === "processing" || status === "retry_pending") return 0;
  if (status === "failed") return -1;
  return PROGRESS_STEPS.indexOf(status);
}

export function RequestCard({ request, onDelete, onRetry, deleting, retrying }: RequestCardProps) {
  const { t } = useTranslation("seer");
  const [confirmAction, setConfirmAction] = useState<"delete" | "retry" | null>(null);

  const poster = posterUrl(request.posterPath);
  const typeLabel = request.mediaType === "movie" ? t("seer:typeMovie") : t("seer:typeSeries");
  const progressIdx = getProgressIndex(request.status);
  const canRetry = request.status !== "available" && request.status !== "processing";
  const canDelete = request.status !== "processing";

  const date = new Date(request.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const relativeTime = (() => {
    const diff = Date.now() - new Date(request.createdAt).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return t("seer:today");
    if (days === 1) return t("seer:yesterday");
    return t("seer:daysAgo", { count: days });
  })();

  return (
    <div className="flex gap-3 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/8">
      {/* Poster */}
      <div className="flex-shrink-0">
        {poster ? (
          <img
            src={poster}
            alt={request.title}
            className="h-24 w-16 rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-24 w-16 items-center justify-center rounded-lg bg-white/5 text-white/20 text-[10px]">
            {typeLabel}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-white">{request.title}</h4>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[10px] text-white/40">{typeLabel}</span>
              {request.year && <span className="text-[10px] text-white/30">{request.year}</span>}
              {request.seasons && (
                <span className="text-[10px] text-white/30">
                  {t("seer:seasonsLabel", { seasons: request.seasons.join(", ") })}
                </span>
              )}
            </div>
          </div>
          <span className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[request.status]}`}>
            {t(STATUS_I18N[request.status])}
          </span>
        </div>

        {/* Progress bar */}
        {request.status !== "failed" && (
          <div className="mt-2 flex items-center gap-1">
            {PROGRESS_STEPS.map((step, i) => (
              <div key={step} className="flex flex-1 items-center">
                <div
                  className={`h-1 w-full rounded-full transition-colors ${
                    i <= progressIdx ? "bg-purple-500" : "bg-white/10"
                  } ${i === progressIdx ? "animate-pulse" : ""}`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {request.status === "failed" && request.lastError && (
          <p className="mt-1 truncate text-[10px] text-red-400/70">{request.lastError}</p>
        )}
        {(request.status === "failed" || request.status === "retry_pending") && (
          <p className="text-[10px] text-white/30">
            {t("seer:retryCountLabel", { count: request.retryCount, max: request.maxRetries })}
          </p>
        )}

        {/* Footer: date + actions */}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-[10px] text-white/30" title={date}>{relativeTime}</span>

          {confirmAction ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/50">
                {confirmAction === "delete" ? t("seer:confirmDelete") : t("seer:confirmRetry")}
              </span>
              <button
                onClick={() => {
                  if (confirmAction === "delete") onDelete?.(request.id);
                  else onRetry?.(request.id);
                  setConfirmAction(null);
                }}
                className="rounded bg-red-600/30 px-2 py-0.5 text-[10px] font-medium text-red-300 hover:bg-red-600/40"
              >
                {t("seer:confirm")}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/50 hover:bg-white/15"
              >
                {t("seer:cancel")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {canRetry && onRetry && (
                <button
                  onClick={() => setConfirmAction("retry")}
                  disabled={retrying}
                  className="rounded-md bg-purple-600/20 px-2.5 py-1 text-[10px] font-medium text-purple-400 transition-colors hover:bg-purple-600/30 disabled:opacity-50"
                >
                  {retrying ? "..." : t("seer:retry")}
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  onClick={() => setConfirmAction("delete")}
                  disabled={deleting}
                  className="rounded-md bg-red-600/20 px-2.5 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-50"
                >
                  {deleting ? "..." : t("seer:delete")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
