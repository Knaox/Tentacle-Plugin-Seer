import { test } from "node:test";
import assert from "node:assert/strict";
import type { AvailabilityVerdict, ChannelId } from "../api/types-releases";
import { matchesChannels } from "./channel-filter";

const verdict = (ids: ChannelId[]): AvailabilityVerdict => ({
  mediaType: "movie",
  tmdbId: 1,
  channels: ids.map((id) => ({ id, date: null, released: true })),
  outlook: "likely",
  providerIds: [],
  kind: "released",
  date: null,
  theatricalDate: null,
  digitalDate: null,
  physicalDate: null,
  obtainable: true,
});

test("sans canal coché, tout passe", () => {
  assert.equal(matchesChannels(undefined, []), true);
  assert.equal(matchesChannels(verdict(["theatrical"]), []), true);
});

test("LA propriété : un verdict pas encore arrivé n'exclut pas", () => {
  // Il arrive par tranches, après l'affichage. Masquer en attendant viderait
  // l'écran à chaque page chargée.
  assert.equal(matchesChannels(undefined, ["digital"]), true);
});

test("un OU entre les canaux cochés", () => {
  assert.equal(matchesChannels(verdict(["theatrical"]), ["digital", "theatrical"]), true);
  assert.equal(matchesChannels(verdict(["theatrical"]), ["digital"]), false);
});

test("un titre sans aucun canal connu est écarté quand on filtre", () => {
  assert.equal(matchesChannels(verdict([]), ["digital"]), false);
});
