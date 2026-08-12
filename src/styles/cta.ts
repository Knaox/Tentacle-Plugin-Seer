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

/**
 * Bouton principal — pilule pleine, comme dans l'application.
 *
 * Le rectangle à coins doux d'avant tranchait avec le reste de Tentacle TV, où
 * les actions sont des pilules. L'appui enfonce légèrement le bouton : c'est une
 * transformation, jamais une ombre animée, qui repeindrait le bouton à chaque
 * image (règle GPU du projet).
 */
export const CTA_PRIMARY =
  "inline-flex items-center justify-center rounded-full bg-tentacle-cta-primary text-sm font-bold text-tentacle-cta-primary-fg transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";

/** Halo violet à appliquer via `style={CTA_PRIMARY_HALO}` sur le bouton primaire. */
export const CTA_PRIMARY_HALO: React.CSSProperties = {
  boxShadow: "0 8px 22px rgba(var(--brand-rgb), 0.45)",
};

/** Bouton secondaire (Annuler, options) — surface neutre translucide thémée. */
export const CTA_SECONDARY =
  "inline-flex items-center justify-center rounded-full border border-tentacle-border-subtle bg-tentacle-fill-soft text-sm font-semibold text-tentacle-text-primary transition-colors duration-150 hover:border-tentacle-border-strong hover:bg-tentacle-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] disabled:cursor-not-allowed disabled:opacity-40";

/** Bouton ghost (sans fond) pour actions discrètes. */
export const CTA_GHOST =
  "inline-flex items-center justify-center rounded-full text-sm font-medium text-tentacle-text-secondary transition-colors duration-150 hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] disabled:cursor-not-allowed disabled:opacity-40";

/** Bouton destructif — tokens status-error thémés (lisible clair comme sombre). */
export const CTA_DANGER =
  "inline-flex items-center justify-center rounded-full border border-tentacle-border-subtle bg-tentacle-status-error-bg text-sm font-semibold text-tentacle-status-error-fg transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] disabled:cursor-not-allowed disabled:opacity-40";

/** Tailles standards à composer avec un des variants ci-dessus. */
export const CTA_SIZE_SM = "h-8 px-3 text-xs";
export const CTA_SIZE_MD = "h-10 px-4 text-sm";
export const CTA_SIZE_LG = "h-11 px-5 text-sm";

/** Input standard Tentacle (fond/texte/bordure thémés, focus ring brand). */
export const INPUT_BASE =
  "h-11 w-full rounded-lg border border-tentacle-border-subtle bg-tentacle-fill-soft px-3 text-sm text-tentacle-text-primary outline-none transition placeholder:text-tentacle-text-quaternary focus:border-tentacle-border-focus focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.5)]";

/**
 * Pilule de filtre / onglet.
 *
 * Délègue au motif partagé de `styles/pills.ts`, repris de l'application :
 * l'ancienne version n'avait ni anneau, ni élévation, ni marqueur d'état actif
 * distinct de la couleur de fond.
 */
export { pill as pillClass } from "./pills";
