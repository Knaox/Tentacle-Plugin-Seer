/* ------------------------------------------------------------------ */
/*  Jeux de tokens injectés par le plugin quand le host ne les fournit */
/*  pas (template mobile, anciens hosts). Valeurs copiées de           */
/*  apps/web/src/theme/tokens.css (blocs :root et [data-theme=light]). */
/* ------------------------------------------------------------------ */

import type { HostScheme } from "./host-scheme";

/** Tokens non colorimétriques — identiques dans les deux schémas. */
const FALLBACK_COMMON = `
--radius-xs:4px;--radius-sm:6px;--radius-md:8px;--radius-lg:12px;--radius-xl:16px;--radius-pill:9999px;
--ease-out:cubic-bezier(0.22,1,0.36,1);--ease-in-out:cubic-bezier(0.65,0,0.35,1);--ease-spring:cubic-bezier(0.34,1.56,0.64,1);
--duration-instant:80ms;--duration-fast:150ms;--duration-base:240ms;--duration-slow:400ms;
--blur-overlay:24px;--blur-modal:20px;--blur-dropdown:12px;--blur-sheet:16px;`;

const FALLBACK_DARK = `
--surface-0:#000000;--surface-1:#0a0a0a;--surface-2:#141414;--surface-3:#1f1f1f;
--surface-overlay:rgba(0,0,0,0.7);
--brand:#8B5CF6;--brand-rgb:139,92,246;--brand-light:#A78BFA;--brand-dark:#7C3AED;
--brand-soft:rgba(139,92,246,0.15);--brand-glow:rgba(139,92,246,0.4);
--brand-accent:#EC4899;--brand-accent-rgb:236,72,153;--brand-accent-light:#F472B6;
--text-primary:#FFFFFF;--text-secondary:rgba(255,255,255,0.78);--text-tertiary:rgba(255,255,255,0.55);
--text-quaternary:rgba(255,255,255,0.34);--text-disabled:rgba(255,255,255,0.22);
--cta-primary-bg:#FFFFFF;--cta-primary-bg-hover:rgba(255,255,255,0.85);--cta-primary-fg:#000000;--cta-primary-border:transparent;
--cta-secondary-bg:rgba(109,109,110,0.55);--cta-secondary-bg-hover:rgba(109,109,110,0.78);--cta-secondary-fg:#FFFFFF;
--cta-ghost-bg:rgba(255,255,255,0.08);--cta-ghost-bg-hover:rgba(255,255,255,0.14);
--cta-brand-fg:#FFFFFF;
--border-subtle:rgba(255,255,255,0.08);--border-strong:rgba(255,255,255,0.16);--border-focus:rgba(139,92,246,0.85);
--fill-faint:rgba(255,255,255,0.03);--fill-subtle:rgba(255,255,255,0.05);--fill-soft:rgba(255,255,255,0.08);
--fill-medium:rgba(255,255,255,0.12);--fill-strong:rgba(255,255,255,0.28);--fill-shimmer:rgba(255,255,255,0.05);
--status-success:#10b981;--status-warning:#f59e0b;--status-error:#ef4444;--status-info:#3b82f6;
--status-success-bg:rgba(16,185,129,0.15);--status-success-fg:#34D399;
--status-error-bg:rgba(239,68,68,0.15);--status-error-fg:#F87171;
--status-warning-bg:rgba(245,158,11,0.15);--status-warning-fg:#FBBF24;
--status-info-bg:rgba(59,130,246,0.15);--status-info-fg:#60A5FA;
--danger-surface:rgba(239,68,68,0.1);--danger-surface-hover:rgba(239,68,68,0.22);--danger-border:rgba(239,68,68,0.2);
--surface-modal:rgba(15,15,21,0.96);--surface-dropdown:rgba(20,20,26,0.95);
--surface-sheet:rgba(15,15,21,0.96);--surface-toolbar:rgba(20,20,26,0.92);
--shadow-modal:0 25px 70px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06);
--shadow-dropdown:0 12px 36px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.06);
--shadow-sheet:0 -8px 32px rgba(0,0,0,0.5);
--elev-1:0 4px 12px rgba(0,0,0,0.4);--elev-2:0 8px 24px rgba(0,0,0,0.55);--elev-3:0 16px 48px rgba(0,0,0,0.7);`;

