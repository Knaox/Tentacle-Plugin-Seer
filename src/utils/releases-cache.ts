import type { CalendarResponse } from "../api/types-releases";

/*
 * Dernière réponse du calendrier global, par région.
 *
 * Le plugin vit dans une iframe détruite à chaque navigation : son cache de
 * requêtes meurt avec elle, et revenir sur la page repayait un squelette même
 * quand le serveur avait tout sous la main. Ce fichier est le seul cache qui
 * survive — servi en placeholder au montage, revalidé aussitôt derrière.
 *
 * Le calendrier PERSONNEL n'est jamais persisté : donnée par utilisateur, sur
 * un stockage partagé par tous les comptes du navigateur.
 */

const KEY_PREFIX = "seer_releases_global_v1_";
const MAX_AGE_MS = 7 * 24 * 3_600_000;
/** Au-delà, on renonce : le quota localStorage se partage avec tout l'hôte. */
const MAX_BYTES = 1_500_000;

interface Persisted {
  savedAt: number;
  res: CalendarResponse;
}

export function readPersistedGlobal(region: string): CalendarResponse | undefined {
  try {
    const brut = localStorage.getItem(KEY_PREFIX + region);
    if (!brut) return undefined;
    const lu = JSON.parse(brut) as Partial<Persisted> | null;
    if (typeof lu?.savedAt !== "number" || !Array.isArray(lu.res?.items)) return undefined;
    if (Date.now() - lu.savedAt > MAX_AGE_MS) return undefined;
    return lu.res as CalendarResponse;
  } catch {
    return undefined;
  }
}

export function persistGlobal(region: string, res: CalendarResponse): void {
  try {
    const payload = JSON.stringify({ savedAt: Date.now(), res } satisfies Persisted);
    if (payload.length > MAX_BYTES) return;
    localStorage.setItem(KEY_PREFIX + region, payload);
  } catch {
    /* stockage plein ou indisponible — le placeholder est un confort, pas un dû */
  }
}
