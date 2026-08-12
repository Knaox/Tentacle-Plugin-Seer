import { useEffect, type RefObject } from "react";

/**
 * ⌘K / Ctrl+K place le curseur dans la barre de recherche de la page courante,
 * Échap la vide et rend le focus.
 *
 * Deux détails qui manquaient :
 *   - la comparaison était sensible à la casse, donc le raccourci était sans
 *     effet avec Verr.Maj ou Majuscule enfoncée ;
 *   - la page Mes demandes n'avait aucun raccourci alors qu'elle a la même
 *     barre de recherche que le catalogue.
 */
export function useSearchHotkey(
  inputRef: RefObject<HTMLInputElement | null>,
  onClear?: () => void,
): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        onClear?.();
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inputRef, onClear]);
}

/**
 * Une page de plugin s'ouvre en haut.
 *
 * Tentacle TV mémorise la position de défilement de chaque page et la restaure
 * au retour — utile pour une bibliothèque qu'on parcourt, déroutant ici, où la
 * bannière et la barre de recherche sont tout en haut.
 */
export function useScrollTopOnMount(): void {
  useEffect(() => {
    window.scrollTo(0, 0);
    // Le contenu du plugin vit dans un cadre : selon la plateforme, le
    // défilement porte sur la fenêtre ou sur l'élément racine.
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }, []);
}
