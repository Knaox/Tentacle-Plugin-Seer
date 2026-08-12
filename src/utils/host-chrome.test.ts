import { test } from "node:test";
import assert from "node:assert/strict";
import { chromeCss } from "./host-chrome";

test("la valeur de l'hôte passe AVANT le repli", () => {
  // Le repli n'est là que pour les hôtes qui ne publient pas la hauteur de leur
  // barre : dès qu'elle existe, c'est elle qui décide, sinon on empilerait une
  // approximation sur une mesure exacte.
  for (const mobile of [true, false]) {
    assert.match(chromeCss(mobile), /var\(--tentacle-chrome-bottom,/);
  }
});

test("hors WebView mobile, rien n'est réservé", () => {
  // Le cadre web et le bureau n'ont pas de barre flottante : réserver de la
  // place y creuserait un vide sous chaque pied de panneau.
  assert.match(chromeCss(false), /--tentacle-chrome-bottom,0px\)/);
});

test("en WebView mobile, la réserve couvre la barre ET l'encoche", () => {
  const css = chromeCss(true);
  assert.match(css, /88px/);
  assert.match(css, /env\(safe-area-inset-bottom, 0px\)/);
});
