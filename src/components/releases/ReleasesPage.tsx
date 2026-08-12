import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem, CalendarMediaFilter, CalendarMode } from "../../api/types-releases";
import type { SeerrSearchResult } from "../../api/types";
import { usePersonalCalendar, useGlobalCalendar } from "../../hooks/useReleases";
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

const VIEW_KEY = "seer_releases_view";
const MODE_KEY = "seer_releases_mode";
const PROVIDERS_KEY = "seer_releases_providers";
const WINDOW_DAYS = 90;

const MODES: CalendarMode[] = ["personal", "all"];

/** Sélection retenue d'une visite à l'autre, comme le mode et la vue. */
function readProviders(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PROVIDERS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((n) => Number.isFinite(n) && n > 0) : [];
  } catch { return []; }
}

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
  const [mediaFilter, setMediaFilter] = useState<CalendarMediaFilter>("both");
  const [scope, setScope] = useState<ReleasesScope>("upcoming");
  const [providerIds, setProviderIds] = useState<number[]>(readProviders);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<SeerrSearchResult | null>(null);

  const changeProviders = useCallback((next: number[]) => {
    setProviderIds(next);
    try { localStorage.setItem(PROVIDERS_KEY, JSON.stringify(next)); }
    catch { /* stockage indisponible */ }
  }, []);
  const toggleProvider = useCallback((id: number) => {
    setProviderIds((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try { localStorage.setItem(PROVIDERS_KEY, JSON.stringify(next)); }
      catch { /* stockage indisponible */ }
      return next;
    });
  }, []);

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

  const personal = usePersonalCalendar(from, to, mode === "personal", scope === "all");
  const global = useGlobalCalendar(
    { providerIds, mediaType: mediaFilter, from, to },
    mode === "all",
  );

  const active = mode === "personal" ? personal : global;
  const items = useMemo(() => {
    let list = active.data?.items ?? [];
    if (mediaFilter !== "both") list = list.filter((i) => i.mediaType === mediaFilter);
    /* Le serveur applique déjà les plateformes au mode « Tout » ; « Mes
     * sorties » vient de vos demandes et se filtre donc ici, sur les
     * plateformes déjà connues de chaque fiche. Un OU : cocher Netflix et
     * Disney+ montre ce qui est sur l'une ou l'autre. */
    if (mode === "personal" && providerIds.length > 0) {
      list = list.filter((i) => i.providerIds.some((id) => providerIds.includes(id)));
    }
    return list;
  }, [active.data, mode, mediaFilter, providerIds]);

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

  const filtered = providerIds.length > 0;
  const activeFilterCount = (filtered ? 1 : 0) + (mediaFilter === "both" ? 0 : 1);
  const resetFilters = useCallback(() => {
    changeProviders([]);
    setMediaFilter("both");
  }, [changeProviders]);

  const emptyKey = filtered
    ? "seer:releasesEmptyFiltered"
    : mode === "personal" ? "seer:releasesEmptyPersonal" : "seer:releasesEmptyGlobal";

  const emptyHint = filtered
    ? t("seer:releasesEmptyFilteredHint")
    : mode === "personal" ? t("seer:releasesEmptyPersonalHint") : undefined;

  return (
    <div className="px-4 pt-4 md:px-8">
      <h1 className="text-2xl font-bold text-tentacle-text-primary">{t("seer:releasesTitle")}</h1>
      <p className="mb-4 text-sm text-tentacle-text-tertiary">{t("seer:releasesSubtitle")}</p>

      <ReleasesTabs
        mode={mode}
        onModeChange={changeMode}
        view={view}
        onViewChange={changeView}
        scope={scope}
        onScopeChange={setScope}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <ReleasesFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        providerIds={providerIds}
        onToggleProvider={toggleProvider}
        onClearProviders={() => changeProviders([])}
        mediaFilter={mediaFilter}
        onMediaFilterChange={setMediaFilter}
        onReset={resetFilters}
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
