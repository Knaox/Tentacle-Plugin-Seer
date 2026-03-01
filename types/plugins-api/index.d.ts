import type { ComponentType, LazyExoticComponent } from "react";

export interface TentaclePlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  routes: PluginRoute[];
  navItems: PluginNavItem[];
  adminRoutes?: PluginRoute[];
  adminNavItems?: PluginNavItem[];
  isConfigured: () => Promise<boolean>;
  initialize?: () => Promise<void>;
  destroy?: () => Promise<void>;
}

export interface PluginRoute {
  path: string;
  component: LazyExoticComponent<ComponentType<unknown>>;
  label: string;
  icon: string | ComponentType<{ className?: string }>;
  showInMobileNav: boolean;
  showInSidebar: boolean;
  requiresAuth: boolean;
  requiresAdmin?: boolean;
}

export type PluginPlatform = "mobile" | "web" | "desktop";

export interface PluginNavItem {
  label: string;
  path: string;
  icon: string | ComponentType<{ className?: string }>;
  badge?: () => number | null;
  platforms: PluginPlatform[];
}
