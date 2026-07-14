import { useTranslation } from "react-i18next";
import type { SeerrMovieDetail, SeerrTvDetail } from "../api/types";

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

interface DetailMetaGridProps {
  detail: SeerrMovieDetail | SeerrTvDetail | undefined;
  mediaType: "movie" | "tv";
}

/**
 * Fiche technique compacte : réalisateur/créateur, statut de production,
 * langue, chaîne, budget/recettes + studios. Placée en bas du modal.
 */
export function DetailMetaGrid({ detail, mediaType }: DetailMetaGridProps) {
  const { t } = useTranslation("seer");
  if (!detail) return null;

  const tvDetail = detail as SeerrTvDetail;
  const movieDetail = detail as SeerrMovieDetail;
  const director = mediaType === "movie"
    ? movieDetail.credits?.crew?.find((c) => c.job === "Director") : null;
  const creators = mediaType === "tv" ? tvDetail.createdBy : null;
  const networks = mediaType === "tv" ? tvDetail.networks : null;
  const budget = mediaType === "movie" ? movieDetail.budget : undefined;
  const revenue = mediaType === "movie" ? movieDetail.revenue : undefined;
  const companies = detail.productionCompanies;

  const rows: { label: string; value: string }[] = [];
  if (director) rows.push({ label: t("seer:detailDirector"), value: director.name });
  if (creators?.length) rows.push({ label: t("seer:detailCreator"), value: creators.map((c) => c.name).join(", ") });
  if (detail.status) rows.push({ label: t("seer:detailStatus"), value: translateTvStatus(detail.status, t) });
  if (detail.originalLanguage) rows.push({ label: t("seer:detailLanguage"), value: detail.originalLanguage.toUpperCase() });
  if (networks?.length) rows.push({ label: t("seer:detailNetwork"), value: networks.map((n) => n.name).join(", ") });
  if (budget) rows.push({ label: t("seer:detailBudget"), value: formatCurrency(budget) });
  if (revenue) rows.push({ label: t("seer:detailRevenue"), value: formatCurrency(revenue) });

  if (rows.length === 0 && !companies?.length) return null;

  return (
    <div className="rounded-xl border border-tentacle-border-subtle bg-tentacle-fill-subtle p-4">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline gap-2">
            <dt className="flex-shrink-0 text-tentacle-text-quaternary">{r.label}</dt>
            <dd className="min-w-0 truncate text-tentacle-text-secondary">{r.value}</dd>
          </div>
        ))}
      </dl>
      {companies && companies.length > 0 && (
        <div className={rows.length > 0 ? "mt-3 border-t border-tentacle-border-subtle pt-3" : ""}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-tentacle-text-quaternary">{t("seer:detailStudios")}</p>
          <div className="flex flex-wrap gap-1.5">
            {companies.map((co) => (
              <span key={co.id} className="rounded-md bg-tentacle-fill-soft px-2 py-1 text-[11px] text-tentacle-text-tertiary">{co.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Statuts de production TMDB → libellés i18n (repli : valeur brute). */
function translateTvStatus(status: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    "Returning Series": "seer:tvStatusReturning",
    "Planned": "seer:tvStatusPlanned",
    "In Production": "seer:tvStatusInProduction",
    "Ended": "seer:tvStatusEnded",
    "Canceled": "seer:tvStatusCancelled",
    "Cancelled": "seer:tvStatusCancelled",
    "Pilot": "seer:tvStatusPilot",
    "Released": "seer:prodStatusReleased",
    "Post Production": "seer:prodStatusPost",
  };
  const key = map[status];
  return key ? t(key) : status;
}
