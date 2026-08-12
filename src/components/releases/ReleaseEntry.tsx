import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "../../api/types-releases";
import type { CollapsedItem } from "../../utils/calendar-collapse";
import { posterUrl } from "../../utils/media-helpers";
import { KIND_STYLE, KIND_I18N, episodeLabel } from "../../utils/calendar-kind";
import { PlatformBadges } from "../PlatformBadges";
import { PosterImage } from "../PosterImage";

/**
 * Une sortie dans l'agenda. Affiche + titre + épisode + plateformes, LISIBLES
 * sans survol — c'est tout l'objet de l'exercice : la version précédente ne
 * montrait qu'une pastille de couleur, on voyait qu'il se passait quelque chose
 * sans savoir quoi.
 *
 * Deux densités : `week` (colonne de semaine, l'affiche a de la place) et
 * `month` (case de grille mensuelle, ~90 px de large — texte seul, pastille de
 * couleur en tête de ligne pour distinguer un épisode d'une sortie salle).
 */

interface Props {
  item: CollapsedItem;
  density?: "week" | "month";
  onOpen?: (item: CalendarItem) => void;
}

export const ReleaseEntry = memo(function ReleaseEntry({ item, density = "week", onOpen }: Props) {
  const { t } = useTranslation("seer");
  const kind = KIND_STYLE[item.kind];
  // Une saison lâchée d'un coup s'affiche « S5E1–E8 », pas dix fois le titre.
  const ep = item.rangeLabel ?? episodeLabel(item.seasonNumber, item.episodeNumber);
  const label = `${item.title}${ep ? ` ${ep}` : ""} — ${t(KIND_I18N[item.kind])}`;

  if (density === "month") {
    return (
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        title={label}
        aria-label={label}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-tentacle-fill-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
      >
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${kind.dot}`} />
        <span className="truncate text-[10px] leading-tight text-tentacle-text-secondary">
          {item.title}
        </span>
      </button>
    );
  }

  const poster = posterUrl(item.posterPath);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      aria-label={label}
      className="group flex w-full gap-2 rounded-lg bg-tentacle-fill-subtle p-1.5 text-left ring-1 ring-tentacle-border-subtle transition-colors duration-150 hover:bg-tentacle-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
    >
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-tentacle-surface-2">
        {poster && <PosterImage src={poster} width={40} height={56} />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-tentacle-text-primary">
          {item.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className={`rounded px-1 py-px text-[9px] font-medium ${kind.chip}`}>
            {ep || t(KIND_I18N[item.kind])}
          </span>
          <PlatformBadges providerIds={item.providerIds} max={2} size="sm" />
        </div>
      </div>
    </button>
  );
});
