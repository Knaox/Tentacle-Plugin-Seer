/* ------------------------------------------------------------------ */
/*  Host theme fallback — tokens Tentacle garantis sur toutes les      */
/*  plateformes.                                                       */
/*                                                                     */
/*  Le wrapper iframe du host WEB injecte tokens.css + une config      */
/*  Tailwind complète (bg-tentacle-surface-1, shadow-tentacle-…).      */
/*  Le template WebView MOBILE, lui, ne définit que les anciens        */
/*  alias (tentacle-bg/surface/accent) : toutes les classes            */
/*  sémantiques y étaient inexistantes → modals, dropdowns et badges   */
/*  transparents / texte invisible. On répare côté plugin :            */
/*    1. injection des CSS variables manquantes (valeurs par défaut    */
/*       du thème host) ;                                              */
/*    2. fusion de la config Tailwind runtime (Play CDN) pour que      */
/*       les classes tentacle-* compilent aussi sur mobile.            */
/*  Sur web, les tokens existent déjà → no-op (le thème host gagne).   */
/* ------------------------------------------------------------------ */

/* Copie des valeurs par défaut de apps/web/src/theme/tokens.css. */
const FALLBACK_TOKENS_CSS = `:root{
--surface-0:#000000;--surface-1:#0a0a0a;--surface-2:#141414;--surface-3:#1f1f1f;
--surface-overlay:rgba(0,0,0,0.7);
--brand:#8B5CF6;--brand-rgb:139,92,246;--brand-light:#A78BFA;--brand-dark:#7C3AED;
--brand-soft:rgba(139,92,246,0.15);--brand-glow:rgba(139,92,246,0.4);
--brand-accent:#EC4899;--brand-accent-rgb:236,72,153;--brand-accent-light:#F472B6;
--text-primary:#FFFFFF;--text-secondary:rgba(255,255,255,0.78);--text-tertiary:rgba(255,255,255,0.55);
--text-quaternary:rgba(255,255,255,0.34);--text-disabled:rgba(255,255,255,0.22);
--cta-primary-bg:#FFFFFF;--cta-primary-bg-hover:rgba(255,255,255,0.85);--cta-primary-fg:#000000;
--cta-secondary-bg:rgba(109,109,110,0.55);--cta-secondary-bg-hover:rgba(109,109,110,0.78);--cta-secondary-fg:#FFFFFF;
--cta-ghost-bg:rgba(255,255,255,0.08);--cta-ghost-bg-hover:rgba(255,255,255,0.14);
--border-subtle:rgba(255,255,255,0.08);--border-strong:rgba(255,255,255,0.16);--border-focus:rgba(139,92,246,0.85);
--status-success:#10b981;--status-warning:#f59e0b;--status-error:#ef4444;--status-info:#3b82f6;
--status-success-bg:rgba(16,185,129,0.15);--status-success-fg:#34D399;
--status-error-bg:rgba(239,68,68,0.15);--status-error-fg:#F87171;
--status-warning-bg:rgba(245,158,11,0.15);--status-warning-fg:#FBBF24;
--status-info-bg:rgba(59,130,246,0.15);--status-info-fg:#60A5FA;
--surface-modal:rgba(15,15,21,0.96);--surface-dropdown:rgba(20,20,26,0.95);
--surface-sheet:rgba(15,15,21,0.96);--surface-toolbar:rgba(20,20,26,0.92);
--blur-overlay:24px;--blur-modal:20px;--blur-dropdown:12px;--blur-sheet:16px;
--shadow-modal:0 25px 70px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06);
--shadow-dropdown:0 12px 36px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.06);
--shadow-sheet:0 -8px 32px rgba(0,0,0,0.5);
--elev-1:0 4px 12px rgba(0,0,0,0.4);--elev-2:0 8px 24px rgba(0,0,0,0.55);--elev-3:0 16px 48px rgba(0,0,0,0.7);
--radius-xs:4px;--radius-sm:6px;--radius-md:8px;--radius-lg:12px;--radius-xl:16px;--radius-pill:9999px;
--ease-out:cubic-bezier(0.22,1,0.36,1);--ease-in-out:cubic-bezier(0.65,0,0.35,1);--ease-spring:cubic-bezier(0.34,1.56,0.64,1);
--duration-instant:80ms;--duration-fast:150ms;--duration-base:240ms;--duration-slow:400ms;
}`;

