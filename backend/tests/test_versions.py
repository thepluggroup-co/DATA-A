"""CRITÈRE D'ACCEPTATION (D-014) : le rapport V2 → V11 retrouve le journal « CHANGEMENTS V2 -> V3 » de V3.

Journal V3 (reference/scripts_gs/EDM_ELECTRIQUE_TEMPS_REEL_V3.gs, lignes 18 à 27) :
  - Q1  : + « Entreprises (PME, Industries…) », « Autre » supprimé, codes 1 à 5 alignés sur les 5 cibles ;
  - Q12 : + « Vectron » (code 3) ; Autre = 12 ;
  - nouvelles questions Q19 à Q24 (grille Q23 = 3 variables) ;
  - anciennes Q19 à Q36 renumérotées Q25 à Q42 : les codes variables ne changent pas ;
  - nouveaux contrôles INCOHERENCE_Q23 et INCOHERENCE_Q25_Q26.
"""

from __future__ import annotations

import pytest
from conftest import CSV_V2

from plateforme.dictionnaire.diff import Ecart, TypeEcart, comparer, rapport_texte
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.imports.livre_de_codes import depuis_livre_de_codes, lire_csv

T = TypeEcart


@pytest.fixture(scope="module")
def v2(dico_edm: Dictionnaire) -> Dictionnaire:
    res = depuis_livre_de_codes(lire_csv(CSV_V2), dico_edm.etude, "V2", "csv", reference=dico_edm)
    assert res.avertissements == []
    return res.dictionnaire


def _de(ecarts: list[Ecart], code: str, type_: TypeEcart) -> list[str]:
    return [e.detail for e in ecarts if e.question == code and e.type is type_]


def test_v2_importe(v2: Dictionnaire) -> None:
    assert len(v2.questions) == 36
    q1 = v2.question("VOUSETES")
    assert [m.libelles["fr"] for m in q1.modalites] == ["Particulier", "Électricien/artisan", "Entreprise BTP", "Revendeur/grossiste"]
    assert q1.autre is not None and q1.autre.variable == "VOUSAUTR" and q1.autre.code == 5
    assert v2.question("MAACPLSO").autre.code == 11  # type: ignore[union-attr]
    assert v2.question("PRIOPRIN").numero == 19


def test_rapport_v2_v11_conforme_au_journal_v3(v2: Dictionnaire, dico_edm: Dictionnaire) -> None:
    e = comparer(v2, dico_edm)
    # Q1
    assert _de(e, "VOUSETES", T.MODALITE_AJOUTEE) == ["« Entreprises (PME, Industries…) » (2)"]
    assert _de(e, "VOUSETES", T.AUTRE_SUPPRIME) == ["code 5, variable VOUSAUTR"]
    assert _de(e, "VOUSETES", T.VARIABLE_SUPPRIMEE) == ["VOUSAUTR"]
    assert sorted(_de(e, "VOUSETES", T.MODALITE_RECODEE)) == sorted([
        "« Électricien/artisan » : 2 → 3", "« Entreprise BTP » : 3 → 4",
        "« Revendeur/grossiste » devient « Revendeur/Grossiste/Distributeur », ancien libellé conservé en alias ; code 4 → 5"])
    # Q12
    assert _de(e, "MAACPLSO", T.MODALITE_AJOUTEE) == ["« Vectron » (3)"]
    assert _de(e, "MAACPLSO", T.AUTRE_RECODE) == ["11 → 12"]
    assert len(_de(e, "MAACPLSO", T.MODALITE_RECODEE)) == 8          # Hager (3) … Growatt (10) décalés d'un rang
    # Q19 à Q24 nouvelles
    ajoutees = [x.question for x in e if x.type is T.QUESTION_AJOUTEE]
    assert ajoutees == ["DEAVHAGA", "CAAVBAGA", "ORASHAGA", "ORASBAGA", "FOPRGAMM", "ECQUHABA"]
    assert _de(e, "FOPRGAMM", T.VARIABLE_AJOUTEE) == ["PXHAUTGA", "PXMOYEGA", "PXBASGAM"]
    # Q19 à Q36 renumérotées Q25 à Q42, codes inchangés
    renum = [x.detail for x in e if x.type is T.QUESTION_RENUMEROTEE]
    assert renum == [f"Q{n} → Q{n + 6}" for n in range(19, 37)]
    # Contrôles
    assert {x.question for x in e if x.type is T.REGLE_AJOUTEE} >= {"INCOHERENCE_Q23", "INCOHERENCE_Q25_Q26"}
    # Rien d'autre : aucune question supprimée, aucun libellé modifié, aucun changement de type
    autres = {x.type for x in e} - {T.MODALITE_AJOUTEE, T.AUTRE_SUPPRIME, T.VARIABLE_SUPPRIMEE, T.MODALITE_RECODEE, T.AUTRE_RECODE,
                                    T.QUESTION_AJOUTEE, T.VARIABLE_AJOUTEE, T.QUESTION_RENUMEROTEE, T.REGLE_AJOUTEE, T.LANGUE_AJOUTEE}
    assert autres == set(), [x for x in e if x.type in autres]


def test_rapport_lisible(v2: Dictionnaire, dico_edm: Dictionnaire) -> None:
    texte = rapport_texte(v2, dico_edm, comparer(v2, dico_edm))
    assert texte.index("Écarts imposant une migration") < texte.index("Autres écarts")
    assert "VOUSAUTR" in texte


def test_aucune_difference_avec_soi_meme(dico_edm: Dictionnaire) -> None:
    assert comparer(dico_edm, dico_edm) == []
