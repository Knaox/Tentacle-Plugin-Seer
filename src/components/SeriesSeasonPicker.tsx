import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSeason } from "../api/types";

interface SeriesSeasonPickerProps {
  seasons: SeerrSeason[];
  requestedSeasons?: Map<number, number>; // seasonNumber -> status (from Seerr mediaInfo)
  onRequest: (selectedSeasons: number[]) => void;
  requesting?: boolean;
}

// Seerr/Overseerr season status: 2=Pending, 3=Processing, 4=PartiallyAvailable, 5=Available
function seasonStatusLabel(status: number, t: (k: string) => string): string {
  if (status === 5) return t("seer:seasonAvailable");
  if (status === 4) return t("seer:seasonPartial");
  if (status === 3) return t("seer:seasonDownloading");
  return t("seer:seasonRequested");
}

export function SeriesSeasonPicker({ seasons, requestedSeasons, onRequest, requesting }: SeriesSeasonPickerProps) {
  const { t } = useTranslation("seer");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Filter out season 0 (specials)
  const displaySeasons = seasons.filter((s) => s.seasonNumber > 0);

  const isRequested = (sn: number) => {
    const status = requestedSeasons?.get(sn);
    return status !== undefined && status >= 2;
  };

  const isAvailable = (sn: number) => requestedSeasons?.get(sn) === 5;

  const selectableSeasons = displaySeasons.filter((s) => !isRequested(s.seasonNumber));

  const toggle = (seasonNumber: number) => {
    if (isRequested(seasonNumber)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seasonNumber)) next.delete(seasonNumber);
      else next.add(seasonNumber);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(selectableSeasons.map((s) => s.seasonNumber)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{t("seer:seasonsTitle")}</h4>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-[10px] font-medium text-purple-400 hover:text-purple-300"
          >
            {t("seer:selectAll")}
          </button>
          <button
            onClick={deselectAll}
            className="text-[10px] font-medium text-white/40 hover:text-white/60"
          >
            {t("seer:selectNone")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {displaySeasons.map((season) => {
          const requested = isRequested(season.seasonNumber);
          const available = isAvailable(season.seasonNumber);
          const checked = selected.has(season.seasonNumber);
          const status = requestedSeasons?.get(season.seasonNumber);

          return (
            <button
              key={season.seasonNumber}
              onClick={() => toggle(season.seasonNumber)}
              disabled={requested}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                requested
                  ? available
                    ? "border-emerald-500/30 bg-emerald-600/10 text-emerald-300 cursor-default"
                    : "border-amber-500/30 bg-amber-600/10 text-amber-300 cursor-default"
                  : checked
                    ? "border-purple-500 bg-purple-600/20 text-white"
                    : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <div
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                  requested
                    ? available
                      ? "border-emerald-500 bg-emerald-600"
                      : "border-amber-500 bg-amber-600"
                    : checked
                      ? "border-purple-500 bg-purple-600"
                      : "border-white/20"
                }`}
              >
                {(requested || checked) && (
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{season.name || t("seer:seasonFallback", { number: season.seasonNumber })}</p>
                <p className={`text-[10px] ${requested ? (available ? "text-emerald-400/60" : "text-amber-400/60") : "text-white/30"}`}>
                  {requested
                    ? seasonStatusLabel(status!, t)
                    : t("seer:episodeCount", { count: season.episodeCount })}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selectableSeasons.length > 0 ? (
        <button
          onClick={() => onRequest(Array.from(selected).sort((a, b) => a - b))}
          disabled={selected.size === 0 || requesting}
          className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {requesting
            ? t("seer:sending")
            : t("seer:requestSeasons", { count: selected.size })}
        </button>
      ) : (
        <div className="w-full rounded-lg bg-emerald-600/20 py-2.5 text-center text-sm font-semibold text-emerald-400">
          {t("seer:allSeasonsRequested")}
        </div>
      )}
    </div>
  );
}
