import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getRequestsStats } from "../api/seer-client";
import { STATUS_STYLE, statAccent } from "../styles/status";
import type { SeerStatusKey } from "../styles/status";

/* Couleurs de statut : dictionnaire unique thémé (styles/status.ts) — les
 * classes en dur (text-emerald-300…) manquaient de contraste en clair. */
function statusStyleOf(status: string) {
  return STATUS_STYLE[status as SeerStatusKey] as (typeof STATUS_STYLE)[SeerStatusKey] | undefined;
}

export function RequestsStatsBar() {
  const { t } = useTranslation("seer");
  const { data: stats, isLoading } = useQuery({
    queryKey: ["seer-stats-overview"],
    queryFn: () => getRequestsStats(),
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  if (isLoading) {
    return (
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-tentacle-fill-subtle" />
        ))}
      </div>
    );
  }
  if (!stats || stats.total === 0) return null;

  // « En attente » inclut les demandes « Demandée » (unavailable) — cohérent
  // avec l'onglet du même nom dans les filtres de la liste.
  const pending =
    (stats.byStatus.queued ?? 0) +
    (stats.byStatus.processing ?? 0) +
    (stats.byStatus.sent_to_seer ?? 0) +
    (stats.byStatus.approved ?? 0) +
    (stats.byStatus.unavailable ?? 0);
  const downloading = stats.byStatus.downloading ?? 0;
  const available = stats.byStatus.available ?? 0;
  const failed = (stats.byStatus.failed ?? 0) + (stats.byStatus.retry_pending ?? 0);
  const successRate = stats.total > 0 ? Math.round((available / stats.total) * 100) : 0;

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={t("seer:statsTotalRequests")}
          value={stats.total}
          accent={statAccent("total")}
          valueClass="text-tentacle-text-primary"
        />
        <StatCard
          label={t("seer:statsAvailable")}
          value={available}
          accent={statAccent("available")}
          valueClass={STATUS_STYLE.available.text}
        />
        <StatCard
          label={t("seer:statsPending")}
          value={pending + downloading}
          accent={statAccent("downloading")}
          valueClass={STATUS_STYLE.downloading.text}
        />
        <StatCard
          label={t("seer:statsFailed")}
          value={failed}
          accent={statAccent("failed")}
          valueClass={STATUS_STYLE.failed.text}
        />
      </div>

      <div className="rounded-2xl border border-tentacle-border-subtle bg-tentacle-fill-subtle p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">
            {t("seer:statsByStatus")}
          </h3>
          <div className="flex items-baseline gap-1.5 text-xs">
            <span className={`font-bold ${STATUS_STYLE.available.text}`}>{successRate}%</span>
            <span className="text-tentacle-text-quaternary">{t("seer:statsSuccessRateDesc")}</span>
          </div>
        </div>

        <div className="flex h-2.5 overflow-hidden rounded-full bg-tentacle-fill-subtle">
          {Object.entries(stats.byStatus).map(([status, count]) => {
            const pct = ((count ?? 0) / stats.total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={status}
                className={`${statusStyleOf(status)?.solid ?? "bg-tentacle-fill-strong"} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${t(`seer:status_${status}` as never, status)}: ${count}`}
              />
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {Object.entries(stats.byStatus)
            .filter(([, count]) => (count ?? 0) > 0)
            .map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 text-[11px]">
                <div className={`h-2 w-2 rounded-full ${statusStyleOf(status)?.solid ?? "bg-tentacle-fill-strong"}`} />
                <span className={`${statusStyleOf(status)?.text ?? "text-tentacle-text-secondary"} font-medium`}>{count}</span>
                <span className="text-tentacle-text-tertiary">{t(`seer:status_${status}` as never, status)}</span>
              </div>
            ))}
        </div>

        {(stats.byType.movie > 0 || stats.byType.tv > 0) && (
          <div className="mt-3 flex items-center gap-4 border-t border-tentacle-border-subtle pt-3 text-xs">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-tentacle-text-primary">{stats.byType.movie}</span>
              <span className="text-tentacle-text-tertiary">{t("seer:typeMovie")}</span>
            </div>
            <div className="h-3 w-px bg-tentacle-fill-soft" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-tentacle-text-primary">{stats.byType.tv}</span>
              <span className="text-tentacle-text-tertiary">{t("seer:typeSeries")}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label, value, accent, valueClass,
}: {
  label: string;
  value: number;
  accent: React.CSSProperties;
  valueClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-tentacle-border-subtle bg-tentacle-fill-subtle p-4">
      <div className="absolute inset-0 -z-10 opacity-90" style={accent} />
      <p className={`text-3xl font-bold leading-none ${valueClass}`}>{value}</p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-tentacle-text-tertiary">{label}</p>
    </div>
  );
}
