import { useTranslation } from "react-i18next";
import { useStats } from "../hooks/useStats";

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-yellow-500",
  processing: "bg-blue-500",
  sent_to_seer: "bg-blue-500",
  approved: "bg-purple-500",
  downloading: "bg-orange-500",
  available: "bg-emerald-500",
  retry_pending: "bg-yellow-500",
  failed: "bg-red-500",
};

export function StatsPage() {
  const { t } = useTranslation("seer");
  const { data, isLoading } = useStats();

  if (isLoading) {
    return (
      <div className="px-4 pt-4 md:px-12">
        <h1 className="mb-6 text-2xl font-bold text-white">{t("seer:statsTitle")}</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-white/5 p-4">
              <div className="h-8 w-16 rounded bg-white/10" />
              <div className="mt-2 h-3 w-20 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { personal, global } = data;
  const stats = global || personal;

  return (
    <div className="px-4 pt-4 md:px-12">
      <h1 className="mb-6 text-2xl font-bold text-white">{t("seer:statsTitle")}</h1>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          value={stats.totalRequests}
          label={t("seer:statsTotalRequests")}
          color="text-white"
        />
        <StatCard
          value={stats.byStatus?.available || 0}
          label={t("seer:statsAvailable")}
          color="text-emerald-400"
        />
        <StatCard
          value={(stats.byStatus?.queued || 0) + (stats.byStatus?.processing || 0) + (stats.byStatus?.sent_to_seer || 0)}
          label={t("seer:statsPending")}
          color="text-yellow-400"
        />
        <StatCard
          value={stats.byStatus?.failed || 0}
          label={t("seer:statsFailed")}
          color="text-red-400"
        />
      </div>

      {/* Status distribution */}
      {stats.totalRequests > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-white/60">{t("seer:statsByStatus")}</h2>
          <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
            {Object.entries(stats.byStatus).map(([status, count]) => {
              const pct = (count / stats.totalRequests) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={status}
                  className={`${STATUS_COLORS[status] || "bg-white/20"} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${t(`seer:status_${status}` as any, status)}: ${count}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-white/50">
                <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] || "bg-white/20"}`} />
                {t(`seer:status_${status}` as any, status)}: {count}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By type */}
      {stats.totalRequests > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-white/60">{t("seer:statsByType")}</h2>
          <div className="flex gap-4">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">{count}</span>
                <span className="text-sm text-white/40">
                  {type === "movie" ? t("seer:typeMovie") : t("seer:typeSeries")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin: top requested + top users */}
      {global && (
        <>
          {global.successRate > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-sm font-semibold text-white/60">{t("seer:statsSuccessRate")}</h2>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-emerald-400">{global.successRate}%</span>
                <span className="text-sm text-white/40">{t("seer:statsSuccessRateDesc")}</span>
              </div>
            </div>
          )}

          {global.topRequested.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-sm font-semibold text-white/60">{t("seer:statsTopRequested")}</h2>
              <div className="space-y-2">
                {global.topRequested.slice(0, 5).map((item, i) => (
                  <div key={item.tmdbId} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                    <span className="text-xs font-bold text-white/30">#{i + 1}</span>
                    <span className="flex-1 truncate text-sm text-white">{item.title}</span>
                    <span className="text-xs text-white/40">{item.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {global.topUsers.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-sm font-semibold text-white/60">{t("seer:statsTopUsers")}</h2>
              <div className="space-y-2">
                {global.topUsers.slice(0, 5).map((user, i) => (
                  <div key={user.username} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                    <span className="text-xs font-bold text-white/30">#{i + 1}</span>
                    <span className="flex-1 text-sm text-white">{user.username}</span>
                    <span className="text-xs text-white/40">{user.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-4">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-white/40">{label}</p>
    </div>
  );
}
