/**
 * Registre partagé de proximité à l'écran.
 *
 * Un `IntersectionObserver` par garde, quel que soit le nombre de cibles. La
 * variante naïve — un observateur par carte — se paierait à chaque image du
 * défilement, et ce coût grandirait avec la liste : à six cents cartes, six
 * cents jeux d'intersections recalculés par image.
 *
 * La fabrique d'observateurs est INJECTABLE. C'est la seule concession faite au
 * test : le plugin n'a pas de DOM sous `node --test`, et cette pièce est
 * précisément celle dont une régression ne se verrait pas — une cible oubliée
 * garde son affiche en mémoire sans que rien ne change à l'écran.
 *
 * Les gardes ne connaissent rien aux affiches : elles disent « proche » ou
 * « loin », l'appelant décide de ce qu'il en fait.
 */

type Listener = (near: boolean) => void;

export type ObserverFactory = (
  callback: IntersectionObserverCallback,
  init: IntersectionObserverInit,
) => IntersectionObserver;

export interface ViewportGuard {
  /** Le rappel reçoit l'état courant dès la première mesure, puis à chaque passage de seuil. */
  observe(target: Element, onChange: Listener): void;
  release(target: Element): void;
  /**
   * Gèle toute décision. Indispensable quand un calque de l'hôte peut recouvrir
   * ou réduire le cadre : les rects s'effondreraient et la garde déchargerait
   * tout d'un coup, pour tout recharger en vague à la fermeture.
   */
  setPaused(paused: boolean): void;
  /** Relevé de diagnostic — la mémoire ne se vérifie pas autrement (cf. useNearViewport). */
  stats(): { observed: number; near: number };
}

export function createViewportGuard(
  rootMargin: string,
  makeObserver: ObserverFactory = (callback, init) => new IntersectionObserver(callback, init),
): ViewportGuard {
  /* Les rappels dans une table faible, comme la table des plateformes : une
   * cible démontée dont on aurait manqué le retrait ne retient rien. */
  const listeners = new WeakMap<Element, Listener>();
  /* Les cibles, elles, sont retenues fortement — il faut pouvoir toutes les
   * ré-observer à la reprise. React appelle toujours la référence de rappel
   * avec `null` au démontage, donc `release` passe et rien ne fuit. */
  const targets = new Set<Element>();
  const near = new Set<Element>();

  let observer: IntersectionObserver | null = null;
  let paused = false;

  const handle: IntersectionObserverCallback = (entries) => {
    // Filet pour les rappels déjà en vol au moment de la suspension.
    if (paused) return;
    for (const entry of entries) {
      if (entry.isIntersecting) near.add(entry.target);
      else near.delete(entry.target);
      listeners.get(entry.target)?.(entry.isIntersecting);
    }
  };

  return {
    observe(target, onChange) {
      listeners.set(target, onChange);
      targets.add(target);
      // Création paresseuse : une page sans grille ne monte aucun observateur.
      observer ??= makeObserver(handle, { rootMargin });
      observer.observe(target);
    },

    release(target) {
      // Idempotent : un retrait en double ne doit pas déconnecter la garde.
      if (!targets.delete(target)) return;
      listeners.delete(target);
      near.delete(target);
      observer?.unobserve(target);
      if (targets.size === 0) {
        observer?.disconnect();
        observer = null;
      }
    },

    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (!observer) return;
      if (paused) {
        observer.disconnect();
        return;
      }
      /* À la reprise on ré-observe tout : l'observateur réémet alors un état
       * initial par cible, donc la garde se resynchronise sur des rects qui ont
       * pu changer pendant la suspension — sans travail supplémentaire. */
      for (const target of targets) observer.observe(target);
    },

    stats() {
      return { observed: targets.size, near: near.size };
    },
  };
}
