import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En développement, l'API FastAPI tourne sur 127.0.0.1:8000 (`plateforme serveur`).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
});
