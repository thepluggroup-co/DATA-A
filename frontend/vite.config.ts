import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En développement, l'API FastAPI tourne sur 127.0.0.1:8000 (`plateforme serveur`).
// `--mode demo` : interface sans serveur, réponses enregistrées dans src/demo-donnees.json (hors Git).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "demo" ? "./" : "/",
  resolve: {
    alias: {
      "@demo-donnees": fileURLToPath(new URL(mode === "demo" ? "./src/demo-donnees.json" : "./src/demo-vide.json", import.meta.url)),
    },
  },
  build: mode === "demo" ? { outDir: "dist-demo", assetsInlineLimit: 100000000, cssCodeSplit: false } : {},
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
}));
