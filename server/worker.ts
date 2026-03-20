/* ------------------------------------------------------------------ */
/*  Seer Plugin — Background queue worker                              */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import {
  getNextQueued,
  updateRequestStatus,
  getRequestsToSync,
  getRequestById,
  getPendingCleanups,
  updateCleanupJob,
} from "./db";
import {
  getArrServerConfig,
  getMediaExternalId,
  deleteSonarrSeries,
  deleteRadarrMovie,
  deleteSeerrMedia,
} from "./arr-service";
import type { SeerRequest } from "./types";
import { fetchMediaDetail, isAnimeFromKeywords, fetchAnimeOverrides } from "./anime";

interface WorkerConfig {
  /** Seerr base URL */
  seerrUrl: string;
  /** Seerr API key */
  seerrApiKey: string;
  /** Poll interval in ms (default: 60000) */
  interval: number;
  /** Sync interval multiplier (default: 5 — every 5th cycle) */
  syncEvery: number;
}

let timer: ReturnType<typeof setInterval> | null = null;
let cycleCount = 0;

export function startWorker(
  prisma: PrismaClient,
  getConfig: () => Promise<WorkerConfig | null>,
): void {
  if (timer) return;

  async function tick() {
    const config = await getConfig();
    if (!config || !config.seerrUrl || !config.seerrApiKey) return;

    cycleCount++;

    // Process one queued request
    try {
      await processNextRequest(prisma, config);
    } catch (err) {
      console.error("[SeerWorker] Error processing request:", err);
    }

    // Sync statuses with Seerr every N cycles
    if (cycleCount % config.syncEvery === 0) {
      try {
        await syncStatuses(prisma, config);
      } catch (err) {
        console.error("[SeerWorker] Error syncing statuses:", err);
      }
    }

    // Auto-retry failed requests that haven't reached max retries
    try {
      await retryFailedRequests(prisma);
    } catch (err) {
      console.error("[SeerWorker] Error retrying failed requests:", err);
    }

    // Process cleanup queue (Sonarr/Radarr deletions with retry)
    try {
      await processCleanupQueue(prisma, config);
    } catch (err) {
      console.error("[SeerWorker] Error processing cleanup queue:", err);
    }
  }

  // Initial tick after 5s, then every interval
  setTimeout(tick, 5000);
  timer = setInterval(async () => {
    const config = await getConfig();
    tick();
    // Re-check interval (config may have changed) — we keep a fixed 60s for simplicity
  }, 60_000);

  console.log("[SeerWorker] Started");
}

export function stopWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[SeerWorker] Stopped");
  }
}

export function isWorkerRunning(): boolean {
  return timer !== null;
}

/* ── Process next queued request ───────────────────────────────────── */

