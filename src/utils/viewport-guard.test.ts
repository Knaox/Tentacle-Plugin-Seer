import { test } from "node:test";
import assert from "node:assert/strict";
import { createViewportGuard, type ObserverFactory } from "./viewport-guard";

/*
 * Ce que ces tests protègent : la garde décide de ce qui reste en mémoire, et
 * une régression y serait MUETTE. Un observateur créé par cible ne se voit pas
 * à l'écran, il se paie en images perdues ; une cible jamais relâchée ne se
 * voit pas non plus, elle retient son affiche pour la durée de la session.
 *
 * Aucun DOM ici : la fabrique d'observateurs est injectable, et de faux
 * éléments suffisent puisque la garde ne fait que les router.
 */

interface Spy {
  watched: Set<Element>;
  connected: boolean;
  emit(target: Element, isIntersecting: boolean): void;
}

/** Fabrique instrumentée : elle enregistre chaque observateur construit. */
function spyFactory(): { built: Spy[]; make: ObserverFactory } {
  const built: Spy[] = [];

  const make: ObserverFactory = (callback) => {
    const spy: Spy = {
      watched: new Set(),
      connected: true,
      emit: (target, isIntersecting) =>
        callback(
          [{ target, isIntersecting } as IntersectionObserverEntry],
          spy as unknown as IntersectionObserver,
        ),
    };
    const observer = {
      observe: (el: Element) => {
        spy.watched.add(el);
        spy.connected = true;
      },
      unobserve: (el: Element) => spy.watched.delete(el),
      disconnect: () => {
        spy.watched.clear();
        spy.connected = false;
      },
    };
    built.push(spy);
    return observer as unknown as IntersectionObserver;
  };

  return { built, make };
}

const el = (): Element => ({}) as Element;

test("un seul observateur, quel que soit le nombre de cibles", () => {
  const { built, make } = spyFactory();
  const guard = createViewportGuard("100px", make);

  for (let i = 0; i < 50; i++) guard.observe(el(), () => {});

  assert.equal(built.length, 1);
  assert.equal(built[0].watched.size, 50);
});

test("aucun observateur tant qu'aucune cible n'est observée", () => {
  const { built, make } = spyFactory();
  createViewportGuard("100px", make);
  assert.equal(built.length, 0);
});

test("chaque cible reçoit son propre verdict", () => {
  const { built, make } = spyFactory();
  const guard = createViewportGuard("100px", make);
  const a = el();
  const b = el();
  const vus: Array<[string, boolean]> = [];

  guard.observe(a, (near) => vus.push(["a", near]));
  guard.observe(b, (near) => vus.push(["b", near]));

  built[0].emit(a, true);
  built[0].emit(b, false);

  assert.deepEqual(vus, [
    ["a", true],
    ["b", false],
  ]);
});

test("relâcher la dernière cible déconnecte l'observateur", () => {
  const { built, make } = spyFactory();
  const guard = createViewportGuard("100px", make);
  const a = el();
  const b = el();

  guard.observe(a, () => {});
  guard.observe(b, () => {});
  guard.release(a);
  assert.equal(built[0].connected, true, "une cible reste, on garde l'observateur");

  guard.release(b);
  assert.equal(built[0].connected, false);
  assert.deepEqual(guard.stats(), { observed: 0, near: 0 });
});

test("relâcher deux fois la même cible ne déconnecte pas les autres", () => {
  const { built, make } = spyFactory();
  const guard = createViewportGuard("100px", make);
  const a = el();
  const b = el();

  guard.observe(a, () => {});
  guard.observe(b, () => {});
  guard.release(a);
  guard.release(a);

  assert.equal(built[0].connected, true);
  assert.equal(guard.stats().observed, 1);
});

test("une cible relâchée ne reçoit plus rien", () => {
  const { built, make } = spyFactory();
  const guard = createViewportGuard("100px", make);
  const a = el();
  let appels = 0;

  guard.observe(a, () => appels++);
  guard.release(a);
  built[0].emit(a, true);

  assert.equal(appels, 0);
});

test("suspendue, la garde ne décide plus rien", () => {
  const { built, make } = spyFactory();
  const guard = createViewportGuard("100px", make);
  const a = el();
  let dernier: boolean | null = null;

  guard.observe(a, (near) => (dernier = near));
  built[0].emit(a, true);
  assert.equal(dernier, true);

  guard.setPaused(true);
  built[0].emit(a, false);
  assert.equal(dernier, true, "le verdict d'avant la suspension tient");
  assert.equal(built[0].connected, false, "l'observateur cesse aussi de mesurer");
});

test("à la reprise, toutes les cibles sont ré-observées", () => {
  const { built, make } = spyFactory();
  const guard = createViewportGuard("100px", make);
  const cibles = [el(), el(), el()];

  for (const c of cibles) guard.observe(c, () => {});
  guard.setPaused(true);
  assert.equal(built[0].watched.size, 0);

  guard.setPaused(false);
  assert.equal(built[0].watched.size, 3, "sinon la grille resterait figée après la modale");
  assert.equal(built.length, 1, "la reprise ne construit pas un second observateur");
});

test("dégeler une garde qui ne l'est pas ne double pas les observations", () => {
  // Le dégel se joue aussi au démontage de la page, y compris quand rien
  // n'était figé : il doit rester sans effet.
  const { built, make } = spyFactory();
  const guard = createViewportGuard("100px", make);
  const a = el();

  guard.observe(a, () => {});
  guard.setPaused(false);

  assert.equal(built.length, 1);
  assert.equal(built[0].watched.size, 1);
});

test("suspendre deux fois de suite ne change rien", () => {
  const { built, make } = spyFactory();
  const guard = createViewportGuard("100px", make);
  guard.observe(el(), () => {});

  guard.setPaused(true);
  guard.setPaused(true);
  guard.setPaused(false);

  assert.equal(built[0].watched.size, 1);
});

test("le relevé compte les cibles proches", () => {
  const { built, make } = spyFactory();
  const guard = createViewportGuard("100px", make);
  const a = el();
  const b = el();

  guard.observe(a, () => {});
  guard.observe(b, () => {});
  built[0].emit(a, true);
  built[0].emit(b, true);
  assert.deepEqual(guard.stats(), { observed: 2, near: 2 });

  built[0].emit(b, false);
  assert.deepEqual(guard.stats(), { observed: 2, near: 1 });
});

test("la marge demandée est bien celle passée à l'observateur", () => {
  let vue: IntersectionObserverInit | undefined;
  const make: ObserverFactory = (_callback, init) => {
    vue = init;
    return { observe() {}, unobserve() {}, disconnect() {} } as unknown as IntersectionObserver;
  };

  createViewportGuard("1400px 0px 2000px 0px", make).observe(el(), () => {});
  assert.equal(vue?.rootMargin, "1400px 0px 2000px 0px");
});
