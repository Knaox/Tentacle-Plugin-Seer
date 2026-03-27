// Seer Plugin — Server module (auto-generated, do not edit)

// server/index.ts
import { Readable } from "stream";
import { resolve, dirname } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

// server/db-helpers.ts
function uuid() {
  return crypto.randomUUID();
}
function rowToRequest(r) {
  return {
    id: r.id,
    jellyfinUserId: r.jellyfin_user_id,
    username: r.username,
    mediaType: r.media_type,
    tmdbId: r.tmdb_id,
    title: r.title,
    posterPath: r.poster_path || null,
    backdropPath: r.backdrop_path || null,
    overview: r.overview || null,
    year: r.year || null,
    seasons: r.seasons ? typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons : null,
    status: r.status,
    seerrRequestId: r.seerr_request_id || null,
    seerrMediaId: r.seerr_media_id || null,
    seerrMediaStatus: r.seerr_media_status || null,
    retryCount: r.retry_count || 0,
    maxRetries: r.max_retries || 10,
    lastError: r.last_error || null,
    priority: r.priority || 0,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    sentAt: r.sent_at ? toIso(r.sent_at) : null,
    completedAt: r.completed_at ? toIso(r.completed_at) : null,
    pendingCleanupId: r.pending_cleanup_id || null,
    profileId: r.profile_id || null
  };
}
function toIso(v) {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return (/* @__PURE__ */ new Date()).toISOString();
}

