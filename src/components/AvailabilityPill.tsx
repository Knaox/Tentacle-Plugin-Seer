import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { AvailabilityVerdict } from "../api/types-releases";
import { formatAirDateShort, parseAirDate } from "../utils/episode-dates";
import { STATUS_STYLE } from "../styles/status";

/**
 * Ce qui EMPÊCHE de récupérer un titre — jamais l'inverse.
 *
 * On ne rend rien quand le titre est récupérable : le mot « Disponible »
 * appartient aux demandes (« c'est dans ta bibliothèque »), et le réemployer
 * ici serait trompeur. Un titre sans obstacle affiche donc simplement son
 * année, comme avant — ce qui évite aussi de bruiter tout le catalogue ancien.
 */

interface Props {
  verdict: AvailabilityVerdict | null | undefined;
  /** `card` : compact sous le titre. `detail` : phrase complète. */
  variant?: "card" | "detail";
}

/** « 3 sept. » — l'année n'est utile que si la sortie déborde sur l'an prochain. */
function shortDate(date: string): string {
  const parsed = parseAirDate(date);
  if (!parsed) return date;
  const full = formatAirDateShort(date);
  return parsed.getFullYear() === new Date().getFullYear()
    ? full.replace(/\s*\d{4}$/, "").replace(/,\s*$/, "")
    : full;
}

export const AvailabilityPill = memo(function AvailabilityPill({ verdict, variant = "card" }: Props) {
  const { t } = useTranslation("seer");
  if (!verdict || verdict.kind === "released") return null;

  const date = verdict.date ? shortDate(verdict.date) : "";

  const config: Record<string, { label: string; style: string }> = {
    digital_soon: { label: t("seer:availOnlineOn", { date }), style: STATUS_STYLE.downloading.chip },
    theatrical: { label: t("seer:availInTheaters"), style: STATUS_STYLE.retry_pending.chip },
    upcoming: { label: t("seer:availReleaseOn", { date }), style: STATUS_STYLE.queued.chip },
    not_aired: { label: t("seer:availAirsOn", { date }), style: STATUS_STYLE.queued.chip },
  };

  const c = config[verdict.kind];
  if (!c) return null;

  if (variant === "detail") {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${c.style}`}>
        <Dot />
        {detailLabel(verdict, t, date)}
      </span>
    );
  }

  return (
    <span
      className={`mt-0.5 inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${c.style}`}
      title={detailLabel(verdict, t, date)}
    >
      <Dot />
      <span className="truncate">{c.label}</span>
    </span>
  );
});

function Dot() {
  return <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />;
}

/** Phrase complète : c'est elle qui explique pourquoi une demande attendra. */
function detailLabel(
  verdict: AvailabilityVerdict,
  t: (k: string, o?: Record<string, unknown>) => string,
  date: string,
): string {
  switch (verdict.kind) {
    case "digital_soon":
      return t("seer:availOnlineOnLong", { date });
    case "theatrical":
      return t("seer:availInTheatersLong", {
        date: verdict.theatricalDate ? shortDate(verdict.theatricalDate) : date,
      });
    case "upcoming":
      return t("seer:availReleaseOnLong", { date });
    case "not_aired":
      return date ? t("seer:availAirsOnLong", { date }) : t("seer:availNotAiredYet");
    default:
      return "";
  }
}
