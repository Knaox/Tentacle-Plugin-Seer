/* ------------------------------------------------------------------ */
/*  Seer Plugin — Database layer (raw SQL via Prisma)                  */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import type { SeerRequest, SeerNotification, RequestStatus } from "./types";

type Prisma = PrismaClient;

/* ── Schema initialisation ─────────────────────────────────────────── */

export async function ensureTables(prisma: Prisma): Promise<void> {
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

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seer_notifications (
      id               VARCHAR(36) NOT NULL PRIMARY KEY,
      jellyfin_user_id VARCHAR(255) NOT NULL,
      type             VARCHAR(50) NOT NULL,
      title            VARCHAR(500) NOT NULL,
      message          TEXT NOT NULL,
      poster_path      VARCHAR(500),
      ref_id           VARCHAR(36),
      is_read          TINYINT(1) NOT NULL DEFAULT 0,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_seer_notif_user (jellyfin_user_id, is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function uuid(): string {
  return crypto.randomUUID();
}

function rowToRequest(r: Record<string, unknown>): SeerRequest {
  return {
    id: r.id as string,
    jellyfinUserId: r.jellyfin_user_id as string,
    username: r.username as string,
    mediaType: r.media_type as "movie" | "tv",
    tmdbId: r.tmdb_id as number,
    title: r.title as string,
    posterPath: (r.poster_path as string) || null,
    backdropPath: (r.backdrop_path as string) || null,
    overview: (r.overview as string) || null,
    year: (r.year as string) || null,
    seasons: r.seasons ? (typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons) as number[] : null,
    status: r.status as RequestStatus,
    seerrRequestId: (r.seerr_request_id as number) || null,
    seerrMediaId: (r.seerr_media_id as number) || null,
    seerrMediaStatus: (r.seerr_media_status as number) || null,
    retryCount: (r.retry_count as number) || 0,
    maxRetries: (r.max_retries as number) || 10,
    lastError: (r.last_error as string) || null,
    priority: (r.priority as number) || 0,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    sentAt: r.sent_at ? toIso(r.sent_at) : null,
    completedAt: r.completed_at ? toIso(r.completed_at) : null,
  };
}

function rowToNotification(r: Record<string, unknown>): SeerNotification {
  return {
    id: r.id as string,
    jellyfinUserId: r.jellyfin_user_id as string,
    type: r.type as string,
    title: r.title as string,
    message: r.message as string,
    posterPath: (r.poster_path as string) || null,
    refId: (r.ref_id as string) || null,
    read: !!(r.is_read as number),
    createdAt: toIso(r.created_at),
  };
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

/* ── Request CRUD ──────────────────────────────────────────────────── */

export async function createRequest(
  prisma: Prisma,
  data: {
    jellyfinUserId: string;
    username: string;
    mediaType: "movie" | "tv";
    tmdbId: number;
    title: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    overview?: string | null;
    year?: string | null;
    seasons?: number[] | null;
    priority?: number;
  },
): Promise<SeerRequest> {
  const id = uuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_requests
      (id, jellyfin_user_id, username, media_type, tmdb_id, title, poster_path,
       backdrop_path, overview, year, seasons, status, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`,
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
  );
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests WHERE id = ?`,
    id,
  );
  return rowToRequest(rows[0]);
}

export async function getRequestById(prisma: Prisma, id: string): Promise<SeerRequest | null> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests WHERE id = ?`,
    id,
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}

export async function getUserRequests(
  prisma: Prisma,
  jellyfinUserId: string,
  opts: { page?: number; limit?: number; status?: string; mediaType?: string },
): Promise<{ results: SeerRequest[]; total: number; page: number; pages: number }> {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 100);
  const offset = (page - 1) * limit;

  let where = `WHERE jellyfin_user_id = ? AND status != 'deleted'`;
  const params: unknown[] = [jellyfinUserId];

  if (opts.status) {
    const statuses = opts.status.split(",").map((s) => s.trim());
    where += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (opts.mediaType) {
    where += ` AND media_type = ?`;
    params.push(opts.mediaType);
  }

  const countRows = await prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
    `SELECT COUNT(*) as cnt FROM seer_requests ${where}`,
    ...params,
  );
  const total = Number(countRows[0].cnt);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  return {
    results: rows.map(rowToRequest),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function getAllRequests(
  prisma: Prisma,
  opts: { page?: number; limit?: number; status?: string; mediaType?: string },
): Promise<{ results: SeerRequest[]; total: number; page: number; pages: number }> {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 100);
  const offset = (page - 1) * limit;

  let where = `WHERE status != 'deleted'`;
  const params: unknown[] = [];

  if (opts.status) {
    const statuses = opts.status.split(",").map((s) => s.trim());
    where += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (opts.mediaType) {
    where += ` AND media_type = ?`;
    params.push(opts.mediaType);
  }

  const countRows = await prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
    `SELECT COUNT(*) as cnt FROM seer_requests ${where}`,
    ...params,
  );
  const total = Number(countRows[0].cnt);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  return {
    results: rows.map(rowToRequest),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function updateRequestStatus(
  prisma: Prisma,
  id: string,
  status: RequestStatus,
  extra?: Partial<{
    seerrRequestId: number;
    seerrMediaId: number;
    seerrMediaStatus: number;
    lastError: string;
    retryCount: number;
    sentAt: Date;
    completedAt: Date;
  }>,
): Promise<void> {
  const sets: string[] = ["status = ?"];
  const params: unknown[] = [status];

  if (extra?.seerrRequestId !== undefined) { sets.push("seerr_request_id = ?"); params.push(extra.seerrRequestId); }
  if (extra?.seerrMediaId !== undefined) { sets.push("seerr_media_id = ?"); params.push(extra.seerrMediaId); }
  if (extra?.seerrMediaStatus !== undefined) { sets.push("seerr_media_status = ?"); params.push(extra.seerrMediaStatus); }
  if (extra?.lastError !== undefined) { sets.push("last_error = ?"); params.push(extra.lastError); }
  if (extra?.retryCount !== undefined) { sets.push("retry_count = ?"); params.push(extra.retryCount); }
  if (extra?.sentAt !== undefined) { sets.push("sent_at = ?"); params.push(extra.sentAt); }
  if (extra?.completedAt !== undefined) { sets.push("completed_at = ?"); params.push(extra.completedAt); }

  params.push(id);
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
  );
}

export async function deleteRequestById(prisma: Prisma, id: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM seer_requests WHERE id = ?`, id);
}

export async function findDuplicate(
  prisma: Prisma,
  jellyfinUserId: string,
  tmdbId: number,
  mediaType: string,
): Promise<SeerRequest | null> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = ?
       AND status NOT IN ('deleted', 'failed', 'available')
     LIMIT 1`,
    jellyfinUserId,
    tmdbId,
    mediaType,
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}

/** Get next item in queue (highest priority, oldest first) */
export async function getNextQueued(prisma: Prisma): Promise<SeerRequest | null> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests
     WHERE status IN ('queued', 'retry_pending')
     ORDER BY priority DESC, created_at ASC
     LIMIT 1`,
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}

/** Get all requests that need status sync with Seerr */
export async function getRequestsToSync(prisma: Prisma): Promise<SeerRequest[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests
     WHERE seerr_request_id IS NOT NULL
       AND status NOT IN ('available', 'failed', 'deleted')`,
  );
  return rows.map(rowToRequest);
}

/** Queue status summary */
export async function getQueueStatus(
  prisma: Prisma,
  jellyfinUserId?: string,
): Promise<{ processing: SeerRequest | null; queued: number; retryPending: number }> {
  const userFilter = jellyfinUserId ? ` AND jellyfin_user_id = ?` : "";
  const userParams = jellyfinUserId ? [jellyfinUserId] : [];

  const processingRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests WHERE status = 'processing'${userFilter} LIMIT 1`,
    ...userParams,
  );

  const countRows = await prisma.$queryRawUnsafe<[{ queued: bigint; retry_pending: bigint }]>(
    `SELECT
       SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
       SUM(CASE WHEN status = 'retry_pending' THEN 1 ELSE 0 END) as retry_pending
     FROM seer_requests WHERE status IN ('queued', 'retry_pending')${userFilter}`,
    ...userParams,
  );

  return {
    processing: processingRows.length > 0 ? rowToRequest(processingRows[0]) : null,
    queued: Number(countRows[0].queued) || 0,
    retryPending: Number(countRows[0].retry_pending) || 0,
  };
}

