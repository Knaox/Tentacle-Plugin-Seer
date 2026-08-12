import { useTranslation } from "react-i18next";
import type { CalendarMediaFilter, CalendarMode } from "../../api/types-releases";

export type ReleasesView = "list" | "month";

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

/** Mode (mes sorties / tout / plateforme), filtre film-série, et vue. */
export function ReleasesTabs({
  mode, onModeChange, view, onViewChange, mediaFilter, onMediaFilterChange,
}: Props) {
  const { t } = useTranslation("seer");

  const pill = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-tentacle-brand text-tentacle-cta-brand-fg"
        : "bg-tentacle-fill-subtle text-tentacle-text-secondary hover:bg-tentacle-fill-medium"
    }`;

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

        <div className="flex gap-1 rounded-lg bg-tentacle-fill-subtle p-0.5">
          {(["list", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              aria-pressed={view === v}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                view === v
                  ? "bg-tentacle-fill-medium text-tentacle-text-primary"
                  : "text-tentacle-text-tertiary hover:text-tentacle-text-secondary"
              }`}
            >
              {t(v === "list" ? "seer:releasesViewList" : "seer:releasesViewMonth")}
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
