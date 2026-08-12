import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCalendarProviders } from "../../hooks/useReleases";
import { PLATFORMS } from "../../utils/platforms";

interface Props {
  value: number | null;
  onChange: (providerId: number | null) => void;
}

/**
 * Sélecteur à choix unique sur le catalogue LIVE des plateformes (80 pour la
 * France). Distinct du filtre de plateformes du catalogue, qui est un choix
 * multiple sur une liste figée de onze entrées : sémantique et données
 * différentes, il n'y avait rien à mutualiser.
 *
 * Les plateformes les plus courantes sont épinglées en tête — sans quoi il
 * faudrait chercher « Netflix » au milieu de quatre-vingts entrées.
 */
export function PlatformPicker({ value, onChange }: Props) {
  const { t } = useTranslation("seer");
  const { data } = useCalendarProviders();
  const [search, setSearch] = useState("");

  const providers = useMemo(() => {
    const all = data?.results ?? [];
    if (all.length === 0) return PLATFORMS.map((p) => ({ id: p.id, name: p.name, logoPath: null }));

    const popular = new Set(PLATFORMS.map((p) => p.id));
    const head = all.filter((p) => popular.has(p.id));
    const tail = all.filter((p) => !popular.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
    return [...head, ...tail];
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => p.name.toLowerCase().includes(q));
  }, [providers, search]);

  return (
    <div className="mb-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("seer:releasesSearchPlatform")}
        aria-label={t("seer:releasesSearchPlatform")}
        className="mb-3 w-full rounded-xl border border-tentacle-border-subtle bg-tentacle-fill-subtle px-4 py-2.5 text-sm text-tentacle-text-primary placeholder-tentacle-text-quaternary outline-none transition-all focus:border-[rgba(var(--brand-rgb),0.3)] focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.5)]"
      />

      <div className="flex flex-wrap gap-2">
        {filtered.slice(0, 40).map((p) => {
          const active = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(active ? null : p.id)}
              aria-pressed={active}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-tentacle-brand text-tentacle-cta-brand-fg"
                  : "bg-tentacle-fill-subtle text-tentacle-text-secondary hover:bg-tentacle-fill-medium"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