// server/db-queries.ts
async function getUserRequests(prisma, jellyfinUserId, opts) {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 100);
  const offset = (page - 1) * limit;
  let where = `WHERE jellyfin_user_id = ? AND status != 'deleted'`;
  const params = [jellyfinUserId];
  if (opts.status) {
    const statuses = opts.status.split(",").map((s) => s.trim());
    where += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (opts.mediaType) {
    where += ` AND media_type = ?`;
    params.push(opts.mediaType);
  }
  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM seer_requests ${where}`,
    ...params
  );
  const total = Number(countRows[0].cnt);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  return { results: rows.map(rowToRequest), total, page, pages: Math.ceil(total / limit) || 1 };
}
async function getAllRequests(prisma, opts) {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 100);
  const offset = (page - 1) * limit;
  let where = `WHERE status != 'deleted'`;
  const params = [];
  if (opts.status) {
    const statuses = opts.status.split(",").map((s) => s.trim());
    where += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (opts.mediaType) {
    where += ` AND media_type = ?`;
    params.push(opts.mediaType);
  }
  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM seer_requests ${where}`,
    ...params
  );
  const total = Number(countRows[0].cnt);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  return { results: rows.map(rowToRequest), total, page, pages: Math.ceil(total / limit) || 1 };
}
async function getQueueStatus(prisma, jellyfinUserId) {
  const userFilter = jellyfinUserId ? ` AND jellyfin_user_id = ?` : "";
  const userParams = jellyfinUserId ? [jellyfinUserId] : [];
  const processingRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests WHERE status = 'processing'${userFilter} LIMIT 1`,
    ...userParams
  );
  const countRows = await prisma.$queryRawUnsafe(
    `SELECT
       SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
       SUM(CASE WHEN status = 'retry_pending' THEN 1 ELSE 0 END) as retry_pending,
       SUM(CASE WHEN status = 'deleting' THEN 1 ELSE 0 END) as deleting
     FROM seer_requests WHERE status IN ('queued', 'retry_pending', 'deleting')${userFilter}`,
    ...userParams
  );
  return {
    processing: processingRows.length > 0 ? rowToRequest(processingRows[0]) : null,
    queued: Number(countRows[0].queued) || 0,
    retryPending: Number(countRows[0].retry_pending) || 0,
    deleting: Number(countRows[0].deleting) || 0
  };
}
async function getUserStats(prisma, jellyfinUserId) {
  const byStatus = await prisma.$queryRawUnsafe(
    `SELECT status, COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ? AND status != 'deleted'
     GROUP BY status`,
    jellyfinUserId
  );
  const byType = await prisma.$queryRawUnsafe(
    `SELECT media_type, COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ? AND status != 'deleted'
     GROUP BY media_type`,
    jellyfinUserId
  );
  const total = byStatus.reduce((n, r) => n + Number(r.cnt), 0);
  return {
    totalRequests: total,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.cnt)])),
    byType: Object.fromEntries(byType.map((r) => [r.media_type, Number(r.cnt)]))
  };
}
async function getGlobalStats(prisma) {
  const byStatus = await prisma.$queryRawUnsafe(
    `SELECT status, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY status`
  );
  const byType = await prisma.$queryRawUnsafe(
    `SELECT media_type, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY media_type`
  );
  const topRequested = await prisma.$queryRawUnsafe(
    `SELECT title, tmdb_id, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY title, tmdb_id ORDER BY cnt DESC LIMIT 10`
  );
  const topUsers = await prisma.$queryRawUnsafe(
    `SELECT username, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY username ORDER BY cnt DESC LIMIT 10`
  );
  const total = byStatus.reduce((n, r) => n + Number(r.cnt), 0);
  const available = Number(byStatus.find((r) => r.status === "available")?.cnt || 0);
  return {
    totalRequests: total,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.cnt)])),
    byType: Object.fromEntries(byType.map((r) => [r.media_type, Number(r.cnt)])),
    topRequested: topRequested.map((r) => ({ title: r.title, tmdbId: r.tmdb_id, count: Number(r.cnt) })),
    topUsers: topUsers.map((r) => ({ username: r.username, count: Number(r.cnt) })),
    successRate: total > 0 ? Math.round(available / total * 100) : 0
  };
}

// server/db-cleanup.ts
async function enqueueCleanup(prisma, job) {
  const id = uuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_cleanup_queue (id, action, media_type, tmdb_id, title, seerr_request_id, seerr_media_id, delete_files, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    job.action,
    job.mediaType,
    job.tmdbId,
    job.title,
    job.seerrRequestId ?? null,
    job.seerrMediaId ?? null,
    job.deleteFiles ? 1 : 0,
    job.requestId ?? null
  );
  return id;
}
async function getPendingCleanups(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_cleanup_queue
     WHERE status = 'pending' AND next_retry_at <= NOW()
     ORDER BY created_at ASC LIMIT 1`
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    mediaType: r.media_type,
    tmdbId: r.tmdb_id,
    title: r.title,
    seerrRequestId: r.seerr_request_id || null,
    seerrMediaId: r.seerr_media_id || null,
    deleteFiles: Boolean(r.delete_files),
    retryCount: r.retry_count || 0,
    maxRetries: r.max_retries || 20,
    lastError: r.last_error || null,
    status: r.status,
    nextRetryAt: toIso(r.next_retry_at),
    requestId: r.request_id || null
  }));
}
async function updateCleanupJob(prisma, id, status, extra) {
  const sets = ["status = ?"];
  const params = [status];
  if (extra?.lastError !== void 0) {
    sets.push("last_error = ?");
    params.push(extra.lastError);
  }
  if (extra?.retryCount !== void 0) {
    sets.push("retry_count = ?");
    params.push(extra.retryCount);
  }
  if (extra?.nextRetryAt !== void 0) {
    sets.push("next_retry_at = ?");
    params.push(extra.nextRetryAt);
  }
  params.push(id);
  await prisma.$executeRawUnsafe(`UPDATE seer_cleanup_queue SET ${sets.join(", ")} WHERE id = ?`, ...params);
}
async function clearPendingCleanup(prisma, cleanupId) {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET pending_cleanup_id = NULL WHERE pending_cleanup_id = ?`,
    cleanupId
  );
}

// server/db.ts
async function ensureTables(prisma) {
  let existingCount = 0;
  try {
    await prisma.$queryRawUnsafe(`SELECT jellyfin_user_id FROM seer_requests LIMIT 1`);
    const rows2 = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM seer_requests`
    );
    existingCount = Number(rows2[0].cnt);
    console.log(`[SeerDB] Table seer_requests exists with ${existingCount} rows \u2014 preserving data`);
  } catch {
    console.log("[SeerDB] Table seer_requests missing or incompatible \u2014 recreating");
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS seer_requests`).catch(() => {
    });
  }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seer_requests (
      id               VARCHAR(36) NOT NULL PRIMARY KEY,
      jellyfin_user_id VARCHAR(255) NOT NULL,
      username         VARCHAR(255) NOT NULL,
      media_type       VARCHAR(10) NOT NULL,
      tmdb_id          INT NOT NULL,
      title            VARCHAR(500) NOT NULL,
      poster_path      VARCHAR(500),
      backdrop_path    VARCHAR(500),
      overview         TEXT,
      year             VARCHAR(10),
      seasons          JSON,
      status           VARCHAR(30) NOT NULL DEFAULT 'queued',
      seerr_request_id INT,
      seerr_media_id   INT,
      seerr_media_status INT,
      retry_count      INT NOT NULL DEFAULT 0,
      max_retries      INT NOT NULL DEFAULT 10,
      last_error       TEXT,
      priority         INT NOT NULL DEFAULT 0,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      sent_at          DATETIME,
      completed_at     DATETIME,
      INDEX idx_seer_req_user (jellyfin_user_id),
      INDEX idx_seer_req_status (status),
      INDEX idx_seer_req_queue (status, priority DESC, created_at ASC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  try {
    await prisma.$queryRawUnsafe(`SELECT next_retry_at FROM seer_cleanup_queue LIMIT 1`);
  } catch {
    console.log("[SeerDB] Table seer_cleanup_queue missing or incompatible \u2014 recreating");
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS seer_cleanup_queue`).catch(() => {
    });
  }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seer_cleanup_queue (
      id               VARCHAR(36) NOT NULL PRIMARY KEY,
      action           VARCHAR(20) NOT NULL,
      media_type       VARCHAR(10) NOT NULL,
      tmdb_id          INT NOT NULL,
      title            VARCHAR(500) NOT NULL,
      seerr_request_id INT,
      seerr_media_id   INT,
      delete_files     TINYINT(1) NOT NULL DEFAULT 1,
      retry_count      INT NOT NULL DEFAULT 0,
      max_retries      INT NOT NULL DEFAULT 20,
      last_error       TEXT,
      status           VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      next_retry_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cleanup_status (status, next_retry_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const addColumn = async (table, col, def) => {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      console.log(`[SeerDB] Added column ${table}.${col}`);
    } catch {
    }
  };
  await addColumn("seer_cleanup_queue", "request_id", "VARCHAR(36) DEFAULT NULL");
  await addColumn("seer_requests", "pending_cleanup_id", "VARCHAR(36) DEFAULT NULL");
  await addColumn("seer_requests", "profile_id", "VARCHAR(36) DEFAULT NULL");
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM seer_requests`
  );
  const finalCount = Number(rows[0].cnt);
  if (existingCount > 0 && finalCount === 0) {
    console.error(`[SeerDB] CRITICAL: ${existingCount} rows were lost!`);
  }
}
async function createRequest(prisma, data) {
  const id = uuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_requests
      (id, jellyfin_user_id, username, media_type, tmdb_id, title, poster_path,
       backdrop_path, overview, year, seasons, status, priority, profile_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
    id,
    data.jellyfinUserId,
    data.username,
    data.mediaType,
    data.tmdbId,
    data.title,
    data.posterPath || null,
    data.backdropPath || null,
    data.overview || null,
    data.year || null,
    data.seasons ? JSON.stringify(data.seasons) : null,
    data.priority || 0,
    data.profileId || null
  );
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests WHERE id = ?`,
    id
  );
  return rowToRequest(rows[0]);
}
async function getRequestById(prisma, id) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests WHERE id = ?`,
    id
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}
async function updateRequestStatus(prisma, id, status, extra) {
  const sets = ["status = ?"];
  const params = [status];
  if (extra?.seerrRequestId !== void 0) {
    sets.push("seerr_request_id = ?");
    params.push(extra.seerrRequestId);
  }
  if (extra?.seerrMediaId !== void 0) {
    sets.push("seerr_media_id = ?");
    params.push(extra.seerrMediaId);
  }
  if (extra?.seerrMediaStatus !== void 0) {
    sets.push("seerr_media_status = ?");
    params.push(extra.seerrMediaStatus);
  }
  if (extra?.lastError !== void 0) {
    sets.push("last_error = ?");
    params.push(extra.lastError);
  }
  if (extra?.retryCount !== void 0) {
    sets.push("retry_count = ?");
    params.push(extra.retryCount);
  }
  if (extra?.sentAt !== void 0) {
    sets.push("sent_at = ?");
    params.push(extra.sentAt);
  }
  if (extra?.completedAt !== void 0) {
    sets.push("completed_at = ?");
    params.push(extra.completedAt);
  }
  params.push(id);
  await prisma.$executeRawUnsafe(`UPDATE seer_requests SET ${sets.join(", ")} WHERE id = ?`, ...params);
}
async function deleteRequestById(prisma, id) {
  await prisma.$executeRawUnsafe(`DELETE FROM seer_requests WHERE id = ?`, id);
}
async function findDuplicate(prisma, jellyfinUserId, tmdbId, mediaType, seasons) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = ?
       AND status NOT IN ('deleted', 'failed', 'available', 'deleting', 'delete_failed')`,
    jellyfinUserId,
    tmdbId,
    mediaType
  );
  if (rows.length === 0) return null;
  if (mediaType === "movie") return rowToRequest(rows[0]);
  const requestedSeasons = new Set(seasons ?? []);
  if (requestedSeasons.size === 0) return rowToRequest(rows[0]);
  for (const row of rows) {
    const existing = rowToRequest(row);
    const existingSeasons = new Set(existing.seasons ?? []);
    if (existingSeasons.size === 0) return existing;
    for (const s of requestedSeasons) {
      if (existingSeasons.has(s)) return existing;
    }
  }
  return null;
}
async function findExistingTvRequest(prisma, jellyfinUserId, tmdbId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = 'tv'
       AND status NOT IN ('deleted', 'deleting', 'delete_failed')
     ORDER BY created_at DESC LIMIT 1`,
    jellyfinUserId,
    tmdbId
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}
async function addSeasonsToRequest(prisma, id, seasons) {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests
     SET seasons = ?,
         status = CASE WHEN status IN ('processing') THEN status ELSE 'queued' END,
         seerr_request_id = NULL,
         seerr_media_id = NULL,
         seerr_media_status = NULL,
         retry_count = 0,
         last_error = NULL
     WHERE id = ?`,
    JSON.stringify(seasons),
    id
  );
}
async function getNextQueued(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE status IN ('queued', 'retry_pending')
       AND (pending_cleanup_id IS NULL)
     ORDER BY priority DESC, created_at ASC
     LIMIT 1`
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}
async function getRequestsToSync(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE seerr_request_id IS NOT NULL
       AND status NOT IN ('available', 'failed', 'deleted', 'deleting', 'delete_failed')`
  );
  return rows.map(rowToRequest);
}

