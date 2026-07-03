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
  /** Ouvre le sélecteur de statut « Marquer comme » (sheet au niveau page) */
  onOpenMarkMenu?: (request: LocalRequest) => void;
  marking?: boolean;
  deleting?: boolean;
  retrying?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

const STATUS_I18N: Record<RequestStatus, string> = {
  queued: "seer:statusQueued", processing: "seer:statusProcessing",
  sent_to_seer: "seer:statusSentToSeer", approved: "seer:statusApproved",
  downloading: "seer:statusDownloading",
  partially_available: "seer:statusPartiallyAvailableBadge",
  available: "seer:statusAvailable",
  unavailable: "seer:statusUnavailable",
  retry_pending: "seer:statusRetryPending", failed: "seer:statusFailed",
  deleting: "seer:statusDeleting", delete_failed: "seer:statusDeleteFailed",
};

const STATUS_COLOR: Record<RequestStatus, string> = {
  queued: "bg-yellow-500/20 text-yellow-400", processing: "bg-blue-500/20 text-blue-400",
  sent_to_seer: "bg-blue-500/20 text-blue-400", approved: "bg-tentacle-brand/20 text-tentacle-brand-light",
  downloading: "bg-orange-500/20 text-orange-400",
  partially_available: "bg-amber-400/20 text-amber-300",
  available: "bg-emerald-500/20 text-emerald-400",
  unavailable: "bg-tentacle-brand/20 text-tentacle-brand-light",
  retry_pending: "bg-orange-500/20 text-orange-300", failed: "bg-red-500/20 text-red-400",
  deleting: "bg-orange-500/20 text-orange-400", delete_failed: "bg-red-500/20 text-red-400",
};

/* Boutons d'action : hauteur tactile (36px) + retour à la ligne sans débordement. */
const ACTION_BTN =
  "min-h-[36px] rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50";

const PROGRESS_STEPS: RequestStatus[] = ["queued", "sent_to_seer", "approved", "downloading", "available"];

function getProgressIndex(status: RequestStatus): number {
  if (status === "processing" || status === "retry_pending") return 0;
  if (status === "failed" || status === "deleting" || status === "delete_failed" || status === "unavailable") return -1;
  return PROGRESS_STEPS.indexOf(status);
}

export function RequestCard({
  request, onDelete, onRetry, onRetryDelete, onAddSeasons, onOpenModal, onOpenMarkMenu,
  marking, deleting, retrying, selectable, selected, onSelect,
}: RequestCardProps) {
  const { t } = useTranslation("seer");
  // Activé seulement quand on a un lien Jellyseerr (sinon /mark renverra 400).
  // Inclut available/unavailable : un état marqué doit pouvoir être re-changé.
  const canMark = !!request.seerrMediaId && [
    "downloading", "failed", "approved", "sent_to_seer",
    "partially_available", "available", "unavailable",
  ].includes(request.status);

  const openModal = (action: "delete" | "retry") => onOpenModal?.(request, action);
  const isTvPartial = request.mediaType === "tv" && request.seasons && request.seasons.length > 0;
  const canAddSeasons = isTvPartial && !["deleting", "processing", "delete_failed"].includes(request.status);

  const poster = posterUrl(request.posterPath);
  const typeLabel = request.mediaType === "movie" ? t("seer:typeMovie") : t("seer:typeSeries");
  const progressIdx = getProgressIndex(request.status);
  // « Redemander » reste disponible même une fois le média disponible ou marqué
  // non disponible (re-téléchargement) — il ne disparaît plus après un mark.
  const canRetry = !["processing", "deleting", "delete_failed"].includes(request.status);
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
      selected ? "ring-2 ring-tentacle-brand/50" : ""
    }`}>
      {selectable && (
        <button onClick={() => isSelectable && onSelect?.(request.id)} disabled={!isSelectable}
          className="flex flex-shrink-0 items-center">
          <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
            !isSelectable ? "border-white/10 bg-white/5 cursor-not-allowed" :
            selected ? "border-tentacle-brand bg-tentacle-brand" : "border-white/20 hover:border-white/40"
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
          <span
            className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[request.status]}`}
            title={request.status === "retry_pending" && request.lastError ? request.lastError : undefined}
          >
            {request.status === "retry_pending"
              ? t("seer:statusRetryPendingBadge", { count: request.retryCount, max: request.maxRetries })
              : t(STATUS_I18N[request.status])}
          </span>
        </div>

        {progressIdx >= 0 && (
          <div className="mt-2 flex items-center gap-1">
            {PROGRESS_STEPS.map((step, i) => (
              <div key={step} className="flex flex-1 items-center">
                <div className={`h-1 w-full rounded-full transition-colors ${
                  i <= progressIdx && progressIdx === 4 ? "bg-emerald-500" : i <= progressIdx ? "bg-tentacle-brand" : "bg-white/10"
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

        {/* Footer : wrap sur mobile — les boutons ne débordent plus de la carte. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-2">
          <span className="text-[10px] text-white/30" title={date}>{relativeTime}</span>

          {selectable ? null : (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              {(request.status === "delete_failed" || request.status === "deleting") && onRetryDelete && (
                <button onClick={() => onRetryDelete(request.id)}
                  className={`${ACTION_BTN} bg-orange-600/20 text-orange-400 hover:bg-orange-600/30`}>
                  {request.status === "deleting" ? t("seer:forceDelete") : t("seer:retryDelete")}
                </button>
              )}
              {canAddSeasons && onAddSeasons && (
                <button onClick={() => onAddSeasons(request)}
                  className={`${ACTION_BTN} bg-blue-600/20 text-blue-400 hover:bg-blue-600/30`}>
                  + {t("seer:addSeasons")}
                </button>
              )}
              {canMark && onOpenMarkMenu && (
                <button
                  onClick={() => onOpenMarkMenu(request)}
                  disabled={marking}
                  className={`${ACTION_BTN} bg-white/[0.06] text-white/70 hover:bg-white/[0.10] hover:text-white`}
                >
                  {marking ? "…" : t("seer:markAs")}
                </button>
              )}
              {canRetry && onRetry && request.status !== "delete_failed" && (
                <button
                  onClick={() => openModal("retry")}
                  disabled={retrying}
                  className={`${ACTION_BTN} bg-tentacle-brand/20 text-tentacle-brand-light hover:bg-tentacle-brand/30`}>
                  {retrying ? "…" : t("seer:retry")}
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  onClick={() => openModal("delete")}
                  disabled={deleting}
                  className={`${ACTION_BTN} bg-red-600/20 text-red-400 hover:bg-red-600/30`}>
                  {deleting ? "…" : t("seer:delete")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
