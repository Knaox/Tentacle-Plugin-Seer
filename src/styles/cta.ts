/**
 * Patterns de boutons réutilisés depuis Tentacle (apps/web/src/pages/*).
 * NE PAS hardcoder de couleurs — tout passe par les CSS variables du host
 * injectées via apps/web/src/theme/tokens.css.
 *
 * Si le thème Tentacle change (via tokens.css), les boutons du plugin suivent.
 */

/** Bouton principal Netflix-style : fond blanc + texte noir + halo brand. */
export const CTA_PRIMARY =
  "inline-flex items-center justify-center rounded-lg bg-white text-sm font-bold text-black transition-all hover:-translate-y-0.5 hover:bg-white/95 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";

/** Halo violet à appliquer comme `style={CTA_PRIMARY_HALO}` sur le bouton primaire. */
export const CTA_PRIMARY_HALO: React.CSSProperties = {
  boxShadow: "0 8px 22px rgba(var(--brand-rgb), 0.45)",
};

/** Bouton secondaire (Annuler, options) — fond translucide blanc. */
export const CTA_SECONDARY =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.06] text-sm font-semibold text-white transition-all hover:border-white/[0.14] hover:bg-white/[0.10] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40";

/** Bouton ghost (sans fond) pour actions discrètes. */
export const CTA_GHOST =
  "inline-flex items-center justify-center rounded-lg text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

/** Bouton destructif (rouge subtil). */
export const CTA_DANGER =
  "inline-flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-sm font-semibold text-red-300 transition-all hover:border-red-500/30 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40";

/** Tailles standards à composer avec un des variants ci-dessus. */
export const CTA_SIZE_SM = "h-8 px-3 text-xs";
export const CTA_SIZE_MD = "h-10 px-4 text-sm";
export const CTA_SIZE_LG = "h-11 px-5 text-sm";

/** Input standard Tentacle (focus ring brand). */
export const INPUT_BASE =
  "h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-tentacle-brand focus:ring-2 focus:ring-tentacle-brand/30";

/**
 * Pill / chip / filter button. Pour les barres de filtres, onglets, saisons.
 * pillClass(active) renvoie les classes selon l'état.
 */
export function pillClass(active: boolean): string {
  return active
    ? "bg-white text-black shadow-sm"
    : "bg-white/[0.06] text-white/70 hover:bg-white/[0.10] hover:text-white";
}

