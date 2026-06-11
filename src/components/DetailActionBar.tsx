import { useState } from "react";
import { useTranslation } from "react-i18next";
import { navigateToMedia } from "../utils/navigate-media";
import { shouldOpenYouTubeExternally, openExternal } from "../utils/external";
import type { MediaType } from "../api/types";
import type { RichTrailer } from "../utils/trailers";

interface DetailActionBarProps {
  mediaType: MediaType;
  tmdbId: number;
  /** Statut Seerr global du média (4 partiel, 5 dispo). */
  mediaStatus: number;
  trailers: RichTrailer[];
  onOpenTrailer: () => void;
}

/**
 * Barre d'actions sous le header du modal :
 *  - « Regarder » (média en bibliothèque) → navigation vers la page média Tentacle ;
 *  - « Bande-annonce » → même comportement que TrailerButton du core : macOS DMG
 *    ouvre le navigateur système, sinon modale d'embed (masqué si aucun trailer).
 */
export function DetailActionBar({ mediaType, tmdbId, mediaStatus, trailers, onOpenTrailer }: DetailActionBarProps) {
  const { t } = useTranslation("seer");
  const [navigating, setNavigating] = useState(false);
  const inLibrary = mediaStatus >= 4;
  const hasTrailers = trailers.length > 0;

  if (!inLibrary && !hasTrailers) return null;

  const handleWatch = async () => {
    if (navigating) return;
    setNavigating(true);
    try {
      await navigateToMedia(tmdbId, mediaType);
    } finally {
      setNavigating(false);
    }
  };

  const handleTrailer = () => {
    // macOS DMG : WKWebView strip le Referer → YouTube refuse l'embed (153).
    // On ouvre dans le navigateur système, comme le core.
    if (shouldOpenYouTubeExternally() && trailers[0]?.Url) {
      openExternal(trailers[0].Url);
      return;
    }
    onOpenTrailer();
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {inLibrary && (
        <button
          onClick={handleWatch}
          disabled={navigating}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500/90 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-500 disabled:opacity-60 sm:flex-initial"
        >
          {navigating ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {mediaType === "tv" ? t("seer:libraryGoSeries") : t("seer:libraryGoMovie")}
        </button>
      )}

      {hasTrailers && (
        <button
          onClick={handleTrailer}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.14] bg-white/[0.07] px-5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-white/[0.12] sm:flex-initial"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v12.75c0 .621.504 1.125 1.125 1.125ZM6 4.5v15m12-15v15M2.25 9h3.75m-3.75 6h3.75m12-6h3.75m-3.75 6h3.75" />
          </svg>
          {t("seer:watchTrailer")}
        </button>
      )}
    </div>
  );
}
