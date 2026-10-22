import { useState, type ReactNode } from "react";
import { EnTete, Badge, Kpi } from "../ui";

type Question = { code: string; titre: string; type: string; obligatoire: boolean };
const initial: Question[] = [
  { code: "VOUSETES", titre: "Profil du répondant", type: "Choix unique", obligatoire: true },
  { code: "VILLEREG", titre: "Ville / région", type: "Choix unique", obligatoire: true },
  { code: "PRODACHE", titre: "Produits achetés", type: "Choix multiple", obligatoire: false },
  { code: "PRCRICHO", titre: "Principal critère de choix", type: "Choix unique", obligatoire: true },
  { code: "SUGGATTE", titre: "Suggestion / attente", type: "Texte libre", obligatoire: false },
];

export function UsineFormulaire(): ReactNode {
  const [questions, setQuestions] = useState(initial);
  const ajouter = (): void => { const n = questions.length + 1; setQuestions([...questions, { code: `Q${n.toString().padStart(2, "0")}`, titre: "Nouvelle question", type: "Choix unique", obligatoire: false }]); };
  const basculer = (code: string): void => setQuestions(questions.map((q) => q.code === code ? { ...q, obligatoire: !q.obligatoire } : q));
  return <>
            <EnTete titre="Formulaire & dictionnaire" sous_titre="Atelier de démonstration non relié à un projet."
              actions={<button onClick={ajouter}>+ Ajouter une question</button>} />
    <div className="kpis"><Kpi icone="fiches" etiquette="Questions" valeur={questions.length} /><Kpi icone="bouclier" etiquette="Obligatoires" valeur={questions.filter((q) => q.obligatoire).length} /><Kpi icone="audit" etiquette="Contrôles" valeur="À définir" detail="cohérence et qualité" /></div>
    <div className="panneau actions"><Badge ton="alerte">Prototype local</Badge><span className="mention">Les changements restent dans cette page et seront perdus au rechargement. Aucun brouillon n’est enregistré.</span></div>
    <div className="tableau"><table aria-label="Questions du dictionnaire"><thead><tr><th>Code</th><th>Libellé</th><th>Type</th><th>Obligatoire</th><th>Contrôles</th></tr></thead><tbody>{questions.map((q) => <tr key={q.code}><td><code>{q.code}</code></td><td>{q.titre}</td><td>{q.type}</td><td><button className="secondaire" onClick={() => basculer(q.code)}>{q.obligatoire ? "Oui" : "Non"}</button></td><td><Badge ton="neutre">À vérifier</Badge></td></tr>)}</tbody></table></div>
  </>;
}
