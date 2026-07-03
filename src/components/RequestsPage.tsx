import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  useMyRequests, useDeleteRequest, useRetryRequest, useRetryDeleteRequest,
  useQueueStatus, useBulkDeleteRequests, useBulkRetryRequests, useMarkRequestStatus,
} from "../hooks/useRequests";
import { useRequestMedia } from "../hooks/useRequestMedia";
import { useToast } from "../hooks/useToast";
import { RequestCard } from "./RequestCard";
import { SeasonActionModal } from "./SeasonActionModal";
import { MarkMenuSheet, type MarkTarget } from "./MarkMenuSheet";
import { RequestsStatsBar } from "./RequestsStatsBar";
import { RequestsToolbar, type StatusFilter, type TypeFilter } from "./RequestsToolbar";
import { RequestsBulkBar, BulkRetryModal } from "./RequestsBulkUI";
import { RequestsQueueBanner } from "./RequestsQueueBanner";
import { RequestsEmpty } from "./RequestsEmpty";
import type { LocalRequest, SeerrSearchResult } from "../api/types";

const MediaDetailModal = lazy(() =>
  import("./MediaDetailModal").then((m) => ({ default: m.MediaDetailModal }))
);

export function RequestsPage() {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addSeasonsItem, setAddSeasonsItem] = useState<SeerrSearchResult | null>(null);
  const [addSeasonsSource, setAddSeasonsSource] = useState<LocalRequest | null>(null);
  const [bulkRetryModal, setBulkRetryModal] = useState(false);
  const [bulkProfileId, setBulkProfileId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ request: LocalRequest; action: "delete" | "retry" } | null>(null);
  const [markMenuFor, setMarkMenuFor] = useState<LocalRequest | null>(null);

  // « En attente » regroupe la file locale (queued) ET les demandes
  // « Demandée » (unavailable : approuvées côté Jellyseerr, pas encore acquises).
  const backendStatus = statusFilter === "all" ? undefined
    : statusFilter === "queued" ? "queued,unavailable"
    : statusFilter;
  const backendType = typeFilter === "all" ? undefined : typeFilter;
  const { data, isLoading } = useMyRequests(page, 20, backendStatus, backendType, debouncedSearch || undefined);

  // Debounce de la recherche (revient page 1 à chaque nouvelle requête).
  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);
  const deleteMutation = useDeleteRequest();
  const retryMutation = useRetryRequest();
  const retryDeleteMutation = useRetryDeleteRequest();
  const markMutation = useMarkRequestStatus();
  const requestMedia = useRequestMedia();
  const bulkDeleteMutation = useBulkDeleteRequests();
  const bulkRetryMutation = useBulkRetryRequests();
  const { data: queueData } = useQueueStatus();

  const requests = data?.results ?? [];
  const totalPages = data?.pages ?? 1;

  const handleDelete = (id: string, seasons?: number[], deleteFiles?: boolean, full?: boolean) => {
    deleteMutation.mutate({ id, seasons, deleteFiles, full }, {
      onSuccess: () => toast.show("success", t("requestDeleting")),
      onError: () => toast.show("error", t("requestDeleteError")),
    });
  };

  const handleRetry = (id: string, seasons?: number[], profileId?: string | null, forceRedownload?: boolean) => {
    retryMutation.mutate({ id, seasons, profileId, forceRedownload }, {
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

  const handleMark = (id: string, status: MarkTarget) => {
    markMutation.mutate({ id, status }, {
      onSuccess: () => toast.show("success", t("seer:markedSuccess")),
      onError: () => toast.show("error", t("seer:markedError")),
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

      <RequestsStatsBar />

      <RequestsQueueBanner queue={queueData} />

      <RequestsToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => { setStatusFilter(v); setPage(1); }}
        typeFilter={typeFilter}
        onTypeFilterChange={(v) => { setTypeFilter(v); setPage(1); }}
        showSelectToggle={requests.length > 0}
        selectionMode={selectionMode}
        onToggleSelectionMode={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
      />

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
                onOpenMarkMenu={setMarkMenuFor}
                marking={markMutation.isPending}
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
        <RequestsEmpty filtered={statusFilter !== "all" || !!debouncedSearch} />
      )}

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
        <RequestsBulkBar
          count={selectedIds.size}
          deleting={bulkDeleteMutation.isPending}
          retrying={bulkRetryMutation.isPending}
          onBulkDelete={handleBulkDelete}
          onOpenRetryModal={() => setBulkRetryModal(true)}
          onCancel={exitSelectionMode}
        />
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

      {/* Sheet « Marquer comme » (niveau page : hors des stacking contexts des cartes) */}
      {markMenuFor && (
        <MarkMenuSheet
          request={markMenuFor}
          onSelect={(target) => {
            handleMark(markMenuFor.id, target);
            setMarkMenuFor(null);
          }}
          onClose={() => setMarkMenuFor(null)}
        />
      )}

      {/* Modal saison/profil pour retry/delete individuel */}
      {actionModal && (
        <SeasonActionModal
          request={actionModal.request}
          action={actionModal.action}
          onConfirm={(seasons, profileId, options) => {
            if (actionModal.action === "delete") {
              // Partiel = des saisons de la demande survivent → l'état de la
              // carte ne passe pas « En suppression » (MAJ optimiste ciblée).
              const reqSeasons = actionModal.request.seasons ?? [];
              const full = !seasons || seasons.length === 0 || seasons.length >= reqSeasons.length;
              handleDelete(actionModal.request.id, seasons, options?.deleteFiles, full);
            } else {
              handleRetry(actionModal.request.id, seasons, profileId, options?.forceRedownload);
            }
            setActionModal(null);
          }}
          onClose={() => setActionModal(null)}
        />
      )}

      {/* Modal choix profil pour bulk retry */}
      {bulkRetryModal && (
        <BulkRetryModal
          count={selectedIds.size}
          profileId={bulkProfileId}
          onProfileChange={setBulkProfileId}
          retrying={bulkRetryMutation.isPending}
          onConfirm={() => handleBulkRetry(bulkProfileId)}
          onClose={() => setBulkRetryModal(false)}
        />
      )}
    </div>
  );
}