/* ── Notification CRUD ─────────────────────────────────────────────── */

export async function createNotification(
  prisma: Prisma,
  data: {
    jellyfinUserId: string;
    type: string;
    title: string;
    message: string;
    posterPath?: string | null;
    refId?: string | null;
  },
): Promise<SeerNotification> {
  const id = uuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_notifications (id, jellyfin_user_id, type, title, message, poster_path, ref_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.jellyfinUserId,
    data.type,
    data.title,
    data.message,
    data.posterPath || null,
    data.refId || null,
  );
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_notifications WHERE id = ?`,
    id,
  );
  return rowToNotification(rows[0]);
}

export async function getUserNotifications(
  prisma: Prisma,
  jellyfinUserId: string,
  opts: { unread?: boolean; limit?: number; page?: number },
): Promise<{ results: SeerNotification[]; total: number; page: number; pages: number }> {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 100);
  const offset = (page - 1) * limit;

  let where = `WHERE jellyfin_user_id = ?`;
  const params: unknown[] = [jellyfinUserId];

  if (opts.unread) {
    where += ` AND is_read = 0`;
  }

  const countRows = await prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
    `SELECT COUNT(*) as cnt FROM seer_notifications ${where}`,
    ...params,
  );
  const total = Number(countRows[0].cnt);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  return {
    results: rows.map(rowToNotification),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function getUnreadCount(prisma: Prisma, jellyfinUserId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
    `SELECT COUNT(*) as cnt FROM seer_notifications WHERE jellyfin_user_id = ? AND is_read = 0`,
    jellyfinUserId,
  );
  return Number(rows[0].cnt);
}

export async function markNotificationRead(prisma: Prisma, id: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_notifications SET is_read = 1 WHERE id = ?`,
    id,
  );
}

