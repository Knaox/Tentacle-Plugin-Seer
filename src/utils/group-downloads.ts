import type { DownloadProgress } from "../api/types-releases";

/**
 * Le détail d'une demande de série, regroupé par saison.
 *
 * La file *arr raisonne par ÉPISODE : demander deux saisons produit vingt
 * lignes sans hiérarchie, dont on ne tirait jusqu'ici qu'un compteur
 * (« 12 épisodes en cours »). Regrouper redonne la seule lecture qui compte —
 * « où en est la saison 1, et la 2 a-t-elle commencé ? ».
 *
 * Les saisons DEMANDÉES dont rien n'est encore descendu sont listées elles
 * aussi : sans elles, demander S1 et S2 puis ne voir que S1 laisse croire que
 * la seconde a été oubliée.
 */

export interface SeasonProgress {
  /** null = film, ou épisode dont la file ne donne pas la saison. */
  seasonNumber: number | null;
  /** Triés par numéro d'épisode croissant — la source les trie par avancement. */
  episodes: DownloadProgress[];
  /** Pondéré par la taille, comme le résumé. null si aucune taille connue. */
  percent: number | null;
  /** Aucun épisode dans la file : la saison est demandée, rien n'a commencé. */
  waiting: boolean;
  /** Tous les fichiers sont là, il reste à les ranger. */
  validating: boolean;
}

function aggregatePercent(episodes: readonly DownloadProgress[]): number | null {
  let size = 0;
  let left = 0;
  let sized = 0;
  for (const e of episodes) {
    if (e.size != null && e.sizeLeft != null) {
      size += e.size;
      left += e.sizeLeft;
      sized++;
    }
  }
  if (sized === 0 || size === 0) return null;
  return Math.min(100, Math.max(0, ((size - left) / size) * 100));
}

export function groupBySeason(
  items: readonly DownloadProgress[] | undefined,
  requestedSeasons?: readonly number[] | null,
): SeasonProgress[] {
  const bySeason = new Map<number | null, DownloadProgress[]>();
  for (const item of items ?? []) {
    const key = item.seasonNumber ?? null;
    const bucket = bySeason.get(key);
    if (bucket) bucket.push(item);
    else bySeason.set(key, [item]);
  }

  /* Une saison demandée sans aucune ligne dans la file mérite d'exister à
   * l'écran : c'est la différence entre « en attente » et « oubliée ». */
  for (const season of requestedSeasons ?? []) {
    if (!bySeason.has(season)) bySeason.set(season, []);
  }

  const groups: SeasonProgress[] = [];
  for (const [seasonNumber, episodes] of bySeason) {
    const sorted = episodes
      .slice()
      .sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0));
    groups.push({
      seasonNumber,
      episodes: sorted,
      percent: aggregatePercent(sorted),
      waiting: sorted.length === 0,
      validating: sorted.length > 0 && sorted.every((e) => e.validating),
    });
  }

  /* Les saisons dans l'ordre, et les épisodes sans saison à la fin : ils ne
   * concernent qu'un film ou une file mal renseignée. */
  return groups.sort((a, b) => {
    if (a.seasonNumber == null) return 1;
    if (b.seasonNumber == null) return -1;
    return a.seasonNumber - b.seasonNumber;
  });
}
