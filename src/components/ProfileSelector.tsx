import { useTranslation } from "react-i18next";
import { useProfiles } from "../hooks/useProfiles";
import type { SeerProfile, MediaType } from "../api/types";

interface ProfileSelectorProps {
  mediaType?: MediaType;
  isAnime?: boolean;
  showAll?: boolean;
  selectedId: string | null;
  onChange: (profileId: string | null) => void;
}

export function ProfileSelector({ mediaType, isAnime, showAll, selectedId, onChange }: ProfileSelectorProps) {
  const { t } = useTranslation("seer");
  const { data } = useProfiles();
  const allProfiles = data?.profiles ?? [];

  const profiles = showAll ? allProfiles : allProfiles.filter((p: SeerProfile) => {
    const target = p.targetMediaType ?? "all";
    if (!mediaType) return true;
    if (mediaType === "movie") return target === "all" || target === "movie";
    if (isAnime) return target === "all" || target === "tv" || target === "anime";
    return target === "all" || target === "tv";
  });

  if (profiles.length === 0) return null;

  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/40">
        {t("seer:profileLabel")}
      </label>
      <div className="flex flex-wrap gap-2">
        {profiles.map((profile: SeerProfile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => onChange(selectedId === profile.id ? null : profile.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              selectedId === profile.id
                ? "border-tentacle-brand bg-tentacle-brand/20 text-white"
                : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/10"
            }`}
          >
            {profile.name}
            {profile.isDefault && (
              <span className="ml-1 text-[9px] text-tentacle-brand-light/60">({t("seer:profileDefault")})</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
