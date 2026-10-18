import { useState } from "react";
import { dateFr, nb, pct, SansAnalyse, useSession } from "../commun";

const STATUT: Record<string, string> = { OK: "p-bleu", A_VERIFIER: "p-ambre", REJETE: "p-rouge", ANNULEE: "p-neutre" };

export default function PageQualite() {
  const { analyse: a } = useSession();
  const [filtre, setFiltre] = useState<string | null>(null);
  const [limite, setLimite] = useState(50);
  if (!a)
    return (
      <>
        <h1>Contrôle qualité</h1>
        <SansAnalyse />
      </>
    );
  const q = a.qualite;
  const fiches = q.a_verifier.filter((f) => !filtre || f.anomalies.some((x) => x.startsWith(filtre)));
  return (
    <>
      <div className="entete">
        <div>
          <span className="gris petit">codification.qualite · controle.effet_enqueteur · controle.rappels</span>
          <h1>Contrôle qualité</h1>
        </div>
        <div className="puces">
          {Object.entries(q.statuts).map(([s, n]) => (
            <span key={s} className={`pastille ${STATUT[s] ?? "p-neutre"}`}>{s} · {n}</span>
          ))}
        </div>
      </div>

      <div className="bandeau info">
        Décider d’une fiche (OK, REJETE, ANNULEE, EXCLUE) : l’inscrire dans le fichier de décisions YAML et le renvoyer avec le classeur dans Suivi.
        L’enregistrement des décisions depuis l’écran arrive avec la base PostgreSQL (synchronisation).
      </div>

      <div className="rangee">
        <section className="carte" style={{ flex: "3 1 560px" }}>
          <h2>File A_VERIFIER · {q.a_verifier.length}</h2>
          <div className="onglets">
            <button type="button" className={!filtre ? "actif" : ""} onClick={() => setFiltre(null)}>Toutes</button>
            {Object.entries(q.anomalies).map(([k, n]) => (
              <button key={k} type="button" className={filtre === k ? "actif" : ""} onClick={() => setFiltre(k)}>{k} · {n}</button>
            ))}
          </div>
          <div className="tableau">
            <table>
              <thead><tr><th>N° de fiche</th><th>Poste</th><th>Date</th><th>Anomalies</th></tr></thead>
              <tbody>
                {fiches.slice(0, limite).map((f) => (
                  <tr key={f.numfiche}>
                    <td className="mono">{f.numfiche}</td><td className="mono">{f.enqueteur}</td><td className="petit">{dateFr(f.date)} {f.heure}</td>
                    <td><div className="puces">{f.anomalies.map((x) => <span key={x} className="code">{x}</span>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fiches.length > limite && <button type="button" className="bouton second" onClick={() => setLimite(limite + 100)}>Afficher plus ({fiches.length - limite} restantes)</button>}
        </section>

        <div style={{ flex: "2 1 340px", display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="carte sombre">
            <h2>Effet enquêteur</h2>
            <span style={{ fontSize: 14, color: "#c9d6ee" }}>
              {a.effet_enqueteur.tests} tests à profil égal (khi-deux, Bonferroni, barrière de Tukey) · {a.effet_enqueteur.signales.length} signalement(s)
            </span>
            {a.effet_enqueteur.signales.length === 0 && <span style={{ color: "#c9d6ee" }}>Aucun écart signalé.</span>}
            {a.effet_enqueteur.signales.map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid #1e3a78", paddingTop: 10 }}>
                <span className="mono">{s.enqueteur} · {s.variable} · {s.groupe}</span>
                <span className="petit" style={{ color: "#c9d6ee" }}>{s.libelle} — « {s.modalite} »</span>
                <span>{pct(s.part_enqueteur)} chez l’enquêteur contre {pct(s.part_attendue)} attendus à profil égal</span>
                <span className="petit" style={{ color: "#bfd3f5" }}>n = {s.n} · p corrigé = {s.p_corrige.toExponential(1)} · w = {nb(s.w)}</span>
              </div>
            ))}
            <span className="petit" style={{ color: "#bfd3f5" }}>Un signalement déclenche une vérification ; ce n’est pas une preuve.</span>
          </section>
          <section className="carte">
            <h2>Rappels de contrôle du {dateFr(a.jour)}</h2>
            <span className="petit gris">Tirage reproductible (graine {q.graine_rappels}). Les téléphones restent dans l’archive des livrables.</span>
            <div className="tableau">
              <table>
                <thead><tr><th>N° de fiche</th><th>Poste</th><th className="n">Priorité</th><th>Motif</th></tr></thead>
                <tbody>
                  {q.rappels.map((r) => (
                    <tr key={r.numfiche}><td className="mono">{r.numfiche}</td><td className="mono">{r.enqueteur}</td><td className="n">{r.priorite}</td><td className="petit">{r.motif}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
