/* ------------------------------------------------------------------ */
/*  Seer Plugin — Fiches exploitables par le calendrier                */
/* ------------------------------------------------------------------ */

/*
 * Une fiche présente en mémoire n'est pas forcément exploitable, et c'est ce
 * malentendu qui rendait « Toutes les demandes » identique à « À venir ».
 *
 * L'amorçage (`seedTmdbCacheFromLocalRequests`) inscrit les demandes connues
 * avec leur titre et leur affiche, AUCUNE date, et une péremption fixée à
 * l'instant même. Ces lignes comptaient pourtant comme résolues : la lecture
 * groupée accepte les fiches périmées, à dessein, pour afficher un titre un peu
 * vieux plutôt qu'un numéro. Elles ne produisaient donc aucune sortie, personne
 * ne les redemandait, et le calendrier se déclarait complet — muet et satisfait.
 *
 * La péremption distingue les deux cas, et c'est la seule chose qui le fasse.
 * Une fiche réellement récupérée dont TMDB n'annonce aucune date porte une
 * péremption dans le futur : elle est vide parce qu'il n'y a rien à dire, et la
 * redemander à chaque chargement ne donnerait jamais rien de plus. Une fiche
 * seulement amorcée, elle, est périmée d'emblée.
 */

/** Le strict nécessaire d'une fiche TMDB pour ce calcul. */
export interface DatedMeta {
  releaseDate: string | null;
  digitalDate: string | null;
  theatricalDate: string | null;
  physicalDate: string | null;
  nextAirDate: string | null;
  /** ISO. Vide ou illisible = jamais récupérée. */
  expiresAt: string;
}

/** Aucune date : la fiche ne peut annoncer aucune sortie, quelle que soit la période. */
export function isDateless(m: DatedMeta): boolean {
  return !m.releaseDate && !m.digitalDate && !m.theatricalDate
      && !m.physicalDate && !m.nextAirDate;
}

/**
 * Sans date ET périmée : à recharger, et à compter comme incomplète.
 *
 * Les deux conditions comptent. Sans la première, on redemanderait des fiches
 * parfaitement à jour ; sans la seconde, on redemanderait indéfiniment les
 * titres dont TMDB ignore la date de sortie — à chaque ouverture de la page.
 */
export function needsDateRefresh(m: DatedMeta, now = Date.now()): boolean {
  if (!isDateless(m)) return false;
  const expires = Date.parse(m.expiresAt);
  return !Number.isFinite(expires) || expires <= now;
}

/**
 * La fiche est-elle antérieure aux colonnes de tri et de filtre ?
 *
 * Note, langue, genres et « est-ce un animé » sont arrivés après coup. Les
 * fiches déjà en mémoire les portent donc à vide, et le réchauffage périodique
 * met des heures à repasser une grosse instance — pendant lesquelles le filtre
 * « Animés » ne rendrait rien du tout, faute de pouvoir distinguer « ce n'en
 * est pas un » de « on ne sait pas encore ».
 *
 * La langue d'origine sert de témoin : TMDB en donne toujours une, et
 * Jellyseerr la relaie (vérifié). Son absence ne peut donc signifier qu'une
 * chose — la fiche a été écrite avant. On la remet en file, et le remplissage
 * de fond, qui vide TOUTE sa file, s'en charge en quelques minutes.
 */
export function needsTraitsRefresh(m: { originalLanguage?: string | null }): boolean {
  return !m.originalLanguage;
}
