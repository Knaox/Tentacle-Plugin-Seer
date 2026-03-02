import { useTranslation } from "react-i18next";
import { profileUrl } from "../utils/media-helpers";
import type { SeerrCastMember } from "../api/types";

interface CastRowProps {
  cast: SeerrCastMember[];
}

function AvatarFallback({ name }: { name: string }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-white/30">
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export function CastRow({ cast }: CastRowProps) {
  const { t } = useTranslation("seer");
  const members = cast.slice(0, 10);

  if (members.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-white/40">
        {t("castTitle")}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {members.map((person) => (
          <div key={person.id} className="flex w-16 flex-shrink-0 flex-col items-center">
            {person.profilePath ? (
              <img
                src={profileUrl(person.profilePath)}
                alt={person.name}
                className="h-16 w-16 rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <AvatarFallback name={person.name} />
            )}
            <span className="mt-1.5 w-full truncate text-center text-[10px] font-medium text-white/60">
              {person.name}
            </span>
            <span className="w-full truncate text-center text-[9px] text-white/30">
              {person.character}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
