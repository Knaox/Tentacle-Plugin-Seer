import { useState } from "react";
import { useTranslation } from "react-i18next";

interface TrailerPlayerProps {
  videoKey: string;
}

export function TrailerPlayer({ videoKey }: TrailerPlayerProps) {
  const { t } = useTranslation("seer");
  const [showPlayer, setShowPlayer] = useState(false);

  if (!showPlayer) {
    return (
      <button
        onClick={() => setShowPlayer(true)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        {t("watchTrailer")}
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl">
      <div className="relative aspect-video w-full">
        <iframe
          src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="absolute inset-0 h-full w-full rounded-xl"
          title="Trailer"
        />
      </div>
    </div>
  );
}
