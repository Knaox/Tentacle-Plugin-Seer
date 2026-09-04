/** Statuts média Jellyseerr (mediaInfo.status et mediaInfo.seasons[].status). */
export const MEDIA_STATUS_DELETED = 7;

/**
 * Une saison compte « demandée » à partir de PENDING (2) — jamais quand
 * Jellyseerr la dit SUPPRIMÉE : ses données ont été retirées, elle est libre
 * et Jellyseerr la laisse redemander.
 */
export function isRequestedSeasonStatus(status: number | undefined): boolean {
  return status !== undefined && status >= 2 && status !== MEDIA_STATUS_DELETED;
}
