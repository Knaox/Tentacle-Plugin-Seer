/* ------------------------------------------------------------------ */
/*  Seer Plugin — Worker: cleanup queue (suppression via Jellyseerr)   */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import {
  getPendingCleanups, updateCleanupJob,
  clearPendingCleanup, deleteRequestById, updateRequestStatus,
} from "./db";
import type { WorkerConfig } from "./worker-sync";

export async function processCleanupQueue(prisma: PrismaClient, config: WorkerConfig): Promise<void> {
  const jobs = await getPendingCleanups(prisma);
  if (jobs.length === 0) return;

  const job = jobs[0];
  const headers = { "X-Api-Key": config.seerrApiKey };

  try {
    // === ÉTAPE 1 : Supprimer de Sonarr/Radarr via Jellyseerr ===
    // L'endpoint /media/{id}/file appelle Sonarr/Radarr pour nous
    if (job.seerrMediaId) {
      const fileRes = await fetch(
        `${config.seerrUrl}/api/v1/media/${job.seerrMediaId}/file?is4k=false`,
        { method: "DELETE", headers, signal: AbortSignal.timeout(30_000) },
      );

      if (!fileRes.ok && fileRes.status !== 404) {
        const body = await fileRes.text().catch(() => "");
        throw new Error(`Jellyseerr /media/file returned ${fileRes.status}: ${body.slice(0, 200)}`);
      }

      console.log(`[SeerWorker] Deleted files via Jellyseerr for "${job.title}" (status=${fileRes.status})`);
    }

    // === ÉTAPE 2 : Supprimer le media de Jellyseerr (cascade les requests) ===
    if (job.seerrMediaId) {
      const mediaRes = await fetch(
        `${config.seerrUrl}/api/v1/media/${job.seerrMediaId}`,
        { method: "DELETE", headers, signal: AbortSignal.timeout(15_000) },
      );

      if (!mediaRes.ok && mediaRes.status !== 404) {
        console.warn(`[SeerWorker] Seerr media delete returned ${mediaRes.status} for "${job.title}"`);
      }
    }

    // === ÉTAPE 3 : Supprimer la request Seerr (au cas où pas cascade) ===
    if (job.seerrRequestId) {
      await fetch(
        `${config.seerrUrl}/api/v1/request/${job.seerrRequestId}`,
        { method: "DELETE", headers, signal: AbortSignal.timeout(10_000) },
      ).catch(() => {});
    }

    // === ÉTAPE 4 : Cleanup local ===
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
