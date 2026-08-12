import { test } from "node:test";
import assert from "node:assert/strict";
import type { AvailabilityVerdict, ChannelId } from "../api/types-releases";
import { matchesChannels } from "./channel-filter";

const verdict = (ids: ChannelId[], mediaType: "movie" | "tv" = "movie"): AvailabilityVerdict => ({
  mediaType,
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

test("un verdict pas encore arrivé n'exclut pas", () => {
  // Il arrive par tranches, après l'affichage. Masquer en attendant viderait
  // l'écran à chaque page chargée.
  assert.equal(matchesChannels(undefined, ["streaming"]), true);
});

test("LA propriété : une série sur une plateforme passe « En streaming »", () => {
  // Une série n'a JAMAIS de date typée : son seul canal est « streaming ».
  // Ne retenir que « digital » masquait toutes les séries et tous les animés.
  assert.equal(matchesChannels(verdict(["streaming"], "tv"), ["streaming"]), true);
});

test("un film sorti en numérique passe le même filtre", () => {
  assert.equal(matchesChannels(verdict(["digital"]), ["streaming"]), true);
});

test("un OU entre les choix cochés", () => {
  assert.equal(matchesChannels(verdict(["theatrical"]), ["streaming", "theatrical"]), true);
  assert.equal(matchesChannels(verdict(["theatrical"]), ["streaming"]), false);
  assert.equal(matchesChannels(verdict(["physical"]), ["physical"]), true);
});

test("un titre sans aucun canal connu est écarté quand on filtre", () => {
  assert.equal(matchesChannels(verdict([]), ["streaming"]), false);
});
