/* ------------------------------------------------------------------ */
/*  Seer Plugin — Worker: cleanup queue (suppression via Jellyseerr)   */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import {
  getPendingCleanups, updateCleanupJob,
  clearPendingCleanup, deleteRequestById, updateRequestStatus,
} from "./db";
import {
  getArrServerConfig, getMediaExternalId,
  unmonitorSonarrSeasons, deleteSonarrSeasonFiles, cancelSonarrQueue,
  unmonitorRadarrMovie, deleteRadarrMovieFile, cancelRadarrQueue,
  triggerSeerrJob,
} from "./arr-service";
import { reconcileSeerrSeasons } from "./seerr-reconcile";
import { invalidate } from "./cache";
import type { WorkerConfig } from "./worker-sync";

export async function processCleanupQueue(prisma: PrismaClient, config: WorkerConfig): Promise<void> {
  const jobs = await getPendingCleanups(prisma);
  if (jobs.length === 0) return;

  const job = jobs[0];
  const headers = { "X-Api-Key": config.seerrApiKey };

  try {
    // === ÉTAPES *arr : on ne retire JAMAIS la série/le film de Sonarr/Radarr. ===
    // On agit en direct sur *arr : annuler la file → désactiver la surveillance
    // (toujours, empêche le re-téléchargement) → supprimer les fichiers (si demandé).
    // Best-effort : si le média n'a jamais été grabé (pas d'externalServiceId) ou
    // si *arr est injoignable, on saute proprement sans bloquer le reste.
    const arrType = job.mediaType === "movie" ? "radarr" : "sonarr";
    const [server, ext] = await Promise.all([
      getArrServerConfig(config.seerrUrl, config.seerrApiKey, arrType),
      getMediaExternalId(config.seerrUrl, config.seerrApiKey, job.mediaType, job.tmdbId),
    ]);

    if (server && ext?.externalServiceId) {
      const arrId = ext.externalServiceId;
      if (job.mediaType === "movie") {
        await cancelRadarrQueue(server, arrId);
        const unmon = await unmonitorRadarrMovie(server, arrId);
        if (!unmon) throw new Error("Radarr unmonitor failed");
        if (job.deleteFiles) {
          const del = await deleteRadarrMovieFile(server, arrId);
          if (!del) throw new Error("Radarr delete file failed");
        }
      } else {
        await cancelSonarrQueue(server, arrId, job.seasons);
        const unmon = await unmonitorSonarrSeasons(server, arrId, job.seasons);
        if (!unmon) throw new Error("Sonarr unmonitor failed");
        if (job.deleteFiles) {
          const del = await deleteSonarrSeasonFiles(server, arrId, job.seasons);
          if (!del) throw new Error("Sonarr delete season files failed");
        }
      }
      console.log(
        `[SeerWorker] *arr cleanup for "${job.title}" (${arrType} #${arrId}, ` +
        `seasons=${job.seasons ? JSON.stringify(job.seasons) : "all"}, deleteFiles=${job.deleteFiles})`,
      );
    } else {
      console.log(`[SeerWorker] "${job.title}" : pas de cible *arr (jamais grabé) — skip ops *arr`);
    }

    // === Supprimer la demande Jellyseerr (obligatoire — retry si échec). ===
    // On ne touche PAS au média Jellyseerr (pas de removeSeries/deleteMovie ni
    // /media/file) : la disponibilité se re-synchronise seule côté Jellyseerr.
    // 404 = déjà supprimée → OK. Tout autre échec → throw pour relancer le job
    // (les ops *arr sont idempotentes), afin de ne jamais laisser une demande
    // orpheline dans Jellyseerr.
    if (job.seerrRequestId) {
      const delRes = await fetch(
        `${config.seerrUrl}/api/v1/request/${job.seerrRequestId}`,
        { method: "DELETE", headers, signal: AbortSignal.timeout(10_000) },
      );
      if (!delRes.ok && delRes.status !== 404) {
        throw new Error(`Jellyseerr request delete returned ${delRes.status}`);
      }
    }

    // === Réconciliation des saisons côté Jellyseerr (TV ciblée). ===
    // Les fichiers/la surveillance des saisons retirées viennent d'être coupés
    // pour tout le serveur ; on retire donc ces saisons de TOUTES les demandes
    // Jellyseerr qui les couvrent (PUT saisons restantes, ou DELETE si vide).
    // Sans cela, une suppression partielle (ex. S2 sur S1+S2) laissait S2
    // « demandée » pour toujours dans Jellyseerr.
    if (job.mediaType === "tv" && job.seasons && job.seasons.length > 0) {
      await reconcileSeerrSeasons(prisma, config, job.tmdbId, job.seasons);
    }

    // === Cleanup local ===
    await updateCleanupJob(prisma, job.id, "completed");

    if (job.requestId) {
      await deleteRequestById(prisma, job.requestId);
      console.log(`[SeerWorker] Deleted local request ${job.requestId}`);
    }

    await clearPendingCleanup(prisma, job.id);

    // Si on a supprimé des fichiers, on relance la réconciliation de disponibilité
    // Jellyseerr (par saison) au lieu d'attendre l'exécution planifiée. Best-effort.
    // NB : Jellyseerr ne basculera la saison en « indisponible » qu'une fois que
    // Jellyfin ne voit plus les épisodes (rescan déclenché par Sonarr→Jellyfin
    // « Connect », ou scan planifié Jellyfin).
    if (job.deleteFiles) {
      await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
    }

    // Les listes fusionnées (cache 60s par user) doivent refléter la suppression
    // sans attendre l'expiration du TTL.
    invalidate("seer-cache");

    console.log(`[SeerWorker] Cleanup completed for "${job.title}"`);

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const newRetry = job.retryCount + 1;

    if (newRetry >= job.maxRetries) {
      await updateCleanupJob(prisma, job.id, "failed", { lastError: errMsg, retryCount: newRetry });

      if (job.requestId) {
        await updateRequestStatus(prisma, job.requestId, "delete_failed", {
          lastError: `Échec suppression: ${errMsg}`,
        });
      }

      await clearPendingCleanup(prisma, job.id);
      console.warn(`[SeerWorker] Cleanup FAILED permanently for "${job.title}" after ${newRetry} retries`);
    } else {
      const delaySec = Math.min(30 * Math.pow(2, newRetry - 1), 1800);
      const nextRetry = new Date(Date.now() + delaySec * 1000);
      await updateCleanupJob(prisma, job.id, "pending", {
        lastError: errMsg, retryCount: newRetry, nextRetryAt: nextRetry,
      });
      console.log(`[SeerWorker] Cleanup retry ${newRetry}/${job.maxRetries} for "${job.title}" in ${delaySec}s`);
    }
  }
}
