import { useTranslation } from "react-i18next";
import type { CalendarMediaFilter, ReleasesSort } from "../../api/types-releases";
import { FilterSheet } from "../filters/FilterSheet";
import { FilterSection } from "../filters/FilterSection";
import { PlatformFilter } from "../PlatformFilter";
import { RatingSlider } from "../RatingSlider";
import { LANGUAGES } from "../../constants/languages";
import { pill } from "../../styles/pills";
import type { ReleasesFilterState } from "../../utils/calendar-filter";

/**
 * Les filtres de l'agenda.
 *
 * Remplace le mode « Par plateforme », qui imposait de choisir UNE plateforme
 * et d'abandonner au passage l'affichage de ses propres demandes. Le filtre est
 * désormais une sélection multiple, appliquée quel que soit le mode consulté :
 * cocher Netflix et Disney+ montre ce qui sort sur l'une OU l'autre.
 *
 * Les critères repris du catalogue s'arrêtent à ceux qui ont un sens ici : pas
 * de genres ni d'années — un agenda porte déjà sur une période — mais la note,
 * la langue et le tri, qui décident de ce qu'on voit en premier. En vue mois,
 * où une case n'affiche que les premières sorties de la journée, le tri décide
 * même de ce qu'on voit tout court.
 */

const MEDIA: Array<{ value: CalendarMediaFilter; key: string }> = [
  { value: "both", key: "seer:filterAllType" },
  { value: "movie", key: "seer:filterMovies" },
  { value: "tv", key: "seer:filterSeries" },
  { value: "anime", key: "seer:filterAnimes" },
];

/** « date » d'abord : c'est l'ordre historique, alphabétique dans la journée. */
const SORTS: Array<{ value: ReleasesSort; key: string }> = [
  { value: "date", key: "seer:sortTitle" },
  { value: "popularity", key: "seer:sortPopularity" },
  { value: "rating", key: "seer:sortRating" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  filters: ReleasesFilterState;
  onToggleProvider: (id: number) => void;
  onClearProviders: () => void;
  onMediaFilterChange: (v: CalendarMediaFilter) => void;
  onRatingMinChange: (v: number | null) => void;
  onLanguageChange: (v: string | null) => void;
  onSortByChange: (v: ReleasesSort) => void;
  onRequestedOnlyChange: (v: boolean) => void;
  /** Le mode « Tout » seul propose d'isoler les demandes : ailleurs, tout en est. */
  showRequestedOnly: boolean;
  onReset: () => void;
  activeCount: number;
  /** Nombre de sorties correspondant aux filtres, pour le bouton de sortie. */
  resultCount?: number | null;
}

export function ReleasesFilterSheet({
  open, onClose, filters, onToggleProvider, onClearProviders,
  onMediaFilterChange, onRatingMinChange, onLanguageChange, onSortByChange,
  onRequestedOnlyChange, showRequestedOnly, onReset, activeCount, resultCount,
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
        {showRequestedOnly && (
          <FilterSection title={t("seer:releasesTabAll")} count={filters.requestedOnly ? 1 : 0}>
            <button
              type="button"
              onClick={() => onRequestedOnlyChange(!filters.requestedOnly)}
              aria-pressed={filters.requestedOnly}
              className={pill(filters.requestedOnly)}
            >
              {t("seer:releasesOnlyRequested")}
            </button>
          </FilterSection>
        )}

        <FilterSection
          title={t("filterPlatforms")}
          count={filters.providerIds.length}
          onClear={onClearProviders}
        >
          <p className="mb-2 text-[11px] leading-relaxed text-tentacle-text-quaternary">
            {t("seer:releasesFilterPlatformsHint")}
          </p>
          <PlatformFilter selected={[...filters.providerIds]} onToggle={onToggleProvider} />
        </FilterSection>

        <FilterSection title={t("seer:filterType")} count={filters.mediaFilter === "both" ? 0 : 1}>
          <div className="flex flex-wrap gap-2">
            {MEDIA.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => onMediaFilterChange(m.value)}
                aria-pressed={filters.mediaFilter === m.value}
                className={pill(filters.mediaFilter === m.value)}
              >
                {t(m.key)}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection title={t("seer:filterSort")} count={filters.sortBy === "date" ? 0 : 1}>
          <div className="flex flex-wrap gap-2">
            {SORTS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => onSortByChange(s.value)}
                aria-pressed={filters.sortBy === s.value}
                className={pill(filters.sortBy === s.value)}
              >
                {t(s.key)}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection
          title={t("seer:filterRating")}
          count={filters.ratingMin != null ? 1 : 0}
          onClear={() => onRatingMinChange(null)}
        >
          <RatingSlider value={filters.ratingMin} onChange={onRatingMinChange} />
        </FilterSection>

        <FilterSection
          title={t("seer:filterLanguage")}
          count={filters.originalLanguage ? 1 : 0}
          onClear={() => onLanguageChange(null)}
        >
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => onLanguageChange(filters.originalLanguage === l.code ? null : l.code)}
                aria-pressed={filters.originalLanguage === l.code}
                className={pill(filters.originalLanguage === l.code)}
              >
                {t(`seer:${l.key}`)}
              </button>
            ))}
          </div>
        </FilterSection>
      </>
    </FilterSheet>
  );
}
