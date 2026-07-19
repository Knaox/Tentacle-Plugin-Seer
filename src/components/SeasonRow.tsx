import { useTranslation } from "react-i18next";
import { STATUS_STYLE } from "../styles/status";
import type { SeerrSeason } from "../api/types";
import { EpisodeList } from "./EpisodeList";

interface SeasonRowProps {
  tvId: number;
  season: SeerrSeason;
  /** Statut Seerr de la saison (2 en attente, 3 en acquisition, 4 partiel, 5 dispo) — undefined si jamais demandée. */
  status?: number;
  /** Déjà demandée côté Tentacle (verrouillée). */
  locked?: boolean;
  /** Affiche la checkbox de sélection (mode demande). */
  selectable?: boolean;
  checked?: boolean;
  onToggle?: () => void;
  expanded: boolean;
  onExpandToggle: () => void;
}

function statusBadge(status: number | undefined, locked: boolean | undefined, t: (k: string) => string) {
  if (status === 5) return { label: t("seer:seasonAvailable"), cls: STATUS_STYLE.available.chip };
  if (status === 4) return { label: t("seer:seasonPartial"), cls: STATUS_STYLE.partially_available.chip };
  // 2 (en attente) et 3 (en acquisition) : Jellyseerr affiche « Demandé »
  // dans les deux cas — pas de « Téléchargement » sans download réellement actif.
  if ((status !== undefined && status >= 2) || locked) return { label: t("seer:seasonRequested"), cls: STATUS_STYLE.requested.chip };
  return null;
}

/**
 * Rangée saison accordéon : sélection (mode demande), badge de statut,
 * chevron pour déplier les épisodes avec leurs dates de diffusion.
 */
export function SeasonRow({
  tvId, season, status, locked, selectable, checked, onToggle, expanded, onExpandToggle,
}: SeasonRowProps) {
  const { t } = useTranslation("seer");
  const badge = statusBadge(status, locked, t);
  const canCheck = selectable && !locked && (status === undefined || status < 2);
  const isChecked = !!checked || !!locked || (status !== undefined && status >= 2);

  return (
    <div className={`overflow-hidden rounded-xl border transition-colors ${
      expanded ? "border-tentacle-border-strong bg-tentacle-fill-subtle" : "border-tentacle-border-subtle bg-tentacle-fill-subtle"
    }`}>
      <div className="flex min-h-[52px] items-center gap-3 pr-2">
        {/* Zone checkbox + libellé : toggle la sélection (ou déplie si non sélectionnable) */}
        <button
          type="button"
          onClick={canCheck ? onToggle : onExpandToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-tentacle-brand-soft"
          aria-pressed={selectable ? isChecked : undefined}
        >
          {selectable && (
            <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
              isChecked
                ? canCheck ? "border-tentacle-brand bg-tentacle-brand" : "border-tentacle-border-strong bg-tentacle-fill-medium"
                : "border-tentacle-border-strong bg-transparent"
            }`}>
              {isChecked && (
                <svg className={`h-3 w-3 ${canCheck ? "text-tentacle-cta-brand-fg" : "text-tentacle-text-primary"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-tentacle-text-primary">
              {season.name || t("seer:seasonFallback", { number: season.seasonNumber })}
            </span>
            <span className="block text-[11px] text-tentacle-text-tertiary">
              {t("seer:episodeCount", { count: season.episodeCount })}
              {season.airDate && <> · {season.airDate.slice(0, 4)}</>}
            </span>
          </span>
        </button>

        {badge && (
          <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${badge.cls}`}>
            {badge.label}
          </span>
        )}

        {/* Chevron — déplie les épisodes + dates */}
        <button
          type="button"
          onClick={onExpandToggle}
          aria-expanded={expanded}
          aria-label={t("seer:episodesTitle")}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-tentacle-text-tertiary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-tentacle-brand/50"
        >
          <svg
            className="h-4 w-4 transition-transform duration-200"
            style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-tentacle-border-subtle px-4 pb-2" style={{ animation: "fadeIn 200ms ease" }}>
          <EpisodeList tvId={tvId} seasonNumber={season.seasonNumber} />
        </div>
      )}
    </div>
  );
}
