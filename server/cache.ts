/* ------------------------------------------------------------------ */
/*  Seer Plugin — In-memory TTL cache (+ stale-while-revalidate)       */
/* ------------------------------------------------------------------ */

interface CacheEntry<T> {
  value: T;
  /** Fin de fraîcheur : au-delà, la valeur est servie mais rafraîchie en fond. */
  expires: number;
  /** Fin de servabilité : au-delà, on attend le loader. `= expires` si staleMs = 0. */
  stale: number;
  /** Dernier échec du rafraîchissement de fond — sert de base au backoff. */
  failedAt?: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/** Un loader qui échoue n'est pas rejoué avant ce délai (Jellyseerr injoignable). */
const REFRESH_BACKOFF_MS = 30_000;

export interface CacheOpts<T = unknown> {
  /**
   * Fenêtre APRÈS expiration pendant laquelle la valeur périmée est servie
   * telle quelle, en déclenchant un rafraîchissement en arrière-plan.
   * 0 (défaut) = comportement historique : on attend le loader.
   */
  staleMs?: number;
  /**
   * Durée de vie décidée d'après la valeur produite, plutôt qu'en aveugle.
   *
   * Une réponse que son producteur annonce incomplète ne mérite pas la même
   * durée qu'une réponse aboutie : le remplissage de fond tourne pendant ce
   * temps-là. La figer quinze minutes — puis six heures de service périmé —
   * transforme une carence d'une minute en défaut de la journée.
   */
  ttlFor?: (value: T) => number;
}

/**
 * Get-or-compute avec TTL, dédoublonnage des appels simultanés et — si
 * `staleMs` est fourni — service de la valeur périmée pendant le
 * rafraîchissement.
 *
 * Sans `staleMs`, l'expiration est une falaise : le premier arrivé après le
 * TTL paie l'intégralité du rechargement pendant que tout le monde attend
 * derrière lui. C'est précisément ce qui rendait la liste des demandes lente
 * une minute sur deux.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  opts?: CacheOpts<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as CacheEntry<T> | undefined;

  if (hit && hit.expires > now) return hit.value;

  // Périmé mais encore servable : réponse immédiate + rafraîchissement en fond.
  if (hit && hit.stale > now) {
    const backoffOver = !hit.failedAt || now - hit.failedAt > REFRESH_BACKOFF_MS;
    if (backoffOver && !inflight.has(key)) {
      void refresh(key, ttlMs, loader, opts).catch(() => {
        /* Impératif : un rejet non capté ici tuerait le process host. */
      });
    }
    return hit.value;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  return refresh(key, ttlMs, loader, opts);
}

function refresh<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  opts?: CacheOpts<T>,
): Promise<T> {
  const p = (async () => {
    try {
      const value = await loader();
      put(key, value, opts?.ttlFor?.(value) ?? ttlMs, opts?.staleMs ?? 0);
      return value;
    } catch (err) {
      // L'entrée périmée n'est PAS effacée : mieux vaut servir vieux que rien.
      // On note l'échec pour ne pas rejouer un loader cassé à chaque requête.
      const prev = store.get(key);
      if (prev) prev.failedAt = Date.now();
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Écriture directe — pour un producteur de fond qui veut publier son résultat. */
export function put<T>(key: string, value: T, ttlMs: number, staleMs = 0): void {
  const expires = Date.now() + ttlMs;
  store.set(key, { value, expires, stale: expires + staleMs });
}

/**
 * Lecture non bloquante. `undefined` si absent.
 * `allowStale` accepte une valeur périmée mais encore servable — utile pour
 * réutiliser des données déjà en main sans déclencher d'appel réseau.
 */
export function peek<T>(key: string, allowStale = false): T | undefined {
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (!hit) return undefined;
  const now = Date.now();
  if (hit.expires > now) return hit.value;
  if (allowStale && hit.stale > now) return hit.value;
  return undefined;
}

/** Invalide une clé exacte ou toutes les clés correspondant à un préfixe. */
export function invalidate(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key === prefix || key.startsWith(prefix + ":")) {
      store.delete(key);
    }
  }
}

/** Nettoyage périodique. Borne = `stale`, sinon on effacerait le servable. */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.stale <= now) store.delete(key);
  }
}, 60_000).unref?.();
