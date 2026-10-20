import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, EnTete, Kpi } from "../ui";
import { TableauCroise } from "./TableauCroise";

type Projet = { id: string; code: string; nom: string; statut: string; organisation: string };
type Workflow = { etape: string; statut: string; historique: { etape: string }[] };

export function UsineAnalyses(): ReactNode {
  const [lignes, setLignes] = useState<{ projet: Projet; workflow: Workflow }[]>([]);
  const [erreur, setErreur] = useState("");
  const [methode, setMethode] = useState("tri_plat");
  const [resultat, setResultat] = useState("");
  const [triPlat, setTriPlat] = useState<{ base: number; lignes: { modalite: string; effectif: number; pourcentage: number }[] } | null>(null);
  const [variable, setVariable] = useState("cible");
  const [variables, setVariables] = useState<{ nom: string; label?: string }[]>([]);
  const [projetId, setProjetId] = useState("");
  const [procedures, setProcedures] = useState<{ id: string; methode: string; statut: string; auteur: string; le: string }[]>([]);
  const chargerProcedures = (id: string): void => { if (!id) return; void api<typeof procedures>(`/api/cabinet/projets/${id}/analyses`).then(setProcedures).catch(() => setProcedures([])); };
  const executer = (): void => {
    const id = projetId || lignes[0]?.projet.id;
    if (!id) { setResultat("Sélectionnez une étude avant de préparer l’analyse."); return; }
    void api<{ id: string; methode: string; statut: string; auteur: string; le: string }>(`/api/cabinet/projets/${id}/analyses`, { methode: "POST", corps: { methode, variable: "cible", filtre: "" } }).then((a) => { setProcedures((x) => [a, ...x]); setResultat(`Analyse ${methode} enregistrée. Statut : à valider par l’expert.`); }).catch((e: Error) => setResultat(`Enregistrement impossible : ${e.message}`));
  };
  const chargerVariables = (id: string): void => { if (!id) return; void api<{ nom: string; label?: string }[]>(`/api/projets/${id}/variables`).then(setVariables).catch(() => setVariables([])); };
  const chargerTriPlat = (): void => { const id = projetId || lignes[0]?.projet.id; if (!id) return; void api<typeof triPlat>(`/api/projets/${id}/tri-plats?variable=${encodeURIComponent(variable)}`).then(setTriPlat).catch((e: Error) => setResultat(e.message)); };
  useEffect(() => { api<Projet[]>("/api/usine/projets").then(async (projets) => { const d = await Promise.all(projets.map(async (projet) => ({ projet, workflow: await api<Workflow>(`/api/cabinet/projets/${projet.id}/validation`).catch(() => ({ etape: "junior", statut: projet.statut, historique: [] })) }))); setLignes(d); }).catch((e: Error) => setErreur(e.message)); }, []);
  const compte = (etape: string): number => lignes.filter((x) => x.workflow.etape === etape).length;
  return <>
    <EnTete titre="Analyses & validations" sous_titre="Pilotage senior et expert : programmer, superviser, valider et livrer les résultats." />
    {erreur && <p className="erreur" role="alert">{erreur}</p>}<TableauCroise projets={lignes.map(({ projet }) => projet)} />
    <section className="atelier-analyse panneau"><h2>Atelier d’analyse</h2><p className="sous-titre">Configurez une procédure reproductible avant validation.</p><div className="atelier-grille"><label>Étude<select value={projetId} onChange={(e) => { setProjetId(e.target.value); chargerProcedures(e.target.value); chargerVariables(e.target.value); }}><option value="">Première étude disponible</option>{lignes.map((x) => <option key={x.projet.id} value={x.projet.id}>{x.projet.nom}</option>)}</select></label><label>Variable<select value={variable} onChange={(e) => setVariable(e.target.value)}>{variables.length ? variables.map((v) => <option key={v.nom} value={v.nom}>{v.label || v.nom}</option>) : <option value="cible">cible</option>}</select></label><label>Méthode<select value={methode} onChange={(e) => setMethode(e.target.value)}><option value="tri_plat">Tri à plat</option><option value="croisement">Tableau croisé</option><option value="comparaison">Comparaison</option><option value="regression">Régression</option><option value="acp">ACP</option><option value="classification">K-moyennes</option></select></label><button onClick={executer}>Enregistrer la procédure</button><button className="secondaire" onClick={chargerTriPlat}>Exécuter le tri à plat</button></div>{resultat && <p className="succes" role="status">{resultat}</p>}{triPlat && <div className="tableau"><p>Base : <strong>{triPlat.base}</strong></p><table aria-label="Résultat tri à plat"><thead><tr><th>Modalité</th><th>Effectif</th><th>%</th></tr></thead><tbody>{triPlat.lignes.map((l) => <tr key={l.modalite}><td>{l.modalite}</td><td>{l.effectif}</td><td>{l.pourcentage}%</td></tr>)}</tbody></table></div>}</section>
    {procedures.length > 0 && <section className="panneau"><h2>Procédures enregistrées</h2><div className="cartes-modules">{procedures.map((a) => <article className="carte-module" key={a.id}><strong>{a.methode}</strong><Badge ton="alerte">À valider</Badge><p className="mention">{a.auteur} · {new Date(a.le).toLocaleString("fr-FR")}</p></article>)}</div></section>}
    <div className="kpis"><Kpi icone="fiches" etiquette="À superviser" valeur={compte("senior")} detail="retour consultant junior" /><Kpi icone="croisement" etiquette="À analyser" valeur={compte("expert")} detail="validation expert attendue" /><Kpi icone="bouclier" etiquette="Validations" valeur={lignes.reduce((s, x) => s + x.workflow.historique.length, 0)} /><Kpi icone="etudes" etiquette="Livrées" valeur={compte("livre")} /></div>
    <div className="tableau"><table aria-label="Workflow des analyses"><thead><tr><th>Étude</th><th>Client</th><th>Étape</th><th>Historique</th><th /></tr></thead><tbody>
      {lignes.length === 0 && <tr><td colSpan={5} className="vide">Aucune étude à afficher.</td></tr>}
      {lignes.map(({ projet, workflow }) => <tr key={projet.id}><td><strong>{projet.nom}</strong><br /><code>{projet.code}</code></td><td>{projet.organisation}</td><td>{workflow.etape === "livre" ? <Badge ton="ok">Livrée</Badge> : workflow.etape === "expert" ? <Badge ton="info">Expert</Badge> : workflow.etape === "senior" ? <Badge ton="alerte">Senior</Badge> : <Badge ton="neutre">Junior</Badge>}</td><td>{workflow.historique.length} validation(s)</td><td><Link className="bouton" to="/usine">Ouvrir l’étude</Link></td></tr>)}
    </tbody></table></div>
  </>;
}
