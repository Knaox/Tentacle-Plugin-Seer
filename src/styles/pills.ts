/**
 * Pilules, onglets et segments — le motif visuel de Tentacle TV, transposé.
 *
 * La technique vient de l'application elle-même (`LibraryFilters`) et existe
 * pour une raison précise : **aucune couleur `tentacle-*` n'accepte de
 * modificateur d'opacité** dans le cadre isolé où tourne le plugin. Un
 * `bg-tentacle-brand/20` ne produit aucune classe — l'état actif restait donc
 * invisible.
 *
 * La parade : un fond OPAQUE surmonté d'un aplat de marque en dégradé plat.
 * Deux couches, zéro opacité sur la couleur, un état actif franc.
 *
 * L'anneau et l'élévation viennent de valeurs arbitraires adossées aux
 * variables du thème, donc clair et sombre suivent sans code supplémentaire.
 */

/** Aplat de marque uniforme, superposé à un fond opaque. */
const BRAND_WASH =
  "bg-[linear-gradient(rgba(var(--brand-rgb),0.24),rgba(var(--brand-rgb),0.24))]";

const PILL_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 " +
  "text-xs font-medium transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const PILL_IDLE =
  "bg-[var(--surface-2)] text-tentacle-text-secondary ring-1 ring-tentacle-border-strong " +
  "shadow-[var(--elev-1)] hover:bg-tentacle-fill-medium hover:text-tentacle-text-primary";

const PILL_ACTIVE =
  `bg-[var(--surface-2)] ${BRAND_WASH} text-[var(--brand-light)] ` +
  "ring-1 ring-[rgba(var(--brand-rgb),0.6)] shadow-[var(--elev-1)]";

/** Pilule de filtre / onglet. `pill(true)` marque l'état sélectionné. */
export function pill(active: boolean): string {
  return `${PILL_BASE} ${active ? PILL_ACTIVE : PILL_IDLE}`;
}

/**
 * Variante compacte — barres denses, cases de calendrier.
 *
 * La taille est composée AVEC la base, pas ajoutée après : dans une feuille
 * Tailwind, l'ordre des classes dans l'attribut ne décide de rien, c'est
 * l'ordre de la feuille générée qui tranche. `px-2` ajouté derrière `px-3`
 * n'aurait donc rien changé.
 */
export function pillSm(active: boolean): string {
  const base = PILL_BASE.replace("px-3 py-1.5 ", "px-2 py-1 ").replace("text-xs", "text-[11px]");
  return `${base} ${active ? PILL_ACTIVE : PILL_IDLE}`;
}

/**
 * Segment d'un sélecteur de vue (Semaine / Mois) : pas d'anneau ni d'élévation,
 * les segments vivent déjà dans un conteneur qui les encadre.
 */
export function segment(active: boolean): string {
  return (
    "rounded-full px-3 py-1 text-[11px] font-medium transition-colors duration-150 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] " +
    (active
      ? `bg-[var(--surface-2)] ${BRAND_WASH} text-[var(--brand-light)]`
      : "text-tentacle-text-tertiary hover:text-tentacle-text-primary")
  );
}

/** Conteneur d'un groupe de segments. */
export const SEGMENT_GROUP =
  "inline-flex gap-0.5 rounded-full bg-tentacle-fill-subtle p-0.5 ring-1 ring-tentacle-border-subtle";

/**
 * Bouton d'icône rond — navigation de calendrier, fermeture.
 * Taille minimale 36 px : au-dessous, la cible devient difficile à viser.
 */
export const ICON_BUTTON =
  "inline-flex h-9 w-9 items-center justify-center rounded-full " +
  "bg-tentacle-fill-subtle text-tentacle-text-secondary ring-1 ring-tentacle-border-subtle " +
  "transition-colors duration-150 hover:bg-tentacle-fill-medium hover:text-tentacle-text-primary " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] " +
  "disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Carte / tuile. Le survol ne touche QUE la couleur de fond : animer une ombre
 * repeindrait la carte à chaque image (règle GPU du projet).
 */
export const CARD_SURFACE =
  "rounded-xl bg-tentacle-fill-subtle ring-1 ring-tentacle-border-subtle " +
  "transition-colors duration-150 hover:bg-tentacle-fill-medium";
