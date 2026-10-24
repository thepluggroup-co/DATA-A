import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import { useSession } from "../App";
import { Badge, EnTete, Kpi } from "../ui";
import { DiffusionLiens } from "./formulaire/Diffusion";
import { EditeurQuestion } from "./formulaire/EditeurQuestion";
import {
  AVEC_MODALITES, TYPES, copie, nettoyer, proposerCode, renumeroter, variablesPrises,
  type Changement, type Dictionnaire, type Question, type Regle, type Section, type Verification, type Vue,
} from "./formulaire/outils";

// Atelier du formulaire (M4) : le dictionnaire du projet (1re source de vérité) s'édite ici en entier — questions, types,
// modalités, « Autre », grilles, conditions, sections, langues, règles de cohérence — puis se vérifie à blanc et
// s'enregistre en version suivante (GET/PUT /api/usine/projets/{id}/dictionnaire). Le formulaire de l'application
// enquêteur, le masque et l'export SPSS en dérivent : rien n'est ressaisi. Gel dès la première fiche reçue (CLAUDE.md §5).
type ProjetListe = { id: string; code: string; nom: string };
type Ligne = { cle: string; q: Question; auto: boolean };
type Onglet = "questions" | "structure" | "regles" | "apercu" | "diffusion";
const ONGLETS: [Onglet, string][] = [["questions", "Questions"], ["structure", "Structure & langues"], ["regles", "Règles de cohérence"],
  ["apercu", "Aperçu"], ["diffusion", "Diffusion des liens"]];
const CLE_BROUILLON = (projet: string): string => `dataa:brouillon-dictionnaire:${projet}`;
let compteur = 0;
const nouvelleCle = (): string => `q${(compteur += 1)}`;

function lire(projet: string): { version: string; dictionnaire: Dictionnaire } | null {
  try { const t = localStorage.getItem(CLE_BROUILLON(projet)); return t ? JSON.parse(t) : null; } catch { return null; }
}
function ecrire(projet: string, valeur: { version: string; dictionnaire: Dictionnaire } | null): void {
  try { if (valeur) localStorage.setItem(CLE_BROUILLON(projet), JSON.stringify(valeur)); else localStorage.removeItem(CLE_BROUILLON(projet)); } catch { /* stockage indisponible */ }
}

/** Questions regroupées dans l'ordre des sections (ordre stable). Les numéros sont gardés tant qu'ils croissent dans
 * cet ordre (une suppression ne renumérote pas les suivantes) ; sinon (ajout, déplacement) ils deviennent 1…n. */
function ordonner(lignes: Ligne[], sections: Section[]): Ligne[] {
  const rang = new Map(sections.map((s, i) => [s.id, i]));
  const triees = lignes.map((l, i) => ({ l, i })).sort((a, b) => ((rang.get(a.l.q.section) ?? 99) - (rang.get(b.l.q.section) ?? 99)) || a.i - b.i).map((x) => x.l);
  if (triees.every((l, i) => l.q.numero >= 1 && (i === 0 || l.q.numero > triees[i - 1].q.numero))) return triees;
  const qs = renumeroter(triees.map((l) => l.q));
  return triees.map((l, i) => ({ ...l, q: qs[i] }));
}

