import type { MediaType } from "../api/types";

export interface AvailabilityRef {
  mediaType: MediaType;
  tmdbId: number;
}

export interface AvailabilityChunk {
  /** Rang de la tranche : 0 pour les premiers titres, 1 pour les suivants… */
  index: number;
  /** Signature du contenu — complète la clé de cache. */
  key: string;
  refs: AvailabilityRef[];
}

/**
 * Découpe une liste de titres en tranches de taille FIXE.
 *
 * Tout tient dans cette propriété : une tranche déjà constituée ne change plus
 * quand la liste s'allonge. Le catalogue défile à l'infini et sa liste grandit
 * page après page ; en interrogeant la liste entière, la moindre page chargée
 * produisait une clé de cache neuve, donc une table vide le temps de l'aller-
 * retour — et toutes les pastilles s'éteignaient d'un coup.
 *
 * Découpée, la page suivante n'ajoute qu'une tranche : les précédentes gardent
 * leur clé, leur cache, et leurs pastilles.
 *
 * La taille est aussi un plafond : elle tient sous ce que le serveur accepte
 * par appel, donc plus rien n'est écarté en silence en fin de liste.
 */
export const CHUNK_SIZE = 60;

export function availabilityChunks(refs: readonly AvailabilityRef[]): AvailabilityChunk[] {
  const chunks: AvailabilityChunk[] = [];

  for (let start = 0; start < refs.length; start += CHUNK_SIZE) {
    const slice = refs.slice(start, start + CHUNK_SIZE);
    chunks.push({
      index: start / CHUNK_SIZE,
      key: slice.map((r) => `${r.mediaType}${r.tmdbId}`).join(","),
      refs: slice,
    });
  }

  return chunks;
}
