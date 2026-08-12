import { test } from "node:test";
import assert from "node:assert/strict";
import type { AvailabilityRef } from "./availability-chunks";
import { CHUNK_SIZE, availabilityChunks } from "./availability-chunks";

/*
 * La propriété qui règle le clignotement des pastilles : quand le catalogue
 * charge une page de plus, les tranches DÉJÀ constituées doivent garder une
 * clé identique. Sinon leur entrée de cache repart à zéro et la grille se
 * retrouve sans aucune pastille le temps de l'aller-retour.
 */

const refs = (n: number, from = 0): AvailabilityRef[] =>
  Array.from({ length: n }, (_, i) => ({ mediaType: "movie" as const, tmdbId: from + i + 1 }));

test("une liste vide ne produit aucune tranche", () => {
  assert.deepEqual(availabilityChunks([]), []);
});

test("une liste plus courte qu'une tranche tient en une seule", () => {
  const chunks = availabilityChunks(refs(20));
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].index, 0);
  assert.equal(chunks[0].refs.length, 20);
});

test("la liste est découpée à taille fixe", () => {
  const chunks = availabilityChunks(refs(CHUNK_SIZE * 2 + 5));
  assert.deepEqual(chunks.map((c) => c.refs.length), [CHUNK_SIZE, CHUNK_SIZE, 5]);
  assert.deepEqual(chunks.map((c) => c.index), [0, 1, 2]);
});

test("LA propriété : allonger la liste ne change aucune tranche existante", () => {
  const avant = availabilityChunks(refs(CHUNK_SIZE * 2));
  // Une page de plus arrive, comme au défilement.
  const apres = availabilityChunks(refs(CHUNK_SIZE * 2 + 20));

  assert.equal(apres.length, avant.length + 1);
  for (let i = 0; i < avant.length; i++) {
    assert.equal(apres[i].key, avant[i].key, `tranche ${i} modifiée`);
    assert.equal(apres[i].index, avant[i].index);
  }
});

test("aucune tranche ne dépasse ce que le serveur accepte", () => {
  // Le serveur écarte silencieusement au-delà de son plafond : c'est ainsi que
  // les titres de fin de liste perdaient leur pastille.
  for (const c of availabilityChunks(refs(500))) {
    assert.ok(c.refs.length <= CHUNK_SIZE);
  }
});

test("deux tranches de même rang mais de contenu différent ont des clés différentes", () => {
  const a = availabilityChunks(refs(10))[0];
  const b = availabilityChunks(refs(10, 100))[0];
  assert.equal(a.index, b.index);
  assert.notEqual(a.key, b.key);
});

test("le type de média entre dans la clé", () => {
  const movie = availabilityChunks([{ mediaType: "movie", tmdbId: 42 }])[0];
  const tv = availabilityChunks([{ mediaType: "tv", tmdbId: 42 }])[0];
  assert.notEqual(movie.key, tv.key);
});
