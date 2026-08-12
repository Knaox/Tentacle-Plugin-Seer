import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSeason } from "../api/types";
import { ProfileSelector } from "./ProfileSelector";
import { SeasonRow } from "./SeasonRow";
import { CTA_PRIMARY, CTA_PRIMARY_HALO } from "../styles/cta";

interface SeriesSeasonPickerProps {
  tvId: number;
  seasons: SeerrSeason[];
  requestedSeasons?: Map<number, number>;
  onRequest: (selectedSeasons: number[], profileId?: string | null) => void;
  requesting?: boolean;
  isAnime?: boolean;
  /** Saisons déjà demandées dans Tentacle — pré-cochées et verrouillées */
  lockedSeasons?: number[];
  /** Profil par défaut pré-sélectionné */
  defaultProfileId?: string | null;
}

/**
 * Sélecteur de saisons (mode demande) : rangées accordéon avec checkbox,
 * statut, et épisodes + dates de diffusion dépliables.
 */
export function SeriesSeasonPicker({
  tvId, seasons, requestedSeasons, onRequest, requesting, isAnime,
  lockedSeasons, defaultProfileId,
}: SeriesSeasonPickerProps) {
  const { t } = useTranslation("seer");
  const lockedSet = new Set(lockedSeasons ?? []);
  const [selected, setSelected] = useState<Set<number>>(new Set(lockedSeasons ?? []));
  const [profileId, setProfileId] = useState<string | null>(defaultProfileId ?? null);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);

  const displaySeasons = seasons.filter((s) => s.seasonNumber > 0);

  const isRequested = (sn: number) => {
    const status = requestedSeasons?.get(sn);
    return status !== undefined && status >= 2;
  };
  const isLocked = (sn: number) => lockedSet.has(sn);

  // Saisons sélectionnables = ni demandées via Seerr, ni verrouillées
  const selectableSeasons = displaySeasons.filter(
    (s) => !isRequested(s.seasonNumber) && !isLocked(s.seasonNumber),
  );

  const toggle = (seasonNumber: number) => {
    if (isRequested(seasonNumber) || isLocked(seasonNumber)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seasonNumber)) next.delete(seasonNumber); else next.add(seasonNumber);
      return next;
    });
  };

  // Nombre de nouvelles saisons sélectionnées (sans les verrouillées)
  const newSelectedCount = Array.from(selected).filter((s) => !lockedSet.has(s)).length;
  const hasNewSelection = newSelectedCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">{t("seer:seasonsTitle")}</h4>
        {selectableSeasons.length > 0 && (
          <div className="flex gap-1">
            <button
              onClick={() => {
                const all = new Set(lockedSeasons ?? []);
                selectableSeasons.forEach((s) => all.add(s.seasonNumber));
                setSelected(all);
              }}
              className="min-h-[32px] rounded-md px-2 text-[11px] font-medium text-tentacle-brand-light transition-colors hover:bg-tentacle-fill-soft"
            >
              {t("seer:selectAll")}
            </button>
            <button
              onClick={() => setSelected(new Set(lockedSeasons ?? []))}
              className="min-h-[32px] rounded-md px-2 text-[11px] font-medium text-tentacle-text-tertiary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-secondary"
            >
              {t("seer:selectNone")}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {displaySeasons.map((season) => (
          <SeasonRow
            key={season.seasonNumber}
            tvId={tvId}
            season={season}
            status={requestedSeasons?.get(season.seasonNumber)}
            locked={isLocked(season.seasonNumber)}
            selectable
            checked={selected.has(season.seasonNumber)}
            onToggle={() => toggle(season.seasonNumber)}
            expanded={expandedSeason === season.seasonNumber}
            onExpandToggle={() =>
              setExpandedSeason((cur) => (cur === season.seasonNumber ? null : season.seasonNumber))
            }
          />
        ))}
      </div>

      {/* Profil de qualité */}
      {selectableSeasons.length > 0 && (
        <ProfileSelector mediaType="tv" isAnime={isAnime} selectedId={profileId} onChange={setProfileId} />
      )}

      {selectableSeasons.length > 0 ? (
        <button
          onClick={() =>
            onRequest(
              // Ne demander QUE les nouvelles saisons : les verrouillées (déjà
              // demandées) sont pré-cochées pour l'affichage mais exclues du payload.
              Array.from(selected).filter((s) => !lockedSet.has(s)).sort((a, b) => a - b),
              profileId,
            )
          }
          disabled={!hasNewSelection || requesting}
          style={CTA_PRIMARY_HALO}
          className={`${CTA_PRIMARY} min-h-[48px] w-full py-3 focus:outline-none focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.5)]`}
        >
          {requesting ? t("seer:sending")
            : !hasNewSelection ? t("seer:selectSeasonsPrompt")
              : t("seer:requestSeasons", { count: newSelectedCount })}
        </button>
      ) : (
        <div className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600/15 text-sm font-semibold text-emerald-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {t("seer:allSeasonsRequested")}
        </div>
      )}
    </div>
  );
}
