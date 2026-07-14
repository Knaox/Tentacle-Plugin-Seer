#!/usr/bin/env node
/**
 * Auto-bump de version piloté par le message du commit HEAD.
 *
 *   feat…            → mineure
 *   fix/chore/perf/… → patch (défaut)
 *   « ! » ou BREAKING CHANGE → majeure
 *   « [skip release » n'importe où → skip=true (rien n'est publié)
 *
 * Source de vérité : plugin.json.version. Le nouveau numéro est écrit dans LES
 * TROIS fichiers désynchronisés — package.json, plugin.json, src/plugin.tsx —
 * pour qu'ils ne dérivent plus jamais.
 *
 * Sorties (stdout + $GITHUB_OUTPUT si défini) : version, level, skip.
 * Le message peut être fourni via $COMMIT_MSG (sinon lu depuis git).
 */
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function getCommitMessage() {
  if (process.env.COMMIT_MSG) return process.env.COMMIT_MSG;
  try {
    return execSync("git log -1 --pretty=%B", { cwd: ROOT }).toString();
  } catch {
    return "";
  }
}

function detectLevel(msg) {
  if (/\[skip release\]?/i.test(msg)) return "skip";
  if (/BREAKING CHANGE/.test(msg) || /^\s*\w+(\([^)]*\))?!:/m.test(msg)) return "major";
  if (/^\s*feat(\([^)]*\))?:/m.test(msg)) return "minor";
  return "patch";
}

function bump(version, level) {
  const [maj, min, pat] = version.split(".").map((n) => parseInt(n, 10));
  if (level === "major") return `${maj + 1}.0.0`;
  if (level === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function writeJsonVersion(file, version) {
  const path = join(ROOT, file);
  const json = JSON.parse(readFileSync(path, "utf8"));
  json.version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
}

function writePluginTsxVersion(version) {
  const path = join(ROOT, "src/plugin.tsx");
  const src = readFileSync(path, "utf8");
  // Remplace le premier `version: "x.y.z"` de l'objet plugin.
  const next = src.replace(/version:\s*"[^"]*"/, `version: "${version}"`);
  writeFileSync(path, next);
}

function output(key, value) {
  console.log(`${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

const msg = getCommitMessage();
const level = detectLevel(msg);

if (level === "skip") {
  output("skip", "true");
  output("level", "skip");
  output("version", JSON.parse(readFileSync(join(ROOT, "plugin.json"), "utf8")).version);
  process.exit(0);
}

const current = JSON.parse(readFileSync(join(ROOT, "plugin.json"), "utf8")).version;
const next = bump(current, level);

writeJsonVersion("package.json", next);
writeJsonVersion("plugin.json", next);
writePluginTsxVersion(next);

console.error(`Bump ${current} → ${next} (${level})`);
output("skip", "false");
output("level", level);
output("version", next);