export function UsineFormulaire(): ReactNode {
  const { moi } = useSession();
  const peutPiloter = (moi?.permissions ?? []).includes("projet.piloter");
  const [projets, setProjets] = useState<ProjetListe[]>([]);
  const [projetId, setProjetId] = useState("");
  const [vue, setVue] = useState<Vue | null>(null);
  const [base, setBase] = useState<Dictionnaire | null>(null);           // tout sauf les questions
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [onglet, setOnglet] = useState<Onglet>("questions");
  const [langue, setLangue] = useState("fr");
  const [verif, setVerif] = useState<Verification | null>(null);
  const [changements, setChangements] = useState<Changement[] | null>(null);
  const [alertes, setAlertes] = useState<string[]>([]);
  const [brouillonTrouve, setBrouillonTrouve] = useState<Dictionnaire | null>(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const poser = useCallback((d: Dictionnaire): void => {
    setBase(copie(d));
    setLignes(copie(d.questions).map((q) => ({ cle: nouvelleCle(), q, auto: false })));
  }, []);
  const appliquer = useCallback((v: Vue): void => { setVue(v); poser(v.dictionnaire); setLangue(v.langue_reference); setVerif(null); }, [poser]);

  const charger = useCallback((id: string): void => {
    setErreur(""); setMessage(""); setChangements(null); setVue(null); setBrouillonTrouve(null);
    api<Vue>(`/api/usine/projets/${id}/dictionnaire`).then((v) => {
      appliquer(v);
      const b = lire(id);
      if (b && b.version === v.version && JSON.stringify(nettoyer(b.dictionnaire)) !== JSON.stringify(nettoyer(v.dictionnaire)) && v.modifiable) setBrouillonTrouve(b.dictionnaire);
      else if (b) ecrire(id, null);
    }).catch((e: Error) => setErreur(e.message));
  }, [appliquer]);

  useEffect(() => {
    api<ProjetListe[]>("/api/usine/projets")
      .then((liste) => { setProjets(liste); if (liste.length) setProjetId(liste[0].id); })
      .catch((e: Error) => setErreur(e.message));
  }, []);
  useEffect(() => { if (projetId) charger(projetId); }, [projetId, charger]);

  const ordonnees = useMemo(() => ordonner(lignes, base?.sections ?? []), [lignes, base]);
  const construit = useMemo<Dictionnaire | null>(() => (base ? { ...base, questions: ordonnees.map((l) => l.q) } : null), [base, ordonnees]);
  const lr = vue?.langue_reference ?? "fr";
  const editable = peutPiloter && vue !== null && vue.modifiable;
  const modifie = !!(vue && construit) && JSON.stringify(nettoyer(construit)) !== JSON.stringify(nettoyer(vue.dictionnaire));

  // Brouillon local (ce navigateur seulement) et alerte avant de quitter une page modifiée
  useEffect(() => {
    if (!vue || !construit || brouillonTrouve) return;
    ecrire(projetId, modifie ? { version: vue.version, dictionnaire: construit } : null);
  }, [construit, modifie, vue, projetId, brouillonTrouve]);
  useEffect(() => {
    if (!modifie) return undefined;
    const avant = (e: BeforeUnloadEvent): void => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avant);
    return () => window.removeEventListener("beforeunload", avant);
  }, [modifie]);

  const vides = useMemo(() => ordonnees.flatMap(({ q }) => [
    ...(q.libelles[lr]?.trim() ? [] : [`Q${q.numero} (${q.code}) : libellé vide`]),
    ...q.modalites.filter((m) => !m.libelles[lr]?.trim()).map((m) => `Q${q.numero} (${q.code}) : modalité ${m.code} sans libellé`),
  ]), [ordonnees, lr]);

  const majLignes = (f: (ls: Ligne[]) => Ligne[]): void => { setLignes(f); setVerif(null); };
  const majBase = (f: (d: Dictionnaire) => Dictionnaire): void => { setBase((d) => (d ? f(d) : d)); setVerif(null); };
  const changer = (cle: string, q: Question, codeManuel = false): void =>
    majLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, q, auto: l.auto && !codeManuel } : l)));
  const deplacer = (cle: string, sens: -1 | 1): void => majLignes((ls) => {
    const i = ls.findIndex((l) => l.cle === cle);
    let j = i + sens;
    while (j >= 0 && j < ls.length && ls[j].q.section !== ls[i].q.section) j += sens;
    if (j < 0 || j >= ls.length) return ls;
    const x = [...ls]; [x[i], x[j]] = [x[j], x[i]]; return x;
  });
  const ajouter = (section: string): void => {
    if (!construit) return;
    const pris = variablesPrises(construit);
    const q: Question = { numero: 0, code: proposerCode("Nouvelle question", pris), section, libelles: { [lr]: "Nouvelle question" }, type: "choix_unique",
      mesure: "NOMINAL", obligatoire: true, aide: {}, modalites: [{ code: 1, libelles: { [lr]: "Modalité 1" } }, { code: 2, libelles: { [lr]: "Modalité 2" } }],
      autre: null, lignes: [], condition: null, role: null, prerempli: null, longueur: 500 };
    const derniere = lignes.map((l) => l.q.section).lastIndexOf(section);
    majLignes((ls) => [...ls.slice(0, derniere + 1), { cle: nouvelleCle(), q, auto: true }, ...ls.slice(derniere + 1)]);
    setMessage(`Question ${q.code} ajoutée : renseignez son libellé (le code suit le libellé tant que vous ne le modifiez pas).`);
  };
  const dupliquer = (cle: string): void => {
    if (!construit) return;
    const pris = variablesPrises(construit);
    majLignes((ls) => {
      const i = ls.findIndex((l) => l.cle === cle);
      const q = copie(ls[i].q);
      q.code = proposerCode(`${q.libelles[lr] ?? ""} copie`, pris);
      q.modalites = q.modalites.map((m) => (m.variable ? { ...m, variable: proposerCode(`${q.code} ${m.code}`, pris) } : m));
      q.lignes = q.lignes.map((l, k) => ({ ...l, variable: proposerCode(`${q.code} ligne ${k + 1}`, pris) }));
      if (q.autre) q.autre = { ...q.autre, variable: proposerCode(`${q.code} autre`, pris) };
      return [...ls.slice(0, i + 1), { cle: nouvelleCle(), q, auto: false }, ...ls.slice(i + 1)];
    });
  };
  const supprimer = (cle: string): void => {
    const l = lignes.find((x) => x.cle === cle);
    if (!l || !window.confirm(`Supprimer la question ${l.q.code} (Q${l.q.numero}) ? Les conditions et règles qui la citent devront être corrigées.`)) return;
    majLignes((ls) => ls.filter((x) => x.cle !== cle));
  };

  const corps = (): unknown => ({ version: vue?.version, dictionnaire: construit ? nettoyer(construit) : null });
  const verifier = async (): Promise<void> => {
    setEnvoi(true); setErreur(""); setMessage("");
    try {
      const v = await api<Verification>(`/api/usine/projets/${projetId}/dictionnaire/verifier`, { methode: "POST", corps: corps() });
      setVerif(v);
      setMessage(v.valide ? `Vérification réussie : enregistrable en version ${v.version_suivante}.` : "");
    } catch (e) { setErreur((e as Error).message); } finally { setEnvoi(false); }
  };
  const enregistrer = async (): Promise<void> => {
    if (!vue) return;
    setEnvoi(true); setErreur(""); setMessage(""); setChangements(null);
    try {
      const nouvelle = await api<Vue>(`/api/usine/projets/${projetId}/dictionnaire`, { methode: "PUT", corps: corps() });
      ecrire(projetId, null);
      appliquer(nouvelle);
      setChangements(nouvelle.changements ?? []);
      setAlertes(nouvelle.alertes ?? []);
      setMessage(`Dictionnaire enregistré : version ${nouvelle.version} (l’ancienne version ${vue.version} est archivée). Le formulaire de l’application enquêteur suit cette version.`);
    } catch (e) { setErreur((e as Error).message); } finally { setEnvoi(false); }
  };
  const annuler = (): void => {
    if (!vue || !window.confirm("Abandonner toutes les modifications non enregistrées ?")) return;
    ecrire(projetId, null); poser(vue.dictionnaire); setVerif(null); setMessage("Modifications abandonnées.");
  };

  return <>
    <EnTete titre="Formulaire & dictionnaire" sous_titre="Questionnaire du projet : édition complète, vérification, versions et diffusion des liens aux enquêteurs."
      actions={editable && onglet !== "diffusion" ? <>
        <button className="secondaire" onClick={annuler} disabled={!modifie || envoi}>Annuler les modifications</button>
        <button className="secondaire" onClick={() => void verifier()} disabled={!modifie || envoi}>Vérifier</button>
        <button onClick={() => void enregistrer()} disabled={!modifie || envoi || vides.length > 0}>{envoi ? "Enregistrement…" : "Enregistrer le dictionnaire"}</button>
      </> : undefined} />
    <div className="panneau"><form className="grille" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="projet-dico">Projet</label>
      <select id="projet-dico" value={projetId} onChange={(e) => {
        if (modifie && !window.confirm("Des modifications ne sont pas enregistrées (un brouillon est gardé dans ce navigateur). Changer de projet ?")) return;
        setProjetId(e.target.value);
      }}>{projets.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>)}</select>
      {vue && vue.dictionnaire.langues.length > 1 && <>
        <label htmlFor="langue-dico">Langue d’édition</label>
        <select id="langue-dico" value={langue} onChange={(e) => setLangue(e.target.value)}>
          {(base?.langues ?? []).map((l) => <option key={l} value={l}>{l === lr ? `${l} (référence)` : l}</option>)}
        </select></>}
    </form></div>
    {erreur && <div className="erreur" role="alert">{erreur}
      {vue && <> <button className="secondaire" onClick={() => charger(projetId)}>Recharger le dictionnaire</button></>}</div>}
    {message && <p className="succes" role="status">{message}</p>}
    {brouillonTrouve && <div className="avertissement" role="alert">Un brouillon non enregistré de cette version a été retrouvé dans ce navigateur.
      {" "}<button onClick={() => { poser(brouillonTrouve); setBrouillonTrouve(null); }}>Reprendre le brouillon</button>
      {" "}<button className="secondaire" onClick={() => { ecrire(projetId, null); setBrouillonTrouve(null); }}>L’ignorer</button></div>}
    {changements && <section className="panneau" aria-label="Changements enregistrés"><h2>Changements enregistrés</h2>
      <TableChangements changements={changements} titre="Liste des changements" />
      {alertes.length > 0 && <ListeMessages titre="Alertes du formulaire" lignes={alertes} ton="avertissement" />}
    </section>}
    {verif && <section className="panneau" aria-label="Résultat de la vérification"><h2>Vérification {verif.valide ? <Badge ton="ok">Enregistrable</Badge> : <Badge ton="alerte">À corriger</Badge>}</h2>
      {verif.erreurs.length > 0 && <ListeMessages titre="Erreurs (enregistrement refusé)" lignes={verif.erreurs} ton="erreur" />}
      {verif.blocages.length > 0 && <ListeMessages titre="Blocages du formulaire (enregistrement refusé)" lignes={verif.blocages} ton="erreur" />}
      {verif.alertes.length > 0 && <ListeMessages titre="Alertes à lire" lignes={verif.alertes} ton="avertissement" />}
      {verif.changements.length > 0 && <TableChangements changements={verif.changements} titre="Changements prévus" />}
    </section>}
    {vue && base && construit && <>
      <div className="kpis">
        <Kpi icone="fiches" etiquette="Version" valeur={vue.version} detail={vue.statut === "brouillon" ? "brouillon (import à revoir)" : vue.etude} />
        <Kpi icone="etudes" etiquette="Questions" valeur={lignes.length} detail={`${lignes.filter((l) => l.q.obligatoire).length} obligatoire(s)`} />
        <Kpi icone="projets" etiquette="Fiches collectées" valeur={vue.nb_fiches} />
        <Kpi icone="bouclier" etiquette="État" valeur={vue.modifiable ? (modifie ? "Modifié" : "Modifiable") : "Verrouillé"}
          detail={vue.modifiable ? (modifie ? "non enregistré" : "aucune fiche reçue") : "collecte commencée"} />
      </div>
      <div className="onglets" role="tablist" aria-label="Sections de l’atelier">
        {ONGLETS.map(([k, v]) => <button key={k} role="tab" aria-selected={onglet === k} onClick={() => setOnglet(k)}>{v}</button>)}
      </div>
      {!vue.modifiable && onglet !== "diffusion" && <p className="avertissement" role="note">Collecte commencée ({vue.nb_fiches} fiche(s)) : le dictionnaire est gelé.
        Toute modification passe par une nouvelle version testée hors terrain.</p>}
      {!peutPiloter && <p className="mention">Lecture seule : la modification est réservée aux rôles qui pilotent le projet.</p>}
      {vue.ecarts.length > 0 && <div className="avertissement" role="alert"><strong>Écarts entre les sources du projet</strong>
        <ul>{vue.ecarts.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      {editable && vides.length > 0 && onglet === "questions" && <ListeMessages titre="Libellés manquants" lignes={vides} ton="avertissement" />}

      {onglet === "questions" && base.sections.map((s) => {
        const ls = ordonnees.filter((l) => l.q.section === s.id);
        return <section key={s.id} className="panneau"><h2>{s.libelles[langue] ?? s.libelles[lr] ?? s.id}</h2>
          {ls.length === 0 && <p className="mention">Aucune question dans cette section.</p>}
          {ls.map((l, i) => <EditeurQuestion key={l.cle} q={l.q} d={construit} langue={langue} editable={editable} premier={i === 0} dernier={i === ls.length - 1}
            codeAuto={l.auto} changer={(q, manuel) => changer(l.cle, q, manuel)} deplacer={(sens) => deplacer(l.cle, sens)}
            dupliquer={() => dupliquer(l.cle)} supprimer={() => supprimer(l.cle)} />)}
          {editable && <button className="secondaire" onClick={() => ajouter(s.id)}>Ajouter une question dans « {s.libelles[lr] ?? s.id} »</button>}
        </section>;
      })}
      {onglet === "structure" && <Structure d={construit} editable={editable} lr={lr} majBase={majBase} />}
      {onglet === "regles" && <Regles regles={base.regles_coherence} editable={editable} lr={lr}
        changer={(r) => majBase((d) => ({ ...d, regles_coherence: r }))} />}
      {onglet === "apercu" && <Apercu d={construit} langue={langue} />}
      {onglet === "diffusion" && <DiffusionLiens projetId={projetId} pilote={peutPiloter} />}
    </>}
  </>;
}

function ListeMessages({ titre, lignes, ton }: { titre: string; lignes: string[]; ton: "erreur" | "avertissement" }): ReactNode {
  return <div className={ton} role="alert"><strong>{titre}</strong><ul>{lignes.map((x, i) => <li key={i}>{x}</li>)}</ul></div>;
}

function TableChangements({ changements, titre }: { changements: Changement[]; titre: string }): ReactNode {
  if (!changements.length) return <p className="mention">Aucun changement de fond (casse, accents ou espaces seulement).</p>;
  const recodages = changements.filter((c) => c.migration).length;
  return <>
    {recodages > 0 && <p className="avertissement" role="alert">{recodages} changement(s) imposent un recodage des données déjà collectées.</p>}
    <div className="tableau"><table aria-label={titre}>
      <thead><tr><th>Question</th><th>Changement</th><th>Détail</th><th>Recodage</th></tr></thead>
      <tbody>{changements.map((c, i) => <tr key={i}><td><code>{c.question}</code></td><td>{c.type}</td><td>{c.detail}</td>
        <td>{c.migration ? <Badge ton="alerte">Recodage</Badge> : <Badge ton="neutre">Non</Badge>}</td></tr>)}</tbody>
    </table></div>
  </>;
}

function Structure({ d, editable, lr, majBase }:
  { d: Dictionnaire; editable: boolean; lr: string; majBase: (f: (d: Dictionnaire) => Dictionnaire) => void }): ReactNode {
  const [nouvelleLangue, setNouvelleLangue] = useState("");
  const sections = (f: (s: Section[]) => Section[]): void => majBase((x) => ({ ...x, sections: f(x.sections) }));
  const occupees = new Set(d.questions.map((q) => q.section));
  return <>
    <section className="panneau" aria-label="Titre et langues"><h2>Titre et langues</h2>
      <form className="grille" onSubmit={(e) => e.preventDefault()}>
        {d.langues.map((l) => <span key={l} style={{ display: "contents" }}>
          <label htmlFor={`titre-${l}`}>Titre ({l})</label>
          <input id={`titre-${l}`} disabled={!editable} value={d.titre[l] ?? ""} onChange={(e) => majBase((x) => ({ ...x, titre: { ...x.titre, [l]: e.target.value } }))} />
        </span>)}
        <label>Langues</label>
        <span className="actions">{d.langues.map((l) => <span key={l}><Badge ton={l === lr ? "info" : "neutre"}>{l}{l === lr ? " (référence)" : ""}</Badge>
          {editable && l !== lr && <button type="button" className="secondaire" onClick={() => {
            if (window.confirm(`Retirer la langue « ${l} » ? Ses traductions ne seront plus proposées dans le formulaire.`)) majBase((x) => ({ ...x, langues: x.langues.filter((y) => y !== l) }));
          }}>Retirer</button>}</span>)}</span>
        {editable && <>
          <label htmlFor="nouvelle-langue">Ajouter une langue</label>
          <span><input id="nouvelle-langue" maxLength={3} value={nouvelleLangue} placeholder="ex. en" style={{ width: "5rem" }}
            onChange={(e) => setNouvelleLangue(e.target.value.toLowerCase().replace(/[^a-z]/g, ""))} />
            <button type="button" className="secondaire" disabled={nouvelleLangue.length < 2 || d.langues.includes(nouvelleLangue)}
              onClick={() => { majBase((x) => ({ ...x, langues: [...x.langues, nouvelleLangue] })); setNouvelleLangue(""); }}>Ajouter</button></span></>}
      </form>
      <p className="mention">Le formulaire reste unique et bilingue : mêmes codes quelle que soit la langue. Les traductions se saisissent dans l’onglet Questions avec la « Langue d’édition ».</p>
    </section>
    <section className="panneau" aria-label="Sections"><h2>Sections</h2>
      <div className="tableau"><table aria-label="Liste des sections"><thead><tr><th>Identifiant</th>{d.langues.map((l) => <th key={l}>Titre ({l})</th>)}<th>Questions</th><th /></tr></thead>
        <tbody>{d.sections.map((s, i) => <tr key={s.id}><td><code>{s.id}</code></td>
          {d.langues.map((l) => <td key={l}><input aria-label={`Titre de la section ${s.id} (${l})`} disabled={!editable} value={s.libelles[l] ?? ""}
            onChange={(e) => sections((ss) => ss.map((x) => (x.id === s.id ? { ...x, libelles: { ...x.libelles, [l]: e.target.value } } : x)))} /></td>)}
          <td>{d.questions.filter((q) => q.section === s.id).length}</td>
          <td>{editable && <span className="actions">
            <button type="button" className="secondaire" disabled={i === 0} onClick={() => sections((ss) => { const x = [...ss]; [x[i - 1], x[i]] = [x[i], x[i - 1]]; return x; })}>↑</button>
            <button type="button" className="secondaire" disabled={i === d.sections.length - 1} onClick={() => sections((ss) => { const x = [...ss]; [x[i + 1], x[i]] = [x[i], x[i + 1]]; return x; })}>↓</button>
            <button type="button" className="secondaire" disabled={occupees.has(s.id)} title={occupees.has(s.id) ? "Déplacez d’abord ses questions" : undefined}
              onClick={() => sections((ss) => ss.filter((x) => x.id !== s.id))}>Supprimer</button></span>}</td></tr>)}</tbody>
      </table></div>
      {editable && <button className="secondaire" onClick={() => {
        let n = d.sections.length + 1;
        while (d.sections.some((s) => s.id === `S${n}`)) n += 1;
        sections((ss) => [...ss, { id: `S${n}`, libelles: { [lr]: `${n}. Nouvelle section` } }]);
      }}>Ajouter une section</button>}
    </section>
  </>;
}

function Regles({ regles, editable, lr, changer }: { regles: Regle[]; editable: boolean; lr: string; changer: (r: Regle[]) => void }): ReactNode {
  const maj = (i: number, r: Partial<Regle>): void => changer(regles.map((x, j) => (j === i ? { ...x, ...r } : x)));
  return <section className="panneau" aria-label="Règles de cohérence"><h2>Règles de cohérence</h2>
    <p className="mention">Une règle décrit une INCOHÉRENCE : si l’expression est vraie, la fiche reçoit l’anomalie <code>INCOHERENCE_…</code> et passe « À vérifier ».
      Syntaxe : <code>VOUSETES == 1 and FREQACHA in (2, 3)</code> — variables du dictionnaire, entiers, <code>and or not == != &lt; &lt;= &gt; &gt;= in</code>.
      Une réponse manquante (97, 98, 99) suspend la règle.</p>
    <div className="tableau"><table aria-label="Liste des règles"><thead><tr><th>Code</th><th>Expression</th><th>Description ({lr})</th><th /></tr></thead>
      <tbody>{regles.length === 0 && <tr><td colSpan={4} className="vide">Aucune règle.</td></tr>}
        {regles.map((r, i) => <tr key={i}>
          <td><input aria-label={`Code de la règle ${i + 1}`} disabled={!editable} value={r.code} style={{ width: "10rem" }}
            onChange={(e) => maj(i, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} /></td>
          <td><input aria-label={`Expression de la règle ${i + 1}`} disabled={!editable} value={r.expression} onChange={(e) => maj(i, { expression: e.target.value })} /></td>
          <td><input aria-label={`Description de la règle ${i + 1}`} disabled={!editable} value={r.description[lr] ?? ""}
            onChange={(e) => maj(i, { description: { ...r.description, [lr]: e.target.value } })} /></td>
          <td>{editable && <button type="button" className="secondaire" onClick={() => changer(regles.filter((_, j) => j !== i))}>Retirer</button>}</td>
        </tr>)}</tbody></table></div>
    {editable && <button className="secondaire" onClick={() => changer([...regles, { code: `R${regles.length + 1}`, expression: "", description: { [lr]: "" } }])}>Ajouter une règle</button>}
  </section>;
}

function Apercu({ d, langue }: { d: Dictionnaire; langue: string }): ReactNode {
  const t = (x: Record<string, string>): string => x[langue] || x[d.langue_reference] || "";
  return <section className="panneau" aria-label="Aperçu du formulaire">
    <h2>{t(d.titre) || "Aperçu du formulaire"}</h2>
    <p className="mention">Aperçu de l’ordre et des textes tels que l’enquêteur les verra ({langue}), d’après les modifications en cours.
      Les conditions sont indiquées ; elles s’appliquent dans l’application enquêteur.</p>
    {d.sections.map((s) => <div key={s.id}><h3>{t(s.libelles)}</h3>
      {d.questions.filter((q) => q.section === s.id).map((q) => <div key={q.code} className="lecture" style={{ margin: "0.5rem 0" }}>
        <strong>Q{q.numero}. {t(q.libelles)}{q.obligatoire ? " *" : ""}</strong>
        {q.type === "choix_multiple" && <span className="mention"> {t(d.mention_choix_multiple as Record<string, string> ?? {})}</span>}
        {q.condition && <span className="mention"> — affichée si {q.condition}</span>}
        {t(q.aide) && <p className="mention">{t(q.aide)}</p>}
        {AVEC_MODALITES.has(q.type) && q.type !== "grille" && <ul>{q.modalites.map((m) => <li key={m.code}>{q.type === "choix_multiple" ? "☐" : "○"} {t(m.libelles)}</li>)}
          {q.autre && <li>○ {t(q.autre.libelles)} : ________</li>}</ul>}
        {q.type === "grille" && <table><thead><tr><th />{q.modalites.map((m) => <th key={m.code}>{t(m.libelles)}</th>)}</tr></thead>
          <tbody>{q.lignes.map((l) => <tr key={l.variable}><td>{t(l.libelles)}</td>{q.modalites.map((m) => <td key={m.code}>○</td>)}</tr>)}</tbody></table>}
        {!AVEC_MODALITES.has(q.type) && <p className="mention">[{TYPES[q.type]}] ____________</p>}
      </div>)}
    </div>)}
  </section>;
}
