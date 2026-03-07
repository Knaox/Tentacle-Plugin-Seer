import { useTranslation } from "react-i18next";
import { PLATFORMS } from "../utils/platforms";

interface PlatformFilterProps {
  selected: number[];
  onChange: (ids: number[]) => void;
}

export function PlatformFilter({ selected, onChange }: PlatformFilterProps) {
  const { t } = useTranslation("seer");

  const toggle = (id: number) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {PLATFORMS.map((p) => {
        const active = selected.includes(p.id);
        return (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border border-[#8b5cf6]/50 bg-[#8b5cf6]/10 text-[#8b5cf6]"
                : "border border-white/5 bg-[#1a1a2e] text-white/50 hover:bg-[#1a1a2e]/80 hover:text-white/70"
            }`}
          >
            {p.name}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white/30 transition-colors hover:text-white/60"
        >
          {t("resetFilters")}
        </button>
      )}
    </div>
  );
}