/* Miroir du bloc [data-theme="light"] du host — statuts assombris (AA sur
 * fond clair), remplissages inversés en noir translucide, ombres douces. */
const FALLBACK_LIGHT = `
--surface-0:#F4F4F7;--surface-1:#FFFFFF;--surface-2:#ECECF1;--surface-3:#E2E2E8;
--surface-overlay:rgba(0,0,0,0.4);
--brand:#7C3AED;--brand-rgb:124,58,237;--brand-light:#8B5CF6;--brand-dark:#6630C2;
--brand-soft:rgba(124,58,237,0.1);--brand-glow:rgba(124,58,237,0.25);
--brand-accent:#DB2777;--brand-accent-rgb:219,39,119;--brand-accent-light:#EC4899;
--text-primary:#0B0B10;--text-secondary:rgba(11,11,16,0.72);--text-tertiary:rgba(11,11,16,0.55);
--text-quaternary:rgba(11,11,16,0.36);--text-disabled:rgba(11,11,16,0.24);
--cta-primary-bg:#FFFFFF;--cta-primary-bg-hover:#F1F1F5;--cta-primary-fg:#111114;--cta-primary-border:rgba(0,0,0,0.14);
--cta-secondary-bg:rgba(120,120,128,0.16);--cta-secondary-bg-hover:rgba(120,120,128,0.28);--cta-secondary-fg:#0B0B10;
--cta-ghost-bg:rgba(0,0,0,0.05);--cta-ghost-bg-hover:rgba(0,0,0,0.1);
--cta-brand-fg:#FFFFFF;
--border-subtle:rgba(0,0,0,0.08);--border-strong:rgba(0,0,0,0.16);--border-focus:rgba(124,58,237,0.85);
--fill-faint:rgba(0,0,0,0.03);--fill-subtle:rgba(0,0,0,0.04);--fill-soft:rgba(0,0,0,0.06);
--fill-medium:rgba(0,0,0,0.1);--fill-strong:rgba(0,0,0,0.22);--fill-shimmer:rgba(255,255,255,0.45);
--status-success:#059669;--status-warning:#B45309;--status-error:#DC2626;--status-info:#2563EB;
--status-success-bg:rgba(5,150,105,0.12);--status-success-fg:#047857;
--status-error-bg:rgba(220,38,38,0.12);--status-error-fg:#B91C1C;
--status-warning-bg:rgba(180,83,9,0.12);--status-warning-fg:#B45309;
--status-info-bg:rgba(37,99,235,0.12);--status-info-fg:#1D4ED8;
--danger-surface:rgba(220,38,38,0.08);--danger-surface-hover:rgba(220,38,38,0.18);--danger-border:rgba(220,38,38,0.18);
--surface-modal:rgba(255,255,255,0.96);--surface-dropdown:rgba(255,255,255,0.95);
--surface-sheet:rgba(255,255,255,0.96);--surface-toolbar:rgba(255,255,255,0.92);
--shadow-modal:0 24px 64px rgba(11,11,16,0.18),0 0 0 1px rgba(0,0,0,0.08);
--shadow-dropdown:0 12px 32px rgba(11,11,16,0.14),0 0 0 1px rgba(0,0,0,0.06);
--shadow-sheet:0 -8px 32px rgba(11,11,16,0.12);
--elev-1:0 1px 2px rgba(11,11,16,0.06),0 1px 3px rgba(11,11,16,0.08);
--elev-2:0 4px 12px rgba(11,11,16,0.08),0 1px 3px rgba(11,11,16,0.06);
--elev-3:0 12px 32px rgba(11,11,16,0.12),0 2px 8px rgba(11,11,16,0.06);`;

/** Bloc `:root{…}` du fallback complet pour un schéma donné. */
export function buildFallbackTokensCss(scheme: HostScheme): string {
  return `:root{${FALLBACK_COMMON}${scheme === "light" ? FALLBACK_LIGHT : FALLBACK_DARK}}`;
}

