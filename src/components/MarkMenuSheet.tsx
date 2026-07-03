import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";

export type MarkTarget = "available" | "partial" | "processing" | "unknown";

interface MarkMenuSheetProps {
  request: LocalRequest;
  onSelect: (target: MarkTarget) => void;
  onClose: () => void;
}

interface MarkOption {
  target: MarkTarget;
  labelKey: string;
  tvOnly?: boolean;
  color: string;
  iconPaths: string[];
}

// Les 4 états réels de l'API Jellyseerr (POST /media/{id}/{status}).
const OPTIONS: MarkOption[] = [
  {
    target: "available", labelKey: "seer:markAsAvailable", color: "text-emerald-300",
    iconPaths: ["M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  },
  {
    target: "partial", labelKey: "seer:markAsPartial", tvOnly: true, color: "text-amber-300",
    iconPaths: [
      "M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z",
      "M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z",
    ],
  },
  {
    target: "processing", labelKey: "seer:markAsProcessing", color: "text-blue-300",
    iconPaths: ["M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"],
  },
  {
    target: "unknown", labelKey: "seer:markAsUnknown", color: "text-white/70",
    iconPaths: ["m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  },
];

/**
 * Sélecteur de statut « Marquer comme », rendu au NIVEAU PAGE (comme
 * SeasonActionModal) et non dans la carte : les wrappers animés des cartes
 * (animation fill forwards → transform/opacity) créent des stacking contexts
 * qui faisaient passer l'ancien dropdown SOUS les cartes suivantes (menu
 * illisible et non cliquable). Bottom sheet sur mobile, centré en ≥sm.
 */
export function MarkMenuSheet({ request, onSelect, onClose }: MarkMenuSheetProps) {
  const { t } = useTranslation("seer");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const options = OPTIONS.filter((o) => !o.tvOnly || request.mediaType === "tv");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center"
      style={{ animation: "fadeIn 200ms ease forwards" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("seer:markAs")}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-[var(--surface-dropdown,#14141a)] pb-[max(env(safe-area-inset-bottom),8px)] shadow-2xl sm:mx-4 sm:rounded-2xl sm:pb-2"
        style={{ animation: "fadeSlideUp 250ms cubic-bezier(0.22,1,0.36,1) forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/[0.06] px-5 pb-3 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            {t("seer:markAs")}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">{request.title}</p>
        </div>

        <div className="flex flex-col py-1">
          {options.map((o) => (
            <button
              key={o.target}
              onClick={() => onSelect(o.target)}
              className={`flex min-h-[48px] items-center gap-3 px-5 text-left text-sm font-medium transition-colors hover:bg-white/[0.06] active:bg-white/[0.10] focus:outline-none focus-visible:bg-white/[0.06] ${o.color}`}
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                {o.iconPaths.map((d) => (
                  <path key={d} strokeLinecap="round" strokeLinejoin="round" d={d} />
                ))}
              </svg>
              {t(o.labelKey)}
            </button>
          ))}
        </div>

        <div className="border-t border-white/[0.06] p-2">
          <button
            onClick={onClose}
            className="min-h-[48px] w-full rounded-xl text-sm font-medium text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/80 active:bg-white/[0.10]"
          >
            {t("seer:cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
