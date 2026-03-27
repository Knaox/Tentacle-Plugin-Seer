import { useState, useCallback, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  useMyRequests, useDeleteRequest, useRetryRequest, useRetryDeleteRequest,
  useQueueStatus, useBulkDeleteRequests, useBulkRetryRequests,
} from "../hooks/useRequests";
import { useRequestMedia } from "../hooks/useRequestMedia";
import { useToast } from "../hooks/useToast";
import { RequestCard } from "./RequestCard";
import { EmptyState } from "./EmptyState";
import { ProfileSelector } from "./ProfileSelector";
import { SeasonActionModal } from "./SeasonActionModal";
import type { LocalRequest, SeerrSearchResult } from "../api/types";

const MediaDetailModal = lazy(() =>
  import("./MediaDetailModal").then((m) => ({ default: m.MediaDetailModal }))
);

type StatusFilter = "all" | "queued" | "sent_to_seer" | "approved" | "downloading" | "available" | "failed" | "deleting";

const STATUS_TABS: { value: StatusFilter; key: string }[] = [
  { value: "all", key: "seer:filterAll" },
  { value: "queued", key: "seer:filterQueued" },
  { value: "sent_to_seer", key: "seer:filterSent" },
  { value: "approved", key: "seer:filterApproved" },
  { value: "downloading", key: "seer:filterDownloading" },
  { value: "available", key: "seer:filterAvailable" },
  { value: "failed", key: "seer:filterFailed" },
  { value: "deleting", key: "seer:filterDeleting" },
];

