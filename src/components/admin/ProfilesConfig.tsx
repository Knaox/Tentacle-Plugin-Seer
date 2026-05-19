import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProfileOptions } from "../../hooks/useProfiles";
import type { SeerProfile, ArrServerInfo, ArrTag, ProfileTargetMedia } from "../../api/types";

interface ProfilesConfigProps {
  profiles: SeerProfile[];
  onChange: (profiles: SeerProfile[]) => void;
}

const TARGET_OPTIONS: { value: ProfileTargetMedia; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "movie", label: "Films" },
  { value: "tv", label: "Séries" },
  { value: "anime", label: "Anime" },
];

function emptyProfile(): SeerProfile {
  return { id: crypto.randomUUID(), name: "", targetMediaType: "all", isDefault: false };
}

export function ProfilesConfig({ profiles, onChange }: ProfilesConfigProps) {
  const { t } = useTranslation("seer");
  const { data: options, isLoading, error } = useProfileOptions();

  const radarrServers = options?.radarr ?? [];
  const sonarrServers = options?.sonarr ?? [];

  const updateProfile = (id: string, patch: Partial<SeerProfile>) => {
    onChange(profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{t("seer:profilesTitle")}</h3>
        <button onClick={() => onChange([...profiles, emptyProfile()])}
          className="rounded-lg bg-tentacle-brand/20 px-3 py-1.5 text-xs font-medium text-tentacle-brand-light hover:bg-tentacle-brand/30">
          + {t("seer:profileAdd")}
        </button>
      </div>

      {isLoading && <p className="text-xs text-white/30">Chargement des serveurs...</p>}
      {error && <p className="text-xs text-red-400">Erreur: {(error as Error).message}</p>}

      {!isLoading && (radarrServers.length > 0 || sonarrServers.length > 0) && (
        <div className="rounded-lg bg-white/5 px-3 py-2 text-[10px] text-white/30">
          Radarr: {radarrServers.map((s) => `${s.name} (${s.profiles.length} profils)`).join(", ") || "aucun"} —
          Sonarr: {sonarrServers.map((s) => `${s.name} (${s.profiles.length} profils)`).join(", ") || "aucun"}
        </div>
      )}

      {profiles.length === 0 && <p className="text-xs text-white/30">{t("seer:profilesEmpty")}</p>}

      {profiles.map((profile) => (
        <ProfileCard key={profile.id} profile={profile}
          radarrServers={radarrServers} sonarrServers={sonarrServers}
          onUpdate={(patch) => updateProfile(profile.id, patch)}
          onSetDefault={() => onChange(profiles.map((p) => ({ ...p, isDefault: p.id === profile.id })))}
          onRemove={() => onChange(profiles.filter((p) => p.id !== profile.id))}
          t={t} />
      ))}
    </div>
  );
}

function ProfileCard({ profile, radarrServers, sonarrServers, onUpdate, onSetDefault, onRemove, t }: {
  profile: SeerProfile; radarrServers: ArrServerInfo[]; sonarrServers: ArrServerInfo[];
  onUpdate: (patch: Partial<SeerProfile>) => void;
  onSetDefault: () => void; onRemove: () => void; t: (k: string) => string;
}) {
  const target = profile.targetMediaType ?? "all";
  const showRadarr = target === "all" || target === "movie";
  const showSonarr = target === "all" || target === "tv" || target === "anime";

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      {/* Header: nom + type cible + actions */}
      <div className="flex items-center gap-2">
        <input type="text" value={profile.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder={t("seer:profileNamePlaceholder")}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none focus:border-tentacle-brand" />
        <button onClick={onSetDefault}
          className={`rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
            profile.isDefault ? "bg-tentacle-brand/30 text-tentacle-brand-light" : "bg-white/5 text-white/30 hover:bg-white/10"
          }`}>
          {t("seer:profileDefault")}
        </button>
        <button onClick={onRemove}
          className="rounded-lg bg-red-600/20 px-2 py-1.5 text-[10px] text-red-400 hover:bg-red-600/30">
          {t("seer:delete")}
        </button>
      </div>

      {/* Type de média ciblé */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
          {t("seer:profileTarget")}
        </label>
        <div className="flex gap-1.5">
          {TARGET_OPTIONS.map((opt) => (
            <button key={opt.value} type="button"
              onClick={() => onUpdate({ targetMediaType: opt.value })}
              className={`rounded-md border px-2.5 py-1 text-[10px] font-medium transition-all ${
                target === opt.value
                  ? "border-tentacle-brand bg-tentacle-brand/20 text-white"
                  : "border-white/10 bg-white/5 text-white/40 hover:border-white/20"
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Serveurs Radarr / Sonarr (conditionnels) */}
      <div className={`grid gap-4 ${showRadarr && showSonarr ? "grid-cols-2" : "grid-cols-1"}`}>
        {showRadarr && (
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Radarr (Films)
            </label>
            {radarrServers.length === 0 ? (
              <p className="text-[10px] text-white/20">Aucun serveur Radarr</p>
            ) : (
              <ServerProfileSelect servers={radarrServers}
                serverId={profile.radarrServerId} profileId={profile.radarrProfileId} rootFolder={profile.radarrRootFolder}
                onServerChange={(id) => onUpdate({ radarrServerId: id })}
                onProfileChange={(id) => onUpdate({ radarrProfileId: id })}
                onRootFolderChange={(path) => onUpdate({ radarrRootFolder: path })} />
            )}
          </div>
        )}
        {showSonarr && (
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Sonarr ({target === "anime" ? "Anime" : "Séries"})
            </label>
            {sonarrServers.length === 0 ? (
              <p className="text-[10px] text-white/20">Aucun serveur Sonarr</p>
            ) : (
              <ServerProfileSelect servers={sonarrServers}
                serverId={profile.sonarrServerId} profileId={profile.sonarrProfileId} rootFolder={profile.sonarrRootFolder}
                onServerChange={(id) => onUpdate({ sonarrServerId: id })}
                onProfileChange={(id) => onUpdate({ sonarrProfileId: id })}
                onRootFolderChange={(path) => onUpdate({ sonarrRootFolder: path })} />
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      <TagsSection
        radarrServers={radarrServers} sonarrServers={sonarrServers}
        selectedTags={profile.tags ?? []}
        onChange={(tags) => onUpdate({ tags })}
        t={t} />
    </div>
  );
}

/* ── Tags section (sélection + ajout manuel) ─────────────────────── */

function TagsSection({ radarrServers, sonarrServers, selectedTags, onChange, t }: {
  radarrServers: ArrServerInfo[]; sonarrServers: ArrServerInfo[];
  selectedTags: number[]; onChange: (tags: number[]) => void; t: (k: string) => string;
}) {
  const [manualTag, setManualTag] = useState("");

  // Tags connus (de Jellyseerr)
  const knownTags = new Map<number, ArrTag>();
  for (const s of [...radarrServers, ...sonarrServers]) {
    for (const tag of s.tags ?? []) knownTags.set(tag.id, tag);
  }
  const availableTags = Array.from(knownTags.values()).sort((a, b) => a.label.localeCompare(b.label));

  const toggle = (id: number) => {
    onChange(selectedTags.includes(id) ? selectedTags.filter((t) => t !== id) : [...selectedTags, id]);
  };

  const addManual = () => {
    const val = manualTag.trim();
    const num = Number(val);
    if (val && !isNaN(num) && num > 0 && !selectedTags.includes(num)) {
      onChange([...selectedTags, num]);
    }
    setManualTag("");
  };

  // Tags manuels = ceux dans selectedTags qui ne sont pas dans knownTags
  const manualTags = selectedTags.filter((id) => !knownTags.has(id));

  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
        {t("seer:profileTags")}
      </label>
      <p className="mb-2 text-[9px] text-white/20">{t("seer:profileTagsHint")}</p>

      {/* Tags disponibles depuis Jellyseerr */}
      {availableTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {availableTags.map((tag) => (
            <button key={tag.id} type="button" onClick={() => toggle(tag.id)}
              className={`rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${
                selectedTags.includes(tag.id)
                  ? "border-tentacle-brand bg-tentacle-brand/20 text-tentacle-brand-light"
                  : "border-white/10 bg-white/5 text-white/30 hover:border-white/20"
              }`}>
              {tag.label}
            </button>
          ))}
        </div>
      )}

      {/* Tags manuels affichés */}
      {manualTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {manualTags.map((id) => (
            <button key={id} type="button" onClick={() => toggle(id)}
              className="rounded-md border border-amber-500/30 bg-amber-600/10 px-2 py-1 text-[10px] font-medium text-amber-300">
              #{id} <span className="ml-1 text-amber-400/50">x</span>
            </button>
          ))}
        </div>
      )}

      {/* Input ajout manuel */}
      <div className="flex gap-1.5">
        <input type="number" min={1} value={manualTag}
          onChange={(e) => setManualTag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addManual()}
          placeholder={t("seer:profileTagManual")}
          className="w-28 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white placeholder-white/20 outline-none focus:border-tentacle-brand" />
        <button type="button" onClick={addManual}
          className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/40 hover:bg-white/10">
          +
        </button>
      </div>
    </div>
  );
}

/* ── Server + profile dropdown ───────────────────────────────────── */

function ServerProfileSelect({ servers, serverId, profileId, rootFolder, onServerChange, onProfileChange, onRootFolderChange }: {
  servers: ArrServerInfo[];
  serverId?: number; profileId?: number; rootFolder?: string;
  onServerChange: (id: number | undefined) => void;
  onProfileChange: (id: number | undefined) => void;
  onRootFolderChange: (path: string | undefined) => void;
}) {
  const activeServer = servers.find((s) => s.id === serverId) ?? servers[0];
  const profiles = activeServer?.profiles ?? [];
  const rootFolders = activeServer?.rootFolders ?? [];

  return (
    <div className="space-y-1.5">
      {servers.length > 1 && (
        <select value={serverId ?? ""} onChange={(e) => onServerChange(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full rounded border border-white/10 bg-tentacle-surface-2 px-2 py-1 text-[11px] text-white outline-none">
          {servers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isDefault ? " (défaut)" : ""}</option>)}
        </select>
      )}
      <select value={profileId ?? ""} onChange={(e) => onProfileChange(e.target.value ? Number(e.target.value) : undefined)}
        className="w-full rounded border border-white/10 bg-tentacle-surface-2 px-2 py-1 text-[11px] text-white outline-none">
        <option value="">— Profil par défaut —</option>
        {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {rootFolders.length > 1 && (
        <select value={rootFolder ?? ""} onChange={(e) => onRootFolderChange(e.target.value || undefined)}
          className="w-full rounded border border-white/10 bg-tentacle-surface-2 px-2 py-1 text-[11px] text-white outline-none">
          <option value="">— Dossier par défaut —</option>
          {rootFolders.map((f) => <option key={f.id} value={f.path}>{f.path}</option>)}
        </select>
      )}
    </div>
  );
}
