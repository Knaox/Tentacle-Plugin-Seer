import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem, CalendarMode } from "../../api/types-releases";
import type { SeerrSearchResult } from "../../api/types";
import { usePersonalCalendar, useGlobalCalendar } from "../../hooks/useReleases";
import { useReleasesFilters } from "../../hooks/useReleasesFilters";
import { matchesReleaseFilters, sortReleases } from "../../utils/calendar-filter";
import { useScrollTopOnMount } from "../../hooks/useSearchHotkey";
import { useRequestMedia } from "../../hooks/useRequestMedia";
import { useToast } from "../../hooks/useToast";
import { formatSeerError } from "../../api/seer-client";
import { mediaTitle, mediaYear } from "../../utils/media-helpers";
import { ReleaseMonthView } from "./ReleaseMonthView";
import { ReleaseWeekView } from "./ReleaseWeekView";
import { ReleasesTabs, type ReleasesView, type ReleasesScope } from "./ReleasesTabs";
import { ReleasesFilterSheet } from "./ReleasesFilterSheet";
import { EmptyState } from "../EmptyState";
import { SkeletonList } from "../SkeletonList";
import { MediaDetailModal } from "../MediaDetailModal";
import { today, addDays } from "../../utils/calendar-groups";
import { applyLocalDays } from "../../utils/calendar-localtime";

const VIEW_KEY = "seer_releases_view";
const MODE_KEY = "seer_releases_mode";
const SCOPE_KEY = "seer_releases_scope";
const WINDOW_DAYS = 90;

const MODES: CalendarMode[] = ["personal", "all"];

/**
 * Les prochaines dates : celles des demandes en cours, ou celles d'une
 * plateforme entière — même sans avoir rien demandé.
 */
