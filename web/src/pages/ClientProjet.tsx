import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ErreurApi, pct } from "../api";
import { Badge, Icone, Kpi } from "../ui";

type Suivi = { total_quota: number; total_realise: number; mention: string;
  lignes: { cible: string; ville: string; quota: number; realise: number; taux: number | null }[] };
type Variable = { nom: string; libelle: string };
type Cellule = { effectif: number | null; pct: number | null; lettres: string };
type Resultat = { refuse: false; id: number; base: number; lignes: { libelle: string }[];
  colonnes: { libelle: string; lettre: string }[]; bases_colonnes: number[]; cellules: Cellule[][];
  p: number | null; v_cramer: number | null; commentaire: string; avertissements: string[] };
type Livrable = { id: string; nom: string };

function MiniJauge({ taux }: { taux: number | null }): ReactNode {
  const v = taux ?? 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", justifyContent: "flex-end" }}>
      <div className="jauge" style={{ width: 90, marginTop: 0 }} aria-hidden="true"><span style={{ width: `${Math.min(100, v)}%` }} /></div>
      <span>{pct(taux)}</span>
    </div>
  );
}

function SuiviTerrain({ id }: { id: string }): ReactNode {
  const [s, setS] = useState<Suivi | null>(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => { api<Suivi>(`/api/projets/${id}/suivi`).then(setS).catch((e: Error) => setErreur(e.message)); }, [id]);
  if (erreur) return <p className="erreur" role="alert">{erreur}</p>;
  if (!s) return <p className="vide">Chargement…</p>;
  const taux = s.total_quota ? (100 * s.total_realise) / s.total_quota : 0;
  const atteints = s.lignes.filter((l) => l.realise >= l.quota).length;
  return (
    <section aria-label="Suivi du terrain">
      <div className="kpis">
        <Kpi icone="fiches" etiquette="Fiches réalisées" valeur={s.total_realise} detail={`sur ${s.total_quota} prévues`} jauge={taux} />
        <Kpi icone="tableau" etiquette="Avancement" valeur={pct(Math.round(taux * 10) / 10)} detail="de l'objectif total" />
        <Kpi icone="audit" etiquette="Quotas atteints" valeur={`${atteints} / ${s.lignes.length}`} detail="cases cible × ville" />
      </div>
      <p><strong>{s.total_realise}</strong> fiches réalisées sur <strong>{s.total_quota}</strong> prévues (quotas cible × ville).</p>
      <div className="tableau">
        <table aria-label="Quotas par cible et par ville">
          <thead><tr><th>Cible</th><th>Ville</th><th className="nombre">Quota</th><th className="nombre">Réalisé</th><th className="nombre">Taux</th></tr></thead>
          <tbody>{s.lignes.map((l, k) => (
            <tr key={k}><td>{l.cible}</td><td>{l.ville}</td><td className="nombre">{l.quota}</td>
              <td className="nombre">{l.realise}</td><td className="nombre"><MiniJauge taux={l.taux} /></td></tr>))}
          </tbody>
        </table>
      </div>
      <p className="mention">{s.mention} Vue agrégée : aucune donnée personnelle des répondants.</p>
    </section>
  );
}

