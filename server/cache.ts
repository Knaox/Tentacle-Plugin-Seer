/* ------------------------------------------------------------------ */
/*  Seer Plugin — In-memory TTL cache                                  */
/* ------------------------------------------------------------------ */

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Get-or-compute avec TTL et dédoublonnage des requêtes simultanées.
 * - Sert la valeur cachée si elle est encore fraîche.
 * - Sinon appelle `loader` et stocke le résultat.
 * - Si plusieurs callers demandent la même clé en même temps, un seul `loader` est appelé.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    return hit.value as T;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = (async () => {
    try {
      const value = await loader();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Invalide une clé exacte ou toutes les clés correspondant à un préfixe. */
export function invalidate(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key === prefix || key.startsWith(prefix + ":")) {
      store.delete(key);
    }
  }
}

/** Nettoyage périodique des entrées expirées (évite la fuite mémoire). */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expires <= now) store.delete(key);
  }
}, 60_000).unref?.();
