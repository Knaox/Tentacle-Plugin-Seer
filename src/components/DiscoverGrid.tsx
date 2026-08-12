import { memo, type RefObject } from "react";
import type { SeerrSearchResult } from "../api/types";
import type { AvailabilityVerdict } from "../api/types-releases";
import { MediaCard } from "./MediaCard";
import { SkeletonList } from "./SkeletonList";

/**
 * La grille du catalogue, extraite de la page pour la garder sous la limite de
 * trois cents lignes — et pour que le défilement ne re-rende plus tout l'écran.
 *
 * Deux corrections de fluidité vivent ici.
 *
 * L'animation d'entrée, d'abord. Son retard se calculait sur l'index dans la
 * liste CUMULÉE, plafonné à dix-neuf : passé la première page, chaque carte
 * restait donc invisible 950 ms alors que son contenu était déjà là. C'est ce
 * qui donnait l'impression que « les items viennent très lentement » — rien ne
 * chargeait, tout attendait. Le retard suit désormais la position dans la
 * rangée, et s'éteint au bout de quelques dixièmes de seconde.
 *
 * Ensuite, le nombre de squelettes suit la largeur réelle plutôt qu'une
 * constante de vingt : ils animent une boucle infinie pendant le chargement,
 * autant n'en afficher que ce qui se voit.
 */

/*
 * Le retard suit la position dans la RANGÉE, pas dans la liste : la cascade
 * reste lisible, et aucune carte n'attend plus d'un sixième de seconde — quelle
 * que soit la page à laquelle elle appartient.
 */
const ROW = 6;
const STAGGER_STEP_MS = 30;

interface Props {
  items: readonly SeerrSearchResult[];
  availability: Map<string, AvailabilityVerdict>;
  requesting: boolean;
  onRequest: (item: SeerrSearchResult) => void;
  onOpen: (item: SeerrSearchResult) => void;
  /** Sentinelle du défilement infini — absente pendant une recherche. */
  sentinelRef?: RefObject<HTMLDivElement | null>;
  showSkeletons?: boolean;
}

export const DiscoverGrid = memo(function DiscoverGrid({
  items, availability, requesting, onRequest, onOpen, sentinelRef, showSkeletons,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item, i) => (
          <MediaCard
            key={`${item.mediaType}-${item.id}`}
            item={item}
            onRequest={onRequest}
            onClick={onOpen}
            requesting={requesting}
            availability={availability.get(`${item.mediaType}:${item.id}`)}
            delayMs={(i % ROW) * STAGGER_STEP_MS}
          />
        ))}
      </div>

      {sentinelRef && (
        <div ref={sentinelRef} className="pt-4">
          {showSkeletons && <SkeletonList count={6} />}
        </div>
      )}
    </>
  );
});
