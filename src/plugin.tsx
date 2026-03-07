import { lazy } from "react";
import type { TentaclePlugin } from "@tentacle-tv/plugins-api";
import { isSeerConfigured } from "./api/seer-client";
import { setSeerBackendUrl } from "./api/endpoints";
import { ToastProvider } from "./components/ToastProvider";
import enTranslations from "./i18n/en";
import frTranslations from "./i18n/fr";

const DiscoverPage = lazy(() =>
  import("./components/DiscoverPage").then((m) => ({
    default: () => <ToastProvider><m.DiscoverPage /></ToastProvider>,
  }))
);
const RequestsPage = lazy(() =>
  import("./components/RequestsPage").then((m) => ({
    default: () => <ToastProvider><m.RequestsPage /></ToastProvider>,
  }))
);
const StatsPage = lazy(() =>
  import("./components/StatsPage").then((m) => ({ default: m.StatsPage }))
);
const SeerConfigPage = lazy(() =>
  import("./components/admin/SeerConfigPage").then((m) => ({ default: m.SeerConfigPage }))
);

/* ---- Icons ---- */

function DiscoverIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function RequestsIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function StatsIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function ConfigIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

/* ---- Plugin definition ---- */

export const seerPlugin: TentaclePlugin = {
  id: "seer",
  name: "seer:pluginName",
  version: "1.2.0-beta",
  description: "seer:pluginDescription",

  routes: [
    {
      path: "/discover",
      component: DiscoverPage,
      label: "seer:navDiscover",
      icon: DiscoverIcon,
      showInMobileNav: true,
      showInSidebar: true,
      requiresAuth: true,
    },
    {
      path: "/requests",
      component: RequestsPage,
      label: "seer:navMyRequests",
      icon: RequestsIcon,
      showInMobileNav: true,
      showInSidebar: true,
      requiresAuth: true,
    },
    {
      path: "/stats",
      component: StatsPage,
      label: "seer:navStats",
      icon: StatsIcon,
      showInMobileNav: false,
      showInSidebar: true,
      requiresAuth: true,
    },
  ],

  navItems: [
    {
      label: "seer:navDiscover",
      path: "/discover",
      icon: DiscoverIcon,
      platforms: ["web", "desktop", "mobile"],
    },
    {
      label: "seer:navRequests",
      path: "/requests",
      icon: RequestsIcon,
      platforms: ["web", "desktop", "mobile"],
    },
    {
      label: "seer:navStats",
      path: "/stats",
      icon: StatsIcon,
      platforms: ["web", "desktop"],
    },
  ],

  adminRoutes: [
    {
      path: "/admin/plugins/seer",
      component: SeerConfigPage,
      label: "seer:navConfig",
      icon: ConfigIcon,
      showInMobileNav: false,
      showInSidebar: false,
      requiresAuth: true,
      requiresAdmin: true,
    },
  ],

  adminNavItems: [
    {
      label: "seer:navSeer",
      path: "/admin/plugins/seer",
      icon: ConfigIcon,
      platforms: ["web", "desktop"],
    },
  ],

  isConfigured: isSeerConfigured,

  async initialize() {
    // Configure backend URL from host app
    const tentacle = (window as unknown as Record<string, unknown>).__tentacle as Record<string, unknown> | undefined;
    const hostBackendUrl = (tentacle?.backendUrl as string) ?? "";
    setSeerBackendUrl(hostBackendUrl);

    // Register i18n translations with the host app's i18next instance
    const shared = (window as unknown as Record<string, unknown>).TentacleShared as Record<string, unknown> | undefined;
    const i18nInstance = shared?.i18n as {
      addResourceBundle: (lng: string, ns: string, resources: Record<string, string>, deep?: boolean, overwrite?: boolean) => void;
    } | undefined;
    if (i18nInstance) {
      i18nInstance.addResourceBundle("en", "seer", enTranslations, true, true);
      i18nInstance.addResourceBundle("fr", "seer", frTranslations, true, true);
    }

    // Inject plugin-specific keyframes not provided by host.
    // Host Tailwind purges keyframes whose animate-* class isn't used in host code.
    if (!document.getElementById("seer-keyframes")) {
      const style = document.createElement("style");
      style.id = "seer-keyframes";
      style.textContent = [
        "@keyframes fadeIn{from{opacity:0}to{opacity:1}}",
        "@keyframes fadeSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}",
        "@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}",
      ].join("");
      document.head.appendChild(style);
    }
  },

  async destroy() {
    // Cleanup
  },
};

// Auto-register when loaded as an external plugin bundle
if (typeof window !== "undefined") {
  const tentacle = (window as unknown as Record<string, unknown>).__tentacle as {
    registerPlugin: (plugin: TentaclePlugin) => void;
  } | undefined;
  if (tentacle) {
    // Initialize translations + backend URL BEFORE registering
    // so admin labels render correctly immediately
    seerPlugin.initialize?.();
    tentacle.registerPlugin(seerPlugin);
  }
}
