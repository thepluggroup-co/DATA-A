import { useState } from "react";
import { envoyerJson, type Lien, type Terrain } from "../api";
import { dateFr, Etat, useDonnees, useSession } from "../commun";

const heure = (iso: string | null) => (iso ? `${dateFr(iso)} ${iso.slice(11, 16)}` : "");

export default function PageOrganisation() {
  const { projet } = useSession();
  const { donnees: t, erreur, charge } = useDonnees<Terrain>(`/projets/${projet}/terrain`);
  const [ville, setVille] = useState<string | null>(null);
  const [modele, setModele] = useState("");
  const [enqModele, setEnqModele] = useState("ENQ1");
  const [villesModele, setVillesModele] = useState("Douala");
  const [liens, setLiens] = useState<Lien[] | null>(null);
  const [erreurLiens, setErreurLiens] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);

  const courante = ville ?? t?.villes[0]?.id ?? null;
  const generer = async () => {
    setErreurLiens(null);
    try {
      setLiens(await envoyerJson<Lien[]>(`/projets/${projet}/deploiement/liens`, {
        modele, enqueteur: enqModele, villes: villesModele.split(",").map((v) => v.trim()).filter(Boolean),
      }));
    } catch (e) {
      setLiens(null);
      setErreurLiens((e as Error).message);
    }
  };
  const copier = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(id);
    } catch {
      setCopie(null);
    }
  };

  return (
    <>
      <div className="entete">
        <div>
          <span className="mono petit gris">projets/{projet}/plan_terrain.yaml{t ? ` · ${t.fuseau}` : ""}</span>
          <h1>Organisation et déploiement</h1>
        </div>
        {t && (
          <div className="onglets" role="tablist" aria-label="Villes">
            {t.villes.map((v) => (
              <button key={v.id} type="button" role="tab" aria-selected={courante === v.id} className={courante === v.id ? "actif" : ""} onClick={() => setVille(v.id)}>
                {v.libelle} · {v.prefixe}
              </button>
            ))}
          </div>
        )}
      </div>
      <Etat charge={charge} erreur={erreur} />
      {t && (
        <>
          <section className="grille-kpi">
            <div className="kpi"><span className="l">Jours de terrain</span><span className="v">{t.jours.length}</span><span className="l">{t.jours.map(dateFr).join(" · ")}</span></div>
            <div className="kpi"><span className="l">Objectif / enquêteur / jour</span><span className="v">{t.objectif_jour}</span><span className="l">× {t.nb_jours} jours</span></div>
            <div className="kpi"><span className="l">Délai court</span><span className="v">&lt; {t.seuil_delai_min} min</span><span className="l">entre deux fiches</span></div>
            <div className="kpi"><span className="l">Volume suspect</span><span className="v">&gt; {t.seuil_volume_jour}</span><span className="l">fiches dans la journée</span></div>
          </section>

          <section className="carte">
            <h2>Postes · {t.villes.find((v) => v.id === courante)?.libelle}</h2>
            <div className="tableau">
              <table>
                <thead><tr><th>Poste</th><th>Rôle</th><th>Affectations (sans nom : données personnelles hors du dépôt)</th></tr></thead>
                <tbody>
                  {t.enqueteurs.filter((e) => e.ville === courante).map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{e.id}</td>
                      <td>{e.role === "reserve" ? <span className="pastille p-neutre">réserve · non comptée</span> : <span className="pastille p-bleu">titulaire</span>}</td>
                      <td className="petit">
                        {e.affectations.length === 0 && <span className="gris">tout le terrain</span>}
                        {e.affectations.map((a, i) => (
                          <div key={i}>
                            <strong>{a.personne}</strong>
                            {a.debut && ` · depuis ${heure(a.debut)}`}
                            {a.fin && ` · jusqu’au ${heure(a.fin)}`}
                            {a.sortie && ` · sortie : ${a.sortie}`}
                            {a.demarrage && ` · démarrage : ${a.demarrage}`}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bandeau info">
              Zones, quartiers et points de collecte (PDF d’organisation) : pas encore dans le plan de terrain. Saisie prévue avec le référentiel
              géographique (M3, M9, phase 6).
            </div>
          </section>

          <section className="carte">
            <h2>Quotas cible × ville (plan d’échantillonnage)</h2>
            <div className="tableau">
              <table>
                <thead>
                  <tr><th>Code</th><th>Cible</th>{t.villes.map((v) => <th key={v.id} className="n">{v.libelle}</th>)}<th className="n">Total</th></tr>
                </thead>
                <tbody>
                  {t.quotas.map((q) => (
                    <tr key={q.code}>
                      <td className="mono gris">{q.code}</td><td>{q.cible}</td>
                      {t.villes.map((v) => <td key={v.id} className="n">{q.villes[v.id]}</td>)}
                      <td className="n">{q.total}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td></td><td>Total</td>
                    {t.villes.map((v) => <td key={v.id} className="n">{t.quotas.reduce((s, q) => s + (q.villes[v.id] ?? 0), 0)}</td>)}
                    <td className="n">{t.quotas.reduce((s, q) => s + q.total, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <span className="petit gris">Échantillon par quotas : non probabiliste.</span>
          </section>

          <section className="carte">
            <h2>Liens personnels pré-remplis (M10)</h2>
            <span className="petit gris">
              Dans Google Forms : « Obtenir le lien prérempli », remplir l’identifiant et la ville d’un enquêteur, copier le lien ici.
            </span>
            <div className="formulaire">
              <label className="champ" style={{ gridColumn: "1 / -1" }}>
                Lien modèle
                <input type="url" value={modele} onChange={(e) => setModele(e.target.value)} placeholder="https://docs.google.com/forms/d/e/…/viewform?usp=pp_url&entry…" />
              </label>
              <label className="champ">
                Identifiant saisi dans le modèle
                <input value={enqModele} onChange={(e) => setEnqModele(e.target.value)} />
              </label>
              <label className="champ">
                Ville saisie dans le modèle (une par langue, séparées par des virgules)
                <input value={villesModele} onChange={(e) => setVillesModele(e.target.value)} />
              </label>
              <button type="button" className="bouton" onClick={generer} disabled={!modele}>Générer les liens</button>
            </div>
            {erreurLiens && <div className="bandeau erreur">{erreurLiens}</div>}
            {liens && (
              <div className="tableau">
                <table>
                  <thead><tr><th>Poste</th><th>Ville</th><th>Rôle</th><th>Lien</th><th>QR</th></tr></thead>
                  <tbody>
                    {liens.map((l) => (
                      <tr key={l.id}>
                        <td className="mono">{l.id}</td>
                        <td>{l.ville ?? <span className="gris">à choisir</span>}</td>
                        <td>{l.role}</td>
                        <td>
                          <button type="button" className="bouton second" onClick={() => copier(l.id, l.lien)}>{copie === l.id ? "Copié ✓" : "Copier"}</button>
                        </td>
                        <td><img src={l.qr_png} alt={`QR code du lien de ${l.id}`} width={72} height={72} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
