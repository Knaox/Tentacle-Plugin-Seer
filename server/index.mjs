// Seer Plugin — Server module (auto-generated, do not edit)
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/db-helpers.ts
var db_helpers_exports = {};
__export(db_helpers_exports, {
  rowToRequest: () => rowToRequest,
  rowToUserSettings: () => rowToUserSettings,
  toIso: () => toIso,
  uuid: () => uuid
});
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
    profileId: r.profile_id || null,
    isAnime: Boolean(r.is_anime)
  };
}
function rowToUserSettings(r) {
  return {
    jellyfinUserId: r.jellyfin_user_id,
    username: r.username,
    blocked: Boolean(r.blocked),
    dailyLimit: r.daily_limit === null || r.daily_limit === void 0 ? null : Number(r.daily_limit),
    allowMovies: Boolean(r.allow_movies),
    allowTv: Boolean(r.allow_tv),
    allowAnime: Boolean(r.allow_anime),
    jellyseerrUserId: r.jellyseerr_user_id === null || r.jellyseerr_user_id === void 0 ? null : Number(r.jellyseerr_user_id),
    jellyseerrLastSync: r.jellyseerr_last_sync ? toIso(r.jellyseerr_last_sync) : null,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at)
  };
}
function toIso(v) {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return (/* @__PURE__ */ new Date()).toISOString();
}
var init_db_helpers = __esm({
  "server/db-helpers.ts"() {
    "use strict";
  }
});

// server/index.ts
import { Readable } from "stream";
import { resolve, dirname } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

// server/db.ts
init_db_helpers();
init_db_helpers();

// server/db-queries.ts
init_db_helpers();
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
init_db_helpers();
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
  await addColumn("seer_requests", "is_anime", "TINYINT(1) NOT NULL DEFAULT 0");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seer_user_settings (
      jellyfin_user_id     VARCHAR(255) NOT NULL PRIMARY KEY,
      username             VARCHAR(255) NOT NULL,
      blocked              TINYINT(1)   NOT NULL DEFAULT 0,
      daily_limit          INT          DEFAULT NULL,
      allow_movies         TINYINT(1)   NOT NULL DEFAULT 1,
      allow_tv             TINYINT(1)   NOT NULL DEFAULT 1,
      allow_anime          TINYINT(1)   NOT NULL DEFAULT 1,
      jellyseerr_user_id   INT          DEFAULT NULL,
      jellyseerr_last_sync DATETIME     DEFAULT NULL,
      created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_seer_user_seerrid (jellyseerr_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
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
       backdrop_path, overview, year, seasons, status, priority, profile_id, is_anime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`,
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
    data.profileId || null,
    data.isAnime ? 1 : 0
  );
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests WHERE id = ?`,
    id
  );
  return rowToRequest(rows[0]);
}
async function getOrCreateUserSettings(prisma, jellyfinUserId, username) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId
  );
  if (rows.length > 0) {
    if (username && rows[0].username !== username) {
      await prisma.$executeRawUnsafe(
        `UPDATE seer_user_settings SET username = ? WHERE jellyfin_user_id = ?`,
        username,
        jellyfinUserId
      );
      rows[0].username = username;
    }
    return rowToUserSettings(rows[0]);
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_user_settings
      (jellyfin_user_id, username, blocked, daily_limit, allow_movies, allow_tv, allow_anime)
     VALUES (?, ?, 0, NULL, 1, 1, 1)`,
    jellyfinUserId,
    username || jellyfinUserId
  );
  const created = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId
  );
  return rowToUserSettings(created[0]);
}
async function getUserSettings(prisma, jellyfinUserId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId
  );
  return rows.length > 0 ? rowToUserSettings(rows[0]) : null;
}
async function updateUserSettings(prisma, jellyfinUserId, patch) {
  const sets = [];
  const params = [];
  if (patch.blocked !== void 0) {
    sets.push("blocked = ?");
    params.push(patch.blocked ? 1 : 0);
  }
  if (patch.dailyLimit !== void 0) {
    sets.push("daily_limit = ?");
    params.push(patch.dailyLimit);
  }
  if (patch.allowMovies !== void 0) {
    sets.push("allow_movies = ?");
    params.push(patch.allowMovies ? 1 : 0);
  }
  if (patch.allowTv !== void 0) {
    sets.push("allow_tv = ?");
    params.push(patch.allowTv ? 1 : 0);
  }
  if (patch.allowAnime !== void 0) {
    sets.push("allow_anime = ?");
    params.push(patch.allowAnime ? 1 : 0);
  }
  if (patch.jellyseerrUserId !== void 0) {
    sets.push("jellyseerr_user_id = ?");
    params.push(patch.jellyseerrUserId);
  }
  if (patch.jellyseerrLastSync !== void 0) {
    sets.push("jellyseerr_last_sync = ?");
    params.push(patch.jellyseerrLastSync);
  }
  if (patch.username !== void 0) {
    sets.push("username = ?");
    params.push(patch.username);
  }
  if (sets.length === 0) return;
  params.push(jellyfinUserId);
  await prisma.$executeRawUnsafe(
    `UPDATE seer_user_settings SET ${sets.join(", ")} WHERE jellyfin_user_id = ?`,
    ...params
  );
}
async function countRequestsToday(prisma, jellyfinUserId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ?
       AND created_at >= CURDATE()
       AND status NOT IN ('failed', 'deleted')`,
    jellyfinUserId
  );
  return Number(rows[0].cnt);
}
async function listUsersWithStats(prisma) {
  const settingsRows = await prisma.$queryRawUnsafe(
    `SELECT s.*,
       (SELECT COUNT(*) FROM seer_requests r
          WHERE r.jellyfin_user_id = s.jellyfin_user_id
            AND r.created_at >= CURDATE()
            AND r.status NOT IN ('failed', 'deleted')) AS requests_today,
       (SELECT COUNT(*) FROM seer_requests r
          WHERE r.jellyfin_user_id = s.jellyfin_user_id
            AND r.status != 'deleted') AS requests_total
     FROM seer_user_settings s
     ORDER BY s.username ASC`
  );
  const known = new Set(settingsRows.map((r) => r.jellyfin_user_id));
  const orphanRows = await prisma.$queryRawUnsafe(
    `SELECT
       r.jellyfin_user_id,
       MAX(r.username) AS username,
       SUM(CASE WHEN r.created_at >= CURDATE() AND r.status NOT IN ('failed','deleted') THEN 1 ELSE 0 END) AS requests_today,
       SUM(CASE WHEN r.status != 'deleted' THEN 1 ELSE 0 END) AS requests_total
     FROM seer_requests r
     GROUP BY r.jellyfin_user_id`
  );
  const result = settingsRows.map((r) => ({
    ...rowToUserSettings(r),
    requestsToday: Number(r.requests_today) || 0,
    requestsTotal: Number(r.requests_total) || 0
  }));
  for (const o of orphanRows) {
    if (known.has(o.jellyfin_user_id)) continue;
    const userId = o.jellyfin_user_id;
    const username = o.username || userId;
    result.push({
      jellyfinUserId: userId,
      username,
      blocked: false,
      dailyLimit: null,
      allowMovies: true,
      allowTv: true,
      allowAnime: true,
      jellyseerrUserId: null,
      jellyseerrLastSync: null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      requestsToday: Number(o.requests_today) || 0,
      requestsTotal: Number(o.requests_total) || 0
    });
  }
  return result.sort((a, b) => a.username.localeCompare(b.username));
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
    `UPDATE seer_requests SET seasons = ? WHERE id = ?`,
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

// server/cache.ts
var store = /* @__PURE__ */ new Map();
var inflight = /* @__PURE__ */ new Map();
async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    return hit.value;
  }
  const pending = inflight.get(key);
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
function invalidate(prefix) {
  for (const key of Array.from(store.keys())) {
    if (key === prefix || key.startsWith(prefix + ":")) {
      store.delete(key);
    }
  }
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expires <= now) store.delete(key);
  }
}, 6e4).unref?.();

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
          invalidate(`seer-cache:${request.jellyfinUserId}`);
          continue;
        }
        const extra = { seerrMediaStatus: data.media?.status };
        if (newStatus === "available") extra.completedAt = /* @__PURE__ */ new Date();
        await updateRequestStatus(prisma, request.id, newStatus, extra);
        invalidate(`seer-cache:${request.jellyfinUserId}`);
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
  if (mediaStatus === 5) return "available";
  if (mediaStatus === 4) return "partially_available";
  if (mediaStatus === 3) return "downloading";
  if (requestStatus === 1) return "sent_to_seer";
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

