"""Tableaux déclarés dans le plan d'analyse : vérification des déclarations, filtres, syntaxe SPSS équivalente."""

from __future__ import annotations

import pandas as pd
import pytest

from plateforme.analyse.donnees import JeuDonnees, Variable
from plateforme.analyse.tableaux import Tableau, TableauInvalide, calculer, depuis_yaml, filtre_spss, produire


@pytest.fixture
def jd() -> JeuDonnees:
    table = pd.DataFrame({"VILLE": [1, 1, 2, 2, 3, 3, 1, 2], "PROFIL": [1, 2, 2, 2, 1, 99, 2, 1], "M": [10.0, 20, 30, 40, 50, 60, 70, 80]})
    return JeuDonnees(table, {"VILLE": Variable("VILLE", "Ville", {1.0: "Douala", 2.0: "Yaoundé", 3.0: "Bafoussam"}),
                              "PROFIL": Variable("PROFIL", "Profil", {1.0: "Particulier", 2.0: "Entreprise"}, {99.0}),
                              "M": Variable("M", "Montant", mesure="scale")})


def test_tableau_filtre(jd: JeuDonnees) -> None:
    r = calculer(Tableau("Ville des entreprises", "frequences", {"variable": "VILLE"}, source="X:1", filtre="PROFIL == 2"), jd)
    assert r.titre == "Ville des entreprises [source : X:1]"
    assert r.resultat.base == 4 and r.resultat.pct(2) == 50.0  # type: ignore[attr-defined]
    assert r.resultat.syntaxe_spss.startswith("TEMPORARY.\nSELECT IF (PROFIL = 2).\nFREQUENCIES VARIABLES=VILLE.")
    assert r.resultat.avertissements[0] == "filtre : PROFIL == 2 (4 fiches)"


def test_manquant_exclu_du_filtre(jd: JeuDonnees) -> None:
    """Comme SPSS : un manquant déclaré (99) ne vérifie aucune condition, même « différent de »."""
    r = calculer(Tableau("Hors entreprises", "frequences", {"variable": "VILLE"}, filtre="PROFIL != 2"), jd)
    assert r.resultat.base == 3


@pytest.mark.parametrize(("expression", "spss"), [
    ("PROFIL == 2", "PROFIL = 2"),
    ("PROFIL in (1, 2) and not VILLE == 3", "(ANY(PROFIL, 1, 2) AND NOT (VILLE = 3))"),
    ("VILLE != 1 or valeur(PROFIL) >= 99", "(VILLE ~= 1 OR VALUE(PROFIL) >= 99)"),
    ("PROFIL not in (1,)", "NOT ANY(PROFIL, 1)"),
    ("not manquant(PROFIL)", "NOT (MISSING(PROFIL))"),
])
def test_filtre_spss(expression: str, spss: str) -> None:
    assert filtre_spss(expression) == spss


@pytest.mark.parametrize("tab", [
    Tableau("t", "inconnue", {}),
    Tableau("t", "frequences", {"variable": "VILLE", "colonne": "M"}),                   # argument inconnu
    Tableau("t", "tri_croise", {"ligne": "VILLE"}),                                       # argument manquant
    Tableau("t", "frequences", {"variable": "ABSENTE"}),                                  # variable absente
    Tableau("t", "frequences", {"variable": "VILLE"}, filtre="commence(PROFIL, 'A')"),    # non traduisible en SPSS
])
def test_declarations_refusees(jd: JeuDonnees, tab: Tableau) -> None:
    with pytest.raises(TableauInvalide):
        produire([tab], jd)


def test_tout_est_verifie_avant_de_calculer(jd: JeuDonnees, monkeypatch: pytest.MonkeyPatch) -> None:
    from plateforme.analyse import tableaux
    appels: list[str] = []
    monkeypatch.setattr(tableaux, "calculer", lambda tab, jd: appels.append(tab.titre))
    with pytest.raises(TableauInvalide):
        produire([Tableau("bon", "frequences", {"variable": "VILLE"}), Tableau("mauvais", "frequences", {"variable": "X"})], jd)
    assert appels == [], "aucun calcul tant qu'une déclaration est fausse"


def test_depuis_yaml() -> None:
    tabs = depuis_yaml([{"titre": "A", "procedure": "mann_whitney", "arguments": {"variable": "M", "groupe": "VILLE", "codes": [1, 2]}}])
    assert tabs[0].arguments["codes"] == [1, 2]
    with pytest.raises(TableauInvalide):
        depuis_yaml([{"titre": "A", "procedure": "frequences", "colonnes": []}])


def test_codes_convertis_en_couple(jd: JeuDonnees) -> None:
    r = calculer(Tableau("M selon ville", "mann_whitney", {"variable": "M", "groupe": "VILLE", "codes": [1, 2]}), jd)
    assert "BY VILLE(1 2)" in r.resultat.syntaxe_spss
