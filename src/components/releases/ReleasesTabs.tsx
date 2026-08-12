import { useTranslation } from "react-i18next";
import type { CalendarMediaFilter, CalendarMode } from "../../api/types-releases";
import { segment, SEGMENT_GROUP } from "../../styles/pills";
import { PlatformPicker } from "./PlatformPicker";

export type ReleasesView = "week" | "month";
/** Mes sorties : uniquement ce qui reste à venir, ou toutes les demandes. */
export type ReleasesScope = "upcoming" | "all";

interface Props {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  view: ReleasesView;
  onViewChange: (view: ReleasesView) => void;
  mediaFilter: CalendarMediaFilter;
  onMediaFilterChange: (value: CalendarMediaFilter) => void;
  scope: ReleasesScope;
  onScopeChange: (value: ReleasesScope) => void;
  providerId: number | null;
  onProviderChange: (id: number | null) => void;
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

const SCOPES: Array<{ value: ReleasesScope; key: string }> = [
  { value: "upcoming", key: "seer:releasesScopeUpcoming" },
  { value: "all", key: "seer:releasesScopeAll" },
];

/**
 * Une seule barre d'outils, en segments.
 *
 * Elle empilait jusqu'à trois rangées — modes, filtre média, puis quarante
 * pilules de plateformes — soit un mur qui repoussait l'agenda hors de l'écran.
 * Tout tient maintenant sur une ligne (deux en écran étroit), chaque groupe
 * lisible comme un interrupteur, et la plateforme derrière un menu.
 */
export function ReleasesTabs({
  mode, onModeChange, view, onViewChange,
  mediaFilter, onMediaFilterChange,
  scope, onScopeChange,
  providerId, onProviderChange,
}: Props) {
  const { t } = useTranslation("seer");

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className={SEGMENT_GROUP} role="tablist" aria-label={t("seer:releasesTitle")}>
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            onClick={() => onModeChange(m.value)}
            className={segment(mode === m.value)}
          >
            {t(m.key)}
          </button>
        ))}
      </div>

      {/* Mes sorties : par défaut on ne montre que ce qui reste à venir — d'où
          une page vide quand tout est déjà arrivé. « Toutes » lève ce filtre. */}
      {mode === "personal" && (
        <div className={SEGMENT_GROUP} role="group">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={scope === s.value}
              onClick={() => onScopeChange(s.value)}
              className={segment(scope === s.value)}
            >
              {t(s.key)}
            </button>
          ))}
        </div>
      )}

      {mode === "provider" && (
        <PlatformPicker value={providerId} onChange={onProviderChange} />
      )}

      {mode !== "personal" && (
        <div className={SEGMENT_GROUP} role="group">
          {MEDIA.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mediaFilter === m.value}
              onClick={() => onMediaFilterChange(m.value)}
              className={segment(mediaFilter === m.value)}
            >
              {t(m.key)}
            </button>
          ))}
        </div>
      )}

      {/* Poussé à droite : c'est un réglage d'affichage, pas un filtre. */}
      <div className={`${SEGMENT_GROUP} ml-auto`} role="tablist">
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
  );
}
