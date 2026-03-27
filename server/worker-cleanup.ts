/* ------------------------------------------------------------------ */
/*  Seer Plugin — Worker: cleanup queue (Sonarr/Radarr deletions)      */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import {
  getPendingCleanups, updateCleanupJob,
  clearPendingCleanup, deleteRequestById, updateRequestStatus,
} from "./db";
import {
  getArrServerConfig, getMediaExternalId,
  deleteSonarrSeries, deleteRadarrMovie, deleteSeerrMedia,
} from "./arr-service";
import type { WorkerConfig } from "./worker-sync";

export async function processCleanupQueue(prisma: PrismaClient, config: WorkerConfig): Promise<void> {
  const jobs = await getPendingCleanups(prisma);
  if (jobs.length === 0) return;

  const job = jobs[0];
  try {
    // === ÉTAPE 1 : Supprimer de Sonarr/Radarr EN PREMIER ===
    let arrSuccess = false;

    const ext = await getMediaExternalId(config.seerrUrl, config.seerrApiKey, job.mediaType, job.tmdbId);
    if (ext) {
      const arrType = job.mediaType === "movie" ? "radarr" : "sonarr";
      const server = await getArrServerConfig(config.seerrUrl, config.seerrApiKey, arrType);
      if (server) {
        arrSuccess = job.mediaType === "movie"
          ? await deleteRadarrMovie(server, ext.externalServiceId, job.deleteFiles)
          : await deleteSonarrSeries(server, ext.externalServiceId, job.deleteFiles);
        console.log(`[SeerWorker] ${arrType} delete for "${job.title}": ${arrSuccess ? "OK" : "FAILED"}`);
      } else {
        // Pas de config serveur → on ne peut pas supprimer, considérer comme OK
        console.warn(`[SeerWorker] No ${arrType} server config found, skipping arr delete`);
        arrSuccess = true;
      }
    } else {
      // Pas d'ID externe = pas dans Sonarr/Radarr
      arrSuccess = true;
    }

    // === STOP si Sonarr/Radarr a échoué — on ne touche PAS à Seerr ===
    if (!arrSuccess) {
      throw new Error("Sonarr/Radarr deletion failed — Seerr untouched");
    }

    // === ÉTAPE 2 : Sonarr/Radarr OK → Supprimer le média Seerr ===
    if (job.seerrMediaId) {
      const seerrOk = await deleteSeerrMedia(config.seerrUrl, config.seerrApiKey, job.seerrMediaId);
      if (!seerrOk) {
        console.warn(`[SeerWorker] Seerr media delete failed for "${job.title}" but arr is clean — continuing`);
      }
    }

    // === ÉTAPE 3 : Supprimer la request Seerr ===
    if (job.seerrRequestId) {
      await fetch(`${config.seerrUrl}/api/v1/request/${job.seerrRequestId}`, {
        method: "DELETE",
        headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    }

    // === ÉTAPE 4 : Tout OK → supprimer la demande locale ===
    await updateCleanupJob(prisma, job.id, "completed");

    if (job.requestId) {
      await deleteRequestById(prisma, job.requestId);
      console.log(`[SeerWorker] Deleted local request ${job.requestId}`);
    }

    await clearPendingCleanup(prisma, job.id);
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
