import { useState, useCallback, useMemo } from "react";
import type { CalendarMediaFilter, ReleasesSort } from "../api/types-releases";
import {
  DEFAULT_RELEASES_FILTERS, activeReleasesFilterCount,
  type ReleasesFilterState,
} from "../utils/calendar-filter";

/**
 * Les réglages de l'agenda, retenus d'une visite à l'autre.
 *
 * Tout est persisté, y compris le type de média — c'était jusqu'ici le seul
 * réglage de la page à repartir de zéro, et l'anomalie allait s'aggraver en
 * gagnant « Animés », un choix autrement plus engageant que films ou séries.
 *
 * Une seule clé JSON plutôt qu'une par réglage : les ajouter une à une avait
 * déjà produit quatre entrées de stockage pour une même page, et deux
 * migrations silencieuses. La lecture est défensive — un stockage écrit par une
 * version précédente, ou par une main humaine, ne doit pas casser la page.
 */
const KEY = "seer_releases_filters";
/** Ancienne clé, conservée en repli le temps d'une transition. */
const LEGACY_PROVIDERS_KEY = "seer_releases_providers";

function readFilters(): ReleasesFilterState {
  try {
    const brut = localStorage.getItem(KEY);
    if (brut) {
      const lu = JSON.parse(brut) as Partial<ReleasesFilterState>;
      return {
        ...DEFAULT_RELEASES_FILTERS,
        ...lu,
        providerIds: Array.isArray(lu.providerIds)
          ? lu.providerIds.filter((n) => Number.isFinite(n) && n > 0)
          : [],
      };
    }
    // Reprise de la sélection de plateformes de la version précédente.
    const anciens = JSON.parse(localStorage.getItem(LEGACY_PROVIDERS_KEY) ?? "[]");
    if (Array.isArray(anciens) && anciens.length > 0) {
      return { ...DEFAULT_RELEASES_FILTERS, providerIds: anciens.filter((n) => Number.isFinite(n) && n > 0) };
    }
  } catch { /* stockage indisponible ou corrompu */ }
  return DEFAULT_RELEASES_FILTERS;
}

export function useReleasesFilters() {
  const [filters, setFilters] = useState<ReleasesFilterState>(readFilters);

  const maj = useCallback((suite: Partial<ReleasesFilterState>) => {
    setFilters((cur) => {
      const next = { ...cur, ...suite };
      try { localStorage.setItem(KEY, JSON.stringify(next)); }
      catch { /* stockage indisponible */ }
      return next;
    });
  }, []);

  const toggleProvider = useCallback((id: number) => {
    setFilters((cur) => {
      const providerIds = cur.providerIds.includes(id)
        ? cur.providerIds.filter((x) => x !== id)
        : [...cur.providerIds, id];
      const next = { ...cur, providerIds };
      try { localStorage.setItem(KEY, JSON.stringify(next)); }
      catch { /* stockage indisponible */ }
      return next;
    });
  }, []);

  const reset = useCallback(() => maj(DEFAULT_RELEASES_FILTERS), [maj]);

  return {
    filters,
    toggleProvider,
    clearProviders: useCallback(() => maj({ providerIds: [] }), [maj]),
    setMediaFilter: useCallback((v: CalendarMediaFilter) => maj({ mediaFilter: v }), [maj]),
    setRatingMin: useCallback((v: number | null) => maj({ ratingMin: v }), [maj]),
    setOriginalLanguage: useCallback((v: string | null) => maj({ originalLanguage: v }), [maj]),
    setRequestedOnly: useCallback((v: boolean) => maj({ requestedOnly: v }), [maj]),
    setSortBy: useCallback((v: ReleasesSort) => maj({ sortBy: v }), [maj]),
    reset,
    activeFilterCount: useMemo(() => activeReleasesFilterCount(filters), [filters]),
  };
}
