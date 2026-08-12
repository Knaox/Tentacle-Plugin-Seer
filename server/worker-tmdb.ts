/* ------------------------------------------------------------------ */
/*  Seer Plugin — Réchauffage de la mémoire des fiches TMDB            */
/* ------------------------------------------------------------------ */

/*
 * Le remplissage se fait en tâche de fond, jamais sur le chemin d'une requête
 * utilisateur. Budget volontairement bas : 40 fiches toutes les 5 minutes, soit
 * ~480 par heure — de quoi remplir une instance de plusieurs centaines de
 * demandes en moins d'une heure après l'installation, sans jamais peser sur
 * Jellyseerr ni sur l'affichage.
 */

import type { PrismaClient } from "@prisma/client";
import {
  listStaleTmdbRefs, upsertTmdbMetaBulk, pruneTmdbCache,
  seedTmdbCacheFromLocalRequests, type TmdbMeta,
} from "./tmdb-cache";
import { fetchTmdbMeta } from "./tmdb-fetch";
import { DEFAULT_REGION } from "./tmdb-resolver";
import type { WorkerCfg } from "./seerr-unified";
import { mapLimit } from "./concurrency";

const WARM_BUDGET = 40;
const WARM_CONCURRENCY = 4;
const PRUNE_AFTER_DAYS = 180;

let lastPruneDay = "";
let seeded = false;

/** Amorçage unique : reprend titres et affiches déjà présents en base. */
export async function seedTmdbCacheOnce(prisma: PrismaClient): Promise<void> {
  if (seeded) return;
  seeded = true;
  try {
    const n = await seedTmdbCacheFromLocalRequests(prisma);
    if (n > 0) console.log(`[SeerTmdb] Seeded ${n} fiches depuis les demandes locales`);
  } catch (err) {
    console.warn("[SeerTmdb] Seed échoué", err);
  }
}

export async function warmTmdbCache(
  prisma: PrismaClient,
  cfg: WorkerCfg,
  opts: { budget?: number; region?: string } = {},
): Promise<{ fetched: number; remaining: number }> {
  const budget = opts.budget ?? WARM_BUDGET;
  const region = opts.region ?? DEFAULT_REGION;

  const refs = await listStaleTmdbRefs(prisma, budget);
  if (refs.length === 0) {
    await pruneOncePerDay(prisma);
    return { fetched: 0, remaining: 0 };
  }

  const fetched = await mapLimit(refs, WARM_CONCURRENCY, (ref) => fetchTmdbMeta(cfg, ref, region));
  const ok = fetched.filter((m): m is TmdbMeta => m !== null);
  if (ok.length > 0) await upsertTmdbMetaBulk(prisma, ok);

  await pruneOncePerDay(prisma);
  return { fetched: ok.length, remaining: Math.max(0, refs.length - ok.length) };
}

async function pruneOncePerDay(prisma: PrismaClient): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (lastPruneDay === today) return;
  lastPruneDay = today;
  try {
    const n = await pruneTmdbCache(prisma, PRUNE_AFTER_DAYS);
    if (n > 0) console.log(`[SeerTmdb] Purge de ${n} fiches inutilisées`);
  } catch { /* best-effort */ }
}
