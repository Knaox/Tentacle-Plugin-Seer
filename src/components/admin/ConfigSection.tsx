import { ProfilesConfig } from "./ProfilesConfig";
import type { SeerProfile } from "../../api/types";

export interface SeerConfig {
  url: string;
  apiKey: string;
  enabled: boolean;
  autoApprove: boolean;
  userLimit: number;
  profiles: SeerProfile[];
}

/* ------------------------------------------------------------------ */
/*  Vigie — formulaire de connexion à Jellyseerr                       */
/* ------------------------------------------------------------------ */

/* Extrait de SeerConfigPage.tsx pour tenir sous 300 lignes : le formulaire
 * et ses interrupteurs, sans la logique de chargement ni les onglets. */

export function ConfigSection({
  config, setConfig, testConnection, saveConfig, saving, message, status, t,
}: {
  config: SeerConfig;
  setConfig: React.Dispatch<React.SetStateAction<SeerConfig>>;
  testConnection: () => Promise<void>;
  saveConfig: () => Promise<void>;
  saving: boolean;
  message: string;
  status: "idle" | "testing" | "connected" | "error";
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="space-y-6">
      {/* Non-affiliation — placée juste au-dessus du champ où l'administrateur
          colle l'adresse de SON Jellyseerr, l'endroit où la confusion serait
          la plus naturelle. */}
      <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/50">
        {t("seer:notAffiliated")}{" "}
        <a
          href="https://github.com/fallenbagel/jellyseerr"
          target="_blank"
          rel="noreferrer noopener"
          className="text-tentacle-brand underline underline-offset-2"
        >
          {t("seer:notAffiliatedLink")}
        </a>
      </p>

      {/* URL */}
      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">{t("seer:urlLabel")}</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={config.url}
            onChange={(e) => setConfig((c) => ({ ...c, url: e.target.value }))}
            placeholder={t("seer:urlPlaceholder")}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-tentacle-brand"
          />
          <button
            onClick={testConnection}
            disabled={!config.url || status === "testing"}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/15 disabled:opacity-40"
          >
            {t("seer:testButton")}
          </button>
        </div>
      </div>

      {/* API Key */}
      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">{t("seer:apiKeyLabel")}</label>
        <input
          type="password"
          value={config.apiKey}
          onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
          placeholder={t("seer:apiKeyPlaceholder")}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-tentacle-brand"
        />
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <ToggleRow
          label={t("seer:toggleEnabled")}
          description={t("seer:toggleEnabledDesc")}
          checked={config.enabled}
          onChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
        />
        <ToggleRow
          label={t("seer:toggleAutoApprove")}
          description={t("seer:toggleAutoApproveDesc")}
          checked={config.autoApprove}
          onChange={(v) => setConfig((c) => ({ ...c, autoApprove: v }))}
        />
      </div>

      {/* User limit */}
      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">
          {t("seer:userLimitLabel")}
        </label>
        <input
          type="number"
          min={0}
          value={config.userLimit}
          onChange={(e) => setConfig((c) => ({ ...c, userLimit: parseInt(e.target.value) || 0 }))}
          className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-tentacle-brand"
        />
      </div>

      {/* Profiles — visible dès qu'une URL est configurée */}
      {config.url && (
        <ProfilesConfig
          profiles={config.profiles}
          onChange={(profiles) => setConfig((c) => ({ ...c, profiles }))}
        />
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={saveConfig}
          disabled={saving}
          style={{ boxShadow: "0 8px 22px rgba(var(--brand-rgb), 0.45)" }} className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-black transition-all hover:-translate-y-0.5 hover:bg-white/95 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {saving ? t("seer:saving") : t("seer:save")}
        </button>
        {message && <span className="text-sm text-white/50">{message}</span>}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-tentacle-brand" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
