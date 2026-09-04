import { test } from "node:test";
import assert from "node:assert/strict";
import { goneSeasons } from "./season-availability";

test("une saison demandée que Jellyseerr dit supprimée est libérée", () => {
  assert.deepEqual(
    goneSeasons([1, 2], [{ seasonNumber: 1, status: 7 }, { seasonNumber: 2, status: 5 }]),
    [1],
  );
});

test("rien à libérer sans statut « supprimée », ni sans information", () => {
  assert.deepEqual(goneSeasons([1, 2], [{ seasonNumber: 1, status: 3 }]), []);
  assert.deepEqual(goneSeasons([1, 2], undefined), []);
  assert.deepEqual(goneSeasons(null, [{ seasonNumber: 1, status: 7 }]), []);
});

test("une saison supprimée mais jamais demandée ne concerne pas la demande", () => {
  assert.deepEqual(goneSeasons([2], [{ seasonNumber: 1, status: 7 }]), []);
});
