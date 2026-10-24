import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import { useSession } from "../App";
import { Badge, EnTete, Kpi } from "../ui";

// Éditeur du dictionnaire d'un projet (1re source de vérité) : GET/PUT /api/usine/projets/{id}/dictionnaire.
// Seuls les textes et l'obligation se modifient ici ; ajout et suppression de questions, conditions et règles de
// cohérence restent hors de l'éditeur. Le serveur valide le dictionnaire complet et refuse tout écart avec le projet.
type Textes = Record<string, string>;
type Modalite = { code: number; libelles: Textes; [cle: string]: unknown };
type Question = {
  numero: number; code: string; section: string; libelles: Textes; type: string; obligatoire: boolean;
  aide: Textes; modalites: Modalite[]; role: string | null; condition: string | null; [cle: string]: unknown;
};
type Section = { id: string; libelles: Textes };
type Dictionnaire = { langue_reference: string; langues: string[]; sections: Section[]; questions: Question[]; [cle: string]: unknown };
type Changement = { type: string; question: string; detail: string; migration: boolean };
type Vue = {
  version: string; statut: string; etude: string; langue_reference: string; nb_fiches: number; modifiable: boolean;
  dictionnaire: Dictionnaire; ecarts: string[]; changements?: Changement[];
};
type ProjetListe = { id: string; code: string; nom: string };

const TYPES: Record<string, string> = {
  choix_unique: "Choix unique", choix_multiple: "Choix multiple", grille: "Grille", texte: "Texte libre", numerique: "Numérique", date: "Date",
};

const copier = (qs: Question[]): Question[] =>
  qs.map((q) => ({ ...q, libelles: { ...q.libelles }, aide: { ...q.aide }, modalites: q.modalites.map((m) => ({ ...m, libelles: { ...m.libelles } })) }));

