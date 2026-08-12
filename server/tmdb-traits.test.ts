import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAnime } from "./tmdb-traits";

/*
 * L'erreur à ne pas commettre : prendre le genre Animation pour la définition
 * d'un animé. Sur un filtre qui sert justement à séparer les deux, ranger
 * Pixar et les Simpson avec les productions japonaises rendrait le tri inutile.
 */

test("le mot-clé TMDB fait foi, quels que soient le genre et l'origine", () => {
  assert.equal(detectAnime({ keywords: [{ id: 210024 }] }), true);
  assert.equal(
    detectAnime({ keywords: [{ id: 210024 }], originalLanguage: "en", genreIds: [28] }),
    true,
  );
});

test("les mots-clés sont acceptés à plat comme enveloppés", () => {
  assert.equal(detectAnime({ keywords: { results: [{ id: 210024 }] } }), true);
});

test("LA propriété : animation seule ne suffit pas", () => {
  // Pixar, Disney, les Simpson — animation, mais pas des animés.
  assert.equal(detectAnime({ genreIds: [16], originalLanguage: "en", originCountry: ["US"] }), false);
});

test("animation ET origine asiatique suffisent, sans mot-clé", () => {
  assert.equal(detectAnime({ genreIds: [16], originalLanguage: "ja" }), true);
  assert.equal(detectAnime({ genreIds: [16], originCountry: ["KR"] }), true);
  assert.equal(detectAnime({ genres: [{ id: 16 }], originCountry: ["jp"] }), true);
});

test("origine asiatique sans animation n'en fait pas un animé", () => {
  // Un film japonais en prises de vues réelles reste un film.
  assert.equal(detectAnime({ genreIds: [18], originalLanguage: "ja" }), false);
});

test("une fiche sans le moindre indice ne déclenche rien", () => {
  assert.equal(detectAnime({}), false);
  assert.equal(detectAnime({ keywords: null, genres: undefined }), false);
});
