import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, EnTete, Kpi } from "../ui";

type Projet = { id: string; code: string; nom: string; statut: string; organisation: string };
type Workflow = { etape: string; statut: string; historique: { etape: string }[] };

export function UsineAnalyses(): ReactNode {
  const [lignes, setLignes] = useState<{ projet: Projet; workflow: Workflow }[]>([]);
  const [erreur, setErreur] = useState("");
  useEffect(() => { api<Projet[]>("/api/usine/projets").then(async (projets) => { const d = await Promise.all(projets.map(async (projet) => ({ projet, workflow: await api<Workflow>(`/api/cabinet/projets/${projet.id}/validation`).catch(() => ({ etape: "junior", statut: projet.statut, historique: [] })) }))); setLignes(d); }).catch((e: Error) => setErreur(e.message)); }, []);
  const compte = (etape: string): number => lignes.filter((x) => x.workflow.etape === etape).length;
  return <>
    <EnTete titre="Analyses & validations" sous_titre="Pilotage senior et expert : programmer, superviser, valider et livrer les résultats." />
    {erreur && <p className="erreur" role="alert">{erreur}</p>}
    <div className="kpis"><Kpi icone="fiches" etiquette="À superviser" valeur={compte("senior")} detail="retour consultant junior" /><Kpi icone="croisement" etiquette="À analyser" valeur={compte("expert")} detail="validation expert attendue" /><Kpi icone="bouclier" etiquette="Validations" valeur={lignes.reduce((s, x) => s + x.workflow.historique.length, 0)} /><Kpi icone="etudes" etiquette="Livrées" valeur={compte("livre")} /></div>
    <div className="tableau"><table aria-label="Workflow des analyses"><thead><tr><th>Étude</th><th>Client</th><th>Étape</th><th>Historique</th><th /></tr></thead><tbody>
      {lignes.length === 0 && <tr><td colSpan={5} className="vide">Aucune étude à afficher.</td></tr>}
      {lignes.map(({ projet, workflow }) => <tr key={projet.id}><td><strong>{projet.nom}</strong><br /><code>{projet.code}</code></td><td>{projet.organisation}</td><td>{workflow.etape === "livre" ? <Badge ton="ok">Livrée</Badge> : workflow.etape === "expert" ? <Badge ton="info">Expert</Badge> : workflow.etape === "senior" ? <Badge ton="alerte">Senior</Badge> : <Badge ton="neutre">Junior</Badge>}</td><td>{workflow.historique.length} validation(s)</td><td><Link className="bouton" to="/usine">Ouvrir l’étude</Link></td></tr>)}
    </tbody></table></div>
  </>;
}
