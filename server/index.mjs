// Seer Plugin — Server module (auto-generated, do not edit)

// server/index.ts
import { Readable } from "stream";
import { resolve, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, statSync } from "fs";
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
    notifiedSeasons: r.notified_seasons ? typeof r.notified_seasons === "string" ? JSON.parse(r.notified_seasons) : r.notified_seasons : null,
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

// server/concurrency.ts
var DEFAULT_CONCURRENCY = 6;
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length).fill(null);
  if (items.length === 0) return out;
  const workers = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (; ; ) {
        const i = cursor++;
        if (i >= items.length) return;
        try {
          out[i] = await fn(items[i], i);
        } catch {
          out[i] = null;
        }
      }
    })
  );
  return out;
}
function chunk(items, size) {
  if (size <= 0) return [items.slice()];
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// server/tmdb-cache-schema.ts
async function ensureTmdbCacheTable(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seer_tmdb_cache (
      media_type      VARCHAR(10)  NOT NULL,
      tmdb_id         INT          NOT NULL,
      title           VARCHAR(500) NOT NULL DEFAULT '',
      poster_path     VARCHAR(500) DEFAULT NULL,
      backdrop_path   VARCHAR(500) DEFAULT NULL,
      overview        TEXT         DEFAULT NULL,
      release_date    CHAR(10)     DEFAULT NULL,
      tmdb_status     VARCHAR(40)  DEFAULT NULL,
      digital_date    CHAR(10)     DEFAULT NULL,
      theatrical_date CHAR(10)     DEFAULT NULL,
      physical_date   CHAR(10)     DEFAULT NULL,
      release_region  CHAR(2)      DEFAULT NULL,
      next_air_date   CHAR(10)     DEFAULT NULL,
      next_season     SMALLINT     DEFAULT NULL,
      next_episode    SMALLINT     DEFAULT NULL,
      last_air_date   CHAR(10)     DEFAULT NULL,
      networks        VARCHAR(255) DEFAULT NULL,
      provider_ids    VARCHAR(255) DEFAULT NULL,
      vote_average      DECIMAL(3,1) DEFAULT NULL,
      popularity        DECIMAL(8,3) DEFAULT NULL,
      original_language CHAR(2)      DEFAULT NULL,
      genre_ids         VARCHAR(120) DEFAULT NULL,
      is_anime          TINYINT(1)   NOT NULL DEFAULT 0,
      fetched_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at      DATETIME     NOT NULL,
      PRIMARY KEY (media_type, tmdb_id),
      INDEX idx_tmdbc_expires  (expires_at),
      INDEX idx_tmdbc_next_air (next_air_date),
      INDEX idx_tmdbc_digital  (digital_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const addColumn = async (col, def) => {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE seer_tmdb_cache ADD COLUMN ${col} ${def}`);
      console.log(`[SeerTmdb] Colonne ajout\xE9e : ${col}`);
    } catch {
    }
  };
  await addColumn("vote_average", "DECIMAL(3,1) DEFAULT NULL");
  await addColumn("popularity", "DECIMAL(8,3) DEFAULT NULL");
  await addColumn("original_language", "CHAR(2) DEFAULT NULL");
  await addColumn("genre_ids", "VARCHAR(120) DEFAULT NULL");
  await addColumn("is_anime", "TINYINT(1) NOT NULL DEFAULT 0");
}

// server/tmdb-cache.ts
function tmdbKey(ref) {
  return `${ref.mediaType}:${ref.tmdbId}`;
}
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function asDate(v) {
  if (typeof v === "string" && DATE_RE.test(v)) return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}
function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function asNumOrNull(v) {
  if (v === null || v === void 0 || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function asIdList(v) {
  return String(v ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
}
function rowToMeta(row) {
  const ids = asIdList(row.provider_ids);
  return {
    mediaType: row.media_type === "tv" ? "tv" : "movie",
    tmdbId: Number(row.tmdb_id),
    title: String(row.title ?? ""),
    posterPath: row.poster_path ?? null,
    backdropPath: row.backdrop_path ?? null,
    overview: row.overview ?? null,
    releaseDate: asDate(row.release_date),
    tmdbStatus: row.tmdb_status ?? null,
    digitalDate: asDate(row.digital_date),
    theatricalDate: asDate(row.theatrical_date),
    physicalDate: asDate(row.physical_date),
    releaseRegion: row.release_region ?? null,
    nextAirDate: asDate(row.next_air_date),
    nextSeason: asNum(row.next_season),
    nextEpisode: asNum(row.next_episode),
    lastAirDate: asDate(row.last_air_date),
    networks: row.networks ?? null,
    providerIds: ids,
    voteAverage: asNumOrNull(row.vote_average),
    popularity: asNumOrNull(row.popularity),
    originalLanguage: row.original_language || null,
    genreIds: asIdList(row.genre_ids),
    isAnime: row.is_anime === 1 || row.is_anime === true,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at ?? "")
  };
}
async function getTmdbMetaBulk(prisma, refs, includeExpired = true) {
  const out = /* @__PURE__ */ new Map();
  if (refs.length === 0) return out;
  const byType = { movie: [], tv: [] };
  for (const r of refs) {
    if (Number.isFinite(r.tmdbId) && r.tmdbId > 0) byType[r.mediaType].push(r.tmdbId);
  }
  const freshOnly = includeExpired ? "" : " AND expires_at > NOW()";
  for (const type of ["movie", "tv"]) {
    const ids = Array.from(new Set(byType[type]));
    for (const slice of chunk(ids, 500)) {
      if (slice.length === 0) continue;
      const placeholders = slice.map(() => "?").join(",");
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM seer_tmdb_cache
         WHERE media_type = ? AND tmdb_id IN (${placeholders})${freshOnly}`,
        type,
        ...slice
      );
      for (const row of rows) {
        const meta = rowToMeta(row);
        out.set(tmdbKey(meta), meta);
      }
    }
  }
  return out;
}
var UPSERT_COLS = [
  "media_type",
  "tmdb_id",
  "title",
  "poster_path",
  "backdrop_path",
  "overview",
  "release_date",
  "tmdb_status",
  "digital_date",
  "theatrical_date",
  "physical_date",
  "release_region",
  "next_air_date",
  "next_season",
  "next_episode",
  "last_air_date",
  "networks",
  "provider_ids",
  "vote_average",
  "popularity",
  "original_language",
  "genre_ids",
  "is_anime",
  "expires_at"
];
async function upsertTmdbMetaBulk(prisma, rows) {
  if (rows.length === 0) return;
  const updates = UPSERT_COLS.filter((c) => c !== "media_type" && c !== "tmdb_id").map((c) => `${c} = VALUES(${c})`).join(", ");
  for (const slice of chunk(rows, 100)) {
    const tuple = `(${UPSERT_COLS.map(() => "?").join(",")})`;
    const values = [];
    for (const m of slice) {
      values.push(
        m.mediaType,
        m.tmdbId,
        m.title.slice(0, 500),
        m.posterPath,
        m.backdropPath,
        m.overview,
        m.releaseDate,
        m.tmdbStatus,
        m.digitalDate,
        m.theatricalDate,
        m.physicalDate,
        m.releaseRegion,
        m.nextAirDate,
        m.nextSeason,
        m.nextEpisode,
        m.lastAirDate,
        m.networks,
        m.providerIds.join(","),
        m.voteAverage ?? null,
        m.popularity ?? null,
        m.originalLanguage ?? null,
        (m.genreIds ?? []).join(",") || null,
        m.isAnime ? 1 : 0,
        new Date(m.expiresAt)
      );
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO seer_tmdb_cache (${UPSERT_COLS.join(",")})
       VALUES ${slice.map(() => tuple).join(",")}
       ON DUPLICATE KEY UPDATE ${updates}, fetched_at = CURRENT_TIMESTAMP`,
      ...values
    );
  }
}
async function seedTmdbCacheFromLocalRequests(prisma) {
  const affected = await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO seer_tmdb_cache
      (media_type, tmdb_id, title, poster_path, backdrop_path, overview, release_date, expires_at)
    SELECT r.media_type, r.tmdb_id,
           MAX(r.title), MAX(r.poster_path), MAX(r.backdrop_path), MAX(r.overview),
           NULL, NOW()
    FROM seer_requests r
    WHERE r.tmdb_id > 0 AND r.title <> ''
    GROUP BY r.media_type, r.tmdb_id
  `);
  return Number(affected) || 0;
}
async function listStaleTmdbRefs(prisma, limit) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT media_type, tmdb_id FROM seer_tmdb_cache
     WHERE expires_at <= NOW() ORDER BY expires_at ASC LIMIT ${Math.max(1, Math.floor(limit))}`
  );
  return rows.map((r) => ({
    mediaType: r.media_type === "tv" ? "tv" : "movie",
    tmdbId: Number(r.tmdb_id)
  }));
}
async function pruneTmdbCache(prisma, olderThanDays) {
  const n = await prisma.$executeRawUnsafe(
    `DELETE FROM seer_tmdb_cache WHERE fetched_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    Math.max(1, Math.floor(olderThanDays))
  );
  return Number(n) || 0;
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
function parseSeasons(raw) {
  if (raw == null) return null;
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) {
      const nums = arr.map(Number).filter((n) => Number.isFinite(n));
      return nums.length > 0 ? nums : null;
    }
  } catch {
  }
  return null;
}
async function enqueueCleanup(prisma, job) {
  const id = uuid();
  const delay = Math.max(0, Math.floor(job.delaySeconds ?? 0));
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_cleanup_queue (id, action, media_type, tmdb_id, title, seerr_request_id, seerr_media_id, delete_files, seasons, request_id, jellyfin_user_id, next_retry_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    id,
    job.action,
    job.mediaType,
    job.tmdbId,
    job.title,
    job.seerrRequestId ?? null,
    job.seerrMediaId ?? null,
    job.deleteFiles ? 1 : 0,
    job.seasons && job.seasons.length > 0 ? JSON.stringify(job.seasons) : null,
    job.requestId ?? null,
    job.jellyfinUserId ?? null,
    delay
  );
  return id;
}
async function getPendingCleanups(prisma, limit = 25) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_cleanup_queue
     WHERE status = 'pending' AND next_retry_at <= NOW()
     ORDER BY created_at ASC LIMIT ${Math.max(1, Math.min(100, limit))}`
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
    seasons: parseSeasons(r.seasons),
    retryCount: r.retry_count || 0,
    maxRetries: r.max_retries || 20,
    lastError: r.last_error || null,
    status: r.status,
    nextRetryAt: toIso(r.next_retry_at),
    requestId: r.request_id || null,
    jellyfinUserId: r.jellyfin_user_id || null
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

// server/db-claims.ts
async function upsertContentClaim(prisma, tmdbId, jellyfinUserId, mediaType, title, ttlSeconds) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO content_claims (tmdbId, jellyfinUserId, mediaType, title, expiresAt)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(3), INTERVAL ? SECOND))
     ON DUPLICATE KEY UPDATE mediaType = VALUES(mediaType), title = VALUES(title), expiresAt = VALUES(expiresAt)`,
    tmdbId,
    jellyfinUserId,
    mediaType,
    title,
    ttlSeconds
  );
}
async function purgeExpiredContentClaims(prisma) {
  await prisma.$executeRawUnsafe(`DELETE FROM content_claims WHERE expiresAt < NOW(3)`);
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
  await addColumn("seer_cleanup_queue", "seasons", "TEXT DEFAULT NULL");
  await addColumn("seer_cleanup_queue", "jellyfin_user_id", "VARCHAR(255) DEFAULT NULL");
  await addColumn("seer_requests", "pending_cleanup_id", "VARCHAR(36) DEFAULT NULL");
  await addColumn("seer_requests", "profile_id", "VARCHAR(36) DEFAULT NULL");
  await addColumn("seer_requests", "is_anime", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumn("seer_requests", "notified_seasons", "JSON DEFAULT NULL");
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
  await ensureTmdbCacheTable(prisma);
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
async function listJellyfinUsersWithStats(prisma, jellyfinUsers) {
  if (jellyfinUsers.length === 0) return [];
  const ids = jellyfinUsers.map((u) => u.id);
  const placeholders = ids.map(() => "?").join(",");
  const settingsRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id IN (${placeholders})`,
    ...ids
  );
  const settingsByUserId = /* @__PURE__ */ new Map();
  for (const row of settingsRows) {
    const s = rowToUserSettings(row);
    settingsByUserId.set(s.jellyfinUserId, s);
  }
  const statsRows = await prisma.$queryRawUnsafe(
    `SELECT
       jellyfin_user_id,
       SUM(CASE WHEN created_at >= CURDATE() AND status NOT IN ('failed','deleted') THEN 1 ELSE 0 END) AS requests_today,
       SUM(CASE WHEN status != 'deleted' THEN 1 ELSE 0 END) AS requests_total
     FROM seer_requests
     WHERE jellyfin_user_id IN (${placeholders})
     GROUP BY jellyfin_user_id`,
    ...ids
  );
  const statsByUserId = /* @__PURE__ */ new Map();
  for (const r of statsRows) {
    statsByUserId.set(r.jellyfin_user_id, {
      today: Number(r.requests_today) || 0,
      total: Number(r.requests_total) || 0
    });
  }
  const result = [];
  for (const u of jellyfinUsers) {
    let settings = settingsByUserId.get(u.id);
    if (!settings) {
      settings = await getOrCreateUserSettings(prisma, u.id, u.name);
    } else if (u.name && u.name !== u.id && settings.username !== u.name) {
      const isUuid = /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i;
      if (isUuid.test(settings.username) || settings.username === u.id) {
        await updateUserSettings(prisma, u.id, { username: u.name });
        settings = { ...settings, username: u.name };
      }
    }
    const s = statsByUserId.get(u.id) ?? { today: 0, total: 0 };
    result.push({ ...settings, requestsToday: s.today, requestsTotal: s.total });
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
async function setNotifiedSeasons(prisma, id, seasons) {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET notified_seasons = ? WHERE id = ?`,
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

// server/season-availability.ts
var AVAILABLE = 5;
function releasedSuffix(gender, plural) {
  const v = plural ? gender === "f" ? "sont sorties" : "sont sortis" : gender === "f" ? "est sortie" : "est sorti";
  return `${v} sur Tentacle TV`;
}
function evaluateSeasons(requested, mediaSeasons) {
  const req = requested ?? [];
  const availSet = new Set(
    (mediaSeasons ?? []).filter((s) => s.status === AVAILABLE).map((s) => s.seasonNumber)
  );
  const available = req.filter((s) => availSet.has(s)).sort((a, b) => a - b);
  return {
    requested: req,
    available,
    allAvailable: req.length > 0 && available.length === req.length
  };
}
function seasonNotification(request, newly, totalAvailable) {
  const sorted = [...newly].sort((a, b) => a - b);
  const multi = sorted.length > 1;
  const label = multi ? `Saisons ${sorted.join(", ")}` : `Saison ${sorted[0]}`;
  const requestedCount = request.seasons?.length ?? 0;
  const partial = requestedCount > 1 && totalAvailable < requestedCount ? ` (${totalAvailable}/${requestedCount} saisons)` : "";
  return {
    title: request.title,
    message: `${label} ${releasedSuffix("f", multi)}${partial}`
  };
}

// server/seer-availability-notify.ts
async function notifyAvailableSeasons(prisma, request, mediaSeasons) {
  const ev = evaluateSeasons(request.seasons, mediaSeasons);
  if (ev.available.length === 0) return null;
  const notified = new Set(request.notifiedSeasons ?? []);
  const newly = ev.available.filter((s) => !notified.has(s));
  if (newly.length > 0) {
    const n = seasonNotification(request, newly, ev.available.length);
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId,
        type: "request_status",
        title: n.title,
        body: n.message,
        refId: request.id
      }
    });
    await setNotifiedSeasons(prisma, request.id, ev.available);
    console.log(`[SeerWorker] "${request.title}" saisons dispo [${newly.join(",")}] \u2192 notif`);
  }
  return ev.allAvailable ? "available" : "partially_available";
}
async function notifyMovieAvailable(prisma, request) {
  if ((request.notifiedSeasons ?? []).length > 0) return;
  await prisma.notification.create({
    data: {
      jellyfinUserId: request.jellyfinUserId,
      type: "request_status",
      title: request.title,
      body: `\xAB ${request.title} \xBB ${releasedSuffix("m", false)}`,
      refId: request.id
    }
  });
  await setNotifiedSeasons(prisma, request.id, [0]);
  console.log(`[SeerWorker] "${request.title}" (film) dispo \u2192 notif`);
}

