import { test } from "node:test";
import assert from "node:assert/strict";
import { cached, put, peek } from "./cache";

/*
 * Les DEUX invariants sur lesquels repose tout le blindage du calendrier :
 * un chargeur en échec ne doit rien laisser derrière lui, et une valeur déjà
 * en place doit survivre à un rafraîchissement qui échoue. Sans eux, une
 * panne passagère se graverait en « vide réussi » pour des heures.
 */

let n = 0;
/** Clés uniques : le store du module est partagé entre les tests. */
const key = () => `test:blindage:${++n}`;

test("un chargeur qui rejette ne stocke rien — le suivant repart de zéro", async () => {
  const k = key();
  await assert.rejects(
    cached(k, 60_000, async () => { throw new Error("guichet muet"); }),
    /guichet muet/,
  );
  assert.equal(peek(k), undefined);

  // Le guichet répond de nouveau : rien d'empoisonné, la valeur s'installe.
  assert.equal(await cached(k, 60_000, async () => "ok"), "ok");
  assert.equal(peek(k), "ok");
});

test("une valeur en place survit à un rafraîchissement qui échoue", async () => {
  const k = key();
  // Périmée aussitôt (1 ms), mais servable une minute : le cas « stale ».
  put(k, "ancienne", 1, 60_000);
  await new Promise((r) => setTimeout(r, 10));

  // L'accès sert l'ancienne valeur et lance le rafraîchissement en fond…
  const servie = await cached(k, 60_000, async () => { throw new Error("boom"); });
  assert.equal(servie, "ancienne");

  // …dont l'échec ne doit PAS effacer ce qui restait servable.
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(peek(k, true), "ancienne");
});

test("deux demandes simultanées ne déclenchent qu'un seul chargement", async () => {
  const k = key();
  let appels = 0;
  const loader = async () => {
    appels++;
    await new Promise((r) => setTimeout(r, 10));
    return "valeur";
  };
  const [a, b] = await Promise.all([cached(k, 60_000, loader), cached(k, 60_000, loader)]);
  assert.equal(a, "valeur");
  assert.equal(b, "valeur");
  assert.equal(appels, 1);
});
