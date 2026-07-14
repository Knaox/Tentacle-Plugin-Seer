#!/usr/bin/env node
/**
 * Extrait le bloc de changelog d'une version depuis changelogs/seer.md.
 *
 *   node scripts/release-notes.mjs --version 1.12.0
 *
 * Format attendu (bilingue, comme Tentacle-TV) :
 *   ## [1.12.0]
 *   ### FR
 *   - …
 *   ### EN
 *   - …
 *
 * Imprime le corps du bloc (sans l'en-tête « ## [x] ») sur stdout. Si le bloc
 * n'existe pas, n'imprime RIEN (le workflow retombe sur le sujet du commit) —
 * publication sans friction même sans changelog rédigé.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const version = arg("version");
if (!version) {
  console.error("usage: release-notes.mjs --version X.Y.Z");
  process.exit(1);
}

let md = "";
try {
  md = readFileSync(join(ROOT, "changelogs/seer.md"), "utf8");
} catch {
  process.exit(0); // pas de changelog → rien
}

// Bloc « ## [version] » jusqu'au prochain « ## [ » ou fin de fichier.
const esc = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const re = new RegExp(`##\\s*\\[${esc}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s*\\[|$)`);
const m = md.match(re);
if (m) process.stdout.write(m[1].trim() + "\n");
