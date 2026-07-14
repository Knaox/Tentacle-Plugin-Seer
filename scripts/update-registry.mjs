#!/usr/bin/env node
/**
 * Insère/actualise une version du plugin dans le registry du marketplace
 * (repo tiers Knaox/tentacle-plugins-registry), lu par le backend via
 * raw.githubusercontent. Le workflow checke-out ce repo à part et passe le
 * chemin du registry.json via --registry.
 *
 *   node scripts/update-registry.mjs \
 *     --registry ../registry/registry.json \
 *     --version 1.12.0 \
 *     --url https://github.com/Knaox/Tentacle-Plugin-Seer/releases/download/v1.12.0/plugin-seer-v1.12.0.tar.gz \
 *     --checksum sha256:abc… \
 *     --min 1.1.0 --date 2026-07-14 \
 *     --changelog "Notes…" [--id seer]
 *
 * Idempotent : réécrit l'entrée si la version existe déjà. Met à jour
 * latestVersion. Préserve le reste du fichier (2 espaces + newline final).
 */
import { readFileSync, writeFileSync } from "node:fs";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const registryPath = arg("registry");
const version = arg("version");
const downloadUrl = arg("url");
const checksum = arg("checksum");
const minTentacleVersion = arg("min", "1.1.0");
const maxRaw = arg("max", "");
const releaseDate = arg("date");
const changelogFile = arg("changelog-file");
// Le changelog (souvent multi-ligne) est passé par FICHIER pour éviter les
// soucis d'échappement shell ; --changelog reste possible en secours.
const changelog = changelogFile
  ? readFileSync(changelogFile, "utf8").trim()
  : arg("changelog", "");
const id = arg("id", "seer");

for (const [k, v] of Object.entries({ registry: registryPath, version, url: downloadUrl, checksum, date: releaseDate })) {
  if (!v) {
    console.error(`Argument manquant : --${k}`);
    process.exit(1);
  }
}

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const plugin = registry.plugins?.find((p) => p.id === id);
if (!plugin) {
  console.error(`Plugin « ${id} » introuvable dans ${registryPath}`);
  process.exit(1);
}

const entry = {
  version,
  minTentacleVersion,
  maxTentacleVersion: maxRaw ? maxRaw : null,
  downloadUrl,
  checksum,
  changelog,
  releaseDate,
};

plugin.versions = Array.isArray(plugin.versions) ? plugin.versions : [];
const existing = plugin.versions.findIndex((v) => v.version === version);
if (existing >= 0) plugin.versions[existing] = entry;
else plugin.versions.unshift(entry); // plus récent en tête

plugin.latestVersion = version;

writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
console.error(`Registry mis à jour : ${id} → ${version}`);
