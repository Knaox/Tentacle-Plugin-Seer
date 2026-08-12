/* ------------------------------------------------------------------ */
/*  Vigie — types d'administration                                     */
/* ------------------------------------------------------------------ */

/* Extraits de types.ts pour tenir sous 300 lignes. Ré-exportés depuis
 * ./types pour ne rien casser côté appelants. */

export interface AdminUserRow {
  jellyfinUserId: string;
  username: string;
  blocked: boolean;
  dailyLimit: number | null;
  allowMovies: boolean;
  allowTv: boolean;
  allowAnime: boolean;
  jellyseerrUserId: number | null;
  jellyseerrLastSync: string | null;
  createdAt: string;
  updatedAt: string;
  requestsToday: number;
  requestsTotal: number;
}

export interface UpdateAdminUserBody {
  blocked?: boolean;
  dailyLimit?: number | null;
  allowMovies?: boolean;
  allowTv?: boolean;
  allowAnime?: boolean;
}

/** Erreur métier renvoyée par le backend (clé i18n + paramètres) */
export interface SeerBackendError {
  message?: string;
  errorKey?: string;
  limit?: number;
}

export type ProfileTargetMedia = "all" | "movie" | "tv" | "anime";

export interface SeerProfile {
  id: string;
  name: string;
  targetMediaType?: ProfileTargetMedia;
  radarrServerId?: number;
  radarrProfileId?: number;
  radarrRootFolder?: string;
  sonarrServerId?: number;
  sonarrProfileId?: number;
  sonarrRootFolder?: string;
  sonarrLanguageProfileId?: number;
  tags?: number[];
  isDefault?: boolean;
}

export interface QualityOption {
  id: number;
  name: string;
}

export interface ArrTag {
  id: number;
  label: string;
}

export interface ArrServerInfo {
  id: number;
  name: string;
  isDefault: boolean;
  profiles: QualityOption[];
  rootFolders: { id: number; path: string }[];
  tags: ArrTag[];
}
