"""Annexe « Questionnaire » du rapport, générée depuis le dictionnaire (source de vérité n° 1, CLAUDE.md §2) : jamais
ressaisie. Les paragraphes produits portent l'origine « dictionnaire » : leurs nombres (tranches d'âge, de montant…) sont des
libellés de modalités, pas des chiffres d'enquête ; le contrôle des chiffres sans lien ne s'y applique donc pas."""

from __future__ import annotations

from plateforme.analyse.rapport.modele import Element, Paragraphe, Titre
from plateforme.dictionnaire.modele import Dictionnaire, Question, QuestionIdentification, TypeQuestion

CASE = "☐"
POINTILLES = "……………………"


def _choix(dico: Dictionnaire, libelles: list[str]) -> str:
    return " ".join(f"{CASE} {lib}" for lib in libelles)


def _identification(dico: Dictionnaire, d: QuestionIdentification) -> str:
    titre = dico.texte(d.libelles)
    if d.role.value == "enqueteur":
        return f"{titre} : liste des enquêteurs du plan de terrain"
    if d.modalites:
        return f"{titre} : {_choix(dico, [dico.texte(m.libelles) for m in d.modalites])}"
    return f"{titre} : {POINTILLES}"


def _question(dico: Dictionnaire, q: Question) -> str:
    titre = dico.titre_question(q)
    titre = titre if titre.rstrip().endswith(("?", ":")) else titre + " :"
    if q.type in (TypeQuestion.TEXTE, TypeQuestion.NUMERIQUE, TypeQuestion.DATE):
        return f"{titre} {POINTILLES}"
    libelles = [dico.texte(m.libelles) for m in q.modalites]
    if q.autre is not None:
        libelles.append(f"{dico.texte(q.autre.libelles)} : {POINTILLES}")
    texte = f"{titre} {_choix(dico, libelles)}"
    if q.type is TypeQuestion.GRILLE:
        texte += " — pour chaque ligne : " + " ; ".join(dico.texte(li.libelles) for li in q.lignes)
    return texte


def elements_questionnaire(dico: Dictionnaire, niveau: int = 3) -> list[Element]:
    """Identification de la fiche puis une sous-partie par section du questionnaire, une ligne par question."""
    out: list[Element] = []
    if dico.identification:
        out.append(Titre(niveau, "Identification de la fiche"))
        out += [Paragraphe(_identification(dico, d), origine="dictionnaire") for d in dico.identification]
    for s in dico.sections:
        questions = [q for q in dico.questions if q.section == s.id]
        if not questions:
            continue
        out.append(Titre(niveau, dico.texte(s.libelles)))                 # libellé déjà numéroté dans le dictionnaire
        out += [Paragraphe(_question(dico, q), origine="dictionnaire") for q in sorted(questions, key=lambda q: q.numero)]
    return out