// server/cache.ts
var store = /* @__PURE__ */ new Map();
var inflight = /* @__PURE__ */ new Map();
var REFRESH_BACKOFF_MS = 3e4;
async function cached(key, ttlMs, loader, opts) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value;
  if (hit && hit.stale > now) {
    const backoffOver = !hit.failedAt || now - hit.failedAt > REFRESH_BACKOFF_MS;
    if (backoffOver && !inflight.has(key)) {
      void refresh(key, ttlMs, loader, opts).catch(() => {
      });
    }
    return hit.value;
  }
  const pending = inflight.get(key);
  if (pending) return pending;
  return refresh(key, ttlMs, loader, opts);
}
function refresh(key, ttlMs, loader, opts) {
  const p = (async () => {
    try {
      const value = await loader();
      put(key, value, opts?.ttlFor?.(value) ?? ttlMs, opts?.staleMs ?? 0);
      return value;
    } catch (err) {
      const prev = store.get(key);
      if (prev) prev.failedAt = Date.now();
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
function put(key, value, ttlMs, staleMs = 0) {
  const expires = Date.now() + ttlMs;
  store.set(key, { value, expires, stale: expires + staleMs });
}
function peek(key, allowStale = false) {
  const hit = store.get(key);
  if (!hit) return void 0;
  const now = Date.now();
  if (hit.expires > now) return hit.value;
  if (allowStale && hit.stale > now) return hit.value;
  return void 0;
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
    if (entry.stale <= now) store.delete(key);
  }
}, 6e4).unref?.();

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
async function arrFetch(server, path, init) {
  return fetch(`${buildArrUrl(server)}${path}`, {
    ...init,
    headers: { "X-Api-Key": server.apiKey, ...init?.headers ?? {} },
    signal: AbortSignal.timeout(15e3)
  });
}
function isTargetedSeason(seasonNumber, seasons) {
  if (!seasons || seasons.length === 0) return true;
  return seasons.includes(seasonNumber);
}
async function unmonitorSonarrSeasons(server, seriesId, seasons) {
  try {
    const getRes = await arrFetch(server, `/api/v3/series/${seriesId}`);
    if (getRes.status === 404) return true;
    if (!getRes.ok) return false;
    const series = await getRes.json();
    for (const s of series.seasons ?? []) {
      if (isTargetedSeason(s.seasonNumber, seasons)) s.monitored = false;
    }
    if ((series.seasons ?? []).every((s) => !s.monitored)) series.monitored = false;
    const putRes = await arrFetch(server, `/api/v3/series/${seriesId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(series)
    });
    return putRes.ok || putRes.status === 404;
  } catch (err) {
    console.warn(`[ArrService] unmonitorSonarrSeasons #${seriesId} failed:`, err);
    return false;
  }
}
async function deleteSonarrSeasonFiles(server, seriesId, seasons) {
  try {
    const res = await arrFetch(server, `/api/v3/episodefile?seriesId=${seriesId}`);
    if (res.status === 404) return true;
    if (!res.ok) return false;
    const files = await res.json();
    const targets = files.filter((f) => isTargetedSeason(f.seasonNumber, seasons));
    if (targets.length === 0) return true;
    const bulk = await arrFetch(server, `/api/v3/episodefile/bulk`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeFileIds: targets.map((f) => f.id) })
    });
    if (bulk.ok) return true;
    let ok = true;
    for (const f of targets) {
      const del = await arrFetch(server, `/api/v3/episodefile/${f.id}`, { method: "DELETE" });
      if (!del.ok && del.status !== 404) ok = false;
    }
    return ok;
  } catch (err) {
    console.warn(`[ArrService] deleteSonarrSeasonFiles #${seriesId} failed:`, err);
    return false;
  }
}
async function cancelSonarrQueue(server, seriesId, seasons) {
  try {
    const res = await arrFetch(server, `/api/v3/queue?pageSize=1000&includeSeries=false`);
    if (!res.ok) return;
    const data = await res.json();
    const records = data.records ?? [];
    for (const r of records) {
      if (r.seriesId !== seriesId) continue;
      if (r.seasonNumber !== void 0 && !isTargetedSeason(r.seasonNumber, seasons)) continue;
      await arrFetch(server, `/api/v3/queue/${r.id}?removeFromClient=true&blocklist=false`, {
        method: "DELETE"
      }).catch(() => {
      });
    }
  } catch (err) {
    console.warn(`[ArrService] cancelSonarrQueue #${seriesId} failed:`, err);
  }
}
async function unmonitorRadarrMovie(server, movieId) {
  try {
    const getRes = await arrFetch(server, `/api/v3/movie/${movieId}`);
    if (getRes.status === 404) return true;
    if (!getRes.ok) return false;
    const movie = await getRes.json();
    movie.monitored = false;
    const putRes = await arrFetch(server, `/api/v3/movie/${movieId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(movie)
    });
    return putRes.ok || putRes.status === 404;
  } catch (err) {
    console.warn(`[ArrService] unmonitorRadarrMovie #${movieId} failed:`, err);
    return false;
  }
}
async function deleteRadarrMovieFile(server, movieId) {
  try {
    const res = await arrFetch(server, `/api/v3/moviefile?movieId=${movieId}`);
    if (res.status === 404) return true;
    if (!res.ok) return false;
    const files = await res.json();
    if (files.length === 0) return true;
    let ok = true;
    for (const f of files) {
      const del = await arrFetch(server, `/api/v3/moviefile/${f.id}`, { method: "DELETE" });
      if (!del.ok && del.status !== 404) ok = false;
    }
    return ok;
  } catch (err) {
    console.warn(`[ArrService] deleteRadarrMovieFile #${movieId} failed:`, err);
    return false;
  }
}
async function cancelRadarrQueue(server, movieId) {
  try {
    const res = await arrFetch(server, `/api/v3/queue?pageSize=1000&includeMovie=false`);
    if (!res.ok) return;
    const data = await res.json();
    for (const r of data.records ?? []) {
      if (r.movieId !== movieId) continue;
      await arrFetch(server, `/api/v3/queue/${r.id}?removeFromClient=true&blocklist=false`, {
        method: "DELETE"
      }).catch(() => {
      });
    }
  } catch (err) {
    console.warn(`[ArrService] cancelRadarrQueue #${movieId} failed:`, err);
  }
}
async function triggerSeerrJob(seerrUrl, apiKey, jobId) {
  try {
    await fetch(`${seerrUrl}/api/v1/settings/jobs/${jobId}/run`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
  } catch (err) {
    console.warn(`[ArrService] triggerSeerrJob ${jobId} failed:`, err);
  }
}

// server/worker-sync.ts
var CLAIM_TTL_SECONDS = 1800;
async function syncStatuses(prisma, config) {
  const requests = await getRequestsToSync(prisma);
  await purgeExpiredContentClaims(prisma).catch(() => {
  });
  if (requests.length === 0) return;
  let availabilitySyncDone = false;
  for (const request of requests) {
    if (!request.seerrRequestId) continue;
    await upsertContentClaim(
      prisma,
      request.tmdbId,
      request.jellyfinUserId,
      request.mediaType,
      request.title,
      CLAIM_TTL_SECONDS
    ).catch(() => {
    });
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
      const globalStatus = mapSeerrStatus(data.status, data.media?.status, data.media?.downloadStatus);
      if (globalStatus === "failed" && request.status !== "failed") {
        await handleFailedSync(prisma, config, request, data);
        invalidate(`seer-cache:${request.jellyfinUserId}`);
        continue;
      }
      if (request.mediaType === "tv" && (request.seasons?.length ?? 0) > 0) {
        await syncTvSeasons(prisma, config, request, globalStatus, data.media?.status);
      } else {
        await syncGlobal(prisma, request, globalStatus, data.media?.status);
      }
      if (!availabilitySyncDone && request.mediaType === "tv" && (globalStatus === "partially_available" || globalStatus === "downloading")) {
        availabilitySyncDone = true;
        await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      }
    } catch (err) {
      console.warn(`[SeerWorker] Failed to sync request #${request.seerrRequestId}:`, err);
    }
  }
}
async function syncGlobal(prisma, request, newStatus, mediaStatus) {
  if (newStatus === request.status) return;
  const extra = { seerrMediaStatus: mediaStatus };
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
  console.log(`[SeerWorker] "${request.title}" status: ${request.status} \u2192 ${newStatus}`);
}
async function syncTvSeasons(prisma, config, request, fallbackStatus, mediaStatus) {
  const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, "tv", request.tmdbId);
  const newStatus = await notifyAvailableSeasons(prisma, request, detail?.mediaInfo?.seasons);
  if (newStatus === null) {
    await syncGlobal(prisma, request, fallbackStatus, mediaStatus);
    return;
  }
  if (newStatus !== request.status) {
    const extra = { seerrMediaStatus: mediaStatus };
    if (newStatus === "available") extra.completedAt = /* @__PURE__ */ new Date();
    await updateRequestStatus(prisma, request.id, newStatus, extra);
    invalidate(`seer-cache:${request.jellyfinUserId}`);
    console.log(`[SeerWorker] "${request.title}" status: ${request.status} \u2192 ${newStatus}`);
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
  if (mediaStatus === 5) return "available";
  if (mediaStatus === 4) return "partially_available";
  if (mediaStatus === 7) return "deleted";
  if (mediaStatus === 1) return "unavailable";
  if (mediaStatus === 3) {
    if (downloadStatus?.some((d) => d.status === "failed" || d.status === "warning")) return "failed";
    return downloadStatus && downloadStatus.length > 0 ? "downloading" : "unavailable";
  }
  if (requestStatus === 1) return "sent_to_seer";
  return "approved";
}
function statusNotification(request, newStatus) {
  switch (newStatus) {
    case "downloading":
      return { type: "request_downloading", title: request.title, message: `\xAB ${request.title} \xBB est en cours de t\xE9l\xE9chargement` };
    case "available": {
      const suffix = releasedSuffix(request.mediaType === "movie" ? "m" : "f", false);
      return { type: "request_available", title: request.title, message: `\xAB ${request.title} \xBB ${suffix}` };
    }
    case "failed":
      return { type: "request_declined", title: request.title, message: `Votre demande pour \xAB ${request.title} \xBB a \xE9t\xE9 refus\xE9e` };
    default:
      return null;
  }
}

// server/seerr-reconcile.ts
async function reconcileSeerrSeasons(prisma, config, tmdbId, removedSeasons) {
  if (removedSeasons.length === 0) return;
  const removed = new Set(removedSeasons);
  const headers = { "X-Api-Key": config.seerrApiKey };
  const res = await fetch(`${config.seerrUrl}/api/v1/tv/${tmdbId}`, {
    headers,
    signal: AbortSignal.timeout(1e4)
  });
  if (res.status === 404) return;
  if (!res.ok) {
    throw new Error(`Jellyseerr GET /tv/${tmdbId} returned ${res.status}`);
  }
  const detail = await res.json();
  for (const req of detail.mediaInfo?.requests ?? []) {
    const seasons = (req.seasons ?? []).map((s) => s.seasonNumber).filter((n) => typeof n === "number");
    if (seasons.length === 0) continue;
    const remaining = seasons.filter((n) => !removed.has(n));
    if (remaining.length === seasons.length) continue;
    if (remaining.length === 0) {
      const del = await fetch(`${config.seerrUrl}/api/v1/request/${req.id}`, {
        method: "DELETE",
        headers,
        signal: AbortSignal.timeout(1e4)
      });
      if (!del.ok && del.status !== 404) {
        throw new Error(`Jellyseerr DELETE /request/${req.id} returned ${del.status}`);
      }
      await prisma.$executeRawUnsafe(
        `DELETE FROM seer_requests WHERE seerr_request_id = ?`,
        req.id
      );
      console.log(
        `[SeerReconcile] tv#${tmdbId} : demande Jellyseerr #${req.id} supprim\xE9e (S${seasons.join(", S")} retir\xE9es)`
      );
    } else {
      const put2 = await fetch(`${config.seerrUrl}/api/v1/request/${req.id}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType: "tv", seasons: remaining }),
        signal: AbortSignal.timeout(1e4)
      });
      if (!put2.ok && put2.status !== 404) {
        const text = await put2.text().catch(() => "");
        throw new Error(
          `Jellyseerr PUT /request/${req.id} returned ${put2.status} ${text.slice(0, 200)}`
        );
      }
      await prisma.$executeRawUnsafe(
        `UPDATE seer_requests SET seasons = ? WHERE seerr_request_id = ?`,
        JSON.stringify(remaining),
        req.id
      );
      console.log(
        `[SeerReconcile] tv#${tmdbId} : demande Jellyseerr #${req.id} r\xE9duite aux saisons S${remaining.join(", S")}`
      );
    }
  }
}

// server/worker-cleanup.ts
var CLEANUP_BATCH = 25;
async function processCleanupQueue(prisma, config) {
  for (let pass = 0; pass < 4; pass++) {
    const jobs = await getPendingCleanups(prisma, CLEANUP_BATCH);
    if (jobs.length === 0) return;
    for (const job of jobs) {
      await processCleanupJob(prisma, config, job);
    }
    if (jobs.length < CLEANUP_BATCH) return;
  }
}
function invalidateForJob(job) {
  invalidate(job.jellyfinUserId ? `seer-cache:${job.jellyfinUserId}` : "seer-cache");
}
async function processCleanupJob(prisma, config, job) {
  const headers = { "X-Api-Key": config.seerrApiKey };
  try {
    if (job.action === "sync") {
      await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      await updateCleanupJob(prisma, job.id, "completed");
      invalidateForJob(job);
      console.log(`[SeerWorker] availability-sync re-d\xE9clench\xE9e pour "${job.title}"`);
      return;
    }
    const arrType = job.mediaType === "movie" ? "radarr" : "sonarr";
    const [server, ext] = await Promise.all([
      getArrServerConfig(config.seerrUrl, config.seerrApiKey, arrType),
      getMediaExternalId(config.seerrUrl, config.seerrApiKey, job.mediaType, job.tmdbId)
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
        `[SeerWorker] *arr cleanup for "${job.title}" (${arrType} #${arrId}, seasons=${job.seasons ? JSON.stringify(job.seasons) : "all"}, deleteFiles=${job.deleteFiles})`
      );
    } else {
      console.log(`[SeerWorker] "${job.title}" : pas de cible *arr (jamais grab\xE9) \u2014 skip ops *arr`);
    }
    if (job.seerrRequestId) {
      const delRes = await fetch(
        `${config.seerrUrl}/api/v1/request/${job.seerrRequestId}`,
        { method: "DELETE", headers, signal: AbortSignal.timeout(1e4) }
      );
      if (!delRes.ok && delRes.status !== 404) {
        throw new Error(`Jellyseerr request delete returned ${delRes.status}`);
      }
    }
    if (job.mediaType === "tv" && job.seasons && job.seasons.length > 0) {
      await reconcileSeerrSeasons(prisma, config, job.tmdbId, job.seasons);
    }
    await updateCleanupJob(prisma, job.id, "completed");
    if (job.requestId) {
      await deleteRequestById(prisma, job.requestId);
      console.log(`[SeerWorker] Deleted local request ${job.requestId}`);
    }
    await clearPendingCleanup(prisma, job.id);
    if (job.deleteFiles) {
      await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      for (const delay of [120, 600]) {
        await enqueueCleanup(prisma, {
          action: "sync",
          mediaType: job.mediaType,
          tmdbId: job.tmdbId,
          title: job.title,
          deleteFiles: false,
          seasons: null,
          delaySeconds: delay,
          // Propagation obligatoire : sans elle, ces jobs enfants naîtraient
          // sans propriétaire et retomberaient sur l'invalidation globale.
          jellyfinUserId: job.jellyfinUserId
        });
      }
    }
    invalidateForJob(job);
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
async function invalidateStaleJellyseerrCache(config, prisma) {
  const seerUsers = await listAllJellyseerrUsers(config);
  const validIds = new Set(seerUsers.map((u) => u.id));
  const rows = await prisma.$queryRawUnsafe(
    `SELECT jellyfin_user_id, jellyseerr_user_id FROM seer_user_settings WHERE jellyseerr_user_id IS NOT NULL`
  );
  let invalidated = 0;
  for (const row of rows) {
    if (!validIds.has(row.jellyseerr_user_id)) {
      await prisma.$executeRawUnsafe(
        `UPDATE seer_user_settings SET jellyseerr_user_id = NULL, jellyseerr_last_sync = NULL WHERE jellyfin_user_id = ?`,
        row.jellyfin_user_id
      );
      invalidated++;
    }
  }
  return invalidated;
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

// server/tmdb-traits.ts
var KEYWORD_ANIME = 210024;
var GENRE_ANIMATION = 16;
var ORIGINES = /* @__PURE__ */ new Set(["JP", "KR"]);
var LANGUES = /* @__PURE__ */ new Set(["ja", "ko"]);
function lireMotsCles(brut) {
  if (Array.isArray(brut)) return brut;
  const enveloppe = brut;
  return Array.isArray(enveloppe?.results) ? enveloppe.results : [];
}
function lireGenres(raw) {
  if (Array.isArray(raw.genreIds)) return raw.genreIds;
  return (raw.genres ?? []).map((g) => g?.id).filter((id) => typeof id === "number");
}
function detectAnime(raw) {
  if (lireMotsCles(raw.keywords).some((k) => k?.id === KEYWORD_ANIME)) return true;
  const asiatique = LANGUES.has(raw.originalLanguage ?? "") || (raw.originCountry ?? []).some((c) => ORIGINES.has((c ?? "").toUpperCase()));
  return asiatique && lireGenres(raw).includes(GENRE_ANIMATION);
}

// server/tmdb-fetch.ts
var RELEASE_TYPE = {
  PREMIERE: 1,
  THEATRICAL_LIMITED: 2,
  THEATRICAL: 3,
  DIGITAL: 4,
  PHYSICAL: 5,
  TV: 6
};
function toDayString(raw) {
  if (!raw || typeof raw !== "string") return null;
  const day = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}
function todayString(now = /* @__PURE__ */ new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
function pickReleaseDates(groups, region) {
  const empty = { digital: null, theatrical: null, physical: null, region: null };
  if (!Array.isArray(groups) || groups.length === 0) return empty;
  const wanted = region.toUpperCase();
  const group = groups.find((g) => g.iso_3166_1?.toUpperCase() === wanted) ?? groups.find((g) => g.iso_3166_1?.toUpperCase() === "US") ?? groups[0];
  if (!group?.release_dates?.length) return empty;
  const earliest = (types) => {
    let best = null;
    for (const r of group.release_dates ?? []) {
      if (typeof r.type !== "number" || !types.includes(r.type)) continue;
      const day = toDayString(r.release_date);
      if (day && (best === null || day < best)) best = day;
    }
    return best;
  };
  return {
    digital: earliest([RELEASE_TYPE.DIGITAL]),
    // Une sortie salle limitée ou une avant-première comptent comme « au cinéma ».
    theatrical: earliest([
      RELEASE_TYPE.THEATRICAL,
      RELEASE_TYPE.THEATRICAL_LIMITED,
      RELEASE_TYPE.PREMIERE
    ]),
    physical: earliest([RELEASE_TYPE.PHYSICAL, RELEASE_TYPE.TV]),
    region: group.iso_3166_1?.toUpperCase() ?? null
  };
}
var DAY = 864e5;
function computeTtlMs(meta, now = Date.now()) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const today = todayString(new Date(now));
  if (meta.mediaType === "tv") {
    const status = (meta.tmdbStatus ?? "").toLowerCase();
    if (status === "ended" || status === "canceled" || status === "cancelled") return 30 * DAY;
    if (meta.nextAirDate) {
      if (meta.nextAirDate <= today) return 6 * 36e5;
      const diff = (/* @__PURE__ */ new Date(`${meta.nextAirDate}T00:00:00`)).getTime() - now;
      return clamp(diff + DAY, 6 * 36e5, 7 * DAY);
    }
    return 2 * DAY;
  }
  if (meta.digitalDate && meta.digitalDate <= today) return 30 * DAY;
  if (meta.theatricalDate && meta.theatricalDate <= today) return 3 * DAY;
  if (meta.releaseDate && meta.releaseDate < today) return 30 * DAY;
  return 12 * 36e5;
}
function parseDetailToMeta(raw, ref, region) {
  const isTv = ref.mediaType === "tv";
  const rel = isTv ? { digital: null, theatrical: null, physical: null, region: null } : pickReleaseDates(raw.releases?.results, region);
  const providerIds = [];
  for (const wp of raw.watchProviders ?? []) {
    if (wp.iso_3166_1?.toUpperCase() !== region.toUpperCase()) continue;
    for (const p of wp.flatrate ?? []) {
      const id = p.id ?? p.providerId;
      if (typeof id === "number" && id > 0) providerIds.push(id);
    }
  }
  const meta = {
    mediaType: ref.mediaType,
    tmdbId: ref.tmdbId,
    title: raw.title ?? raw.name ?? "",
    posterPath: raw.posterPath ?? null,
    backdropPath: raw.backdropPath ?? null,
    overview: raw.overview ?? null,
    releaseDate: toDayString(raw.releaseDate ?? raw.firstAirDate),
    tmdbStatus: raw.status ?? null,
    digitalDate: rel.digital,
    theatricalDate: rel.theatrical,
    physicalDate: rel.physical,
    releaseRegion: rel.region,
    nextAirDate: toDayString(raw.nextEpisodeToAir?.airDate),
    nextSeason: raw.nextEpisodeToAir?.seasonNumber ?? null,
    nextEpisode: raw.nextEpisodeToAir?.episodeNumber ?? null,
    lastAirDate: toDayString(raw.lastEpisodeToAir?.airDate),
    networks: (raw.networks ?? []).map((n) => n?.name).filter((n) => !!n).slice(0, 3).join(", ") || null,
    providerIds: Array.from(new Set(providerIds)),
    voteAverage: typeof raw.voteAverage === "number" ? raw.voteAverage : null,
    popularity: typeof raw.popularity === "number" ? raw.popularity : null,
    originalLanguage: raw.originalLanguage ?? null,
    genreIds: (raw.genres ?? []).map((g) => g?.id).filter((id) => typeof id === "number"),
    isAnime: detectAnime(raw),
    expiresAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  meta.expiresAt = new Date(Date.now() + computeTtlMs(meta)).toISOString();
  return meta;
}
async function fetchTmdbMeta(cfg, ref, region) {
  try {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/${ref.mediaType}/${ref.tmdbId}`, {
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return null;
    return parseDetailToMeta(await res.json(), ref, region);
  } catch {
    return null;
  }
}

// server/tmdb-resolver.ts
var DEFAULT_REGION = "FR";
var inflightMeta = /* @__PURE__ */ new Map();
function fetchOnce(cfg, ref, region) {
  const key = tmdbKey(ref);
  const pending = inflightMeta.get(key);
  if (pending) return pending;
  const p = fetchTmdbMeta(cfg, ref, region).finally(() => {
    inflightMeta.delete(key);
  });
  inflightMeta.set(key, p);
  return p;
}
function dedupeRefs(refs) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const r of refs) {
    if (!r || !Number.isFinite(r.tmdbId) || r.tmdbId <= 0) continue;
    const k = tmdbKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
async function resolveTmdbMeta(prisma, cfg, refs, opts = {}) {
  const unique = dedupeRefs(refs);
  if (unique.length === 0) return { meta: /* @__PURE__ */ new Map(), missing: [] };
  const meta = await getTmdbMetaBulk(prisma, unique, opts.includeExpired ?? true);
  const missing = unique.filter((r) => !meta.has(tmdbKey(r)));
  const budget = opts.maxFetch ?? 0;
  if (budget <= 0 || !cfg || missing.length === 0) return { meta, missing };
  const toFetch = missing.slice(0, budget);
  const region = opts.region ?? DEFAULT_REGION;
  const fetched = await mapLimit(
    toFetch,
    opts.concurrency ?? DEFAULT_CONCURRENCY,
    (ref) => fetchOnce(cfg, ref, region)
  );
  const ok = fetched.filter((m) => m !== null);
  if (ok.length > 0) {
    await upsertTmdbMetaBulk(prisma, ok).catch(() => {
    });
    for (const m of ok) meta.set(tmdbKey(m), m);
  }
  return { meta, missing: unique.filter((r) => !meta.has(tmdbKey(r))) };
}
var backfillQueue = /* @__PURE__ */ new Set();
var backfillRefs = /* @__PURE__ */ new Map();
var backfillRunning = false;
function pendingBackfillCount() {
  return backfillQueue.size;
}
function scheduleTmdbBackfill(prisma, cfg, refs, region = DEFAULT_REGION) {
  if (!cfg) return;
  for (const ref of dedupeRefs(refs)) {
    const k = tmdbKey(ref);
    if (backfillQueue.has(k)) continue;
    backfillQueue.add(k);
    backfillRefs.set(k, ref);
  }
  if (backfillRunning || backfillQueue.size === 0) return;
  backfillRunning = true;
  void drainBackfill(prisma, cfg, region).catch(() => {
  }).finally(() => {
    backfillRunning = false;
  });
}
async function drainBackfill(prisma, cfg, region) {
  while (backfillQueue.size > 0) {
    const batch = Array.from(backfillQueue).slice(0, 40);
    const refs = batch.map((k) => backfillRefs.get(k)).filter((r) => !!r);
    const fetched = await mapLimit(refs, 4, (ref) => fetchOnce(cfg, ref, region));
    const ok = fetched.filter((m) => m !== null);
    if (ok.length > 0) await upsertTmdbMetaBulk(prisma, ok).catch(() => {
    });
    for (const k of batch) {
      backfillQueue.delete(k);
      backfillRefs.delete(k);
    }
  }
}

// server/seerr-requests-fetch.ts
var PAGE_CONCURRENCY = 4;
async function fetchSeerrRequestsPage(cfg, seerUserId, take, skip, filter = "all") {
  const who = seerUserId == null ? "" : `&requestedBy=${seerUserId}`;
  const url = `${cfg.seerrUrl}/api/v1/request?take=${take}&skip=${skip}&filter=${encodeURIComponent(filter)}&sort=added${who}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": cfg.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Jellyseerr GET /request${who || " (tous)"} failed: ${res.status} ${body.slice(0, 200)}`
    );
  }
  const data = await res.json();
  return {
    rows: data.results ?? [],
    total: data.pageInfo?.results ?? data.results?.length ?? 0
  };
}
async function fetchAllSeerrRequests(cfg, seerUserId, opts = {}) {
  const take = opts.take ?? 100;
  const maxPages = opts.maxPages ?? 25;
  const filter = opts.filter ?? "all";
  const first = await fetchSeerrRequestsPage(cfg, seerUserId, take, 0, filter);
  if (first.rows.length < take || first.total <= take) {
    return { rows: first.rows, total: first.total || first.rows.length, truncated: false };
  }
  const totalPages = Math.ceil(first.total / take);
  const wanted = Math.min(totalPages, maxPages);
  const skips = Array.from({ length: wanted - 1 }, (_, i) => (i + 1) * take);
  const pages = await mapLimit(
    skips,
    PAGE_CONCURRENCY,
    (skip) => fetchSeerrRequestsPage(cfg, seerUserId, take, skip, filter)
  );
  const rows = [...first.rows];
  for (const page of pages) if (page) rows.push(...page.rows);
  return { rows, total: first.total, truncated: totalPages > maxPages };
}

// server/worker-tmdb.ts
var WARM_BUDGET = 40;
var WARM_CONCURRENCY = 4;
var PRUNE_AFTER_DAYS = 180;
var DISCOVER_MAX_PAGES = 10;
var lastPruneDay = "";
var seeded = false;
async function seedTmdbCacheOnce(prisma) {
  if (seeded) return;
  seeded = true;
  try {
    const n = await seedTmdbCacheFromLocalRequests(prisma);
    if (n > 0) console.log(`[SeerTmdb] Seeded ${n} fiches depuis les demandes locales`);
  } catch (err) {
    console.warn("[SeerTmdb] Seed \xE9chou\xE9", err);
  }
}
async function discoverSeerrRefs(prisma, cfg) {
  const { rows } = await fetchAllSeerrRequests(cfg, null, { maxPages: DISCOVER_MAX_PAGES });
  const refs = [];
  for (const r of rows) {
    if (!r.media?.tmdbId) continue;
    refs.push({ mediaType: r.media.mediaType, tmdbId: r.media.tmdbId });
  }
  const unique = dedupeRefs(refs);
  if (unique.length === 0) return 0;
  const known = await getTmdbMetaBulk(prisma, unique, true);
  const unknown = unique.filter((r) => !known.has(tmdbKey(r)));
  if (unknown.length > 0) scheduleTmdbBackfill(prisma, cfg, unknown);
  return unknown.length;
}
async function warmTmdbCache(prisma, cfg, opts = {}) {
  const budget = opts.budget ?? WARM_BUDGET;
  const region = opts.region ?? DEFAULT_REGION;
  const refs = await listStaleTmdbRefs(prisma, budget);
  if (refs.length === 0) {
    await pruneOncePerDay(prisma);
    return { fetched: 0, remaining: 0 };
  }
  const fetched = await mapLimit(refs, WARM_CONCURRENCY, (ref) => fetchTmdbMeta(cfg, ref, region));
  const ok = fetched.filter((m) => m !== null);
  if (ok.length > 0) await upsertTmdbMetaBulk(prisma, ok);
  await pruneOncePerDay(prisma);
  return { fetched: ok.length, remaining: Math.max(0, refs.length - ok.length) };
}
async function pruneOncePerDay(prisma) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (lastPruneDay === today) return;
  lastPruneDay = today;
  try {
    const n = await pruneTmdbCache(prisma, PRUNE_AFTER_DAYS);
    if (n > 0) console.log(`[SeerTmdb] Purge de ${n} fiches inutilis\xE9es`);
  } catch {
  }
}

// server/worker.ts
var timer = null;
var cycleCount = 0;
var prismaRef = null;
var getConfigRef = null;
var requestQueueBusy = false;
var cleanupQueueBusy = false;
async function runRequestQueue(prisma, config) {
  if (requestQueueBusy) return;
  requestQueueBusy = true;
  try {
    const seen = /* @__PURE__ */ new Set();
    for (let i = 0; i < 10; i++) {
      const processedId = await processNextRequest(prisma, config, seen);
      if (!processedId) return;
      seen.add(processedId);
    }
  } finally {
    requestQueueBusy = false;
  }
}
async function runCleanupQueue(prisma, config) {
  if (cleanupQueueBusy) return;
  cleanupQueueBusy = true;
  try {
    await processCleanupQueue(prisma, config);
  } finally {
    cleanupQueueBusy = false;
  }
}
function startWorker(prisma, getConfig) {
  if (timer) return;
  prismaRef = prisma;
  getConfigRef = getConfig;
  async function tick() {
    const config = await getConfig();
    if (!config || !config.seerrUrl || !config.seerrApiKey) return;
    cycleCount++;
    try {
      await runRequestQueue(prisma, config);
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
      await runCleanupQueue(prisma, config);
    } catch (err) {
      console.error("[SeerWorker] Error processing cleanup queue:", err);
    }
    if (cycleCount % 5 === 0) {
      try {
        await warmTmdbCache(prisma, config);
      } catch (err) {
        console.error("[SeerWorker] Error warming TMDB cache:", err);
      }
    }
    if (cycleCount % 30 === 0) {
      try {
        const n = await discoverSeerrRefs(prisma, config);
        if (n > 0) console.log(`[SeerWorker] ${n} fiches d\xE9couvertes hors du plugin`);
      } catch (err) {
        console.error("[SeerWorker] Error discovering Seerr refs:", err);
      }
    }
  }
  setTimeout(() => {
    void seedTmdbCacheOnce(prisma);
    tick();
  }, 5e3);
  timer = setInterval(() => {
    tick();
  }, 6e4);
  console.log("[SeerWorker] Started");
}
function kickWorkerNow() {
  const prisma = prismaRef;
  const getConfig = getConfigRef;
  if (!prisma || !getConfig) return;
  setTimeout(async () => {
    try {
      const config = await getConfig();
      if (!config || !config.seerrUrl || !config.seerrApiKey) return;
      await Promise.all([
        runRequestQueue(prisma, config).catch((err) => console.error("[SeerWorker] Kick request queue failed:", err)),
        runCleanupQueue(prisma, config).catch((err) => console.error("[SeerWorker] Kick cleanup queue failed:", err))
      ]);
    } catch (err) {
      console.error("[SeerWorker] Kick failed:", err);
    }
  }, 50);
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
async function processNextRequest(prisma, config, skipIds) {
  const request = await getNextQueued(prisma);
  if (!request || skipIds.has(request.id)) return null;
  const fresh = await getRequestById(prisma, request.id);
  if (!fresh || fresh.status !== "queued" && fresh.status !== "retry_pending") return request.id;
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
      if (text.includes("No seasons available to request")) {
        const mediaStatus = detail?.mediaInfo?.status;
        const localStatus = mediaStatus === 5 ? "available" : mediaStatus === 4 ? "partially_available" : "sent_to_seer";
        await updateRequestStatus(prisma, request.id, localStatus, {
          seerrMediaId: detail?.mediaInfo?.id,
          seerrMediaStatus: mediaStatus,
          sentAt: /* @__PURE__ */ new Date()
        });
        invalidate(`seer-cache:${request.jellyfinUserId}`);
        if (request.mediaType === "tv") {
          await notifyAvailableSeasons(prisma, request, detail?.mediaInfo?.seasons);
        } else if (mediaStatus === 5) {
          await notifyMovieAvailable(prisma, request);
        }
        console.log(`[SeerWorker] "${request.title}" : saisons d\xE9j\xE0 pr\xE9sentes c\xF4t\xE9 Jellyseerr \u2014 marqu\xE9 ${localStatus}`);
        return request.id;
      }
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
    await upsertContentClaim(
      prisma,
      request.tmdbId,
      request.jellyfinUserId,
      request.mediaType,
      request.title,
      1800
    ).catch(() => {
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
  return request.id;
}

// server/request-status.ts
var AVAILABLE2 = 5;
function allRequestedSeasonsAvailable(row) {
  const requested = (row.seasons ?? []).map((s) => s.seasonNumber).filter((n) => typeof n === "number");
  if (requested.length === 0) return false;
  const available = new Set(
    (row.media?.seasons ?? []).filter((s) => s.status === AVAILABLE2).map((s) => s.seasonNumber)
  );
  if (available.size === 0) return false;
  return requested.every((n) => available.has(n));
}
function resolveRequestStatus(row, local) {
  let status = mapSeerrStatus(row.status, row.media?.status, row.media?.downloadStatus);
  if (local?.status === "available" && (status === "approved" || status === "unavailable" || status === "deleted")) {
    status = "available";
  }
  if (status === "partially_available" && allRequestedSeasonsAvailable(row)) {
    status = "available";
  }
  return status;
}

// server/download-progress.ts
function parseTimeSpan(raw) {
  if (!raw || typeof raw !== "string") return null;
  let rest = raw.trim();
  let days = 0;
  const dot = rest.indexOf(".");
  if (dot > 0 && dot < rest.indexOf(":")) {
    days = Number(rest.slice(0, dot));
    rest = rest.slice(dot + 1);
    if (!Number.isFinite(days)) return null;
  }
  const parts = rest.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  const total = days * 86400 + h * 3600 + m * 60 + s;
  return total >= 0 ? Math.round(total) : null;
}
function etaFrom(item) {
  const fromSpan = parseTimeSpan(item.timeLeft);
  const at = item.estimatedCompletionTime ?? null;
  if (fromSpan != null) return { seconds: fromSpan, at };
  if (at) {
    const ms = new Date(at).getTime() - Date.now();
    if (Number.isFinite(ms) && ms > 0) return { seconds: Math.round(ms / 1e3), at };
  }
  return { seconds: null, at };
}
function isValidating(size, sizeLeft, status) {
  if (status === "completed" || status === "importPending" || status === "importing") return true;
  return sizeLeft === 0 && size != null && size > 0;
}
function toDownloadProgress(item) {
  if (!item || typeof item !== "object") return null;
  const size = Number.isFinite(item.size) && item.size > 0 ? item.size : null;
  const sizeLeft = Number.isFinite(item.sizeLeft) ? Math.max(0, item.sizeLeft) : null;
  let percent = null;
  if (size != null && sizeLeft != null) {
    percent = Math.min(100, Math.max(0, (size - sizeLeft) / size * 100));
  }
  const eta = etaFrom(item);
  const status = typeof item.status === "string" ? item.status : "downloading";
  return {
    percent,
    size,
    sizeLeft,
    etaSeconds: eta.seconds,
    estimatedCompletionAt: eta.at,
    status,
    validating: isValidating(size, sizeLeft, status),
    title: item.title ?? item.episode?.title ?? null,
    seasonNumber: item.episode?.seasonNumber ?? null,
    episodeNumber: item.episode?.episodeNumber ?? null
  };
}
var MAX_DETAIL_ITEMS = 24;
function aggregateDownloads(items) {
  if (!Array.isArray(items) || items.length === 0) return { summary: null, items: [] };
  const parsed = items.map(toDownloadProgress).filter((p) => p !== null);
  if (parsed.length === 0) return { summary: null, items: [] };
  let totalSize = 0;
  let totalLeft = 0;
  let sized = 0;
  let maxEta = null;
  let latestAt = null;
  for (const p of parsed) {
    if (p.size != null && p.sizeLeft != null) {
      totalSize += p.size;
      totalLeft += p.sizeLeft;
      sized++;
    }
    if (p.etaSeconds != null && (maxEta === null || p.etaSeconds > maxEta)) maxEta = p.etaSeconds;
    if (p.estimatedCompletionAt && (!latestAt || p.estimatedCompletionAt > latestAt)) {
      latestAt = p.estimatedCompletionAt;
    }
  }
  const active = parsed.find((p) => p.status === "downloading") ?? parsed[0];
  const percent = sized > 0 && totalSize > 0 ? Math.min(100, Math.max(0, (totalSize - totalLeft) / totalSize * 100)) : null;
  const summary = {
    percent,
    size: sized > 0 ? totalSize : null,
    sizeLeft: sized > 0 ? totalLeft : null,
    etaSeconds: maxEta,
    estimatedCompletionAt: latestAt,
    status: parsed.some((p) => p.status === "downloading") ? "downloading" : active.status,
    // `every` et non `some` : tant qu'un seul épisode descend encore, la
    // demande télécharge réellement — ce n'est pas de la validation.
    validating: parsed.every((p) => p.validating),
    title: parsed.length === 1 ? active.title : null,
    seasonNumber: parsed.length === 1 ? active.seasonNumber : null,
    episodeNumber: parsed.length === 1 ? active.episodeNumber : null
  };
  const detail = parsed.slice().sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)).slice(0, MAX_DETAIL_ITEMS);
  return { summary, items: detail };
}

// server/seerr-unified.ts
function getUser(request) {
  return request.user;
}
function seerrRequestToUnified(sr, detail, localById, fallbackUser) {
  const local = localById.get(sr.id);
  const status = resolveRequestStatus(sr, local);
  const seasons = sr.seasons?.map((s) => s.seasonNumber).filter((n) => typeof n === "number") ?? null;
  const mediaType = sr.media?.mediaType ?? "movie";
  const title = detail?.title ?? detail?.name ?? local?.title ?? `#${sr.id}`;
  const year = (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null;
  const { summary, items } = aggregateDownloads(sr.media?.downloadStatus);
  return {
    download: summary,
    downloads: items.length > 1 ? items : void 0,
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

// server/requests-list.ts
var LOCAL_PENDING_STATUSES = [
  "queued",
  "processing",
  "retry_pending",
  "failed",
  "deleting",
  "delete_failed"
];
async function buildMergedRows(prisma, cfg, user, log) {
  const localPendingRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ?
       AND status IN (${LOCAL_PENDING_STATUSES.map(() => "?").join(",")})
     ORDER BY created_at DESC`,
    user.userId,
    ...LOCAL_PENDING_STATUSES
  );
  const localPending = localPendingRows.map(rowToRequest);
  const localBySeerrId = /* @__PURE__ */ new Map();
  const allLocalRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests WHERE jellyfin_user_id = ? AND seerr_request_id IS NOT NULL`,
    user.userId
  );
  for (const row of allLocalRows) {
    const r = rowToRequest(row);
    if (r.seerrRequestId) localBySeerrId.set(r.seerrRequestId, r);
  }
  let seerrRows = [];
  try {
    const seerUserId = await resolveJellyseerrUserId(cfg, prisma, user.userId, user.username);
    const all = await fetchAllSeerrRequests(cfg, seerUserId);
    seerrRows = all.rows;
  } catch (err) {
    log?.(err, "Seerr fetch failed, falling back to local only");
  }
  const seerrSeenIds = new Set(seerrRows.map((r) => r.id));
  const localOnly = localPending.filter(
    (l) => !l.seerrRequestId || !seerrSeenIds.has(l.seerrRequestId)
  );
  const deletingIds = /* @__PURE__ */ new Set();
  try {
    const pending = await prisma.$queryRawUnsafe(
      `SELECT seerr_request_id FROM seer_cleanup_queue
       WHERE status = 'pending' AND action = 'delete' AND seerr_request_id IS NOT NULL`
    );
    for (const r of pending) deletingIds.add(Number(r.seerr_request_id));
  } catch {
  }
  return {
    seerrRows,
    localBySeerrId,
    localOnly,
    deletingIds,
    stats: computeStats(seerrRows, localOnly, localBySeerrId, deletingIds),
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function computeStats(seerrRows, localOnly, localBySeerrId, deletingIds) {
  const byStatus = {};
  const byType = { movie: 0, tv: 0 };
  let total = 0;
  const bump = (status, mediaType) => {
    total++;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (mediaType === "movie") byType.movie++;
    else if (mediaType === "tv") byType.tv++;
  };
  for (const sr of seerrRows) {
    bump(effectiveStatus(sr, localBySeerrId, deletingIds), sr.media?.mediaType);
  }
  for (const l of localOnly) bump(l.status, l.mediaType);
  return { total, byStatus, byType };
}
function effectiveStatus(sr, localBySeerrId, deletingIds) {
  if (deletingIds.has(sr.id)) return "deleting";
  return resolveRequestStatus(sr, localBySeerrId.get(sr.id));
}
function collectTmdbRefs(rows) {
  const out = [];
  for (const sr of rows.seerrRows) {
    if (sr.media?.tmdbId) out.push({ mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId });
  }
  for (const l of rows.localOnly) {
    if (l.tmdbId) out.push({ mediaType: l.mediaType, tmdbId: l.tmdbId });
  }
  return out;
}
function metaToDetail(meta) {
  if (!meta) return null;
  return {
    id: meta.tmdbId,
    title: meta.mediaType === "movie" ? meta.title : void 0,
    name: meta.mediaType === "tv" ? meta.title : void 0,
    posterPath: meta.posterPath ?? void 0,
    backdropPath: meta.backdropPath ?? void 0,
    overview: meta.overview ?? void 0,
    releaseDate: meta.mediaType === "movie" ? meta.releaseDate ?? void 0 : void 0,
    firstAirDate: meta.mediaType === "tv" ? meta.releaseDate ?? void 0 : void 0
  };
}
function hydrateRows(rows, meta, user) {
  const out = rows.localOnly.map(localToUnified);
  for (const sr of rows.seerrRows) {
    if (!sr.media) continue;
    const detail = metaToDetail(meta.get(tmdbKey({ mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId })));
    const unified = seerrRequestToUnified(sr, detail, rows.localBySeerrId, {
      jellyfinUserId: user.userId,
      username: user.username
    });
    if (rows.deletingIds.has(sr.id)) unified.status = "deleting";
    out.push(unified);
  }
  out.sort((a, b) => b.createdAt > a.createdAt ? 1 : -1);
  return out;
}
function filterAndPaginate(items, query) {
  let filtered = items;
  if (query.type) filtered = filtered.filter((r) => r.mediaType === query.type);
  if (query.status) {
    const wanted = new Set(query.status.split(",").map((s) => s.trim()));
    filtered = filtered.filter((r) => wanted.has(r.status));
  }
  if (query.q) {
    const q = query.q.trim().toLowerCase();
    if (q) filtered = filtered.filter((r) => (r.title ?? "").toLowerCase().includes(q));
  }
  const total = filtered.length;
  const offset = (query.page - 1) * query.limit;
  return {
    results: filtered.slice(offset, offset + query.limit),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit))
  };
}

// server/routes-requests-read.ts
var ROWS_TTL_MS = 6e4;
var ROWS_STALE_MS = 6e5;
var PAGE_META_BUDGET = 20;
var rowsCacheKey = (userId) => `seer-cache:${userId}:rows`;
function registerRequestReadRoutes(app, prisma, getWorkerConfig2) {
  async function loadRows(cfg, user) {
    return cached(
      rowsCacheKey(user.userId),
      ROWS_TTL_MS,
      () => buildMergedRows(prisma, cfg, user, (err, msg) => app.log?.warn?.({ err }, msg)),
      { staleMs: ROWS_STALE_MS }
    );
  }
  app.get("/requests", async (request) => {
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
    const rows = await loadRows(config, user);
    const refs = collectTmdbRefs(rows);
    const { meta, missing } = await resolveTmdbMeta(prisma, config, refs, { maxFetch: 0 });
    let items = hydrateRows(rows, meta, user);
    let result = filterAndPaginate(items, { page, limit, status: query.status, type: query.type, q: query.q });
    if (missing.length > 0) {
      const visible = new Set(
        result.results.map((r) => tmdbKey({ mediaType: r.mediaType, tmdbId: r.tmdbId }))
      );
      const onPage = missing.filter((r) => visible.has(tmdbKey(r)));
      if (onPage.length > 0) {
        const filled = await resolveTmdbMeta(prisma, config, onPage, { maxFetch: PAGE_META_BUDGET });
        for (const [k, v] of filled.meta) meta.set(k, v);
        items = hydrateRows(rows, meta, user);
        result = filterAndPaginate(items, { page, limit, status: query.status, type: query.type, q: query.q });
      }
      scheduleTmdbBackfill(prisma, config, missing);
    }
    return {
      ...result,
      stats: rows.stats,
      // > 0 : des titres manquent encore, le front repasse plus vite.
      metaPending: pendingBackfillCount()
    };
  });
  app.get("/requests/stats", async (request) => {
    const user = getUser(request);
    const config = await getWorkerConfig2();
    const empty = { total: 0, byStatus: {}, byType: { movie: 0, tv: 0 } };
    if (!config) return empty;
    const hit = peek(rowsCacheKey(user.userId), true);
    if (hit) return hit.stats;
    const rows = await loadRows(config, user);
    return rows.stats;
  });
  app.get("/requests/lookup", async (request) => {
    const user = getUser(request);
    const q = request.query;
    const tmdbId = Number(q.tmdbId);
    if (q.mediaType !== "tv" || !Number.isFinite(tmdbId) || tmdbId <= 0) return { seasons: [] };
    const rows = await prisma.$queryRawUnsafe(
      `SELECT seasons FROM seer_requests
       WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = 'tv'
         AND status NOT IN ('deleted', 'failed', 'available', 'deleting', 'delete_failed')`,
      user.userId,
      tmdbId
    );
    const seasons = /* @__PURE__ */ new Set();
    for (const r of rows) {
      if (!r.seasons) continue;
      try {
        const arr = typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons;
        if (Array.isArray(arr)) {
          for (const s of arr) {
            const n = Number(s);
            if (Number.isFinite(n)) seasons.add(n);
          }
        }
      } catch {
      }
    }
    return { seasons: [...seasons].sort((a, b) => a - b) };
  });
}

// server/routes-requests-actions.ts
function registerRequestActionRoutes(app, prisma, getWorkerConfig2) {
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
      kickWorkerNow();
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
    kickWorkerNow();
    return reply.status(201).send(newReq);
  });
  app.post("/requests/:id/mark", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const target = body.status;
    if (!target || !["available", "partial", "processing", "unknown"].includes(target)) {
      return reply.status(400).send({ message: "status must be 'available', 'partial', 'processing' or 'unknown'" });
    }
    const config = await getWorkerConfig2();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const parsed = parseRequestId(id);
    let seerrMediaId = null;
    let ownerJellyfinUserId = null;
    let ownerUsername = null;
    let seerrReq = null;
    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      seerrMediaId = req.seerrMediaId;
      ownerJellyfinUserId = req.jellyfinUserId;
    } else {
      seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
      if (!seerrReq) return reply.status(404).send({ message: "Seerr request not found" });
      seerrMediaId = seerrReq.media?.id ?? null;
      if (seerrReq.requestedBy?.id) {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT jellyfin_user_id, username FROM seer_user_settings WHERE jellyseerr_user_id = ? LIMIT 1`,
          seerrReq.requestedBy.id
        );
        ownerJellyfinUserId = rows[0]?.jellyfin_user_id ?? null;
        ownerUsername = rows[0]?.username ?? null;
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
    const localStatus = target === "available" ? "available" : target === "partial" ? "partially_available" : "unavailable";
    const extra = target === "available" ? { completedAt: /* @__PURE__ */ new Date() } : void 0;
    if (parsed.kind === "local") {
      await updateRequestStatus(prisma, parsed.id, localStatus, extra);
    } else if (seerrReq?.media && ownerJellyfinUserId) {
      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM seer_requests WHERE seerr_request_id = ? LIMIT 1`,
        seerrReq.id
      );
      if (existing.length > 0) {
        await updateRequestStatus(prisma, existing[0].id, localStatus, extra);
      } else if (target === "available") {
        await insertAvailablePin(prisma, config, seerrReq, {
          jellyfinUserId: ownerJellyfinUserId,
          username: ownerUsername ?? user.username
        });
      }
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
      requestId: id,
      jellyfinUserId: req.jellyfinUserId
    });
    kickWorkerNow();
    return { success: true };
  });
}
async function insertAvailablePin(prisma, config, seerrReq, owner) {
  const media = seerrReq.media;
  if (!media) return;
  const detail = await fetchSeerrTmdbDetail(config, media.mediaType, media.tmdbId);
  const seasons = seerrReq.seasons?.map((s) => s.seasonNumber).filter((n) => typeof n === "number") ?? [];
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_requests
      (id, jellyfin_user_id, username, media_type, tmdb_id, title, poster_path,
       backdrop_path, overview, year, seasons, status, seerr_request_id,
       seerr_media_id, seerr_media_status, sent_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, NOW(), NOW())`,
    uuid(),
    owner.jellyfinUserId,
    owner.username,
    media.mediaType,
    media.tmdbId,
    detail?.title ?? detail?.name ?? `#${seerrReq.id}`,
    detail?.posterPath ?? null,
    detail?.backdropPath ?? null,
    detail?.overview ?? null,
    (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null,
    seasons.length > 0 ? JSON.stringify(seasons) : null,
    seerrReq.id,
    media.id,
    media.status ?? null
  );
}

// server/routes-requests.ts
function registerRequestRoutes(app, prisma, getWorkerConfig2) {
  registerRequestReadRoutes(app, prisma, getWorkerConfig2);
  registerRequestActionRoutes(app, prisma, getWorkerConfig2);
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
        kickWorkerNow();
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
    kickWorkerNow();
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
      const reqSeasons = req.seasons ?? [];
      const isSeasonSpecific2 = req.mediaType === "tv" && !!body.seasons && body.seasons.length > 0;
      const removing2 = isSeasonSpecific2 ? body.seasons : req.mediaType === "tv" && reqSeasons.length > 0 ? reqSeasons : null;
      const remaining2 = isSeasonSpecific2 ? reqSeasons.filter((s) => !removing2.includes(s)) : [];
      const partial2 = isSeasonSpecific2 && remaining2.length > 0;
      await enqueueCleanup(prisma, {
        action: "delete",
        mediaType: req.mediaType,
        tmdbId: req.tmdbId,
        title: req.title,
        // En partiel on préserve la demande Jellyseerr et la ligne locale
        // (les saisons conservées restent suivies) ; on agit uniquement sur *arr.
        seerrRequestId: partial2 ? null : req.seerrRequestId,
        seerrMediaId: req.seerrMediaId,
        deleteFiles,
        seasons: removing2,
        requestId: partial2 ? null : parsed.id,
        // Propriétaire réel : un admin peut supprimer la demande d'un tiers,
        // et c'est SON cache à lui qu'il faut invalider, pas celui de tout le monde.
        jellyfinUserId: req.jellyfinUserId
      });
      if (partial2) {
        await addSeasonsToRequest(prisma, parsed.id, remaining2);
      } else {
        await updateRequestStatus(prisma, parsed.id, "deleting");
      }
      invalidate(`seer-cache:${user.userId}`);
      kickWorkerNow();
      return { success: true, status: partial2 ? "updated" : "deleting" };
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
    const seerrMediaType = seerrReq.media?.mediaType ?? "movie";
    const seerrSeasons = (seerrReq.seasons ?? []).map((s) => s.seasonNumber).filter((n) => typeof n === "number");
    const isSeasonSpecific = seerrMediaType === "tv" && !!body.seasons && body.seasons.length > 0;
    const removing = isSeasonSpecific ? body.seasons : seerrMediaType === "tv" && seerrSeasons.length > 0 ? seerrSeasons : null;
    const remaining = isSeasonSpecific ? seerrSeasons.filter((s) => !removing.includes(s)) : [];
    const partial = isSeasonSpecific && remaining.length > 0;
    await enqueueCleanup(prisma, {
      action: "delete",
      mediaType: seerrMediaType,
      tmdbId: seerrReq.media?.tmdbId ?? 0,
      title: `#${seerrReq.id}`,
      seerrRequestId: partial ? null : seerrReq.id,
      seerrMediaId: seerrReq.media?.id ?? null,
      deleteFiles,
      seasons: removing,
      requestId: null,
      jellyfinUserId: user.userId
    });
    invalidate(`seer-cache:${user.userId}`);
    kickWorkerNow();
    return { success: true, status: partial ? "updated" : "deleting" };
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
          // Cohérent avec la suppression unitaire : on arrête le suivi sans
          // supprimer les fichiers (lib partagée). Scopé aux saisons de la demande
          // pour ne jamais toucher d'autres saisons de la série.
          deleteFiles: false,
          seasons: req.mediaType === "tv" && req.seasons && req.seasons.length > 0 ? req.seasons : null,
          requestId: id,
          jellyfinUserId: req.jellyfinUserId
        });
        deleted++;
      } catch {
        errors++;
      }
    }
    if (deleted > 0) kickWorkerNow();
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
    if (retried > 0) kickWorkerNow();
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
      const [radarr, sonarr2] = await Promise.all([
        fetchArrOptions(seerr, "radarr"),
        fetchArrOptions(seerr, "sonarr")
      ]);
      console.log(`[SeerProfiles] Found ${radarr.length} Radarr, ${sonarr2.length} Sonarr`);
      return { radarr, sonarr: sonarr2 };
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
    async (_request, reply) => {
      const config = await getWorkerConfig2();
      let jellyfinUsers = [];
      let jellyfinError = null;
      try {
        jellyfinUsers = await fetchJellyfinUsers();
      } catch (err) {
        jellyfinError = err instanceof Error ? err.message : "Jellyfin fetch failed";
      }
      if (config) {
        try {
          const seerUsers = await listAllJellyseerrUsers(config);
          const known = new Set(jellyfinUsers.map((u) => u.id));
          for (const su of seerUsers) {
            if (!su.jellyfinUserId || known.has(su.jellyfinUserId)) continue;
            jellyfinUsers.push({
              id: su.jellyfinUserId,
              name: su.jellyfinUsername || su.username || su.jellyfinUserId
            });
          }
        } catch {
        }
      }
      if (jellyfinUsers.length === 0) {
        return reply.status(503).send({
          message: jellyfinError ? `Cannot list Jellyfin users: ${jellyfinError}` : "No source available to list Jellyfin users"
        });
      }
      return await listJellyfinUsersWithStats(prisma, jellyfinUsers);
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
      let invalidatedLinks = 0;
      try {
        invalidatedLinks = await invalidateStaleJellyseerrCache(config, prisma);
      } catch {
      }
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
      const aliveIds = new Set(users.map((u) => u.id));
      let removed = 0;
      const allSettings = await prisma.$queryRawUnsafe(
        `SELECT jellyfin_user_id FROM seer_user_settings`
      );
      for (const row of allSettings) {
        if (aliveIds.has(row.jellyfin_user_id)) continue;
        const hasReqs = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) AS cnt FROM seer_requests
           WHERE jellyfin_user_id = ?
             AND status NOT IN ('deleted','delete_failed')`,
          row.jellyfin_user_id
        );
        if (Number(hasReqs[0]?.cnt ?? 0) === 0) {
          await prisma.$executeRawUnsafe(
            `DELETE FROM seer_user_settings WHERE jellyfin_user_id = ?`,
            row.jellyfin_user_id
          );
          removed++;
        }
      }
      return {
        synced,
        failed,
        created,
        removed,
        invalidatedLinks,
        total: all.length,
        jellyfinAdminOk: jellyfinError === null
      };
    }
  );
  app.post(
    "/admin/sync-requests-ownership",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const config = await getWorkerConfig2();
      if (!config) return reply.status(503).send({ message: "Seerr not configured" });
      try {
        await invalidateStaleJellyseerrCache(config, prisma);
      } catch {
      }
      let alreadyOk = 0;
      let reassigned = 0;
      let recreated = 0;
      let orphansCreated = 0;
      let failed = 0;
      const usersTouched = /* @__PURE__ */ new Set();
      const errors = [];
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, jellyfin_user_id, username, seerr_request_id, seerr_media_id, media_type, tmdb_id, seasons
         FROM seer_requests
         WHERE seerr_request_id IS NOT NULL
           AND status NOT IN ('deleted','deleting','delete_failed')`
      );
      const distinctUsers = /* @__PURE__ */ new Map();
      for (const r of rows) {
        if (distinctUsers.has(r.jellyfin_user_id)) continue;
        const best = await pickBestUsernameFor(prisma, r.jellyfin_user_id, r.username);
        distinctUsers.set(r.jellyfin_user_id, best);
      }
      const targetByJellyfin = /* @__PURE__ */ new Map();
      for (const [jfUserId, jfUsername] of distinctUsers) {
        try {
          const seerUserId = await resolveJellyseerrUserId(config, prisma, jfUserId, jfUsername);
          targetByJellyfin.set(jfUserId, seerUserId);
        } catch {
          try {
            const placeholder = await createPlaceholderJellyseerrUser(config, jfUsername);
            await updateUserSettings(prisma, jfUserId, {
              jellyseerrUserId: placeholder.id,
              jellyseerrLastSync: /* @__PURE__ */ new Date(),
              username: jfUsername
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
        let parsedSeasons = null;
        if (r.seasons) {
          try {
            parsedSeasons = typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons;
          } catch {
            parsedSeasons = null;
          }
        }
        try {
          const result = await reassignSeerrRequestOwnership(
            config,
            r.seerr_request_id,
            target,
            {
              mediaType: r.media_type,
              tmdbId: r.tmdb_id,
              seasons: parsedSeasons
            }
          );
          if (result.method === "skip") {
            alreadyOk++;
          } else if (result.method === "create-missing") {
            recreated++;
            usersTouched.add(r.jellyfin_user_id);
            if (result.newRequestId) {
              await prisma.$executeRawUnsafe(
                `UPDATE seer_requests SET seerr_request_id = ? WHERE id = ?`,
                result.newRequestId,
                r.id
              );
            }
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
        recreated,
        alreadyOk,
        orphansCreated,
        failed,
        errors: errors.slice(0, 20)
        // limiter le payload
      };
    }
  );
}
async function pickBestUsernameFor(prisma, jellyfinUserId, fallback) {
  const isUuid = /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT username FROM seer_requests
     WHERE jellyfin_user_id = ? AND username IS NOT NULL AND username <> ''
     ORDER BY created_at DESC LIMIT 50`,
    jellyfinUserId
  );
  for (const r of rows) {
    if (r.username && !isUuid.test(r.username) && r.username !== jellyfinUserId) {
      return r.username;
    }
  }
  const settings = await prisma.$queryRawUnsafe(
    `SELECT username FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
    jellyfinUserId
  );
  if (settings[0]?.username && !isUuid.test(settings[0].username) && settings[0].username !== jellyfinUserId) {
    return settings[0].username;
  }
  return rows[0]?.username || fallback;
}
async function reassignSeerrRequestOwnership(config, seerrRequestId, targetUserId, localMedia) {
  const headers = { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey };
  const cur = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  });
  if (cur.status === 404) {
    if (!localMedia.tmdbId) throw new Error("missing local tmdbId for re-creation");
    const createBody2 = {
      mediaType: localMedia.mediaType,
      mediaId: localMedia.tmdbId,
      userId: targetUserId
    };
    if (localMedia.seasons?.length) createBody2.seasons = localMedia.seasons;
    const postRes2 = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST",
      headers,
      body: JSON.stringify(createBody2),
      signal: AbortSignal.timeout(15e3)
    });
    if (!postRes2.ok) {
      const text = await postRes2.text().catch(() => "");
      throw new Error(`re-create missing failed (${postRes2.status}): ${text.slice(0, 200)}`);
    }
    const created2 = await postRes2.json();
    return { method: "create-missing", newRequestId: created2.id };
  }
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

