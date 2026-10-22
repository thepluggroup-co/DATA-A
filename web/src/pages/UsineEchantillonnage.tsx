import { useMemo, useState, type ReactNode } from "react";
import { EnTete, Kpi, Badge } from "../ui";

const villes = ["Douala", "Yaoundé", "Bafoussam", "Dschang"];
const cibles = ["Particuliers", "Entreprises", "Artisans", "Distributeurs"];

function repartir(total: number, elements: string[]): { nom: string; quota: number }[] {
  if (!elements.length) return [];
  const base = Math.floor(total / elements.length);
  const reste = total % elements.length;
  return elements.map((nom, index) => ({ nom, quota: base + (index < reste ? 1 : 0) }));
}

export function UsineEchantillonnage(): ReactNode {
  const [taille, setTaille] = useState(400); const [villeSelection, setVilleSelection] = useState(villes.slice(0, 3)); const [cibleSelection, setCibleSelection] = useState(cibles.slice(0, 3));
  const total = Math.min(20000, Math.max(30, Number(taille) || 30));
  const parVille = useMemo(() => repartir(total, villeSelection), [total, villeSelection]);
  const parCible = useMemo(() => repartir(total, cibleSelection), [total, cibleSelection]);
  return <>
        <EnTete titre="Simulation de répartition" sous_titre="Répartition indicative, non enregistrée dans un plan d’étude." />
    <div className="panneau actions"><Badge ton="alerte">Simulation</Badge><span className="mention">Cette maquette répartit l’effectif à parts égales; elle ne calcule pas la taille statistique et ne sauvegarde aucun quota.</span></div>
    <div className="panneau"><div className="grille"><label htmlFor="taille-ech">Effectif cible</label><input id="taille-ech" type="number" min="30" max="20000" value={taille} onChange={(e) => setTaille(Number(e.target.value))} /><span>Villes</span><div className="actions">{villes.map((v) => <label key={v}><input type="checkbox" checked={villeSelection.includes(v)} onChange={(e) => setVilleSelection(e.target.checked ? [...villeSelection, v] : villeSelection.filter((x) => x !== v))} /> {v}</label>)}</div><span>Cibles</span><div className="actions">{cibles.map((c) => <label key={c}><input type="checkbox" checked={cibleSelection.includes(c)} onChange={(e) => setCibleSelection(e.target.checked ? [...cibleSelection, c] : cibleSelection.filter((x) => x !== c))} /> {c}</label>)}</div></div></div>
    <div className="kpis"><Kpi icone="fiches" etiquette="Effectif simulé" valeur={total} /><Kpi icone="projets" etiquette="Villes sélectionnées" valeur={villeSelection.length} /><Kpi icone="clients" etiquette="Cibles sélectionnées" valeur={cibleSelection.length} /><Kpi icone="audit" etiquette="Quota / cible" valeur={parCible.length ? "simulé" : "—"} /></div>
    <div className="grille-2"><section className="panneau"><h2>Répartition simulée par ville</h2><div className="tableau"><table><thead><tr><th>Ville</th><th className="nombre">Fiches</th><th>État</th></tr></thead><tbody>{parVille.map(({ nom, quota }) => <tr key={nom}><td>{nom}</td><td className="nombre">{quota}</td><td><Badge ton="neutre">Simulation</Badge></td></tr>)}</tbody></table></div></section><section className="panneau"><h2>Répartition simulée par cible</h2><div className="tableau"><table><thead><tr><th>Cible</th><th className="nombre">Fiches</th></tr></thead><tbody>{parCible.map(({ nom, quota }) => <tr key={nom}><td>{nom}</td><td className="nombre">{quota}</td></tr>)}</tbody></table></div></section></div>
  </>;
}
