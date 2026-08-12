import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCalendarProviders } from "../../hooks/useReleases";
import { PLATFORMS } from "../../utils/platforms";
import { pill } from "../../styles/pills";

interface Props {
  value: number | null;
  onChange: (providerId: number | null) => void;
}

/**
 * Choix de la plateforme, sous forme de menu compact.
 *
 * La version précédente étalait quarante pilules à plat sous la barre d'outils :
 * un mur qui repoussait l'agenda hors de l'écran avant même de l'avoir consulté.
 * Un seul bouton porte maintenant la plateforme retenue, et la liste ne s'ouvre
 * qu'à la demande — avec une recherche, puisqu'il y en a quatre-vingts.
 */
export function PlatformPicker({ value, onChange }: Props) {
  const { t } = useTranslation("seer");
  const { data } = useCalendarProviders();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const providers = useMemo(() => {
    const all = data?.results ?? [];
    if (all.length === 0) return PLATFORMS.map((p) => ({ id: p.id, name: p.name, logoPath: null }));
    const popular = new Set(PLATFORMS.map((p) => p.id));
    const rank = (id: number) => (popular.has(id) ? 0 : 1);
    return [...all].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? providers.filter((p) => p.name.toLowerCase().includes(q)) : providers;
  }, [providers, search]);

  const current = value != null ? providers.find((p) => p.id === value) : null;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={pill(value != null)}
      >
        {current?.name ?? t("seer:releasesPickPlatform")}
        <svg
          className="h-3 w-3 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1.5 max-h-80 w-64 overflow-y-auto rounded-xl bg-tentacle-surface-dropdown p-2 ring-1 ring-tentacle-border-subtle shadow-[var(--elev-3)]"
          style={{ animation: "fadeSlideUp 150ms ease forwards" }}
        >
          <input
            type="search"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("seer:releasesSearchPlatform")}
            aria-label={t("seer:releasesSearchPlatform")}
            className="mb-1.5 w-full rounded-lg border border-tentacle-border-subtle bg-tentacle-fill-subtle px-2.5 py-1.5 text-xs text-tentacle-text-primary placeholder-tentacle-text-quaternary outline-none focus:border-tentacle-border-focus focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.5)]"
          />

          {value != null && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="mb-1 w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-tentacle-text-quaternary transition-colors hover:bg-tentacle-fill-subtle"
            >
              {t("seer:filterClearSection")}
            </button>
          )}

          {filtered.map((p) => {
            const active = value === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onChange(active ? null : p.id); setOpen(false); }}
                className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                  active
                    ? "bg-[rgba(var(--brand-rgb),0.18)] text-[var(--brand-light)]"
                    : "text-tentacle-text-secondary hover:bg-tentacle-fill-subtle hover:text-tentacle-text-primary"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