// server/availability.ts
var THEATRICAL_WINDOW_DAYS = 180;
var RECENT_WINDOW_DAYS = 120;
function daysBetween(from, to) {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const a = new Date(ay, am - 1, ad).getTime();
  const b = new Date(by, bm - 1, bd).getTime();
  return Math.round((b - a) / 864e5);
}
var RANK = { physical: 0, digital: 1, streaming: 2, theatrical: 3 };
function buildChannels(meta, today) {
  const raw = [
    ["physical", meta.physicalDate],
    ["digital", meta.digitalDate],
    ["theatrical", meta.theatricalDate]
  ];
  const channels = [];
  for (const [id, date] of raw) {
    if (!date) continue;
    const released = date <= today;
    if (released) {
      const window = id === "theatrical" ? THEATRICAL_WINDOW_DAYS : RECENT_WINDOW_DAYS;
      if (daysBetween(date, today) > window) continue;
    }
    channels.push({ id, date, released });
  }
  const hasDigital = channels.some((c) => c.id === "digital" && c.released);
  if (!hasDigital && (meta.providerIds?.length ?? 0) > 0) {
    channels.push({ id: "streaming", date: null, released: true });
  }
  return channels.sort((a, b) => {
    if (a.released !== b.released) return a.released ? -1 : 1;
    if (a.released) return RANK[a.id] - RANK[b.id];
    return (a.date ?? "").localeCompare(b.date ?? "");
  });
}
function kindOf(channels, meta, today) {
  const first = channels[0];
  if (!first) {
    return meta.releaseDate && meta.releaseDate > today ? "upcoming" : "released";
  }
  if (first.released) return first.id === "theatrical" ? "theatrical" : "released";
  return first.id === "digital" ? "digital_soon" : "upcoming";
}
function outlookOf(meta, today, channels) {
  const outOfTheaters = meta.digitalDate != null && meta.digitalDate <= today || meta.physicalDate != null && meta.physicalDate <= today || (meta.providerIds?.length ?? 0) > 0;
  if (outOfTheaters) return "likely";
  if (channels.some((c) => c.released)) return "unlikely";
  return channels.length === 0 ? "likely" : "not_yet";
}
function classifyAvailability(meta, today = todayString()) {
  const base = {
    mediaType: meta.mediaType,
    tmdbId: meta.tmdbId,
    theatricalDate: meta.theatricalDate,
    digitalDate: meta.digitalDate,
    physicalDate: meta.physicalDate,
    providerIds: meta.providerIds ?? []
  };
  if (meta.mediaType === "tv") {
    const notAired = meta.releaseDate && meta.releaseDate > today || !meta.releaseDate && isPlanned(meta.tmdbStatus);
    return {
      ...base,
      // Rien qui ne soit pas encore diffusé ne peut être « en streaming ».
      channels: notAired ? [] : buildChannels(meta, today),
      outlook: notAired ? "not_yet" : "likely",
      kind: notAired ? "not_aired" : "released",
      date: notAired ? meta.releaseDate : null,
      obtainable: !notAired
    };
  }
  const channels = buildChannels(meta, today);
  const kind = kindOf(channels, meta, today);
  const outlook = outlookOf(meta, today, channels);
  const date = channels[0]?.date ?? (meta.releaseDate && meta.releaseDate > today ? meta.releaseDate : null);
  return {
    ...base,
    channels,
    outlook,
    kind,
    date: kind === "released" && channels.length === 0 ? null : date,
    obtainable: outlook === "likely"
  };
}
function isPlanned(tmdbStatus) {
  const status = (tmdbStatus ?? "").toLowerCase();
  return status === "planned" || status === "in production" || status === "rumored";
}

