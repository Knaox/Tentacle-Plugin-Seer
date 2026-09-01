import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useInfiniteSentinel } from "../hooks/useInfiniteSentinel";
import { useTranslation } from "react-i18next";
import { useTrending } from "../hooks/useDiscoverMedia";
import { useInfiniteDiscover } from "../hooks/useInfiniteDiscover";
import { useDiscoverFilters } from "../hooks/useDiscoverFilters";
import { useSeerSearch } from "../hooks/useSearch";
import { useRequestMedia } from "../hooks/useRequestMedia";
import type { RequestMediaPayload } from "../hooks/useRequestMedia";
import { formatSeerError } from "../api/seer-client";
import { DiscoverGrid } from "./DiscoverGrid";
import { FilterPanel } from "./FilterPanel";
import { DiscoverSearchHeader } from "./DiscoverSearchHeader";
import { HeroCarousel } from "./HeroCarousel";
import { MediaDetailModal } from "./MediaDetailModal";
import { SkeletonList } from "./SkeletonList";
import { EmptyState } from "./EmptyState";
import { mediaTitle, mediaYear } from "../utils/media-helpers";
import { useToast } from "../hooks/useToast";
import { useAvailability } from "../hooks/useAvailability";
import { matchesChannels } from "../utils/channel-filter";
import { POSTER_GUARD } from "../hooks/useNearViewport";
import { useSearchHotkey, useScrollTopOnMount } from "../hooks/useSearchHotkey";
import type { SeerrSearchResult, DiscoverMediaType } from "../api/types";

