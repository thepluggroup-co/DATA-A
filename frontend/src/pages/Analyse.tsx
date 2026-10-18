import { useState } from "react";
import { telecharger } from "../api";
import { nb, SansAnalyse, useSession } from "../commun";

const ANALYSES = ["Tris à plat", "Croisés % ligne / colonne", "Khi-deux, V de Cramér", "Tests A/B/C (Bonferroni)", "t, ANOVA", "Non paramétriques",
  "Corrélations", "Régressions", "ACP, AFC, ACM", "Typologies", "Pondération par calage"];
const CONTROLES = ["Bases et totaux identiques entre rapport, tri à plat et .sav", "Chaque chiffre lié à sa requête source",
  "Note de base en tête et sous chaque tableau", "Numérotation des tableaux et figures, légendes", "Aucun terme étranger au projet",
  "Conclusions séparées des recommandations"];

export default function PageAnalyse() {
  const { projet, analyse: a, envoi } = useSession();
  const [erreur, setErreur] = useState<string | null>(null);
  const [encours, setEncours] = useState(false);
  const base = async () => {
    if (!envoi) return;
    setEncours(true);
    setErreur(null);
    try {
      await telecharger(`/projets/${projet}/base.zip`, `${projet}_base.zip`, envoi);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEncours(false);
    }
  };
  return (
    <>
      <div className="entete">
        <div>
          <span className="gris petit">DONNEES_BRUTES immuables → DONNEES_CODEES recalculables</span>
          <h1>Base, analyse et rapport</h1>
        </div>
      </div>
      {!a && <SansAnalyse />}
      {a && (
        <section className="carte sombre">
          <div className="grille-kpi">
            <div className="kpi" style={{ background: "#0d2152", border: 0, color: "#fff" }}><span className="l" style={{ color: "#bfd3f5" }}>Fiches reçues</span><span className="v">{nb(a.note_de_base.collectees)}</span></div>
            <div className="kpi" style={{ background: "#0d2152", border: 0, color: "#fff" }}><span className="l" style={{ color: "#bfd3f5" }}>Valides</span><span className="v">{nb(a.note_de_base.valides)}</span></div>
            <div className="kpi" style={{ background: "#0d2152", border: 0, color: "#fff" }}><span className="l" style={{ color: "#bfd3f5" }}>Retenues pour l’analyse</span><span className="v" style={{ color: "#19c3e6" }}>{nb(a.note_de_base.retenues)}</span></div>
          </div>
          <span style={{ color: "#c9d6ee", lineHeight: 1.6 }}>{a.note_de_base.texte}</span>
          <div className="puces">
            {Object.entries(a.note_de_base.ecartees).map(([m, n]) => (
              <span key={m} className="pastille" style={{ background: "#0d2152", color: "#fff" }}>{m} : {n}</span>
            ))}
          </div>
        </section>
      )}
      <div className="rangee">
        <section className="carte">
          <h2>Exports <span className="pastille p-bleu">prêt · phase 2</span></h2>
          <span className="petit gris">Masque de dépouillement, base .sav relue et vérifiée (étiquettes, manquants), CSV, note de base, et CONTACTS séparé.</span>
          <button type="button" className="bouton" onClick={base} disabled={!envoi || encours}>{encours ? "Export…" : "Télécharger la base (.zip)"}</button>
          <div className="bandeau alerte">Le dossier CONTACTS/ de l’archive contient des données personnelles : à séparer de la base d’analyse, ne jamais la joindre au client.</div>
          {erreur && <div className="bandeau erreur">{erreur}</div>}
        </section>
        <section className="carte">
          <h2>Moteur d’analyse <span className="pastille p-neutre">à construire · phase 4</span></h2>
          <div className="puces">{ANALYSES.map((x) => <span key={x} className="pastille p-neutre">{x}</span>)}</div>
          <span className="petit gris">Critère : reproduire les sorties des syntaxes EDM_EE_*.sps à l’arrondi près (test d’or).</span>
        </section>
        <section className="carte">
          <h2>Rapport <span className="pastille p-neutre">à construire · phase 5</span></h2>
          {CONTROLES.map((c) => <span key={c} className="petit">☐ {c}</span>)}
          <span className="petit gris">Export bloqué tant qu’un contrôle échoue.</span>
        </section>
      </div>
    </>
  );
}
