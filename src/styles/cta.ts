/**
 * Patterns de boutons partagés du plugin — 100 % tokens sémantiques `tentacle-*`
 * (CSS variables fournies par l'hôte). Suivent automatiquement le thème :
 * en CLAIR, `cta-primary` = violet de marque + texte blanc ; en SOMBRE = pilule
 * blanche + texte noir. Aucune couleur en dur.
 *
 * Contrainte technique : PAS de modificateur d'opacité (`/NN`) sur une classe
 * `tentacle-*` — l'iframe/WebView ne compile pas `/opacity` sur une couleur
 * définie en `var()`. On utilise donc des tokens PRÉ-ALPHÉS (`fill-*`,
 * `*-soft`) ou `hover:opacity-*`.
 */

/** Bouton principal (Netflix-style) : suit cta-primary (violet clair / blanc sombre). */
export const CTA_PRIMARY =
  "inline-flex items-center justify-center rounded-lg bg-tentacle-cta-primary text-sm font-bold text-tentacle-cta-primary-fg transition-all hover:-translate-y-0.5 hover:opacity-90 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";

/** Halo violet à appliquer via `style={CTA_PRIMARY_HALO}` sur le bouton primaire. */
export const CTA_PRIMARY_HALO: React.CSSProperties = {
  boxShadow: "0 8px 22px rgba(var(--brand-rgb), 0.45)",
};

/** Bouton secondaire (Annuler, options) — surface neutre translucide thémée. */
export const CTA_SECONDARY =
  "inline-flex items-center justify-center rounded-lg border border-tentacle-border-subtle bg-tentacle-fill-soft text-sm font-semibold text-tentacle-text-primary transition-all hover:border-tentacle-border-strong hover:bg-tentacle-fill-medium active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40";

/** Bouton ghost (sans fond) pour actions discrètes. */
export const CTA_GHOST =
  "inline-flex items-center justify-center rounded-lg text-sm font-medium text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary disabled:cursor-not-allowed disabled:opacity-40";

/** Bouton destructif — tokens status-error thémés (lisible clair comme sombre). */
export const CTA_DANGER =
  "inline-flex items-center justify-center rounded-lg border border-tentacle-border-subtle bg-tentacle-status-error-bg text-sm font-semibold text-tentacle-status-error-fg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

/** Tailles standards à composer avec un des variants ci-dessus. */
export const CTA_SIZE_SM = "h-8 px-3 text-xs";
export const CTA_SIZE_MD = "h-10 px-4 text-sm";
export const CTA_SIZE_LG = "h-11 px-5 text-sm";

/** Input standard Tentacle (fond/texte/bordure thémés, focus ring brand). */
export const INPUT_BASE =
  "h-11 w-full rounded-lg border border-tentacle-border-subtle bg-tentacle-fill-soft px-3 text-sm text-tentacle-text-primary outline-none transition placeholder:text-tentacle-text-quaternary focus:border-tentacle-border-focus focus:ring-2 focus:ring-tentacle-brand-soft";

/**
 * Pill / chip / filter button. Pour les barres de filtres, onglets, saisons.
 * pillClass(active) renvoie les classes selon l'état.
 */
export function pillClass(active: boolean): string {
  return active
    ? "bg-tentacle-cta-primary text-tentacle-cta-primary-fg shadow-sm"
    : "bg-tentacle-fill-soft text-tentacle-text-secondary hover:bg-tentacle-fill-medium hover:text-tentacle-text-primary";
}
