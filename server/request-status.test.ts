import { test } from "node:test";
import assert from "node:assert/strict";
import { allRequestedSeasonsAvailable, resolveRequestStatus, type StatusRow } from "./request-status";

/* Jellyseerr : request.status 2 = APPROVED ; media.status 4 = PARTIALLY, 5 = AVAILABLE. */
const serie = (
  requested: number[],
  seasons: Array<[number, number]>,
  mediaStatus = 4,
): StatusRow => ({
  status: 2,
  seasons: requested.map((seasonNumber) => ({ seasonNumber })),
  media: {
    status: mediaStatus,
    seasons: seasons.map(([seasonNumber, status]) => ({ seasonNumber, status })),
  },
});

test("LE cas : deux saisons demandées, deux saisons là → Disponible", () => {
  // La série, elle, reste « partiellement disponible » — il lui manque la 3.
  // Ce n'est pas la question posée : la demande ne portait que sur 1 et 2.
  const row = serie([1, 2], [[1, 5], [2, 5], [3, 4]]);
  assert.equal(resolveRequestStatus(row), "available");
});

test("une seule des deux saisons arrivée reste partielle", () => {
  const row = serie([1, 2], [[1, 5], [2, 3]]);
  assert.equal(resolveRequestStatus(row), "partially_available");
});

test("sans granularité par-saison, on garde le statut de la série", () => {
  // Jellyseerr n'a pas encore réconcilié : rien ne prouve que quoi que ce soit
  // soit disponible. Promettre « Disponible » ici serait inventer.
  const row: StatusRow = { status: 2, seasons: [{ seasonNumber: 1 }], media: { status: 4 } };
  assert.equal(resolveRequestStatus(row), "partially_available");
});

test("une série demandée en bloc garde le statut du média", () => {
  const row: StatusRow = { status: 2, media: { status: 4, seasons: [{ seasonNumber: 1, status: 5 }] } };
  assert.equal(resolveRequestStatus(row), "partially_available");
});

test("la saison zéro compte comme les autres", () => {
  // Les épisodes spéciaux se demandent : les exclure du décompte rendrait
  // « Disponible » une demande dont il manque précisément ce qu'on visait.
  assert.equal(resolveRequestStatus(serie([0, 1], [[0, 4], [1, 5]])), "partially_available");
  assert.equal(resolveRequestStatus(serie([0, 1], [[0, 5], [1, 5]])), "available");
});

test("un film n'est jamais concerné", () => {
  const film: StatusRow = { status: 2, media: { status: 4 } };
  assert.equal(allRequestedSeasonsAvailable(film), false);
  assert.equal(resolveRequestStatus(film), "partially_available");
});

test("un téléchargement en cours reste un téléchargement en cours", () => {
  // media.status 3 = PROCESSING : la règle par-saison ne s'applique qu'au
  // désaccord « demande satisfaite / série incomplète ».
  const row: StatusRow = {
    status: 2,
    seasons: [{ seasonNumber: 1 }],
    media: {
      status: 3,
      seasons: [{ seasonNumber: 1, status: 5 }],
      downloadStatus: [{ status: "downloading" }],
    },
  };
  assert.equal(resolveRequestStatus(row), "downloading");
});

test("l'épingle « Disponible » posée à la main survit à un média perdu", () => {
  // media.status 1 = UNKNOWN → « Marquer comme disponible » l'emporte.
  const row: StatusRow = { status: 2, media: { status: 1 } };
  assert.equal(resolveRequestStatus(row, { status: "available" }), "available");
  assert.equal(resolveRequestStatus(row), "unavailable");
});

test("un état plus actif reprend la main sur l'épingle", () => {
  const row: StatusRow = {
    status: 2,
    media: { status: 3, downloadStatus: [{ status: "downloading" }] },
  };
  assert.equal(resolveRequestStatus(row, { status: "available" }), "downloading");
});
