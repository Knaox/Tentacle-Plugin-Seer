/* ------------------------------------------------------------------ */
/*  Seer Plugin — Background queue worker                              */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import {
  getNextQueued,
  updateRequestStatus,
  getRequestsToSync,
  getRequestById,
} from "./db";
import type { SeerRequest } from "./types";

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
        media?: { id: number; status: number };
      };

      const newStatus = mapSeerrStatus(data.status, data.media?.status);
      const oldStatus = request.status;

      if (newStatus !== oldStatus) {
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

function mapSeerrStatus(requestStatus: number, mediaStatus?: number): SeerRequest["status"] {
  // Seerr request status: 1=pending, 2=approved, 3=declined
  // Seerr media status: 1=unknown, 2=pending, 3=processing, 4=partially available, 5=available
  if (requestStatus === 3) return "failed"; // declined
  if (requestStatus === 1) return "sent_to_seer"; // pending — not yet approved
  // From here: requestStatus === 2 (approved)
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
