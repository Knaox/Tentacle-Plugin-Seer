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
import { PlatformPicker } from "./PlatformPicker";
import { ReleasesTabs, type ReleasesView } from "./ReleasesTabs";
import { EmptyState } from "../EmptyState";
import { SkeletonList } from "../SkeletonList";
import { MediaDetailModal } from "../MediaDetailModal";
import { today, addDays } from "../../utils/calendar-groups";

const VIEW_KEY = "seer_releases_view";
const MODE_KEY = "seer_releases_mode";
const WINDOW_DAYS = 90;

const MODES: CalendarMode[] = ["personal", "all", "provider"];

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
      const saved = localStorage.getItem(MODE_KEY) as CalendarMode | null;
      return saved && MODES.includes(saved) ? saved : "personal";
    } catch { return "personal"; }
  });
  const changeMode = useCallback((next: CalendarMode) => {
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* stockage indisponible */ }
  }, []);
  const [mediaFilter, setMediaFilter] = useState<CalendarMediaFilter>("both");
  const [providerId, setProviderId] = useState<number | null>(null);
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

  const personal = usePersonalCalendar(from, to, mode === "personal");
  const global = useGlobalCalendar(
    { providerId: mode === "provider" ? providerId ?? undefined : undefined, mediaType: mediaFilter, from, to },
    mode === "all" || (mode === "provider" && providerId !== null),
  );

  const active = mode === "personal" ? personal : global;
  const items = useMemo(() => {
    const list = active.data?.items ?? [];
    if (mode === "personal" || mediaFilter === "both") return list;
    return list.filter((i) => i.mediaType === mediaFilter);
  }, [active.data, mode, mediaFilter]);

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

  const emptyKey =
    mode === "personal" ? "seer:releasesEmptyPersonal"
    : mode === "provider" ? "seer:releasesEmptyProvider"
    : "seer:releasesEmptyGlobal";

  const waitingForPlatform = mode === "provider" && providerId === null;

  return (
    <div className="px-4 pt-4 md:px-8">
      <h1 className="text-2xl font-bold text-tentacle-text-primary">{t("seer:releasesTitle")}</h1>
      <p className="mb-4 text-sm text-tentacle-text-tertiary">{t("seer:releasesSubtitle")}</p>

      <ReleasesTabs
        mode={mode}
        onModeChange={changeMode}
        view={view}
        onViewChange={changeView}
        mediaFilter={mediaFilter}
        onMediaFilterChange={setMediaFilter}
      />

      {mode === "provider" && <PlatformPicker value={providerId} onChange={setProviderId} />}

      {active.data?.partial && (
        <p className="mb-3 text-xs text-tentacle-text-quaternary">{t("seer:releasesPartial")}</p>
      )}

      {waitingForPlatform ? (
        <EmptyState title={t("seer:releasesPickPlatform")} />
      ) : active.isLoading ? (
        <SkeletonList count={6} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t(emptyKey)}
          subtitle={mode === "personal" ? t("seer:releasesEmptyPersonalHint") : undefined}
        />
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
