import type { ReactNode } from "react";
import { Badge } from "../../ui";
import {
  AVEC_MODALITES, CODE_VARIABLE, MESURES, TYPES, conformerAuType, prochainCode, proposerCode, variablesPrises,
  type Dictionnaire, type Question,
} from "./outils";

type Props = {
  q: Question; d: Dictionnaire; langue: string; editable: boolean; premier: boolean; dernier: boolean; codeAuto: boolean;
  changer: (q: Question, codeManuel?: boolean) => void; deplacer: (sens: -1 | 1) => void; dupliquer: () => void; supprimer: () => void;
};

// Une question du dictionnaire. La question de cible (quotas) et la ville pré-remplie par le lien personnel portent la
// logique du terrain : elles ne se suppriment pas et ne changent pas de type ici (le serveur le refuserait aussi).
export function EditeurQuestion({ q, d, langue, editable, premier, dernier, codeAuto, changer, deplacer, dupliquer, supprimer }: Props): ReactNode {
  const lr = d.langue_reference;
  const structurelle = q.role === "cible" || q.prerempli === "ville";
  const texte = (t: Record<string, string>, valeur: string): Record<string, string> => {
    const x = { ...t };
    if (valeur === "" && langue !== lr) delete x[langue]; else x[langue] = valeur;
    return x;
  };
  const libelle = (valeur: string): void => {
    const x = { ...q, libelles: texte(q.libelles, valeur) };
    if (codeAuto && langue === lr) {
      const pris = variablesPrises({ ...d, questions: d.questions.filter((y) => y.code !== q.code) });
      x.code = proposerCode(valeur, pris);
    }
    changer(x);
  };
  const id = (suffixe: string): string => `${suffixe}-${q.code}`;
  const codeInvalide = !CODE_VARIABLE.test(q.code);
  const modalites = AVEC_MODALITES.has(q.type);

  return <fieldset className="question-dico" aria-label={`Question ${q.code}`}
    style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.8rem 1rem", margin: "0.7rem 0" }}>
    <legend><code>{q.code}</code> — Q{q.numero} · {TYPES[q.type] ?? q.type}
      {q.role === "cible" && <> <Badge ton="info">Cible des quotas</Badge></>}
      {q.prerempli === "ville" && <> <Badge ton="info">Ville pré-remplie par le lien</Badge></>}
      {q.condition && <> <Badge ton="neutre">Condition : {q.condition}</Badge></>}</legend>
    {editable && <div className="actions" style={{ marginBottom: "0.5rem" }}>
      <button type="button" className="secondaire" onClick={() => deplacer(-1)} disabled={premier} aria-label={`Monter ${q.code}`}>↑ Monter</button>
      <button type="button" className="secondaire" onClick={() => deplacer(1)} disabled={dernier} aria-label={`Descendre ${q.code}`}>↓ Descendre</button>
      <button type="button" className="secondaire" onClick={dupliquer} disabled={structurelle} aria-label={`Dupliquer ${q.code}`}>Dupliquer</button>
      <button type="button" className="secondaire" onClick={supprimer} disabled={structurelle} aria-label={`Supprimer ${q.code}`}
        title={structurelle ? "Question liée aux quotas ou au lien personnel : elle ne se supprime pas" : undefined}>Supprimer</button>
    </div>}
    <form className="grille" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor={id("lib")}>Libellé{langue !== lr ? ` (${langue})` : ""}</label>
      <input id={id("lib")} aria-label={`Libellé ${q.code}`} disabled={!editable} value={q.libelles[langue] ?? ""}
        placeholder={langue !== lr ? q.libelles[lr] : undefined} onChange={(e) => libelle(e.target.value)} />
      <label htmlFor={id("aide")}>Aide</label>
      <input id={id("aide")} aria-label={`Aide ${q.code}`} disabled={!editable} value={q.aide[langue] ?? ""} placeholder="(facultatif)"
        onChange={(e) => { const a = { ...q.aide }; if (e.target.value === "") delete a[langue]; else a[langue] = e.target.value; changer({ ...q, aide: a }); }} />
      <label htmlFor={id("code")}>Code (8 lettres)</label>
      <span><input id={id("code")} aria-label={`Code ${q.code}`} disabled={!editable || structurelle} value={q.code} maxLength={8}
        style={{ textTransform: "uppercase", width: "8rem" }}
        onChange={(e) => changer({ ...q, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") }, true)} />
        {codeInvalide && <span className="erreur"> 8 lettres majuscules attendues</span>}
        {codeAuto && !codeInvalide && <span className="mention"> proposé depuis le libellé</span>}</span>
      <label htmlFor={id("sec")}>Section</label>
      <select id={id("sec")} aria-label={`Section ${q.code}`} disabled={!editable} value={q.section} onChange={(e) => changer({ ...q, section: e.target.value })}>
        {d.sections.map((s) => <option key={s.id} value={s.id}>{s.libelles[lr] ?? s.id}</option>)}
      </select>
      <label htmlFor={id("type")}>Type</label>
      <select id={id("type")} aria-label={`Type ${q.code}`} disabled={!editable || structurelle} value={q.type}
        onChange={(e) => changer(conformerAuType(q, e.target.value, d))}>
        {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {(q.type === "choix_unique" || q.type === "grille" || q.type === "numerique") && <>
        <label htmlFor={id("mes")}>Mesure</label>
        <select id={id("mes")} aria-label={`Mesure ${q.code}`} disabled={!editable} value={q.mesure ?? ""}
          onChange={(e) => changer({ ...q, mesure: e.target.value || null })}>
          {q.type === "numerique" && <option value="">(non déclarée)</option>}
          {MESURES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select></>}
      <label htmlFor={id("obl")}>Obligatoire</label>
      <span><input id={id("obl")} type="checkbox" aria-label={`Obligatoire ${q.code}`} checked={q.obligatoire}
        disabled={!editable || q.role === "cible"} onChange={(e) => changer({ ...q, obligatoire: e.target.checked })} />
        {q.role === "cible" && <span className="mention"> la question de cible reste obligatoire</span>}</span>
      <label htmlFor={id("cond")}>Condition d’affichage</label>
      <input id={id("cond")} aria-label={`Condition ${q.code}`} disabled={!editable || q.role === "cible"} value={q.condition ?? ""}
        placeholder="ex. VOUSETES in (1, 2)  (vide : toujours posée)" onChange={(e) => changer({ ...q, condition: e.target.value })} />
      {q.type === "texte" && <>
        <label htmlFor={id("lon")}>Longueur maximale</label>
        <input id={id("lon")} type="number" min={1} max={32767} aria-label={`Longueur ${q.code}`} disabled={!editable} value={q.longueur ?? 500}
          onChange={(e) => changer({ ...q, longueur: Number(e.target.value) || 500 })} /></>}
    </form>

    {modalites && <div className="tableau" style={{ marginTop: "0.6rem" }}><table aria-label={`Modalités de ${q.code}`}>
      <thead><tr><th>Code</th><th>Libellé{langue !== lr ? ` (${langue})` : ""}</th>{q.type === "choix_multiple" && <th>Variable</th>}<th /></tr></thead>
      <tbody>{q.modalites.map((m, i) => <tr key={`${m.code}-${i}`}>
        <td><input type="number" aria-label={`Code de la modalité ${i + 1} de ${q.code}`} disabled={!editable || structurelle} value={m.code}
          style={{ width: "4.5rem" }}
          onChange={(e) => changer({ ...q, modalites: q.modalites.map((x, j) => (j === i ? { ...x, code: Number(e.target.value) } : x)) })} /></td>
        <td><input aria-label={`Modalité ${m.code} de ${q.code}`} disabled={!editable} value={m.libelles[langue] ?? ""} placeholder={langue !== lr ? m.libelles[lr] : undefined}
          onChange={(e) => changer({ ...q, modalites: q.modalites.map((x, j) => (j === i ? { ...x, libelles: texte(x.libelles, e.target.value) } : x)) })} /></td>
        {q.type === "choix_multiple" && <td><input aria-label={`Variable de la modalité ${m.code} de ${q.code}`} disabled={!editable} maxLength={8}
          value={m.variable ?? ""} style={{ width: "8rem", textTransform: "uppercase" }}
          onChange={(e) => changer({ ...q, modalites: q.modalites.map((x, j) => (j === i ? { ...x, variable: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") } : x)) })} /></td>}
        <td>{editable && !structurelle && <span className="actions">
          <button type="button" className="secondaire" disabled={i === 0} aria-label={`Monter la modalité ${m.code} de ${q.code}`}
            onClick={() => { const ms = [...q.modalites]; [ms[i - 1], ms[i]] = [ms[i], ms[i - 1]]; changer({ ...q, modalites: ms }); }}>↑</button>
          <button type="button" className="secondaire" disabled={q.modalites.length <= 1} aria-label={`Retirer la modalité ${m.code} de ${q.code}`}
            onClick={() => changer({ ...q, modalites: q.modalites.filter((_, j) => j !== i) })}>Retirer</button></span>}</td>
      </tr>)}</tbody>
    </table>
      {editable && !structurelle && <div className="actions">
        <button type="button" className="secondaire" onClick={() => {
          const code = prochainCode(q);
          const m = { code, libelles: { [lr]: `Modalité ${code}` }, ...(q.type === "choix_multiple"
            ? { variable: proposerCode(`${q.libelles[lr] ?? ""} ${code}`, variablesPrises(d)) } : {}) };
          changer({ ...q, modalites: [...q.modalites, m] });
        }}>Ajouter une modalité</button>
        {q.type === "choix_unique" && <label className="mention"><input type="checkbox" aria-label={`Autre (précisez) ${q.code}`} checked={!!q.autre}
          onChange={(e) => changer({ ...q, autre: e.target.checked ? { code: prochainCode(q), libelles: { [lr]: "Autre (précisez)" },
            variable: proposerCode(`${q.libelles[lr] ?? ""} autre`, variablesPrises(d)), longueur: 80 } : null })} /> « Autre (précisez) » avec saisie libre</label>}
      </div>}
      {q.autre && <p className="mention">« Autre » : code {q.autre.code}, précision dans la variable <code>{q.autre.variable}</code>.</p>}
    </div>}

    {q.type === "grille" && <div className="tableau" style={{ marginTop: "0.6rem" }}><table aria-label={`Lignes de ${q.code}`}>
      <thead><tr><th>Variable</th><th>Ligne</th><th /></tr></thead>
      <tbody>{q.lignes.map((l, i) => <tr key={`${l.variable}-${i}`}>
        <td><input aria-label={`Variable de la ligne ${i + 1} de ${q.code}`} disabled={!editable} maxLength={8} value={l.variable}
          style={{ width: "8rem", textTransform: "uppercase" }}
          onChange={(e) => changer({ ...q, lignes: q.lignes.map((x, j) => (j === i ? { ...x, variable: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") } : x)) })} /></td>
        <td><input aria-label={`Ligne ${i + 1} de ${q.code}`} disabled={!editable} value={l.libelles[langue] ?? ""}
          onChange={(e) => changer({ ...q, lignes: q.lignes.map((x, j) => (j === i ? { ...x, libelles: texte(x.libelles, e.target.value) } : x)) })} /></td>
        <td>{editable && <button type="button" className="secondaire" disabled={q.lignes.length <= 1}
          onClick={() => changer({ ...q, lignes: q.lignes.filter((_, j) => j !== i) })}>Retirer</button>}</td>
      </tr>)}</tbody>
    </table>
      {editable && <button type="button" className="secondaire" onClick={() => changer({ ...q, lignes: [...q.lignes,
        { variable: proposerCode(`${q.libelles[lr] ?? ""} ligne ${q.lignes.length + 1}`, variablesPrises(d)), libelles: { [lr]: `Ligne ${q.lignes.length + 1}` } }] })}>
        Ajouter une ligne</button>}
    </div>}
  </fieldset>;
}
