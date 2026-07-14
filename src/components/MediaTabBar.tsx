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
    { value: "anime", key: "seer:filterAnimes" },
  ];

  return (
    <div className="flex gap-1 rounded-lg bg-tentacle-surface-2/60 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            value === tab.value
              ? "bg-tentacle-cta-primary text-tentacle-cta-primary-fg shadow-sm"
              : "text-tentacle-text-tertiary hover:text-tentacle-text-secondary"
          }`}
        >
          {t(tab.key)}
        </button>
      ))}
    </div>
  );
}
