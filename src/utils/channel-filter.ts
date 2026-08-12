import type { AvailabilityVerdict, ChannelId } from "../api/types-releases";

/**
 * Filtrer le catalogue par canal de sortie — salle, streaming, Blu-ray.
 *
 * Ce filtre s'applique CÔTÉ CLIENT, faute d'alternative : Jellyseerr refuse
 * tout paramètre de type de sortie, quel que soit son nom (400 sur
 * `releaseType` comme sur `withReleaseType`, vérifié contre l'instance). La
 * seule source est donc le verdict que notre serveur calcule par tranches,
 * après que la grille est affichée.
 *
 * D'où la règle qui gouverne ce fichier : **un verdict pas encore arrivé
 * n'exclut pas**. Une carte reste visible tant qu'on ignore ses canaux, puis
 * disparaît si elle ne correspond pas. Choisir l'inverse — masquer tant qu'on
 * ne sait pas — viderait l'écran à chaque page chargée, le temps d'un
 * aller-retour, sur une grille qui défile à l'infini.
 */
export function matchesChannels(
  verdict: AvailabilityVerdict | undefined,
  wanted: readonly ChannelId[],
): boolean {
  if (wanted.length === 0) return true;
  if (!verdict) return true;
  return verdict.channels.some((c) => wanted.includes(c.id));
}
