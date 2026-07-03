import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";
import { ProfileSelector } from "./ProfileSelector";
import { CTA_PRIMARY, CTA_PRIMARY_HALO, CTA_SECONDARY } from "../styles/cta";

interface SeasonActionModalProps {
  request: LocalRequest;
  action: "delete" | "retry";
  onConfirm: (
    seasons?: number[],
    profileId?: string | null,
    options?: { deleteFiles?: boolean; forceRedownload?: boolean },
  ) => void;
  onClose: () => void;
}

export function SeasonActionModal({ request, action, onConfirm, onClose }: SeasonActionModalProps) {
  const { t } = useTranslation("seer");
  const seasons = request.seasons ?? [];
  const hasSeasons = seasons.length > 0;
  const [selected, setSelected] = useState<Set<number>>(new Set(seasons));
  const [profileId, setProfileId] = useState<string | null>(request.profileId ?? null);
  // Suppression : « supprimer le contenu » coché par défaut (supprime aussi les
  // fichiers Sonarr/Radarr). Retry : forcer le re-téléchargement reste décoché.
  const [deleteFiles, setDeleteFiles] = useState(true);
  const [forceRedownload, setForceRedownload] = useState(false);

  const toggle = (s: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const allSelected = !hasSeasons || selected.size === seasons.length;

  const handleConfirm = () => {
    // Saisons explicitement cochées (ou aucune si la demande n'a pas de saisons).
    const explicit = hasSeasons ? Array.from(selected).sort((a, b) => a - b) : undefined;
    // Suppression : TOUJOURS cibler les saisons de CETTE demande, jamais toute la
    // série. `undefined` (= toute la série côté backend) seulement si la demande
    // n'a pas de saisons. Retry : comportement historique conservé.
    const s = action === "delete" ? explicit : (allSelected ? undefined : explicit);
    onConfirm(
      s,
      action === "retry" ? profileId : undefined,
      action === "delete" ? { deleteFiles } : { forceRedownload },
    );
  };

  const title = action === "delete"
    ? (hasSeasons ? t("seer:seasonActionDeleteTitle") : t("seer:confirmDelete"))
    : (hasSeasons ? t("seer:seasonActionRetryTitle") : t("seer:confirmRetry"));

  // L'avertissement n'a de sens que si l'utilisateur active explicitement l'option destructive
  const showWarn = action === "delete" ? deleteFiles : forceRedownload;
  const warn = action === "delete" ? t("seer:seasonActionDeleteWarn") : t("seer:seasonActionRetryWarn");
  const canConfirm = !hasSeasons || selected.size > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 flex w-full max-w-sm max-h-[85vh] flex-col rounded-xl bg-[var(--surface-2,#141414)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-sm font-semibold text-white">{title}</h3>

        {/* Saisons — uniquement pour les séries */}
        {hasSeasons && (
          <>
            <div className="mb-3 flex flex-wrap gap-2 overflow-y-auto max-h-[40vh]" style={{ scrollbarWidth: "thin" }}>
              {seasons.map((s) => (
                <button key={s} onClick={() => toggle(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    selected.has(s) ? "bg-white text-black shadow-sm"
                      : "bg-white/[0.06] text-white/60 hover:bg-white/[0.10] hover:text-white"
                  }`}>
                  S{s}
                </button>
              ))}
            </div>

            <button onClick={() => setSelected(new Set(seasons))}
              className={`mb-3 w-full flex-shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                allSelected ? "bg-tentacle-brand/20 text-tentacle-brand-light ring-1 ring-tentacle-brand/30"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}>
              {t("seer:seasonActionAll")}
            </button>

          </>
        )}

        {/* Profil de qualité — uniquement pour retry */}
        {action === "retry" && (
          <div className="mb-3 flex-shrink-0">
            <ProfileSelector
              showAll
              selectedId={profileId}
              onChange={setProfileId}
            />
          </div>
        )}

        {/* Option destructive — décochée par défaut */}
        <label className="mb-3 flex flex-shrink-0 cursor-pointer items-start gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
          <input
            type="checkbox"
            checked={action === "delete" ? deleteFiles : forceRedownload}
            onChange={(e) => action === "delete" ? setDeleteFiles(e.target.checked) : setForceRedownload(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-tentacle-brand"
          />
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-white/80">
              {action === "delete" ? t("seer:deleteAlsoFiles") : t("seer:forceRedownload")}
            </span>
            <span className="block text-[10px] text-white/40">
              {action === "delete" ? t("seer:deleteAlsoFilesHint") : t("seer:forceRedownloadHint")}
            </span>
          </div>
        </label>

        {showWarn && <p className="mb-3 text-[10px] text-orange-400/70">{warn}</p>}

        <div className="flex flex-shrink-0 items-center justify-end gap-2">
          <button onClick={onClose} className={`${CTA_SECONDARY} h-9 px-4 text-xs`}>
            {t("seer:cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={CTA_PRIMARY_HALO}
            className={`${CTA_PRIMARY} h-9 px-4 text-xs`}
          >
            {t("seer:seasonActionConfirm")}
            {hasSeasons && selected.size > 0 && !allSelected && ` (S${Array.from(selected).sort((a, b) => a - b).join(", S")})`}
          </button>
        </div>
      </div>
    </div>
  );
}