async function processNextRequest(prisma: PrismaClient, config: WorkerConfig): Promise<void> {
  const request = await getNextQueued(prisma);
  if (!request) return;

  // Double-check it still exists and is queued
  const fresh = await getRequestById(prisma, request.id);
  if (!fresh || (fresh.status !== "queued" && fresh.status !== "retry_pending")) return;

  // Mark as processing
  await updateRequestStatus(prisma, request.id, "processing");

  try {
    // Build Seerr request body
    const seerrBody: Record<string, unknown> = {
      mediaType: request.mediaType,
      mediaId: request.tmdbId,
    };
    if (request.mediaType === "tv" && request.seasons) {
      seerrBody.seasons = request.seasons.map(Number);
    }

    // Fetch media detail for anime detection + declined request cleanup
    const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, request.mediaType, request.tmdbId);

    // Clean up declined/failed requests on Seerr before sending a new one
    if (detail?.mediaInfo?.requests) {
      for (const r of detail.mediaInfo.requests) {
        if (r.status === 3 || r.status === 4) {
          await fetch(`${config.seerrUrl}/api/v1/request/${r.id}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(10_000),
          }).catch(() => {});
          console.log(`[SeerWorker] Deleted failed Seerr request #${r.id} (status=${r.status}) for "${request.title}" before retry`);
        }
      }
    }

    // Aussi supprimer le media Seerr si il existe (permet de repartir proprement)
    if (detail?.mediaInfo?.id) {
      await fetch(`${config.seerrUrl}/api/v1/media/${detail.mediaInfo.id}`, {
        method: "DELETE",
        headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    }

    // Anime detection — apply Sonarr anime overrides for TV anime
    if (request.mediaType === "tv" && detail && isAnimeFromKeywords(detail)) {
      const overrides = await fetchAnimeOverrides(config.seerrUrl, config.seerrApiKey);
      if (overrides) {
        Object.assign(seerrBody, {
          profileId: overrides.profileId,
          rootFolder: overrides.rootFolder,
          tags: overrides.tags,
        });
        if (overrides.languageProfileId) {
          seerrBody.languageProfileId = overrides.languageProfileId;
        }
        console.log(`[SeerWorker] Anime detected for "${request.title}", applying overrides`);
      }
    }

    // Send to Seerr
    const res = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.seerrApiKey,
      },
      body: JSON.stringify(seerrBody),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Seerr returned ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      id: number;
      media?: { id: number; status: number };
    };

    // Success — update request
    await updateRequestStatus(prisma, request.id, "sent_to_seer", {
      seerrRequestId: data.id,
      seerrMediaId: data.media?.id,
      seerrMediaStatus: data.media?.status,
      sentAt: new Date(),
    });

    // Push notification into Tentacle's built-in notification system
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId,
        type: "request_status",
        title: request.title,
        body: `Votre demande pour « ${request.title} » a été envoyée à Seerr`,
        refId: request.id,
      },
    });

    console.log(`[SeerWorker] Sent request for "${request.title}" (seerr #${data.id})`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const newRetryCount = request.retryCount + 1;

    if (newRetryCount >= request.maxRetries) {
      // Max retries reached — mark as failed
      await updateRequestStatus(prisma, request.id, "failed", {
        lastError: errMsg,
        retryCount: newRetryCount,
      });
      await prisma.notification.create({
        data: {
          jellyfinUserId: request.jellyfinUserId,
          type: "request_status",
          title: request.title,
          body: `Votre demande pour « ${request.title} » a échoué après ${newRetryCount} tentatives`,
          refId: request.id,
        },
      });
      console.warn(`[SeerWorker] Request for "${request.title}" FAILED after ${newRetryCount} retries: ${errMsg}`);
    } else {
      // Retry later
      await updateRequestStatus(prisma, request.id, "retry_pending", {
        lastError: errMsg,
        retryCount: newRetryCount,
      });
      console.warn(`[SeerWorker] Request for "${request.title}" retry ${newRetryCount}/${request.maxRetries}: ${errMsg}`);
    }
  }
}

/* ── Sync statuses with Seerr ──────────────────────────────────────── */

