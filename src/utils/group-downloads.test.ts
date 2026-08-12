import { test } from "node:test";
import assert from "node:assert/strict";
import type { DownloadProgress } from "../api/types-releases";
import { groupBySeason } from "./group-downloads";

const ep = (season: number | null, episode: number, over: Partial<DownloadProgress> = {}): DownloadProgress => ({
  percent: 50, size: 1000, sizeLeft: 500, etaSeconds: null, estimatedCompletionAt: null,
  status: "downloading", validating: false, title: null,
  seasonNumber: season, episodeNumber: episode, ...over,
});

test("les épisodes se rangent par saison, dans l'ordre", () => {
  const groups = groupBySeason([ep(2, 1), ep(1, 3), ep(1, 1)]);
  assert.deepEqual(groups.map((g) => g.seasonNumber), [1, 2]);
  assert.deepEqual(groups[0].episodes.map((e) => e.episodeNumber), [1, 3]);
});

test("saison demandée dont rien n'est descendu — en attente, pas oubliée", () => {
  // Le cas décrit : on demande S1 et S2, seuls des épisodes de S1 arrivent.
  const groups = groupBySeason([ep(1, 1), ep(1, 2)], [1, 2]);
  assert.deepEqual(groups.map((g) => g.seasonNumber), [1, 2]);
  assert.equal(groups[0].waiting, false);
  assert.equal(groups[1].waiting, true);
  assert.equal(groups[1].percent, null);
});

test("avancement d'une saison — pondéré par la taille", () => {
  const groups = groupBySeason([
    ep(1, 1, { size: 1000, sizeLeft: 0 }),
    ep(1, 2, { size: 1000, sizeLeft: 1000 }),
  ]);
  assert.equal(groups[0].percent, 50);
});

test("saison entièrement téléchargée — en validation", () => {
  const groups = groupBySeason([
    ep(1, 1, { validating: true }),
    ep(1, 2, { validating: true }),
  ]);
  assert.equal(groups[0].validating, true);
});

test("un épisode encore en cours — la saison n'est pas en validation", () => {
  const groups = groupBySeason([ep(1, 1, { validating: true }), ep(1, 2)]);
  assert.equal(groups[0].validating, false);
});

test("épisodes sans saison — relégués en fin de liste", () => {
  const groups = groupBySeason([ep(null, 1), ep(3, 1)]);
  assert.deepEqual(groups.map((g) => g.seasonNumber), [3, null]);
});

test("aucun téléchargement et aucune saison demandée — rien à afficher", () => {
  assert.deepEqual(groupBySeason([], null), []);
  assert.deepEqual(groupBySeason(undefined), []);
});

test("tailles inconnues — aucun pourcentage inventé", () => {
  const groups = groupBySeason([ep(1, 1, { size: null, sizeLeft: null, percent: null })]);
  assert.equal(groups[0].percent, null);
  assert.equal(groups[0].waiting, false);
});