/* Même mapping sémantique que buildPluginHtml.ts (host web). */
const TENTACLE_COLORS: Record<string, string> = {
  "surface-0": "var(--surface-0)", "surface-1": "var(--surface-1)",
  "surface-2": "var(--surface-2)", "surface-3": "var(--surface-3)",
  "surface-modal": "var(--surface-modal)", "surface-dropdown": "var(--surface-dropdown)",
  "surface-toolbar": "var(--surface-toolbar)",
  brand: "var(--brand)", "brand-light": "var(--brand-light)",
  "brand-dark": "var(--brand-dark)", "brand-accent": "var(--brand-accent)",
  "text-primary": "var(--text-primary)", "text-secondary": "var(--text-secondary)",
  "text-tertiary": "var(--text-tertiary)", "text-quaternary": "var(--text-quaternary)",
  "text-disabled": "var(--text-disabled)",
  "cta-primary": "var(--cta-primary-bg)", "cta-primary-fg": "var(--cta-primary-fg)",
  "cta-secondary": "var(--cta-secondary-bg)", "cta-secondary-fg": "var(--cta-secondary-fg)",
  "cta-ghost": "var(--cta-ghost-bg)",
  "border-subtle": "var(--border-subtle)", "border-strong": "var(--border-strong)",
  "border-focus": "var(--border-focus)",
  "status-success": "var(--status-success)", "status-success-bg": "var(--status-success-bg)",
  "status-success-fg": "var(--status-success-fg)",
  "status-warning": "var(--status-warning)", "status-warning-bg": "var(--status-warning-bg)",
  "status-warning-fg": "var(--status-warning-fg)",
  "status-error": "var(--status-error)", "status-error-bg": "var(--status-error-bg)",
  "status-error-fg": "var(--status-error-fg)",
  "status-info": "var(--status-info)", "status-info-bg": "var(--status-info-bg)",
  "status-info-fg": "var(--status-info-fg)",
};

function hasCssVar(name: string): boolean {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() !== "";
  } catch {
    return false;
  }
}

/** Injecte les CSS variables du thème si le host ne les fournit pas. */
function ensureCssVariables(): void {
  if (hasCssVar("--surface-1") || document.getElementById("seer-theme-fallback")) return;
  const style = document.createElement("style");
  style.id = "seer-theme-fallback";
  style.textContent = FALLBACK_TOKENS_CSS;
  // En tête de <head> : si le host injecte ses tokens plus tard, ils gagnent.
  document.head.prepend(style);
}

/** Complète la config Tailwind runtime (Play CDN) avec les tokens sémantiques. */
function ensureTailwindConfig(): void {
  const tw = (window as unknown as Record<string, unknown>).tailwind as
    | { config?: Record<string, any> }
    | undefined;
  if (!tw) return; // pas de Tailwind runtime → rien à faire

  const config = (tw.config ??= {});
  const theme = (config.theme ??= {});
  const extend = (theme.extend ??= {});
  const colors = (extend.colors ??= {});
  const tentacle = (colors.tentacle ??= {});
  if (tentacle["surface-1"]) return; // config host complète (web) → no-op

  Object.assign(tentacle, TENTACLE_COLORS);
  extend.borderRadius = {
    ...(extend.borderRadius ?? {}),
    "tentacle-xs": "var(--radius-xs)", "tentacle-sm": "var(--radius-sm)",
    "tentacle-md": "var(--radius-md)", "tentacle-lg": "var(--radius-lg)",
    "tentacle-xl": "var(--radius-xl)", "tentacle-pill": "var(--radius-pill)",
  };
  extend.boxShadow = {
    ...(extend.boxShadow ?? {}),
    "tentacle-elev-1": "var(--elev-1)", "tentacle-elev-2": "var(--elev-2)",
    "tentacle-elev-3": "var(--elev-3)", "tentacle-modal": "var(--shadow-modal)",
    "tentacle-dropdown": "var(--shadow-dropdown)", "tentacle-sheet": "var(--shadow-sheet)",
  };
  extend.backdropBlur = {
    ...(extend.backdropBlur ?? {}),
    "tentacle-overlay": "var(--blur-overlay)", "tentacle-modal": "var(--blur-modal)",
    "tentacle-dropdown": "var(--blur-dropdown)", "tentacle-sheet": "var(--blur-sheet)",
  };
  extend.transitionTimingFunction = {
    ...(extend.transitionTimingFunction ?? {}),
    "tentacle-out": "var(--ease-out)", "tentacle-in-out": "var(--ease-in-out)",
    "tentacle-spring": "var(--ease-spring)",
  };
  extend.transitionDuration = {
    ...(extend.transitionDuration ?? {}),
    "tentacle-instant": "var(--duration-instant)", "tentacle-fast": "var(--duration-fast)",
    "tentacle-base": "var(--duration-base)", "tentacle-slow": "var(--duration-slow)",
  };
  // Réassignation : le Play CDN relit la config au prochain rebuild
  // (déclenché par la première mutation DOM du render React).
  tw.config = config;
}

/**
 * À appeler avant le premier render du plugin. Idempotent, no-op quand le
 * host fournit déjà le thème complet (iframe web).
 */
export function ensureHostTheme(): void {
  try {
    ensureCssVariables();
    ensureTailwindConfig();
  } catch {
    /* jamais bloquant pour le render */
  }
}
