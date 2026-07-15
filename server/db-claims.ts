/* ------------------------------------------------------------------ */
/*  Seer Plugin — Anti-doublon : claims de contenu (table CORE)        */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";

/**
 * Revendique un contenu dans la table CORE générique `content_claims` : tant
 * que le claim n'est pas expiré, le notifier d'ajouts biblio du core n'envoie
 * pas de push doublon pour ce (tmdbId/titre, user) — c'est Seer qui notifie la
 * dispo. TTL glissant (rafraîchi tant que la demande est active ; expire seul
 * quand elle devient disponible).
 */
export async function upsertContentClaim(
  prisma: PrismaClient, tmdbId: number, jellyfinUserId: string,
  mediaType: string, title: string, ttlSeconds: number,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO content_claims (tmdbId, jellyfinUserId, mediaType, title, expiresAt)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(3), INTERVAL ? SECOND))
     ON DUPLICATE KEY UPDATE mediaType = VALUES(mediaType), title = VALUES(title), expiresAt = VALUES(expiresAt)`,
    tmdbId, jellyfinUserId, mediaType, title, ttlSeconds,
  );
}

/** Purge les revendications expirées (table CORE content_claims). */
export async function purgeExpiredContentClaims(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM content_claims WHERE expiresAt < NOW(3)`);
}
