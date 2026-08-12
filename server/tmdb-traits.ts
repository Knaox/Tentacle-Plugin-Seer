/* ------------------------------------------------------------------ */
/*  Seer Plugin — Traits d'une fiche : est-ce un animé ?               */
/* ------------------------------------------------------------------ */

/*
 * Quatre définitions de « animé » coexistaient dans le plugin, de la plus
 * laxiste à la plus juste. Celle-ci reprend la définition de la fiche
 * détaillée, la seule qui tienne : le mot-clé TMDB fait foi, et à défaut
 * l'animation japonaise ou coréenne.
 *
 * Le genre Animation seul ne suffit PAS. Il dirait « animé » de Pixar, de
 * Disney et des Simpson — sur une page qui sert justement à distinguer les
 * deux, l'erreur serait constante.
 *
 * Le calcul se fait à l'ÉCRITURE de la fiche et son résultat est rangé en
 * base. Le calendrier ne peut pas le dériver au vol : les mots-clés ne sont
 * pas dans la mémoire des fiches, et aller les chercher ferait un appel par
 * titre — précisément le N+1 supprimé ailleurs. Stocker le verdict plutôt que
 * la formule permet aussi d'en changer d'avis : un cycle du worker recalcule
 * tout.
 */

const KEYWORD_ANIME = 210024;
const GENRE_ANIMATION = 16;
const ORIGINES = new Set(["JP", "KR"]);
const LANGUES = new Set(["ja", "ko"]);

export interface AnimeTraitRaw {
  keywords?: unknown;
  genres?: Array<{ id?: number }>;
  genreIds?: number[];
  originalLanguage?: string;
  originCountry?: string[];
}

/**
 * Les mots-clés, quelle que soit la forme reçue.
 *
 * La fiche détaillée les rend à plat, la recherche les enveloppe dans
 * `results`. Accepter les deux coûte trois lignes et évite un verdict
 * silencieusement toujours faux si la forme change.
 */
function lireMotsCles(brut: unknown): Array<{ id?: number }> {
  if (Array.isArray(brut)) return brut as Array<{ id?: number }>;
  const enveloppe = brut as { results?: unknown } | null;
  return Array.isArray(enveloppe?.results) ? (enveloppe.results as Array<{ id?: number }>) : [];
}

function lireGenres(raw: AnimeTraitRaw): number[] {
  if (Array.isArray(raw.genreIds)) return raw.genreIds;
  return (raw.genres ?? []).map((g) => g?.id).filter((id): id is number => typeof id === "number");
}

export function detectAnime(raw: AnimeTraitRaw): boolean {
  if (lireMotsCles(raw.keywords).some((k) => k?.id === KEYWORD_ANIME)) return true;

  const asiatique =
    LANGUES.has(raw.originalLanguage ?? "") ||
    (raw.originCountry ?? []).some((c) => ORIGINES.has((c ?? "").toUpperCase()));

  return asiatique && lireGenres(raw).includes(GENRE_ANIMATION);
}
