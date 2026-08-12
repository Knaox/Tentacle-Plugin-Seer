import { useTranslation } from "react-i18next";
import { segment, SEGMENT_GROUP } from "../styles/pills";
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
    <div className={SEGMENT_GROUP} role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={`${segment(value === tab.value)} px-4 py-1.5 text-sm`}
        >
          {t(tab.key)}
        </button>
      ))}
    </div>
  );
}
