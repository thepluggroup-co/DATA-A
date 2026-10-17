"""Les validations du dictionnaire rendent impossibles les défauts constatés sur le terrain."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from plateforme.dictionnaire.modele import Dictionnaire, TypeQuestion


def _dico(**surcharges: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "etude": "TEST", "version": "1", "langues": ["fr", "en"],
        "sections": [{"id": "S1", "libelles": {"fr": "1. Profil"}}],
        "questions": [
            {"numero": 1, "code": "VOUSETES", "section": "S1", "libelles": {"fr": "Vous êtes", "en": "You are"},
             "type": "choix_unique", "mesure": "NOMINAL", "role": "cible",
             "modalites": [{"code": 1, "libelles": {"fr": "Particulier", "en": "Individual"}},
                           {"code": 2, "libelles": {"fr": "Entreprise", "en": "Company"}}]},
            {"numero": 2, "code": "PRODACHE", "section": "S1", "libelles": {"fr": "Produits"}, "type": "choix_multiple",
             "modalites": [{"code": 1, "libelles": {"fr": "Câbles"}, "variable": "PRACCABL"},
                           {"code": 2, "libelles": {"fr": "Prises"}, "variable": "PRACPRIS"}]},
        ],
        "regles_coherence": [{"code": "INCOHERENCE_Q1_Q2", "expression": "VOUSETES == 1 and PRACCABL == 1"}],
    }
    base.update(surcharges)
    return base


def _question(i: int, **champs: Any) -> dict[str, Any]:
    d = _dico()
    d["questions"][i].update(champs)
    return d


def test_dictionnaire_minimal_valide() -> None:
    d = Dictionnaire.model_validate(_dico())
    assert d.question("PRODACHE").variables() == ["PRACCABL", "PRACPRIS"]
    assert d.titre_question(d.question("PRODACHE")) == "Q2. Produits (plusieurs réponses)"
    assert d.titre_question(d.question("PRODACHE"), "en") == "Q2. Produits (several answers)"   # repli sur le français
    assert d.question_cible() is d.question("VOUSETES")


@pytest.mark.parametrize(("donnees", "message"), [
    (_question(0, code="VOUSETE"), "8 lettres majuscules"),
    (_question(0, code="VOUSETE1"), "8 lettres majuscules"),
    (_question(1, code="VOUSETES"), "en double"),
    (_question(0, code="CODEZONE"), "réservée"),
    (_question(0, modalites=[{"code": 99, "libelles": {"fr": "Autre"}}]), "réservé à la non-réponse"),
    (_question(0, modalites=[{"code": 1, "libelles": {"fr": "A"}}, {"code": 1, "libelles": {"fr": "B"}}]), "en double"),
    (_question(0, modalites=[{"code": 1, "libelles": {"fr": "Électricien"}}, {"code": 2, "libelles": {"fr": "electricien"}}]),
     "ambigu"),
    (_question(0, modalites=[{"code": 1, "libelles": {"fr": "A"}, "alias": ["B"]}, {"code": 2, "libelles": {"fr": "B"}}]), "ambigu"),
    (_question(0, obligatoire=False), "OBLIGATOIRE"),
    (_question(0, mesure=None), "mesure"),
    (_question(0, autre={"code": 2, "libelles": {"fr": "Autre"}, "variable": "VOUSAUTR"}), "déjà une modalité"),
    (_question(1, modalites=[{"code": 1, "libelles": {"fr": "Câbles"}}]), "variable binaire"),
    (_question(1, section="S9"), "section inconnue"),
    (_question(0, libelles={"en": "You are"}), "langue de référence"),
    (_question(0, condition="PRACCABL =="), "condition invalide"),
    (_question(0, condition="INCONNUE == 1"), "inconnue"),
    (_dico(regles_coherence=[{"code": "R1", "expression": "INCONNUE == 1"}]), "inconnue"),
    (_dico(regles_coherence=[{"code": "R1", "expression": "A + 1"}]), "invalide"),
    (_dico(langues=["en"]), "langue de référence"),
])
def test_dictionnaires_refuses(donnees: dict[str, Any], message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        Dictionnaire.model_validate(donnees)


def test_deux_questions_de_cible_refusees() -> None:
    d = _dico()
    d["questions"].append({"numero": 3, "code": "AUTRECIB", "section": "S1", "libelles": {"fr": "x"}, "type": "choix_unique",
                           "mesure": "NOMINAL", "role": "cible", "modalites": [{"code": 1, "libelles": {"fr": "a"}}]})
    with pytest.raises(ValidationError, match="une seule question de cible"):
        Dictionnaire.model_validate(d)


def test_grille_exige_des_lignes() -> None:
    d = _dico()
    d["questions"].append({"numero": 3, "code": "FOPRGAMM", "section": "S1", "libelles": {"fr": "x"}, "type": "grille",
                           "mesure": "ORDINAL", "modalites": [{"code": 1, "libelles": {"fr": "a"}}]})
    with pytest.raises(ValidationError, match="grille"):
        Dictionnaire.model_validate(d)
    d["questions"][-1]["lignes"] = [{"variable": "PXHAUTGA", "libelles": {"fr": "Haut"}}]
    assert Dictionnaire.model_validate(d).question("FOPRGAMM").type is TypeQuestion.GRILLE


def test_champs_inconnus_refuses() -> None:
    with pytest.raises(ValidationError):
        Dictionnaire.model_validate(_dico(champ_inconnu=1))
