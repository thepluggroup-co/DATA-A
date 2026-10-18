"""Effet enquêteur : détecté à profil égal, sans accuser un enquêteur pour la composition de ses cibles.

CRITÈRE D'ACCEPTATION (phase 3) : l'effet enquêteur de Douala (ENQ1, garantie attendue) est détecté automatiquement.
"""

from __future__ import annotations

import random
from pathlib import Path

import pytest

from plateforme.codification.fiche import FicheCodee
from plateforme.controle.effet_enqueteur import ParametresEffet, detecter
from plateforme.dictionnaire.modele import Dictionnaire


def _fiche(i: int, enq: str, profil: int, garantie: int, sav: int) -> FicheCodee:
    return FicheCodee(f"F{i}", f"DLA-{enq}-{i:03d}", {"CODEZONE": 1, "CODEENQU": enq, "VOUSETES": profil,
                                                      "DUGAJUAC": garantie, "IMSECSAV": sav}, [], "OK", [])


def test_composition_non_signalee_effet_fabrique_signale(dico_edm: Dictionnaire) -> None:
    rnd = random.Random(11)
    # Réponse « vraie » selon la cible : les revendeurs (5) attendent une garantie longue, les particuliers (1) une courte.
    def garantie(profil: int) -> int:
        return rnd.choices([1, 2, 3, 4], weights=[1, 1, 3, 5] if profil == 5 else [5, 3, 1, 1])[0]
    fiches, i = [], 0
    for enq, profils in (("ENQ1", [1] * 40 + [5] * 40), ("ENQ2", [1] * 40 + [5] * 40),
                         ("ENQ3", [5] * 70 + [1] * 10),                       # surtout des revendeurs : COMPOSITION différente
                         ("ENQ4", [1] * 40 + [5] * 40)):                      # répond toujours « >2 ans » : EFFET fabriqué
        for profil in profils:
            g = 4 if enq == "ENQ4" and rnd.random() < 0.85 else garantie(profil)
            fiches.append(_fiche(i, enq, profil, g, rnd.choice([1, 2, 3, 4])))
            i += 1
    signales = {(x.enqueteur, x.variable) for x in detecter(dico_edm, fiches, ParametresEffet(barriere_tukey=0)) if x.signale}
    assert ("ENQ4", "DUGAJUAC") in signales
    assert ("ENQ3", "DUGAJUAC") not in signales, "un écart de composition des cibles ne doit pas être imputé à l'enquêteur"
    assert not any(v == "IMSECSAV" for _, v in signales), "réponses au hasard : aucun signalement attendu"


def test_question_de_cible_obligatoire(dico_edm: Dictionnaire) -> None:
    sans_cible = dico_edm.model_copy(update={"questions": [q.model_copy(update={"role": None}) for q in dico_edm.questions]})
    with pytest.raises(ValueError, match="cible"):
        detecter(sans_cible, [])


MASQUE = Path(__file__).resolve().parents[2] / "reference" / "prive" / "donnees" / "EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL__7_.xlsx"


@pytest.mark.skipif(not MASQUE.exists(), reason="données réelles absentes (reference/prive/, hors Git)")
def test_effet_enqueteur_de_douala(dico_edm: Dictionnaire, terrain_edm: object) -> None:
    from donnees_reelles import charger

    from plateforme.codification.qualite import ParametresBase, base_analyse
    reel = charger(dico_edm, terrain_edm)  # type: ignore[arg-type]
    retenues, _ = base_analyse(dico_edm, reel.fiches, ParametresBase(), reel.decisions)
    # Repères de la syntaxe EDM_EE_REPRODUCTION_RAPPORT_427.sps (fiches déclarées à Douala, base 427)
    dla = [f for f in retenues if f.valeurs["VILLEREG"] == 1]
    enq1 = [f for f in dla if f.valeurs["CODEENQU"] == "ENQ1" and f.valeurs["DUGAJUAC"] not in (97, 98, 99)]
    autres = [f for f in dla if f.valeurs["CODEENQU"] != "ENQ1" and f.valeurs["DUGAJUAC"] not in (97, 98, 99)]
    assert (len(enq1), len(autres)) == (60, 93)
    assert round(100 * sum(f.valeurs["DUGAJUAC"] in (3, 4) for f in enq1) / 60, 1) == 65.0
    assert round(100 * sum(f.valeurs["DUGAJUAC"] in (3, 4) for f in autres) / 93, 1) == 10.8

    ecarts = detecter(dico_edm, retenues)
    signales = [x for x in ecarts if x.signale]
    douala = {(x.enqueteur, x.variable) for x in signales if x.groupe == 1}
    assert douala == {("ENQ1", "DUGAJUAC")}, "effet enquêteur de Douala (garantie) détecté, et lui seul"
    # L'écart sur le SAV (34 % contre 13 % en brut) s'explique par la composition des cibles : non signalé à profil égal
    sav = next(x for x in ecarts if (x.enqueteur, x.variable) == ("ENQ1", "IMSECSAV"))
    assert not sav.signale and sav.p_corrige > 0.05
    # Recoupement : ENQ5 (Yaoundé), dont les fiches forment les groupes de copies probables, est aussi signalé
    assert any(x.enqueteur == "ENQ5" for x in signales)
    assert len(signales) <= 10, "le superviseur ne reçoit que les écarts extrêmes"
