import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getSeerBackendUrl } from "../../api/endpoints";
import { ProfilesConfig } from "./ProfilesConfig";
import { ConfigSection, type SeerConfig } from "./ConfigSection";
import { SeerUsersConfig } from "./SeerUsersConfig";

type Tab = "config" | "users";

export function SeerConfigPage() {
  const { t } = useTranslation("seer");
  const [config, setConfig] = useState<SeerConfig>({
    url: "",
    apiKey: "",
    enabled: false,
    autoApprove: false,
    userLimit: 0,
    profiles: [],
  });
  const [status, setStatus] = useState<"idle" | "testing" | "connected" | "error">("idle");
  const [seerrVersion, setSeerrVersion] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("config");

  const backendBase = getSeerBackendUrl();
  const token = localStorage.getItem("tentacle_token") ?? "";

  useEffect(() => {
    // Charger la config complète via la route plugin (admin voit tout)
    fetch(`${backendBase}/api/plugins/seer/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          url: data.url ?? "",
          apiKey: data.apiKey ?? "",
          enabled: data.enabled ?? false,
          autoApprove: data.autoApprove ?? false,
          userLimit: data.userLimit ?? 0,
          profiles: data.profiles ?? [],
        });
        setStatus(data.url ? "connected" : "idle");
      })
      .catch(() => setStatus("idle"));
  }, [backendBase, token]);

  const testConnection = async () => {
    setStatus("testing");
    setMessage("");
    try {
      const baseUrl = config.url.replace(/\/$/, "");
      const res = await fetch(`${backendBase}/api/plugins/seer/proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          url: `${baseUrl}/api/v1/status`,
          method: "GET",
          headers: { "X-Api-Key": config.apiKey },
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus("connected");
        const ver = data.data?.version;
        if (ver) setSeerrVersion(ver);
        setMessage(t("seer:connectionSuccess"));
      } else {
        setStatus("error");
        setMessage(t("seer:connectionFailed"));
      }
    } catch {
      setStatus("error");
      setMessage(t("seer:connectionUnreachable"));
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage("");
    try {
      // Sauvegarder via la route plugin (admin only)
      const res = await fetch(`${backendBase}/api/plugins/seer/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      });
      if (res.ok) setMessage(t("seer:configSaved"));
      else setMessage(t("seer:configSaveError"));
    } catch {
      setMessage(t("seer:networkError"));
    } finally {
      setSaving(false);
    }
  };

  const statusColor = status === "connected"
    ? "bg-emerald-500"
    : status === "error"
      ? "bg-red-500"
      : status === "testing"
        ? "bg-yellow-500 animate-pulse"
        : "bg-gray-500";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{t("seer:configTitle")}</h2>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
          <span className="text-xs text-white/50">
            {status === "connected" ? t("seer:statusConnected") : status === "error" ? t("seer:statusError") : status === "testing" ? t("seer:statusTesting") : t("seer:statusNotConfigured")}
            {seerrVersion && status === "connected" && (
              <span className="ml-2 text-white/30">v{seerrVersion}</span>
            )}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10">
        <button
          onClick={() => setTab("config")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "config"
              ? "border-b-2 border-tentacle-brand text-white"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          {t("seer:configTitle")}
        </button>
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "users"
              ? "border-b-2 border-tentacle-brand text-white"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          {t("seer:adminUsersTab")}
        </button>
      </div>

      {tab === "users" ? (
        <SeerUsersConfig seerrConfigured={!!(config.url && config.apiKey)} />
      ) : (
        <ConfigSection
          config={config}
          setConfig={setConfig}
          testConnection={testConnection}
          saveConfig={saveConfig}
          saving={saving}
          message={message}
          status={status}
          t={t}
        />
      )}
    </div>
  );
}
