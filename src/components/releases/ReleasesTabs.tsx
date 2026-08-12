import { useTranslation } from "react-i18next";
import type { CalendarMediaFilter, CalendarMode } from "../../api/types-releases";
import { pill, segment, SEGMENT_GROUP } from "../../styles/pills";

export type ReleasesView = "week" | "month";

interface Props {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  view: ReleasesView;
  onViewChange: (view: ReleasesView) => void;
  mediaFilter: CalendarMediaFilter;
  onMediaFilterChange: (value: CalendarMediaFilter) => void;
}

const MODES: Array<{ value: CalendarMode; key: string }> = [
  { value: "personal", key: "seer:releasesTabPersonal" },
  { value: "all", key: "seer:releasesTabAll" },
  { value: "provider", key: "seer:releasesTabProvider" },
];

const MEDIA: Array<{ value: CalendarMediaFilter; key: string }> = [
  { value: "both", key: "seer:releasesFilterAll" },
  { value: "movie", key: "seer:releasesFilterMovies" },
  { value: "tv", key: "seer:releasesFilterTv" },
];

/** Mode (mes sorties / tout / plateforme), filtre film-série, et vue semaine/mois. */
export function ReleasesTabs({
  mode, onModeChange, view, onViewChange, mediaFilter, onMediaFilterChange,
}: Props) {
  const { t } = useTranslation("seer");

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onModeChange(m.value)}
              aria-pressed={mode === m.value}
              className={pill(mode === m.value)}
            >
              {t(m.key)}
            </button>
          ))}
        </div>

        <div className={SEGMENT_GROUP} role="tablist">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => onViewChange(v)}
              className={segment(view === v)}
            >
              {t(v === "week" ? "seer:releasesViewWeek" : "seer:releasesViewMonth")}
            </button>
          ))}
        </div>
      </div>

      {/* Le filtre film / série n'a de sens que sur les modes globaux : en mode
          personnel, la liste est déjà celle de vos propres demandes. */}
      {mode !== "personal" && (
        <div className="flex gap-2">
          {MEDIA.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onMediaFilterChange(m.value)}
              aria-pressed={mediaFilter === m.value}
              className={pill(mediaFilter === m.value)}
            >
              {t(m.key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
