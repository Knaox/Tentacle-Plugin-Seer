import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSeason } from "../api/types";
import { ProfileSelector } from "./ProfileSelector";

interface SeriesSeasonPickerProps {
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

function seasonStatusLabel(status: number, t: (k: string) => string): string {
  if (status === 5) return t("seer:seasonAvailable");
  if (status === 4) return t("seer:seasonPartial");
  if (status === 3) return t("seer:seasonDownloading");
  return t("seer:seasonRequested");
}

export function SeriesSeasonPicker({
  seasons, requestedSeasons, onRequest, requesting, isAnime,
  lockedSeasons, defaultProfileId,
}: SeriesSeasonPickerProps) {
  const { t } = useTranslation("seer");
  const lockedSet = new Set(lockedSeasons ?? []);
  const [selected, setSelected] = useState<Set<number>>(new Set(lockedSeasons ?? []));
  const [profileId, setProfileId] = useState<string | null>(defaultProfileId ?? null);

  const displaySeasons = seasons.filter((s) => s.seasonNumber > 0);

  const isRequested = (sn: number) => {
    const status = requestedSeasons?.get(sn);
    return status !== undefined && status >= 2;
  };
  const isAvailable = (sn: number) => requestedSeasons?.get(sn) === 5;
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
        <h4 className="text-sm font-semibold text-white">{t("seer:seasonsTitle")}</h4>
        <div className="flex gap-2">
          <button onClick={() => {
            const all = new Set(lockedSeasons ?? []);
            selectableSeasons.forEach((s) => all.add(s.seasonNumber));
            setSelected(all);
          }} className="text-[10px] font-medium text-purple-400 hover:text-purple-300">
            {t("seer:selectAll")}
          </button>
          <button onClick={() => setSelected(new Set(lockedSeasons ?? []))}
            className="text-[10px] font-medium text-white/40 hover:text-white/60">
            {t("seer:selectNone")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {displaySeasons.map((season) => {
          const requested = isRequested(season.seasonNumber);
          const available = isAvailable(season.seasonNumber);
          const locked = isLocked(season.seasonNumber);
          const checked = selected.has(season.seasonNumber);
          const status = requestedSeasons?.get(season.seasonNumber);

          return (
            <button key={season.seasonNumber}
              onClick={() => toggle(season.seasonNumber)}
              disabled={requested || locked}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                requested
                  ? available ? "border-emerald-500/30 bg-emerald-600/10 text-emerald-300 cursor-default"
                    : "border-amber-500/30 bg-amber-600/10 text-amber-300 cursor-default"
                  : locked
                    ? "border-purple-500/30 bg-purple-600/10 text-purple-300 cursor-default"
                    : checked ? "border-purple-500 bg-purple-600/20 text-white"
                      : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/10"
              }`}>
              <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                requested ? (available ? "border-emerald-500 bg-emerald-600" : "border-amber-500 bg-amber-600")
                  : (locked || checked) ? "border-purple-500 bg-purple-600" : "border-white/20"
              }`}>
                {(requested || locked || checked) && (
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {season.name || t("seer:seasonFallback", { number: season.seasonNumber })}
                  {locked && <span className="ml-1 text-[9px] text-purple-400/50">({t("seer:seasonLocked")})</span>}
                </p>
                <p className={`text-[10px] ${
                  requested ? (available ? "text-emerald-400/60" : "text-amber-400/60")
                    : locked ? "text-purple-400/50"
                      : "text-white/30"
                }`}>
                  {requested ? seasonStatusLabel(status!, t)
                    : locked ? t("seer:seasonRequested")
                      : (
                        <>
                          {t("seer:episodeCount", { count: season.episodeCount })}
                          {season.airDate && <span className="ml-1">· {season.airDate.slice(0, 4)}</span>}
                        </>
                      )}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Profil de qualité */}
      {selectableSeasons.length > 0 && (
        <ProfileSelector mediaType="tv" isAnime={isAnime} selectedId={profileId} onChange={setProfileId} />
      )}

      {selectableSeasons.length > 0 ? (
        <button
          onClick={() => onRequest(Array.from(selected).sort((a, b) => a - b), profileId)}
          disabled={!hasNewSelection || requesting}
          className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {requesting ? t("seer:sending")
            : !hasNewSelection ? t("seer:selectSeasonsPrompt")
              : t("seer:requestSeasons", { count: newSelectedCount })}
        </button>
      ) : (
        <div className="w-full rounded-lg bg-emerald-600/20 py-2.5 text-center text-sm font-semibold text-emerald-400">
          {t("seer:allSeasonsRequested")}
        </div>
      )}
    </div>
  );
}
