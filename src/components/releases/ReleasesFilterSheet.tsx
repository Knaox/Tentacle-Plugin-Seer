import { useTranslation } from "react-i18next";
import type { CalendarMediaFilter } from "../../api/types-releases";
import { FilterSheet } from "../filters/FilterSheet";
import { FilterSection } from "../filters/FilterSection";
import { PlatformFilter } from "../PlatformFilter";
import { pill } from "../../styles/pills";

/**
 * Les filtres de l'agenda.
 *
 * Remplace le mode « Par plateforme », qui imposait de choisir UNE plateforme
 * et d'abandonner au passage l'affichage de ses propres demandes. Le filtre est
 * désormais une sélection multiple, appliquée quel que soit le mode consulté :
 * cocher Netflix et Disney+ montre ce qui sort sur l'une OU l'autre.
 */

const MEDIA: Array<{ value: CalendarMediaFilter; key: string }> = [
  { value: "both", key: "seer:filterAllType" },
  { value: "movie", key: "seer:filterMovies" },
  { value: "tv", key: "seer:filterSeries" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  providerIds: number[];
  onToggleProvider: (id: number) => void;
  onClearProviders: () => void;
  mediaFilter: CalendarMediaFilter;
  onMediaFilterChange: (v: CalendarMediaFilter) => void;
  onReset: () => void;
  activeCount: number;
  /** Nombre de sorties correspondant aux filtres, pour le bouton de sortie. */
  resultCount?: number | null;
}

export function ReleasesFilterSheet({
  open, onClose, providerIds, onToggleProvider, onClearProviders,
  mediaFilter, onMediaFilterChange, onReset, activeCount, resultCount,
}: Props) {
  const { t } = useTranslation("seer");

  return (
    <FilterSheet
      open={open}
      onClose={onClose}
      title={t("seer:releasesFiltersTitle")}
      activeCount={activeCount}
      onReset={onReset}
      footerLabel={resultCount != null ? t("seer:releasesShowResults", { count: resultCount }) : undefined}
    >
      <>
        <FilterSection
          title={t("filterPlatforms")}
          count={providerIds.length}
          onClear={onClearProviders}
        >
          <p className="mb-2 text-[11px] leading-relaxed text-tentacle-text-quaternary">
            {t("seer:releasesFilterPlatformsHint")}
          </p>
          <PlatformFilter selected={providerIds} onToggle={onToggleProvider} />
        </FilterSection>

        <FilterSection title={t("seer:filterType")} count={mediaFilter === "both" ? 0 : 1}>
          <div className="flex flex-wrap gap-2">
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
        </FilterSection>
      </>
    </FilterSheet>
  );
}
