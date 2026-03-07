import { useTranslation } from "react-i18next";
import type { DiscoverMediaType } from "../api/types";

interface MediaTabBarProps {
  value: DiscoverMediaType;
  onChange: (value: DiscoverMediaType) => void;
}

export function MediaTabBar({ value, onChange }: MediaTabBarProps) {
  const { t } = useTranslation("seer");

  const TABS: { value: DiscoverMediaType; key: string }[] = [
    { value: "movies", key: "seer:filterMovies" },
    { value: "tv", key: "seer:filterSeries" },
  ];

  return (
    <div className="flex gap-1 rounded-lg bg-[#1a1a2e]/60 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            value === tab.value
              ? "bg-[#8b5cf6] text-white shadow-lg shadow-purple-500/20"
              : "text-white/50 hover:text-white/70"
          }`}
        >
          {t(tab.key)}
        </button>
      ))}
    </div>
  );
}
