import { useTranslation } from "react-i18next";

export type StatusFilter =
  | "all" | "queued" | "sent_to_seer" | "approved"
  | "downloading" | "available" | "failed" | "deleting";

export type TypeFilter = "all" | "movie" | "tv";

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

interface RequestsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  typeFilter: TypeFilter;
  onTypeFilterChange: (value: TypeFilter) => void;
  /** Bouton « Sélectionner » affiché seulement quand la liste n'est pas vide */
  showSelectToggle: boolean;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
}

/** Recherche + filtres statut/type + bascule sélection de la page Demandes. */
export function RequestsToolbar({
  search, onSearchChange,
  statusFilter, onStatusFilterChange,
  typeFilter, onTypeFilterChange,
  showSelectToggle, selectionMode, onToggleSelectionMode,
}: RequestsToolbarProps) {
  const { t } = useTranslation("seer");

  return (
    <>
      {/* Barre de recherche */}
      <div className="relative mb-4 rounded-xl bg-tentacle-fill-subtle backdrop-blur-xl">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-tentacle-text-quaternary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("seer:searchRequestsPlaceholder")}
          aria-label={t("seer:searchRequestsPlaceholder")}
          className="w-full rounded-xl border border-tentacle-border-subtle bg-transparent py-3 pl-12 pr-12 text-sm text-tentacle-text-primary placeholder-tentacle-text-quaternary outline-none transition-all focus:border-tentacle-brand/30 focus:ring-2 focus:ring-tentacle-brand/50"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            aria-label={t("seer:cancel")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-tentacle-text-quaternary transition-colors hover:text-tentacle-text-secondary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filtres statut */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onStatusFilterChange(tab.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-tentacle-cta-primary text-tentacle-cta-primary-fg shadow-sm"
                : "bg-tentacle-fill-soft text-tentacle-text-secondary hover:bg-tentacle-fill-medium hover:text-tentacle-text-primary"
            }`}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>

      {/* Filtres type + bascule sélection */}
      <div className="mb-6 flex items-center gap-2">
        {(["all", "movie", "tv"] as const).map((v) => (
          <button
            key={v}
            onClick={() => onTypeFilterChange(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              typeFilter === v
                ? "bg-tentacle-cta-primary text-tentacle-cta-primary-fg shadow-sm"
                : "bg-tentacle-fill-soft text-tentacle-text-secondary hover:bg-tentacle-fill-medium hover:text-tentacle-text-primary"
            }`}
          >
            {v === "all" ? t("filterAllType") : v === "movie" ? t("filterMovies") : t("filterSeries")}
          </button>
        ))}
        {showSelectToggle && (
          <button
            onClick={onToggleSelectionMode}
            className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectionMode
                ? "bg-tentacle-brand/30 text-tentacle-brand-light"
                : "bg-tentacle-fill-soft text-tentacle-text-secondary hover:bg-tentacle-fill-medium"
            }`}
          >
            {selectionMode ? t("seer:bulkCancel") : t("seer:bulkSelect")}
          </button>
        )}
      </div>
    </>
  );
}
