import { useMemo, useState, type ReactNode } from "react";
import { EnTete, Kpi, Badge } from "../ui";

const villes = ["Douala", "Yaoundé", "Bafoussam", "Dschang"];
const cibles = ["Particuliers", "Entreprises", "Artisans", "Distributeurs"];
export function UsineEchantillonnage(): ReactNode {
  const [taille, setTaille] = useState(400); const [villeSelection, setVilleSelection] = useState(villes.slice(0, 3)); const [cibleSelection, setCibleSelection] = useState(cibles.slice(0, 3));
  const total = Math.max(30, Number(taille) || 30); const parVille = useMemo(() => Object.fromEntries(villeSelection.map((v, i) => [v, Math.floor(total / villeSelection.length) + (i < total % villeSelection.length ? 1 : 0)])), [total, villeSelection]);
  const parCible = Math.floor(total / cibleSelection.length);
  return <>
    <EnTete titre="Échantillonnage & villes" sous_titre="Dimensionnez l’étude et préparez la répartition des quotas avant le déploiement terrain." />
    <div className="panneau"><div className="grille"><label htmlFor="taille-ech">Effectif cible</label><input id="taille-ech" type="number" min="30" max="20000" value={taille} onChange={(e) => setTaille(Number(e.target.value))} /><span>Villes</span><div className="actions">{villes.map((v) => <label key={v}><input type="checkbox" checked={villeSelection.includes(v)} onChange={(e) => setVilleSelection(e.target.checked ? [...villeSelection, v] : villeSelection.filter((x) => x !== v))} /> {v}</label>)}</div><span>Cibles</span><div className="actions">{cibles.map((c) => <label key={c}><input type="checkbox" checked={cibleSelection.includes(c)} onChange={(e) => setCibleSelection(e.target.checked ? [...cibleSelection, c] : cibleSelection.filter((x) => x !== c))} /> {c}</label>)}</div></div></div>
    <div className="kpis"><Kpi icone="fiches" etiquette="Effectif cible" valeur={total} /><Kpi icone="projets" etiquette="Villes" valeur={villeSelection.length} /><Kpi icone="clients" etiquette="Cibles" valeur={cibleSelection.length} /><Kpi icone="audit" etiquette="Quota / cible" valeur={parCible} /></div>
    <div className="grille-2"><section className="panneau"><h2>Répartition par ville</h2><div className="tableau"><table><thead><tr><th>Ville</th><th className="nombre">Fiches</th><th>État</th></tr></thead><tbody>{Object.entries(parVille).map(([v, n]) => <tr key={v}><td>{v}</td><td className="nombre">{n}</td><td><Badge ton="ok">Quota défini</Badge></td></tr>)}</tbody></table></div></section><section className="panneau"><h2>Répartition par cible</h2><div className="tableau"><table><thead><tr><th>Cible</th><th className="nombre">Fiches</th></tr></thead><tbody>{cibleSelection.map((c) => <tr key={c}><td>{c}</td><td className="nombre">{parCible}</td></tr>)}</tbody></table></div></section></div>
  </>;
}
