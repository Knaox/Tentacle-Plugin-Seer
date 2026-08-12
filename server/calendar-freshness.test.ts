import { test } from "node:test";
import assert from "node:assert/strict";
import { isDateless, needsDateRefresh, needsTraitsRefresh, type DatedMeta } from "./calendar-freshness";

/*
 * La propriété qui règle « Toutes les demandes » : une fiche amorcée — titre
 * seul, périmée d'emblée — doit être redemandée, alors qu'une fiche récupérée
 * dont TMDB ignore la date ne doit PAS l'être. Les confondre donnait soit un
 * calendrier muet, soit une boucle de rechargement à chaque ouverture.
 */

const NOW = Date.parse("2026-08-12T12:00:00.000Z");
const inFuture = new Date(NOW + 86_400_000).toISOString();
const inPast = new Date(NOW - 86_400_000).toISOString();

const meta = (over: Partial<DatedMeta> = {}): DatedMeta => ({
  releaseDate: null,
  digitalDate: null,
  theatricalDate: null,
  physicalDate: null,
  nextAirDate: null,
  expiresAt: inFuture,
  ...over,
});

test("une fiche sans la moindre date est sans date", () => {
  assert.equal(isDateless(meta()), true);
});

test("n'importe quelle date suffit à rendre la fiche exploitable", () => {
  for (const champ of ["releaseDate", "digitalDate", "theatricalDate", "physicalDate", "nextAirDate"] as const) {
    assert.equal(isDateless(meta({ [champ]: "2026-09-01" })), false, champ);
  }
});

test("LA propriété : la fiche amorcée est redemandée, la fiche récupérée non", () => {
  // Amorçage : aucune date, péremption à l'instant même.
  assert.equal(needsDateRefresh(meta({ expiresAt: inPast }), NOW), true);
  // Récupérée : TMDB n'annonce simplement aucune date. On n'y reviendra pas.
  assert.equal(needsDateRefresh(meta({ expiresAt: inFuture }), NOW), false);
});

test("une fiche datée n'est jamais à recharger pour cette raison", () => {
  // Même périmée : le rafraîchissement du TTL a son propre chemin.
  assert.equal(needsDateRefresh(meta({ releaseDate: "2026-09-01", expiresAt: inPast }), NOW), false);
});

test("une péremption illisible vaut jamais récupérée", () => {
  assert.equal(needsDateRefresh(meta({ expiresAt: "" }), NOW), true);
  assert.equal(needsDateRefresh(meta({ expiresAt: "pas une date" }), NOW), true);
});

test("la péremption pile à l'instant compte comme dépassée", () => {
  assert.equal(needsDateRefresh(meta({ expiresAt: new Date(NOW).toISOString() }), NOW), true);
});

test("les fiches antérieures aux colonnes de tri se reconnaissent à leur langue absente", () => {
  // TMDB donne toujours une langue d'origine et Jellyseerr la relaie : son
  // absence ne peut vouloir dire qu'une chose, la fiche est plus ancienne.
  assert.equal(needsTraitsRefresh({}), true);
  assert.equal(needsTraitsRefresh({ originalLanguage: null }), true);
  assert.equal(needsTraitsRefresh({ originalLanguage: "ja" }), false);
});
