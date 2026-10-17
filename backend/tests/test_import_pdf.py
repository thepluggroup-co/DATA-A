"""CRITÈRE D'ACCEPTATION (D-014) : le PDF « 03 » importé ne diffère de V11 que par des libellés."""

from __future__ import annotations

import pytest
from conftest import PDF_03

from plateforme.dictionnaire.diff import TypeEcart, comparer
from plateforme.dictionnaire.modele import Dictionnaire, TypeQuestion
from plateforme.imports.pdf import ResultatImport, depuis_pdf, depuis_texte


@pytest.fixture(scope="module")
def import_03(dico_edm: Dictionnaire) -> ResultatImport:
    return depuis_pdf(PDF_03, version="03-pdf", reference=dico_edm)


def test_brouillon_sans_avertissement(import_03: ResultatImport) -> None:
    assert import_03.dictionnaire.statut == "brouillon"
    assert import_03.avertissements == []
    assert len(import_03.dictionnaire.questions) == 42


def test_structure_reconnue(import_03: ResultatImport) -> None:
    d = import_03.dictionnaire
    assert d.question("PRODACHE").type is TypeQuestion.CHOIX_MULTIPLE
    assert d.question("MAACPLSO").autre is not None and d.question("MAACPLSO").autre.variable == "MAACAUTR"  # type: ignore[union-attr]
    q23 = d.question("FOPRGAMM")
    assert q23.type is TypeQuestion.GRILLE and [li.variable for li in q23.lignes] == ["PXHAUTGA", "PXMOYEGA", "PXBASGAM"]
    assert [m.code for m in d.question("REVMENME").modalites][-1] == 98          # « NSP »
    assert d.question("SUGGATTE").type is TypeQuestion.TEXTE and not d.question("SUGGATTE").obligatoire
    assert d.question("DEAVHAGA").aide == {"fr": "une seule réponse"}
    assert [s.id for s in d.sections] == [f"S{i}" for i in range(1, 10)]


def test_ecarts_avec_v11_limites_aux_libelles(import_03: ResultatImport, dico_edm: Dictionnaire) -> None:
    ecarts = comparer(import_03.dictionnaire, dico_edm)
    # Un PDF ne contient ni l'anglais ni les règles de cohérence.
    structurels = [e for e in ecarts if e.type not in (TypeEcart.LIBELLE_MODIFIE, TypeEcart.LANGUE_AJOUTEE, TypeEcart.REGLE_AJOUTEE)]
    assert structurels == []
    assert [(e.question, e.detail) for e in ecarts if e.type is TypeEcart.LIBELLE_MODIFIE] == [
        ("SUGGATTE", "[fr] « Une suggestion / attente » → « Une suggestion / attente (facultatif) »")]


def test_question_inconnue_signalee(dico_edm: Dictionnaire) -> None:
    texte = "1. Profil du répondant\nQ1. Vous êtes : ☐ Particulier ☐ Martien\nQ2. Couleur préférée du logo : ☐ Bleu ☐ Vert\n"
    res = depuis_texte(texte, "test", dico_edm)
    assert any("Martien" in a and "absente de la référence" in a for a in res.avertissements)
    assert any("Q2" in a and "code proposé" in a for a in res.avertissements)
    nouveau = next(q for q in res.dictionnaire.questions if q.numero == 2)
    assert len(nouveau.code) == 8 and nouveau.code.isalpha() and nouveau.code not in {q.code for q in dico_edm.questions}
