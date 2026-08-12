/* ------------------------------------------------------------------ */
/*  Seer Plugin — Exécution concurrente bornée                         */
/* ------------------------------------------------------------------ */

/**
 * Pool de N workers tirant dans un curseur partagé — PAS un découpage en lots.
 *
 * La différence compte : avec des lots de 8, un appel qui met 8 s (timeout
 * Jellyseerr) immobilise les 7 autres emplacements du lot jusqu'à son échéance.
 * Le pool relance immédiatement dès qu'un emplacement se libère, donc le débit
 * ne s'effondre pas sur une poignée de lenteurs.
 *
 * Jellyseerr est un Node mono-process qui relaie vers TMDB : au-delà de ~8
 * requêtes simultanées il met en file et les latences partent en vrille.
 * DEFAULT_CONCURRENCY = 6 est le point d'équilibre.
 */
export const DEFAULT_CONCURRENCY = 6;

/**
 * Applique `fn` sur `items` avec au plus `limit` exécutions simultanées.
 * L'ordre des résultats suit celui des entrées.
 *
 * Ne rejette JAMAIS : un échec devient `null`. Les appelants veulent une liste
 * partielle affichable, pas un 500 parce qu'une fiche TMDB manquait.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<Array<R | null>> {
  const out: Array<R | null> = new Array(items.length).fill(null);
  if (items.length === 0) return out;

  const workers = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        try {
          out[i] = await fn(items[i], i);
        } catch {
          out[i] = null;
        }
      }
    }),
  );

  return out;
}

/**
 * Variante qui PROPAGE les rejets — pour les cas où un échec doit remonter
 * (écritures, invariants). Comme `mapLimit`, l'ordre est préservé ; en revanche
 * le premier rejet fait échouer l'ensemble.
 */
export async function mapLimitStrict<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  if (items.length === 0) return out;

  const workers = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    }),
  );

  return out;
}

/** Découpe un tableau en tranches de `size` (requêtes SQL bulk, batches HTTP). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