export function UsineFormulaire(): ReactNode {
  const { moi } = useSession();
  const peutPiloter = (moi?.permissions ?? []).includes("projet.piloter");
  const [projets, setProjets] = useState<ProjetListe[]>([]);
  const [projetId, setProjetId] = useState("");
  const [vue, setVue] = useState<Vue | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [changements, setChangements] = useState<Changement[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const appliquer = useCallback((v: Vue): void => { setVue(v); setQuestions(copier(v.dictionnaire.questions)); }, []);

  const charger = useCallback((id: string): void => {
    setErreur(""); setMessage(""); setChangements(null); setVue(null);
    api<Vue>(`/api/usine/projets/${id}/dictionnaire`).then(appliquer).catch((e: Error) => setErreur(e.message));
  }, [appliquer]);

  useEffect(() => {
    api<ProjetListe[]>("/api/usine/projets")
      .then((liste) => { setProjets(liste); if (liste.length) setProjetId(liste[0].id); })
      .catch((e: Error) => setErreur(e.message));
  }, []);

  useEffect(() => { if (projetId) charger(projetId); }, [projetId, charger]);

  const lr = vue?.langue_reference ?? "fr";
  const editable = peutPiloter && vue !== null && vue.modifiable;
  const modifie = vue !== null && JSON.stringify(questions) !== JSON.stringify(vue.dictionnaire.questions);
  const vides = useMemo(() => questions.flatMap((q) => [
    ...(q.libelles[lr]?.trim() ? [] : [`Q${q.numero} : libellé vide`]),
    ...q.modalites.filter((m) => !m.libelles[lr]?.trim()).map((m) => `Q${q.numero} : modalité ${m.code} sans libellé`),
  ]), [questions, lr]);
  const sections = useMemo(() => vue?.dictionnaire.sections ?? [], [vue]);

  const modifier = (code: string, f: (q: Question) => Question): void =>
    setQuestions(questions.map((q) => (q.code === code ? f(q) : q)));
  const libelle = (code: string, texte: string): void => modifier(code, (q) => ({ ...q, libelles: { ...q.libelles, [lr]: texte } }));
  const aide = (code: string, texte: string): void => modifier(code, (q) => {
    const a = { ...q.aide };
    if (texte === "") delete a[lr]; else a[lr] = texte;
    return { ...q, aide: a };
  });
  const modalite = (code: string, mc: number, texte: string): void => modifier(code, (q) => ({
    ...q, modalites: q.modalites.map((m) => (m.code === mc ? { ...m, libelles: { ...m.libelles, [lr]: texte } } : m)),
  }));

  const enregistrer = async (): Promise<void> => {
    if (!vue) return;
    setEnvoi(true); setErreur(""); setMessage(""); setChangements(null);
    try {
      const nouvelle = await api<Vue>(`/api/usine/projets/${projetId}/dictionnaire`, {
        methode: "PUT", corps: { version: vue.version, dictionnaire: { ...vue.dictionnaire, questions } },
      });
      appliquer(nouvelle);
      setChangements(nouvelle.changements ?? []);
      setMessage(`Dictionnaire enregistré : version ${nouvelle.version} (l’ancienne version ${vue.version} est archivée).`);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  const recodages = (changements ?? []).filter((c) => c.migration).length;

  return <>
    <EnTete titre="Formulaire & dictionnaire" sous_titre="Dictionnaire enregistré dans le dossier du projet, versionné et audité."
      actions={editable ? <button onClick={() => void enregistrer()} disabled={!modifie || envoi || vides.length > 0}>
        {envoi ? "Enregistrement…" : "Enregistrer le dictionnaire"}</button> : undefined} />
    <div className="panneau"><form className="grille" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="projet-dico">Projet</label>
      <select id="projet-dico" value={projetId} onChange={(e) => setProjetId(e.target.value)}>
        {projets.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>)}
      </select>
    </form></div>
    {erreur && <div className="erreur" role="alert">{erreur}
      {vue && <> <button className="secondaire" onClick={() => charger(projetId)}>Recharger le dictionnaire</button></>}</div>}
    {message && <p className="succes" role="status">{message}</p>}
    {changements && <section className="panneau" aria-label="Changements enregistrés"><h2>Changements enregistrés</h2>
      {changements.length === 0 ? <p className="mention">Aucun changement de fond (casse, accents ou espaces seulement).</p> : <>
        {recodages > 0 && <p className="avertissement" role="alert">{recodages} changement(s) imposent un recodage des données déjà collectées.</p>}
        <div className="tableau"><table aria-label="Liste des changements">
          <thead><tr><th>Question</th><th>Changement</th><th>Détail</th><th>Recodage</th></tr></thead>
          <tbody>{changements.map((c, i) => <tr key={i}><td><code>{c.question}</code></td><td>{c.type}</td><td>{c.detail}</td>
            <td>{c.migration ? <Badge ton="alerte">Recodage</Badge> : <Badge ton="neutre">Non</Badge>}</td></tr>)}</tbody>
        </table></div></>}
    </section>}
    {vue && <>
      <div className="kpis">
        <Kpi icone="fiches" etiquette="Version" valeur={vue.version} detail={vue.statut === "brouillon" ? "brouillon (import à revoir)" : vue.etude} />
        <Kpi icone="etudes" etiquette="Questions" valeur={questions.length} detail={`${questions.filter((q) => q.obligatoire).length} obligatoire(s)`} />
        <Kpi icone="projets" etiquette="Fiches collectées" valeur={vue.nb_fiches} />
        <Kpi icone="bouclier" etiquette="État" valeur={vue.modifiable ? "Modifiable" : "Verrouillé"}
          detail={vue.modifiable ? "aucune fiche reçue" : "collecte commencée"} />
      </div>
      {!vue.modifiable && <p className="avertissement" role="note">Collecte commencée ({vue.nb_fiches} fiche(s)) : le dictionnaire est gelé.
        Toute modification passe par une nouvelle version testée hors de cet écran.</p>}
      {!peutPiloter && <p className="mention">Lecture seule : la modification du dictionnaire est réservée aux rôles qui pilotent le projet.</p>}
      {vue.ecarts.length > 0 && <div className="avertissement" role="alert"><strong>Écarts entre les sources du projet</strong>
        <ul>{vue.ecarts.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      {editable && vides.length > 0 && <div className="avertissement" role="alert"><strong>Libellés manquants</strong>
        <ul>{vides.map((v) => <li key={v}>{v}</li>)}</ul></div>}
      <p className="mention">Textes en langue de référence ({lr}). Ajout et suppression de questions, conditions d’affichage et règles de
        cohérence ne se modifient pas ici. Renommer une cible ou une ville du brief est refusé par le serveur.</p>
      {sections.map((s) => {
        const qs = questions.filter((q) => q.section === s.id);
        if (!qs.length) return null;
        return <section key={s.id} className="panneau"><h2>{s.libelles[lr] ?? s.id}</h2>
          {qs.map((q) => <fieldset key={q.code} className="question-dico" aria-label={`Question ${q.code}`}
            style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.8rem 1rem", margin: "0.7rem 0" }}>
            <legend><code>{q.code}</code> — Q{q.numero} · {TYPES[q.type] ?? q.type}
              {q.role === "cible" && <> <Badge ton="info">Cible des quotas</Badge></>}
              {q.condition && <> <Badge ton="neutre">Condition : {q.condition}</Badge></>}</legend>
            <form className="grille" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor={`lib-${q.code}`}>Libellé</label>
              <input id={`lib-${q.code}`} aria-label={`Libellé ${q.code}`} disabled={!editable} value={q.libelles[lr] ?? ""}
                onChange={(e) => libelle(q.code, e.target.value)} />
              <label htmlFor={`aide-${q.code}`}>Aide</label>
              <input id={`aide-${q.code}`} aria-label={`Aide ${q.code}`} disabled={!editable} value={q.aide[lr] ?? ""} placeholder="(facultatif)"
                onChange={(e) => aide(q.code, e.target.value)} />
              <label htmlFor={`obl-${q.code}`}>Obligatoire</label>
              <span><input id={`obl-${q.code}`} type="checkbox" aria-label={`Obligatoire ${q.code}`} checked={q.obligatoire}
                disabled={!editable || q.role === "cible"} onChange={(e) => modifier(q.code, (x) => ({ ...x, obligatoire: e.target.checked }))} />
                {q.role === "cible" && <span className="mention"> la question de cible reste obligatoire</span>}</span>
              {q.modalites.map((m) => <ModaliteChamp key={m.code} q={q} m={m} lr={lr} editable={editable} changer={modalite} />)}
            </form>
          </fieldset>)}
        </section>;
      })}
    </>}
  </>;
}

function ModaliteChamp({ q, m, lr, editable, changer }:
  { q: Question; m: Modalite; lr: string; editable: boolean; changer: (code: string, mc: number, texte: string) => void }): ReactNode {
  const id = `mod-${q.code}-${m.code}`;
  return <>
    <label htmlFor={id} className="mention">Modalité {m.code}</label>
    <input id={id} aria-label={`Modalité ${m.code} de ${q.code}`} disabled={!editable} value={m.libelles[lr] ?? ""}
      onChange={(e) => changer(q.code, m.code, e.target.value)} />
  </>;
}
