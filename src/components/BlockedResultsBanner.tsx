import { useTranslation } from "react-i18next";

interface BlockedResultsBannerProps {
  /** Nombre d'éléments masqués (search/trending). Peut être 0 sur le discover. */
  blockedCount?: number;
  /** True quand l'utilisateur a choisi d'afficher le contenu masqué. */
  showBlocked: boolean;
  onToggle: () => void;
}

/**
 * Bandeau « certains résultats sont masqués · afficher quand même ».
 * Glassmorphism, responsive (empilé sur mobile, en ligne sur ≥ sm), accessible
 * (aria-live, aria-pressed, cible tactile ≥ 44px, couleur + icône + texte).
 */
export function BlockedResultsBanner({
  blockedCount = 0,
  showBlocked,
  onToggle,
}: BlockedResultsBannerProps) {
  const { t } = useTranslation("seer");

  const label = showBlocked
    ? t("blockedShown")
    : blockedCount > 0
      ? t("blockedHidden", { count: blockedCount })
      : t("blockedFilterActive");

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-tentacle-brand/20 bg-tentacle-brand/[0.07] px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5 sm:items-center">
        <svg
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-tentacle-brand sm:mt-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
          />
        </svg>
        <p className="text-sm leading-snug text-white/75">{label}</p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={showBlocked}
        className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tentacle-brand/60 sm:text-sm"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          {showBlocked ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
            />
          ) : (
            <>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </>
          )}
        </svg>
        {showBlocked ? t("blockedHideAgain") : t("blockedShowAnyway")}
      </button>
    </div>
  );
}
