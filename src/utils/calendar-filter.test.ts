import { test } from "node:test";
import assert from "node:assert/strict";
import type { CalendarItem } from "../api/types-releases";
import {
  DEFAULT_RELEASES_FILTERS, matchesReleaseFilters, sortReleases,
  activeReleasesFilterCount, type ReleasesFilterState,
} from "./calendar-filter";

/*
 * Deux invariants, et ce sont eux qui empêchent les régressions muettes :
 * un critère inconnu n'exclut pas, et le tri ne franchit jamais une date.
 */

const item = (over: Partial<CalendarItem> = {}): CalendarItem => ({
  id: "movie:1:premiere:2026-09-01",
  date: "2026-09-01",
  mediaType: "movie",
  tmdbId: 1,
  title: "Titre",
  posterPath: null,
  backdropPath: null,
  overview: null,
  kind: "premiere",
  seasonNumber: null,
  episodeNumber: null,
  networks: null,
  providerIds: [],
  requestId: null,
  requestStatus: null,
  ...over,
});

const filtres = (over: Partial<ReleasesFilterState> = {}): ReleasesFilterState =>
  ({ ...DEFAULT_RELEASES_FILTERS, ...over });

test("sans filtre, tout passe", () => {
  assert.equal(matchesReleaseFilters(item(), filtres()), true);
});

test("LA propriété : une note inconnue n'est jamais exclue", () => {
  // Les fiches enregistrées avant que le serveur ne retienne la note n'en ont
  // pas. Les écarter viderait l'agenda le temps que le worker repasse tout.
  assert.equal(matchesReleaseFilters(item({ voteAverage: undefined }), filtres({ ratingMin: 8 })), true);
  assert.equal(matchesReleaseFilters(item({ voteAverage: null }), filtres({ ratingMin: 8 })), true);
});

test("une note connue et trop basse est écartée", () => {
  assert.equal(matchesReleaseFilters(item({ voteAverage: 6.4 }), filtres({ ratingMin: 8 })), false);
  assert.equal(matchesReleaseFilters(item({ voteAverage: 8 }), filtres({ ratingMin: 8 })), true);
});

test("une langue inconnue n'est jamais exclue", () => {
  assert.equal(matchesReleaseFilters(item(), filtres({ originalLanguage: "ja" })), true);
  assert.equal(
    matchesReleaseFilters(item({ originalLanguage: "en" }), filtres({ originalLanguage: "ja" })),
    false,
  );
});

test("le type Animés se lit sur la fiche, pas sur le type de média", () => {
  // Verdict strict assumé : le serveur pose désormais `isAnime` sur TOUTES les
  // entrées (repli langue + genre pour les fiches froides) — une absence
  // signifie « non », plus « pas encore évalué ».
  const serie = item({ mediaType: "tv" });
  const anime = item({ mediaType: "tv", isAnime: true });
  assert.equal(matchesReleaseFilters(serie, filtres({ mediaFilter: "anime" })), false);
  assert.equal(matchesReleaseFilters(anime, filtres({ mediaFilter: "anime" })), true);
  // Un animé reste une série quand on demande les séries.
  assert.equal(matchesReleaseFilters(anime, filtres({ mediaFilter: "tv" })), true);
});

test("un film d'animation passe le filtre Animés", () => {
  // L'ancien détour serveur (« anime » → mediaType=tv) les excluait d'office.
  const filmAnime = item({ mediaType: "movie", isAnime: true });
  assert.equal(matchesReleaseFilters(filmAnime, filtres({ mediaFilter: "anime" })), true);
  // Et il reste un film quand on demande les films.
  assert.equal(matchesReleaseFilters(filmAnime, filtres({ mediaFilter: "movie" })), true);
});

test("les plateformes sont un OU", () => {
  const sur = item({ providerIds: [8, 337] });
  assert.equal(matchesReleaseFilters(sur, filtres({ providerIds: [337] })), true);
  assert.equal(matchesReleaseFilters(sur, filtres({ providerIds: [119] })), false);
});

test("« seulement les demandes » écarte ce qui n'a pas été demandé", () => {
  assert.equal(matchesReleaseFilters(item(), filtres({ requestedOnly: true })), false);
  assert.equal(
    matchesReleaseFilters(item({ requestStatus: "processing" }), filtres({ requestedOnly: true })),
    true,
  );
});

test("LA propriété : le tri ne réordonne JAMAIS entre deux dates", () => {
  // L'invariant de l'agenda. Sans lui, le 3 septembre passerait avant le 12 août.
  const liste = [
    item({ id: "a", date: "2026-09-03", title: "Zèbre", voteAverage: 9 }),
    item({ id: "b", date: "2026-08-12", title: "Abeille", voteAverage: 2 }),
  ];
  for (const tri of ["date", "rating", "popularity", "title"] as const) {
    assert.deepEqual(sortReleases(liste, tri).map((i) => i.date), ["2026-08-12", "2026-09-03"], tri);
  }
});

test("à date égale, le critère choisi départage", () => {
  const liste = [
    item({ id: "a", title: "Abeille", voteAverage: 4, popularity: 1 }),
    item({ id: "b", title: "Zèbre", voteAverage: 9, popularity: 99 }),
  ];
  assert.deepEqual(sortReleases(liste, "rating").map((i) => i.id), ["b", "a"]);
  assert.deepEqual(sortReleases(liste, "popularity").map((i) => i.id), ["b", "a"]);
  assert.deepEqual(sortReleases(liste, "title").map((i) => i.id), ["a", "b"]);
});

test("une note absente ne passe pas devant une note connue", () => {
  const liste = [item({ id: "sans" }), item({ id: "avec", voteAverage: 5 })];
  assert.deepEqual(sortReleases(liste, "rating").map((i) => i.id), ["avec", "sans"]);
});

test("le tri NE MUTE PAS son entrée", () => {
  // Muter reviendrait à réécrire l'objet du cache de requêtes : revenir au tri
  // par titre ne restaurerait plus rien.
  const liste = [item({ id: "a", title: "Zèbre" }), item({ id: "b", title: "Abeille" })];
  const avant = liste.map((i) => i.id);
  sortReleases(liste, "title");
  assert.deepEqual(liste.map((i) => i.id), avant);
});

test("le décompte des filtres actifs couvre chaque critère", () => {
  assert.equal(activeReleasesFilterCount(filtres()), 0);
  assert.equal(activeReleasesFilterCount(filtres({ ratingMin: 7 })), 1);
  assert.equal(
    activeReleasesFilterCount(filtres({
      ratingMin: 7, originalLanguage: "ja", mediaFilter: "anime",
      providerIds: [8], requestedOnly: true,
    })),
    5,
  );
  // Le tri n'est pas un filtre : il ne cache rien.
  assert.equal(activeReleasesFilterCount(filtres({ sortBy: "rating" })), 0);
});
