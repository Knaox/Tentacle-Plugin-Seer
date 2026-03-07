import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { profileUrl } from "../utils/media-helpers";
import type { SeerrCastMember } from "../api/types";

interface CastRowProps {
  cast: SeerrCastMember[];
}

function AvatarFallback({ name }: { name: string }) {
  return (
    <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-white/10 text-sm font-medium text-white/30">
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export function CastRow({ cast }: CastRowProps) {
  const { t } = useTranslation("seer");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const members = cast.slice(0, 15);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    return () => el.removeEventListener("scroll", updateArrows);
  }, [updateArrows, members.length]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  if (members.length === 0) return null;

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          {t("castTitle")}
        </h3>
        {(canScrollLeft || canScrollRight) && (
          <div className="flex gap-1">
            <button
              onClick={() => scroll(-1)}
              disabled={!canScrollLeft}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 disabled:opacity-20"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => scroll(1)}
              disabled={!canScrollRight}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 disabled:opacity-20"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.3) transparent", cursor: "grab" }}
        onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.cursor = "grabbing"; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.cursor = "grab"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.cursor = "grab"; }}
      >
        {members.map((person) => (
          <div key={person.id} className="flex w-[60px] flex-shrink-0 flex-col items-center">
            {person.profilePath ? (
              <img
                src={profileUrl(person.profilePath)}
                alt={person.name}
                className="h-[60px] w-[60px] rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <AvatarFallback name={person.name} />
            )}
            <span className="mt-1.5 w-full text-center text-[11px] font-medium leading-tight text-white/60 line-clamp-2">
              {person.name}
            </span>
            <span className="w-full truncate text-center text-[10px] text-white/30">
              {person.character}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
