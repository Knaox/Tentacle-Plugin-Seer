import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDIA_STATUS_DELETED, isRequestedSeasonStatus } from "./media-status";

test("demandée à partir de PENDING, disponible comprise", () => {
  assert.equal(isRequestedSeasonStatus(2), true);
  assert.equal(isRequestedSeasonStatus(3), true);
  assert.equal(isRequestedSeasonStatus(5), true);
});

test("inconnue ou absente : libre", () => {
  assert.equal(isRequestedSeasonStatus(1), false);
  assert.equal(isRequestedSeasonStatus(undefined), false);
});

test("supprimée côté Jellyseerr : libre, pas « demandée »", () => {
  assert.equal(isRequestedSeasonStatus(MEDIA_STATUS_DELETED), false);
});
