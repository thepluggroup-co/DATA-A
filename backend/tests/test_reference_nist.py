"""Procédures validées sur les valeurs CERTIFIÉES du NIST (StRD), lues directement dans les fichiers officiels
(tests/reference_nist/, voir son README) : régression linéaire, ANOVA à un facteur, test t de Student."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
import pytest

from plateforme.analyse.donnees import JeuDonnees, Variable
from plateforme.analyse.procedures import anova_un_facteur, regression_lineaire, t_student

NIST = Path(__file__).parent / "reference_nist"
NOMBRE = re.compile(r"[-+]?\d+\.?\d*(?:[Ee][-+]?\d+)?")


def _lignes(fichier: str) -> list[str]:
    return (NIST / fichier).read_text(encoding="ascii").splitlines()


def _donnees(fichier: str, colonnes: list[str]) -> JeuDonnees:
    lignes = _lignes(fichier)
    debut = max(i for i, li in enumerate(lignes) if li.startswith("Data:")) + 1
    table = pd.DataFrame([[float(v) for v in li.split()] for li in lignes[debut:] if li.strip()], columns=colonnes)
    return JeuDonnees(table, {c: Variable(c, mesure="scale") for c in colonnes})


def _certifie(fichier: str, etiquette: str) -> list[float]:
    """Nombres écrits après `etiquette` sur la première ligne du fichier qui commence par elle ET porte des nombres
    (les en-têtes de colonnes, comme « Standard Deviation » seul, sont ignorés)."""
    for li in _lignes(fichier):
        s = li.strip()
        nombres = [float(x) for x in NOMBRE.findall(s[len(etiquette):])] if s.startswith(etiquette) else []
        if nombres:
            return nombres
    raise LookupError(f"{etiquette} absent de {fichier}")


def test_regression_longley() -> None:
    jd = _donnees("Longley.dat", ["y", "x1", "x2", "x3", "x4", "x5", "x6"])
    r = regression_lineaire(jd, "y", ["x1", "x2", "x3", "x4", "x5", "x6"])
    assert r.base == 16 and r.ddl == (6, 9)
    for k, terme in enumerate(["const", "x1", "x2", "x3", "x4", "x5", "x6"]):
        estimation, ecart = _certifie("Longley.dat", f"B{k} ")
        assert r.coefficients[terme][0] == pytest.approx(estimation, rel=1e-7), terme
        assert r.coefficients[terme][1] == pytest.approx(ecart, rel=1e-7), terme
    assert r.ecart_type_residuel == pytest.approx(_certifie("Longley.dat", "Standard Deviation")[0], rel=1e-7)
    assert r.r2 == pytest.approx(_certifie("Longley.dat", "R-Squared")[0], rel=1e-9)
    assert r.f == pytest.approx(_certifie("Longley.dat", "Regression")[-1], rel=1e-7)
    assert any("10 observations" in a for a in r.avertissements), "16 observations pour 7 paramètres : signalé"


@pytest.mark.parametrize("fichier", ["SiRstv.dat", "AtmWtAg.dat"])
def test_anova(fichier: str) -> None:
    a = anova_un_facteur(_donnees(fichier, ["g", "y"]), "y", "g")
    ddl_inter, sc_inter, _, f = _certifie(fichier, "Between Instrument")
    ddl_intra, sc_intra, _ = _certifie(fichier, "Within Instrument")
    assert a.ddl == (int(ddl_inter), int(ddl_intra))
    assert a.sc_inter == pytest.approx(sc_inter, rel=1e-6)
    assert a.sc_intra == pytest.approx(sc_intra, rel=1e-6)
    assert a.f == pytest.approx(f, rel=1e-6)
    assert a.r2 == pytest.approx(_certifie(fichier, "Certified R-Squared")[0], rel=1e-6)
    assert a.ecart_type_residuel == pytest.approx(_certifie(fichier, "Standard Deviation")[0], rel=1e-6)


def test_t_au_carre_egal_f_a_deux_groupes() -> None:
    """Avec deux groupes, t² (Student, variances égales) = F de l'ANOVA : référence certifiée AtmWtAg."""
    t = t_student(_donnees("AtmWtAg.dat", ["g", "y"]), "y", "g", (1, 2))
    _, _, _, f = _certifie("AtmWtAg.dat", "Between Instrument")
    assert t.ddl == 46 and t.base == 48
    assert t.statistique ** 2 == pytest.approx(f, rel=1e-6)
    assert 0 < t.p < 0.01
