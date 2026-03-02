import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMyRequests, useDeleteRequest, useRetryRequest, useQueueStatus } from "../hooks/useRequests";
import { useToast } from "../hooks/useToast";
import { RequestCard } from "./RequestCard";
import { EmptyState } from "./EmptyState";

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
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv">("all");

  const backendStatus = statusFilter === "all" ? undefined : statusFilter;
  const backendType = typeFilter === "all" ? undefined : typeFilter;
  const { data, isLoading } = useMyRequests(page, 20, backendStatus, backendType);
  const deleteMutation = useDeleteRequest();
  const retryMutation = useRetryRequest();
  const { data: queueData } = useQueueStatus();

  const requests = data?.results ?? [];
  const totalPages = data?.pages ?? 1;

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.show("success", t("requestDeleted")),
      onError: () => toast.show("error", t("requestDeleteError")),
    });
  };

  const handleRetry = (id: string) => {
    retryMutation.mutate(id, {
      onSuccess: () => toast.show("success", t("requestRetried")),
      onError: () => toast.show("error", t("requestRetryError")),
    });
  };

  return (
    <div className="px-4 pt-4 md:px-8">
      <h1 className="mb-4 text-2xl font-bold text-white">{t("seer:myRequestsTitle")}</h1>

      {/* Queue status banner */}
      {queueData && (queueData.queued > 0 || queueData.processing) && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-3">
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

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
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
      <div className="mb-6 flex gap-2">
        {(["all", "movie", "tv"] as const).map((v) => (
          <button
            key={v}
            onClick={() => { setTypeFilter(v); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              typeFilter === v
                ? "bg-purple-600 text-white"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            {v === "all" ? t("filterAllType") : v === "movie" ? t("filterMovies") : t("filterSeries")}
          </button>
        ))}
      </div>

      {/* Request list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex animate-pulse gap-3 rounded-xl bg-white/5 p-3">
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
              onDelete={handleDelete}
              onRetry={handleRetry}
              deleting={deleteMutation.isPending}
              retrying={retryMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={statusFilter === "all" ? t("seer:noRequestsAll") : t("seer:noRequestsFiltered")}
          subtitle={statusFilter === "all" ? t("seer:noRequestsHint") : undefined}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 pb-8">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            {t("seer:previousPage")}
          </button>
          <span className="text-sm text-white/40">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            {t("seer:nextPage")}
          </button>
        </div>
      )}
    </div>
  );
}
