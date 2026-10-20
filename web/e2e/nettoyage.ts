import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Après les tests : Playwright tue le serveur de démonstration sans lui laisser arrêter son PostgreSQL jetable.
// On arrête donc explicitement les serveurs orphelins (sinon un serveur s'accumulerait à chaque exécution).
export default function nettoyer(): void {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const uv = process.env.UV ?? path.join(process.env.USERPROFILE ?? process.env.HOME ?? "", ".local", "bin", "uv");
  const tmp = path.resolve(ici, "..", ".e2e-tmp");
  execFileSync(uv, ["run", "--no-sync", "python", "-m", "plateforme.saas.serveur_demo", "--nettoyer"],
               { cwd: path.resolve(ici, "..", "..", "backend"), stdio: "inherit",
                 env: { ...process.env, UV_CACHE_DIR: path.resolve(ici, "..", ".uv-cache"), DATAA_DEMO_TMP: tmp, TEMP: tmp, TMP: tmp, TMPDIR: tmp } });
}