function Croisements({ id }: { id: string }): ReactNode {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [ligne, setLigne] = useState("");
  const [colonne, setColonne] = useState("");
  const [filtre, setFiltre] = useState("");
  const [res, setRes] = useState<Resultat | null>(null);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  useEffect(() => {
    api<Variable[]>(`/api/projets/${id}/variables`).then((v) => {
      setVariables(v);
      setLigne(v[0]?.nom ?? "");
      setColonne(v[1]?.nom ?? "");
    }).catch((e: Error) => setErreur(e.message));
  }, [id]);
  const lancer = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setErreur("");
    setRes(null);
    setOccupe(true);
    try {
      setRes(await api<Resultat>(`/api/projets/${id}/croisements`, { methode: "POST", corps: { ligne, colonne, filtre } }));
    } catch (err) {
      setErreur(err instanceof ErreurApi && err.statut === 422 ? `Croisement refusé : ${err.message}` : (err as Error).message);
    } finally {
      setOccupe(false);
    }
  };
  return (
    <section aria-label="Croisements à la demande">
      <div className="panneau">
        <h2>Paramètres du croisement</h2>
        <form className="grille" onSubmit={(e) => void lancer(e)}>
          <label htmlFor="ligne">En lignes</label>
          <select id="ligne" value={ligne} onChange={(e) => setLigne(e.target.value)}>
            {variables.map((v) => <option key={v.nom} value={v.nom}>{v.libelle}</option>)}
          </select>
          <label htmlFor="colonne">En colonnes</label>
          <select id="colonne" value={colonne} onChange={(e) => setColonne(e.target.value)}>
            {variables.map((v) => <option key={v.nom} value={v.nom}>{v.libelle}</option>)}
          </select>
          <label htmlFor="filtre">Filtre (facultatif)</label>
          <input id="filtre" placeholder="ex. VILLEREG == 1" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
          <span />
          <div className="actions" style={{ margin: 0 }}>
            <button type="submit" disabled={occupe}>Calculer le croisement</button>
            <span className="mention">Garde-fous : base minimale, k-anonymat, tests de colonnes (Bonferroni).</span>
          </div>
        </form>
      </div>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      {res && (
        <div className="panneau" aria-label="Résultat du croisement">
          <h2>Résultat — base {res.base} répondants</h2>
          <div className="tableau">
            <table>
              <thead><tr><th />{res.colonnes.map((c) => <th key={c.lettre} className="nombre">{c.libelle} ({c.lettre})</th>)}</tr></thead>
              <tbody>
                {res.lignes.map((l, i) => (
                  <tr key={i}><td>{l.libelle}</td>
                    {res.cellules[i].map((c, j) => (
                      <td key={j} className="nombre">{c.effectif === null ? "< k" : pct(c.pct)}
                        {c.lettres && <span className="lettres">{c.lettres}</span>}</td>))}
                  </tr>))}
                <tr><td><strong>Base (n)</strong></td>{res.bases_colonnes.map((b, j) => <td key={j} className="nombre">{b}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="lecture"><strong>Lecture :</strong> {res.commentaire}</p>
          {res.avertissements.map((a, k) => <p key={k} className="avertissement">{a}</p>)}
          <div className="actions">
            <a className="bouton" href={`/api/projets/${id}/croisements/${res.id}/export`}>Exporter (Excel + syntaxe SPSS)</a>
          </div>
        </div>
      )}
    </section>
  );
}

function Livrables({ id }: { id: string }): ReactNode {
  const [liste, setListe] = useState<Livrable[]>([]);
  const [erreur, setErreur] = useState("");
  useEffect(() => { api<Livrable[]>(`/api/projets/${id}/livrables`).then(setListe).catch((e: Error) => setErreur(e.message)); }, [id]);
  if (erreur) return <p className="erreur" role="alert">{erreur}</p>;
  return (
    <section className="panneau" aria-label="Livrables">
      <h2>Documents partagés par DATA'A</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
        {liste.length === 0 && <li className="vide">Aucun livrable partagé pour l'instant.</li>}
        {liste.map((l) => (
          <li key={l.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ width: 18, color: "var(--turquoise)" }}><Icone nom="fiches" /></span>
            <a href={`/api/livrables/${l.id}`}>{l.nom}</a>
          </li>))}
      </ul>
    </section>
  );
}

export function ClientProjet({ lectureSeule = false }: { lectureSeule?: boolean }): ReactNode {
  const { id = "" } = useParams();
  const [onglet, setOnglet] = useState<"suivi" | "croisements" | "livrables">("suivi");
  const [nom, setNom] = useState("");
  const [statut, setStatut] = useState("");
  const [introuvable, setIntrouvable] = useState(false);
  useEffect(() => {
    api<{ id: string; nom: string; statut: string }[]>("/api/projets").then((p) => {
      const x = p.find((q) => q.id === id);
      if (x) { setNom(x.nom); setStatut(x.statut); } else setIntrouvable(true);
    }).catch(() => setIntrouvable(true));
  }, [id]);
  if (introuvable) return <p className="erreur" role="alert">Étude introuvable.</p>;
  return (
    <>
      <p className="fil"><Link to="/">Mes études</Link> <span aria-hidden="true">›</span> {nom}</p>
      <h1>{nom}</h1>
      <p className="sous-titre">{statut === "livre" ? <Badge ton="ok">Livrée</Badge> : statut && <Badge ton="info">{statut}</Badge>}</p>
      <div className="onglets" role="tablist">
        {(["suivi", ...(!lectureSeule ? ["croisements" as const] : []), "livrables"] as const).map((o) => (
          <button key={o} role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)}>
            {o === "suivi" ? "Suivi du terrain" : o === "croisements" ? "Croisements" : "Livrables"}
          </button>))}
      </div>
      {onglet === "suivi" && <SuiviTerrain id={id} />}
      {!lectureSeule && onglet === "croisements" && <Croisements id={id} />}
      {onglet === "livrables" && <Livrables id={id} />}
    </>
  );
}