// server/anime.ts
var overridesCache = null;
async function fetchMediaDetail(seerrUrl, apiKey, mediaType, tmdbId) {
  try {
    const res = await fetch(`${seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
function isAnimeFromKeywords(detail) {
  if (!detail.keywords || !Array.isArray(detail.keywords)) return false;
  return detail.keywords.some((k) => k.name?.toLowerCase().includes("anime"));
}
async function fetchAnimeOverrides(seerrUrl, apiKey) {
  if (overridesCache && Date.now() < overridesCache.expires) {
    return overridesCache.data;
  }
  try {
    const res = await fetch(`${seerrUrl}/api/v1/settings/sonarr`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      overridesCache = { data: null, expires: Date.now() + 6e5 };
      return null;
    }
    const servers = await res.json();
    const defaultServer = servers.find((s) => s.isDefault);
    if (!defaultServer?.activeAnimeProfileId) {
      overridesCache = { data: null, expires: Date.now() + 6e5 };
      return null;
    }
    const data = {
      profileId: defaultServer.activeAnimeProfileId,
      rootFolder: defaultServer.activeAnimeDirectory,
      tags: defaultServer.animeTags || [],
      languageProfileId: defaultServer.activeAnimeLanguageProfileId
    };
    overridesCache = { data, expires: Date.now() + 6e5 };
    return data;
  } catch {
    overridesCache = { data: null, expires: Date.now() + 6e5 };
    return null;
  }
}

// server/worker-sync.ts
async function syncStatuses(prisma, config) {
  const requests = await getRequestsToSync(prisma);
  if (requests.length === 0) return;
  for (const request of requests) {
    if (!request.seerrRequestId) continue;
    try {
      const res = await fetch(
        `${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`,
        { headers: { "X-Api-Key": config.seerrApiKey }, signal: AbortSignal.timeout(1e4) }
      );
      if (!res.ok) {
        if (res.status === 404) {
          await updateRequestStatus(prisma, request.id, "failed", {
            lastError: "Request no longer exists on Seerr"
          });
        }
        continue;
      }
      const data = await res.json();
      const newStatus = mapSeerrStatus(data.status, data.media?.status, data.media?.downloadStatus);
      const oldStatus = request.status;
      if (newStatus !== oldStatus) {
        if (newStatus === "failed" && request.seerrRequestId) {
          await handleFailedSync(prisma, config, request, data);
          continue;
        }
        const extra = { seerrMediaStatus: data.media?.status };
        if (newStatus === "available") extra.completedAt = /* @__PURE__ */ new Date();
        await updateRequestStatus(prisma, request.id, newStatus, extra);
        const notif = statusNotification(request, newStatus);
        if (notif) {
          await prisma.notification.create({
            data: {
              jellyfinUserId: request.jellyfinUserId,
              type: "request_status",
              title: notif.title,
              body: notif.message,
              refId: request.id
            }
          });
        }
        console.log(`[SeerWorker] "${request.title}" status: ${oldStatus} \u2192 ${newStatus}`);
      }
    } catch (err) {
      console.warn(`[SeerWorker] Failed to sync request #${request.seerrRequestId}:`, err);
    }
  }
}
async function handleFailedSync(prisma, config, request, data) {
  const retryN = request.retryCount + 1;
  if (retryN < request.maxRetries) {
    await fetch(`${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`, {
      method: "DELETE",
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    }).catch(() => {
    });
    if (request.seerrMediaId) {
      await fetch(`${config.seerrUrl}/api/v1/media/${request.seerrMediaId}`, {
        method: "DELETE",
        headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(1e4)
      }).catch(() => {
      });
    }
    await prisma.$executeRawUnsafe(
      `UPDATE seer_requests SET status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
      retryN,
      request.id
    );
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId,
        type: "request_status",
        title: request.title,
        body: `Nouvelle tentative automatique pour \xAB ${request.title} \xBB (${retryN}/${request.maxRetries})`,
        refId: request.id
      }
    });
    console.log(`[SeerWorker] Auto-retry "${request.title}" (attempt ${retryN}/${request.maxRetries})`);
  } else {
    await updateRequestStatus(prisma, request.id, "failed", {
      seerrMediaStatus: data.media?.status,
      retryCount: retryN
    });
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId,
        type: "request_status",
        title: request.title,
        body: `\xC9chec d\xE9finitif pour \xAB ${request.title} \xBB apr\xE8s ${request.maxRetries} tentatives`,
        refId: request.id
      }
    });
    console.log(`[SeerWorker] "${request.title}" PERMANENTLY FAILED after ${request.maxRetries} retries`);
  }
}
async function retryFailedRequests(prisma) {
  const failed = await prisma.$queryRawUnsafe(
    `SELECT id, title, retry_count, max_retries FROM seer_requests
     WHERE status = 'failed' AND retry_count < max_retries LIMIT 3`
  );
  for (const req of failed) {
    const newRetry = req.retry_count + 1;
    await prisma.$executeRawUnsafe(
      `UPDATE seer_requests SET status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
      newRetry,
      req.id
    );
    console.log(`[SeerWorker] Auto-retry "${req.title}" (attempt ${newRetry}/${req.max_retries})`);
  }
}
function mapSeerrStatus(requestStatus, mediaStatus, downloadStatus) {
  if (requestStatus === 3) return "failed";
  if (requestStatus === 4) return "failed";
  if (downloadStatus?.some((d) => d.status === "failed" || d.status === "warning")) return "failed";
  if (requestStatus === 1) {
    if (mediaStatus === 5) return "available";
    if (mediaStatus === 3 || mediaStatus === 4) return "downloading";
    return "sent_to_seer";
  }
  if (mediaStatus === 5) return "available";
  if (mediaStatus === 3 || mediaStatus === 4) return "downloading";
  return "approved";
}
function statusNotification(request, newStatus) {
  switch (newStatus) {
    case "approved":
      return { type: "request_approved", title: request.title, message: `Votre demande pour \xAB ${request.title} \xBB a \xE9t\xE9 approuv\xE9e` };
    case "downloading":
      return { type: "request_downloading", title: request.title, message: `\xAB ${request.title} \xBB est en cours de t\xE9l\xE9chargement` };
    case "available":
      return { type: "request_available", title: request.title, message: `\xAB ${request.title} \xBB est maintenant disponible !` };
    case "failed":
      return { type: "request_declined", title: request.title, message: `Votre demande pour \xAB ${request.title} \xBB a \xE9t\xE9 refus\xE9e` };
    default:
      return null;
  }
}

// server/arr-service.ts
var sonarrCache = null;
var radarrCache = null;
async function getArrServerConfig(seerrUrl, apiKey, type) {
  const cache = type === "sonarr" ? sonarrCache : radarrCache;
  if (cache && Date.now() < cache.expires) return cache.data;
  try {
    const res = await fetch(`${seerrUrl}/api/v1/settings/${type}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      setCacheForType(type, null);
      return null;
    }
    const servers = await res.json();
    const defaultServer = servers.find((s) => s.isDefault);
    if (!defaultServer) {
      setCacheForType(type, null);
      return null;
    }
    const data = {
      hostname: defaultServer.hostname,
      port: defaultServer.port,
      apiKey: defaultServer.apiKey,
      useSsl: !!defaultServer.useSsl,
      baseUrl: defaultServer.baseUrl || ""
    };
    setCacheForType(type, data);
    return data;
  } catch {
    setCacheForType(type, null);
    return null;
  }
}
function setCacheForType(type, data) {
  const entry = { data, expires: Date.now() + 6e5 };
  if (type === "sonarr") sonarrCache = entry;
  else radarrCache = entry;
}
function buildArrUrl(server) {
  const protocol = server.useSsl ? "https" : "http";
  const base = server.baseUrl ? `/${server.baseUrl.replace(/^\/|\/$/g, "")}` : "";
  return `${protocol}://${server.hostname}:${server.port}${base}`;
}
async function getMediaExternalId(seerrUrl, apiKey, mediaType, tmdbId) {
  try {
    const res = await fetch(`${seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.mediaInfo?.externalServiceId) return null;
    return {
      externalServiceId: data.mediaInfo.externalServiceId,
      serviceId: data.mediaInfo.serviceId ?? 0
    };
  } catch {
    return null;
  }
}
async function deleteSonarrSeries(server, seriesId, deleteFiles = false) {
  try {
    const url = `${buildArrUrl(server)}/api/v3/series/${seriesId}?deleteFiles=${deleteFiles}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    return res.ok || res.status === 404;
  } catch (err) {
    console.warn(`[ArrService] Failed to delete Sonarr series #${seriesId}:`, err);
    return false;
  }
}
async function deleteRadarrMovie(server, movieId, deleteFiles = false) {
  try {
    const url = `${buildArrUrl(server)}/api/v3/movie/${movieId}?deleteFiles=${deleteFiles}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    return res.ok || res.status === 404;
  } catch (err) {
    console.warn(`[ArrService] Failed to delete Radarr movie #${movieId}:`, err);
    return false;
  }
}
async function deleteSeerrMedia(seerrUrl, apiKey, mediaId) {
  try {
    const res = await fetch(`${seerrUrl}/api/v1/media/${mediaId}`, {
      method: "DELETE",
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    return res.ok || res.status === 404;
  } catch (err) {
    console.warn(`[ArrService] Failed to delete Seerr media #${mediaId}:`, err);
    return false;
  }
}

// server/worker-cleanup.ts
async function processCleanupQueue(prisma, config) {
  const jobs = await getPendingCleanups(prisma);
  if (jobs.length === 0) return;
  const job = jobs[0];
  try {
    let arrSuccess = false;
    const ext = await getMediaExternalId(config.seerrUrl, config.seerrApiKey, job.mediaType, job.tmdbId);
    if (ext) {
      const arrType = job.mediaType === "movie" ? "radarr" : "sonarr";
      const server = await getArrServerConfig(config.seerrUrl, config.seerrApiKey, arrType);
      if (server) {
        arrSuccess = job.mediaType === "movie" ? await deleteRadarrMovie(server, ext.externalServiceId, job.deleteFiles) : await deleteSonarrSeries(server, ext.externalServiceId, job.deleteFiles);
        console.log(`[SeerWorker] ${arrType} delete for "${job.title}": ${arrSuccess ? "OK" : "FAILED"}`);
      } else {
        console.warn(`[SeerWorker] No ${arrType} server config found, skipping arr delete`);
        arrSuccess = true;
      }
    } else {
      arrSuccess = true;
    }
    if (!arrSuccess) {
      throw new Error("Sonarr/Radarr deletion failed \u2014 Seerr untouched");
    }
    if (job.seerrMediaId) {
      const seerrOk = await deleteSeerrMedia(config.seerrUrl, config.seerrApiKey, job.seerrMediaId);
      if (!seerrOk) {
        console.warn(`[SeerWorker] Seerr media delete failed for "${job.title}" but arr is clean \u2014 continuing`);
      }
    }
    if (job.seerrRequestId) {
      await fetch(`${config.seerrUrl}/api/v1/request/${job.seerrRequestId}`, {
        method: "DELETE",
        headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(1e4)
      }).catch(() => {
      });
    }
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
          lastError: `\xC9chec suppression: ${errMsg}`
        });
      }
      await clearPendingCleanup(prisma, job.id);
      console.warn(`[SeerWorker] Cleanup FAILED permanently for "${job.title}" after ${newRetry} retries`);
    } else {
      const delaySec = Math.min(30 * Math.pow(2, newRetry - 1), 1800);
      const nextRetry = new Date(Date.now() + delaySec * 1e3);
      await updateCleanupJob(prisma, job.id, "pending", {
        lastError: errMsg,
        retryCount: newRetry,
        nextRetryAt: nextRetry
      });
      console.log(`[SeerWorker] Cleanup retry ${newRetry}/${job.maxRetries} for "${job.title}" in ${delaySec}s`);
    }
  }
}

// server/worker.ts
var timer = null;
var cycleCount = 0;
function startWorker(prisma, getConfig) {
  if (timer) return;
  async function tick() {
    const config = await getConfig();
    if (!config || !config.seerrUrl || !config.seerrApiKey) return;
    cycleCount++;
    try {
      await processNextRequest(prisma, config);
    } catch (err) {
      console.error("[SeerWorker] Error processing request:", err);
    }
    if (cycleCount % config.syncEvery === 0) {
      try {
        await syncStatuses(prisma, config);
      } catch (err) {
        console.error("[SeerWorker] Error syncing statuses:", err);
      }
    }
    try {
      await retryFailedRequests(prisma);
    } catch (err) {
      console.error("[SeerWorker] Error retrying failed requests:", err);
    }
    try {
      await processCleanupQueue(prisma, config);
    } catch (err) {
      console.error("[SeerWorker] Error processing cleanup queue:", err);
    }
  }
  setTimeout(tick, 5e3);
  timer = setInterval(() => {
    tick();
  }, 6e4);
  console.log("[SeerWorker] Started");
}
function stopWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[SeerWorker] Stopped");
  }
}
function isWorkerRunning() {
  return timer !== null;
}
async function processNextRequest(prisma, config) {
  const request = await getNextQueued(prisma);
  if (!request) return;
  const fresh = await getRequestById(prisma, request.id);
  if (!fresh || fresh.status !== "queued" && fresh.status !== "retry_pending") return;
  await updateRequestStatus(prisma, request.id, "processing");
  try {
    const seerrBody = {
      mediaType: request.mediaType,
      mediaId: request.tmdbId
    };
    if (request.mediaType === "tv" && request.seasons) {
      seerrBody.seasons = request.seasons.map(Number);
    }
    const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, request.mediaType, request.tmdbId);
    if (detail?.mediaInfo?.requests) {
      for (const r of detail.mediaInfo.requests) {
        if (r.status === 3 || r.status === 4) {
          await fetch(`${config.seerrUrl}/api/v1/request/${r.id}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
      }
    }
    if (detail?.mediaInfo?.id) {
      await fetch(`${config.seerrUrl}/api/v1/media/${detail.mediaInfo.id}`, {
        method: "DELETE",
        headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(1e4)
      }).catch(() => {
      });
    }
    if (request.mediaType === "tv" && detail && isAnimeFromKeywords(detail)) {
      const overrides = await fetchAnimeOverrides(config.seerrUrl, config.seerrApiKey);
      if (overrides) {
        Object.assign(seerrBody, {
          profileId: overrides.profileId,
          rootFolder: overrides.rootFolder,
          tags: overrides.tags
        });
        if (overrides.languageProfileId) seerrBody.languageProfileId = overrides.languageProfileId;
        console.log(`[SeerWorker] Anime detected for "${request.title}", applying overrides`);
      }
    }
    if (request.profileId && config.profiles?.length) {
      const profile = config.profiles.find((p) => p.id === request.profileId);
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
        if (profile.tags !== void 0) {
          seerrBody.tags = profile.tags.length > 0 ? profile.tags : [];
        }
        console.log(`[SeerWorker] Applied profile "${profile.name}" for "${request.title}" (tags: ${JSON.stringify(profile.tags ?? "default")})`);
      }
    }
    const res = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
      body: JSON.stringify(seerrBody),
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Seerr returned ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    await updateRequestStatus(prisma, request.id, "sent_to_seer", {
      seerrRequestId: data.id,
      seerrMediaId: data.media?.id,
      seerrMediaStatus: data.media?.status,
      sentAt: /* @__PURE__ */ new Date()
    });
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId,
        type: "request_status",
        title: request.title,
        body: `Votre demande pour \xAB ${request.title} \xBB a \xE9t\xE9 envoy\xE9e \xE0 Seerr`,
        refId: request.id
      }
    });
    console.log(`[SeerWorker] Sent request for "${request.title}" (seerr #${data.id})`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const newRetryCount = request.retryCount + 1;
    if (newRetryCount >= request.maxRetries) {
      await updateRequestStatus(prisma, request.id, "failed", {
        lastError: errMsg,
        retryCount: newRetryCount
      });
      await prisma.notification.create({
        data: {
          jellyfinUserId: request.jellyfinUserId,
          type: "request_status",
          title: request.title,
          body: `Votre demande pour \xAB ${request.title} \xBB a \xE9chou\xE9 apr\xE8s ${newRetryCount} tentatives`,
          refId: request.id
        }
      });
      console.warn(`[SeerWorker] Request for "${request.title}" FAILED after ${newRetryCount} retries: ${errMsg}`);
    } else {
      await updateRequestStatus(prisma, request.id, "retry_pending", {
        lastError: errMsg,
        retryCount: newRetryCount
      });
      console.warn(`[SeerWorker] Request for "${request.title}" retry ${newRetryCount}/${request.maxRetries}: ${errMsg}`);
    }
  }
}

// server/routes-requests.ts
function getUser(request) {
  return request.user;
}
function registerRequestRoutes(app, prisma, getWorkerConfig2) {
  app.get("/requests", async (request) => {
    const user = getUser(request);
    const query = request.query;
    if (user.isAdmin && query.status === "all_users") {
      return getAllRequests(prisma, {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        mediaType: query.type
      });
    }
    return getUserRequests(prisma, user.userId, {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      status: query.status,
      mediaType: query.type
    });
  });
  app.post("/requests", async (request, reply) => {
    const user = getUser(request);
    const body = request.body;
    if (!body.mediaType || !body.tmdbId || !body.title) {
      return reply.status(400).send({ message: "mediaType, tmdbId, and title are required" });
    }
    if (body.mediaType === "tv" && body.seasons?.length) {
      const existing = await findExistingTvRequest(prisma, user.userId, body.tmdbId);
      if (existing) {
        const existingSeasons = new Set(existing.seasons ?? []);
        const newSeasons = body.seasons.filter((s) => !existingSeasons.has(s));
        if (newSeasons.length === 0) {
          return reply.status(409).send({ message: "All seasons already requested", existing });
        }
        const config = await getWorkerConfig2();
        if (config && existing.seerrRequestId) {
          await fetch(`${config.seerrUrl}/api/v1/request/${existing.seerrRequestId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
        if (config && existing.seerrMediaId) {
          await fetch(`${config.seerrUrl}/api/v1/media/${existing.seerrMediaId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
        const merged = [...existing.seasons ?? [], ...newSeasons].sort((a, b) => a - b);
        await addSeasonsToRequest(prisma, existing.id, merged);
        const updated = await getRequestById(prisma, existing.id);
        return reply.status(200).send(updated);
      }
    }
    const dup = await findDuplicate(prisma, user.userId, body.tmdbId, body.mediaType, body.seasons);
    if (dup) {
      return reply.status(409).send({ message: "A request for this media is already active", existing: dup });
    }
    const req = await createRequest(prisma, {
      jellyfinUserId: user.userId,
      username: user.username,
      mediaType: body.mediaType,
      tmdbId: body.tmdbId,
      title: body.title,
      posterPath: body.posterPath,
      backdropPath: body.backdropPath,
      overview: body.overview,
      year: body.year,
      seasons: body.seasons,
      profileId: body.profileId
    });
    return reply.status(201).send(req);
  });
  app.delete("/requests/:id", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const req = await getRequestById(prisma, id);
    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }
    const config = await getWorkerConfig2();
    if (req.seerrRequestId && config) {
      await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
        method: "DELETE",
        headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(1e4)
      }).catch(() => {
      });
    }
    const isSeasonSpecific = req.mediaType === "tv" && body.seasons && body.seasons.length > 0;
    const isFullSeries = req.mediaType === "tv" && !isSeasonSpecific;
    if (req.mediaType === "movie" || isFullSeries) {
      await updateRequestStatus(prisma, id, "deleting");
      await enqueueCleanup(prisma, {
        action: "delete",
        mediaType: req.mediaType,
        tmdbId: req.tmdbId,
        title: req.title,
        seerrRequestId: req.seerrRequestId,
        seerrMediaId: req.seerrMediaId,
        deleteFiles: true,
        requestId: id
      });
    } else {
      await deleteRequestById(prisma, id);
    }
    return { success: true, status: "deleting" };
  });
  app.post("/requests/:id/retry", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const req = await getRequestById(prisma, id);
    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }
    const newProfileId = body.profileId !== void 0 ? body.profileId : req.profileId;
    const config = await getWorkerConfig2();
    if (config) {
      if (req.seerrRequestId) {
        await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
          method: "DELETE",
          headers: { "X-Api-Key": config.seerrApiKey },
          signal: AbortSignal.timeout(1e4)
        }).catch(() => {
        });
      }
      if (req.seerrMediaId) {
        await fetch(`${config.seerrUrl}/api/v1/media/${req.seerrMediaId}`, {
          method: "DELETE",
          headers: { "X-Api-Key": config.seerrApiKey },
          signal: AbortSignal.timeout(1e4)
        }).catch(() => {
        });
      }
    }
    await deleteRequestById(prisma, id);
    const retrySeasons = body.seasons && body.seasons.length > 0 ? body.seasons : req.seasons;
    const newReq = await createRequest(prisma, {
      jellyfinUserId: req.jellyfinUserId,
      username: req.username,
      mediaType: req.mediaType,
      tmdbId: req.tmdbId,
      title: req.title,
      posterPath: req.posterPath,
      backdropPath: req.backdropPath,
      overview: req.overview,
      year: req.year,
      seasons: retrySeasons,
      priority: 1,
      profileId: newProfileId
    });
    return reply.status(201).send(newReq);
  });
  app.post("/requests/:id/retry-delete", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const req = await getRequestById(prisma, id);
    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }
    if (req.status !== "delete_failed" && req.status !== "deleting") {
      return reply.status(400).send({ message: "Request is not in a deletable state" });
    }
    await updateRequestStatus(prisma, id, "deleting", { lastError: "" });
    await enqueueCleanup(prisma, {
      action: "delete",
      mediaType: req.mediaType,
      tmdbId: req.tmdbId,
      title: req.title,
      seerrRequestId: req.seerrRequestId,
      seerrMediaId: req.seerrMediaId,
      deleteFiles: true,
      requestId: id
    });
    return { success: true };
  });
}