// server/routes-availability.ts
var MAX_ITEMS = 120;
var FETCH_BUDGET = 12;
function registerAvailabilityRoutes(app, prisma, getWorkerConfig2) {
  app.post("/availability", async (request) => {
    const body = request.body ?? {};
    const asked = Array.isArray(body.items) ? body.items : [];
    const raw = asked.slice(0, MAX_ITEMS);
    if (asked.length > MAX_ITEMS) {
      console.warn(`[Seer] /availability : ${asked.length} titres demand\xE9s, ${MAX_ITEMS} trait\xE9s`);
    }
    const refs = [];
    for (const it of raw) {
      const tmdbId = Number(it?.tmdbId);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0) continue;
      if (it?.mediaType !== "movie" && it?.mediaType !== "tv") continue;
      refs.push({ mediaType: it.mediaType, tmdbId });
    }
    if (refs.length === 0) return { results: [] };
    const config = await getWorkerConfig2();
    const region = typeof body.region === "string" && /^[a-z]{2}$/i.test(body.region) ? body.region.toUpperCase() : DEFAULT_REGION;
    const { meta, missing } = await resolveTmdbMeta(prisma, config, refs, {
      maxFetch: FETCH_BUDGET,
      region
    });
    if (missing.length > 0) scheduleTmdbBackfill(prisma, config, missing, region);
    const results = [];
    for (const ref of refs) {
      const m = meta.get(tmdbKey(ref));
      if (m) results.push(classifyAvailability(m));
    }
    return { results, pending: missing.length };
  });
}

