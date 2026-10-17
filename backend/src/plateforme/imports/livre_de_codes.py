"""Import d'un livre de codes au format de l'onglet DICTIONNAIRE des masques EDM.

Colonnes : VARIABLE | QUESTION / LIBELLÉ | FORMAT SPSS | MESURE | CODE | MODALITÉ, une ligne
par modalité (la variable n'est écrite que sur la première). C'est le seul document qui
conserve le questionnaire V2 tel qu'il était dans le formulaire en ligne (décision D-014).

Le livre de codes ne contient ni les sections, ni les codes de groupe des choix multiples et
des grilles, ni l'anglais : ils sont repris d'un dictionnaire de RÉFÉRENCE (rapprochement par
code de variable). Ce qui ne peut pas être rapproché est signalé dans `avertissements`.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

from plateforme.dictionnaire.modele import (
    VARIABLES_RESERVEES,
    Autre,
    Dictionnaire,
    LigneGrille,
    Mesure,
    Modalite,
    Question,
    Section,
    TypeQuestion,
)
from plateforme.noyau.textes import cle, normaliser, numero_question, retirer_numero

SUFFIXE_AUTRE = re.compile(r"\s+-\s+Autre \(précisez\)$")


@dataclass
class _Variable:
    code: str
    label: str
    spss: str
    mesure: str
    valeurs: list[tuple[int, str]] = field(default_factory=list)


@dataclass
class ResultatImport:
    dictionnaire: Dictionnaire
    avertissements: list[str]


def lire_csv(chemin: str | Path) -> list[list[str]]:
    with Path(chemin).open(encoding="utf-8-sig", newline="") as f:
        return [ligne for ligne in csv.reader(f, delimiter=";")]


def lire_xlsx(chemin: str | Path, onglet: str = "DICTIONNAIRE") -> list[list[str]]:
    """Lit UN onglet d'un classeur (les autres onglets, qui peuvent contenir des données personnelles, ne sont pas lus)."""
    from openpyxl import load_workbook
    wb = load_workbook(chemin, read_only=True, data_only=True)
    try:
        ws = wb[onglet]
        return [["" if v is None else str(v) for v in ligne] for ligne in ws.iter_rows(values_only=True)]
    finally:
        wb.close()


def _variables(lignes: list[list[str]]) -> list[_Variable]:
    entete = [cle(x) for x in lignes[0]]
    if entete[:2] != ["variable", "questionlibelle"]:
        raise ValueError(f"en-tête inattendu : {lignes[0]}")
    out: list[_Variable] = []
    for brut in lignes[1:]:
        ligne = [*brut, "", "", "", "", "", ""][:6]
        var, label, spss, mesure, code, modalite = (normaliser(x) for x in ligne)
        if var:
            out.append(_Variable(var, label, spss, mesure))
        if code and out:
            out[-1].valeurs.append((int(float(code)), modalite))
    return out


def depuis_livre_de_codes(lignes: list[list[str]], etude: str, version: str, source: str,
                          reference: Dictionnaire, nr: int = 99) -> ResultatImport:
    avert: list[str] = []
    variables = [v for v in _variables(lignes) if v.code not in VARIABLES_RESERVEES]
    ref_par_variable = {v: q for q in reference.questions for v in [q.code, *q.variables()]}

    # Regroupement par numéro de question, dans l'ordre du livre de codes
    groupes: dict[int, list[_Variable]] = {}
    for v in variables:
        n = numero_question(v.label)
        if n is None:
            avert.append(f"{v.code} : libellé sans numéro de question, ignoré")
            continue
        groupes.setdefault(n, []).append(v)

    sections: list[Section] = []
    questions: list[Question] = []
    for n, vs in groupes.items():
        principale = vs[0]
        ref = ref_par_variable.get(principale.code)
        if ref is not None:
            section = reference.section(ref.section)
        else:
            section = Section(id="S_INCONNUE", libelles={"fr": "Section non rapprochée"})
            avert.append(f"Q{n} ({principale.code}) : absente du dictionnaire de référence, section inconnue")
        if not any(s.id == section.id for s in sections):
            sections.append(section)

        def mods(v: _Variable) -> list[Modalite]:
            return [Modalite(code=c, libelles={"fr": lib}) for c, lib in v.valeurs if c != nr]

        binaires = all({c for c, _ in v.valeurs} == {1, 0, nr} for v in vs)
        if binaires:
            base = principale.label.rsplit(" - ", 1)[0]
            code = ref.code if ref is not None else principale.code
            if ref is None:
                avert.append(f"Q{n} : code de groupe du choix multiple inconnu, {code} utilisé")
            questions.append(Question(
                numero=n, code=code, section=section.id, libelles={"fr": retirer_numero(base)},
                type=TypeQuestion.CHOIX_MULTIPLE,
                modalites=[Modalite(code=i + 1, libelles={"fr": v.label.rsplit(" - ", 1)[1]}, variable=v.code)
                           for i, v in enumerate(vs)]))
            continue
        if principale.spss.startswith("A"):
            questions.append(Question(numero=n, code=principale.code, section=section.id,
                                      libelles={"fr": retirer_numero(principale.label)}, type=TypeQuestion.TEXTE,
                                      obligatoire=False, longueur=int(principale.spss[1:] or 500)))
            continue
        numeriques = [v for v in vs if v.valeurs]
        textes = [v for v in vs if not v.valeurs]
        if len(numeriques) > 1:                                   # grille : une variable par ligne
            base = principale.label.rsplit(" - ", 1)[0]
            code = ref.code if ref is not None else principale.code
            questions.append(Question(
                numero=n, code=code, section=section.id, libelles={"fr": retirer_numero(base)}, type=TypeQuestion.GRILLE,
                mesure=Mesure(principale.mesure), modalites=mods(principale),
                lignes=[LigneGrille(variable=v.code, libelles={"fr": v.label.rsplit(" - ", 1)[1]}) for v in numeriques]))
            continue
        autre = None
        modalites = mods(principale)
        if textes and SUFFIXE_AUTRE.search(textes[0].label):
            lib_autre = next((m for m in modalites if cle(m.libelles["fr"]) == "autre"), None)
            if lib_autre is None:
                avert.append(f"Q{n} : variable {textes[0].code} sans modalité « Autre » correspondante")
            else:
                modalites = [m for m in modalites if m is not lib_autre]
                autre = Autre(code=lib_autre.code, libelles={"fr": lib_autre.libelles["fr"]}, variable=textes[0].code,
                              longueur=int(textes[0].spss[1:] or 80))
        questions.append(Question(
            numero=n, code=principale.code, section=section.id, libelles={"fr": retirer_numero(principale.label)},
            type=TypeQuestion.CHOIX_UNIQUE, mesure=Mesure(principale.mesure), modalites=modalites, autre=autre,
            role=ref.role if ref is not None else None, prerempli=ref.prerempli if ref is not None else None))

    dico = Dictionnaire(etude=etude, version=version, langues=["fr"], source=source,
                        sections=sections, identification=list(reference.identification), questions=questions)
    return ResultatImport(dico, avert)
