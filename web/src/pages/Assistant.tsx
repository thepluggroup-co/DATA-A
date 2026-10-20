import { useEffect, useState, type ReactNode } from "react";
import { EnTete } from "../ui";
import { api } from "../api";

type Message = { auteur: "Vous" | "DATA’A"; texte: string };
type Projet = { id: string; nom: string; code: string };
const suggestions = ["Résume l’état de cette étude", "Quelles données manquent pour conclure ?", "Propose les contrôles qualité à appliquer"];

export function Assistant(): ReactNode {
  const [question, setQuestion] = useState("");
  const [projet, setProjet] = useState("");
  const [projets, setProjets] = useState<Projet[]>([]);
  const [messages, setMessages] = useState<Message[]>([{ auteur: "DATA’A", texte: "Je suis le copilote gouverné. Sélectionnez une étude pour relier les réponses à ses preuves, analyses et validations." }]);
  useEffect(() => { void api<Projet[]>("/api/usine/projets").then((items) => { setProjets(items); if (items[0]) setProjet(items[0].id); }).catch(() => undefined); }, []);
  const envoyer = (): void => {
    const q = question.trim(); if (!q) return;
    setMessages((m) => [...m, { auteur: "Vous", texte: q }]); setQuestion("");
    void api<{ reponse: string; limites: string[] }>("/api/assistant", { methode: "POST", corps: { question: q, projet: projet || undefined } })
      .then((r) => setMessages((m) => [...m, { auteur: "DATA’A", texte: `${r.reponse} Limites : ${r.limites.join(" ; ")}.` }]))
      .catch((e: Error) => setMessages((m) => [...m, { auteur: "DATA’A", texte: `Assistant indisponible : ${e.message}` }]));
  };
  return <><EnTete titre="Copilote IA" sous_titre="Assistant contrôlé, explicable et relié aux preuves." /><div className="panneau" style={{ marginBottom: "1rem" }}><label htmlFor="assistant-projet">Étude active</label><select id="assistant-projet" value={projet} onChange={(e) => setProjet(e.target.value)}><option value="">Contexte global</option>{projets.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}</select></div><div className="assistant-layout"><section className="panneau assistant-fil" aria-label="Conversation IA">{messages.map((m, i) => <div className={`assistant-message ${m.auteur === "Vous" ? "assistant-moi" : ""}`} key={`${m.auteur}-${i}`}><strong>{m.auteur}</strong><p>{m.texte}</p></div>)}<div className="assistant-suggestions">{suggestions.map((s) => <button className="secondaire" key={s} onClick={() => setQuestion(s)}>{s}</button>)}</div><div className="assistant-saisie"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") envoyer(); }} placeholder="Posez une question sur l’étude…" aria-label="Question à DATA’A" /><button onClick={envoyer}>Envoyer</button></div></section><aside className="panneau assistant-garde"><h2>Garde-fous</h2><p>Preuves et méthode obligatoires</p><p>Version et règle citées</p><p>Limites affichées</p><p>Validation humaine avant livraison</p></aside></div></>;
}