// server/arr-queue.ts
var MAX_ITEMS2 = 60;
async function fetchQueue(server, path) {
  try {
    const res = await fetch(`${buildArrUrl(server)}${path}`, {
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { records: data.records ?? [], total: data.totalRecords ?? 0 };
  } catch {
    return null;
  }
}
function isValidating2(r) {
  const state = r.trackedDownloadState ?? "";
  if (state === "importPending" || state === "importing") return true;
  if (r.status === "completed") return true;
  return r.sizeleft === 0 && typeof r.size === "number" && r.size > 0;
}
function firstMessage(r) {
  if (r.errorMessage) return r.errorMessage;
  for (const m of r.statusMessages ?? []) {
    const text = m.messages?.[0] ?? m.title;
    if (text) return text;
  }
  return null;
}
function toEntry(r, source) {
  if (r.id == null) return null;
  const size = typeof r.size === "number" && r.size > 0 ? r.size : null;
  const left = typeof r.sizeleft === "number" ? Math.max(0, r.sizeleft) : null;
  const percent = size != null && left != null ? Math.min(100, Math.max(0, (size - left) / size * 100)) : null;
  const media = source === "sonarr" ? r.series : r.movie;
  return {
    id: `${source}-${r.id}`,
    source,
    mediaType: source === "sonarr" ? "tv" : "movie",
    title: media?.title ?? r.title ?? "",
    seasonNumber: r.seasonNumber ?? null,
    episodeNumber: r.episode?.episodeNumber ?? null,
    episodeTitle: r.episode?.title ?? null,
    tmdbId: media?.tmdbId ?? null,
    percent,
    size,
    etaSeconds: parseTimeSpan(r.timeleft),
    validating: isValidating2(r),
    paused: r.status === "paused" || r.status === "delay",
    warning: r.status === "warning" || r.status === "failed" ? firstMessage(r) : null
  };
}
async function fetchServerQueue(cfg) {
  const [sonarr2, radarr] = await Promise.all([
    getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "sonarr"),
    getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "radarr")
  ]);
  const [sq, rq] = await Promise.all([
    sonarr2 ? fetchQueue(sonarr2, "/api/v3/queue?pageSize=100&includeSeries=true&includeEpisode=true") : Promise.resolve(null),
    radarr ? fetchQueue(radarr, "/api/v3/queue?pageSize=100&includeMovie=true") : Promise.resolve(null)
  ]);
  const unreachable = [];
  if (!sq) unreachable.push("sonarr");
  if (!rq) unreachable.push("radarr");
  const items = [
    ...(sq?.records ?? []).map((r) => toEntry(r, "sonarr")),
    ...(rq?.records ?? []).map((r) => toEntry(r, "radarr"))
  ].filter((e) => e !== null);
  items.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.title.localeCompare(b.title));
  return {
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    items: items.slice(0, MAX_ITEMS2),
    total: (sq?.total ?? 0) + (rq?.total ?? 0),
    unreachable
  };
}