export function ReleasesPage() {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const requestMedia = useRequestMedia();
  useScrollTopOnMount();

  /* Le mode consulté est retenu : quelqu'un qui suit surtout une plateforme n'a
   * pas à repasser par « Mes sorties » à chaque visite. */
  const [mode, setMode] = useState<CalendarMode>(() => {
    try {
      // Un « provider » hérité de la version précédente doit être relu comme
      // « all » : le mode par plateforme est devenu un filtre.
      const saved = localStorage.getItem(MODE_KEY) as CalendarMode | null;
      if (saved === ("provider" as CalendarMode)) return "all";
      return saved && MODES.includes(saved) ? saved : "personal";
    } catch { return "personal"; }
  });
  const changeMode = useCallback((next: CalendarMode) => {
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* stockage indisponible */ }
  }, []);
  const releasesFilters = useReleasesFilters();
  const { filters } = releasesFilters;
  /* Retenu comme le mode et la vue : c'était le seul réglage de la page à
   * repartir de zéro à chaque visite. */
  const [scope, setScope] = useState<ReleasesScope>(() => {
    try { return localStorage.getItem(SCOPE_KEY) === "everyone" ? "everyone" : "mine"; }
    catch { return "mine"; }
  });
  const changeScope = useCallback((next: ReleasesScope) => {
    setScope(next);
    try { localStorage.setItem(SCOPE_KEY, next); } catch { /* stockage indisponible */ }
  }, []);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<SeerrSearchResult | null>(null);

  const [view, setView] = useState<ReleasesView>(() => {
    // Une valeur « list » héritée de la version précédente doit être relue
    // comme « week » : la vue liste n'existe plus.
    try { return localStorage.getItem(VIEW_KEY) === "month" ? "month" : "week"; }
    catch { return "week"; }
  });
  const changeView = useCallback((next: ReleasesView) => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* stockage indisponible */ }
  }, []);

  /* Fenêtre de données pilotée par la navigation de l'agenda.
   *
   * Elle était figée à « aujourd'hui → +90 jours » : dès qu'on avançait d'une
   * semaine au-delà, la vue se vidait et paraissait cassée. Les vues signalent
   * donc la période qu'elles affichent, et la fenêtre s'élargit pour la couvrir
   * — sans jamais rétrécir, ce qui garde le résultat en cache d'un aller-retour
   * à l'autre. */
  const [range, setRange] = useState(() => {
    const start = today();
    return { from: start, to: addDays(start, WINDOW_DAYS) };
  });

  const coverRange = useCallback((wantFrom: string, wantTo: string) => {
    setRange((cur) => {
      const from = wantFrom < cur.from ? wantFrom : cur.from;
      const to = wantTo > cur.to ? wantTo : cur.to;
      return from === cur.from && to === cur.to ? cur : { from, to };
    });
  }, []);

  const { from, to } = range;

  /* Toujours l'intégralité des demandes : ne montrer que ce qui restait à venir
   * donnait une page vide dès que tout était arrivé. */
  const personal = usePersonalCalendar(from, to, mode === "personal", true, scope === "everyone");
  const global = useGlobalCalendar(
    /* Le serveur ne connaît pas « Animés » et retomberait en silence sur
     * « tout » : on lui demande les séries, le tri fin se fait ici sur la
     * fiche — exactement ce que fait déjà le catalogue. */
    {
      providerIds: filters.providerIds,
      mediaType: filters.mediaFilter === "anime" ? "tv" : filters.mediaFilter,
      from, to,
    },
    mode === "all",
  );

  const active = mode === "personal" ? personal : global;
  const items = useMemo(() => {
    // Au bon jour d'abord : un épisode annoncé le 14 peut sortir le 13 au soir.
    const list = applyLocalDays(active.data?.items ?? []);
    /* En mode « Tout », le serveur a DÉJÀ trié par plateforme — il interroge
     * TMDB avec elles. Repasser le filtre ici écartait les séries et les
     * animés : ils arrivent par le calendrier des prochains épisodes, dont les
     * plateformes ne sont renseignées que si la mémoire des fiches les connaît.
     * Le serveur les avait retenus à juste titre, on les jetait juste après. */
    const aAppliquer = mode === "all" ? { ...filters, providerIds: [] } : filters;
    return sortReleases(list.filter((i) => matchesReleaseFilters(i, aAppliquer)), filters.sortBy);
  }, [active.data, mode, filters]);

  /* Ouvrir une sortie mène à la fiche habituelle : depuis le calendrier, on
   * peut donc demander directement un titre encore à paraître. */
  const openItem = useCallback((item: CalendarItem) => {
    setSelected({
      id: item.tmdbId,
      mediaType: item.mediaType,
      title: item.mediaType === "movie" ? item.title : undefined,
      name: item.mediaType === "tv" ? item.title : undefined,
      posterPath: item.posterPath ?? undefined,
      backdropPath: item.backdropPath ?? undefined,
      overview: item.overview ?? undefined,
      releaseDate: item.mediaType === "movie" ? item.date : undefined,
      firstAirDate: item.mediaType === "tv" ? item.date : undefined,
    } as SeerrSearchResult);
  }, []);

  /* Demander directement depuis le calendrier : c'est tout l'intérêt de voir
   * une sortie à venir. */
  const handleRequest = useCallback((item: SeerrSearchResult) => {
    if (item.mediaType !== "movie" && item.mediaType !== "tv") return;
    requestMedia.mutate(
      {
        mediaType: item.mediaType,
        tmdbId: item.id,
        title: mediaTitle(item) || t("seer:untitled"),
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        overview: item.overview,
        year: mediaYear(item),
      },
      {
        onSuccess: () => toast.show("success", t("requestAdded")),
        onError: (err) => toast.show("error", formatSeerError(err, t, "seer:requestError")),
      },
    );
  }, [requestMedia, toast, t]);

  /* Sur `activeFilterCount` et non sur les seules plateformes : sinon régler
   * « note ≥ 8 » et vider l'agenda annonçait « vous n'avez aucune demande à
   * venir » — un mensonge, et le pire message possible pour un filtre. */
  const { activeFilterCount } = releasesFilters;
  const filtered = activeFilterCount > 0;

  const everyone = mode === "personal" && scope === "everyone";

  const emptyKey = filtered
    ? "seer:releasesEmptyFiltered"
    : everyone ? "seer:releasesEmptyEveryone"
    : mode === "personal" ? "seer:releasesEmptyPersonal"
    : "seer:releasesEmptyGlobal";

  const emptyHint = filtered
    ? t("seer:releasesEmptyFilteredHint")
    : everyone ? t("seer:releasesEveryoneHint")
    : mode === "personal" ? t("seer:releasesEmptyPersonalHint") : undefined;

  return (
    <div className="px-4 pt-4 md:px-8">
      <h1 className="text-2xl font-bold text-tentacle-text-primary">{t("seer:releasesTitle")}</h1>
      <p className="mb-4 text-sm text-tentacle-text-tertiary">
        {everyone ? t("seer:releasesEveryoneHint") : t("seer:releasesSubtitle")}
      </p>

      <ReleasesTabs
        mode={mode}
        onModeChange={changeMode}
        view={view}
        onViewChange={changeView}
        scope={scope}
        onScopeChange={changeScope}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <ReleasesFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onToggleProvider={releasesFilters.toggleProvider}
        onClearProviders={releasesFilters.clearProviders}
        onMediaFilterChange={releasesFilters.setMediaFilter}
        onRatingMinChange={releasesFilters.setRatingMin}
        onLanguageChange={releasesFilters.setOriginalLanguage}
        onSortByChange={releasesFilters.setSortBy}
        onRequestedOnlyChange={releasesFilters.setRequestedOnly}
        showRequestedOnly={mode === "all"}
        onReset={releasesFilters.reset}
        activeCount={activeFilterCount}
        resultCount={active.isLoading ? null : items.length}
      />

      {active.data?.partial && (
        <p className="mb-3 text-xs text-tentacle-text-quaternary">{t("seer:releasesPartial")}</p>
      )}

      {active.isLoading ? (
        <SkeletonList count={6} />
      ) : items.length === 0 ? (
        <EmptyState title={t(emptyKey)} subtitle={emptyHint} />
      ) : view === "month" ? (
        <ReleaseMonthView items={items} onOpen={openItem} onRangeChange={coverRange} />
      ) : (
        <ReleaseWeekView items={items} onOpen={openItem} onRangeChange={coverRange} />
      )}

      {selected && (
        <MediaDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onRequest={handleRequest}
          requesting={requestMedia.isPending}
        />
      )}
    </div>
  );
}
