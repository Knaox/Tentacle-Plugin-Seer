import { useTranslation } from "react-i18next";
import type { SortOption } from "../api/types";

interface SortSelectorProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortSelector({ value, onChange }: SortSelectorProps) {
  const { t } = useTranslation("seer");

  const SORT_OPTIONS: { value: SortOption; key: string }[] = [
    { value: "popularity", key: "seer:sortPopularity" },
    { value: "trending", key: "seer:sortTrending" },
    { value: "vote_average", key: "seer:sortRating" },
    { value: "release_date", key: "seer:sortRecent" },
  ];

  return (
    <div className="flex gap-2">
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-[#8b5cf6] text-white"
              : "bg-[#1a1a2e] text-white/50 hover:bg-[#1a1a2e]/80 hover:text-white/70"
          }`}
        >
          {t(opt.key)}
        </button>
      ))}
    </div>
  );
}
