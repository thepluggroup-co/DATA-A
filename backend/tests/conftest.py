"""Fixtures partagées : chemins du dépôt, oracle V11 (exécuté sous Node), dictionnaires de l'étude EDM."""

from __future__ import annotations

import json
import shutil
import subprocess
from functools import cache
from pathlib import Path
from typing import Any

import pytest

from plateforme.dictionnaire import fichiers
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.imports import apps_script
from plateforme.terrain import plan as plan_terrain
from plateforme.terrain.plan import PlanTerrain

RACINE = Path(__file__).resolve().parents[2]
REFERENCE = RACINE / "reference"
SCRIPT_V11 = REFERENCE / "scripts_gs" / "EDM_ELECTRIQUE_TEMPS_REEL_V11.gs"
PROJET_EDM = RACINE / "projets" / "edm_cameroun"
CSV_V2 = REFERENCE / "questionnaires" / "EDM_DICTIONNAIRE_V2_2026-09-26.csv"
PDF_03 = REFERENCE / "questionnaires" / "QUESTIONNAIRE_EDM_EQUIPEMENTS_ELECTRIQUES_03.pdf"


@cache
def _oracle(script: Path) -> dict[str, Any]:
    if shutil.which("node") is None:
        pytest.fail("Node.js est requis : le script V11 sert d'oracle aux tests de conformité (décision D-009)")
    return apps_script.executer_oracle(script)


@pytest.fixture(scope="session")
def oracle_v11() -> dict[str, Any]:
    return _oracle(SCRIPT_V11)


@pytest.fixture(scope="session")
def dico_edm() -> Dictionnaire:
    return fichiers.charger(PROJET_EDM / "dictionnaire.yaml")


@pytest.fixture(scope="session")
def terrain_edm() -> PlanTerrain:
    return plan_terrain.charger(PROJET_EDM / "plan_terrain.yaml")


def appeler_v11(fonction: str, arguments: list[Any]) -> list[Any]:
    """Appelle une fonction exportée par V11 sur une liste d'arguments (un appel par élément)."""
    code = (
        "const m=require(process.argv[1]);const a=JSON.parse(require('fs').readFileSync(0,'utf8'));"
        f"process.stdout.write(JSON.stringify(a.map(x=>m.{fonction}(x))));"
    )
    node = shutil.which("node")
    if node is None:
        pytest.fail("Node.js est requis pour l'oracle V11")
    res = subprocess.run([node, "-e", code, str(SCRIPT_V11)], input=json.dumps(arguments).encode("utf-8"),
                         capture_output=True, check=True)
    resultat: list[Any] = json.loads(res.stdout.decode("utf-8"))
    return resultat
