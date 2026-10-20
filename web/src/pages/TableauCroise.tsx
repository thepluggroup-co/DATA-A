import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
type Projet = { id: string; nom: string }; type Variable = { nom: string; label?: string };
export function TableauCroise({ projets }: { projets: Projet[] }): ReactNode {
  const [projet, setProjet] = useState(projets[0]?.id ?? ""), [vars, setVars] = useState<Variable[]>([]), [ligne, setLigne] = useState(""), [colonne, setColonne] = useState(""), [filtre, setFiltre] = useState(""), [resultat, setResultat] = useState<string>(""), [erreur, setErreur] = useState("");
  useEffect(() => { if (!projet) return; void api<Variable[]>(`/api/projets/${projet}/variables`).then((v) => { setVars(v); setLigne(v[0]?.nom ?? ""); setColonne(v[1]?.nom ?? v[0]?.nom ?? ""); }).catch((e: Error) => setErreur(e.message)); }, [projet]);
  const calculer = (): void => { void api<unknown>(`/api/projets/${projet}/croisements`, { methode: "POST", corps: { ligne, colonne, filtre } }).then((r) => setResultat(JSON.stringify(r, null, 2))).catch((e: Error) => setErreur(e.message)); };
  return <section className="panneau tableau-croise"><h2>Tableau croisÃ©</h2><div className="atelier-grille"><label>Ã‰tude<select value={projet} onChange={(e) => setProjet(e.target.value)}>{projets.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></label><label>Ligne<select value={ligne} onChange={(e) => setLigne(e.target.value)}>{vars.map((v) => <option key={v.nom} value={v.nom}>{v.label || v.nom}</option>)}</select></label><label>Colonne<select value={colonne} onChange={(e) => setColonne(e.target.value)}>{vars.map((v) => <option key={v.nom} value={v.nom}>{v.label || v.nom}</option>)}</select></label><label>Filtre<input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="facultatif" /></label><button onClick={calculer}>Calculer</button></div>{erreur && <p className="erreur" role="alert">{erreur}</p>}{resultat && <pre className="resultat-statistique">{String(JSON.stringify(resultat, null, 2))}</pre>}</section>;
}


