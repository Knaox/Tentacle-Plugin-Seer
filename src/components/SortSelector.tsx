import { useTranslation } from "react-i18next";
import type { SortOption, SortOrder } from "../api/types";

interface SortSelectorProps {
  value: SortOption;
  order: SortOrder;
  onChange: (value: SortOption) => void;
  onOrderChange: (order: SortOrder) => void;
}

export function SortSelector({ value, order, onChange, onOrderChange }: SortSelectorProps) {
  const { t } = useTranslation("seer");

  const SORT_OPTIONS: { value: SortOption; key: string }[] = [
    { value: "popularity", key: "seer:sortPopularity" },
    { value: "trending", key: "seer:sortTrending" },
    { value: "vote_average", key: "seer:sortRating" },
    { value: "release_date", key: "seer:sortRecent" },
  ];

  const canToggleOrder = value !== "trending";

  return (
    <div className="flex items-center gap-2">
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
      {canToggleOrder && (
        <button
          onClick={() => onOrderChange(order === "desc" ? "asc" : "desc")}
          className="flex items-center gap-1 rounded-lg bg-[#1a1a2e] px-2.5 py-1.5 text-xs font-medium text-white/50 transition-colors hover:bg-[#1a1a2e]/80 hover:text-white/70"
          title={order === "desc" ? t("seer:sortOrderDesc") : t("seer:sortOrderAsc")}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {order === "desc" ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
            )}
          </svg>
        </button>
      )}
    </div>
  );
}