export async function markAllNotificationsRead(prisma: Prisma, jellyfinUserId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_notifications SET is_read = 1 WHERE jellyfin_user_id = ? AND is_read = 0`,
    jellyfinUserId,
  );
}

/* ── Stats ─────────────────────────────────────────────────────────── */

export async function getUserStats(prisma: Prisma, jellyfinUserId: string) {
  const byStatus = await prisma.$queryRawUnsafe<{ status: string; cnt: bigint }[]>(
    `SELECT status, COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ? AND status != 'deleted'
     GROUP BY status`,
    jellyfinUserId,
  );
  const byType = await prisma.$queryRawUnsafe<{ media_type: string; cnt: bigint }[]>(
    `SELECT media_type, COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ? AND status != 'deleted'
     GROUP BY media_type`,
    jellyfinUserId,
  );
  const total = byStatus.reduce((n, r) => n + Number(r.cnt), 0);

  return {
    totalRequests: total,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.cnt)])),
    byType: Object.fromEntries(byType.map((r) => [r.media_type, Number(r.cnt)])),
  };
}

export async function getGlobalStats(prisma: Prisma) {
  const byStatus = await prisma.$queryRawUnsafe<{ status: string; cnt: bigint }[]>(
    `SELECT status, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY status`,
  );
  const byType = await prisma.$queryRawUnsafe<{ media_type: string; cnt: bigint }[]>(
    `SELECT media_type, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY media_type`,
  );
  const topRequested = await prisma.$queryRawUnsafe<{ title: string; tmdb_id: number; cnt: bigint }[]>(
    `SELECT title, tmdb_id, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY title, tmdb_id ORDER BY cnt DESC LIMIT 10`,
  );
  const topUsers = await prisma.$queryRawUnsafe<{ username: string; cnt: bigint }[]>(
    `SELECT username, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY username ORDER BY cnt DESC LIMIT 10`,
  );
  const total = byStatus.reduce((n, r) => n + Number(r.cnt), 0);
  const available = Number(byStatus.find((r) => r.status === "available")?.cnt || 0);

  return {
    totalRequests: total,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.cnt)])),
    byType: Object.fromEntries(byType.map((r) => [r.media_type, Number(r.cnt)])),
    topRequested: topRequested.map((r) => ({ title: r.title, tmdbId: r.tmdb_id, count: Number(r.cnt) })),
    topUsers: topUsers.map((r) => ({ username: r.username, count: Number(r.cnt) })),
    successRate: total > 0 ? Math.round((available / total) * 100) : 0,
  };
}
