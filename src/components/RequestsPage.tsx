import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMyRequests, useDeleteRequest, useRetryRequest, useQueueStatus } from "../hooks/useRequests";
import { RequestCard } from "./RequestCard";

type StatusFilter = "all" | "queued" | "sent_to_seer" | "approved" | "downloading" | "available" | "failed";

const STATUS_TABS: { value: StatusFilter; key: string }[] = [
  { value: "all", key: "seer:filterAll" },
  { value: "queued", key: "seer:filterQueued" },
  { value: "sent_to_seer", key: "seer:filterSent" },
  { value: "approved", key: "seer:filterApproved" },
  { value: "downloading", key: "seer:filterDownloading" },
  { value: "available", key: "seer:filterAvailable" },
  { value: "failed", key: "seer:filterFailed" },
];

export function RequestsPage() {
  const { t } = useTranslation("seer");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const backendStatus = statusFilter === "all" ? undefined : statusFilter;
  const { data, isLoading } = useMyRequests(page, 20, backendStatus);
  const deleteMutation = useDeleteRequest();
  const retryMutation = useRetryRequest();
  const { data: queueData } = useQueueStatus();

  const requests = data?.results ?? [];
  const totalPages = data?.pages ?? 1;

  // Count per status from requests data
  const statusCounts: Record<string, number> = {};
  if (data) {
    statusCounts.total = data.total;
  }

  return (
    <div className="px-4 pt-4 md:px-12">
      <h1 className="mb-4 text-2xl font-bold text-white">{t("seer:myRequestsTitle")}</h1>

      {/* Queue status banner */}
      {queueData && (queueData.queued > 0 || queueData.processing) && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-purple-500/10 border border-purple-500/20 px-4 py-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
          <div className="text-sm text-purple-300">
            {queueData.processing ? (
              <span>
                {t("seer:queueProcessing", { title: queueData.processing.title })}
                {queueData.queued > 0 && (
                  <span className="ml-2 text-purple-400/60">
                    {t("seer:queuePending", { count: queueData.queued })}
                  </span>
                )}
              </span>
            ) : (
              <span>{t("seer:queueWaiting", { count: queueData.queued })}</span>
            )}
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-purple-600 text-white"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>

      {/* Request list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 rounded-xl bg-white/5 p-3 animate-pulse">
              <div className="h-24 w-16 rounded-lg bg-white/10" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-1/3 rounded bg-white/10" />
                <div className="h-3 w-1/4 rounded bg-white/5" />
                <div className="h-1 w-full rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onDelete={(id) => deleteMutation.mutate(id)}
              onRetry={(id) => retryMutation.mutate(id)}
              deleting={deleteMutation.isPending}
              retrying={retryMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <svg className="mb-4 h-16 w-16 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <p className="text-sm text-white/30">
            {statusFilter === "all"
              ? t("seer:noRequestsAll")
              : t("seer:noRequestsFiltered")}
          </p>
          {statusFilter === "all" && (
            <p className="mt-1 text-xs text-white/20">{t("seer:noRequestsHint")}</p>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 pb-8">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 disabled:opacity-30"
          >
            {t("seer:previousPage")}
          </button>
          <span className="text-sm text-white/40">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 disabled:opacity-30"
          >
            {t("seer:nextPage")}
          </button>
        </div>
      )}
    </div>
  );
}
