import { useEffect, useState, type ReactNode } from "react";
import { EnTete, Badge } from "../ui";
import { api } from "../api";
type Item = { id: string; constat: string; preuve: string; action: string; risque: string; priorite: string; statut: string };
type Projet = { id: string; nom: string };
export function UsineRecommandations(): ReactNode {
  const [projet, setProjet] = useState<Projet | null>(null), [items, setItems] = useState<Item[]>([]), [message, setMessage] = useState("");
  useEffect(() => { void api<Projet[]>("/api/usine/projets").then((p) => { const x = p[0]; setProjet(x ?? null); if (x) void api<Item[]>(`/api/cabinet/projets/${x.id}/recommandations`).then(setItems); }).catch((e: Error) => setMessage(e.message)); }, []);
  const decision = (x: Item, d: "validee" | "rejetee"): void => { if (!projet) return; const commentaire = d === "rejetee" ? window.prompt("Commentaire du rejet") ?? "" : "Validation experte"; if (d === "rejetee" && !commentaire.trim()) return; void api<Item>(`/api/cabinet/projets/${projet.id}/recommandations/${x.id}/decision`, { methode: "POST", corps: { decision: d, commentaire, preuve: x.preuve } }).then((r) => setItems((v) => v.map((i) => i.id === x.id ? r : i))).catch((e: Error) => setMessage(e.message)); };
  return <><EnTete titre="Recommandations" sous_titre="Constat, preuve, action et validation experte." />{message && <p className="erreur" role="alert">{message}</p>}<div className="grille-modules">{items.map((x) => <article className="module-erp" key={x.id}><div className="module-corps"><Badge ton={x.statut === "validee" ? "ok" : "alerte"}>{x.statut}</Badge><h2>{x.constat}</h2><p className="mention">Preuve : {x.preuve}</p><p>{x.action}</p><p className="mention">Risque : {x.risque} · Priorité : {x.priorite}</p></div><div className="module-pied"><button onClick={() => decision(x, "validee")}>Valider</button><button className="secondaire" onClick={() => decision(x, "rejetee")}>Rejeter</button></div></article>)}</div></>;
}
