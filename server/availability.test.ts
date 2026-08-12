import { test } from "node:test";
import assert from "node:assert/strict";
import type { TmdbMeta } from "./tmdb-cache";
import { classifyAvailability } from "./availability";

/*
 * Les cas viennent tous du catalogue réel d'une instance, relevés le
 * 2026-08-12 — d'où la date figée ci-dessous. Ce sont eux qui ont motivé la
 * refonte : sept films étaient à la fois en salle et déjà sortis en vidéo, et
 * n'affichaient donc RIEN, faute d'un verdict capable de dire deux choses.
 *
 * Ces tests tournent sur le runner intégré de Node (`node --test`), qui lit le
 * TypeScript sans transpilation : aucune dépendance de test à installer, alors
 * que le serveur du plugin n'a par ailleurs aucune vérification de types.
 */

const TODAY = "2026-08-12";

function meta(over: Partial<TmdbMeta>): TmdbMeta {
  return {
    mediaType: "movie", tmdbId: 1, title: "T",
    posterPath: null, backdropPath: null, overview: null,
    releaseDate: null, tmdbStatus: null,
    digitalDate: null, theatricalDate: null, physicalDate: null, releaseRegion: "FR",
    nextAirDate: null, nextSeason: null, nextEpisode: null, lastAirDate: null,
    networks: null, providerIds: [], expiresAt: "",
    ...over,
  };
}

const ids = (v: { channels: Array<{ id: string }> }) => v.channels.map((c) => c.id);

test("Super Mario Galaxy — en salle ET sorti en Blu-ray le jour même", () => {
  const v = classifyAvailability(
    meta({ tmdbId: 1226863, theatricalDate: "2026-04-01", physicalDate: "2026-08-12" }),
    TODAY,
  );
  // Les deux doivent être dits, le canal le plus probant en tête.
  assert.deepEqual(ids(v), ["physical", "theatrical"]);
  assert.equal(v.outlook, "likely");
  assert.equal(v.obtainable, true);
});

test("Scream 7 — Blu-ray il y a 48 j, salle il y a 168 j", () => {
  const v = classifyAvailability(
    meta({ tmdbId: 1159559, theatricalDate: "2026-02-25", physicalDate: "2026-06-25" }),
    TODAY,
  );
  assert.deepEqual(ids(v), ["physical", "theatrical"]);
  assert.equal(v.outlook, "likely");
});

test("Vaiana — salle seule : on n'affirme pas qu'on peut l'avoir", () => {
  const v = classifyAvailability(
    meta({ tmdbId: 1108427, theatricalDate: "2026-07-08", releaseDate: "2026-07-08" }),
    TODAY,
  );
  assert.deepEqual(ids(v), ["theatrical"]);
  assert.equal(v.kind, "theatrical");
  assert.equal(v.outlook, "unlikely");
  assert.equal(v.obtainable, false);
});

test("Mayday — sortie en ligne annoncée, malgré un statut TMDB « Post Production »", () => {
  const v = classifyAvailability(
    meta({ tmdbId: 1137844, digitalDate: "2026-09-04", releaseDate: "2026-09-03", tmdbStatus: "Post Production" }),
    TODAY,
  );
  assert.deepEqual(ids(v), ["digital"]);
  assert.equal(v.kind, "digital_soon");
  assert.equal(v.outlook, "not_yet");
});

test("Avengers: Doomsday — sortie en salle encore devant nous", () => {
  const v = classifyAvailability(
    meta({ tmdbId: 1003596, theatricalDate: "2026-12-16", releaseDate: "2026-12-16" }),
    TODAY,
  );
  assert.deepEqual(ids(v), ["theatrical"]);
  assert.equal(v.channels[0].released, false);
  assert.equal(v.outlook, "not_yet");
});

test("Fight Club — vieux titre : récupérable, mais on n'en dit rien", () => {
  const v = classifyAvailability(
    meta({
      tmdbId: 550, theatricalDate: "1999-11-10", digitalDate: "2011-09-08",
      physicalDate: "2000-11-15", providerIds: [8, 337, 381],
    }),
    TODAY,
  );
  // Annoncer « En Blu-ray » sur un film de 1999 noierait la grille.
  assert.deepEqual(ids(v), []);
  assert.equal(v.outlook, "likely");
  assert.equal(v.obtainable, true);
  assert.deepEqual(v.providerIds, [8, 337, 381]);
});

test("aucune date typée — on se tait et on laisse demander", () => {
  const v = classifyAvailability(meta({ releaseDate: "2011-03-04" }), TODAY);
  assert.deepEqual(ids(v), []);
  assert.equal(v.kind, "released");
  assert.equal(v.outlook, "likely");
});

test("ressortie en salle d'un vieux film — le Blu-ray ancien prime sur la salle", () => {
  const v = classifyAvailability(
    meta({ theatricalDate: "2026-07-01", physicalDate: "2010-05-05" }),
    TODAY,
  );
  // Le canal physique est trop vieux pour être mentionné...
  assert.deepEqual(ids(v), ["theatrical"]);
  // ...mais il reste la preuve qu'un fichier existe : pas de « peu de chances ».
  assert.equal(v.outlook, "likely");
  assert.equal(v.obtainable, true);
});

test("salle hors fenêtre de six mois — plus aucun signal", () => {
  const v = classifyAvailability(meta({ theatricalDate: "2025-01-10" }), TODAY);
  assert.deepEqual(ids(v), []);
  assert.equal(v.kind, "released");
});

test("série non diffusée — pas de canaux, mais un obstacle réel", () => {
  const v = classifyAvailability(
    meta({ mediaType: "tv", releaseDate: "2026-11-01" }),
    TODAY,
  );
  assert.equal(v.kind, "not_aired");
  assert.equal(v.date, "2026-11-01");
  assert.equal(v.obtainable, false);
});

test("série en production sans date — même verdict, sans date à afficher", () => {
  const v = classifyAvailability(
    meta({ mediaType: "tv", tmdbStatus: "In Production" }),
    TODAY,
  );
  assert.equal(v.kind, "not_aired");
  assert.equal(v.date, null);
});

test("série déjà diffusée — rien à signaler", () => {
  const v = classifyAvailability(
    meta({ mediaType: "tv", releaseDate: "2018-04-10", tmdbStatus: "Returning Series" }),
    TODAY,
  );
  assert.equal(v.kind, "released");
  assert.equal(v.obtainable, true);
});

test("numérique et physique tous deux annoncés — le plus proche est cité d'abord", () => {
  const v = classifyAvailability(
    meta({ theatricalDate: "2026-08-01", digitalDate: "2026-10-01", physicalDate: "2026-09-01" }),
    TODAY,
  );
  // La salle est déjà ouverte : elle passe devant les canaux à venir.
  assert.deepEqual(ids(v), ["theatrical", "physical", "digital"]);
  assert.equal(v.outlook, "unlikely");
});
