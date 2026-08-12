import { useCallback, useEffect, useRef } from "react";

/**
 * Sentinelle de défilement infini — attachée par référence de rappel.
 *
 * Un `useEffect` classique ne convient pas : au premier rendu la grille est
 * encore vide, la sentinelle n'est donc pas dans le document, et l'effet
 * ressort sans rien observer. Il faudrait qu'il se rejoue à l'arrivée du nœud —
 * ce que seule une dépendance instable provoquait, en reconstruisant
 * l'observateur à chaque rendu, y compris pendant le défilement.
 *
 * La référence de rappel, elle, est appelée exactement quand le nœud entre dans
 * le document et quand il en sort. L'observateur se monte une fois, au bon
 * moment, et se démonte proprement.
 *
 * `onReach` est rangé dans une ref : il change d'identité à chaque rendu
 * (l'objet que rend TanStack est un proxy neuf), et on ne veut pas que cela
 * touche à l'observateur.
 */
export function useInfiniteSentinel(
  onReach: () => void,
  enabled: boolean,
  /** Distance d'anticipation sous le bas de l'écran. */
  rootMargin = "0px 0px 800px 0px",
) {
  const onReachRef = useRef(onReach);
  onReachRef.current = onReach;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const attach = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    nodeRef.current = node;
    if (!node || !enabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onReachRef.current(); },
      { rootMargin },
    );
    observer.observe(node);
    observerRef.current = observer;
  }, [enabled, rootMargin]);

  /* La recherche masque le défilement infini : on relâche l'observateur, et on
   * le reprend sur le nœud déjà en place quand elle se termine. */
  useEffect(() => {
    if (!enabled) {
      observerRef.current?.disconnect();
      observerRef.current = null;
    } else if (nodeRef.current && !observerRef.current) {
      attach(nodeRef.current);
    }
  }, [enabled, attach]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return attach;
}
