import { useTranslation } from "react-i18next";
import { EmptyState } from "./EmptyState";

/**
 * État vide de la page Demandes. `filtered` = un filtre/recherche est actif
 * (pas de CTA Découvrir dans ce cas, le vide vient du filtre).
 */
export function RequestsEmpty({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation("seer");

  const goDiscover = () => {
    if ((window as any).ReactNativeWebView?.postMessage) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "NAVIGATE", route: "/(tabs)/plugins" }));
    } else {
      window.parent.postMessage({ type: "NAVIGATE", path: "/plugins/seer/discover" }, "*");
    }
  };

  return (
    <EmptyState
      title={filtered ? t("seer:noRequestsFiltered") : t("seer:noRequestsAll")}
      subtitle={filtered ? undefined : t("seer:noRequestsHint")}
      action={filtered ? undefined : (
        <button
          onClick={goDiscover}
          style={{ boxShadow: "0 8px 22px rgba(var(--brand-rgb), 0.45)" }}
          className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-black transition-all hover:-translate-y-0.5 hover:bg-white/95"
        >
          {t("discoverButton")}
        </button>
      )}
    />
  );
}
