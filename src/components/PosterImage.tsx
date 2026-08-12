import { useCallback, useState } from "react";

/**
 * Affiche avec fondu à l'apparition — et sans le piège du cache.
 *
 * Le motif habituel (`useState` + `onLoad`) perd les images déjà en cache : le
 * navigateur émet `load` avant que React n'ait attaché le gestionnaire, donc
 * `loaded` reste faux et l'affiche demeure **invisible**. C'est exactement ce
 * qui vidait les vignettes de l'agenda.
 *
 * La parade : une ref de rappel qui interroge `complete` au montage. Une image
 * déjà en cache s'affiche immédiatement, une image en cours de chargement
 * garde son fondu.
 *
 * Deuxième piège, du même tonneau, révélé par le déchargement des affiches
 * hors écran : `complete` vaut aussi VRAI quand l'attribut `src` est absent.
 * Une carte montée trop loin de l'écran arrive sans source ; le test seul la
 * déclarerait donc chargée, et sa première apparition se ferait sans fondu.
 * `currentSrc` est vide tant qu'aucune source n'a été retenue — c'est ce qui
 * distingue les deux cas.
 */

interface Props {
  /**
   * Absente, l'image se vide et le navigateur libère son bitmap décodé — c'est
   * le levier du plafond de mémoire du catalogue. La boîte, elle, est imposée
   * par le CSS du conteneur : rien ne bouge, rien ne se décale.
   */
  src?: string;
  className?: string;
  /** Dimensions explicites : elles réservent la place et évitent le décalage. */
  width?: number;
  height?: number;
  /**
   * `eager` là où un observateur décide déjà de la distance de chargement.
   * Deux gestionnaires pour une même décision, c'est un de trop : celui du
   * navigateur est en outre aveugle dans un sous-arbre `content-visibility`
   * mis de côté, et raboterait l'anticipation à celle du moteur.
   */
  loading?: "lazy" | "eager";
}

export function PosterImage({ src, className = "", width, height, loading = "lazy" }: Props) {
  const [loaded, setLoaded] = useState(false);

  const ref = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.currentSrc !== "") setLoaded(true);
  }, []);

  return (
    <img
      ref={ref}
      src={src}
      alt=""
      aria-hidden
      loading={loading}
      decoding="async"
      width={width}
      height={height}
      onLoad={() => setLoaded(true)}
      className={`h-full w-full object-cover ${className}`}
      /* `loaded` ne redescend jamais : au retour dans la zone de garde, React
       * réutilise le même nœud, donc le fondu ne se rejoue pas. Le rechargement
       * ne se voit pas — c'est toute la condition de l'exercice. */
      style={{ opacity: loaded ? 1 : 0, transition: "opacity 200ms ease" }}
    />
  );
}
