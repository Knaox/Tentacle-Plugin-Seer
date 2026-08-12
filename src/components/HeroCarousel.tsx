import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../api/types";
import { useNearViewport, HERO_GUARD } from "../hooks/useNearViewport";
import { backdropUrl, posterUrl, mediaTitle, mediaYear } from "../utils/media-helpers";
import { navigateToMedia } from "../utils/navigate-media";
import { CTA_PRIMARY, CTA_PRIMARY_HALO, CTA_SECONDARY } from "../styles/cta";
import { STATUS_STYLE } from "../styles/status";

interface HeroCarouselProps {
  items: SeerrSearchResult[];
  onSelect: (item: SeerrSearchResult) => void;
  onRequest: (item: SeerrSearchResult) => void;
}

export function HeroCarousel({ items, onSelect, onRequest }: HeroCarouselProps) {
  const { t } = useTranslation("seer");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const slides = items.slice(0, 5);
  const [onScreen, heroRef] = useNearViewport(HERO_GUARD);
  const [tabAwake, setTabAwake] = useState(true);

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    const sync = () => setTabAwake(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  /*
   * Le minuteur ne tourne QUE devant quelqu'un. Il tournait jusqu'ici sans fin,
   * y compris huit mille pixels plus bas dans le catalogue, et chaque tour
   * coûtait cher : cinq arrière-plans en pleine largeur maintenus au chaud —
   * les plus grosses images de l'application — plus le remontage complet du
   * contenu que provoque le `key={index}`, animation d'entrée comprise. Une
   * animation infinie se garde par visibilité (règle GPU du projet).
   *
   * Au retour, le délai repart entier : le diaporama ne saute pas d'une vue à
   * l'instant précis où on le regarde à nouveau.
   */
  useEffect(() => {
    if (paused || !onScreen || !tabAwake || slides.length <= 1) return;
    timerRef.current = setTimeout(advance, 6000);
    return () => clearTimeout(timerRef.current);
  }, [index, paused, onScreen, tabAwake, advance, slides.length]);

  if (slides.length === 0) return null;
  const item = slides[index];
  const title = mediaTitle(item);
  const year = mediaYear(item);
  const backdrop = backdropUrl(item.backdropPath, "w1280");
  const poster = posterUrl(item.posterPath, "w342");
  const hasMediaInfo = item.mediaInfo && item.mediaInfo.status > 1;
  const isAvailable = item.mediaInfo?.status === 5;
  const isRequested = !isAvailable && (item.mediaInfo?.status ?? 0) >= 2;

  return (
    <div
      ref={heroRef}
      className="relative h-[380px] overflow-hidden sm:h-[440px] lg:h-[500px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity"
        style={{ backgroundImage: backdrop ? `url(${backdrop})` : undefined, transitionDuration: "600ms" }}
      >
        {/* Scrims NOIRS constants (`--scrim-media-rgb`) : image vive + texte
            on-media blanc lisible dans les DEUX thèmes — même recette que le
            hero du core. (Les anciens gradients #0a0a0f figés juraient en
            clair, où l'inversion host rendait le texte encre sur fond noir.) */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(var(--scrim-media-rgb),0.72), rgba(var(--scrim-media-rgb),0.50) 30%, rgba(var(--scrim-media-rgb),0.18) 65%, transparent)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(var(--scrim-media-rgb),0.60), rgba(var(--scrim-media-rgb),0.25) 40%, transparent 70%)" }}
        />
      </div>

      {/* Content */}
      <div
        className="relative flex h-full cursor-pointer items-end gap-5 px-6 pb-8 sm:px-10"
        style={{ animation: "fadeSlideUp 600ms ease forwards" }}
        key={index}
        // Toujours la fiche détail — même disponible (saisons, épisodes, dates).
        // Le bouton « Disponible » ci-dessous garde la navigation directe.
        onClick={() => onSelect(item)}
      >
        {/* Poster */}
        {poster && (
          <img
            src={poster}
            alt={title}
            className="hidden h-52 w-36 flex-shrink-0 rounded-xl object-cover shadow-2xl sm:block lg:h-60 lg:w-40"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h2
            className="text-3xl font-bold leading-tight text-tentacle-on-media-primary sm:text-4xl lg:text-5xl"
            style={{ textShadow: "0 3px 12px var(--on-media-shadow)" }}
          >
            {title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-tentacle-on-media-secondary">
            {year && <span>{year}</span>}
            {item.voteAverage != null && item.voteAverage > 0 && (
              <span className={`flex items-center gap-1 font-semibold ${STATUS_STYLE.rating.text}`}>
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {item.voteAverage.toFixed(1)}
              </span>
            )}
            {item.genreIds && item.genreIds.length > 0 && (
              <span className="text-tentacle-on-media-secondary">
                {item.mediaType === "movie" ? t("typeMovie") : t("typeSeries")}
              </span>
            )}
          </div>
          {item.overview && (
            <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-tentacle-on-media-secondary" style={{ textShadow: "0 1px 4px var(--on-media-shadow)" }}>
              {item.overview}
            </p>
          )}
          <div className="mt-1 flex items-center gap-3">
            {/* Posés sur le scrim média : aplats PLEINS du schéma + texte blanc
                constant (`cta-brand-fg`) — lisibles clair comme sombre. */}
            {isAvailable && (
              <button
                onClick={(e) => { e.stopPropagation(); navigateToMedia(item.id, item.mediaType); }}
                className={`rounded-lg px-5 py-2 text-sm font-semibold text-tentacle-cta-brand-fg transition-opacity hover:opacity-90 ${STATUS_STYLE.available.solid}`}
              >
                ▶ {t("heroAvailable")}
              </button>
            )}
            {isRequested && (
              <span className={`rounded-lg px-4 py-2 text-sm font-semibold text-tentacle-cta-brand-fg ${STATUS_STYLE.requested.solid}`}>
                {t("heroRequested")}
              </span>
            )}
            {!isAvailable && !isRequested && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.mediaType === "tv") {
                    onSelect(item);
                  } else {
                    onRequest(item);
                  }
                }}
                style={CTA_PRIMARY_HALO}
                className={`${CTA_PRIMARY} px-5 py-2 focus:outline-none focus:ring-2 focus:ring-tentacle-brand-soft`}
              >
                {item.mediaType === "tv" ? t("viewSeasons") : t("request")}
              </button>
            )}
            <button
              onClick={() => onSelect(item)}
              className={`${CTA_SECONDARY} px-5 py-2 backdrop-blur focus:outline-none focus:ring-2 focus:ring-tentacle-brand-soft`}
            >
              {t("moreInfo")}
            </button>
          </div>
        </div>
      </div>

      {/* Indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 right-6 flex gap-1.5 sm:right-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-tentacle-brand-soft ${
                i === index ? "w-6 bg-tentacle-brand" : "w-1.5 bg-tentacle-on-media-muted hover:opacity-80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