async function syncStatuses(prisma: PrismaClient, config: WorkerConfig): Promise<void> {
  const requests = await getRequestsToSync(prisma);
  if (requests.length === 0) return;

  for (const request of requests) {
    if (!request.seerrRequestId) continue;

    try {
      const res = await fetch(
        `${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`,
        {
          headers: { "X-Api-Key": config.seerrApiKey },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        if (res.status === 404) {
          // Request was deleted on Seerr side
          await updateRequestStatus(prisma, request.id, "failed", {
            lastError: "Request no longer exists on Seerr",
          });
        }
        continue;
      }

      const data = (await res.json()) as {
        id: number;
        status: number;
        media?: {
          id: number;
          status: number;
          downloadStatus?: Array<{ externalId: number; status: string }>;
          downloadStatus4k?: Array<{ externalId: number; status: string }>;
        };
      };

      const newStatus = mapSeerrStatus(data.status, data.media?.status, data.media?.downloadStatus);
      const oldStatus = request.status;

      if (newStatus !== oldStatus) {
        // Auto-retry declined requests instead of marking as permanently failed
        if (newStatus === "failed" && request.seerrRequestId) {
          const retryN = request.retryCount + 1;

          if (retryN < request.maxRetries) {
            // Delete declined/failed request on Seerr
            await fetch(`${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`, {
              method: "DELETE",
              headers: { "X-Api-Key": config.seerrApiKey },
              signal: AbortSignal.timeout(10_000),
            }).catch(() => {});

            // Supprimer aussi le media Seerr pour reset complet (permet re-demande)
            if (request.seerrMediaId) {
              await fetch(`${config.seerrUrl}/api/v1/media/${request.seerrMediaId}`, {
                method: "DELETE",
                headers: { "X-Api-Key": config.seerrApiKey },
                signal: AbortSignal.timeout(10_000),
              }).catch(() => {});
            }

            // Reset for retry (clear seerr fields so it re-enters the queue)
            await prisma.$executeRawUnsafe(
              `UPDATE seer_requests SET status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
              retryN,
              request.id,
            );

            await prisma.notification.create({
              data: {
                jellyfinUserId: request.jellyfinUserId,
                type: "request_status",
                title: request.title,
                body: `Nouvelle tentative automatique pour « ${request.title} » (${retryN}/${request.maxRetries})`,
                refId: request.id,
              },
            });
            console.log(`[SeerWorker] Auto-retry "${request.title}" (attempt ${retryN}/${request.maxRetries})`);
            continue;
          }

          // Max retries exceeded — permanent failure
          await updateRequestStatus(prisma, request.id, "failed", {
            seerrMediaStatus: data.media?.status,
            retryCount: retryN,
          } as any);
          await prisma.notification.create({
            data: {
              jellyfinUserId: request.jellyfinUserId,
              type: "request_status",
              title: request.title,
              body: `Échec définitif pour « ${request.title} » après ${request.maxRetries} tentatives`,
              refId: request.id,
            },
          });
          console.log(`[SeerWorker] "${request.title}" PERMANENTLY FAILED after ${request.maxRetries} retries`);
          continue;
        }

        const extra: Record<string, unknown> = {
          seerrMediaStatus: data.media?.status,
        };

        if (newStatus === "available") {
          extra.completedAt = new Date();
        }

        await updateRequestStatus(prisma, request.id, newStatus, extra as any);

        // Push notification on status change
        const notif = statusNotification(request, newStatus);
        if (notif) {
          await prisma.notification.create({
            data: {
              jellyfinUserId: request.jellyfinUserId,
              type: "request_status",
              title: notif.title,
              body: notif.message,
              refId: request.id,
            },
          });
        }

        console.log(`[SeerWorker] "${request.title}" status: ${oldStatus} → ${newStatus}`);
      }
    } catch (err) {
      console.warn(`[SeerWorker] Failed to sync request #${request.seerrRequestId}:`, err);
    }
  }
}

/* ── Auto-retry failed requests ─────────────────────────────────────── */

async function retryFailedRequests(prisma: PrismaClient): Promise<void> {
  // Trouver les demandes "failed" qui n'ont pas atteint le max de retries
  const failed = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; retry_count: number; max_retries: number }>>(
    `SELECT id, title, retry_count, max_retries FROM seer_requests
     WHERE status = 'failed' AND retry_count < max_retries
     LIMIT 3`,
  );

  for (const req of failed) {
    const newRetry = req.retry_count + 1;
    // Remettre en queue avec seerr fields reset
    await prisma.$executeRawUnsafe(
      `UPDATE seer_requests SET status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
      newRetry,
      req.id,
    );
    console.log(`[SeerWorker] Auto-retry "${req.title}" (attempt ${newRetry}/${req.max_retries})`);
  }
}

/* ── Process cleanup queue (Sonarr/Radarr with retry) ──────────────── */

async function processCleanupQueue(prisma: PrismaClient, config: WorkerConfig): Promise<void> {
  const jobs = await getPendingCleanups(prisma);
  if (jobs.length === 0) return;

  for (const job of jobs) {
    try {
      let arrSuccess = false;
      let seerrSuccess = false;

      // 1. Supprimer de Sonarr/Radarr
      const ext = await getMediaExternalId(config.seerrUrl, config.seerrApiKey, job.mediaType, job.tmdbId);
      if (ext) {
        const arrType = job.mediaType === "movie" ? "radarr" : "sonarr";
        const server = await getArrServerConfig(config.seerrUrl, config.seerrApiKey, arrType);
        if (server) {
          arrSuccess = job.mediaType === "movie"
            ? await deleteRadarrMovie(server, ext.externalServiceId, job.deleteFiles)
            : await deleteSonarrSeries(server, ext.externalServiceId, job.deleteFiles);
        }
      } else {
        // Pas d'ID externe = pas dans Sonarr/Radarr, considérer comme succès
        arrSuccess = true;
      }

      // 2. Supprimer le média Seerr
      if (job.seerrMediaId) {
        seerrSuccess = await deleteSeerrMedia(config.seerrUrl, config.seerrApiKey, job.seerrMediaId);
      } else {
        seerrSuccess = true;
      }

      // 3. Supprimer la request Seerr
      if (job.seerrRequestId) {
        await fetch(`${config.seerrUrl}/api/v1/request/${job.seerrRequestId}`, {
          method: "DELETE",
          headers: { "X-Api-Key": config.seerrApiKey },
          signal: AbortSignal.timeout(10_000),
        }).catch(() => {});
      }

      if (arrSuccess && seerrSuccess) {
        await updateCleanupJob(prisma, job.id, "completed");
        console.log(`[SeerWorker] Cleanup completed for "${job.title}"`);
      } else {
        throw new Error(`arr=${arrSuccess} seerr=${seerrSuccess}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      const newRetry = job.retryCount + 1;

      if (newRetry >= job.maxRetries) {
        await updateCleanupJob(prisma, job.id, "failed", { lastError: errMsg, retryCount: newRetry });
        console.warn(`[SeerWorker] Cleanup FAILED permanently for "${job.title}" after ${newRetry} retries`);
      } else {
        // Retry avec backoff exponentiel (30s, 1m, 2m, 4m, 8m, max 30m)
        const delaySec = Math.min(30 * Math.pow(2, newRetry - 1), 1800);
        const nextRetry = new Date(Date.now() + delaySec * 1000);
        await updateCleanupJob(prisma, job.id, "pending", {
          lastError: errMsg,
          retryCount: newRetry,
          nextRetryAt: nextRetry,
        });
        console.log(`[SeerWorker] Cleanup retry ${newRetry}/${job.maxRetries} for "${job.title}" in ${delaySec}s`);
      }
    }
  }
}

function mapSeerrStatus(
  requestStatus: number,
  mediaStatus?: number,
  downloadStatus?: Array<{ status: string }>,
): SeerRequest["status"] {
  // Seerr request status: 1=pending, 2=approved, 3=declined, 4=failed
  // Seerr media status: 1=unknown, 2=pending, 3=processing, 4=partially available, 5=available
  if (requestStatus === 3) return "failed"; // declined
  if (requestStatus === 4) return "failed"; // failed (Jellyseerr internal failure)

  // Vérifier les échecs de téléchargement quel que soit le requestStatus
  if (downloadStatus?.some((d) => d.status === "failed" || d.status === "warning")) {
    return "failed";
  }

  if (requestStatus === 1) {
    if (mediaStatus === 5) return "available";
    if (mediaStatus === 3 || mediaStatus === 4) return "downloading";
    return "sent_to_seer";
  }

  // requestStatus === 2 (approved)
  if (mediaStatus === 5) return "available";
  if (mediaStatus === 3 || mediaStatus === 4) return "downloading";
  return "approved";
}

function statusNotification(
  request: SeerRequest,
  newStatus: string,
): { type: string; title: string; message: string } | null {
  switch (newStatus) {
    case "approved":
      return {
        type: "request_approved",
        title: request.title,
        message: `Votre demande pour « ${request.title} » a été approuvée`,
      };
    case "downloading":
      return {
        type: "request_downloading",
        title: request.title,
        message: `« ${request.title} » est en cours de téléchargement`,
      };
    case "available":
      return {
        type: "request_available",
        title: request.title,
        message: `« ${request.title} » est maintenant disponible !`,
      };
    case "failed":
      return {
        type: "request_declined",
        title: request.title,
        message: `Votre demande pour « ${request.title} » a été refusée`,
      };
    default:
      return null;
  }
}
