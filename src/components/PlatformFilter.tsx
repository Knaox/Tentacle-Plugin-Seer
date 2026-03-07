import { useTranslation } from "react-i18next";
import { useAvailableProviders } from "../hooks/useAvailableProviders";

interface PlatformFilterProps {
  selected: number[];
  onChange: (ids: number[]) => void;
}

export function PlatformFilter({ selected, onChange }: PlatformFilterProps) {
  const { t } = useTranslation("seer");
  const { data: providers, isLoading } = useAvailableProviders();

  const toggle = (id: number) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  };

  if (isLoading || !providers || providers.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {providers.map((p) => {
        const active = selected.includes(p.id);
        return (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border border-[#8b5cf6]/50 bg-[#8b5cf6]/10 text-[#8b5cf6]"
                : "border border-white/5 bg-[#1a1a2e] text-white/50 hover:bg-[#1a1a2e]/80 hover:text-white/70"
            }`}
          >
            {p.logoPath && (
              <img
                src={`https://image.tmdb.org/t/p/w45${p.logoPath}`}
                alt=""
                className="h-4 w-4 rounded"
                loading="lazy"
              />
            )}
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
