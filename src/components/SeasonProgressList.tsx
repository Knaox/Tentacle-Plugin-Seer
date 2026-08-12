import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DownloadProgress } from "../api/types-releases";
import { groupBySeason, type SeasonProgress } from "../utils/group-downloads";
import { STATUS_STYLE } from "../styles/status";

/**
 * Où en est chaque saison d'une demande de série.
 *
 * La donnée par épisode arrivait déjà jusqu'ici et ne servait qu'à écrire
 * « 12 épisodes en cours » — un compteur qui ne dit ni quelle saison avance,
 * ni si la seconde a seulement commencé.
 *
 * Une saison ne s'ouvre que si on le demande : afficher vingt-quatre lignes
 * d'épisodes sous chaque carte de demande noierait la page. Et l'avancement
 * affiché ici est celui MESURÉ, sans interpolation : une horloge par épisode
 * multipliée par le nombre de cartes ferait chauffer la page pour animer des
 * barres de quatre pixels.
 */

interface Props {
  downloads: readonly DownloadProgress[];
  /** Saisons demandées, pour montrer celles qui n'ont pas encore commencé. */
  requestedSeasons?: readonly number[] | null;
}

export const SeasonProgressList = memo(function SeasonProgressList({
  downloads, requestedSeasons,
}: Props) {
  const groups = groupBySeason(downloads, requestedSeasons);
  if (groups.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {groups.map((g) => (
        <SeasonRowItem key={g.seasonNumber ?? "none"} group={g} soleSeason={groups.length === 1} />
      ))}
    </ul>
  );
});

function SeasonRowItem({ group, soleSeason }: { group: SeasonProgress; soleSeason: boolean }) {
  const { t } = useTranslation("seer");
  const [open, setOpen] = useState(soleSeason);
  const canOpen = group.episodes.length > 0;

  const label = group.seasonNumber == null
    ? t("seer:progressNoSeason")
    : t("seer:progressSeason", { season: group.seasonNumber });

  const state = group.waiting
    ? t("seer:progressSeasonWaiting")
    : group.validating
      ? t("seer:statusValidating")
      : t("seer:progressEpisodes", { count: group.episodes.length });

  return (
    <li>
      <button
        type="button"
        onClick={() => canOpen && setOpen((v) => !v)}
        aria-expanded={canOpen ? open : undefined}
        disabled={!canOpen}
        className="flex w-full items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] disabled:cursor-default"
      >
        <span className="w-16 shrink-0 truncate text-[10px] font-medium text-tentacle-text-secondary">
          {label}
        </span>
        <Bar percent={group.percent} muted={group.waiting} validating={group.validating} />
        <span className="shrink-0 text-[10px] tabular-nums text-tentacle-text-quaternary">
          {group.percent != null && !group.validating ? `${Math.floor(group.percent)} %` : state}
        </span>
        {canOpen && <Chevron open={open} />}
      </button>

      {open && canOpen && (
        <ul className="mt-1 flex flex-col gap-1 pl-[4.5rem]">
          {group.episodes.map((e) => (
            <li key={`${e.seasonNumber}-${e.episodeNumber}-${e.title ?? ""}`} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-[10px] tabular-nums text-tentacle-text-quaternary">
                {e.episodeNumber != null ? `E${e.episodeNumber}` : "—"}
              </span>
              <Bar percent={e.percent} validating={e.validating} thin />
              <span className="shrink-0 text-[10px] tabular-nums text-tentacle-text-quaternary">
                {e.validating ? "✓" : e.percent != null ? `${Math.floor(e.percent)} %` : "…"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Bar({ percent, muted, validating, thin }: {
  percent: number | null; muted?: boolean; validating?: boolean; thin?: boolean;
}) {
  const height = thin ? "h-1" : "h-1.5";
  if (muted) return <div className={`${height} w-full rounded-full bg-tentacle-surface-2`} />;

  const fill = validating ? STATUS_STYLE.processing.solid : STATUS_STYLE.downloading.solid;
  return (
    <div className={`${height} w-full overflow-hidden rounded-full bg-tentacle-surface-2`}>
      {validating || percent != null ? (
        // Seule `transform` est animée — animer la largeur repeindrait la carte
        // à chaque image (règle GPU du projet).
        <div
          className={`h-full origin-left rounded-full ${fill}`}
          style={{
            transform: `scaleX(${validating ? 1 : Math.max(0.005, (percent ?? 0) / 100)})`,
            transition: "transform 900ms linear",
          }}
        />
      ) : (
        <div
          className={`h-full w-1/3 rounded-full ${fill}`}
          style={{ animation: "seerIndeterminate 1.4s ease-in-out infinite" }}
        />
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className="h-3 w-3 shrink-0 text-tentacle-text-quaternary transition-transform"
      style={{ transform: open ? "rotate(180deg)" : "none" }}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}
