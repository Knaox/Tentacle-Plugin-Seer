import { useTranslation } from "react-i18next";
import { ProfileSelector } from "./ProfileSelector";
import { CTA_PRIMARY, CTA_PRIMARY_HALO } from "../styles/cta";

interface RequestsBulkBarProps {
  count: number;
  deleting: boolean;
  retrying: boolean;
  onBulkDelete: () => void;
  onOpenRetryModal: () => void;
  onCancel: () => void;
}

/** Barre flottante des actions groupées (fond opaque avec fallback thème). */
export function RequestsBulkBar({
  count, deleting, retrying, onBulkDelete, onOpenRetryModal, onCancel,
}: RequestsBulkBarProps) {
  const { t } = useTranslation("seer");
  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-16px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-tentacle-border-subtle bg-tentacle-surface-dropdown px-4 py-3 shadow-2xl backdrop-blur-sm sm:gap-3 sm:px-5">
      <button
        onClick={onBulkDelete}
        disabled={deleting}
        className="rounded-lg bg-red-600/20 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-50"
      >
        {deleting ? "..." : t("seer:bulkDelete", { count })}
      </button>
      <button
        onClick={onOpenRetryModal}
        disabled={retrying}
        className="rounded-lg bg-[rgba(var(--brand-rgb),0.2)] px-4 py-2 text-xs font-semibold text-tentacle-brand-light transition-colors hover:bg-[rgba(var(--brand-rgb),0.3)] disabled:opacity-50"
      >
        {retrying ? "..." : t("seer:bulkRetry", { count })}
      </button>
      <button
        onClick={onCancel}
        className="rounded-lg bg-tentacle-fill-soft px-4 py-2 text-xs text-tentacle-text-tertiary transition-colors hover:bg-tentacle-fill-medium"
      >
        {t("seer:bulkCancel")}
      </button>
    </div>
  );
}

interface BulkRetryModalProps {
  count: number;
  profileId: string | null;
  onProfileChange: (id: string | null) => void;
  retrying: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Choix du profil de qualité avant une redemande groupée. */
export function BulkRetryModal({
  count, profileId, onProfileChange, retrying, onConfirm, onClose,
}: BulkRetryModalProps) {
  const { t } = useTranslation("seer");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-xl bg-tentacle-surface-2 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-sm font-semibold text-tentacle-text-primary">
          {t("seer:bulkRetry", { count })}
        </h3>
        <ProfileSelector showAll selectedId={profileId} onChange={onProfileChange} />
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="rounded-lg bg-tentacle-fill-soft px-4 py-1.5 text-xs text-tentacle-text-tertiary hover:bg-tentacle-fill-medium">
            {t("seer:cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={retrying}
            style={CTA_PRIMARY_HALO}
            className={`${CTA_PRIMARY} px-4 py-1.5 text-xs`}>
            {retrying ? "..." : t("seer:seasonActionConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
