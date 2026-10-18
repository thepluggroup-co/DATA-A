import { useState, type FormEvent } from "react";
import { analyser, telecharger, type Envoi, type LigneStatut } from "../api";
import { Barre, dateFr, nb, pct, useSession } from "../commun";

function Envoyer() {
  const { projet, envoi, memoriser } = useSession();
  const [tableur, setTableur] = useState<File | null>(envoi?.tableur ?? null);
  const [decisions, setDecisions] = useState<File | null>(envoi?.decisions ?? null);
  const [onglet, setOnglet] = useState(envoi?.onglet ?? "Form Responses 1");
  const [maintenant, setMaintenant] = useState(envoi?.maintenant ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [encours, setEncours] = useState(false);

  const soumettre = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!tableur) return;
    const e: Envoi = { tableur, decisions, onglet, maintenant, graine: envoi?.graine ?? 0 };
    setEncours(true);
    setErreur(null);
    try {
      memoriser(await analyser(projet, e), e);
    } catch (x) {
      setErreur((x as Error).message);
    } finally {
      setEncours(false);
    }
  };
  return (
    <form className="carte" onSubmit={soumettre}>
      <h2>Réponses du terrain</h2>
      <div className="formulaire">
        <label className="champ">
          Classeur de réponses (.xlsx)
          <input type="file" accept=".xlsx" onChange={(e) => setTableur(e.target.files?.[0] ?? null)} required={!tableur} />
        </label>
        <label className="champ">
          Onglet
          <input value={onglet} onChange={(e) => setOnglet(e.target.value)} />
        </label>
        <label className="champ">
          Décisions du superviseur (.yaml, facultatif)
          <input type="file" accept=".yaml,.yml" onChange={(e) => setDecisions(e.target.files?.[0] ?? null)} />
        </label>
        <label className="champ">
          Vu à (facultatif ; sinon dernier jour, 23 h 59)
          <input type="datetime-local" value={maintenant} onChange={(e) => setMaintenant(e.target.value)} />
        </label>
        <button type="submit" className="bouton" disabled={!tableur || encours}>{encours ? "Calcul…" : "Calculer le suivi"}</button>
      </div>
      {tableur && <span className="petit gris">Fichier : {tableur.name} · lu en mémoire par l’API, jamais conservé.</span>}
      {erreur && <div className="bandeau erreur">{erreur}</div>}
    </form>
  );
}

