import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parseYouTubeId, type RichTrailer } from "../utils/trailers";
import { shouldOpenYouTubeExternally, openExternal } from "../utils/external";

interface ExtrasRowProps {
  /** Trailers + extras distants (déjà fusionnés Jellyfin + TMDB, triés langue). */
  trailers: RichTrailer[];
  /** Ouvre la modale trailer sur l'index cliqué (hors macOS DMG). */
  onSelect: (index: number) => void;
}

/**
 * Rangée « Extras » — réplique STRICTE d'ExtrasRow du core (page média détail) :
 * tuiles vignettes YouTube, clic → navigateur système sur macOS DMG, sinon
 * modale d'embed sur le trailer cliqué. Masquée si rien à montrer.
 */
export function ExtrasRow({ trailers, onSelect }: ExtrasRowProps) {
  const { t } = useTranslation("seer");
  if (trailers.length === 0) return null;

  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
        {t("seer:extras")}
      </h4>
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.3) transparent" }}
        aria-label={t("seer:extras")}
      >
        {trailers.map((tr, i) => {
          const yt = parseYouTubeId(tr.Url);
          return (
            <ExtraTile
              key={tr.Url}
              label={tr.Name || t("seer:watchTrailer")}
              sublabel={tr.type || "YouTube"}
              youtubeId={yt ?? undefined}
              onClick={() => {
                // macOS DMG : ouverture dans le navigateur système (cf. core TrailerButton).
                if (shouldOpenYouTubeExternally()) {
                  openExternal(tr.Url);
                  return;
                }
                onSelect(i);
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

function ExtraTile({
  label,
  sublabel,
  youtubeId,
  onClick,
}: {
  label: string;
  sublabel?: string;
  /** Si présent : vignette YouTube + détection vidéo indisponible/privée. */
  youtubeId?: string;
  onClick: () => void;
}) {
  // YouTube renvoie un placeholder gris 120x90 sur hqdefault.jpg pour les vidéos
  // supprimées ou privées → on masque la tuile au chargement de la vignette.
  const [unavailable, setUnavailable] = useState(false);
  const src = youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : undefined;
  if (unavailable) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group/extra flex w-44 flex-shrink-0 cursor-pointer flex-col text-left sm:w-52"
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-tentacle-surface-2 transition-transform duration-200 group-hover/extra:scale-[1.03]">
        {src ? (
          <img
            src={src}
            alt={label}
            loading="lazy"
            className="h-full w-full object-cover"
            onLoad={(e) => {
              if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth <= 120) {
                setUnavailable(true);
              }
            }}
            onError={() => setUnavailable(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/25">
            <PlayGlyph />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-white transition-colors duration-200 group-hover/extra:bg-black/35">
          <span className="opacity-0 transition-opacity duration-200 group-hover/extra:opacity-100">
            <PlayGlyph />
          </span>
        </div>
      </div>
      <p className="mt-1.5 truncate text-sm font-medium text-white/90">{label}</p>
      {sublabel && <p className="truncate text-xs text-white/45">{sublabel}</p>}
    </button>
  );
}

function PlayGlyph() {
  return (
    <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
