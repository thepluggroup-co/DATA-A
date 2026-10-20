import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En développement, l'API tourne à part (serveur de démonstration) : /api est relayé vers elle.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8765" } },
  build: { outDir: "dist", sourcemap: false },
});
