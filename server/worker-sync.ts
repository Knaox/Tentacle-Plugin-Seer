/* ------------------------------------------------------------------ */
/*  Seer Plugin — Worker: status sync + auto-retry                     */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import { getRequestsToSync, updateRequestStatus } from "./db";
import { invalidate } from "./cache";
import type { SeerRequest, SeerProfile } from "./types";

export interface WorkerConfig {
  seerrUrl: string;
  seerrApiKey: string;
  interval: number;
  syncEvery: number;
  profiles?: SeerProfile[];
}

/* ── Sync statuses with Seerr ──────────────────────────────────────── */

export async function syncStatuses(prisma: PrismaClient, config: WorkerConfig): Promise<void> {
  const requests = await getRequestsToSync(prisma);
  if (requests.length === 0) return;

  for (const request of requests) {
    if (!request.seerrRequestId) continue;

    try {
      const res = await fetch(
        `${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`,
        { headers: { "X-Api-Key": config.seerrApiKey }, signal: AbortSignal.timeout(10_000) },
      );

      if (!res.ok) {
        if (res.status === 404) {
          await updateRequestStatus(prisma, request.id, "failed", {
            lastError: "Request no longer exists on Seerr",
          });
        }
        continue;
      }

      const data = (await res.json()) as {
        id: number; status: number;
        media?: {
          id: number; status: number;
          downloadStatus?: Array<{ externalId: number; status: string }>;
        };
      };

      const newStatus = mapSeerrStatus(data.status, data.media?.status, data.media?.downloadStatus);
      const oldStatus = request.status;

      if (newStatus !== oldStatus) {
        if (newStatus === "failed" && request.seerrRequestId) {
          await handleFailedSync(prisma, config, request, data);
          invalidate(`seer-cache:${request.jellyfinUserId}`);
          continue;
        }

        const extra: Record<string, unknown> = { seerrMediaStatus: data.media?.status };
        if (newStatus === "available") extra.completedAt = new Date();

        await updateRequestStatus(prisma, request.id, newStatus, extra as any);
        invalidate(`seer-cache:${request.jellyfinUserId}`);

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

async function handleFailedSync(
  prisma: PrismaClient, config: WorkerConfig,
  request: SeerRequest, data: { media?: { status: number } },
): Promise<void> {
  const retryN = request.retryCount + 1;

  if (retryN < request.maxRetries) {
    await fetch(`${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`, {
      method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});

    if (request.seerrMediaId) {
      await fetch(`${config.seerrUrl}/api/v1/media/${request.seerrMediaId}`, {
        method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    }

    await prisma.$executeRawUnsafe(
      `UPDATE seer_requests SET status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
      retryN, request.id,
    );

    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId, type: "request_status",
        title: request.title,
        body: `Nouvelle tentative automatique pour « ${request.title} » (${retryN}/${request.maxRetries})`,
        refId: request.id,
      },
    });
    console.log(`[SeerWorker] Auto-retry "${request.title}" (attempt ${retryN}/${request.maxRetries})`);
  } else {
    await updateRequestStatus(prisma, request.id, "failed", {
      seerrMediaStatus: data.media?.status, retryCount: retryN,
    } as any);
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId, type: "request_status",
        title: request.title,
        body: `Échec définitif pour « ${request.title} » après ${request.maxRetries} tentatives`,
        refId: request.id,
      },
    });
    console.log(`[SeerWorker] "${request.title}" PERMANENTLY FAILED after ${request.maxRetries} retries`);
  }
}

/* ── Auto-retry failed requests ──────────────────────────────────── */

export async function retryFailedRequests(prisma: PrismaClient): Promise<void> {
  const failed = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; retry_count: number; max_retries: number }>>(
    `SELECT id, title, retry_count, max_retries FROM seer_requests
     WHERE status = 'failed' AND retry_count < max_retries LIMIT 3`,
  );

  for (const req of failed) {
    const newRetry = req.retry_count + 1;
    await prisma.$executeRawUnsafe(
      `UPDATE seer_requests SET status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
      newRetry, req.id,
    );
    console.log(`[SeerWorker] Auto-retry "${req.title}" (attempt ${newRetry}/${req.max_retries})`);
  }
}

/* ── Helpers ──────────────────────────────────────────────────────── */

/**
 * Mapping Jellyseerr → status local. L'état du MÉDIA Jellyseerr (source de
 * vérité, y compris posé manuellement via « Marquer comme ») prime.
 *
 * Jellyseerr media.status (Overseerr) :
 *   1 = UNKNOWN, 2 = PENDING, 3 = PROCESSING, 4 = PARTIALLY_AVAILABLE, 5 = AVAILABLE
 * Jellyseerr request.status :
 *   1 = PENDING_APPROVAL, 2 = APPROVED, 3 = DECLINED, 4 = FAILED
 */
export function mapSeerrStatus(
  requestStatus: number, mediaStatus?: number,
  downloadStatus?: Array<{ status: string }>,
): SeerRequest["status"] {
  if (requestStatus === 3) return "failed";
  if (requestStatus === 4) return "failed";

  // Disponible / partiellement disponible AVANT les échecs de téléchargement :
  // un état posé (par Jellyseerr ou manuellement par l'utilisateur) ne doit
  // jamais être re-écrasé en « échec » — et donc auto-retenté — sur la foi
  // d'un downloadStatus périmé.
  if (mediaStatus === 5) return "available";
  if (mediaStatus === 4) return "partially_available";

  if (downloadStatus?.some((d) => d.status === "failed" || d.status === "warning")) return "failed";

  if (mediaStatus === 3) return "downloading";
  if (requestStatus === 1) return "sent_to_seer";
  // Média marqué « non disponible » (UNKNOWN) dans Jellyseerr alors que la
  // demande reste approuvée → on reflète le vrai état Jellyseerr.
  if (mediaStatus === 1) return "unavailable";
  return "approved";
}

function statusNotification(
  request: SeerRequest, newStatus: string,
): { type: string; title: string; message: string } | null {
  switch (newStatus) {
    case "approved":
      return { type: "request_approved", title: request.title, message: `Votre demande pour « ${request.title} » a été approuvée` };
    case "downloading":
      return { type: "request_downloading", title: request.title, message: `« ${request.title} » est en cours de téléchargement` };
    case "available":
      return { type: "request_available", title: request.title, message: `« ${request.title} » est maintenant disponible !` };
    case "failed":
      return { type: "request_declined", title: request.title, message: `Votre demande pour « ${request.title} » a été refusée` };
    default:
      return null;
  }
}
