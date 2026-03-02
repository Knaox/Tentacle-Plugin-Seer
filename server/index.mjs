// Seer Plugin — Server module (auto-generated, do not edit)
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// server/db.ts
async function ensureTables(prisma) {
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
}
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
    completedAt: r.completed_at ? toIso(r.completed_at) : null
  };
}
function toIso(v) {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return (/* @__PURE__ */ new Date()).toISOString();
}
async function createRequest(prisma, data) {
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
    data.priority || 0
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
  return {
    results: rows.map(rowToRequest),
    total,
    page,
    pages: Math.ceil(total / limit) || 1
  };
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
  return {
    results: rows.map(rowToRequest),
    total,
    page,
    pages: Math.ceil(total / limit) || 1
  };
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
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET ${sets.join(", ")} WHERE id = ?`,
    ...params
  );
}
async function deleteRequestById(prisma, id) {
  await prisma.$executeRawUnsafe(`DELETE FROM seer_requests WHERE id = ?`, id);
}
async function findDuplicate(prisma, jellyfinUserId, tmdbId, mediaType) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = ?
       AND status NOT IN ('deleted', 'failed', 'available')
     LIMIT 1`,
    jellyfinUserId,
    tmdbId,
    mediaType
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}
async function getNextQueued(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE status IN ('queued', 'retry_pending')
     ORDER BY priority DESC, created_at ASC
     LIMIT 1`
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}
async function getRequestsToSync(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE seerr_request_id IS NOT NULL
       AND status NOT IN ('available', 'failed', 'deleted')`
  );
  return rows.map(rowToRequest);
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
       SUM(CASE WHEN status = 'retry_pending' THEN 1 ELSE 0 END) as retry_pending
     FROM seer_requests WHERE status IN ('queued', 'retry_pending')${userFilter}`,
    ...userParams
  );
  return {
    processing: processingRows.length > 0 ? rowToRequest(processingRows[0]) : null,
    queued: Number(countRows[0].queued) || 0,
    retryPending: Number(countRows[0].retry_pending) || 0
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
  }
  setTimeout(tick, 5e3);
  timer = setInterval(async () => {
    const config = await getConfig();
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
      seerrBody.seasons = request.seasons.map((n) => ({ seasonNumber: n }));
    }
    const res = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.seerrApiKey
      },
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
        title: `"${request.title}" \u2014 Sent to Seerr`,
        body: `Your request for "${request.title}" has been sent`,
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
          title: `"${request.title}" \u2014 Failed`,
          body: `Your request for "${request.title}" failed after ${newRetryCount} attempts`,
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
async function syncStatuses(prisma, config) {
  const requests = await getRequestsToSync(prisma);
  if (requests.length === 0) return;
  for (const request of requests) {
    if (!request.seerrRequestId) continue;
    try {
      const res = await fetch(
        `${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`,
        {
          headers: { "X-Api-Key": config.seerrApiKey },
          signal: AbortSignal.timeout(1e4)
        }
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
      const newStatus = mapSeerrStatus(data.status, data.media?.status);
      const oldStatus = request.status;
      if (newStatus !== oldStatus) {
        const extra = {
          seerrMediaStatus: data.media?.status
        };
        if (newStatus === "available") {
          extra.completedAt = /* @__PURE__ */ new Date();
        }
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
function mapSeerrStatus(requestStatus, mediaStatus) {
  if (requestStatus === 3) return "failed";
  if (mediaStatus === 5) return "available";
  if (mediaStatus === 3 || mediaStatus === 4) return "downloading";
  if (requestStatus === 2) return "approved";
  return "sent_to_seer";
}
function statusNotification(request, newStatus) {
  switch (newStatus) {
    case "approved":
      return {
        type: "request_approved",
        title: request.title,
        message: `Your request for "${request.title}" has been approved`
      };
    case "downloading":
      return {
        type: "request_downloading",
        title: request.title,
        message: `"${request.title}" is now being downloaded`
      };
    case "available":
      return {
        type: "request_available",
        title: request.title,
        message: `"${request.title}" is now available!`
      };
    case "failed":
      return {
        type: "request_declined",
        title: request.title,
        message: `Your request for "${request.title}" was declined`
      };
    default:
      return null;
  }
}

// server/index.ts
function getUser(request) {
  return request.user;
}
function getPluginConfig(ctx) {
  try {
    const { resolve } = __require("path");
    const { existsSync, readFileSync } = __require("fs");
    const installedPath = resolve(__dirname, "../installed.json");
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
  return {
    seerrUrl: url.replace(/\/$/, ""),
    seerrApiKey: apiKey,
    interval: 6e4,
    syncEvery: 5
  };
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
    const dup = await findDuplicate(prisma, user.userId, body.tmdbId, body.mediaType);
    if (dup) {
      return reply.status(409).send({
        message: "A request for this media is already active",
        existing: dup
      });
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
      seasons: body.seasons
    });
    return reply.status(201).send(req);
  });
  app.delete("/requests/:id", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const req = await getRequestById(prisma, id);
    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }
    if (req.seerrRequestId) {
      try {
        const config = await getWorkerConfig(ctx);
        if (config) {
          await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          });
        }
      } catch (err) {
        console.warn(`[SeerBackend] Failed to delete Seerr request #${req.seerrRequestId}:`, err);
      }
    }
    await deleteRequestById(prisma, id);
    return { success: true };
  });
  app.post("/requests/:id/retry", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const req = await getRequestById(prisma, id);
    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }
    if (req.seerrRequestId) {
      try {
        const config = await getWorkerConfig(ctx);
        if (config) {
          await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          });
        }
      } catch {
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
      priority: 1
    });
    return reply.status(201).send(newReq);
  });
  app.get("/queue/status", async (request) => {
    const user = getUser(request);
    const status = await getQueueStatus(prisma, user.isAdmin ? void 0 : user.userId);
    return {
      ...status,
      workerRunning: isWorkerRunning()
    };
  });
  app.get("/stats", async (request) => {
    const user = getUser(request);
    if (user.isAdmin) {
      const [personal, global] = await Promise.all([
        getUserStats(prisma, user.userId),
        getGlobalStats(prisma)
      ]);
      return { personal, global };
    }
    return { personal: await getUserStats(prisma, user.userId) };
  });
  app.post("/worker/trigger", { preHandler: ctx.requireAdmin }, async () => {
    const config = await getWorkerConfig(ctx);
    if (!config) return { message: "Seerr not configured" };
    const next = await getQueueStatus(prisma);
    return {
      workerRunning: isWorkerRunning(),
      processing: next.processing,
      queued: next.queued,
      triggered: true
    };
  });
  console.log("[SeerBackend] Routes registered");
}
export {
  seerBackend as default
};
