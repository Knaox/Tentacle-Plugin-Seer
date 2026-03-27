import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";
import { ProfileSelector } from "./ProfileSelector";

interface SeasonActionModalProps {
  request: LocalRequest;
  action: "delete" | "retry";
  onConfirm: (seasons?: number[], profileId?: string | null) => void;
  onClose: () => void;
}

export function SeasonActionModal({ request, action, onConfirm, onClose }: SeasonActionModalProps) {
  const { t } = useTranslation("seer");
  const seasons = request.seasons ?? [];
  const hasSeasons = seasons.length > 0;
  const [selected, setSelected] = useState<Set<number>>(new Set(seasons));
  const [profileId, setProfileId] = useState<string | null>(request.profileId ?? null);

  const toggle = (s: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const allSelected = !hasSeasons || selected.size === seasons.length;

  const handleConfirm = () => {
    const s = !hasSeasons || allSelected ? undefined : Array.from(selected).sort((a, b) => a - b);
    onConfirm(s, action === "retry" ? profileId : undefined);
  };

  const title = action === "delete"
    ? (hasSeasons ? t("seer:seasonActionDeleteTitle") : t("seer:confirmDelete"))
    : (hasSeasons ? t("seer:seasonActionRetryTitle") : t("seer:confirmRetry"));

  const warn = action === "delete" ? t("seer:seasonActionDeleteWarn") : t("seer:seasonActionRetryWarn");
  const canConfirm = !hasSeasons || selected.size > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 flex w-full max-w-sm max-h-[85vh] flex-col rounded-xl bg-[#1a1a2e] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-sm font-semibold text-white">{title}</h3>

        {/* Saisons — uniquement pour les séries */}
        {hasSeasons && (
          <>
            <div className="mb-3 flex flex-wrap gap-2 overflow-y-auto max-h-[40vh]" style={{ scrollbarWidth: "thin" }}>
              {seasons.map((s) => (
                <button key={s} onClick={() => toggle(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    selected.has(s) ? "bg-[#8b5cf6] text-white shadow-lg shadow-purple-500/20"
                      : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}>
                  S{s}
                </button>
              ))}
            </div>

            <button onClick={() => setSelected(new Set(seasons))}
              className={`mb-3 w-full flex-shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                allSelected ? "bg-[#8b5cf6]/20 text-purple-300 ring-1 ring-purple-500/30"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}>
              {t("seer:seasonActionAll")}
            </button>

            {allSelected && <p className="mb-3 text-[10px] text-orange-400/70">{warn}</p>}
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

        <div className="flex flex-shrink-0 items-center justify-end gap-2">
          <button onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-1.5 text-xs text-white/50 hover:bg-white/15">
            {t("seer:cancel")}
          </button>
          <button onClick={handleConfirm} disabled={!canConfirm}
            className="rounded-lg bg-[#8b5cf6] px-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-purple-500/20 transition-colors hover:bg-[#7c3aed] disabled:opacity-40">
            {t("seer:seasonActionConfirm")}
            {hasSeasons && selected.size > 0 && !allSelected && ` (S${Array.from(selected).sort((a, b) => a - b).join(", S")})`}
          </button>
        </div>
      </div>
    </div>
  );
}
