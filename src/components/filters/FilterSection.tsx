import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

/**
 * Une section de filtre, repliée par défaut quand elle n'est pas utilisée.
 *
 * Le panneau empilait ses sept sections dépliées d'un coup : genres, plateformes,
 * années, note, langue, statut… soit plusieurs écrans de défilement où tout se
 * ressemble. On ne trouvait rien et on ne voyait pas ce qui était déjà coché.
 *
 * Trois règles ici :
 *   - une section qui porte une sélection s'ouvre d'elle-même et affiche son
 *     compte, pour qu'aucun filtre actif ne reste caché ;
 *   - l'en-tête entier est la zone de clic, pas seulement le chevron ;
 *   - « Effacer » n'apparaît que là où il y a quelque chose à effacer.
 */

interface Props {
  title: string;
  /** Nombre de valeurs retenues — affiché en pastille, ouvre la section. */
  count?: number;
  onClear?: () => void;
  /** Force l'ouverture (sections à valeur unique, comme le tri). */
  alwaysOpen?: boolean;
  children: ReactNode;
}

export function FilterSection({ title, count = 0, onClear, alwaysOpen, children }: Props) {
  const { t } = useTranslation("seer");
  const [open, setOpen] = useState(count > 0);
  const expanded = alwaysOpen || open;

  return (
    <section className="border-b border-tentacle-border-subtle pb-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => !alwaysOpen && setOpen((v) => !v)}
          aria-expanded={expanded}
          disabled={alwaysOpen}
          className="flex flex-1 items-center gap-2 py-2 text-left transition-colors hover:text-tentacle-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] disabled:cursor-default"
        >
          {!alwaysOpen && (
            <svg
              className="h-3.5 w-3.5 shrink-0 text-tentacle-text-quaternary transition-transform duration-150"
              style={{ transform: expanded ? "rotate(90deg)" : "none" }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">
            {title}
          </span>
          {count > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[rgba(var(--brand-rgb),0.22)] px-1 text-[10px] font-bold tabular-nums text-[var(--brand-light)]">
              {count}
            </span>
          )}
        </button>

        {count > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded px-1.5 py-1 text-[11px] font-medium text-tentacle-text-quaternary transition-colors hover:text-tentacle-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
          >
            {t("seer:filterClearSection")}
          </button>
        )}
      </div>

      {expanded && (
        <div className="pb-1 pt-1" style={{ animation: "fadeIn 150ms ease" }}>
          {children}
        </div>
      )}
    </section>
  );
}
