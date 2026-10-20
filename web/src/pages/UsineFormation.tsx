import { useState, type ReactNode } from "react";
import { EnTete, Badge, Kpi } from "../ui";

const modules = ["Protocole et posture d’enquête", "Utilisation du formulaire", "Consentement et confidentialité", "Quotas, villes et ciblage", "Contrôle qualité des fiches", "Synchronisation et signalement"];
export function UsineFormation(): ReactNode {
  const [terminees, setTerminees] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const basculer = (m: string): void => setTerminees((x) => x.includes(m) ? x.filter((v) => v !== m) : [...x, m]);
  const valider = (): void => setMessage(terminees.length === modules.length ? "Formation validée : enquêteur prêt à être affecté." : "Tous les modules doivent être terminés avant certification.");
  return <>
    <EnTete titre="Formation & certification" sous_titre="Préparez les enquêteurs avant l’activation d’une mission et conservez la preuve de formation." actions={<button onClick={valider}>Valider la certification</button>} />
    <div className="kpis"><Kpi icone="clients" etiquette="Modules" valeur={modules.length} /><Kpi icone="fiches" etiquette="Terminés" valeur={terminees.length} jauge={100 * terminees.length / modules.length} /><Kpi icone="bouclier" etiquette="Statut" valeur={terminees.length === modules.length ? "Prêt" : "En cours"} /></div>
    {message && <p className={terminees.length === modules.length ? "succes" : "avertissement"} role="status">{message}</p>}
    <div className="tableau"><table aria-label="Parcours de formation"><thead><tr><th>Module</th><th>Objectif</th><th>État</th><th /></tr></thead><tbody>{modules.map((m, i) => <tr key={m}><td><strong>{i + 1}. {m}</strong></td><td className="mention">Support et quiz de validation</td><td>{terminees.includes(m) ? <Badge ton="ok">Terminé</Badge> : <Badge ton="neutre">À faire</Badge>}</td><td><button className="secondaire" onClick={() => basculer(m)}>{terminees.includes(m) ? "Rouvrir" : "Marquer terminé"}</button></td></tr>)}</tbody></table></div>
  </>;
}
