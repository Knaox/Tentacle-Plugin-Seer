import { useMemo } from "react";
import { useCalendarProviders } from "./useReleases";
import type { CalendarProvider } from "../api/types-releases";

/**
 * Table identifiant → plateforme (nom + logo).
 *
 * Les médias ne portent que des identifiants numériques ; le nom et le logo
 * vivent dans un catalogue à part, mis en cache une journée puisqu'il ne bouge
 * pratiquement jamais. Une seule requête sert toute la session, quelle que soit
 * la page.
 */
export function useProviderCatalog(): Map<number, CalendarProvider> {
  const { data } = useCalendarProviders();

  return useMemo(() => {
    const map = new Map<number, CalendarProvider>();
    for (const p of data?.results ?? []) map.set(p.id, p);
    return map;
  }, [data]);
}

const TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w45";

export function providerLogoUrl(logoPath: string | null | undefined): string | null {
  return logoPath ? `${TMDB_LOGO_BASE}${logoPath}` : null;
}

/**
 * Initiales de repli quand le logo manque : « Prime Video » → « PV ».
 * Mieux vaut deux lettres qu'un carré vide.
 */
export function providerInitials(name: string): string {
  return name
    .split(/[\s+]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
