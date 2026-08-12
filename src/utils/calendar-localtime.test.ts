import { test } from "node:test";
import assert from "node:assert/strict";
import type { CalendarItem } from "../api/types-releases";
import { applyLocalDays } from "./calendar-localtime";

/*
 * Le cas mesuré sur le calendrier Sonarr de l'instance : `airDate` annonce le
 * 14 août, `airDateUtc` vaut 2026-08-13T15:15:00Z. En Europe l'épisode sort
 * donc le 13 au soir, et l'agenda le rangeait un jour trop tard.
 *
 * Ces tests dépendent du fuseau de la machine ; ils sont écrits pour rester
 * vrais partout, en comparant au jour local calculé plutôt qu'à une date figée.
 */

const item = (over: Partial<CalendarItem> = {}): CalendarItem => ({
  id: "tv:1:episode:2026-08-14",
  date: "2026-08-14",
  mediaType: "tv", tmdbId: 1, title: "T",
  posterPath: null, backdropPath: null, overview: null,
  kind: "episode", seasonNumber: 1, episodeNumber: 7,
  networks: null, providerIds: [], requestId: null, requestStatus: null,
  ...over,
});

/** Le jour local attendu pour un instant, calculé comme le fait le navigateur. */
function localDay(iso: string): string {
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

test("l'instant réel fait foi sur la date annoncée", () => {
  const iso = "2026-08-13T15:15:00Z";
  const [out] = applyLocalDays([item({ airDateUtc: iso })]);
  assert.equal(out.date, localDay(iso));
});

test("l'identifiant suit la date, sinon l'épisode se dédouble", () => {
  const iso = "2026-08-13T15:15:00Z";
  const [out] = applyLocalDays([item({ airDateUtc: iso })]);
  assert.equal(out.id, `tv:1:episode:${localDay(iso)}`);
  assert.ok(!out.id.includes("2026-08-14"));
});

test("sans instant connu — rien n'est touché", () => {
  const items = [item()];
  const out = applyLocalDays(items);
  // Le tableau d'origine est rendu tel quel : les vues mémorisées ne sont pas
  // invalidées pour rien.
  assert.equal(out, items);
  assert.equal(out[0].date, "2026-08-14");
});

test("instant déjà cohérent avec la date — aucun remplacement", () => {
  const iso = "2026-08-14T12:00:00Z";
  const day = localDay(iso);
  const items = [item({ date: day, airDateUtc: iso })];
  assert.equal(applyLocalDays(items), items);
});

test("instant illisible — la date annoncée est conservée", () => {
  const items = [item({ airDateUtc: "pas une date" })];
  assert.equal(applyLocalDays(items), items);
});

test("une seule entrée corrigée suffit à produire un nouveau tableau", () => {
  const out = applyLocalDays([item(), item({ tmdbId: 2, airDateUtc: "2026-08-13T15:15:00Z" })]);
  assert.equal(out[0].date, "2026-08-14");
  assert.equal(out[1].date, localDay("2026-08-13T15:15:00Z"));
});
