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
 *
 * La table, elle, est PARTAGÉE. Chaque carte de la grille appelle ce hook, et
 * chacune s'en construisait une copie : cent cartes affichées faisaient cent
 * tables d'environ cent cinquante plateformes, soit quinze mille entrées en
 * mémoire pour une donnée strictement identique partout. On la dérive donc une
 * fois par réponse, dans une table faible — libérée d'elle-même quand la
 * réponse est collectée.
 */
const DERIVED = new WeakMap<object, Map<number, CalendarProvider>>();
const EMPTY: Map<number, CalendarProvider> = new Map();

export function useProviderCatalog(): Map<number, CalendarProvider> {
  const { data } = useCalendarProviders();

  return useMemo(() => {
    if (!data) return EMPTY;
    const cached = DERIVED.get(data);
    if (cached) return cached;

    const map = new Map<number, CalendarProvider>();
    for (const p of data.results ?? []) map.set(p.id, p);
    DERIVED.set(data, map);
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
