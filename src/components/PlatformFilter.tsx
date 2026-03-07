import { useTranslation } from "react-i18next";
import { PLATFORMS } from "../utils/platforms";

interface PlatformFilterProps {
  selected: number[];
  onToggle: (id: number) => void;
}

export function PlatformFilter({ selected, onToggle }: PlatformFilterProps) {
  const { t } = useTranslation("seer");

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
        {t("filterPlatforms")}
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {PLATFORMS.map((p) => {
          const active = selected.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "border border-[#8b5cf6]/50 bg-[#8b5cf6]/10 text-[#8b5cf6]"
                  : "border border-white/5 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
              }`}
            >
              {active && (
                <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              <span className="truncate">{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
