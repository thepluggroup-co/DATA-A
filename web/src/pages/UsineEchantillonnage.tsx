import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, pct } from "../api";
import { useSession } from "../App";
import { Badge, EnTete, Kpi } from "../ui";

type Taille = { proportion: number; marge: number; confiance: number; population: number | null; effet_plan: number };
type Quota = { code: number; cible: string; villes: Record<string, number> };
type Capacite = { ville: string; quota: number; titulaires: number; capacite: number; ecart: number };
type Plan = {
  etude: string; version: string; methode: string; variable_cible: string; mention: string; villes: string[]; total: number;
  par_ville: Record<string, number>; quotas: Quota[]; taille: Taille | null; taille_calculee: number | null;
  marge_indicative: number | null; capacites: Capacite[]; ecarts: string[];
};
type ProjetListe = { id: string; code: string; nom: string };

const nombre = (valeur: string): number => (valeur === "" ? 0 : Math.max(0, Math.floor(Number(valeur)) || 0));

export function UsineEchantillonnage(): ReactNode {
  const { moi } = useSession();
  const peutModifier = (moi?.permissions ?? []).includes("projet.piloter");
  const [projets, setProjets] = useState<ProjetListe[]>([]);
  const [projetId, setProjetId] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [taille, setTaille] = useState<Taille | null>(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const appliquer = useCallback((p: Plan): void => {
    setPlan(p); setQuotas(p.quotas.map((q) => ({ ...q, villes: { ...q.villes } }))); setTaille(p.taille ? { ...p.taille } : null);
  }, []);

  useEffect(() => {
    api<ProjetListe[]>("/api/usine/projets")
      .then((liste) => { setProjets(liste); if (liste.length) setProjetId(liste[0].id); })
      .catch((e: Error) => setErreur(e.message));
  }, []);

  useEffect(() => {
    if (!projetId) return;
    setErreur(""); setMessage(""); setPlan(null);
    api<Plan>(`/api/usine/projets/${projetId}/echantillonnage`).then(appliquer).catch((e: Error) => setErreur(e.message));
  }, [projetId, appliquer]);

  const totalSaisi = useMemo(() => quotas.reduce((t, q) => t + Object.values(q.villes).reduce((a, b) => a + b, 0), 0), [quotas]);
  const modifie = plan !== null && (JSON.stringify(quotas) !== JSON.stringify(plan.quotas) || JSON.stringify(taille) !== JSON.stringify(plan.taille));

  const changer = (code: number, ville: string, valeur: string): void =>
    setQuotas(quotas.map((q) => (q.code === code ? { ...q, villes: { ...q.villes, [ville]: nombre(valeur) } } : q)));

  const enregistrer = async (): Promise<void> => {
    if (!plan) return;
    setEnvoi(true); setErreur(""); setMessage("");
    try {
      const nouveau = await api<Plan>(`/api/usine/projets/${projetId}/echantillonnage`, {
        methode: "PUT", corps: { version: plan.version, methode: plan.methode, taille, quotas },
      });
      appliquer(nouveau);
      setMessage(`Plan enregistré : version ${nouveau.version}.`);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  const champTaille = (cle: keyof Taille, etiquette: string, pas: string): ReactNode => taille && (
    <><label htmlFor={`t-${cle}`}>{etiquette}</label>
      <input id={`t-${cle}`} type="number" step={pas} disabled={!peutModifier} value={taille[cle] ?? ""}
        onChange={(e) => setTaille({ ...taille, [cle]: e.target.value === "" ? (cle === "population" ? null : 0) : Number(e.target.value) })} /></>
  );

  return <>
    <EnTete titre="Plan d’échantillonnage" sous_titre="Plan enregistré dans le dossier du projet, versionné et audité."
      actions={peutModifier ? <button onClick={() => void enregistrer()} disabled={!modifie || envoi}>{envoi ? "Enregistrement…" : "Enregistrer le plan"}</button> : undefined} />
    <div className="panneau"><div className="grille">
      <label htmlFor="projet-ech">Projet</label>
      <select id="projet-ech" value={projetId} onChange={(e) => setProjetId(e.target.value)}>
        {projets.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>)}
      </select>
    </div></div>
    {erreur && <p className="erreur" role="alert">{erreur}</p>}
    {message && <p className="succes" role="status">{message}</p>}
    {plan && <>
      <div className="kpis">
        <Kpi icone="fiches" etiquette="Total des quotas" valeur={totalSaisi} detail={totalSaisi !== plan.total ? `enregistré : ${plan.total}` : `version ${plan.version}`} />
        <Kpi icone="projets" etiquette="Villes" valeur={plan.villes.length} />
        <Kpi icone="clients" etiquette="Cibles" valeur={quotas.length} />
        {plan.taille_calculee !== null && <Kpi icone="croisement" etiquette="Taille de référence" valeur={plan.taille_calculee}
          detail={plan.marge_indicative !== null ? `marge indicative ± ${pct(plan.marge_indicative * 100)}` : "échantillon aléatoire simple"} />}
      </div>
      {plan.mention && <p className="avertissement" role="note">{plan.mention}</p>}
      {plan.ecarts.length > 0 && <div className="avertissement" role="alert"><strong>Écarts entre les sources du projet</strong>
        <ul>{plan.ecarts.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <section className="panneau"><h2>Quotas par cible et par ville</h2>
        <div className="tableau"><table aria-label="Quotas par cible et par ville">
          <thead><tr><th>Cible</th>{plan.villes.map((v) => <th key={v} className="nombre">{v}</th>)}<th className="nombre">Total</th></tr></thead>
          <tbody>{quotas.map((q) => <tr key={q.code}>
            <td>{q.cible} <span className="mention">(code {q.code})</span></td>
            {plan.villes.map((v) => <td key={v} className="nombre">
              <input type="number" min="0" aria-label={`${q.cible} — ${v}`} disabled={!peutModifier} value={q.villes[v]} style={{ width: "5.5rem" }}
                onChange={(e) => changer(q.code, v, e.target.value)} /></td>)}
            <td className="nombre">{Object.values(q.villes).reduce((a, b) => a + b, 0)}</td></tr>)}</tbody>
          <tfoot><tr><th>Total</th>{plan.villes.map((v) => <th key={v} className="nombre">{quotas.reduce((t, q) => t + q.villes[v], 0)}</th>)}<th className="nombre">{totalSaisi}</th></tr></tfoot>
        </table></div>
        <p className="mention">Cibles et villes viennent du brief et du dictionnaire : seuls les effectifs se modifient ici. Variable de cible : {plan.variable_cible}.</p>
      </section>
      {taille && <section className="panneau"><h2>Paramètres de taille (référence)</h2>
        <div className="grille">
          {champTaille("marge", "Marge d’erreur (0,05 = ± 5 points)", "0.01")}
          {champTaille("confiance", "Niveau de confiance", "0.01")}
          {champTaille("proportion", "Proportion attendue", "0.05")}
          {champTaille("effet_plan", "Effet de plan (≥ 1)", "0.1")}
          {champTaille("population", "Population totale (facultatif)", "1")}
        </div>
        <p className="mention">Enregistrez pour recalculer la taille de référence.</p>
      </section>}
      {plan.capacites.length > 0 && <section className="panneau"><h2>Capacité du terrain</h2>
        <div className="tableau"><table aria-label="Capacité du terrain par ville">
          <thead><tr><th>Ville</th><th className="nombre">Quota</th><th className="nombre">Enquêteurs titulaires</th><th className="nombre">Capacité</th><th>État</th></tr></thead>
          <tbody>{plan.capacites.map((c) => <tr key={c.ville}><td>{c.ville}</td><td className="nombre">{c.quota}</td><td className="nombre">{c.titulaires}</td>
            <td className="nombre">{c.capacite}</td><td>{c.ecart >= 0 ? <Badge ton="ok">Suffisante</Badge> : <Badge ton="alerte">Manque {-c.ecart}</Badge>}</td></tr>)}</tbody>
        </table></div></section>}
      {!peutModifier && <p className="mention">Lecture seule : la modification du plan est réservée aux rôles qui pilotent le projet.</p>}
    </>}
  </>;
}
