import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/plugin.tsx",
      name: "TentaclePluginSeer",
      formats: ["iife"],
      fileName: () => "plugin-seer.iife.js",
    },
    rollupOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "react-i18next",
        "@tanstack/react-query",
        "@tentacle-tv/plugins-api",
      ],
      output: {
        globals: {
          react: "TentacleShared.React",
          "react/jsx-runtime": "TentacleShared.ReactJSXRuntime",
          "react-i18next": "TentacleShared.ReactI18next",
          "@tanstack/react-query": "TentacleShared.TanStackQuery",
          "@tentacle-tv/plugins-api": "TentacleShared.PluginsAPI",
        },
      },
    },
    outDir: "dist",
    minify: true,
    sourcemap: false,
  },
});
