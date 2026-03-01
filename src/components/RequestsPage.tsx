import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMyRequests, useDeleteRequest } from "../hooks/useRequests";
import { RequestCard } from "./RequestCard";

type StatusFilter = "all" | "pending" | "approved" | "declined" | "available";

export function RequestsPage() {
  const { t } = useTranslation("seer");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { data, isLoading } = useMyRequests(page, 20);
  const deleteMutation = useDeleteRequest();

  const STATUS_TABS: { value: StatusFilter; key: string }[] = [
    { value: "all", key: "seer:filterAll" },
    { value: "pending", key: "seer:filterQueued" },
    { value: "approved", key: "seer:filterApproved" },
    { value: "available", key: "seer:filterAvailable" },
    { value: "declined", key: "seer:filterFailed" },
  ];

  const requests = data?.results ?? [];
  const filtered = statusFilter === "all"
    ? requests
    : statusFilter === "available"
      ? requests.filter((r) => r.media.status === 5)
      : statusFilter === "pending"
        ? requests.filter((r) => r.status === 1)
        : statusFilter === "approved"
          ? requests.filter((r) => r.status === 2)
          : requests.filter((r) => r.status === 3);

  const totalPages = data?.pageInfo?.pages ?? 1;

  return (
    <div className="px-4 pt-4 md:px-12">
      <h1 className="mb-6 text-2xl font-bold text-white">{t("seer:myRequestsTitle")}</h1>

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
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onDelete={(id) => deleteMutation.mutate(id)}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-white/30">
          {statusFilter === "all"
            ? t("seer:noRequestsAll")
            : t("seer:noRequestsFiltered")}
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