export function RequestsPage() {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addSeasonsItem, setAddSeasonsItem] = useState<SeerrSearchResult | null>(null);
  const [addSeasonsSource, setAddSeasonsSource] = useState<LocalRequest | null>(null);
  const [bulkRetryModal, setBulkRetryModal] = useState(false);
  const [bulkProfileId, setBulkProfileId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ request: LocalRequest; action: "delete" | "retry" } | null>(null);

  const backendStatus = statusFilter === "all" ? undefined : statusFilter;
  const backendType = typeFilter === "all" ? undefined : typeFilter;
  const { data, isLoading } = useMyRequests(page, 20, backendStatus, backendType);
  const deleteMutation = useDeleteRequest();
  const retryMutation = useRetryRequest();
  const retryDeleteMutation = useRetryDeleteRequest();
  const requestMedia = useRequestMedia();
  const bulkDeleteMutation = useBulkDeleteRequests();
  const bulkRetryMutation = useBulkRetryRequests();
  const { data: queueData } = useQueueStatus();

  const requests = data?.results ?? [];
  const totalPages = data?.pages ?? 1;

  const handleDelete = (id: string, seasons?: number[]) => {
    deleteMutation.mutate({ id, seasons }, {
      onSuccess: () => toast.show("success", t("requestDeleting")),
      onError: () => toast.show("error", t("requestDeleteError")),
    });
  };

  const handleRetry = (id: string, seasons?: number[], profileId?: string | null) => {
    retryMutation.mutate({ id, seasons, profileId }, {
      onSuccess: () => toast.show("success", t("requestRetried")),
      onError: () => toast.show("error", t("requestRetryError")),
    });
  };

  const handleRetryDelete = (id: string) => {
    retryDeleteMutation.mutate(id, {
      onSuccess: () => toast.show("success", t("requestDeleting")),
      onError: () => toast.show("error", t("requestDeleteError")),
    });
  };

  const handleAddSeasons = (req: LocalRequest) => {
    setAddSeasonsSource(req);
    setAddSeasonsItem({
      id: req.tmdbId,
      mediaType: "tv",
      name: req.title,
      posterPath: req.posterPath ?? undefined,
      backdropPath: req.backdropPath ?? undefined,
      overview: req.overview ?? undefined,
    });
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    bulkDeleteMutation.mutate(ids, {
      onSuccess: (data) => {
        toast.show("success", t("bulkDeleteSuccess", { count: data.deleted }));
        exitSelectionMode();
      },
      onError: () => toast.show("error", t("bulkError")),
    });
  };

  const handleBulkRetry = (profileId?: string | null) => {
    const ids = Array.from(selectedIds);
    bulkRetryMutation.mutate({ ids, profileId }, {
      onSuccess: (data) => {
        toast.show("success", t("bulkRetrySuccess", { count: data.retried }));
        exitSelectionMode();
        setBulkRetryModal(false);
      },
      onError: () => toast.show("error", t("bulkError")),
    });
  };

  return (
    <div className="px-4 pt-4 md:px-8">
      <h1 className="mb-4 text-2xl font-bold text-white">{t("seer:myRequestsTitle")}</h1>

      {/* Queue status banner */}
      {queueData && (queueData.queued > 0 || queueData.processing || queueData.deleting > 0) && (
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
            ) : queueData.queued > 0 ? (
              <span>{t("seer:queueWaiting", { count: queueData.queued })}</span>
            ) : null}
            {queueData.deleting > 0 && (
              <span className="ml-2 text-orange-400/80">
                {t("seer:statusDeleting")}: {queueData.deleting}
              </span>
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
                ? "bg-[#8b5cf6] text-white"
                : "bg-[#1a1a2e] text-white/50 hover:bg-[#1a1a2e]/80"
            }`}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>
      <div className="mb-6 flex items-center gap-2">
        {(["all", "movie", "tv"] as const).map((v) => (
          <button
            key={v}
            onClick={() => { setTypeFilter(v); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              typeFilter === v
                ? "bg-[#8b5cf6] text-white"
                : "bg-[#1a1a2e] text-white/50 hover:bg-[#1a1a2e]/80"
            }`}
          >
            {v === "all" ? t("filterAllType") : v === "movie" ? t("filterMovies") : t("filterSeries")}
          </button>
        ))}
        {requests.length > 0 && (
          <button
            onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
            className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectionMode
                ? "bg-purple-600/30 text-purple-300"
                : "bg-white/10 text-white/60 hover:bg-white/15"
            }`}
          >
            {selectionMode ? t("seer:bulkCancel") : t("seer:bulkSelect")}
          </button>
        )}
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
          {requests.map((request, i) => (
            <div
              key={request.id}
              style={{
                opacity: 0,
                animation: `fadeSlideUp 400ms cubic-bezier(0.25,0.46,0.45,0.94) ${Math.min(i, 9) * 50}ms forwards`,
              }}
            >
              <RequestCard
                request={request}
                onDelete={handleDelete}
                onRetry={handleRetry}
                onRetryDelete={handleRetryDelete}
                onAddSeasons={handleAddSeasons}
                onOpenModal={(req, action) => setActionModal({ request: req, action })}
                deleting={deleteMutation.isPending}
                retrying={retryMutation.isPending}
                selectable={selectionMode}
                selected={selectedIds.has(request.id)}
                onSelect={toggleSelect}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title={statusFilter === "all" ? t("seer:noRequestsAll") : t("seer:noRequestsFiltered")}
          subtitle={statusFilter === "all" ? t("seer:noRequestsHint") : undefined}
          action={statusFilter === "all" ? (
            <button
              onClick={() => {
                if ((window as any).ReactNativeWebView?.postMessage) {
                  (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "NAVIGATE", route: "/(tabs)/plugins" }));
                } else {
                  window.parent.postMessage({ type: "NAVIGATE", path: "/plugins/seer/discover" }, "*");
                }
              }}
              className="rounded-lg bg-[#8b5cf6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#7c3aed]"
            >
              {t("discoverButton")}
            </button>
          ) : undefined}
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

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#12121a]/95 px-5 py-3 shadow-2xl backdrop-blur-sm">
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
            className="rounded-lg bg-red-600/20 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-50"
          >
            {bulkDeleteMutation.isPending ? "..." : t("seer:bulkDelete", { count: selectedIds.size })}
          </button>
          <button
            onClick={() => setBulkRetryModal(true)}
            disabled={bulkRetryMutation.isPending}
            className="rounded-lg bg-purple-600/20 px-4 py-2 text-xs font-semibold text-purple-400 transition-colors hover:bg-purple-600/30 disabled:opacity-50"
          >
            {bulkRetryMutation.isPending ? "..." : t("seer:bulkRetry", { count: selectedIds.size })}
          </button>
          <button
            onClick={exitSelectionMode}
            className="rounded-lg bg-white/10 px-4 py-2 text-xs text-white/50 transition-colors hover:bg-white/15"
          >
            {t("seer:bulkCancel")}
          </button>
        </div>
      )}

      {/* Modal ajout de saisons */}
      {addSeasonsItem && (
        <Suspense fallback={null}>
          <MediaDetailModal
            item={addSeasonsItem}
            lockedSeasons={addSeasonsSource?.seasons ?? undefined}
            defaultProfileId={addSeasonsSource?.profileId ?? undefined}
            onClose={() => { setAddSeasonsItem(null); setAddSeasonsSource(null); }}
            onRequest={() => {}}
            requesting={requestMedia.isPending}
          />
        </Suspense>
      )}

      {/* Modal saison/profil pour retry/delete individuel */}
      {actionModal && (
        <SeasonActionModal
          request={actionModal.request}
          action={actionModal.action}
          onConfirm={(seasons, profileId) => {
            if (actionModal.action === "delete") handleDelete(actionModal.request.id, seasons);
            else handleRetry(actionModal.request.id, seasons, profileId);
            setActionModal(null);
          }}
          onClose={() => setActionModal(null)}
        />
      )}

      {/* Modal choix profil pour bulk retry */}
      {bulkRetryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setBulkRetryModal(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl bg-[#1a1a2e] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-sm font-semibold text-white">
              {t("seer:bulkRetry", { count: selectedIds.size })}
            </h3>
            <ProfileSelector showAll selectedId={bulkProfileId} onChange={setBulkProfileId} />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setBulkRetryModal(false)}
                className="rounded-lg bg-white/10 px-4 py-1.5 text-xs text-white/50 hover:bg-white/15">
                {t("seer:cancel")}
              </button>
              <button
                onClick={() => handleBulkRetry(bulkProfileId)}
                disabled={bulkRetryMutation.isPending}
                className="rounded-lg bg-[#8b5cf6] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#7c3aed] disabled:opacity-40">
                {bulkRetryMutation.isPending ? "..." : t("seer:seasonActionConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