// server/routes-bulk.ts
function getUser2(request) {
  return request.user;
}
function registerBulkRoutes(app, prisma, getWorkerConfig2) {
  app.post("/requests/bulk-delete", async (request, reply) => {
    const user = getUser2(request);
    const body = request.body;
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return reply.status(400).send({ message: "ids array required" });
    }
    const config = await getWorkerConfig2();
    let deleted = 0;
    let errors = 0;
    for (const id of body.ids.slice(0, 50)) {
      try {
        const req = await getRequestById(prisma, id);
        if (!req) {
          errors++;
          continue;
        }
        if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
          errors++;
          continue;
        }
        if (req.status === "deleting" || req.status === "processing") {
          errors++;
          continue;
        }
        if (req.seerrRequestId && config) {
          await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
        await updateRequestStatus(prisma, id, "deleting");
        await enqueueCleanup(prisma, {
          action: "delete",
          mediaType: req.mediaType,
          tmdbId: req.tmdbId,
          title: req.title,
          seerrRequestId: req.seerrRequestId,
          seerrMediaId: req.seerrMediaId,
          deleteFiles: true,
          requestId: id
        });
        deleted++;
      } catch {
        errors++;
      }
    }
    return { success: true, deleted, errors };
  });
  app.post("/requests/bulk-retry", async (request, reply) => {
    const user = getUser2(request);
    const body = request.body;
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return reply.status(400).send({ message: "ids array required" });
    }
    const newProfileId = body.profileId;
    const config = await getWorkerConfig2();
    let retried = 0;
    let errors = 0;
    for (const id of body.ids.slice(0, 50)) {
      try {
        const req = await getRequestById(prisma, id);
        if (!req) {
          errors++;
          continue;
        }
        if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
          errors++;
          continue;
        }
        if (["deleting", "processing", "available"].includes(req.status)) {
          errors++;
          continue;
        }
        if (config) {
          if (req.seerrRequestId) {
            await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
              method: "DELETE",
              headers: { "X-Api-Key": config.seerrApiKey },
              signal: AbortSignal.timeout(1e4)
            }).catch(() => {
            });
          }
          if (req.seerrMediaId) {
            await fetch(`${config.seerrUrl}/api/v1/media/${req.seerrMediaId}`, {
              method: "DELETE",
              headers: { "X-Api-Key": config.seerrApiKey },
              signal: AbortSignal.timeout(1e4)
            }).catch(() => {
            });
          }
        }
        await deleteRequestById(prisma, id);
        const newReq = await createRequest(prisma, {
          jellyfinUserId: req.jellyfinUserId,
          username: req.username,
          mediaType: req.mediaType,
          tmdbId: req.tmdbId,
          title: req.title,
          posterPath: req.posterPath,
          backdropPath: req.backdropPath,
          overview: req.overview,
          year: req.year,
          seasons: req.seasons,
          priority: 1,
          profileId: newProfileId !== void 0 ? newProfileId : req.profileId
        });
        retried++;
      } catch {
        errors++;
      }
    }
    return { success: true, retried, errors };
  });
}

