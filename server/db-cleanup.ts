/* ------------------------------------------------------------------ */
/*  Seer Plugin — Cleanup queue database operations                    */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import { toIso, uuid } from "./db-helpers";

type Prisma = PrismaClient;

/* ── Types ────────────────────────────────────────────────────────── */

export interface CleanupJob {
  id: string;
  action: "delete" | "retry";
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  seerrRequestId: number | null;
  seerrMediaId: number | null;
  deleteFiles: boolean;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  status: string;
  nextRetryAt: string;
  requestId: string | null;
}

/* ── CRUD ─────────────────────────────────────────────────────────── */

export async function enqueueCleanup(
  prisma: Prisma,
  job: {
    action: string;
    mediaType: string;
    tmdbId: number;
    title: string;
    seerrRequestId?: number | null;
    seerrMediaId?: number | null;
    deleteFiles?: boolean;
    requestId?: string | null;
  },
): Promise<string> {
  const id = uuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_cleanup_queue (id, action, media_type, tmdb_id, title, seerr_request_id, seerr_media_id, delete_files, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, job.action, job.mediaType, job.tmdbId, job.title,
    job.seerrRequestId ?? null, job.seerrMediaId ?? null, job.deleteFiles ? 1 : 0,
    job.requestId ?? null,
  );
  return id;
}

export async function getPendingCleanups(prisma: Prisma): Promise<CleanupJob[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_cleanup_queue
     WHERE status = 'pending' AND next_retry_at <= NOW()
     ORDER BY created_at ASC LIMIT 1`,
  );
  return rows.map((r) => ({
    id: r.id as string,
    action: r.action as "delete" | "retry",
    mediaType: r.media_type as "movie" | "tv",
    tmdbId: r.tmdb_id as number,
    title: r.title as string,
    seerrRequestId: (r.seerr_request_id as number) || null,
    seerrMediaId: (r.seerr_media_id as number) || null,
    deleteFiles: Boolean(r.delete_files),
    retryCount: (r.retry_count as number) || 0,
    maxRetries: (r.max_retries as number) || 20,
    lastError: (r.last_error as string) || null,
    status: r.status as string,
    nextRetryAt: toIso(r.next_retry_at),
    requestId: (r.request_id as string) || null,
  }));
}

export async function updateCleanupJob(
  prisma: Prisma,
  id: string,
  status: string,
  extra?: { lastError?: string; retryCount?: number; nextRetryAt?: Date },
): Promise<void> {
  const sets: string[] = ["status = ?"];
  const params: unknown[] = [status];
  if (extra?.lastError !== undefined) { sets.push("last_error = ?"); params.push(extra.lastError); }
  if (extra?.retryCount !== undefined) { sets.push("retry_count = ?"); params.push(extra.retryCount); }
  if (extra?.nextRetryAt !== undefined) { sets.push("next_retry_at = ?"); params.push(extra.nextRetryAt); }
  params.push(id);
  await prisma.$executeRawUnsafe(`UPDATE seer_cleanup_queue SET ${sets.join(", ")} WHERE id = ?`, ...params);
}

/** Clear pending_cleanup_id on requests linked to a completed cleanup job */
export async function clearPendingCleanup(prisma: Prisma, cleanupId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET pending_cleanup_id = NULL WHERE pending_cleanup_id = ?`,
    cleanupId,
  );
}

/** Link a request to a cleanup job so it waits for cleanup to complete */
export async function setPendingCleanup(prisma: Prisma, requestId: string, cleanupId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET pending_cleanup_id = ? WHERE id = ?`,
    cleanupId,
    requestId,
  );
}
