/* ------------------------------------------------------------------ */
/*  Seer Plugin — Notification de disponibilité (partagée)             */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import type { SeerRequest } from "./types";
import { evaluateSeasons, seasonNotification, releasedSuffix } from "./season-availability";
import { setNotifiedSeasons } from "./db";

/**
 * TV : évalue la dispo PAR-SAISON, notifie le DELTA de saisons devenues dispo
 * (anti-doublon via notified_seasons) et renvoie le statut résultant, ou null
 * si aucune saison demandée n'est encore dispo (l'appelant gère le repli).
 * Utilisé par la sync ET par le chemin « déjà présent » (notifie même sans
 * téléchargement).
 */
export async function notifyAvailableSeasons(
  prisma: PrismaClient,
  request: SeerRequest,
  mediaSeasons: { seasonNumber: number; status: number }[] | undefined,
): Promise<"available" | "partially_available" | null> {
  const ev = evaluateSeasons(request.seasons, mediaSeasons);
  if (ev.available.length === 0) return null;

  const notified = new Set(request.notifiedSeasons ?? []);
  const newly = ev.available.filter((s) => !notified.has(s));
  if (newly.length > 0) {
    const n = seasonNotification(request, newly, ev.available.length);
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId, type: "request_status",
        title: n.title, body: n.message, refId: request.id,
      },
    });
    await setNotifiedSeasons(prisma, request.id, ev.available);
    console.log(`[SeerWorker] "${request.title}" saisons dispo [${newly.join(",")}] → notif`);
  }
  return ev.allAvailable ? "available" : "partially_available";
}

/** Film : notifie « est sorti » une seule fois (flag via notified_seasons non vide). */
export async function notifyMovieAvailable(
  prisma: PrismaClient,
  request: SeerRequest,
): Promise<void> {
  if ((request.notifiedSeasons ?? []).length > 0) return; // déjà notifié
  await prisma.notification.create({
    data: {
      jellyfinUserId: request.jellyfinUserId, type: "request_status",
      title: request.title,
      body: `« ${request.title} » ${releasedSuffix("m", false)}`,
      refId: request.id,
    },
  });
  await setNotifiedSeasons(prisma, request.id, [0]); // flag « film notifié »
  console.log(`[SeerWorker] "${request.title}" (film) dispo → notif`);
}
