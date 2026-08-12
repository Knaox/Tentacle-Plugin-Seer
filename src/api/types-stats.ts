/* ------------------------------------------------------------------ */
/*  Vigie — notifications et statistiques                              */
/* ------------------------------------------------------------------ */

/* Extraits de types.ts pour tenir sous 300 lignes, ré-exportés depuis
 * ./types pour ne rien casser côté appelants. */

/* ── Notification types ──────────────────────────────────────────── */

export interface SeerNotification {
  id: string;
  jellyfinUserId: string;
  type: string;
  title: string;
  message: string;
  posterPath: string | null;
  refId: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  results: SeerNotification[];
  total: number;
  page: number;
  pages: number;
}

/* ── Stats types ─────────────────────────────────────────────────── */

export interface UserStats {
  totalRequests: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

export interface GlobalStats extends UserStats {
  topRequested: { title: string; tmdbId: number; count: number }[];
  topUsers: { username: string; count: number }[];
  successRate: number;
}

export interface StatsResponse {
  personal: UserStats;
  global?: GlobalStats;
}
