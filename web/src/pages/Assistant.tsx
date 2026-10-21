import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { EnTete } from "../ui";
import { api } from "../api";

type Preuve = { source: string; valeur: string };
type Message = { auteur: "Vous" | "DATA'A"; texte: string; outil?: string; redaction?: string; preuves?: Preuve[]; limites?: string[] };
type Projet = { id: string; nom: string; code: string };
type ReponseAssistant = { reponse: string; outil: string; redaction: string; preuves: Preuve[]; limites: string[] };
type Props = { usine: boolean };

const suggestions = ["Résume l'état de cette étude", "Où en sont les quotas par ville ?", "Donne le tri à plat de [variable]"];

export function Assistant({ usine }: Props): ReactNode {
  const [question, setQuestion] = useState("");
  const [projet, setProjet] = useState("");
  const [projets, setProjets] = useState<Projet[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { auteur: "DATA'A", texte: "Choisis une étude, puis demande son état, le suivi des quotas ou un tri à plat. Les réponses affichent leurs preuves." },
  ]);

  useEffect(() => {
    const chemin = usine ? "/api/usine/projets" : "/api/projets";
    void api<Projet[]>(chemin).then((items) => {
      setProjets(items);
      if (items[0]) setProjet(items[0].id);
    }).catch((e: Error) => setErreur(`Chargement des études impossible : ${e.message}`));
  }, [usine]);

  const envoyer = async (e?: FormEvent): Promise<void> => {
    e?.preventDefault();
    const q = question.trim();
    if (!q || envoi) return;
    setMessages((precedents) => [...precedents, { auteur: "Vous", texte: q }]);
    setQuestion("");
    setErreur("");
    setEnvoi(true);
    try {
      const r = await api<ReponseAssistant>("/api/assistant", {
        methode: "POST", corps: { question: q, projet: projet || undefined },
      });
      setMessages((precedents) => [...precedents, {
        auteur: "DATA'A", texte: r.reponse, outil: r.outil, redaction: r.redaction, preuves: r.preuves, limites: r.limites,
      }]);
    } catch (e) {
      setErreur(`Réponse indisponible : ${(e as Error).message}`);
    } finally {
      setEnvoi(false);
    }
  };

  return <>
    <EnTete titre="Copilote DATA'A" sous_titre="Suivi et analyses du projet, avec preuves consultables." />
    <div className="panneau assistant-projet">
      <label htmlFor="assistant-projet">Étude active</label>
      <select id="assistant-projet" value={projet} onChange={(e) => setProjet(e.target.value)}>
        <option value="">Contexte global</option>
        {projets.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
      </select>
    </div>
    <div className="assistant-layout">
      <section className="panneau assistant-fil" aria-label="Conversation avec DATA'A">
        <div className="assistant-messages" aria-live="polite">
          {messages.map((m, i) => <article className={`assistant-message ${m.auteur === "Vous" ? "assistant-moi" : ""}`} key={`${m.auteur}-${i}`}>
            <strong>{m.auteur}</strong><p>{m.texte}</p>
            {m.outil && <small>Outil : {m.outil}</small>}
            {m.redaction && <small> · Rédaction : {m.redaction === "ollama_local" ? "modèle local" : "réponse structurée"}</small>}
            {!!m.preuves?.length && <details className="assistant-preuves">
              <summary>Preuves ({m.preuves.length})</summary>
              <ul>{m.preuves.map((preuve, index) => <li key={`${preuve.source}-${index}`}><code>{preuve.source}</code><span>{preuve.valeur}</span></li>)}</ul>
            </details>}
            {!!m.limites?.length && <ul className="assistant-limites">{m.limites.map((limite) => <li key={limite}>{limite}</li>)}</ul>}
          </article>)}
          {envoi && <p role="status">Vérification des sources…</p>}
        </div>
        <div className="assistant-suggestions" aria-label="Questions suggérées">
          {suggestions.map((suggestion) => <button className="secondaire" key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}
        </div>
        <form className="assistant-saisie" onSubmit={(e) => void envoyer(e)}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Pose une question sur l'étude…" aria-label="Question à DATA'A" />
          <button type="submit" disabled={!question.trim() || envoi}>{envoi ? "Recherche…" : "Envoyer"}</button>
        </form>
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
      </section>
      <aside className="panneau assistant-garde">
        <h2>Mode opératoire</h2>
        <p>Outils métier DATA'A, sans action d'écriture</p>
        <p>Preuves attachées aux réponses</p>
        <p>Petits effectifs masqués</p>
        <p>Aucune publication automatique</p>
      </aside>
    </div>
  </>;
}