// server/worker-cleanup.ts
async function processCleanupQueue(prisma, config) {
  const jobs = await getPendingCleanups(prisma);
  if (jobs.length === 0) return;
  const job = jobs[0];
  const headers = { "X-Api-Key": config.seerrApiKey };
  try {
    if (job.deleteFiles && job.seerrMediaId) {
      const fileRes = await fetch(
        `${config.seerrUrl}/api/v1/media/${job.seerrMediaId}/file?is4k=false`,
        { method: "DELETE", headers, signal: AbortSignal.timeout(3e4) }
      );
      if (!fileRes.ok && fileRes.status !== 404) {
        const body = await fileRes.text().catch(() => "");
        throw new Error(`Jellyseerr /media/file returned ${fileRes.status}: ${body.slice(0, 200)}`);
      }
      console.log(`[SeerWorker] Deleted files via Jellyseerr for "${job.title}" (status=${fileRes.status})`);
    }
    if (job.deleteFiles && job.seerrMediaId) {
      const mediaRes = await fetch(
        `${config.seerrUrl}/api/v1/media/${job.seerrMediaId}`,
        { method: "DELETE", headers, signal: AbortSignal.timeout(15e3) }
      );
      if (!mediaRes.ok && mediaRes.status !== 404) {
        console.warn(`[SeerWorker] Seerr media delete returned ${mediaRes.status} for "${job.title}"`);
      }
    }
    if (job.seerrRequestId) {
      await fetch(
        `${config.seerrUrl}/api/v1/request/${job.seerrRequestId}`,
        { method: "DELETE", headers, signal: AbortSignal.timeout(1e4) }
      ).catch(() => {
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

// server/jellyseerr-user.ts
async function resolveJellyseerrUserId(config, prisma, jellyfinUserId, username) {
  const settings = await getOrCreateUserSettings(prisma, jellyfinUserId, username);
  if (settings.jellyseerrUserId) return settings.jellyseerrUserId;
  const found = await findJellyseerrUserByJellyfinId(config, jellyfinUserId);
  if (found) {
    await updateUserSettings(prisma, jellyfinUserId, {
      jellyseerrUserId: found.id,
      jellyseerrLastSync: /* @__PURE__ */ new Date()
    });
    return found.id;
  }
  if (username) {
    const placeholder = await findOrphanPlaceholderByUsername(config, username);
    if (placeholder) {
      await relinkJellyseerrUserToJellyfin(config, placeholder.id, jellyfinUserId);
      await updateUserSettings(prisma, jellyfinUserId, {
        jellyseerrUserId: placeholder.id,
        jellyseerrLastSync: /* @__PURE__ */ new Date()
      });
      return placeholder.id;
    }
  }
  try {
    const imported = await importJellyseerrUserFromJellyfin(config, jellyfinUserId);
    if (imported) {
      await updateUserSettings(prisma, jellyfinUserId, {
        jellyseerrUserId: imported.id,
        jellyseerrLastSync: /* @__PURE__ */ new Date()
      });
      return imported.id;
    }
  } catch {
  }
  const refreshed = await findJellyseerrUserByJellyfinId(config, jellyfinUserId);
  if (refreshed) {
    await updateUserSettings(prisma, jellyfinUserId, {
      jellyseerrUserId: refreshed.id,
      jellyseerrLastSync: /* @__PURE__ */ new Date()
    });
    return refreshed.id;
  }
  throw new Error(`Unable to resolve Jellyseerr user for jellyfinUserId=${jellyfinUserId}`);
}
async function findOrphanPlaceholderByUsername(config, username) {
  const all = await listAllJellyseerrUsers(config);
  const target = username.trim().toLowerCase();
  return all.find(
    (u) => !u.jellyfinUserId && (u.username && u.username.trim().toLowerCase() === target || u.jellyfinUsername && u.jellyfinUsername.trim().toLowerCase() === target)
  ) ?? null;
}
async function createPlaceholderJellyseerrUser(config, username) {
  const existing = await findOrphanPlaceholderByUsername(config, username);
  if (existing) return existing;
  const email = `${username.toLowerCase().replace(/[^a-z0-9._-]+/g, "")}@tentacle.local`;
  const res = await fetch(`${config.seerrUrl}/api/v1/user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ email, username }),
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr POST /user failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return await res.json();
}
async function relinkJellyseerrUserToJellyfin(config, jellyseerrUserId, jellyfinUserId) {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/${jellyseerrUserId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ jellyfinUserId }),
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr PUT /user/${jellyseerrUserId} failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
async function findJellyseerrUserByJellyfinId(config, jellyfinUserId) {
  const all = await listAllJellyseerrUsers(config);
  const normalized = (id) => (id || "").toLowerCase().replace(/-/g, "");
  const target = normalized(jellyfinUserId);
  return all.find((u) => normalized(u.jellyfinUserId) === target) ?? null;
}
async function listAllJellyseerrUsers(config) {
  const out = [];
  let skip = 0;
  const take = 100;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${config.seerrUrl}/api/v1/user?take=${take}&skip=${skip}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      throw new Error(`Jellyseerr GET /user failed: ${res.status}`);
    }
    const data = await res.json();
    const page = data.results ?? [];
    out.push(...page);
    if (page.length < take) break;
    skip += take;
  }
  return out;
}
async function importJellyseerrUserFromJellyfin(config, jellyfinUserId) {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/import-from-jellyfin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ jellyfinUserIds: [jellyfinUserId] }),
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr import-from-jellyfin failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) return data[0];
  if (!Array.isArray(data) && data && typeof data === "object") return data;
  return null;
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
    const seerUserId = await resolveJellyseerrUserId(
      config,
      prisma,
      request.jellyfinUserId,
      request.username
    );
    seerrBody.userId = seerUserId;
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
    invalidate(`seer-cache:${request.jellyfinUserId}`);
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
      if (request.retryCount === 0) {
        await prisma.notification.create({
          data: {
            jellyfinUserId: request.jellyfinUserId,
            type: "request_status",
            title: request.title,
            body: `Votre demande pour \xAB ${request.title} \xBB a rencontr\xE9 une erreur, elle sera r\xE9essay\xE9e automatiquement`,
            refId: request.id
          }
        });
      }
      console.warn(`[SeerWorker] Request for "${request.title}" retry ${newRetryCount}/${request.maxRetries}: ${errMsg}`);
    }
  }
}

// server/routes-requests.ts
function getUser(request) {
  return request.user;
}
function seerrRequestToUnified(sr, detail, localById, fallbackUser) {
  const local = localById.get(sr.id);
  const status = mapSeerrStatus(sr.status, sr.media?.status, sr.media?.downloadStatus);
  const seasons = sr.seasons?.map((s) => s.seasonNumber).filter((n) => typeof n === "number") ?? null;
  const mediaType = sr.media?.mediaType ?? "movie";
  const title = detail?.title ?? detail?.name ?? local?.title ?? `#${sr.id}`;
  const year = (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null;
  return {
    id: local?.id ?? `seerr-${sr.id}`,
    source: "seerr",
    jellyfinUserId: sr.requestedBy?.jellyfinUserId ?? fallbackUser.jellyfinUserId,
    username: sr.requestedBy?.jellyfinUsername ?? fallbackUser.username,
    mediaType,
    tmdbId: sr.media?.tmdbId ?? 0,
    title,
    posterPath: detail?.posterPath ?? local?.posterPath ?? null,
    backdropPath: detail?.backdropPath ?? local?.backdropPath ?? null,
    overview: detail?.overview ?? local?.overview ?? null,
    year: year || local?.year || null,
    seasons: seasons && seasons.length > 0 ? seasons : local?.seasons ?? null,
    status,
    seerrRequestId: sr.id,
    seerrMediaId: sr.media?.id ?? null,
    seerrMediaStatus: sr.media?.status ?? null,
    retryCount: local?.retryCount ?? 0,
    maxRetries: local?.maxRetries ?? 10,
    lastError: local?.lastError ?? null,
    priority: local?.priority ?? 0,
    createdAt: sr.createdAt ?? local?.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: sr.updatedAt ?? local?.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    sentAt: local?.sentAt ?? null,
    completedAt: local?.completedAt ?? null,
    profileId: local?.profileId ?? null,
    isAnime: local?.isAnime ?? false
  };
}
function localToUnified(r) {
  return {
    id: r.id,
    source: "local",
    jellyfinUserId: r.jellyfinUserId,
    username: r.username,
    mediaType: r.mediaType,
    tmdbId: r.tmdbId,
    title: r.title,
    posterPath: r.posterPath,
    backdropPath: r.backdropPath,
    overview: r.overview,
    year: r.year,
    seasons: r.seasons,
    status: r.status,
    seerrRequestId: r.seerrRequestId,
    seerrMediaId: r.seerrMediaId,
    seerrMediaStatus: r.seerrMediaStatus,
    retryCount: r.retryCount,
    maxRetries: r.maxRetries,
    lastError: r.lastError,
    priority: r.priority,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    sentAt: r.sentAt,
    completedAt: r.completedAt,
    profileId: r.profileId,
    isAnime: r.isAnime
  };
}
async function fetchSeerrRequestsForUser(config, seerUserId, take, skip) {
  const url = `${config.seerrUrl}/api/v1/request?take=${take}&skip=${skip}&filter=all&sort=added&requestedBy=${seerUserId}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jellyseerr GET /request?requestedBy=${seerUserId} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return { rows: data.results ?? [], total: data.pageInfo?.results ?? data.results?.length ?? 0 };
}
async function fetchSeerrTmdbDetail(config, mediaType, tmdbId) {
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function fetchSeerrRequestById(config, seerrId) {
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/request/${seerrId}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
function parseRequestId(id) {
  if (id.startsWith("seerr-")) {
    const n = Number(id.slice(6));
    if (Number.isFinite(n)) return { kind: "seerr", seerrId: n };
  }
  return { kind: "local", id };
}
function registerRequestRoutes(app, prisma, getWorkerConfig2) {
  app.get("/requests/stats", async (request, reply) => {
    const user = getUser(request);
    const config = await getWorkerConfig2();
    return cached(`seer-cache:${user.userId}:stats`, 6e4, async () => {
      const byStatus = {};
      const byType = { movie: 0, tv: 0 };
      let total = 0;
      if (config) {
        try {
          const seerUserId = await resolveJellyseerrUserId(config, prisma, user.userId, user.username);
          let skip = 0;
          const take = 100;
          for (let i = 0; i < 25; i++) {
            const { rows } = await fetchSeerrRequestsForUser(config, seerUserId, take, skip);
            for (const sr of rows) {
              total++;
              const status = mapSeerrStatus(sr.status, sr.media?.status, sr.media?.downloadStatus);
              byStatus[status] = (byStatus[status] ?? 0) + 1;
              const mt = sr.media?.mediaType;
              if (mt === "movie") byType.movie++;
              else if (mt === "tv") byType.tv++;
            }
            if (rows.length < take) break;
            skip += take;
          }
        } catch (err) {
          request.log?.warn?.({ err }, "Seerr stats fetch failed");
        }
      }
      const localPending = await prisma.$queryRawUnsafe(
        `SELECT status, media_type FROM seer_requests
         WHERE jellyfin_user_id = ?
           AND seerr_request_id IS NULL
           AND status IN ('queued','processing','retry_pending','failed')`,
        user.userId
      );
      for (const r of localPending) {
        total++;
        byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
        if (r.media_type === "movie") byType.movie++;
        else if (r.media_type === "tv") byType.tv++;
      }
      return { total, byStatus, byType };
    });
  });
  app.get("/requests", async (request, reply) => {
    const user = getUser(request);
    const query = request.query;
    if (user.isAdmin && query.status === "all_users") {
      const list = await getAllRequests(prisma, {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        mediaType: query.type
      });
      return { ...list, results: list.results.map(localToUnified) };
    }
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const config = await getWorkerConfig2();
    if (!config) {
      const local = await getUserRequests(prisma, user.userId, { page, limit, mediaType: query.type });
      return { ...local, results: local.results.map(localToUnified) };
    }
    const merged = await cached(
      `seer-cache:${user.userId}:list`,
      6e4,
      async () => {
        const { rowToRequest: rowToRequest2 } = await Promise.resolve().then(() => (init_db_helpers(), db_helpers_exports));
        const localPendingRows = await prisma.$queryRawUnsafe(
          `SELECT * FROM seer_requests
           WHERE jellyfin_user_id = ?
             AND status IN ('queued','processing','retry_pending','failed','deleting','delete_failed')
           ORDER BY created_at DESC`,
          user.userId
        );
        const localPending = localPendingRows.map(rowToRequest2);
        const localBySeerrId = /* @__PURE__ */ new Map();
        const allLocalRows = await prisma.$queryRawUnsafe(
          `SELECT * FROM seer_requests WHERE jellyfin_user_id = ? AND seerr_request_id IS NOT NULL`,
          user.userId
        );
        for (const row of allLocalRows) {
          const r = rowToRequest2(row);
          if (r.seerrRequestId) localBySeerrId.set(r.seerrRequestId, r);
        }
        let seerrUnified = [];
        try {
          const seerUserId = await resolveJellyseerrUserId(config, prisma, user.userId, user.username);
          const take = 100;
          const allRows = [];
          let skip = 0;
          for (let i = 0; i < 25; i++) {
            const { rows } = await fetchSeerrRequestsForUser(config, seerUserId, take, skip);
            allRows.push(...rows);
            if (rows.length < take) break;
            skip += take;
          }
          const detailCache = /* @__PURE__ */ new Map();
          const tasks = allRows.map(async (sr) => {
            if (!sr.media) return null;
            const key = `${sr.media.mediaType}-${sr.media.tmdbId}`;
            if (!detailCache.has(key)) {
              detailCache.set(key, await fetchSeerrTmdbDetail(config, sr.media.mediaType, sr.media.tmdbId));
            }
            return seerrRequestToUnified(sr, detailCache.get(key) ?? null, localBySeerrId, {
              jellyfinUserId: user.userId,
              username: user.username
            });
          });
          seerrUnified = (await Promise.all(tasks)).filter((x) => x !== null);
        } catch (err) {
          request.log?.warn?.({ err }, "Seerr fetch failed, falling back to local only");
        }
        const seerrSeenIds = new Set(seerrUnified.map((u) => u.seerrRequestId).filter(Boolean));
        const localFiltered = localPending.filter((l) => !l.seerrRequestId || !seerrSeenIds.has(l.seerrRequestId)).map(localToUnified);
        const out = [...localFiltered, ...seerrUnified];
        out.sort((a, b) => b.createdAt > a.createdAt ? 1 : -1);
        return out;
      }
    );
    let filtered = merged;
    if (query.type) {
      filtered = filtered.filter((r) => r.mediaType === query.type);
    }
    if (query.status) {
      const wanted = new Set(query.status.split(",").map((s) => s.trim()));
      filtered = filtered.filter((r) => wanted.has(r.status));
    }
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const sliced = filtered.slice(offset, offset + limit);
    return {
      results: sliced,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit))
    };
  });
  app.post("/requests", async (request, reply) => {
    const user = getUser(request);
    const body = request.body;
    if (!body.mediaType || !body.tmdbId || !body.title) {
      return reply.status(400).send({ message: "mediaType, tmdbId, and title are required" });
    }
    const settings = await getOrCreateUserSettings(prisma, user.userId, user.username);
    if (settings.blocked) {
      return reply.status(403).send({ errorKey: "seer:errUserBlocked", message: "User is blocked" });
    }
    let isAnime = false;
    const config = await getWorkerConfig2();
    if (body.mediaType === "tv" && config) {
      const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, "tv", body.tmdbId);
      if (detail && isAnimeFromKeywords(detail)) isAnime = true;
    }
    if (body.mediaType === "movie" && !settings.allowMovies) {
      return reply.status(403).send({ errorKey: "seer:errMoviesDenied", message: "Movies denied" });
    }
    if (body.mediaType === "tv" && isAnime && !settings.allowAnime) {
      return reply.status(403).send({ errorKey: "seer:errAnimeDenied", message: "Anime denied" });
    }
    if (body.mediaType === "tv" && !isAnime && !settings.allowTv) {
      return reply.status(403).send({ errorKey: "seer:errTvDenied", message: "TV denied" });
    }
    if (settings.dailyLimit !== null && settings.dailyLimit !== void 0) {
      const todayCount = await countRequestsToday(prisma, user.userId);
      if (todayCount >= settings.dailyLimit) {
        return reply.status(429).send({
          errorKey: "seer:errQuotaReached",
          limit: settings.dailyLimit,
          message: `Daily quota reached (${settings.dailyLimit})`
        });
      }
    }
    if (body.mediaType === "tv" && body.seasons?.length) {
      const existing = await findExistingTvRequest(prisma, user.userId, body.tmdbId);
      if (existing) {
        const existingSeasons = new Set(existing.seasons ?? []);
        const newSeasons = body.seasons.filter((s) => !existingSeasons.has(s));
        if (newSeasons.length === 0) {
          return reply.status(409).send({ message: "All seasons already requested", existing });
        }
        const merged = [...existing.seasons ?? [], ...newSeasons].sort((a, b) => a - b);
        await addSeasonsToRequest(prisma, existing.id, merged);
        await createRequest(prisma, {
          jellyfinUserId: user.userId,
          username: user.username,
          mediaType: body.mediaType,
          tmdbId: body.tmdbId,
          title: body.title,
          posterPath: body.posterPath,
          backdropPath: body.backdropPath,
          overview: body.overview,
          year: body.year,
          seasons: newSeasons,
          profileId: body.profileId ?? existing.profileId,
          isAnime
        });
        const updated = await getRequestById(prisma, existing.id);
        invalidate(`seer-cache:${user.userId}`);
        return reply.status(201).send(updated);
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
      profileId: body.profileId,
      isAnime
    });
    invalidate(`seer-cache:${user.userId}`);
    return reply.status(201).send(req);
  });
  app.delete("/requests/:id", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const deleteFiles = body.deleteFiles === true;
    const parsed = parseRequestId(id);
    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
        return reply.status(403).send({ message: "Not your request" });
      }
      const isSeasonSpecific = req.mediaType === "tv" && body.seasons && body.seasons.length > 0;
      const isFullSeries = req.mediaType === "tv" && !isSeasonSpecific;
      if (req.mediaType === "movie" || isFullSeries) {
        await updateRequestStatus(prisma, parsed.id, "deleting");
        await enqueueCleanup(prisma, {
          action: "delete",
          mediaType: req.mediaType,
          tmdbId: req.tmdbId,
          title: req.title,
          seerrRequestId: req.seerrRequestId,
          seerrMediaId: req.seerrMediaId,
          deleteFiles,
          requestId: parsed.id
        });
      } else {
        await deleteRequestById(prisma, parsed.id);
      }
      invalidate(`seer-cache:${user.userId}`);
      return { success: true, status: "deleting" };
    }
    const config = await getWorkerConfig2();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
    if (!seerrReq) return reply.status(404).send({ message: "Seerr request not found" });
    if (!user.isAdmin) {
      const settingsRows = await prisma.$queryRawUnsafe(
        `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
        user.userId
      );
      const myId = settingsRows[0]?.jellyseerr_user_id ?? null;
      if (!myId || seerrReq.requestedBy?.id !== myId) {
        return reply.status(403).send({ message: "Not your request" });
      }
    }
    await enqueueCleanup(prisma, {
      action: "delete",
      mediaType: seerrReq.media?.mediaType ?? "movie",
      tmdbId: seerrReq.media?.tmdbId ?? 0,
      title: `#${seerrReq.id}`,
      seerrRequestId: seerrReq.id,
      seerrMediaId: seerrReq.media?.id ?? null,
      deleteFiles,
      requestId: null
    });
    invalidate(`seer-cache:${user.userId}`);
    return { success: true, status: "deleting" };
  });
  app.post("/requests/:id/retry", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const forceRedownload = body.forceRedownload === true;
    const parsed = parseRequestId(id);
    const config = await getWorkerConfig2();
    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
        return reply.status(403).send({ message: "Not your request" });
      }
      const newProfileId = body.profileId !== void 0 ? body.profileId : req.profileId;
      if (config) {
        if (req.seerrRequestId) {
          await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
        if (forceRedownload && req.seerrMediaId) {
          await fetch(`${config.seerrUrl}/api/v1/media/${req.seerrMediaId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
      }
      await deleteRequestById(prisma, parsed.id);
      const retrySeasons2 = body.seasons && body.seasons.length > 0 ? body.seasons : req.seasons;
      const newReq2 = await createRequest(prisma, {
        jellyfinUserId: req.jellyfinUserId,
        username: req.username,
        mediaType: req.mediaType,
        tmdbId: req.tmdbId,
        title: req.title,
        posterPath: req.posterPath,
        backdropPath: req.backdropPath,
        overview: req.overview,
        year: req.year,
        seasons: retrySeasons2,
        priority: 1,
        profileId: newProfileId,
        isAnime: req.isAnime
      });
      invalidate(`seer-cache:${user.userId}`);
      return reply.status(201).send(newReq2);
    }
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
    if (!seerrReq) return reply.status(404).send({ message: "Seerr request not found" });
    if (!user.isAdmin) {
      const settingsRows = await prisma.$queryRawUnsafe(
        `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
        user.userId
      );
      const myId = settingsRows[0]?.jellyseerr_user_id ?? null;
      if (!myId || seerrReq.requestedBy?.id !== myId) {
        return reply.status(403).send({ message: "Not your request" });
      }
    }
    const mediaType = seerrReq.media?.mediaType ?? "movie";
    const tmdbId = seerrReq.media?.tmdbId ?? 0;
    if (!tmdbId) return reply.status(400).send({ message: "Cannot retry: missing TMDB id" });
    const detail = await fetchSeerrTmdbDetail(config, mediaType, tmdbId);
    const title = detail?.title ?? detail?.name ?? `#${seerrReq.id}`;
    await fetch(`${config.seerrUrl}/api/v1/request/${seerrReq.id}`, {
      method: "DELETE",
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    }).catch(() => {
    });
    if (forceRedownload && seerrReq.media?.id) {
      await fetch(`${config.seerrUrl}/api/v1/media/${seerrReq.media.id}`, {
        method: "DELETE",
        headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(1e4)
      }).catch(() => {
      });
    }
    const retrySeasons = body.seasons && body.seasons.length > 0 ? body.seasons : seerrReq.seasons?.map((s) => s.seasonNumber) ?? null;
    const newReq = await createRequest(prisma, {
      jellyfinUserId: user.userId,
      username: user.username,
      mediaType,
      tmdbId,
      title,
      posterPath: detail?.posterPath ?? null,
      backdropPath: detail?.backdropPath ?? null,
      overview: detail?.overview ?? null,
      year: (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null,
      seasons: retrySeasons,
      priority: 1,
      profileId: body.profileId ?? null,
      isAnime: false
    });
    invalidate(`seer-cache:${user.userId}`);
    return reply.status(201).send(newReq);
  });
  app.post("/requests/:id/mark", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const target = body.status;
    if (!target || !["available", "partial", "unknown"].includes(target)) {
      return reply.status(400).send({ message: "status must be 'available', 'partial' or 'unknown'" });
    }
    const config = await getWorkerConfig2();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const parsed = parseRequestId(id);
    let seerrMediaId = null;
    let ownerJellyfinUserId = null;
    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      seerrMediaId = req.seerrMediaId;
      ownerJellyfinUserId = req.jellyfinUserId;
    } else {
      const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
      if (!seerrReq) return reply.status(404).send({ message: "Seerr request not found" });
      seerrMediaId = seerrReq.media?.id ?? null;
      if (seerrReq.requestedBy?.id) {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT jellyfin_user_id FROM seer_user_settings WHERE jellyseerr_user_id = ? LIMIT 1`,
          seerrReq.requestedBy.id
        );
        ownerJellyfinUserId = rows[0]?.jellyfin_user_id ?? null;
      }
    }
    if (!seerrMediaId) return reply.status(400).send({ message: "No Jellyseerr media linked" });
    if (!user.isAdmin && ownerJellyfinUserId && ownerJellyfinUserId !== user.userId) {
      return reply.status(403).send({ message: "Not your request" });
    }
    const res = await fetch(`${config.seerrUrl}/api/v1/media/${seerrMediaId}/${target}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
      body: JSON.stringify({ is4k: false }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return reply.status(502).send({
        message: `Jellyseerr mark ${target} failed: ${res.status} ${text.slice(0, 200)}`
      });
    }
    if (parsed.kind === "local") {
      const localStatus = target === "available" ? "available" : target === "partial" ? "partially_available" : "sent_to_seer";
      await updateRequestStatus(prisma, parsed.id, localStatus);
    }
    invalidate(`seer-cache:${user.userId}`);
    return { success: true, target };
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

// server/routes-users.ts
function registerUsersRoutes(app, prisma, getWorkerConfig2, requireAdmin) {
  app.get(
    "/admin/users",
    { preHandler: requireAdmin },
    async () => {
      return await listUsersWithStats(prisma);
    }
  );
  app.put(
    "/admin/users/:jellyfinUserId",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { jellyfinUserId } = request.params;
      const body = request.body ?? {};
      const current = await getUserSettings(prisma, jellyfinUserId);
      const usernameForCreation = current?.username || jellyfinUserId;
      const existing = await getOrCreateUserSettings(prisma, jellyfinUserId, usernameForCreation);
      let dailyLimit = body.dailyLimit;
      if (dailyLimit === 0 || typeof dailyLimit === "string" && dailyLimit === "") {
        dailyLimit = null;
      }
      if (typeof dailyLimit === "number" && Number.isNaN(dailyLimit)) dailyLimit = null;
      await updateUserSettings(prisma, jellyfinUserId, {
        blocked: body.blocked,
        dailyLimit,
        allowMovies: body.allowMovies,
        allowTv: body.allowTv,
        allowAnime: body.allowAnime
      });
      const all = await listUsersWithStats(prisma);
      const updated = all.find((u) => u.jellyfinUserId === jellyfinUserId);
      return updated ?? existing;
    }
  );
  app.post(
    "/admin/users/sync",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const config = await getWorkerConfig2();
      if (!config) return reply.status(503).send({ message: "Seerr not configured" });
      let users = [];
      let jellyfinError = null;
      try {
        users = await fetchJellyfinUsers();
      } catch (err) {
        jellyfinError = err instanceof Error ? err.message : "Jellyfin fetch failed";
      }
      try {
        const seerUsers = await listAllJellyseerrUsers(config);
        const known = new Set(users.map((u) => u.id));
        for (const su of seerUsers) {
          if (!su.jellyfinUserId || known.has(su.jellyfinUserId)) continue;
          users.push({
            id: su.jellyfinUserId,
            name: su.jellyfinUsername || su.username || su.jellyfinUserId
          });
        }
      } catch {
        if (jellyfinError && users.length === 0) {
          return reply.status(503).send({ message: `Sync failed: ${jellyfinError}` });
        }
      }
      let created = 0;
      const isUuid = /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i;
      for (const u of users) {
        const existing = await prisma.$queryRawUnsafe(
          `SELECT jellyfin_user_id, username FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
          u.id
        );
        if (existing.length === 0) {
          created++;
          await getOrCreateUserSettings(prisma, u.id, u.name);
        } else if (u.name && u.name !== u.id && (isUuid.test(existing[0].username) || existing[0].username === u.id)) {
          await updateUserSettings(prisma, u.id, { username: u.name });
        }
      }
      const all = await listUsersWithStats(prisma);
      let synced = 0;
      let failed = 0;
      for (const u of all) {
        try {
          await resolveJellyseerrUserId(config, prisma, u.jellyfinUserId, u.username);
          synced++;
        } catch {
          failed++;
        }
      }
      return { synced, failed, created, total: all.length, jellyfinAdminOk: jellyfinError === null };
    }
  );
  app.post(
    "/admin/sync-requests-ownership",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const config = await getWorkerConfig2();
      if (!config) return reply.status(503).send({ message: "Seerr not configured" });
      let alreadyOk = 0;
      let reassigned = 0;
      let orphansCreated = 0;
      let failed = 0;
      const usersTouched = /* @__PURE__ */ new Set();
      const errors = [];
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, jellyfin_user_id, username, seerr_request_id, seerr_media_id, media_type, tmdb_id
         FROM seer_requests
         WHERE seerr_request_id IS NOT NULL
           AND status NOT IN ('deleted','deleting','delete_failed')`
      );
      const targetByJellyfin = /* @__PURE__ */ new Map();
      const distinctUsers = /* @__PURE__ */ new Map();
      for (const r of rows) {
        if (!distinctUsers.has(r.jellyfin_user_id)) distinctUsers.set(r.jellyfin_user_id, r.username);
      }
      for (const [jfUserId, jfUsername] of distinctUsers) {
        try {
          const seerUserId = await resolveJellyseerrUserId(config, prisma, jfUserId, jfUsername);
          targetByJellyfin.set(jfUserId, seerUserId);
        } catch {
          try {
            const placeholder = await createPlaceholderJellyseerrUser(config, jfUsername);
            await updateUserSettings(prisma, jfUserId, {
              jellyseerrUserId: placeholder.id,
              jellyseerrLastSync: /* @__PURE__ */ new Date()
            });
            targetByJellyfin.set(jfUserId, placeholder.id);
            orphansCreated++;
          } catch (err) {
            errors.push({
              requestId: jfUserId,
              reason: err instanceof Error ? err.message : "placeholder creation failed"
            });
          }
        }
      }
      for (const r of rows) {
        if (!r.seerr_request_id) continue;
        const target = targetByJellyfin.get(r.jellyfin_user_id);
        if (!target) {
          failed++;
          continue;
        }
        try {
          const result = await reassignSeerrRequestOwnership(
            config,
            r.seerr_request_id,
            target
          );
          if (result.method === "skip") {
            alreadyOk++;
          } else {
            reassigned++;
            usersTouched.add(r.jellyfin_user_id);
            if (result.method === "recreate" && result.newRequestId) {
              await prisma.$executeRawUnsafe(
                `UPDATE seer_requests SET seerr_request_id = ? WHERE id = ?`,
                result.newRequestId,
                r.id
              );
            }
          }
        } catch (err) {
          failed++;
          errors.push({
            requestId: r.id,
            reason: err instanceof Error ? err.message : "reassign failed"
          });
        }
      }
      for (const uid of usersTouched) invalidate(`seer-cache:${uid}`);
      return {
        total: rows.length,
        reassigned,
        alreadyOk,
        orphansCreated,
        failed,
        errors: errors.slice(0, 20)
        // limiter le payload
      };
    }
  );
}
async function reassignSeerrRequestOwnership(config, seerrRequestId, targetUserId) {
  const headers = { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey };
  const cur = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  });
  if (!cur.ok) {
    throw new Error(`GET request ${seerrRequestId} failed: ${cur.status}`);
  }
  const req = await cur.json();
  if (req.requestedBy?.id === targetUserId) return { method: "skip" };
  const putBody = {
    mediaType: req.media?.mediaType,
    userId: targetUserId
  };
  if (req.serverId != null) putBody.serverId = req.serverId;
  if (req.profileId != null) putBody.profileId = req.profileId;
  if (req.rootFolder) putBody.rootFolder = req.rootFolder;
  if (req.languageProfileId != null) putBody.languageProfileId = req.languageProfileId;
  if (req.tags?.length) putBody.tags = req.tags;
  const putRes = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(putBody),
    signal: AbortSignal.timeout(15e3)
  });
  if (putRes.ok) {
    const updated = await putRes.json().catch(() => null);
    if (updated?.requestedBy?.id === targetUserId) {
      return { method: "put" };
    }
  }
  await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "DELETE",
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  }).catch(() => {
  });
  if (!req.media?.tmdbId || !req.media?.mediaType) {
    throw new Error("missing media info for recreate");
  }
  const createBody = {
    mediaType: req.media.mediaType,
    mediaId: req.media.tmdbId,
    userId: targetUserId
  };
  if (req.seasons?.length) createBody.seasons = req.seasons.map((s) => s.seasonNumber);
  if (req.serverId != null) createBody.serverId = req.serverId;
  if (req.profileId != null) createBody.profileId = req.profileId;
  if (req.rootFolder) createBody.rootFolder = req.rootFolder;
  if (req.languageProfileId != null) createBody.languageProfileId = req.languageProfileId;
  if (req.tags?.length) createBody.tags = req.tags;
  const postRes = await fetch(`${config.seerrUrl}/api/v1/request`, {
    method: "POST",
    headers,
    body: JSON.stringify(createBody),
    signal: AbortSignal.timeout(15e3)
  });
  if (!postRes.ok) {
    const text = await postRes.text().catch(() => "");
    throw new Error(`recreate failed (${postRes.status}): ${text.slice(0, 200)}`);
  }
  const created = await postRes.json();
  return { method: "recreate", newRequestId: created.id };
}
async function fetchJellyfinUsers() {
  const baseUrl = (process.env.JELLYFIN_URL || "").replace(/\/$/, "");
  const apiKey = process.env.JELLYFIN_ADMIN_API_KEY || "";
  if (!baseUrl || !apiKey) {
    throw new Error("Jellyfin not configured on Tentacle backend (JELLYFIN_URL or JELLYFIN_ADMIN_API_KEY missing)");
  }
  const res = await fetch(`${baseUrl}/Users`, {
    headers: { "X-Emby-Token": apiKey },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) {
    throw new Error(`Jellyfin GET /Users failed: ${res.status}`);
  }
  const data = await res.json();
  return data.filter((u) => !u.Policy?.IsDisabled).map((u) => ({ id: u.Id, name: u.Name }));
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
  registerUsersRoutes(app, prisma, gwc, ctx.requireAdmin);
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
      const cached2 = providerCache.get(key);
      if (cached2 && Date.now() < cached2.expires) {
        result[item.tmdbId] = cached2.providers;
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
