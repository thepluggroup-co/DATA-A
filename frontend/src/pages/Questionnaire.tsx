import { useState } from "react";
import { telecharger, type Diagnostic, type Dictionnaire, type Difference } from "../api";
import { Etat, useDonnees, useSession } from "../commun";

export default function PageQuestionnaire() {
  const { projet } = useSession();
  const dico = useDonnees<Dictionnaire>(`/projets/${projet}/dictionnaire`);
  const diag = useDonnees<Diagnostic>(`/projets/${projet}/dictionnaire/diagnostic`);
  const versions = useDonnees<string[]>(`/projets/${projet}/dictionnaire/versions`);
  const [section, setSection] = useState("TOUT");
  const [ancienne, setAncienne] = useState<string | null>(null);
  const diff = useDonnees<Difference>(ancienne ? `/projets/${projet}/dictionnaire/diff?ancienne=${encodeURIComponent(ancienne)}` : null);
  const [erreurZip, setErreurZip] = useState<string | null>(null);
  const [zip, setZip] = useState(false);
  const d = dico.donnees;

  const generer = async () => {
    setZip(true);
    setErreurZip(null);
    try {
      await telecharger(`/projets/${projet}/dictionnaire/generations.zip`, `${projet}_generations.zip`);
    } catch (e) {
      setErreurZip((e as Error).message);
    } finally {
      setZip(false);
    }
  };

  return (
    <>
      <div className="entete">
        <div>
          <span className="mono petit gris">projets/{projet}/dictionnaire.yaml</span>
          <h1>Atelier questionnaire</h1>
        </div>
        {d && (
          <div className="puces" style={{ flexDirection: "row" }}>
            <span className="pastille p-bleu">version {d.version} · {d.statut}</span>
            <span className="pastille p-bleu">{d.langues.join(" + ").toUpperCase()} · mêmes codes</span>
          </div>
        )}
      </div>
      <Etat charge={dico.charge} erreur={dico.erreur} />
      {d && (
        <div className="rangee">
          <section className="carte" style={{ flex: "3 1 600px" }}>
            <div className="onglets" role="tablist" aria-label="Sections">
              <button type="button" role="tab" aria-selected={section === "TOUT"} className={section === "TOUT" ? "actif" : ""} onClick={() => setSection("TOUT")}>
                Toutes ({d.questions.length})
              </button>
              {d.sections.map((s) => (
                <button key={s.id} type="button" role="tab" aria-selected={section === s.id} className={section === s.id ? "actif" : ""} onClick={() => setSection(s.id)}>
                  {s.libelles.fr}
                </button>
              ))}
            </div>
            <div className="tableau">
              <table>
                <thead>
                  <tr><th>N°</th><th>Variable</th><th>Libellé</th><th>Type</th><th>Mesure</th><th className="n">Modalités</th><th className="n">Variables</th></tr>
                </thead>
                <tbody>
                  {d.questions.filter((q) => section === "TOUT" || q.section === section).map((q) => (
                    <tr key={q.code}>
                      <td className="mono gris">Q{q.numero}</td>
                      <td className="mono">{q.code}</td>
                      <td>
                        {q.libelles.fr}
                        {q.obligatoire && <span className="pastille p-ambre" style={{ marginLeft: 8 }}>obligatoire</span>}
                      </td>
                      <td className="gris">{q.type.replace("_", " ")}</td>
                      <td className="mono petit">{q.mesure ?? "—"}</td>
                      <td className="n">{q.modalites.length || "—"}</td>
                      <td className="n">{d.nb_variables[q.code]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="petit gris">
              Manquants : {d.codes_speciaux.non_applicable} {d.codes_speciaux.libelles[String(d.codes_speciaux.non_applicable)]?.fr} ·{" "}
              {d.codes_speciaux.ne_sait_pas} {d.codes_speciaux.libelles[String(d.codes_speciaux.ne_sait_pas)]?.fr} ·{" "}
              {d.codes_speciaux.non_reponse} {d.codes_speciaux.libelles[String(d.codes_speciaux.non_reponse)]?.fr}
            </span>
          </section>

          <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="carte sombre">
              <h2>Générer les dérivés</h2>
              <span style={{ fontSize: 14, color: "#c9d6ee", lineHeight: 1.6 }}>
                Masque de dépouillement, syntaxe SPSS d’étiquetage, livre de codes, paramétrage, gabarit de tri à plat, requêtes Google Forms,
                diagnostic.
              </span>
              <button type="button" className="bouton" style={{ background: "#19c3e6", borderColor: "#19c3e6", color: "#061433" }} onClick={generer} disabled={zip}>
                {zip ? "Génération…" : "Télécharger les générations (.zip)"}
              </button>
              {erreurZip && <div className="bandeau erreur">{erreurZip}</div>}
            </section>

            <section className="carte">
              <h2>Diagnostic formulaire ↔ dictionnaire</h2>
              <Etat charge={diag.charge} erreur={diag.erreur} />
              {diag.donnees && (
                <>
                  <span className={`pastille ${diag.donnees.blocages ? "p-rouge" : "p-bleu"}`}>{diag.donnees.verdict}</span>
                  {diag.donnees.chemin_sans_cible && (
                    <div className="bandeau erreur">Un chemin du formulaire contourne la question de cible : {diag.donnees.chemin_sans_cible.join(" → ")}</div>
                  )}
                  {diag.donnees.lignes.filter((l) => !l.statut.includes("✔")).slice(0, 8).map((l, i) => (
                    <div key={i} className="petit"><strong>{l.element}</strong> · {l.detail}</div>
                  ))}
                </>
              )}
            </section>

            <section className="carte">
              <h2>Versions</h2>
              {versions.donnees?.length === 0 && <span className="gris petit">Aucune version antérieure.</span>}
              {versions.donnees?.map((v) => (
                <button key={v} type="button" className="bouton second" onClick={() => setAncienne(v)}>
                  Différences {v} → v{d.version}
                </button>
              ))}
              <Etat charge={diff.charge} erreur={diff.erreur} />
              {diff.donnees && (
                <>
                  <span className="petit">
                    {diff.donnees.ecarts.length} écart(s), dont <strong>{diff.donnees.migration}</strong> imposant une migration des données.
                  </span>
                  <pre className="texte">{diff.donnees.texte}</pre>
                </>
              )}
            </section>

            <section className="carte">
              <h2>Règles de cohérence · {d.regles_coherence.length}</h2>
              {d.regles_coherence.map((r) => (
                <div key={r.code} className="mono petit">
                  {r.code}
                  <br />
                  <span className="gris">{r.expression}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
