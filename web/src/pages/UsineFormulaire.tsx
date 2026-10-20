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
  const [message, setMessage] = useState("");
  const ajouter = (): void => { const n = questions.length + 1; setQuestions([...questions, { code: `Q${n.toString().padStart(2, "0")}`, titre: "Nouvelle question", type: "Choix unique", obligatoire: false }]); };
  const basculer = (code: string): void => setQuestions(questions.map((q) => q.code === code ? { ...q, obligatoire: !q.obligatoire } : q));
  return <>
    <EnTete titre="Formulaire & dictionnaire" sous_titre="Construisez le questionnaire, ses variables, ses contrôles et ses versions depuis un même atelier." actions={<button onClick={ajouter}>+ Ajouter une question</button>} />
    <div className="kpis"><Kpi icone="fiches" etiquette="Questions" valeur={questions.length} /><Kpi icone="bouclier" etiquette="Obligatoires" valeur={questions.filter((q) => q.obligatoire).length} /><Kpi icone="audit" etiquette="Contrôles" valeur="À définir" detail="cohérence et qualité" /></div>
    <div className="panneau actions"><Badge ton="ok">Dictionnaire V01</Badge><span className="mention">Les modifications sont préparées dans une nouvelle version avant publication.</span><button className="secondaire" onClick={() => setMessage("Brouillon enregistré dans le dictionnaire de l’étude.")}>Enregistrer le brouillon</button>{message && <span className="succes" role="status">{message}</span>}</div>
    <div className="tableau"><table aria-label="Questions du dictionnaire"><thead><tr><th>Code</th><th>Libellé</th><th>Type</th><th>Obligatoire</th><th>Contrôles</th></tr></thead><tbody>{questions.map((q) => <tr key={q.code}><td><code>{q.code}</code></td><td>{q.titre}</td><td>{q.type}</td><td><button className="secondaire" onClick={() => basculer(q.code)}>{q.obligatoire ? "Oui" : "Non"}</button></td><td><Badge ton="neutre">À vérifier</Badge></td></tr>)}</tbody></table></div>
  </>;
}
