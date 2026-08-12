import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateDownloads, parseTimeSpan, toDownloadProgress } from "./download-progress";

/*
 * Le cas qui motive ces tests : un téléchargement terminé mais pas encore
 * importé restait affiché « En téléchargement », avec un temps restant figé à
 * zéro, alors que Jellyseerr affichait déjà autre chose de son côté.
 */

const item = (over: Record<string, unknown> = {}) => ({
  size: 1000, sizeLeft: 400, status: "downloading", ...over,
});

test("téléchargement en cours — rien à valider", () => {
  const p = toDownloadProgress(item());
  assert.equal(p?.validating, false);
  assert.equal(p?.percent, 60);
});

test("fichier complet — validation en cours", () => {
  assert.equal(toDownloadProgress(item({ sizeLeft: 0 }))?.validating, true);
});

test("statut « completed » — validation, même sans taille exploitable", () => {
  assert.equal(toDownloadProgress(item({ size: 0, sizeLeft: null, status: "completed" }))?.validating, true);
});

test("import annoncé par *arr — validation", () => {
  assert.equal(toDownloadProgress(item({ status: "importPending" }))?.validating, true);
  assert.equal(toDownloadProgress(item({ status: "importing" }))?.validating, true);
});

test("taille inconnue — on ne conclut pas à la validation", () => {
  const p = toDownloadProgress(item({ size: 0, sizeLeft: null }));
  assert.equal(p?.validating, false);
  assert.equal(p?.percent, null);
});

test("un seul épisode encore en cours suffit à dire que ça télécharge", () => {
  const { summary } = aggregateDownloads([
    item({ sizeLeft: 0, episode: { seasonNumber: 1, episodeNumber: 1 } }),
    item({ sizeLeft: 500, episode: { seasonNumber: 1, episodeNumber: 2 } }),
  ]);
  assert.equal(summary?.validating, false);
});

test("tous les épisodes complets — la demande entière est en validation", () => {
  const { summary, items } = aggregateDownloads([
    item({ sizeLeft: 0, episode: { seasonNumber: 1, episodeNumber: 1 } }),
    item({ sizeLeft: 0, status: "completed", episode: { seasonNumber: 1, episodeNumber: 2 } }),
  ]);
  assert.equal(summary?.validating, true);
  assert.equal(items.length, 2);
});

test("TimeSpan .NET — les jours sont séparés par un POINT, pas par deux-points", () => {
  assert.equal(parseTimeSpan("00:12:34"), 12 * 60 + 34);
  assert.equal(parseTimeSpan("1.02:03:04"), 26 * 3600 + 3 * 60 + 4);
  assert.equal(parseTimeSpan(undefined), null);
});
