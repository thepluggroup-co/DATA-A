// Mode démonstration (build `npm run build:demo`) : l'interface réelle, servie sans serveur.
// Les réponses de l'API sont enregistrées (scripts : docs/CONSOLE_USINE.md). Le suivi utilise un classeur FICTIF.
// Dans le build normal, l'alias `@demo-donnees` pointe vers un fichier vide : aucune donnée n'est embarquée.
import donnees from "@demo-donnees";
import type { Analyse } from "./api";

export const DEMO = import.meta.env.VITE_DEMO === "1";
const TABLE = donnees as Record<string, unknown>;

const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });

export function installerDemo(): void {
  window.fetch = async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    const chemin = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api/, "");
    const cle = `${(init?.method ?? "GET").toUpperCase()} ${chemin}`;
    if (chemin.endsWith(".zip"))
      return json({ detail: "Téléchargement indisponible dans la démo en ligne : lancez la console sur votre poste (plateforme serveur)." }, 403);
    if (cle in TABLE) return json(TABLE[cle]);
    return json({ detail: `démo : réponse non enregistrée pour ${cle}` }, 404);
  };
}

export const analyseDemo = (): Analyse | null => (DEMO ? ((TABLE["POST /projets/edm_cameroun/suivi"] as Analyse) ?? null) : null);
