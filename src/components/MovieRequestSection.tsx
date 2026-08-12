import { useTranslation } from "react-i18next";
import { ProfileSelector } from "./ProfileSelector";
import { CTA_PRIMARY, CTA_PRIMARY_HALO } from "../styles/cta";

interface MovieRequestSectionProps {
  /** Statut Seerr global du film (0/1 = jamais demandé). */
  mediaStatus: number;
  isAnime: boolean;
  requesting: boolean;
  requestSuccess: boolean;
  profileId: string | null;
  onProfileChange: (id: string | null) => void;
  onRequest: () => void;
  /** false = pas encore sorti en ligne : le téléchargement ne pourra pas démarrer. */
  obtainable?: boolean;
}

/**
 * Section demande d'un film : profil de qualité + CTA. Badge si déjà demandé.
 * Rien si le film est en bibliothèque (l'action bar affiche « Regarder »).
 */
export function MovieRequestSection({
  mediaStatus, isAnime, requesting, requestSuccess, profileId, onProfileChange, onRequest,
  obtainable = true,
}: MovieRequestSectionProps) {
  const { t } = useTranslation("seer");

  if (mediaStatus >= 4) return null;

  if (mediaStatus >= 2) {
    return (
      <div className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-tentacle-status-warning-bg text-sm font-semibold text-tentacle-status-warning-fg">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        {t("seer:alreadyRequested")}
      </div>
    );
  }

  return (
    <div>
      <ProfileSelector mediaType="movie" isAnime={isAnime} selectedId={profileId} onChange={onProfileChange} />
      <button
        onClick={onRequest}
        disabled={requesting || requestSuccess}
        style={CTA_PRIMARY_HALO}
        className={`${CTA_PRIMARY} min-h-[48px] w-full gap-2 py-3 focus:outline-none focus:ring-2 focus:ring-tentacle-brand/50`}
      >
        {requesting ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t("seer:requestingMovie")}
          </>
        ) : requestSuccess ? (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {t("seer:requestAdded")}
          </>
        ) : obtainable ? t("seer:requestMovie") : t("seer:availRequestAnyway")}
      </button>

      {/* Dire pourquoi rien ne se passera tout de suite vaut mieux que laisser
          la demande stagner sans explication. */}
      {!obtainable && !requestSuccess && (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-tentacle-text-quaternary">
          {t("seer:availRequestAnywayHint")}
        </p>
      )}
    </div>
  );
}
