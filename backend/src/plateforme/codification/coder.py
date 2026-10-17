"""Codification des réponses au questionnaire (`coderFiche_` de V11, rendu générique).

Règles :
- choix unique : code de la modalité reconnue (libellé de la langue de référence, puis des autres
  langues, puis alias) ; sinon « Autre » + texte si la question le prévoit ; sinon 99 et
  anomalie `CODE_INCONNU:<variable>` ;
- choix multiple : 1 / 0 par modalité, 99 partout si la question est sautée ;
- grille : une variable par ligne, lignes repérées par leur libellé (toutes langues) ;
- règles de cohérence du dictionnaire, non évaluées si une réponse manque ;
- `FICHE_VIDE` si aucune question n'est renseignée (questions pré-remplies exclues),
  sinon `Q<n>_VIDE` si la question de cible est vide.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from plateforme.codification.reponses import ItemReponse, ReponseStructuree, est_vide
from plateforme.dictionnaire import expressions
from plateforme.dictionnaire.modele import Dictionnaire, Question, TypeQuestion
from plateforme.noyau.textes import cle, normaliser

ValeurCodee = int | float | str


@dataclass
class ResultatCodage:
    valeurs: dict[str, ValeurCodee] = field(default_factory=dict)
    anomalies: list[str] = field(default_factory=list)


class TableCodes:
    """Correspondance libellé → code d'une question, toutes langues, avec la priorité de V11."""

    def __init__(self, dico: Dictionnaire, q: Question) -> None:
        self.reference: dict[str, int] = {}
        self.autres: dict[str, int] = {}
        self.alias: dict[str, int] = {}
        for m in q.modalites:
            code = m.code
            self.reference.setdefault(cle(m.libelles.get(dico.langue_reference, "")), code)
            for lg, texte in m.libelles.items():
                if lg != dico.langue_reference:
                    self.autres.setdefault(cle(texte), code)
            for a in m.alias:
                self.alias.setdefault(cle(a), code)

    def code(self, texte: str) -> int | None:
        k = cle(texte)
        for table in (self.reference, self.autres, self.alias):
            if k in table:
                return table[k]
        return None


def _premier(v: object) -> str:
    return normaliser(v[0] if isinstance(v, list | tuple) and v else v)


def _liste(v: object) -> list[str]:
    if isinstance(v, list | tuple):
        return [normaliser(x) for x in v]
    return [normaliser(v)]


def coder_questions(dico: Dictionnaire, structure: ReponseStructuree) -> ResultatCodage:
    nr = dico.codes_speciaux.non_reponse
    res = ResultatCodage()
    v, anomalies = res.valeurs, res.anomalies
    for q in dico.questions:
        src: ItemReponse | None = structure.questions.get(q.numero)
        brut = src.valeur if src else None
        absent = est_vide(brut)
        if q.type is TypeQuestion.CHOIX_UNIQUE:
            if q.autre:
                v[q.autre.variable] = ""
            if absent:
                v[q.code] = nr
                continue
            texte = _premier(brut)
            code = TableCodes(dico, q).code(texte)
            if code is not None:
                v[q.code] = code
            elif q.autre:
                v[q.code] = q.autre.code
                v[q.autre.variable] = texte
            else:
                v[q.code] = nr
                anomalies.append(f"CODE_INCONNU:{q.code}")
        elif q.type is TypeQuestion.CHOIX_MULTIPLE:
            if absent:
                for m in q.modalites:
                    assert m.variable is not None
                    v[m.variable] = nr
                continue
            table = TableCodes(dico, q)
            coches = [table.code(x) for x in _liste(brut)]
            for m in q.modalites:
                assert m.variable is not None
                v[m.variable] = 1 if m.code in coches else 0
            if any(c is None and cle(x) for c, x in zip(coches, _liste(brut), strict=True)):
                anomalies.append(f"CODE_INCONNU:{q.code}")
        elif q.type is TypeQuestion.GRILLE:
            reponses = [] if absent else _liste(brut)
            table = TableCodes(dico, q)
            cles_form = [cle(x) for x in src.lignes] if src is not None and src.lignes is not None else None
            for k, li in enumerate(q.lignes):
                cles_ligne = {cle(t) for t in li.libelles.values()}
                idx = next((i for i, c in enumerate(cles_form) if c in cles_ligne), -1) if cles_form is not None else k
                r = reponses[idx] if 0 <= idx < len(reponses) else None
                if est_vide(r):
                    v[li.variable] = nr
                    continue
                code = table.code(str(r))
                if code is not None:
                    v[li.variable] = code
                else:
                    v[li.variable] = nr
                    anomalies.append(f"CODE_INCONNU:{li.variable}")
        elif q.type is TypeQuestion.NUMERIQUE:
            if absent:
                v[q.code] = nr
                continue
            try:
                v[q.code] = float(_premier(brut).replace(",", ".").replace(" ", ""))
            except ValueError:
                v[q.code] = nr
                anomalies.append(f"CODE_INCONNU:{q.code}")
        else:                                            # texte, date : liste jointe par « , » comme String(liste) en JavaScript
            v[q.code] = "" if absent else normaliser(",".join(str(x) for x in brut) if isinstance(brut, list | tuple) else brut)

    speciaux = dico.codes_speciaux.tous()
    for regle in dico.regles_coherence:
        if expressions.evaluer(regle.expression, v, speciaux):
            anomalies.append(regle.code)

    repondues = [q for q in dico.questions if q.prerempli is None and q.type is not TypeQuestion.TEXTE
                 and any(v.get(x) != nr for x in q.variables_codees())]
    cible = dico.question_cible()
    if not repondues:
        anomalies.append("FICHE_VIDE")
    elif cible is not None and v.get(cible.code) == nr:
        anomalies.append(f"Q{cible.numero}_VIDE")
    return res
