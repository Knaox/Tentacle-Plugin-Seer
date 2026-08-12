import { useTranslation } from "react-i18next";
import type { CalendarMode } from "../../api/types-releases";
import { segment, SEGMENT_GROUP } from "../../styles/pills";

export type ReleasesView = "week" | "month";
/** Mes sorties : uniquement ce qui reste à venir, ou toutes les demandes. */
export type ReleasesScope = "upcoming" | "all";

interface Props {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  view: ReleasesView;
  onViewChange: (view: ReleasesView) => void;
  scope: ReleasesScope;
  onScopeChange: (value: ReleasesScope) => void;
  /** Familles de filtres actives — pastille du bouton. */
  activeFilterCount: number;
  onOpenFilters: () => void;
}

const MODES: Array<{ value: CalendarMode; key: string }> = [
  { value: "personal", key: "seer:releasesTabPersonal" },
  { value: "all", key: "seer:releasesTabAll" },
];

const SCOPES: Array<{ value: ReleasesScope; key: string }> = [
  { value: "upcoming", key: "seer:releasesScopeUpcoming" },
  { value: "all", key: "seer:releasesScopeAll" },
];

/**
 * Une seule barre d'outils, en segments.
 *
 * Le mode « Par plateforme » a disparu : il imposait de choisir UNE plateforme
 * et faisait perdre au passage l'affichage de ses propres demandes. Les
 * plateformes sont maintenant un filtre à sélection multiple, derrière le même
 * bouton que sur le catalogue — donc combinable avec n'importe quel mode.
 */
export function ReleasesTabs({
  mode, onModeChange, view, onViewChange,
  scope, onScopeChange,
  activeFilterCount, onOpenFilters,
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

      {/* Même bouton que sur le catalogue : un filtre s'ouvre partout pareil. */}
      <button
        type="button"
        onClick={onOpenFilters}
        className="relative flex items-center gap-1.5 rounded-lg border border-tentacle-border-subtle bg-tentacle-fill-subtle px-3 py-1.5 text-xs font-medium text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-medium hover:text-tentacle-text-secondary"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
        </svg>
        {t("filterTitle")}
        {activeFilterCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-tentacle-brand text-[9px] font-bold text-tentacle-cta-brand-fg">
            {activeFilterCount}
          </span>
        )}
      </button>

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