// server/routes-profiles.ts
var TIMEOUT = 3e4;
function registerProfileRoutes(app, getPluginConfig2, getSeerrConfig) {
  app.get("/profiles", async () => {
    const config = getPluginConfig2();
    const profiles = config.profiles ?? [];
    return { profiles };
  });
  app.get("/profiles/options", async (_request, reply) => {
    const seerr = getSeerrConfig();
    if (!seerr) return reply.status(503).send({ message: "Seerr not configured" });
    try {
      const [radarr, sonarr] = await Promise.all([
        fetchArrOptions(seerr, "radarr"),
        fetchArrOptions(seerr, "sonarr")
      ]);
      console.log(`[SeerProfiles] Found ${radarr.length} Radarr, ${sonarr.length} Sonarr`);
      return { radarr, sonarr };
    } catch (err) {
      console.error("[SeerProfiles] Failed to fetch options:", err);
      return reply.status(502).send({
        message: err instanceof Error ? err.message : "Failed to fetch quality options"
      });
    }
  });
}
async function fetchArrOptions(seerr, type) {
  const headers = { "X-Api-Key": seerr.seerrApiKey };
  let servers = [];
  try {
    const serviceRes = await fetch(`${seerr.seerrUrl}/api/v1/service/${type}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT)
    });
    if (serviceRes.ok) {
      servers = await serviceRes.json();
    } else {
      const settingsRes = await fetch(`${seerr.seerrUrl}/api/v1/settings/${type}`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        servers = settings.map((s, i) => ({
          id: s.id ?? i,
          name: s.name ?? `${type} ${i}`,
          isDefault: s.isDefault ?? i === 0,
          is4k: s.is4k ?? false
        }));
      }
    }
  } catch (err) {
    console.warn(`[SeerProfiles] Failed to list ${type} servers:`, err instanceof Error ? err.message : err);
    return [];
  }
  const nonFourK = servers.filter((s) => !s.is4k);
  const results = await Promise.allSettled(
    nonFourK.map(async (s) => {
      const detailRes = await fetch(`${seerr.seerrUrl}/api/v1/service/${type}/${s.id}`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (!detailRes.ok) return { ...s, profiles: [], rootFolders: [], tags: [] };
      const detail = await detailRes.json();
      const profiles = detail.profiles ?? [];
      const rootFolders = detail.rootFolders ?? [];
      const tags = detail.tags ?? [];
      console.log(`[SeerProfiles] ${type}/${s.id} "${s.name}": ${profiles.length} profiles, ${tags.length} tags`);
      return {
        id: s.id,
        name: s.name,
        isDefault: s.isDefault,
        profiles,
        tags,
        rootFolders: rootFolders.map((f) => ({ id: f.id, path: f.path }))
      };
    })
  );
  return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

// server/index.ts
var __pluginDir = dirname(dirname(fileURLToPath(import.meta.url)));
function getPluginConfig(ctx) {
  try {
    const installedPath = resolve(__pluginDir, "..", "installed.json");
    if (!existsSync(installedPath)) return {};
    const installed = JSON.parse(readFileSync(installedPath, "utf-8"));
    const plugin = installed.find(
      (p) => p.pluginId === ctx.pluginId || p.id === ctx.pluginId
    );
    return plugin?.config || {};
  } catch {
    return {};
  }
}
async function getWorkerConfig(ctx) {
  const config = getPluginConfig(ctx);
  const url = config.url;
  const apiKey = config.apiKey;
  if (!url || !apiKey) return null;
  const profiles = config.profiles ?? [];
  return { seerrUrl: url.replace(/\/$/, ""), seerrApiKey: apiKey, interval: 6e4, syncEvery: 2, profiles };
}
async function seerBackend(app, ctx) {
  const prisma = ctx.getPrisma();
  await ensureTables(prisma);
  console.log("[SeerBackend] Database tables ready");
  startWorker(prisma, () => getWorkerConfig(ctx));
  app.addHook("onClose", async () => {
    stopWorker();
  });
  app.addHook("preHandler", ctx.requireAuth);
  app.get("/config", async (request) => {
    const config = getPluginConfig(ctx);
    const user = request.user;
    if (user?.isAdmin) {
      return config;
    }
    return { url: config.url || "", enabled: !!config.enabled, hasApiKey: !!config.apiKey };
  });
  app.put("/config", { preHandler: ctx.requireAdmin }, async (request) => {
    const installedPath = resolve(__pluginDir, "..", "installed.json");
    if (!existsSync(installedPath)) return { error: "installed.json not found" };
    const installed = JSON.parse(readFileSync(installedPath, "utf-8"));
    const plugin = installed.find(
      (p) => p.pluginId === ctx.pluginId || p.id === ctx.pluginId
    );
    if (!plugin) return { error: "Plugin not found" };
    plugin.config = request.body;
    writeFileSync(installedPath, JSON.stringify(installed, null, 2));
    return plugin.config;
  });
  app.post("/proxy", async (request, reply) => {
    const body = request.body;
    if (!body.url) return reply.status(400).send({ message: "url is required" });
    const config = getPluginConfig(ctx);
    const seerrUrl = config.url?.replace(/\/$/, "");
    if (!seerrUrl) return reply.status(503).send({ message: "Seerr not configured" });
    let parsed;
    try {
      parsed = new URL(body.url);
    } catch {
      return reply.status(400).send({ message: "Invalid URL" });
    }
    if (parsed.origin !== new URL(seerrUrl).origin) {
      return reply.status(403).send({ message: "Proxy restricted to configured Seerr instance" });
    }
    try {
      const res = await fetch(body.url, {
        method: body.method || "GET",
        headers: body.headers,
        body: body.body ? JSON.stringify(body.body) : void 0,
        signal: AbortSignal.timeout(1e4)
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      return { status: res.status, ok: res.ok, data: json ?? text };
    } catch (err) {
      return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy failed" });
    }
  });
  app.all("/seerr/*", async (request, reply) => {
    const wildcard = request.params["*"];
    if (!wildcard || !wildcard.startsWith("api/v1/")) {
      return reply.status(400).send({ message: "Only api/v1/* paths are allowed" });
    }
    const config = getPluginConfig(ctx);
    const seerrUrl = config.url?.replace(/\/$/, "");
    const apiKey = config.apiKey;
    if (!seerrUrl || !apiKey) return reply.status(503).send({ message: "Seerr not configured" });
    const query = request.query;
    const qsParts = [];
    for (const [k, v] of Object.entries(query)) {
      if (k === "_lang") continue;
      qsParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    const qs = qsParts.join("&");
    const targetUrl = `${seerrUrl}/${wildcard}${qs ? `?${qs}` : ""}`;
    const headers = { "X-Api-Key": apiKey };
    if (query._lang) headers["Accept-Language"] = query._lang;
    let reqBody;
    if (request.body && ["POST", "PUT", "PATCH"].includes(request.method)) {
      headers["Content-Type"] = "application/json";
      reqBody = JSON.stringify(request.body);
    }
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: reqBody,
        signal: AbortSignal.timeout(15e3)
      });
      reply.status(response.status);
      const ct = response.headers.get("content-type");
      if (ct) reply.header("content-type", ct);
      if (!response.body) return reply.send();
      return reply.send(Readable.fromWeb(response.body));
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return reply.status(504).send({ message: "Seerr timeout" });
      }
      return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy failed" });
    }
  });
  const gwc = () => getWorkerConfig(ctx);
  registerRequestRoutes(app, prisma, gwc);
  registerBulkRoutes(app, prisma, gwc);
  registerProfileRoutes(app, () => getPluginConfig(ctx), () => {
    const c = getPluginConfig(ctx);
    const url = c.url;
    const apiKey = c.apiKey;
    if (!url || !apiKey) return null;
    return { seerrUrl: url.replace(/\/$/, ""), seerrApiKey: apiKey };
  });
  const providerCache = /* @__PURE__ */ new Map();
  app.post("/check-providers", async (request, reply) => {
    const body = request.body;
    if (!body.items || !Array.isArray(body.items)) return reply.status(400).send({ message: "items array required" });
    const config = getPluginConfig(ctx);
    const seerrUrl = config.url?.replace(/\/$/, "");
    const apiKey = config.apiKey;
    if (!seerrUrl || !apiKey) return reply.status(503).send({ message: "Seerr not configured" });
    const result = {};
    const toFetch = [];
    for (const item of body.items.slice(0, 200)) {
      const key = `${item.mediaType}-${item.tmdbId}`;
      const cached = providerCache.get(key);
      if (cached && Date.now() < cached.expires) {
        result[item.tmdbId] = cached.providers;
      } else {
        toFetch.push(item);
      }
    }
    const BATCH = 5;
    for (let i = 0; i < toFetch.length; i += BATCH) {
      const batch = toFetch.slice(i, i + BATCH);
      const responses = await Promise.allSettled(
        batch.map(async (item) => {
          const res = await fetch(`${seerrUrl}/api/v1/${item.mediaType}/${item.tmdbId}`, {
            headers: { "X-Api-Key": apiKey },
            signal: AbortSignal.timeout(8e3)
          });
          if (!res.ok) return { tmdbId: item.tmdbId, mediaType: item.mediaType, providers: [] };
          const data = await res.json();
          const region = data.watchProviders?.find((w) => w.iso_3166_1 === "FR") ?? data.watchProviders?.find((w) => w.iso_3166_1 === "US");
          const ids = region?.flatrate?.map((p) => p.id ?? p.providerId ?? 0).filter(Boolean) ?? [];
          return { tmdbId: item.tmdbId, mediaType: item.mediaType, providers: ids };
        })
      );
      for (const r of responses) {
        if (r.status === "fulfilled" && r.value) {
          const { tmdbId, mediaType, providers } = r.value;
          result[tmdbId] = providers;
          providerCache.set(`${mediaType}-${tmdbId}`, { providers, expires: Date.now() + 7 * 864e5 });
        }
      }
    }
    return result;
  });
  app.get("/queue/status", async (request) => {
    const user = request.user;
    const status = await getQueueStatus(prisma, user.isAdmin ? void 0 : user.userId);
    return { ...status, workerRunning: isWorkerRunning() };
  });
  app.get("/stats", async (request) => {
    const user = request.user;
    if (user.isAdmin) {
      const [personal, global] = await Promise.all([getUserStats(prisma, user.userId), getGlobalStats(prisma)]);
      return { personal, global };
    }
    return { personal: await getUserStats(prisma, user.userId) };
  });
  app.post("/worker/trigger", { preHandler: ctx.requireAdmin }, async () => {
    const config = await getWorkerConfig(ctx);
    if (!config) return { message: "Seerr not configured" };
    const next = await getQueueStatus(prisma);
    return { workerRunning: isWorkerRunning(), processing: next.processing, queued: next.queued, triggered: true };
  });
  console.log("[SeerBackend] Routes registered");
}
export {
  seerBackend as default
};