export function DiscoverPage() {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mediaType, setMediaType] = useState<DiscoverMediaType>("movies");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  // « Afficher quand même » le contenu masqué par le blocage par tags Jellyseerr.
  const [showBlocked, setShowBlocked] = useState<boolean>(() => {
    try { return localStorage.getItem("seer_show_blocked") === "1"; } catch { return false; }
  });
  const toggleShowBlocked = useCallback(() => {
    setShowBlocked((prev) => {
      const next = !prev;
      try { localStorage.setItem("seer_show_blocked", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const [selectedItem, setSelectedItem] = useState<SeerrSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const savedScrollY = useRef(0);
  const [viewKey, setViewKey] = useState(0);

  const {
    filters, toggleGenre, toggleWatchProvider,
    setYearFrom, setYearTo, setRatingMin, setOriginalLanguage,
    toggleTvStatus, toggleChannel, setSortBy, setSortOrder,
    resetFilters, resetGenres, activeFilterCount, hasActiveFilters,
  } = useDiscoverFilters();

  // Reset genres + tvStatus when switching tabs (different IDs for movies vs TV)
  const handleTabChange = useCallback((newType: DiscoverMediaType) => {
    if (newType !== mediaType) {
      resetGenres();
      setMediaType(newType);
      setViewKey((k) => k + 1);
    }
  }, [mediaType, resetGenres]);

  const openModal = useCallback((item: SeerrSearchResult) => {
    savedScrollY.current = window.scrollY;
    setSelectedItem(item);
  }, []);

  // Deep-link hôte : « /discover?media=movie:603 » ouvre la fiche à l'arrivée.
  // La query de la route hôte arrive par `__tentacle_env.query` (hôtes >= 1.16 ;
  // champ ADDITIF, absent avant — d'où l'optionnel). La modale charge ensuite
  // le détail elle-même : un item minimal { id, mediaType } lui suffit.
  useEffect(() => {
    const query = (window as { __tentacle_env?: { query?: string } }).__tentacle_env?.query;
    if (!query) return;
    const media = new URLSearchParams(query).get("media");
    const match = media?.match(/^(movie|tv):(\d+)$/);
    if (!match) return;
    const id = Number(match[2]);
    if (!Number.isFinite(id) || id <= 0) return;
    setSelectedItem({ id, mediaType: match[1] as "movie" | "tv" });
    // Au montage uniquement : le deep-link est un point d'ENTRÉE, pas un état
    // suivi — fermer la fiche ne doit pas la rouvrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = useCallback(() => {
    setSelectedItem(null);
    requestAnimationFrame(() => window.scrollTo(0, savedScrollY.current));
  }, []);

  // Hero uses trending
  const { data: trendingData, isError: trendingError } = useTrending(1, showBlocked);

  // Seerr-style infinite discover
  const {
    titles,
    isLoadingInitialData,
    isLoadingMore,
    isEmpty,
    isReachingEnd,
    fetchMore,
    totalResults,
    blockedActive,
    isError,
    error,
    refetch,
  } = useInfiniteDiscover(mediaType, filters, showBlocked);

  const { data: searchData, isLoading: searchLoading } = useSeerSearch(debouncedQuery, 1, showBlocked);
  const requestMedia = useRequestMedia();

  const isSearching = debouncedQuery.length >= 2;
  const isLoading = isSearching ? searchLoading : isLoadingInitialData;
  const hasError = isError || trendingError;
  const errorMessage = error?.message || "";

  /* Mémoïsé : sans cela, un tableau neuf à chaque rendu relançait tout le
   * pipeline de disponibilité et re-diffait la grille entière. */
  const filtered = useMemo(() => {
    const raw = isSearching ? (searchData?.results ?? []) : titles;
    return raw.filter((item) => item.mediaType !== "person");
  }, [isSearching, searchData, titles]);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // ⌘K / Ctrl+K → barre de recherche ; Échap → efface.
  const clearQuery = useCallback(() => setQuery(""), []);
  useSearchHotkey(searchInputRef, clearQuery);

  // Revenir sur le catalogue le rouvre en haut, pas à mi-hauteur.
  useScrollTopOnMount();

  /* La fiche détail fige la garde des affiches. Elle bloque le défilement du
   * corps et prévient l'hôte qu'un calque est ouvert ; si celui-ci réduit ou
   * recouvre le cadre, toutes les cartes se retrouvent d'un coup hors zone —
   * la grille se viderait derrière la fiche pour se recharger en vague à la
   * fermeture, sur l'interaction la plus fréquente de la page.
   *
   * Le dégel au démontage n'est pas une précaution de style : « Regarder » quitte
   * le plugin depuis la fiche ouverte. Une garde restée figée ne rendrait plus
   * aucun verdict, et le catalogue rouvrirait entièrement vide. */
  useEffect(() => {
    POSTER_GUARD.setPaused(!!selectedItem);
    return () => POSTER_GUARD.setPaused(false);
  }, [selectedItem]);

  /* Verdicts de sortie pour la grille entière, en une requête. La grille ne
   * les attend pas : les pastilles apparaissent quand la réponse arrive. */
  const availability = useAvailability(filtered);

  /* Canal de sortie — APRÈS la demande de disponibilité, jamais avant : le
   * verdict porte sur cette liste, filtrer en amont ferait dépendre la question
   * de sa propre réponse (cf. `channel-filter.ts` pour le reste). */
  const shown = useMemo(
    () => (filters.channels.length === 0 ? filtered : filtered.filter(
      (item) => matchesChannels(availability.get(`${item.mediaType}:${item.id}`), filters.channels),
    )),
    [filtered, availability, filters.channels],
  );

  /* Défilement infini : la sentinelle s'observe par référence de rappel, donc
   * dès qu'elle entre dans le document — au premier rendu la grille est encore
   * vide, et un effet classique ressortirait sans rien observer. */
  const sentinelRef = useInfiniteSentinel(fetchMore, !isSearching);

  const handleRequest = useCallback((item: SeerrSearchResult) => {
    if (item.mediaType === "movie" || item.mediaType === "tv") {
      const payload: RequestMediaPayload = {
        mediaType: item.mediaType,
        tmdbId: item.id,
        title: mediaTitle(item) || t("seer:untitled"),
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        overview: item.overview,
        year: mediaYear(item),
      };
      requestMedia.mutate(payload, {
        onSuccess: () => toast.show("success", t("requestAdded")),
        onError: (err) => toast.show("error", formatSeerError(err, t, "seer:requestError")),
      });
    }
  }, [requestMedia, toast, t]);

  return (
    <div className="px-4 pt-4 md:px-8">
      {/* Hero Carousel — always rendered; dimmed + blurred when searching */}
      {trendingData?.results && (
        <div className="-mx-4 -mt-4 mb-6 md:-mx-8 relative">
          {/* On fond l'opacité au lieu de transitionner un `filter` : un flou
              animé sur une bannière plein écran repeint tout le viewport à
              chaque image (règle GPU du projet). Le flou reste, il ne s'anime
              simplement plus. */}
          <div
            className="transition-opacity duration-300"
            style={isSearching ? { filter: "blur(4px) brightness(0.3)", pointerEvents: "none", maxHeight: "200px", opacity: 0.5 } : { maxHeight: "500px", opacity: 1 }}
          >
            <HeroCarousel
              items={trendingData.results}
              onSelect={openModal}
              onRequest={handleRequest}
            />
          </div>
        </div>
      )}

      <DiscoverSearchHeader
        query={query}
        onQueryChange={setQuery}
        searchInputRef={searchInputRef}
        isSearching={isSearching}
        mediaType={mediaType}
        onTabChange={handleTabChange}
        onOpenFilterPanel={() => setFilterPanelOpen(true)}
        activeFilterCount={activeFilterCount}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
        totalResults={totalResults}
        isLoading={isLoading}
        filters={filters}
        onRemoveGenre={toggleGenre}
        onRemoveWatchProvider={toggleWatchProvider}
        onClearYears={() => { setYearFrom(null); setYearTo(null); }}
        onClearRating={() => setRatingMin(null)}
        onClearLanguage={() => setOriginalLanguage(null)}
        onRemoveTvStatus={toggleTvStatus}
        showBlockedBanner={
          !isLoading && (isSearching
            ? !!searchData?.blockedActive && (showBlocked || (searchData?.blockedCount ?? 0) > 0)
            : blockedActive)
        }
        blockedCount={isSearching ? (searchData?.blockedCount ?? 0) : 0}
        showBlocked={showBlocked}
        onToggleShowBlocked={toggleShowBlocked}
      />

      {/* Results */}
      <div key={viewKey} style={{ animation: "viewCrossfade 200ms ease" }}>
      {isLoading ? (
        <SkeletonList count={20} />
      ) : hasError && shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <svg className="h-10 w-10 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-sm font-medium text-tentacle-text-secondary">{t("seer:connectionError")}</p>
          {errorMessage && (
            <p className="max-w-md text-center text-xs text-tentacle-text-quaternary">{errorMessage}</p>
          )}
          <button
            onClick={() => { refetch(); }}
            className="mt-2 rounded-lg bg-tentacle-brand px-4 py-2 text-xs font-semibold text-tentacle-cta-brand-fg transition-opacity hover:opacity-90"
          >
            {t("seer:retry")}
          </button>
        </div>
      ) : shown.length > 0 ? (
        <DiscoverGrid
          items={shown}
          availability={availability}
          requesting={requestMedia.isPending}
          onRequest={handleRequest}
          onOpen={openModal}
          sentinelRef={sentinelRef}
          showSkeletons={isLoadingMore && !isReachingEnd}
        />
      ) : (
        <EmptyState
          title={isSearching ? t("seer:noResults") : t("seer:noContent")}
          subtitle={isSearching ? undefined : t("noContentHint")}
        />
      )}
      </div>

      {/* Detail modal */}
      {selectedItem && (
        <MediaDetailModal
          item={selectedItem}
          onClose={closeModal}
          onRequest={handleRequest}
          requesting={requestMedia.isPending}
        />
      )}

      {/* Filter slide-over */}
      <FilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        mediaType={mediaType}
        filters={filters}
        onToggleGenre={toggleGenre}
        onToggleWatchProvider={toggleWatchProvider}
        onYearFromChange={setYearFrom}
        onYearToChange={setYearTo}
        onRatingMinChange={setRatingMin}
        onLanguageChange={setOriginalLanguage}
        onToggleTvStatus={toggleTvStatus}
        onToggleChannel={toggleChannel}
        onSortByChange={setSortBy}
        onSortOrderChange={setSortOrder}
        onReset={resetFilters}
        activeFilterCount={activeFilterCount}
        resultCount={totalResults}
      />
    </div>
  );
}
