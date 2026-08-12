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
 */

interface Props {
  src: string;
  className?: string;
  /** Dimensions explicites : elles réservent la place et évitent le décalage. */
  width?: number;
  height?: number;
}

export function PosterImage({ src, className = "", width, height }: Props) {
  const [loaded, setLoaded] = useState(false);

  const ref = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) setLoaded(true);
  }, []);

  return (
    <img
      ref={ref}
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      width={width}
      height={height}
      onLoad={() => setLoaded(true)}
      className={`h-full w-full object-cover ${className}`}
      style={{ opacity: loaded ? 1 : 0, transition: "opacity 200ms ease" }}
    />
  );
}
