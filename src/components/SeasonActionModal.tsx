import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";

interface SeasonActionModalProps {
  request: LocalRequest;
  action: "delete" | "retry";
  onConfirm: (seasons?: number[]) => void;
  onClose: () => void;
}

export function SeasonActionModal({ request, action, onConfirm, onClose }: SeasonActionModalProps) {
  const { t } = useTranslation("seer");
  const seasons = request.seasons ?? [];
  const [selected, setSelected] = useState<Set<number>>(new Set(seasons));

  const toggle = (s: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const allSelected = selected.size === seasons.length;

  const handleConfirm = () => {
    if (allSelected) {
      // Toute la série : pas de seasons → backend fait le cleanup complet
      onConfirm(undefined);
    } else {
      onConfirm(Array.from(selected).sort((a, b) => a - b));
    }
  };

  const title = action === "delete"
    ? t("seer:seasonActionDeleteTitle")
    : t("seer:seasonActionRetryTitle");

  const warn = action === "delete"
    ? t("seer:seasonActionDeleteWarn")
    : t("seer:seasonActionRetryWarn");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-sm rounded-xl bg-[#1a1a2e] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-sm font-semibold text-white">{title}</h3>

        {/* Liste des saisons */}
        <div className="mb-3 flex flex-wrap gap-2">
          {seasons.map((s) => (
            <button
              key={s}
              onClick={() => toggle(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                selected.has(s)
                  ? "bg-[#8b5cf6] text-white shadow-lg shadow-purple-500/20"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              S{s}
            </button>
          ))}
        </div>

        {/* Bouton toute la série */}
        <button
          onClick={() => setSelected(new Set(seasons))}
          className={`mb-3 w-full rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            allSelected
              ? "bg-[#8b5cf6]/20 text-purple-300 ring-1 ring-purple-500/30"
              : "bg-white/5 text-white/50 hover:bg-white/10"
          }`}
        >
          {t("seer:seasonActionAll")}
        </button>

        {/* Avertissement si toute la série */}
        {allSelected && (
          <p className="mb-3 text-[10px] text-orange-400/70">{warn}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-1.5 text-xs text-white/50 hover:bg-white/15"
          >
            {t("seer:cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="rounded-lg bg-[#8b5cf6] px-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-purple-500/20 transition-colors hover:bg-[#7c3aed] disabled:opacity-40"
          >
            {t("seer:seasonActionConfirm")} {selected.size > 0 && !allSelected && `(S${Array.from(selected).sort((a, b) => a - b).join(", S")})`}
          </button>
        </div>
      </div>
    </div>
  );
}
