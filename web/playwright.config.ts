import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));

// Bout en bout dans un vrai navigateur (Chromium seul, D-052) : le serveur de démonstration démarre un PostgreSQL jetable,
// applique les migrations, sème le jeu FICTIF (usine, clients A et B) et sert l'API et le front-end construit (dist).
const PORT = Number(process.env.PW_PORT ?? 8765);
const UV = process.env.UV ?? path.join(process.env.USERPROFILE ?? process.env.HOME ?? "", ".local", "bin", "uv");

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/nettoyage.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure", locale: "fr-FR" },
  // Navigateur : le Chromium de Playwright par défaut ; PW_CANAL=msedge utilise le Microsoft Edge du poste (même moteur
  // Chromium, sans téléchargement), utile quand le réseau empêche de télécharger le navigateur de test.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(process.env.PW_CANAL ? { channel: process.env.PW_CANAL } : {}) } }],
  webServer: {
    command: `"${UV}" run --no-sync python -m plateforme.saas.serveur_demo --port ${PORT} --web ../web/dist`,
    cwd: path.resolve(ICI, "..", "backend"),
    url: `http://127.0.0.1:${PORT}/logo_data_a.png`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: { OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MKL_NUM_THREADS: "1" },
  },
});
