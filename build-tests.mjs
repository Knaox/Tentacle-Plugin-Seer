import { build } from "esbuild";
import { globSync } from "node:fs";

/*
 * Le serveur du plugin n'a AUCUNE vérification de types : `tsconfig.json`
 * n'inclut que `src`, et le compiler sur `server/` échouerait de toute façon
 * puisque `fastify` et `@prisma/client` sont fournis par l'hôte, pas par nos
 * dépendances. Ces tests sont donc le seul filet du code serveur.
 *
 * Node lit le TypeScript nativement, mais sa résolution ESM exige des chemins
 * avec extension — que le code source n'écrit pas, esbuild s'en chargeant.
 * Plutôt que de tordre les imports pour le seul confort du runner, on passe par
 * le bundler déjà utilisé pour le serveur : aucune dépendance de test à
 * installer, et les fichiers testés restent tels qu'ils sont livrés.
 */

const entryPoints = globSync("server/**/*.test.ts");
if (entryPoints.length === 0) {
  console.log("[build-tests] aucun test à construire");
  process.exit(0);
}

await build({
  entryPoints,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  // Sans point devant : le runner de Node ignore les répertoires cachés.
  outdir: "test-build",
  external: ["@prisma/client", "fastify", "node:*"],
});

console.log(`[build-tests] ${entryPoints.length} fichier(s) de test construits`);
