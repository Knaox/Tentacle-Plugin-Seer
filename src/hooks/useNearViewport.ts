import { useCallback, useEffect, useRef, useState } from "react";
import { createViewportGuard, type ViewportGuard } from "../utils/viewport-guard";

/**
 * Les deux gardes du plugin, et pourquoi leurs marges diffèrent.
 *
 * POSTER_GUARD décide quelles affiches restent chargées. Sa marge doit dominer
 * largement celle du moteur : Chrome réveille un sous-arbre
 * `content-visibility: auto` à environ la moitié de la hauteur de l'écran, soit
 * quelques centaines de pixels. Une garde plus serrée que ce réveil déchargerait
 * une carte que le navigateur est déjà en train de préparer, et l'affiche
 * arriverait après la peinture — le blanc que l'on cherche justement à éviter.
 *
 * L'asymétrie n'est pas « on défile plus vers le bas ». Vers le bas, les cartes
 * n'ont jamais été vues : leur affiche part en réseau, cinquante à cinq cents
 * millisecondes. Vers le haut, elles ont déjà été téléchargées : le navigateur
 * les ressert de son cache, quelques millisecondes. La descente a donc besoin
 * de plus de piste que la remontée.
 *
 * HERO_GUARD, elle, ne garde rien en mémoire : elle dit seulement si le
 * carrousel est à l'écran. Aucune anticipation nécessaire.
 */
export const POSTER_GUARD = createViewportGuard("1400px 0px 2000px 0px");
export const HERO_GUARD = createViewportGuard("0px");

/**
 * Proximité d'un nœud à l'écran, par référence de rappel.
 *
 * Comme pour la sentinelle du défilement infini, un `useEffect` ne conviendrait
 * pas : le nœud n'existe pas encore au premier rendu. La référence de rappel,
 * elle, est appelée exactement quand il entre dans le document et quand il en
 * sort.
 *
 * L'état part à FAUX. À vrai, les soixante cartes du montage réclameraient leur
 * affiche d'un seul coup, les visibles derrière les invisibles dans une file de
 * six connexions — pire que de ne rien faire. Le fondu d'entrée de la carte
 * couvre gratuitement l'image d'écart avant le premier verdict.
 */
export function useNearViewport(guard: ViewportGuard): [boolean, (node: Element | null) => void] {
  const [near, setNear] = useState(false);
  const attached = useRef<Element | null>(null);

  const attach = useCallback((node: Element | null) => {
    if (attached.current) guard.release(attached.current);
    attached.current = node;
    // `setNear` est stable, donc la garde ne réenregistre jamais au re-rendu.
    if (node) guard.observe(node, setNear);
  }, [guard]);

  useEffect(() => () => {
    if (attached.current) {
      guard.release(attached.current);
      attached.current = null;
    }
  }, [guard]);

  return [near, attach];
}

/*
 * Le plugin vit dans un cadre isolé : aucun outil extérieur ne peut compter ses
 * images, et `performance.memory` ignore précisément ce qui pèse — les bitmaps
 * décodés vivent hors du tas JavaScript. Sans ce relevé, on ne peut pas
 * vérifier que le plafond tient. À lire dans la console après avoir choisi le
 * contexte du cadre dans le sélecteur de DevTools.
 */
(window as unknown as Record<string, unknown>).__vigieMemoire = () => {
  const active = Array.from(document.images).filter((img) => img.currentSrc && img.naturalWidth > 0);
  const bytes = active.reduce((sum, img) => sum + img.naturalWidth * img.naturalHeight * 4, 0);
  return {
    ...POSTER_GUARD.stats(),
    activeImages: active.length,
    decodedMB: Math.round((bytes / 1048576) * 10) / 10,
    nodes: document.getElementsByTagName("*").length,
  };
};