/**
 * Tokens « posé sur média » — CONSTANTS entre schémas (texte blanc + assise
 * noire : la luminosité d'une affiche ne dépend pas du thème). Injectés si le
 * host ne les fournit pas (mobile, hosts < 1.7.1).
 */
export const SEER_CONST_CSS = `:root{
--on-media-primary:#FFFFFF;--on-media-secondary:rgba(255,255,255,0.80);
--on-media-shadow:rgba(0,0,0,0.7);--on-media-muted:rgba(255,255,255,0.30);
--scrim-media-rgb:0,0,0;}`;

/* Statuts Seer (--seer-st-<slug>-{bg,fg,solid}) — slugs kebab-case UNIQUEMENT
 * (dans une classe arbitraire Tailwind, un underscore deviendrait un espace).
 * Alias des tokens host quand la gamme existe (le host les redéclare par
 * schéma) ; littéraux par schéma pour les tons hors gamme. `rating` est posé
 * sur scrim noir constant → identique dans les deux schémas. */
const STATUS_ALIASES = `
--seer-st-processing-bg:var(--status-info-bg);--seer-st-processing-fg:var(--status-info-fg);--seer-st-processing-solid:var(--status-info);
--seer-st-approved-bg:var(--brand-soft);--seer-st-approved-solid:var(--brand);
--seer-st-available-bg:var(--status-success-bg);--seer-st-available-fg:var(--status-success-fg);--seer-st-available-solid:var(--status-success);
--seer-st-failed-bg:var(--status-error-bg);--seer-st-failed-fg:var(--status-error-fg);--seer-st-failed-solid:var(--status-error);
--seer-st-requested-bg:var(--status-warning-bg);--seer-st-requested-fg:var(--status-warning-fg);
--seer-st-partial-bg:var(--status-warning-bg);--seer-st-partial-fg:var(--status-warning-fg);
--seer-st-deleted-bg:var(--fill-soft);--seer-st-deleted-fg:var(--text-tertiary);--seer-st-deleted-solid:var(--fill-strong);
--seer-st-rating-fg:#FBBF24;--seer-st-rating-solid:#F59E0B;`;

const STATUS_DARK = `
--seer-st-approved-fg:var(--brand-light);
--seer-st-queued-bg:rgba(234,179,8,0.20);--seer-st-queued-fg:#FACC15;--seer-st-queued-solid:#EAB308;
--seer-st-downloading-bg:rgba(249,115,22,0.20);--seer-st-downloading-fg:#FB923C;--seer-st-downloading-solid:#F97316;
--seer-st-retry-bg:rgba(249,115,22,0.20);--seer-st-retry-fg:#FDBA74;--seer-st-retry-solid:#FB923C;
--seer-st-deleting-bg:rgba(234,88,12,0.20);--seer-st-deleting-fg:#FB923C;--seer-st-deleting-solid:#F97316;
--seer-st-requested-solid:#F59E0B;--seer-st-partial-solid:#FBBF24;`;

/* En clair, l'accent lisible est la gamme foncée (600-700). */
const STATUS_LIGHT = `
--seer-st-approved-fg:var(--brand-dark);
--seer-st-queued-bg:rgba(161,98,7,0.12);--seer-st-queued-fg:#A16207;--seer-st-queued-solid:#CA8A04;
--seer-st-downloading-bg:rgba(194,65,12,0.12);--seer-st-downloading-fg:#C2410C;--seer-st-downloading-solid:#EA580C;
--seer-st-retry-bg:rgba(194,65,12,0.12);--seer-st-retry-fg:#C2410C;--seer-st-retry-solid:#EA580C;
--seer-st-deleting-bg:rgba(194,65,12,0.12);--seer-st-deleting-fg:#C2410C;--seer-st-deleting-solid:#EA580C;
--seer-st-requested-solid:#D97706;--seer-st-partial-solid:#D97706;`;

/** Bloc `:root{…}` des tokens de statut Seer pour un schéma donné. */
export function buildSeerStatusCss(scheme: HostScheme): string {
  return `:root{${STATUS_ALIASES}${scheme === "light" ? STATUS_LIGHT : STATUS_DARK}}`;
}
