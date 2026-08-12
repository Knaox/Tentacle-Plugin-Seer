/* ------------------------------------------------------------------ */
/*  Seer Plugin — Routes du calendrier des sorties                     */
/* ------------------------------------------------------------------ */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { cached } from "./cache";
import { getUser, type WorkerCfg } from "./seerr-unified";
import { buildMergedRows, type MergedRows } from "./requests-list";
import { buildPersonalCalendar } from "./calendar-personal";
import { buildGlobalCalendar } from "./calendar-global";
import { isDayString, addDays, type CalendarResponse } from "./calendar-types";
import { todayString } from "./tmdb-fetch";
import { rowsCacheKey } from "./routes-requests-read";
import { DEFAULT_REGION } from "./tmdb-resolver";

/** Le personnel bouge avec les demandes ; le global au mieux une fois par jour. */
const PERSONAL_TTL_MS = 15 * 60_000;
const PERSONAL_STALE_MS = 6 * 3_600_000;
const GLOBAL_TTL_MS = 6 * 3_600_000;
const GLOBAL_STALE_MS = 24 * 3_600_000;
const PROVIDER_TTL_MS = 12 * 3_600_000;

const DEFAULT_WINDOW_DAYS = 90;
/** Fenêtre plafonnée : sans borne, un `to=2099-01-01` déclencherait un scan inutile. */
const MAX_WINDOW_DAYS = 370;

function readWindow(q: { from?: string; to?: string }): { from: string; to: string } {
  const today = todayString();
  const from = isDayString(q.from) ? q.from : today;
  const fallback = addDays(from, DEFAULT_WINDOW_DAYS);
  const to = isDayString(q.to) ? q.to : fallback;
  const hardMax = addDays(from, MAX_WINDOW_DAYS);
  return { from, to: to > hardMax ? hardMax : to < from ? from : to };
}

const EMPTY = (from: string, to: string): CalendarResponse => ({ from, to, items: [], partial: false });

export function registerCalendarRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {

  /* ── Mes sorties — à partir des demandes en cours ── */
  app.get("/calendar/personal", async (request) => {
    const user = getUser(request);
    const q = request.query as { from?: string; to?: string; all?: string };
    const { from, to } = readWindow(q);
    const includeSettled = q.all === "1";

    const config = await getWorkerConfig();
    if (!config) return EMPTY(from, to);

    return cached(
      `seer-cache:${user.userId}:cal:${from}:${to}:${includeSettled ? 'all' : 'up'}`,
      PERSONAL_TTL_MS,
      async () => {
        // Réutilise la liste déjà chargée : arriver depuis « Mes demandes »
        // ne coûte alors aucun appel réseau.
        const rows: MergedRows = await cached(
          rowsCacheKey(user.userId),
          60_000,
          () => buildMergedRows(prisma, config, user, (err, msg) => app.log?.warn?.({ err }, msg)),
          { staleMs: 600_000 },
        );
        return buildPersonalCalendar(prisma, config, user, rows, { from, to, includeSettled });
      },
      { staleMs: PERSONAL_STALE_MS },
    );
  });

  /* ── Tout ce qui sort — indépendant des demandes ── */
  app.get("/calendar/global", async (request) => {
    const q = request.query as {
      scope?: string; providerId?: string; mediaType?: string;
      region?: string; from?: string; to?: string;
    };
    const { from, to } = readWindow(q);

    const config = await getWorkerConfig();
    if (!config) return EMPTY(from, to);

    const providerId = Number(q.providerId);
    const scope = q.scope === "provider" && Number.isFinite(providerId) && providerId > 0
      ? "provider" as const
      : "all" as const;
    const mediaType = q.mediaType === "movie" || q.mediaType === "tv" ? q.mediaType : "both";
    const region = typeof q.region === "string" && /^[a-z]{2}$/i.test(q.region)
      ? q.region.toUpperCase()
      : DEFAULT_REGION;

    // Clé sans utilisateur : le résultat est le même pour tout le monde.
    const key = `seer:cal:${scope}:${scope === "provider" ? providerId : "all"}:${mediaType}:${region}:${from}:${to}`;
    const ttl = scope === "provider" ? PROVIDER_TTL_MS : GLOBAL_TTL_MS;

    return cached(
      key,
      ttl,
      () => buildGlobalCalendar(prisma, config, {
        scope, providerId: scope === "provider" ? providerId : undefined,
        mediaType, region, from, to,
      }),
      { staleMs: GLOBAL_STALE_MS },
    );
  });

  /* ── Catalogue des plateformes de la région ──
   *
   * Les deux catalogues (films et séries) sont FUSIONNÉS : ils ne se recouvrent
   * pas entièrement, et un film peut être proposé par une plateforme absente de
   * la liste séries. Sans la fusion, son logo manquerait sans raison visible.
   * Le sélecteur de plateforme comme les vignettes lisent la même table. */
  app.get("/calendar/providers", async (request) => {
    const q = request.query as { region?: string };
    const config = await getWorkerConfig();
    if (!config) return { results: [] };

    const region = typeof q.region === "string" && /^[a-z]{2}$/i.test(q.region)
      ? q.region.toUpperCase()
      : DEFAULT_REGION;

    return cached(`seer:providers:all:${region}`, 24 * 3_600_000, async () => {
      const merged = new Map<number, { id: number; name: string; logoPath: string | null }>();

      for (const path of ["tv", "movies"] as const) {
        try {
          const res = await fetch(
            `${config.seerrUrl}/api/v1/watchproviders/${path}?watchRegion=${region}`,
            { headers: { "X-Api-Key": config.seerrApiKey }, signal: AbortSignal.timeout(10_000) },
          );
          if (!res.ok) continue;
          const data = (await res.json()) as Array<{ id?: number; name?: string; logoPath?: string }>;
          for (const p of Array.isArray(data) ? data : []) {
            if (typeof p.id !== "number" || !p.name || merged.has(p.id)) continue;
            merged.set(p.id, { id: p.id, name: p.name, logoPath: p.logoPath ?? null });
          }
        } catch { /* un catalogue indisponible ne doit pas vider l'autre */ }
      }

      return { results: Array.from(merged.values()) };
    });
  });
}
