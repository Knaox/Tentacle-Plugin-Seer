/* ------------------------------------------------------------------ */
/*  Vigie API — administration (utilisateurs, permissions, quotas)     */
/* ------------------------------------------------------------------ */

/* Extrait de seer-client.ts pour rester sous 300 lignes : ces appels ne
 * servent qu'à la page d'administration, jamais aux trois pages publiques. */

import { backendFetch } from "./seer-client";
import type { AdminUserRow, UpdateAdminUserBody } from "./types";

/* ── Admin users (permissions / quotas) ──────────────────────────── */

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  return backendFetch("/admin/users");
}

export async function updateAdminUser(
  jellyfinUserId: string,
  patch: UpdateAdminUserBody,
): Promise<AdminUserRow> {
  return backendFetch(`/admin/users/${encodeURIComponent(jellyfinUserId)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function syncAdminUsers(): Promise<{ synced: number; failed: number; created: number; total: number }> {
  return backendFetch("/admin/users/sync", { method: "POST" });
}

export interface SyncRequestsOwnershipResult {
  total: number;
  reassigned: number;
  recreated: number;
  alreadyOk: number;
  orphansCreated: number;
  failed: number;
  errors: Array<{ requestId: string; reason: string }>;
}

export async function syncRequestsOwnership(): Promise<SyncRequestsOwnershipResult> {
  return backendFetch("/admin/sync-requests-ownership", { method: "POST" });
}
