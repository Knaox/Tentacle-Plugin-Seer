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

/** Ce que l'utilisateur coche. Trois choix, pas les quatre canaux internes. */
export type ChannelChoice = "theatrical" | "streaming" | "physical";

/**
 * Ce que chaque choix recouvre réellement.
 *
 * « En streaming » en couvre DEUX, et c'est tout sauf un détail : une série n'a
 * jamais de dates typées — elles ne se calculent que pour les films — donc
 * `digital` ne la décrit jamais. Le seul canal qu'une série puisse porter est
 * `streaming`, celui qui dit « c'est sur une plateforme en ce moment ».
 * Ne retenir que `digital` masquait donc TOUTES les séries et tous les animés
 * dès qu'on cochait quoi que ce soit.
 *
 * Les deux portent de toute façon le même libellé à l'écran : pour qui regarde,
 * « sorti en streaming » et « disponible en streaming » sont la même chose.
 */
const COUVRE: Record<ChannelChoice, readonly ChannelId[]> = {
  theatrical: ["theatrical"],
  streaming: ["digital", "streaming"],
  physical: ["physical"],
};

export function matchesChannels(
  verdict: AvailabilityVerdict | undefined,
  wanted: readonly ChannelChoice[],
): boolean {
  if (wanted.length === 0) return true;
  if (!verdict) return true;

  const acceptes = new Set<ChannelId>();
  for (const choix of wanted) for (const id of COUVRE[choix]) acceptes.add(id);

  return verdict.channels.some((c) => acceptes.has(c.id));
}
