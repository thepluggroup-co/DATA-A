"""Syntaxe SPSS : aucun chemin, jeu actif vérifié, limites contrôlées (leçons de la section 5)."""

from __future__ import annotations

import re

import pytest

from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.generateurs.masque import Colonne, colonnes_masque
from plateforme.generateurs.spss import SyntaxeInvalide, ensembles_multiples, syntaxe_etiquetage, verifier_limites
from plateforme.terrain.plan import PlanTerrain


@pytest.fixture
def colonnes(dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> list[Colonne]:
    return colonnes_masque(dico_edm, terrain_edm.villes_masque())


def test_aucun_chemin_ni_lecture_de_fichier(dico_edm: Dictionnaire, colonnes: list[Colonne]) -> None:
    sps = syntaxe_etiquetage(dico_edm, colonnes)
    for interdit in (r"^\s*CD\b", r"GET\s+FILE", r"GET\s+DATA", r"SAVE\s+OUTFILE", r"[A-Z]:\\", r"/FILE\s*="):
        assert not re.search(interdit, sps, re.IGNORECASE | re.MULTILINE), interdit
    assert sps.startswith("* Encoding: UTF-8.")
    assert "DISPLAY DICTIONARY /VARIABLES=NUMFICHE STATUTQC." in sps


def test_toutes_les_variables_etiquetees(dico_edm: Dictionnaire, colonnes: list[Colonne]) -> None:
    sps = syntaxe_etiquetage(dico_edm, colonnes)
    bloc = sps.split("VARIABLE LABELS", 1)[1].split("\n\n", 1)[0]
    assert re.findall(r"^\s*/?\s*([A-Z]{8})\s'", bloc, re.MULTILINE) == [c.code for c in colonnes]
    assert "MAACPLSO\n    1 'Schneider'" in sps
    assert "Jusqu''à +10 %" in sps                       # apostrophe doublée
    assert "(97, 98, 99)." in sps


def test_ensembles_multiples(dico_edm: Dictionnaire) -> None:
    ens = {e.nom: e.variables for e in ensembles_multiples(dico_edm)}
    assert ens == {"$PRODACHE": ("PRACCABL", "PRACAPPA", "PRACPRIS", "PRACLUMI", "PRACSOLA", "PRACGROU"),
                   "$RENFFIDE": ("RFIDPRIX", "RFIDQUAL", "RFIDSTOC", "RFIDCONS", "RFIDSAVF", "RFIDPROG", "RFIDPAIE")}


def test_niveaux_de_mesure_comme_la_syntaxe_de_reference(dico_edm: Dictionnaire, colonnes: list[Colonne]) -> None:
    """Mêmes niveaux que reference/spss/EDM_SPSS_1_PARAMETRAGE_V3.sps (VARIABLE LEVEL)."""
    sps = syntaxe_etiquetage(dico_edm, colonnes)
    niveaux: dict[str, set[str]] = {}
    for bloc in re.findall(r"VARIABLE LEVEL\n(.*?)\(([A-Z]+)\)\.", sps, re.DOTALL):
        niveaux.setdefault(bloc[1], set()).update(bloc[0].split())
    assert "DELAIPRE" in niveaux["SCALE"]
    assert {"AGEREPON", "PXHAUTGA", "FIMEFOUR", "PRETACLI"} <= niveaux["ORDINAL"]
    assert {"CODEZONE", "VOUSETES", "PRACCABL", "SUGGATTE", "STATUTQC"} <= niveaux["NOMINAL"]


def test_limites_depassees_refusees(dico_edm: Dictionnaire) -> None:
    longue = Colonne("S", "TESTVARI", "é" * 200, "F2.0", "NOMINAL", ((1, "x" * 121),))
    erreurs = verifier_limites([longue], [])
    assert any("étiquette de variable de 400 octets" in e for e in erreurs)
    assert any("étiquette de valeur de 121 octets" in e for e in erreurs)
    with pytest.raises(SyntaxeInvalide):
        syntaxe_etiquetage(dico_edm, [longue])