// server/routes-progress.ts
var PROGRESS_TTL_MS = 1e4;
var QUEUE_TTL_MS = 8e3;
function registerProgressRoutes(app, prisma, getWorkerConfig2, requireAdmin) {
  app.get("/downloads", { preHandler: requireAdmin }, async () => {
    const config = await getWorkerConfig2();
    const empty = {
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      items: [],
      total: 0,
      unreachable: []
    };
    if (!config) return empty;
    return cached("seer:arr:queue", QUEUE_TTL_MS, () => fetchServerQueue(config));
  });
  app.get("/requests/progress", async (request) => {
    const user = getUser(request);
    const config = await getWorkerConfig2();
    if (!config) return { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), items: [] };
    return cached(`seer-cache:${user.userId}:progress`, PROGRESS_TTL_MS, async () => {
      const rows = await collectActiveRows(prisma, config, user.userId, user.username);
      const localIds = /* @__PURE__ */ new Map();
      const seerrIds = rows.map((r) => r.id).filter((n) => Number.isFinite(n));
      if (seerrIds.length > 0) {
        const placeholders = seerrIds.map(() => "?").join(",");
        const found = await prisma.$queryRawUnsafe(
          `SELECT id, seerr_request_id FROM seer_requests
           WHERE jellyfin_user_id = ? AND seerr_request_id IN (${placeholders})`,
          user.userId,
          ...seerrIds
        ).catch(() => []);
        for (const f of found) localIds.set(Number(f.seerr_request_id), f.id);
      }
      const items = [];
      for (const sr of rows) {
        const { summary, items: detail } = aggregateDownloads(sr.media?.downloadStatus);
        if (!summary) continue;
        const status = resolveRequestStatus(sr);
        if (status === "available" && (summary.percent ?? 0) >= 100) continue;
        items.push({
          id: localIds.get(sr.id) ?? `seerr-${sr.id}`,
          tmdbId: sr.media?.tmdbId ?? 0,
          mediaType: sr.media?.mediaType ?? "movie",
          status,
          download: summary,
          downloads: detail.length > 1 ? detail : void 0
        });
      }
      return { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), items };
    });
  });
}
async function collectActiveRows(prisma, config, userId, username) {
  const out = /* @__PURE__ */ new Map();
  try {
    const seerUserId = await resolveJellyseerrUserId(config, prisma, userId, username);
    const page = await fetchSeerrRequestsPage(config, seerUserId, 100, 0, "processing");
    for (const r of page.rows) out.set(r.id, r);
  } catch {
  }
  const hit = peek(rowsCacheKey(userId), true);
  if (hit) {
    for (const r of hit.seerrRows) {
      if (out.has(r.id)) continue;
      if ((r.media?.downloadStatus?.length ?? 0) > 0) out.set(r.id, r);
    }
  }
  return Array.from(out.values());
}

// server/calendar-freshness.ts
function isDateless(m) {
  return !m.releaseDate && !m.digitalDate && !m.theatricalDate && !m.physicalDate && !m.nextAirDate;
}
function needsDateRefresh(m, now = Date.now()) {
  if (!isDateless(m)) return false;
  const expires = Date.parse(m.expiresAt);
  return !Number.isFinite(expires) || expires <= now;
}
function needsTraitsRefresh(m) {
  return !m.originalLanguage;
}

