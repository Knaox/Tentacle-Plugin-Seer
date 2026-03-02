import { build } from "esbuild";

await build({
  entryPoints: ["server/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "server/index.mjs",
  // Mark node built-ins and Prisma as external (provided by host)
  external: ["@prisma/client", "path", "fs", "fs/promises", "crypto", "child_process", "stream/promises", "url"],
  banner: {
    js: '// Seer Plugin — Server module (auto-generated, do not edit)',
  },
});

console.log("[build-server] server/index.mjs built successfully");
