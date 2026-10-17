"""Rapport de différences entre deux versions d'un dictionnaire.

Les questions sont appariées par CODE de variable (stable d'une version à l'autre : voir le
journal « CHANGEMENTS V2 -> V3 » du script V3). Les modalités sont appariées par libellé
normalisé : un même libellé qui change de code est un RECODAGE, à signaler en priorité car
il impose de migrer les données déjà collectées.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from plateforme.dictionnaire.modele import Dictionnaire, Question
from plateforme.noyau.textes import cle


class TypeEcart(StrEnum):
    QUESTION_AJOUTEE = "question ajoutée"
    QUESTION_SUPPRIMEE = "question supprimée"
    QUESTION_RENUMEROTEE = "question renumérotée"
    LIBELLE_MODIFIE = "libellé modifié"
    TYPE_MODIFIE = "type modifié"
    MESURE_MODIFIEE = "mesure modifiée"
    OBLIGATION_MODIFIEE = "obligation modifiée"
    SECTION_MODIFIEE = "section modifiée"
    MODALITE_AJOUTEE = "modalité ajoutée"
    MODALITE_SUPPRIMEE = "modalité supprimée"
    MODALITE_RECODEE = "modalité recodée"
    MODALITE_RENOMMEE = "modalité renommée"
    AUTRE_AJOUTE = "« Autre » ajouté"
    AUTRE_SUPPRIME = "« Autre » supprimé"
    AUTRE_RECODE = "« Autre » recodé"
    VARIABLE_AJOUTEE = "variable ajoutée"
    VARIABLE_SUPPRIMEE = "variable supprimée"
    REGLE_AJOUTEE = "règle ajoutée"
    REGLE_SUPPRIMEE = "règle supprimée"
    REGLE_MODIFIEE = "règle modifiée"
    LANGUE_AJOUTEE = "langue ajoutée"
    LANGUE_SUPPRIMEE = "langue supprimée"


# Écarts qui imposent une migration des données déjà collectées
MIGRATION = {TypeEcart.MODALITE_RECODEE, TypeEcart.MODALITE_SUPPRIMEE, TypeEcart.AUTRE_RECODE, TypeEcart.AUTRE_SUPPRIME,
             TypeEcart.TYPE_MODIFIE, TypeEcart.QUESTION_SUPPRIMEE, TypeEcart.VARIABLE_SUPPRIMEE}


@dataclass(frozen=True)
class Ecart:
    type: TypeEcart
    question: str          # code de la question (ou de la règle)
    detail: str

    @property
    def migration(self) -> bool:
        return self.type in MIGRATION


def _modalites(d: Dictionnaire, q: Question) -> dict[str, tuple[int, str]]:
    """clé du libellé de référence -> (code, libellé)."""
    return {cle(d.texte(m.libelles)): (m.code, d.texte(m.libelles)) for m in q.modalites}


def _comparer_question(a: Dictionnaire, qa: Question, b: Dictionnaire, qb: Question) -> list[Ecart]:
    e: list[Ecart] = []
    c = qb.code
    if qa.numero != qb.numero:
        e.append(Ecart(TypeEcart.QUESTION_RENUMEROTEE, c, f"Q{qa.numero} → Q{qb.numero}"))
    for lg in sorted(set(qa.libelles) & set(qb.libelles) & set(a.langues) & set(b.langues)):
        la, lb = qa.libelles.get(lg, ""), qb.libelles.get(lg, "")
        if cle(la) != cle(lb):
            e.append(Ecart(TypeEcart.LIBELLE_MODIFIE, c, f"[{lg}] « {la} » → « {lb} »"))
    if qa.type != qb.type:
        e.append(Ecart(TypeEcart.TYPE_MODIFIE, c, f"{qa.type.value} → {qb.type.value}"))
    if qa.mesure != qb.mesure:
        e.append(Ecart(TypeEcart.MESURE_MODIFIEE, c, f"{qa.mesure} → {qb.mesure}"))
    if qa.obligatoire != qb.obligatoire:
        e.append(Ecart(TypeEcart.OBLIGATION_MODIFIEE, c, f"{'obligatoire' if qa.obligatoire else 'facultative'} → "
                                                         f"{'obligatoire' if qb.obligatoire else 'facultative'}"))
    sa, sb = a.texte(a.section(qa.section).libelles), b.texte(b.section(qb.section).libelles)
    if cle(sa) != cle(sb):
        e.append(Ecart(TypeEcart.SECTION_MODIFIEE, c, f"« {sa} » → « {sb} »"))
    ma, mb = _modalites(a, qa), _modalites(b, qb)
    alias_b = {cle(x): m.code for m in qb.modalites for x in m.alias}
    codes_b = {code: lib for code, lib in mb.values()}
    for k, (code, lib) in ma.items():
        if k in mb:
            if mb[k][0] != code:
                e.append(Ecart(TypeEcart.MODALITE_RECODEE, c, f"« {lib} » : {code} → {mb[k][0]}"))
        elif k in alias_b:
            nouveau = f"« {lib} » devient « {codes_b[alias_b[k]]} », ancien libellé conservé en alias"
            if alias_b[k] != code:
                e.append(Ecart(TypeEcart.MODALITE_RECODEE, c, f"{nouveau} ; code {code} → {alias_b[k]}"))
            else:
                e.append(Ecart(TypeEcart.MODALITE_RENOMMEE, c, f"{nouveau} (code {code})"))
        elif code in codes_b and cle(codes_b[code]) not in ma:
            e.append(Ecart(TypeEcart.MODALITE_RENOMMEE, c, f"code {code} : « {lib} » → « {codes_b[code]} »"))
        else:
            e.append(Ecart(TypeEcart.MODALITE_SUPPRIMEE, c, f"« {lib} » ({code})"))
    renommees_b = {codes_b[alias_b[k]] for k in ma if k not in mb and k in alias_b}
    for k, (code, lib) in mb.items():
        if k in ma or lib in renommees_b:
            continue
        ancien = next((la for ka, (ca, la) in ma.items() if ca == code and ka not in mb and ka not in alias_b), None)
        if ancien is not None:
            continue                         # déjà signalée comme renommée
        e.append(Ecart(TypeEcart.MODALITE_AJOUTEE, c, f"« {lib} » ({code})"))
    if qa.autre and not qb.autre:
        e.append(Ecart(TypeEcart.AUTRE_SUPPRIME, c, f"code {qa.autre.code}, variable {qa.autre.variable}"))
    elif qb.autre and not qa.autre:
        e.append(Ecart(TypeEcart.AUTRE_AJOUTE, c, f"code {qb.autre.code}, variable {qb.autre.variable}"))
    elif qa.autre and qb.autre and qa.autre.code != qb.autre.code:
        e.append(Ecart(TypeEcart.AUTRE_RECODE, c, f"{qa.autre.code} → {qb.autre.code}"))
    va, vb = qa.variables(), qb.variables()
    for v in vb:
        if v not in va and v != qb.code:
            e.append(Ecart(TypeEcart.VARIABLE_AJOUTEE, c, v))
    for v in va:
        if v not in vb and v != qa.code:
            e.append(Ecart(TypeEcart.VARIABLE_SUPPRIMEE, c, v))
    return e


def comparer(ancien: Dictionnaire, nouveau: Dictionnaire) -> list[Ecart]:
    """Écarts de `ancien` à `nouveau`, dans l'ordre du nouveau questionnaire puis des suppressions."""
    ecarts: list[Ecart] = []
    for lg in nouveau.langues:
        if lg not in ancien.langues:
            ecarts.append(Ecart(TypeEcart.LANGUE_AJOUTEE, "*", lg))
    for lg in ancien.langues:
        if lg not in nouveau.langues:
            ecarts.append(Ecart(TypeEcart.LANGUE_SUPPRIMEE, "*", lg))
    par_code_a = {q.code: q for q in ancien.questions}
    par_code_b = {q.code: q for q in nouveau.questions}
    for qb in nouveau.questions:
        qa = par_code_a.get(qb.code)
        if qa is None:
            ecarts.append(Ecart(TypeEcart.QUESTION_AJOUTEE, qb.code, nouveau.titre_question(qb)))
            ecarts += [Ecart(TypeEcart.VARIABLE_AJOUTEE, qb.code, v) for v in qb.variables() if v != qb.code]
        else:
            ecarts += _comparer_question(ancien, qa, nouveau, qb)
    for qa in ancien.questions:
        if qa.code not in par_code_b:
            ecarts.append(Ecart(TypeEcart.QUESTION_SUPPRIMEE, qa.code, ancien.titre_question(qa)))
    regles_a = {r.code: r for r in ancien.regles_coherence}
    regles_b = {r.code: r for r in nouveau.regles_coherence}
    for code, r in regles_b.items():
        if code not in regles_a:
            ecarts.append(Ecart(TypeEcart.REGLE_AJOUTEE, code, r.expression))
        elif regles_a[code].expression.replace(" ", "") != r.expression.replace(" ", ""):
            ecarts.append(Ecart(TypeEcart.REGLE_MODIFIEE, code, f"{regles_a[code].expression} → {r.expression}"))
    for code, r in regles_a.items():
        if code not in regles_b:
            ecarts.append(Ecart(TypeEcart.REGLE_SUPPRIMEE, code, r.expression))
    return ecarts


def rapport_texte(ancien: Dictionnaire, nouveau: Dictionnaire, ecarts: list[Ecart]) -> str:
    """Rapport lisible (Markdown) ; les écarts qui imposent une migration des données sont en tête."""
    lignes = [f"# Différences {ancien.etude} : version {ancien.version} → {nouveau.version}", ""]
    if not ecarts:
        return "\n".join([*lignes, "Aucune différence."])
    migr = [e for e in ecarts if e.migration]
    lignes.append(f"{len(ecarts)} écart(s), dont {len(migr)} imposant une migration des données déjà collectées.")
    for titre, liste in (("Écarts imposant une migration", migr), ("Autres écarts", [e for e in ecarts if not e.migration])):
        if liste:
            lignes += ["", f"## {titre}", "", "| Question | Écart | Détail |", "|---|---|---|"]
            lignes += [f"| {e.question} | {e.type.value} | {e.detail.replace('|', '/')} |" for e in liste]
    return "\n".join(lignes) + "\n"
