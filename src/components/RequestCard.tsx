import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest, RequestStatus } from "../api/types";
import { posterUrl } from "../utils/media-helpers";

interface RequestCardProps {
  request: LocalRequest;
  onDelete?: (id: string, seasons?: number[]) => void;
  onRetry?: (id: string, seasons?: number[], profileId?: string | null) => void;
  onRetryDelete?: (id: string) => void;
  onAddSeasons?: (request: LocalRequest) => void;
  onOpenModal?: (request: LocalRequest, action: "delete" | "retry") => void;
  deleting?: boolean;
  retrying?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

const STATUS_I18N: Record<RequestStatus, string> = {
  queued: "seer:statusQueued", processing: "seer:statusProcessing",
  sent_to_seer: "seer:statusSentToSeer", approved: "seer:statusApproved",
  downloading: "seer:statusDownloading", available: "seer:statusAvailable",
  retry_pending: "seer:statusRetryPending", failed: "seer:statusFailed",
  deleting: "seer:statusDeleting", delete_failed: "seer:statusDeleteFailed",
};

const STATUS_COLOR: Record<RequestStatus, string> = {
  queued: "bg-yellow-500/20 text-yellow-400", processing: "bg-blue-500/20 text-blue-400",
  sent_to_seer: "bg-blue-500/20 text-blue-400", approved: "bg-purple-500/20 text-purple-400",
  downloading: "bg-orange-500/20 text-orange-400", available: "bg-emerald-500/20 text-emerald-400",
  retry_pending: "bg-yellow-500/20 text-yellow-400", failed: "bg-red-500/20 text-red-400",
  deleting: "bg-orange-500/20 text-orange-400", delete_failed: "bg-red-500/20 text-red-400",
};

const PROGRESS_STEPS: RequestStatus[] = ["queued", "sent_to_seer", "approved", "downloading", "available"];

function getProgressIndex(status: RequestStatus): number {
  if (status === "processing" || status === "retry_pending") return 0;
  if (status === "failed" || status === "deleting" || status === "delete_failed") return -1;
  return PROGRESS_STEPS.indexOf(status);
}

export function RequestCard({
  request, onDelete, onRetry, onRetryDelete, onAddSeasons, onOpenModal,
  deleting, retrying, selectable, selected, onSelect,
}: RequestCardProps) {
  const { t } = useTranslation("seer");
  const [confirmAction, setConfirmAction] = useState<"delete" | "retry" | null>(null);

  const hasManySeasons = request.mediaType === "tv" && request.seasons && request.seasons.length > 1;
  const openModal = (action: "delete" | "retry") => onOpenModal?.(request, action);
  const isTvPartial = request.mediaType === "tv" && request.seasons && request.seasons.length > 0;
  const canAddSeasons = isTvPartial && !["deleting", "processing", "delete_failed"].includes(request.status);

  const poster = posterUrl(request.posterPath);
  const typeLabel = request.mediaType === "movie" ? t("seer:typeMovie") : t("seer:typeSeries");
  const progressIdx = getProgressIndex(request.status);
  const canRetry = !["available", "processing", "deleting"].includes(request.status);
  const canDelete = !["processing", "deleting"].includes(request.status);
  const isSelectable = !["deleting", "processing"].includes(request.status);

  const relativeTime = (() => {
    const diff = Date.now() - new Date(request.createdAt).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return t("seer:today");
    if (days === 1) return t("seer:yesterday");
    return t("seer:daysAgo", { count: days });
  })();

  const date = new Date(request.createdAt).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className={`flex gap-3 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/8 ${
      selected ? "ring-2 ring-purple-500/50" : ""
    }`}>
      {selectable && (
        <button onClick={() => isSelectable && onSelect?.(request.id)} disabled={!isSelectable}
          className="flex flex-shrink-0 items-center">
          <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
            !isSelectable ? "border-white/10 bg-white/5 cursor-not-allowed" :
            selected ? "border-purple-500 bg-purple-600" : "border-white/20 hover:border-white/40"
          }`}>
            {selected && (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </button>
      )}

      <div className="flex-shrink-0">
        {poster ? (
          <img src={poster} alt={request.title} className="h-[120px] w-[80px] rounded-lg object-cover" loading="lazy" />
        ) : (
          <div className="flex h-[120px] w-[80px] items-center justify-center rounded-lg bg-white/5 text-white/20 text-[10px]">
            {typeLabel}
          </div>
        )}
      </div>

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

        {progressIdx >= 0 && (
          <div className="mt-2 flex items-center gap-1">
            {PROGRESS_STEPS.map((step, i) => (
              <div key={step} className="flex flex-1 items-center">
                <div className={`h-1 w-full rounded-full transition-colors ${
                  i <= progressIdx && progressIdx === 4 ? "bg-emerald-500" : i <= progressIdx ? "bg-[#8b5cf6]" : "bg-white/10"
                } ${i === progressIdx && progressIdx < 4 ? "animate-pulse" : ""}`} />
              </div>
            ))}
          </div>
        )}

        {request.status === "deleting" && (
          <div className="mt-2 h-1 w-full animate-pulse rounded-full bg-orange-500/40" />
        )}

        {(request.status === "failed" || request.status === "delete_failed") && request.lastError && (
          <p className="mt-1 truncate text-[10px] text-red-400/70">{request.lastError}</p>
        )}
        {(request.status === "failed" || request.status === "retry_pending") && (
          <p className="text-[10px] text-white/30">
            {t("seer:retryCountLabel", { count: request.retryCount, max: request.maxRetries })}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-[10px] text-white/30" title={date}>{relativeTime}</span>

          {selectable ? null : confirmAction ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/50">
                {confirmAction === "delete" ? t("seer:confirmDelete") : t("seer:confirmRetry")}
              </span>
              <button onClick={() => {
                if (confirmAction === "delete") onDelete?.(request.id);
                else onRetry?.(request.id);
                setConfirmAction(null);
              }} className="rounded bg-red-600/30 px-2 py-0.5 text-[10px] font-medium text-red-300 hover:bg-red-600/40">
                {t("seer:confirm")}
              </button>
              <button onClick={() => setConfirmAction(null)}
                className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/50 hover:bg-white/15">
                {t("seer:cancel")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {(request.status === "delete_failed" || request.status === "deleting") && onRetryDelete && (
                <button onClick={() => onRetryDelete(request.id)}
                  className="rounded-md bg-orange-600/20 px-2.5 py-1 text-[10px] font-medium text-orange-400 transition-colors hover:bg-orange-600/30">
                  {request.status === "deleting" ? t("seer:forceDelete") : t("seer:retryDelete")}
                </button>
              )}
              {canAddSeasons && onAddSeasons && (
                <button onClick={() => onAddSeasons(request)}
                  className="rounded-md bg-blue-600/20 px-2.5 py-1 text-[10px] font-medium text-blue-400 transition-colors hover:bg-blue-600/30">
                  + {t("seer:addSeasons")}
                </button>
              )}
              {canRetry && onRetry && request.status !== "delete_failed" && (
                <button
                  onClick={() => openModal("retry")}
                  disabled={retrying}
                  className="rounded-md bg-purple-600/20 px-2.5 py-1 text-[10px] font-medium text-purple-400 transition-colors hover:bg-purple-600/30 disabled:opacity-50">
                  {retrying ? "..." : request.status === "delete_failed" ? t("seer:deleteFailedRetry") : t("seer:retry")}
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  onClick={() => hasManySeasons ? openModal("delete") : setConfirmAction("delete")}
                  disabled={deleting}
                  className="rounded-md bg-red-600/20 px-2.5 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-50">
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
