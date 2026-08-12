import { useTranslation } from "react-i18next";
import type { QueueEntry } from "../api/types-releases";
import { useServerDownloads } from "../hooks/useServerDownloads";
import { formatBytes, formatEta } from "../utils/format-bytes";
import { episodeLabel } from "../utils/calendar-kind";
import { STATUS_STYLE } from "../styles/status";
import { EmptyState } from "./EmptyState";
import { SkeletonList } from "./SkeletonList";

/**
 * Ce que le serveur récupère en ce moment — la file de Sonarr et de Radarr.
 *
 * Contrairement à la progression d'une demande, cette vue ne se limite pas à
 * ce qui est passé par le plugin : elle montre aussi les ajouts directs et les
 * demandes des autres. C'est pourquoi elle est réservée aux administrateurs, et
 * pourquoi le sous-titre le dit franchement.
 */
export function DownloadsPanel({ active }: { active: boolean }) {
  const { t } = useTranslation("seer");
  const { data, isLoading } = useServerDownloads(active);

  if (isLoading && !data) return <SkeletonList count={4} />;

  const items = data?.items ?? [];
  const unreachable = data?.unreachable ?? [];

  return (
    <div>
      <p className="mb-3 text-xs text-tentacle-text-tertiary">{t("seer:downloadsSubtitle")}</p>

      {unreachable.length > 0 && (
        <p className={`mb-3 rounded-lg px-3 py-2 text-xs ${STATUS_STYLE.failed.chip}`}>
          {t("seer:downloadsUnreachable", { service: unreachable.join(", ") })}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState title={t("seer:downloadsEmpty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((entry) => <DownloadRow key={entry.id} entry={entry} />)}
        </ul>
      )}
    </div>
  );
}

function DownloadRow({ entry }: { entry: QueueEntry }) {
  const { t } = useTranslation("seer");

  const code = episodeLabel(entry.seasonNumber, entry.episodeNumber);
  const fill = entry.validating
    ? STATUS_STYLE.processing.solid
    : entry.paused
      ? STATUS_STYLE.retry_pending.solid
      : STATUS_STYLE.downloading.solid;

  const parts: string[] = [];
  if (entry.validating) parts.push(t("seer:progressValidating"));
  else {
    if (entry.size) parts.push(formatBytes(entry.size));
    const eta = formatEta(entry.etaSeconds);
    if (eta && !entry.paused) parts.push(t("seer:progressRemaining", { eta }));
    if (entry.paused) parts.push(t("seer:progressPaused"));
  }
  if (entry.warning) parts.push(entry.warning);

  return (
    <li className="rounded-lg bg-tentacle-fill-subtle p-3 ring-1 ring-tentacle-border-subtle">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-tentacle-text-primary">{entry.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-tentacle-text-quaternary">
            {[code, entry.episodeTitle].filter(Boolean).join(" · ") || t(`seer:type${entry.mediaType === "movie" ? "Movie" : "Series"}`)}
          </p>
        </div>
        {entry.percent != null && !entry.validating && (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-tentacle-text-secondary">
            {Math.floor(entry.percent)} %
          </span>
        )}
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-tentacle-surface-2">
        {entry.validating || entry.percent != null ? (
          // Seule `transform` est animée (règle GPU du projet).
          <div
            className={`h-full origin-left rounded-full ${fill}`}
            style={{
              transform: `scaleX(${entry.validating ? 1 : Math.max(0.005, (entry.percent ?? 0) / 100)})`,
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

      {parts.length > 0 && (
        <p className="mt-1 truncate text-[10px] text-tentacle-text-tertiary">{parts.join(" · ")}</p>
      )}
    </li>
  );
}
