import type { ResumeProjet } from "../api";
import { dateFr, Etat, nb, useDonnees, useSession } from "../commun";

// État réel des modules dans le dépôt (docs/PHASE_1..3.md, DECISIONS.md) — à mettre à jour à chaque phase validée.
const CHAINE: [string, string, "pret" | "partiel" | "afaire"][] = [
  ["M0", "Brief", "afaire"], ["M2", "Échantillon", "partiel"], ["M4", "Questionnaire", "pret"], ["M5", "Chronogramme", "afaire"],
  ["M6", "Recrutement", "afaire"], ["M7", "Documents", "afaire"], ["M9", "Organisation", "partiel"], ["M10", "Déploiement", "pret"],
  ["M11", "Suivi", "pret"], ["M12", "Qualité", "pret"], ["M13", "Finances", "afaire"], ["M14", "Analyse", "partiel"], ["M15", "Rapport", "afaire"],
];
const STYLE = { pret: "p-bleu", partiel: "p-ambre", afaire: "p-neutre" } as const;
const LIBELLE = { pret: "prêt", partiel: "partiel", afaire: "à construire" } as const;

export default function PageProjets() {
  const { projet } = useSession();
  const { donnees: p, erreur, charge } = useDonnees<ResumeProjet>(`/projets/${projet}`);
  return (
    <>
      <div className="entete">
        <div>
          <span className="gris petit">THE PLUG · Douala</span>
          <h1>Projet</h1>
        </div>
      </div>
      <Etat charge={charge} erreur={erreur} />
      {p && (
        <>
          <section className="carte">
            <span className="mono petit gris">
              {p.etude} · dictionnaire v{p.version_dictionnaire} ({p.statut_dictionnaire})
            </span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{p.titre.fr ?? p.etude}</span>
            <span className="gris petit">
              {p.villes.map((v) => v.libelle).join(", ")} · {p.postes} postes + {p.reserves} réserves ·{" "}
              {p.jours.length ? `${dateFr(p.jours[0])} → ${dateFr(p.jours[p.jours.length - 1])} (J1–J${p.jours.length})` : "calendrier non saisi"}
            </span>
          </section>
          <section className="grille-kpi">
            <div className="kpi"><span className="l">Objectif de fiches</span><span className="v">{nb(p.objectif_total)}</span></div>
            <div className="kpi"><span className="l">Somme des quotas</span><span className="v">{nb(p.quota_total)}</span></div>
            <div className="kpi"><span className="l">Questions</span><span className="v">{p.questions}</span></div>
            <div className="kpi"><span className="l">Variables du questionnaire</span><span className="v">{p.variables}</span></div>
            <div className="kpi"><span className="l">Colonnes du masque</span><span className="v">{p.colonnes_masque}</span></div>
            <div className="kpi"><span className="l">Langues</span><span className="v">{p.langues.join(" · ").toUpperCase()}</span></div>
          </section>
          {p.objectif_total !== null && p.objectif_total !== p.quota_total && (
            <div className="bandeau alerte">
              L’objectif du plan de terrain ({p.objectif_total}) diffère de la somme des quotas ({p.quota_total}) : à arbitrer.
            </div>
          )}
          <section className="carte">
            <h2>Chaîne de production</h2>
            <div className="chaine">
              {CHAINE.map(([m, nom, etat]) => (
                <div key={m} className={STYLE[etat]}>
                  <span>{m} · {LIBELLE[etat]}</span>
                  {nom}
                </div>
              ))}
            </div>
            <span className="petit gris">« Prêt » : moteur testé et validé (phases 1 à 3). « Partiel » : une partie seulement existe dans le code.</span>
          </section>
          <section className="rangee">
            <a className="carte" href="#/questionnaire" style={{ textDecoration: "none", color: "inherit" }}>
              <h2>Questionnaire →</h2>
              <span className="gris petit">Dictionnaire, diagnostic du formulaire, versions, générations.</span>
            </a>
            <a className="carte" href="#/suivi" style={{ textDecoration: "none", color: "inherit" }}>
              <h2>Suivi temps réel →</h2>
              <span className="gris petit">Envoyer le classeur de réponses : tableau de bord, quotas, rapport du jour.</span>
            </a>
            <a className="carte" href="#/organisation" style={{ textDecoration: "none", color: "inherit" }}>
              <h2>Organisation →</h2>
              <span className="gris petit">Postes, remplacements, quotas, liens personnels et QR codes.</span>
            </a>
          </section>
        </>
      )}
    </>
  );
}
