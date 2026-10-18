import { useEffect, useState } from "react";
import type { ResumeProjet } from "./api";
import { FournisseurSession, Logo, useDonnees, useSession } from "./commun";
import PageAnalyse from "./pages/Analyse";
import PageFinances from "./pages/Finances";
import PageOrganisation from "./pages/Organisation";
import PageProjets from "./pages/Projets";
import PageQualite from "./pages/Qualite";
import PageQuestionnaire from "./pages/Questionnaire";
import PageSuivi from "./pages/Suivi";

const PAGES = [
  { id: "projets", nom: "Projets", module: "M16", Composant: PageProjets },
  { id: "questionnaire", nom: "Questionnaire", module: "M4", Composant: PageQuestionnaire },
  { id: "organisation", nom: "Organisation", module: "M9", Composant: PageOrganisation },
  { id: "suivi", nom: "Suivi temps réel", module: "M11", Composant: PageSuivi },
  { id: "qualite", nom: "Contrôle qualité", module: "M12", Composant: PageQualite },
  { id: "finances", nom: "Finances", module: "M13", Composant: PageFinances },
  { id: "analyse", nom: "Base et analyse", module: "M14", Composant: PageAnalyse },
] as const;

function usePage(): string {
  const lire = () => window.location.hash.replace(/^#\/?/, "") || "projets";
  const [page, setPage] = useState(lire);
  useEffect(() => {
    const ecouter = () => setPage(lire());
    window.addEventListener("hashchange", ecouter);
    return () => window.removeEventListener("hashchange", ecouter);
  }, []);
  return page;
}

function Console({ projets }: { projets: ResumeProjet[] }) {
  const page = usePage();
  const { projet, setProjet } = useSession();
  const courante = PAGES.find((p) => p.id === page) ?? PAGES[0];
  const { Composant } = courante;
  useEffect(() => {
    document.title = `DATA'A · ${courante.nom}`;
  }, [courante.nom]);
  return (
    <div className="coque">
      <aside className="menu">
        <a href="#/projets" className="marque">
          <Logo />
          <span>
            <b>DATA’A</b>
            <small>CONSOLE USINE</small>
          </span>
        </a>
        {projets.length > 1 && (
          <label className="petit" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 8px", color: "#bfd3f5" }}>
            Projet
            <select value={projet} onChange={(e) => setProjet(e.target.value)}>
              {projets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}
                </option>
              ))}
            </select>
          </label>
        )}
        <nav aria-label="Console usine">
          {PAGES.map((p) => (
            <a key={p.id} href={`#/${p.id}`} className={p.id === courante.id ? "actif" : ""} aria-current={p.id === courante.id ? "page" : undefined}>
              <span>{p.nom}</span>
              <span>{p.module}</span>
            </a>
          ))}
        </nav>
        <div className="pied">
          Poste local · sans authentification
          <br />
          (double authentification : phase 7)
        </div>
      </aside>
      <main className="contenu">
        <Composant />
      </main>
    </div>
  );
}

export default function App() {
  const { donnees, erreur, charge } = useDonnees<ResumeProjet[]>("/projets");
  if (charge) return <p className="contenu chargement">Connexion à l’API…</p>;
  if (erreur || !donnees)
    return (
      <div className="contenu">
        <div className="bandeau erreur">
          API injoignable ({erreur}). Lancez <span className="mono">plateforme serveur</span> dans <span className="mono">backend/</span>.
        </div>
      </div>
    );
  if (donnees.length === 0)
    return (
      <div className="contenu">
        <div className="vide">Aucun projet trouvé dans le dossier projets/.</div>
      </div>
    );
  return (
    <FournisseurSession projetInitial={donnees[0].id}>
      <Console projets={donnees} />
    </FournisseurSession>
  );
}
