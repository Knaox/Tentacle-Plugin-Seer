import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "../../api/types-releases";
import { posterUrl } from "../../utils/media-helpers";
import { KIND_STYLE, KIND_I18N, episodeLabel } from "../../utils/calendar-kind";
import { STATUS_STYLE } from "../../styles/status";

interface Props {
  item: CalendarItem;
  onOpen?: (item: CalendarItem) => void;
}

/** Une sortie : affiche, titre, type, et le contexte utile (épisode, chaîne). */
export const ReleaseRow = memo(function ReleaseRow({ item, onOpen }: Props) {
  const { t } = useTranslation("seer");
  const [loaded, setLoaded] = useState(false);
  const poster = posterUrl(item.posterPath);
  const kind = KIND_STYLE[item.kind];
  const ep = episodeLabel(item.seasonNumber, item.episodeNumber);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      className="flex w-full items-center gap-3 rounded-xl bg-tentacle-fill-subtle p-2 text-left transition-colors hover:bg-tentacle-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tentacle-brand-soft"
    >
      <div className="h-[72px] w-12 shrink-0 overflow-hidden rounded-lg bg-tentacle-surface-2">
        {poster && (
          <img
            src={poster}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            style={{ opacity: loaded ? 1 : 0, transition: "opacity 250ms ease" }}
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-tentacle-text-primary">{item.title}</p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${kind.chip}`}>
            {t(KIND_I18N[item.kind])}
          </span>
          {ep && (
            <span className="rounded bg-tentacle-fill-soft px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-tentacle-text-secondary">
              {ep}
            </span>
          )}
          {item.requestStatus && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE.approved.chip}`}>
              {t("seer:releasesRequested")}
            </span>
          )}
        </div>

        {item.networks && (
          <p className="mt-1 truncate text-[11px] text-tentacle-text-quaternary">{item.networks}</p>
        )}
      </div>
    </button>
  );
});
