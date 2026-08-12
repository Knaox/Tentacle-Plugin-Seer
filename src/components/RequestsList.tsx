import { useTranslation } from "react-i18next";
import { RequestCard } from "./RequestCard";
import { RequestsEmpty } from "./RequestsEmpty";
import type { LocalRequest } from "../api/types";
import type { ProgressItem } from "../api/types-releases";

interface RequestsListProps {
  isLoading: boolean;
  requests: LocalRequest[];
  /** Avancement réel, rafraîchi séparément de la liste. */
  progressById?: Map<string, ProgressItem>;
  progressAt?: string | null;
  filtered: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string, seasons?: number[], deleteFiles?: boolean, full?: boolean) => void;
  onRetry: (id: string, seasons?: number[], profileId?: string | null, forceRedownload?: boolean) => void;
  onRetryDelete: (id: string) => void;
  onAddSeasons: (request: LocalRequest) => void;
  onOpenActionModal: (request: LocalRequest, action: "delete" | "retry") => void;
  onOpenMarkMenu: (request: LocalRequest) => void;
  marking: boolean;
  deleting: boolean;
  retrying: boolean;
}

/**
 * Liste des demandes : skeleton de chargement, cartes (ou état vide), pagination.
 * Extrait de RequestsPage pour rester sous 300 lignes — extraction pure, aucun
 * changement de comportement.
 */
export function RequestsList({
  isLoading, requests, progressById, progressAt, filtered, page, totalPages, onPageChange,
  selectionMode, selectedIds, onToggleSelect,
  onDelete, onRetry, onRetryDelete, onAddSeasons, onOpenActionModal, onOpenMarkMenu,
  marking, deleting, retrying,
}: RequestsListProps) {
  const { t } = useTranslation("seer");

  return (
    <>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex animate-pulse gap-3 rounded-xl bg-tentacle-fill-subtle p-3">
              <div className="h-24 w-16 rounded-lg bg-tentacle-fill-soft" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-1/3 rounded bg-tentacle-fill-soft" />
                <div className="h-3 w-1/4 rounded bg-tentacle-fill-subtle" />
                <div className="h-1 w-full rounded bg-tentacle-fill-subtle" />
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
                progress={progressById?.get(request.id)}
                progressAt={progressAt ?? null}
                onDelete={onDelete}
                onRetry={onRetry}
                onRetryDelete={onRetryDelete}
                onAddSeasons={onAddSeasons}
                onOpenModal={onOpenActionModal}
                onOpenMarkMenu={onOpenMarkMenu}
                marking={marking}
                deleting={deleting}
                retrying={retrying}
                selectable={selectionMode}
                selected={selectedIds.has(request.id)}
                onSelect={onToggleSelect}
              />
            </div>
          ))}
        </div>
      ) : (
        <RequestsEmpty filtered={filtered} />
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 pb-8">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg bg-tentacle-fill-subtle px-4 py-2 text-sm text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-medium disabled:opacity-30"
          >
            {t("seer:previousPage")}
          </button>
          <span className="text-sm text-tentacle-text-tertiary">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg bg-tentacle-fill-subtle px-4 py-2 text-sm text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-medium disabled:opacity-30"
          >
            {t("seer:nextPage")}
          </button>
        </div>
      )}
    </>
  );
}
