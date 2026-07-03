import { useTranslation } from "react-i18next";
import type { QueueStatus } from "../api/types";

/** Bandeau d'activité de la file (envoi en cours, en attente, suppressions). */
export function RequestsQueueBanner({ queue }: { queue: QueueStatus | undefined }) {
  const { t } = useTranslation("seer");
  if (!queue || (queue.queued === 0 && !queue.processing && queue.deleting === 0)) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-tentacle-brand/20 bg-tentacle-brand/10 px-4 py-3">
      <div className="h-2 w-2 animate-pulse rounded-full bg-tentacle-brand-light" />
      <div className="text-sm text-tentacle-brand-light">
        {queue.processing ? (
          <span>
            {t("seer:queueProcessing", { title: queue.processing.title })}
            {queue.queued > 0 && (
              <span className="ml-2 text-tentacle-brand-light/60">
                {t("seer:queuePending", { count: queue.queued })}
              </span>
            )}
          </span>
        ) : queue.queued > 0 ? (
          <span>{t("seer:queueWaiting", { count: queue.queued })}</span>
        ) : null}
        {queue.deleting > 0 && (
          <span className="ml-2 text-orange-400/80">
            {t("seer:statusDeleting")}: {queue.deleting}
          </span>
        )}
      </div>
    </div>
  );
}