function Statut({ titre, lignes, classe }: { titre: string; lignes: LigneStatut[]; classe: string }) {
  return (
    <div className={`bandeau ${classe}`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <strong>{titre} · {lignes.length}</strong>
      {lignes.map((l) => (
        <span key={`${l.poste}-${l.personne}`} className="petit">
          <span className="mono">{l.poste}</span> ({l.personne}, {l.ville}) · {l.fiches} fiches · {pct(l.part)} du poste
          {l.reste > 0 && ` · reste ${l.reste}`}
          {l.sortie && ` · sortie ${l.sortie}`}
          {l.demarrage && ` · démarrage ${l.demarrage}`}
        </span>
      ))}
    </div>
  );
}

export default function PageSuivi() {
  const { projet, analyse: a, envoi } = useSession();
  const [erreurZip, setErreurZip] = useState<string | null>(null);
  const zip = async () => {
    if (!envoi) return;
    setErreurZip(null);
    try {
      await telecharger(`/projets/${projet}/suivi/livrables.zip`, `${projet}_suivi_${a?.jour ?? ""}.zip`, envoi);
    } catch (e) {
      setErreurZip((e as Error).message);
    }
  };
  const tb = a?.tableau_de_bord;
  const jours = a ? a.tableau_de_bord.total.jours.map((_: number, i: number) => `J${i + 1}`) : [];
  return (
    <>
      <div className="entete">
        <div>
          <span className="gris petit">{a ? `${dateFr(a.jour)} · ${a.rapport.partiel ? "rapport PROVISOIRE" : "rapport définitif"}` : "suivi.tableaux · suivi.rapport · suivi.statut"}</span>
          <h1>Suivi de terrain</h1>
        </div>
        {a && (
          <button type="button" className="bouton second" onClick={zip}>Livrables Excel / Word (.zip)</button>
        )}
      </div>
      <Envoyer />
      {erreurZip && <div className="bandeau erreur">{erreurZip}</div>}
      {a && tb && (
        <>
          <div className="bandeau alerte">L’archive des livrables contient RAPPELS_*.xlsx avec des téléphones de répondants : usage interne, ne pas diffuser.</div>
          <section className="grille-kpi">
            <div className="kpi"><span className="l">Réponses lues</span><span className="v">{nb(a.reponses)}</span></div>
            <div className="kpi"><span className="l">Fiches valides (cumul)</span><span className="v">{nb(tb.total.cumul)}</span><span className="l">objectif d’équipe {nb(tb.total.objectif)}</span></div>
            <div className="kpi"><span className="l">Aujourd’hui</span><span className="v">{nb(tb.total.aujourdhui)}</span></div>
            <div className="kpi"><span className="l">À vérifier</span><span className="v">{nb(tb.total.a_verifier)}</span></div>
            <div className="kpi"><span className="l">Rejetées</span><span className="v">{nb(tb.total.rejetees)}</span></div>
            <div className="kpi"><span className="l">Sans réponse à la cible</span><span className="v">{nb(tb.sans_cible)}</span></div>
          </section>

          <section className="carte">
            <h2>Quotas cible × ville</h2>
            <div className="tableau">
              <table>
                <thead>
                  <tr><th>Cible</th>{a.tableau_de_bord.zones.map((z) => <th key={z.id}>{z.id}</th>)}<th>Total</th></tr>
                </thead>
                <tbody>
                  {a.suivi_cibles.quotas.map((c) => (
                    <tr key={c.code}>
                      <td><span className="mono gris">{c.code}</span> {c.cible}</td>
                      {c.villes.map((v, i) => (
                        <td key={i}><div className="mono petit">{v.realise} / {v.quota}</div><Barre part={Number(v.part)} /></td>
                      ))}
                      <td><div className="mono petit">{c.total.realise} / {c.total.quota}</div><Barre part={Number(c.total.part)} /></td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Total des cibles</td>
                    {a.suivi_cibles.total.villes.map((v, i) => <td key={i} className="mono">{v.realise} / {v.quota} · {pct(v.part)}</td>)}
                    <td className="mono">{a.suivi_cibles.total.total.realise} / {a.suivi_cibles.total.total.quota} · {pct(a.suivi_cibles.total.total.part)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="carte">
            <h2>Tableau de bord par enquêteur</h2>
            <div className="tableau">
              <table>
                <thead>
                  <tr>
                    <th>Poste</th><th>Ville</th>{jours.map((j: string) => <th key={j} className="n">{j}</th>)}
                    <th className="n">Cumul</th><th className="n">Objectif</th><th>% réalisé</th><th className="n">Délais courts</th>
                    <th className="n">À vérifier</th><th className="n">Rejetées</th><th>Statut</th><th className="n">Rang</th>
                  </tr>
                </thead>
                <tbody>
                  {tb.lignes.map((l) => (
                    <tr key={l.id}>
                      <td className="mono">{l.id}</td><td>{l.zone}</td>
                      {(l.jours as number[]).map((v, i) => <td key={i} className="n">{v}</td>)}
                      <td className="n">{l.cumul}</td><td className="n">{nb(l.objectif)}</td>
                      <td><div className="mono petit">{pct(l.realise)}</div><Barre part={Number(l.realise)} /></td>
                      <td className="n">{l.delais_courts}</td><td className="n">{l.a_verifier}</td><td className="n">{l.rejetees}</td>
                      <td>{l.statut}</td><td className="n">{l.rang}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>TOTAL</td><td></td>{(tb.total.jours as number[]).map((v, i) => <td key={i} className="n">{v}</td>)}
                    <td className="n">{tb.total.cumul}</td><td className="n">{nb(tb.total.objectif)}</td><td className="mono">{pct(tb.total.realise)}</td>
                    <td className="n">{tb.total.delais_courts}</td><td className="n">{tb.total.a_verifier}</td><td className="n">{tb.total.rejetees}</td><td></td><td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            {tb.hors_liste > 0 && <div className="bandeau alerte">{tb.hors_liste} fiche(s) d’enquêteurs absents du plan de terrain.</div>}
          </section>

          <div className="rangee">
            <section className="carte">
              <h2>Rapport du {dateFr(a.rapport.jour)}{a.rapport.partiel ? " · provisoire" : ""}</h2>
              <div className="tableau">
                <table>
                  <tbody>
                    {a.rapport.synthese.map((li, i) => (
                      <tr key={i}><td>{li[0]}</td><td className="n">{nb(li[1])}</td><td className="petit gris">{li[2]}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h2>Recommandations pour le lendemain</h2>
              {a.rapport.recos.map((r, i) => (
                <div key={i} className="petit"><strong>{r[0]}</strong> · {r[1]}</div>
              ))}
            </section>
            <section className="carte">
              <h2>Classement des enquêteurs</h2>
              <div className="tableau">
                <table>
                  <thead><tr><th className="n">Rang</th><th>Poste</th><th className="n">Fiches</th><th>% objectif</th><th className="n">Score</th><th>Appréciation</th></tr></thead>
                  <tbody>
                    {a.rapport.classement.map((c) => (
                      <tr key={c.id}><td className="n">{c.rang}</td><td className="mono">{c.id}</td><td className="n">{c.n}</td><td className="mono">{pct(c.pObj)}</td><td className="n">{c.score}</td><td>{c.avis}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <span className="petit gris">
                Score = 50 pts de production (fiches ÷ objectif, plafonné) + 30 pts de fiabilité + 20 pts de complétude.
              </span>
            </section>
          </div>

          {a.statut && (
            <section className="carte">
              <h2>Statut des enquêteurs</h2>
              <div className="rangee">
                <Statut titre="Présents, objectif atteint" lignes={a.statut.atteints} classe="info" />
                <Statut titre="Présents, reste à remplir" lignes={a.statut.non_atteints} classe="alerte" />
                <Statut titre="Sortis" lignes={a.statut.sortis} classe="info" />
                <Statut titre="Remplaçants" lignes={a.statut.remplacants} classe="info" />
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
