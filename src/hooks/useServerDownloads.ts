import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getServerDownloads } from "../api/client-releases";

/**
 * La file de téléchargement du serveur, rafraîchie tant qu'on la regarde.
 *
 * Mêmes garde-fous que le suivi des demandes : rien n'est demandé quand
 * l'onglet passe en arrière-plan, et la cadence se relâche à une minute quand
 * la file est vide — inutile de marteler Sonarr pour confirmer qu'il ne se
 * passe rien.
 */
export function useServerDownloads(active: boolean) {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  const enabled = active && visible;

  return useQuery({
    queryKey: ["seer-server-downloads"],
    queryFn: getServerDownloads,
    enabled,
    staleTime: 8_000,
    gcTime: 60_000,
    refetchIntervalInBackground: false,
    refetchInterval: (q) =>
      enabled ? ((q.state.data?.items.length ?? 0) > 0 ? 12_000 : 60_000) : false,
    retry: 1,
  });
}
