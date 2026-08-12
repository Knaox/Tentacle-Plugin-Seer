import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { DownloadProgress } from "../api/types-releases";
import { useInterpolatedProgress } from "../hooks/useDownloadProgress";
import { formatBytes, formatEta } from "../utils/format-bytes";
import { SeasonProgressList } from "./SeasonProgressList";
import { STATUS_STYLE } from "../styles/status";

/**
 * Avancement réel, remplaçant la barre à cinq étapes purement symbolique.
 *
 * Deux cas volontairement distincts :
 *   - taille connue → barre proportionnelle + pourcentage + temps restant ;
 *   - taille inconnue (Sonarr cherche encore) → barre indéterminée. Afficher
 *     « 0 % » serait faux : rien n'a échoué, la recherche est en cours.
 */

interface Props {
  download: DownloadProgress;
  downloads?: DownloadProgress[];
  receivedAt: string | null;
  /** Saisons demandées : celles qui n'ont pas commencé méritent d'être vues. */
  requestedSeasons?: readonly number[] | null;
}

export const RequestProgressBar = memo(function RequestProgressBar({
  download, downloads, receivedAt, requestedSeasons,
}: Props) {
  const { t } = useTranslation("seer");
  const { percent, etaSeconds } = useInterpolatedProgress(download, receivedAt);

  const paused = download.status === "paused" || download.status === "delay";
  /* Le fichier est là, il reste à le vérifier et à le ranger : ce n'est plus
   * un téléchargement, et laisser « ≈ 0 s restantes » tourner indéfiniment
   * était le symptôme le plus visible de la confusion. */
  const validating = download.validating === true;
  const fill = paused ? STATUS_STYLE.retry_pending.solid : STATUS_STYLE.downloading.solid;

  const sizeLabel = download.size
    ? `${formatBytes(download.size - (download.sizeLeft ?? 0))} / ${formatBytes(download.size)}`
    : "";
  const etaLabel = formatEta(etaSeconds);

  const parts: string[] = [];
  if (validating) {
    parts.push(t("seer:progressValidating"));
  } else {
    if (sizeLabel) parts.push(sizeLabel);
    if (etaLabel && !paused) parts.push(t("seer:progressRemaining", { eta: etaLabel }));
    if (paused) parts.push(t("seer:progressPaused"));
  }

  /* Une seule saison sans détail n'a rien à déplier : le compteur suffit.
   * Dès qu'il y a plusieurs épisodes, la liste par saison le remplace. */
  const episodes = downloads?.length ?? 0;
  const bySeason = episodes > 1 || (requestedSeasons?.length ?? 0) > 1;
  if (episodes > 1 && !bySeason) parts.push(t("seer:progressEpisodes", { count: episodes }));

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-tentacle-text-tertiary">
        <span className="truncate">{parts.join(" · ")}</span>
        {percent != null && !validating && (
          <span className="shrink-0 font-semibold tabular-nums text-tentacle-text-secondary">
            {Math.floor(percent)} %
          </span>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={validating ? 100 : percent != null ? Math.floor(percent) : undefined}
        aria-label={parts.join(" · ") || undefined}
        className="h-1.5 w-full overflow-hidden rounded-full bg-tentacle-surface-2"
      >
        {validating ? (
          <div className={`h-full w-full rounded-full ${STATUS_STYLE.processing.solid}`} />
        ) : percent != null ? (
          // Seule `transform` est animée : une largeur animée repeindrait la
          // carte à chaque image (règle GPU du projet).
          <div
            className={`h-full origin-left rounded-full ${fill}`}
            style={{
              transform: `scaleX(${Math.max(0.005, percent / 100)})`,
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

      {percent == null && !validating && (
        <p className="mt-1 text-[10px] text-tentacle-text-quaternary">{t("seer:progressSearching")}</p>
      )}

      {bySeason && (
        <SeasonProgressList downloads={downloads ?? []} requestedSeasons={requestedSeasons} />
      )}
    </div>
  );
});
