import { useQuery } from "@tanstack/react-query";
import { backendFetch } from "../api/seer-client";

/**
 * L'utilisateur est-il administrateur du serveur ?
 *
 * Le plugin n'avait aucun moyen de le savoir : `GET /config` renvoyait
 * simplement moins de champs aux non-admins. Il expose désormais le drapeau,
 * ce qui permet de ne PROPOSER les vues d'administration qu'à ceux qui y ont
 * droit — la vraie barrière restant côté serveur, sur chaque route.
 *
 * Le statut ne change pas en cours de session : une seule requête suffit.
 */
export function useIsAdmin(): boolean {
  const { data } = useQuery({
    queryKey: ["seer-is-admin"],
    queryFn: () => backendFetch<{ isAdmin?: boolean }>("/config"),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return data?.isAdmin === true;
}
