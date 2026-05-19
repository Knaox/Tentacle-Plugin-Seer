/* ------------------------------------------------------------------ */
/*  Seer Plugin — Background queue worker (main loop + request sender) */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import { getNextQueued, updateRequestStatus, getRequestById } from "./db";
import { fetchMediaDetail, isAnimeFromKeywords, fetchAnimeOverrides } from "./anime";
import { syncStatuses, retryFailedRequests, type WorkerConfig } from "./worker-sync";
import { processCleanupQueue } from "./worker-cleanup";
import { resolveJellyseerrUserId } from "./jellyseerr-user";
import type { SeerProfile } from "./types";

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

    try { await processNextRequest(prisma, config); }
    catch (err) { console.error("[SeerWorker] Error processing request:", err); }

    if (cycleCount % config.syncEvery === 0) {
      try { await syncStatuses(prisma, config); }
      catch (err) { console.error("[SeerWorker] Error syncing statuses:", err); }
    }

    try { await retryFailedRequests(prisma); }
    catch (err) { console.error("[SeerWorker] Error retrying failed requests:", err); }

    try { await processCleanupQueue(prisma, config); }
    catch (err) { console.error("[SeerWorker] Error processing cleanup queue:", err); }
  }

  setTimeout(tick, 5000);
  timer = setInterval(() => { tick(); }, 60_000);
  console.log("[SeerWorker] Started");
}

export function stopWorker(): void {
  if (timer) { clearInterval(timer); timer = null; console.log("[SeerWorker] Stopped"); }
}

export function isWorkerRunning(): boolean {
  return timer !== null;
}

/* ── Process next queued request ───────────────────────────────────── */

async function processNextRequest(prisma: PrismaClient, config: WorkerConfig): Promise<void> {
  const request = await getNextQueued(prisma);
  if (!request) return;

  const fresh = await getRequestById(prisma, request.id);
  if (!fresh || (fresh.status !== "queued" && fresh.status !== "retry_pending")) return;

  await updateRequestStatus(prisma, request.id, "processing");

  try {
    const seerrBody: Record<string, unknown> = {
      mediaType: request.mediaType,
      mediaId: request.tmdbId,
    };
    if (request.mediaType === "tv" && request.seasons) {
      seerrBody.seasons = request.seasons.map(Number);
    }

    const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, request.mediaType, request.tmdbId);

    // Clean up declined/failed requests on Seerr
    if (detail?.mediaInfo?.requests) {
      for (const r of detail.mediaInfo.requests) {
        if (r.status === 3 || r.status === 4) {
          await fetch(`${config.seerrUrl}/api/v1/request/${r.id}`, {
            method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(10_000),
          }).catch(() => {});
        }
      }
    }

    // Reset Seerr media for clean re-request
    if (detail?.mediaInfo?.id) {
      await fetch(`${config.seerrUrl}/api/v1/media/${detail.mediaInfo.id}`, {
        method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    }

    // Anime detection
    if (request.mediaType === "tv" && detail && isAnimeFromKeywords(detail)) {
      const overrides = await fetchAnimeOverrides(config.seerrUrl, config.seerrApiKey);
      if (overrides) {
        Object.assign(seerrBody, {
          profileId: overrides.profileId, rootFolder: overrides.rootFolder, tags: overrides.tags,
        });
        if (overrides.languageProfileId) seerrBody.languageProfileId = overrides.languageProfileId;
        console.log(`[SeerWorker] Anime detected for "${request.title}", applying overrides`);
      }
    }

    // Appliquer le profil personnalisé (surcharge anime si présent)
    if (request.profileId && config.profiles?.length) {
      const profile = config.profiles.find((p: SeerProfile) => p.id === request.profileId);
      if (profile) {
        if (request.mediaType === "movie") {
          if (profile.radarrServerId != null) seerrBody.serverId = profile.radarrServerId;
          if (profile.radarrProfileId != null) seerrBody.profileId = profile.radarrProfileId;
          if (profile.radarrRootFolder) seerrBody.rootFolder = profile.radarrRootFolder;
        } else {
          if (profile.sonarrServerId != null) seerrBody.serverId = profile.sonarrServerId;
          if (profile.sonarrProfileId != null) seerrBody.profileId = profile.sonarrProfileId;
          if (profile.sonarrRootFolder) seerrBody.rootFolder = profile.sonarrRootFolder;
          if (profile.sonarrLanguageProfileId != null) seerrBody.languageProfileId = profile.sonarrLanguageProfileId;
        }
        // Tags personnalisés : si définis, remplacent TOUS les tags (anime, défaut, etc.)
        if (profile.tags !== undefined) {
          seerrBody.tags = profile.tags.length > 0 ? profile.tags : [];
        }
        console.log(`[SeerWorker] Applied profile "${profile.name}" for "${request.title}" (tags: ${JSON.stringify(profile.tags ?? "default")})`);
      }
    }

    // Résolution du user Jellyseerr (lookup ou import) — la demande doit
    // apparaître au nom de l'utilisateur Jellyfin qui l'a déclenchée.
    const seerUserId = await resolveJellyseerrUserId(
      config, prisma, request.jellyfinUserId, request.username,
    );
    seerrBody.userId = seerUserId;

    // Send to Seerr
    const res = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
      body: JSON.stringify(seerrBody),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Seerr returned ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as { id: number; media?: { id: number; status: number } };

    await updateRequestStatus(prisma, request.id, "sent_to_seer", {
      seerrRequestId: data.id,
      seerrMediaId: data.media?.id,
      seerrMediaStatus: data.media?.status,
      sentAt: new Date(),
    });

    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId, type: "request_status",
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
      await updateRequestStatus(prisma, request.id, "failed", {
        lastError: errMsg, retryCount: newRetryCount,
      });
      await prisma.notification.create({
        data: {
          jellyfinUserId: request.jellyfinUserId, type: "request_status",
          title: request.title,
          body: `Votre demande pour « ${request.title} » a échoué après ${newRetryCount} tentatives`,
          refId: request.id,
        },
      });
      console.warn(`[SeerWorker] Request for "${request.title}" FAILED after ${newRetryCount} retries: ${errMsg}`);
    } else {
      await updateRequestStatus(prisma, request.id, "retry_pending", {
        lastError: errMsg, retryCount: newRetryCount,
      });
      // Notification une seule fois, au premier échec, pour ne pas spammer l'utilisateur
      if (request.retryCount === 0) {
        await prisma.notification.create({
          data: {
            jellyfinUserId: request.jellyfinUserId, type: "request_status",
            title: request.title,
            body: `Votre demande pour « ${request.title} » a rencontré une erreur, elle sera réessayée automatiquement`,
            refId: request.id,
          },
        });
      }
      console.warn(`[SeerWorker] Request for "${request.title}" retry ${newRetryCount}/${request.maxRetries}: ${errMsg}`);
    }
  }
}