// server/calendar-types.ts
var DATE_RE2 = /^\d{4}-\d{2}-\d{2}$/;
function isDayString(v) {
  return typeof v === "string" && DATE_RE2.test(v);
}
function addDays(day, delta) {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
function makeItemId(mediaType, tmdbId, kind, date) {
  return `${mediaType}:${tmdbId}:${kind}:${date}`;
}
function sortCalendarItems(items) {
  return items.sort((a, b) => a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1);
}
function capPerSeries(items, max) {
  const seen = /* @__PURE__ */ new Map();
  const out = [];
  for (const item of items) {
    if (item.mediaType !== "tv") {
      out.push(item);
      continue;
    }
    const n = (seen.get(item.tmdbId) ?? 0) + 1;
    seen.set(item.tmdbId, n);
    if (n <= max) out.push(item);
  }
  return out;
}

// server/calendar-personal.ts
var FETCH_BUDGET2 = 25;
var MAX_PER_SERIES = 3;
var SETTLED_MEDIA_STATUS = /* @__PURE__ */ new Set([5]);
async function buildPersonalCalendar(prisma, cfg, user, rows, opts) {
  const region = opts.region ?? DEFAULT_REGION;
  const refs = /* @__PURE__ */ new Map();
  const statusByKey = /* @__PURE__ */ new Map();
  for (const sr of rows.seerrRows) {
    if (!sr.media?.tmdbId) continue;
    const ref = { mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId };
    const key = tmdbKey(ref);
    if (!opts.includeSettled && sr.media.mediaType === "movie" && SETTLED_MEDIA_STATUS.has(sr.media.status ?? 0)) continue;
    refs.set(key, ref);
    if (!statusByKey.has(key)) {
      const local = rows.localBySeerrId.get(sr.id);
      statusByKey.set(key, {
        status: resolveRequestStatus(sr, local),
        requestId: local?.id ?? `seerr-${sr.id}`
      });
    }
  }
  for (const l of rows.localOnly) {
    if (!l.tmdbId) continue;
    const key = tmdbKey({ mediaType: l.mediaType, tmdbId: l.tmdbId });
    refs.set(key, { mediaType: l.mediaType, tmdbId: l.tmdbId });
    if (!statusByKey.has(key)) statusByKey.set(key, { status: l.status, requestId: l.id });
  }
  const list = Array.from(refs.values());
  const { meta, missing } = await resolveTmdbMeta(prisma, cfg, list, {
    maxFetch: opts.maxFetch ?? FETCH_BUDGET2,
    region
  });
  const undated = list.filter((ref) => {
    const m = meta.get(tmdbKey(ref));
    return !!m && needsDateRefresh(m);
  });
  const toFill = [...missing, ...undated];
  const untyped = list.filter((ref) => {
    const m = meta.get(tmdbKey(ref));
    return !!m && !needsDateRefresh(m) && needsTraitsRefresh(m);
  });
  if (toFill.length > 0 || untyped.length > 0) {
    scheduleTmdbBackfill(prisma, cfg, [...toFill, ...untyped], region);
  }
  const items = [];
  for (const ref of list) {
    const m = meta.get(tmdbKey(ref));
    if (!m) continue;
    const ctx = statusByKey.get(tmdbKey(ref));
    for (const item of metaToCalendarItems(m, opts.from, opts.to)) {
      items.push({
        ...item,
        requestId: ctx?.requestId ?? null,
        requestStatus: ctx?.status ?? null
      });
    }
  }
  return {
    from: opts.from,
    to: opts.to,
    items: capPerSeries(sortCalendarItems(items), MAX_PER_SERIES),
    partial: toFill.length > 0
  };
}
function metaToCalendarItems(m, from, to) {
  const out = [];
  const push = (date, kind, season, episode) => {
    if (!date || date < from || date > to) return;
    out.push({
      id: makeItemId(m.mediaType, m.tmdbId, kind, date),
      date,
      mediaType: m.mediaType,
      tmdbId: m.tmdbId,
      title: m.title,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      overview: m.overview,
      kind,
      seasonNumber: season ?? null,
      episodeNumber: episode ?? null,
      networks: m.networks,
      providerIds: m.providerIds,
      voteAverage: m.voteAverage ?? null,
      popularity: m.popularity ?? null,
      originalLanguage: m.originalLanguage ?? null,
      isAnime: m.isAnime ?? false
    });
  };
  if (m.mediaType === "movie") {
    push(m.digitalDate, "digital");
    push(m.theatricalDate, "theatrical");
    push(m.physicalDate, "physical");
    if (out.length === 0) push(m.releaseDate, "premiere");
  } else {
    push(m.nextAirDate, "episode", m.nextSeason, m.nextEpisode);
    if (m.releaseDate && (!m.nextAirDate || m.releaseDate !== m.nextAirDate)) {
      push(m.releaseDate, "premiere");
    }
  }
  return out;
}

// server/calendar-everyone.ts
var LOCAL_PENDING_STATUSES2 = [
  "queued",
  "processing",
  "retry_pending",
  "failed",
  "deleting",
  "delete_failed"
];
var NO_STATS = { total: 0, byStatus: {}, byType: { movie: 0, tv: 0 } };
async function buildEveryoneRows(prisma, cfg, log) {
  const localPendingRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE status IN (${LOCAL_PENDING_STATUSES2.map(() => "?").join(",")})
     ORDER BY created_at DESC`,
    ...LOCAL_PENDING_STATUSES2
  );
  const localPending = localPendingRows.map(rowToRequest);
  const localBySeerrId = /* @__PURE__ */ new Map();
  const allLocalRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests WHERE seerr_request_id IS NOT NULL`
  );
  for (const row of allLocalRows) {
    const r = rowToRequest(row);
    if (r.seerrRequestId) localBySeerrId.set(r.seerrRequestId, r);
  }
  let seerrRows = [];
  try {
    const all = await fetchAllSeerrRequests(cfg, null);
    seerrRows = all.rows;
  } catch (err) {
    log?.(err, "Seerr fetch (tous) failed, falling back to local only");
  }
  const seerrSeenIds = new Set(seerrRows.map((r) => r.id));
  const localOnly = localPending.filter(
    (l) => !l.seerrRequestId || !seerrSeenIds.has(l.seerrRequestId)
  );
  return {
    seerrRows,
    localBySeerrId,
    localOnly,
    deletingIds: /* @__PURE__ */ new Set(),
    stats: NO_STATS,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// server/calendar-requested.ts
async function markRequested(prisma, items) {
  if (items.length === 0) return;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT media_type, tmdb_id FROM seer_requests WHERE tmdb_id > 0`
    );
    if (rows.length === 0) return;
    const demandes = new Set(rows.map((r) => `${r.media_type}:${Number(r.tmdb_id)}`));
    for (const item of items) {
      if (demandes.has(`${item.mediaType}:${item.tmdbId}`)) {
        item.requestStatus = item.requestStatus ?? "processing";
      }
    }
  } catch {
  }
}

// server/calendar-providers.ts
var EPISODE_FETCH_BUDGET = 30;
var MEDIA_STATUS_BLOCKLISTED = 6;
async function buildProviderEpisodes(prisma, cfg, rows, opts) {
  const refs = [];
  const posters = /* @__PURE__ */ new Map();
  for (const r of rows) {
    if (!r.id || r.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED) continue;
    refs.push({ mediaType: "tv", tmdbId: r.id });
    posters.set(r.id, r);
  }
  if (refs.length === 0) return { items: [], partial: false };
  const { meta, missing } = await resolveTmdbMeta(prisma, cfg, refs, {
    maxFetch: EPISODE_FETCH_BUDGET,
    region: opts.region
  });
  if (missing.length > 0) scheduleTmdbBackfill(prisma, cfg, missing, opts.region);
  const items = [];
  for (const ref of refs) {
    const m = meta.get(tmdbKey(ref));
    const date = m?.nextAirDate;
    if (!m || !date || date < opts.from || date > opts.to) continue;
    const src = posters.get(ref.tmdbId);
    items.push({
      id: makeItemId("tv", ref.tmdbId, "episode", date),
      date,
      mediaType: "tv",
      tmdbId: ref.tmdbId,
      title: m.title || src?.name || "",
      posterPath: m.posterPath ?? src?.posterPath ?? null,
      backdropPath: m.backdropPath ?? src?.backdropPath ?? null,
      overview: m.overview ?? src?.overview ?? null,
      kind: "episode",
      seasonNumber: m.nextSeason,
      episodeNumber: m.nextEpisode,
      networks: m.networks,
      voteAverage: m.voteAverage ?? null,
      popularity: m.popularity ?? null,
      originalLanguage: m.originalLanguage ?? null,
      isAnime: m.isAnime ?? false,
      // Les vraies plateformes de la série, pas celles qu'on a demandées.
      providerIds: m.providerIds ?? [],
      requestId: null,
      requestStatus: null
    });
  }
  return { items, partial: missing.length > 0 };
}
async function attachProviderIds(prisma, cfg, items, region) {
  const refs = items.filter((i) => i.providerIds.length === 0).map((i) => ({ mediaType: i.mediaType, tmdbId: i.tmdbId }));
  if (refs.length === 0) return;
  const { meta } = await resolveTmdbMeta(prisma, cfg, refs, { maxFetch: 0, region });
  for (const item of items) {
    if (item.providerIds.length > 0) continue;
    const m = meta.get(tmdbKey({ mediaType: item.mediaType, tmdbId: item.tmdbId }));
    if (m?.providerIds?.length) item.providerIds = m.providerIds;
  }
}

// server/calendar-global.ts
var PAGES = 3;
var MAX_PER_SERIES2 = 2;
var MEDIA_STATUS_BLOCKLISTED2 = 6;
var TMDB_STATUS_RETURNING = "0";
async function discover(cfg, path, params, page) {
  const qs = new URLSearchParams({ ...params, page: String(page) });
  try {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/discover/${path}?${qs}`, {
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}
async function discoverPages(cfg, path, params) {
  const pages = await mapLimit(
    Array.from({ length: PAGES }, (_, i) => i + 1),
    3,
    (page) => discover(cfg, path, params, page)
  );
  return pages.flatMap((p) => p ?? []);
}
async function buildGlobalCalendar(prisma, cfg, opts) {
  const wantMovies = opts.mediaType === "movie" || opts.mediaType === "both";
  const wantTv = opts.mediaType === "tv" || opts.mediaType === "both";
  const tasks = [];
  if (opts.providerIds.length > 0) {
    const shared = {
      // Le tube est un OU côté TMDB : « 8|337 » = Netflix ou Disney+.
      watchProviders: opts.providerIds.join("|"),
      watchRegion: opts.region
    };
    const seriesRows = wantTv ? await discoverPages(cfg, "tv", {
      ...shared,
      sortBy: "first_air_date.desc",
      status: TMDB_STATUS_RETURNING
    }) : [];
    if (wantMovies) {
      tasks.push(async () => ({
        type: "movie",
        rows: await discoverPages(cfg, "movies", { ...shared, sortBy: "primary_release_date.desc" })
      }));
    }
    const movieBuckets = await mapLimit(tasks, 2, (t) => t());
    const episodes = await buildProviderEpisodes(prisma, cfg, seriesRows, opts);
    const movies = collectItems(movieBuckets, opts);
    const merged = /* @__PURE__ */ new Map();
    for (const it of [...episodes.items, ...movies.items]) if (!merged.has(it.id)) merged.set(it.id, it);
    const items2 = capPerSeries(sortCalendarItems(Array.from(merged.values())), MAX_PER_SERIES2);
    await attachProviderIds(prisma, cfg, items2, opts.region);
    await markRequested(prisma, items2);
    return {
      from: opts.from,
      to: opts.to,
      items: items2,
      partial: episodes.partial,
      scanned: seriesRows.length + movies.scanned
    };
  }
  if (wantMovies) {
    tasks.push(async () => ({
      type: "movie",
      rows: await discoverPages(cfg, "movies/upcoming", {})
    }));
  }
  if (wantTv) {
    tasks.push(async () => ({
      type: "tv",
      rows: await discoverPages(cfg, "tv", {
        sortBy: "first_air_date.asc",
        firstAirDateGte: opts.from
      })
    }));
  }
  const collected = await mapLimit(tasks, 2, (t) => t());
  const { items, scanned } = collectItems(collected, opts);
  await markRequested(prisma, items);
  return {
    from: opts.from,
    to: opts.to,
    items: capPerSeries(sortCalendarItems(items), MAX_PER_SERIES2),
    partial: false,
    scanned
  };
}
function collectItems(buckets, opts) {
  let scanned = 0;
  const unique = /* @__PURE__ */ new Map();
  for (const bucket of buckets) {
    if (!bucket) continue;
    for (const r of bucket.rows) {
      scanned++;
      if (!r.id) continue;
      if (r.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED2) continue;
      const date = toDayString(r.releaseDate ?? r.firstAirDate);
      if (!date || date < opts.from || date > opts.to) continue;
      const mediaType = r.mediaType === "tv" || r.mediaType === "movie" ? r.mediaType : bucket.type;
      const kind = mediaType === "movie" ? "theatrical" : "premiere";
      const id = makeItemId(mediaType, r.id, kind, date);
      if (unique.has(id)) continue;
      unique.set(id, {
        id,
        date,
        mediaType,
        tmdbId: r.id,
        title: r.title ?? r.name ?? "",
        posterPath: r.posterPath ?? null,
        backdropPath: r.backdropPath ?? null,
        overview: r.overview ?? null,
        kind,
        seasonNumber: null,
        episodeNumber: null,
        networks: null,
        voteAverage: typeof r.voteAverage === "number" ? r.voteAverage : null,
        popularity: typeof r.popularity === "number" ? r.popularity : null,
        originalLanguage: r.originalLanguage ?? null,
        isAnime: detectAnime(r),
        // Complété juste après depuis la mémoire des fiches : recopier ici la
        // plateforme demandée revenait à jurer qu'un film est sur les quatre
        // plateformes cochées.
        providerIds: [],
        requestId: null,
        requestStatus: null
      });
    }
  }
  return { items: Array.from(unique.values()), scanned };
}

// server/sonarr-schedule.ts
var SERIES_TTL_MS = 30 * 6e4;
var SERIES_STALE_MS = 6 * 36e5;
var CALENDAR_TTL_MS = 30 * 6e4;
var CALENDAR_STALE_MS = 6 * 36e5;
var EPISODES_TTL_MS = 36e5;
var EPISODES_STALE_MS = 12 * 36e5;
function airTimeKey(season, episode) {
  return `S${season}E${episode}`;
}
async function sonarr(cfg) {
  return getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "sonarr");
}
async function arrGet(server, path) {
  try {
    const res = await fetch(`${buildArrUrl(server)}${path}`, {
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function sonarrSeriesIndex(cfg) {
  return cached(
    "seer:sonarr:series",
    SERIES_TTL_MS,
    async () => {
      const server = await sonarr(cfg);
      if (!server) return /* @__PURE__ */ new Map();
      const rows = await arrGet(server, "/api/v3/series");
      const index = /* @__PURE__ */ new Map();
      for (const s of rows ?? []) {
        if (s.tmdbId && s.id) index.set(s.tmdbId, s.id);
      }
      return index;
    },
    { staleMs: SERIES_STALE_MS }
  );
}
async function sonarrWindowAirTimes(cfg, from, to) {
  return cached(
    `seer:sonarr:cal:${from}:${to}`,
    CALENDAR_TTL_MS,
    async () => {
      const server = await sonarr(cfg);
      if (!server) return /* @__PURE__ */ new Map();
      const rows = await arrGet(
        server,
        `/api/v3/calendar?start=${from}&end=${to}&includeSeries=false`
      );
      const times = /* @__PURE__ */ new Map();
      for (const e of rows ?? []) {
        if (!e.airDateUtc || e.seriesId == null || e.seasonNumber == null || e.episodeNumber == null) continue;
        times.set(`${e.seriesId}:${airTimeKey(e.seasonNumber, e.episodeNumber)}`, e.airDateUtc);
      }
      return times;
    },
    { staleMs: CALENDAR_STALE_MS }
  );
}
async function attachAirTimes(cfg, res) {
  const episodes = res.items.filter((i) => i.kind === "episode");
  if (episodes.length === 0) return res;
  try {
    const [index, times] = await Promise.all([
      sonarrSeriesIndex(cfg),
      // Fenêtre élargie d'un jour : un épisode peut basculer d'une journée à
      // l'autre une fois ramené à l'heure locale, dans un sens comme dans l'autre.
      sonarrWindowAirTimes(cfg, shiftDay(res.from, -1), shiftDay(res.to, 1))
    ]);
    if (index.size === 0 || times.size === 0) return res;
    for (const item of episodes) {
      const seriesId = index.get(item.tmdbId);
      if (!seriesId || item.seasonNumber == null || item.episodeNumber == null) continue;
      const at = times.get(`${seriesId}:${airTimeKey(item.seasonNumber, item.episodeNumber)}`);
      if (at) item.airDateUtc = at;
    }
  } catch {
  }
  return res;
}
function shiftDay(day, delta) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
async function sonarrSeriesAirTimes(cfg, tmdbId) {
  return cached(
    `seer:sonarr:eps:${tmdbId}`,
    EPISODES_TTL_MS,
    async () => {
      const [server, index] = await Promise.all([sonarr(cfg), sonarrSeriesIndex(cfg)]);
      const seriesId = index.get(tmdbId);
      if (!server || !seriesId) return /* @__PURE__ */ new Map();
      const rows = await arrGet(server, `/api/v3/episode?seriesId=${seriesId}`);
      const times = /* @__PURE__ */ new Map();
      for (const e of rows ?? []) {
        if (!e.airDateUtc || e.seasonNumber == null || e.episodeNumber == null) continue;
        times.set(airTimeKey(e.seasonNumber, e.episodeNumber), e.airDateUtc);
      }
      return times;
    },
    { staleMs: EPISODES_STALE_MS }
  );
}

// server/routes-calendar.ts
var PERSONAL_TTL_MS = 15 * 6e4;
var PERSONAL_STALE_MS = 6 * 36e5;
var PARTIAL_TTL_MS = 1e4;
var EVERYONE_FETCH_BUDGET = 60;
var GLOBAL_TTL_MS = 6 * 36e5;
var GLOBAL_STALE_MS = 24 * 36e5;
var PROVIDER_TTL_MS = 12 * 36e5;
var MAX_PROVIDERS = 8;
var DEFAULT_WINDOW_DAYS = 90;
var MAX_WINDOW_DAYS = 370;
function readWindow(q) {
  const today = todayString();
  const from = isDayString(q.from) ? q.from : today;
  const fallback = addDays(from, DEFAULT_WINDOW_DAYS);
  const to = isDayString(q.to) ? q.to : fallback;
  const hardMax = addDays(from, MAX_WINDOW_DAYS);
  return { from, to: to > hardMax ? hardMax : to < from ? from : to };
}
var EMPTY = (from, to) => ({ from, to, items: [], partial: false });
function registerCalendarRoutes(app, prisma, getWorkerConfig2) {
  app.get("/calendar/personal", async (request) => {
    const user = getUser(request);
    const q = request.query;
    const { from, to } = readWindow(q);
    const includeSettled = q.all === "1";
    const everyone = q.everyone === "1";
    const config = await getWorkerConfig2();
    if (!config) return EMPTY(from, to);
    const key = everyone ? `seer:cal:everyone:${from}:${to}:${includeSettled ? "all" : "up"}` : `seer-cache:${user.userId}:cal:${from}:${to}:${includeSettled ? "all" : "up"}`;
    return cached(
      key,
      PERSONAL_TTL_MS,
      async () => {
        const warn = (err, msg) => app.log?.warn?.({ err }, msg);
        const rows = everyone ? await cached(
          "seer:rows:everyone",
          6e4,
          () => buildEveryoneRows(prisma, config, warn),
          { staleMs: 6e5 }
        ) : await cached(
          rowsCacheKey(user.userId),
          6e4,
          () => buildMergedRows(prisma, config, user, warn),
          { staleMs: 6e5 }
        );
        const res = await buildPersonalCalendar(prisma, config, user, rows, {
          from,
          to,
          includeSettled,
          maxFetch: everyone ? EVERYONE_FETCH_BUDGET : void 0
        });
        return attachAirTimes(config, res);
      },
      {
        staleMs: PERSONAL_STALE_MS,
        ttlFor: (res) => res.partial ? PARTIAL_TTL_MS : PERSONAL_TTL_MS
      }
    );
  });
  app.get("/calendar/global", async (request) => {
    const q = request.query;
    const { from, to } = readWindow(q);
    const config = await getWorkerConfig2();
    if (!config) return EMPTY(from, to);
    const providerIds = String(q.providerIds ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, MAX_PROVIDERS);
    const mediaType = q.mediaType === "movie" || q.mediaType === "tv" ? q.mediaType : "both";
    const region = typeof q.region === "string" && /^[a-z]{2}$/i.test(q.region) ? q.region.toUpperCase() : DEFAULT_REGION;
    const scope = providerIds.length > 0 ? [...providerIds].sort((a, b) => a - b).join("-") : "all";
    const key = `seer:cal:${scope}:${mediaType}:${region}:${from}:${to}`;
    const ttl = providerIds.length > 0 ? PROVIDER_TTL_MS : GLOBAL_TTL_MS;
    return cached(
      key,
      ttl,
      async () => attachAirTimes(
        config,
        await buildGlobalCalendar(prisma, config, { providerIds, mediaType, region, from, to })
      ),
      { staleMs: GLOBAL_STALE_MS }
    );
  });
  app.get("/calendar/airtimes", async (request) => {
    const q = request.query;
    const tmdbId = Number(q.tmdbId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) return { times: {} };
    const config = await getWorkerConfig2();
    if (!config) return { times: {} };
    const times = await sonarrSeriesAirTimes(config, tmdbId);
    return { times: Object.fromEntries(times) };
  });
  app.get("/calendar/providers", async (request) => {
    const q = request.query;
    const config = await getWorkerConfig2();
    if (!config) return { results: [] };
    const region = typeof q.region === "string" && /^[a-z]{2}$/i.test(q.region) ? q.region.toUpperCase() : DEFAULT_REGION;
    return cached(`seer:providers:all:${region}`, 24 * 36e5, async () => {
      const merged = /* @__PURE__ */ new Map();
      for (const path of ["tv", "movies"]) {
        try {
          const res = await fetch(
            `${config.seerrUrl}/api/v1/watchproviders/${path}?watchRegion=${region}`,
            { headers: { "X-Api-Key": config.seerrApiKey }, signal: AbortSignal.timeout(1e4) }
          );
          if (!res.ok) continue;
          const data = await res.json();
          for (const p of Array.isArray(data) ? data : []) {
            if (typeof p.id !== "number" || !p.name || merged.has(p.id)) continue;
            merged.set(p.id, { id: p.id, name: p.name, logoPath: p.logoPath ?? null });
          }
        } catch {
        }
      }
      return { results: Array.from(merged.values()) };
    });
  });
}

// server/routes-misc.ts
function registerMiscRoutes(app, prisma, getWorkerConfig2, requireAdmin) {
  const providerCache = /* @__PURE__ */ new Map();
  app.post("/check-providers", async (request, reply) => {
    const body = request.body;
    if (!body.items || !Array.isArray(body.items)) return reply.status(400).send({ message: "items array required" });
    const config = await getWorkerConfig2();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const seerrUrl = config.seerrUrl;
    const apiKey = config.seerrApiKey;
    const result = {};
    const toFetch = [];
    for (const item of body.items.slice(0, 200)) {
      const key = `${item.mediaType}-${item.tmdbId}`;
      const cached3 = providerCache.get(key);
      if (cached3 && Date.now() < cached3.expires) {
        result[item.tmdbId] = cached3.providers;
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
  app.post("/worker/trigger", { preHandler: requireAdmin }, async () => {
    const config = await getWorkerConfig2();
    if (!config) return { message: "Seerr not configured" };
    const next = await getQueueStatus(prisma);
    return { workerRunning: isWorkerRunning(), processing: next.processing, queued: next.queued, triggered: true };
  });
}

// server/blocklist.ts
var MEDIA_STATUS_BLOCKLISTED3 = 6;
var KEYWORD_FETCH_CONCURRENCY = 8;
async function getBlocklistedTags(seerrUrl, apiKey) {
  return cached(`seerr:blocklistedTags:${seerrUrl}`, 5 * 6e4, async () => {
    try {
      const res = await fetch(`${seerrUrl}/api/v1/settings/main`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(8e3)
      });
      if (!res.ok) return "";
      const data = await res.json();
      return (data.blocklistedTags ?? "").trim();
    } catch {
      return "";
    }
  });
}
function parseTagSet(csv) {
  const set = /* @__PURE__ */ new Set();
  for (const part of csv.split(",")) {
    const id = Number(part.trim());
    if (Number.isFinite(id) && id > 0) set.add(id);
  }
  return set;
}
async function getItemKeywordIds(seerrUrl, apiKey, mediaType, id) {
  return cached(`seerr:kw:${mediaType}:${id}`, 7 * 864e5, async () => {
    try {
      const res = await fetch(`${seerrUrl}/api/v1/${mediaType}/${id}`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(8e3)
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.keywords) ? data.keywords.map((k) => k?.id).filter((x) => typeof x === "number") : [];
    } catch {
      return [];
    }
  });
}
async function filterResultsByTags(seerrUrl, apiKey, results, blockedSet) {
  const afterStatus = results.filter((r) => r?.mediaInfo?.status !== MEDIA_STATUS_BLOCKLISTED3);
  let blockedCount = results.length - afterStatus.length;
  const blockedFlags = new Array(afterStatus.length).fill(false);
  const checkable = afterStatus.map((item, idx) => ({ item, idx })).filter(({ item }) => (item.mediaType === "movie" || item.mediaType === "tv") && typeof item.id === "number");
  await mapLimit(checkable, KEYWORD_FETCH_CONCURRENCY, async ({ item, idx }) => {
    const kwIds = await getItemKeywordIds(
      seerrUrl,
      apiKey,
      item.mediaType,
      item.id
    );
    if (kwIds.some((id) => blockedSet.has(id))) blockedFlags[idx] = true;
  });
  const kept = afterStatus.filter((_, idx) => !blockedFlags[idx]);
  blockedCount += afterStatus.length - kept.length;
  return { kept, blockedCount };
}

// server/index.ts
var __pluginDir = dirname(dirname(fileURLToPath(import.meta.url)));
var PROXY_TTL_MS = 5 * 6e4;
var cfgCache = null;
function getPluginConfig(ctx) {
  try {
    const installedPath = resolve(__pluginDir, "..", "installed.json");
    if (!existsSync(installedPath)) return {};
    const mtimeMs = statSync(installedPath).mtimeMs;
    if (cfgCache && cfgCache.mtimeMs === mtimeMs) return cfgCache.value;
    const installed = JSON.parse(readFileSync(installedPath, "utf-8"));
    const plugin = installed.find(
      (p) => p.pluginId === ctx.pluginId || p.id === ctx.pluginId
    );
    const value = plugin?.config || {};
    cfgCache = { mtimeMs, value };
    return value;
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
      return { ...config, isAdmin: true };
    }
    return { url: config.url || "", enabled: !!config.enabled, hasApiKey: !!config.apiKey, isAdmin: false };
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
    const isDiscoverMovies = /^api\/v1\/discover\/movies(\/|$)/.test(wildcard);
    const isDiscoverTv = /^api\/v1\/discover\/tv(\/|$)/.test(wildcard);
    const isDiscover = isDiscoverMovies || isDiscoverTv;
    const isSearchLike = /^api\/v1\/discover\/trending/.test(wildcard) || /^api\/v1\/search/.test(wildcard);
    const isFilterable = isDiscover || isSearchLike;
    const showBlocked = query._showBlocked === "1" || query._showBlocked === "true";
    const blocklistedTags = isFilterable && request.method === "GET" ? await getBlocklistedTags(seerrUrl, apiKey) : "";
    const blockedSet = parseTagSet(blocklistedTags);
    const blockedActive = blockedSet.size > 0;
    const qsParts = [];
    let hasExcludeKeywords = false;
    for (const [k, v] of Object.entries(query)) {
      if (k === "_lang" || k === "_showBlocked") continue;
      if (k === "excludeKeywords") hasExcludeKeywords = true;
      qsParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    if (isDiscover && blockedActive && !showBlocked && !hasExcludeKeywords) {
      qsParts.push(`excludeKeywords=${encodeURIComponent(blocklistedTags)}`);
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
    const cacheable = request.method === "GET" && isFilterable;
    const cacheKey = cacheable ? `seer:proxy:${targetUrl}:${headers["Accept-Language"] ?? ""}` : null;
    if (cacheKey) {
      const hit = peek(cacheKey);
      if (hit) {
        reply.header("content-type", "application/json");
        return reply.send(hit);
      }
    }
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: reqBody,
        signal: AbortSignal.timeout(15e3)
      });
      const ct = response.headers.get("content-type");
      const shouldHandleJson = isFilterable && blockedActive && response.ok && (ct ?? "").includes("application/json");
      if (shouldHandleJson) {
        const data = await response.json().catch(() => null);
        if (data && Array.isArray(data.results)) {
          if (showBlocked) {
            const { blockedCount } = await filterResultsByTags(
              seerrUrl,
              apiKey,
              isDiscover ? [] : data.results,
              // discover déjà non-filtré ici → compteur via search-like
              blockedSet
            );
            data.blockedCount = isDiscover ? 0 : blockedCount;
          } else if (isSearchLike) {
            const { kept, blockedCount } = await filterResultsByTags(
              seerrUrl,
              apiKey,
              data.results,
              blockedSet
            );
            data.results = kept;
            data.blockedCount = blockedCount;
          } else {
            const before = data.results.length;
            data.results = data.results.filter(
              (item) => item?.mediaInfo?.status !== MEDIA_STATUS_BLOCKLISTED3
            );
            data.blockedCount = before - data.results.length;
          }
          data.blockedActive = blockedActive;
        }
        if (cacheKey && response.ok && data) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ?? {});
      }
      if (cacheKey && response.ok && (ct ?? "").includes("application/json")) {
        const data = await response.json().catch(() => null);
        if (data) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ?? {});
      }
      reply.status(response.status);
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
  registerAvailabilityRoutes(app, prisma, gwc);
  registerProgressRoutes(app, prisma, gwc, ctx.requireAdmin);
  registerCalendarRoutes(app, prisma, gwc);
  registerMiscRoutes(app, prisma, gwc, ctx.requireAdmin);
  console.log("[SeerBackend] Routes registered");
}
export {
  seerBackend as default
};
