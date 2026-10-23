"""Plan d'échantillonnage (M2) : modèle validé, taille d'échantillon, répartition, capacité du terrain."""

from __future__ import annotations

from pathlib import Path

import pytest
from conftest import PROJET_EDM
from pydantic import ValidationError

from plateforme.echantillonnage.plan import (
    MENTION_QUOTAS,
    ParametresTaille,
    capacite,
    charger,
    marge_obtenue,
    repartir,
    taille_echantillon,
    verifier,
)
from plateforme.terrain import plan as plan_terrain


def test_plan_edm_valide_et_coherent_avec_le_terrain() -> None:
    pe = charger(PROJET_EDM / "plan_echantillonnage.yaml")
    assert (pe.total(), pe.par_ville()) == (500, {"DOUALA": 200, "YAOUNDE": 200, "BAFOUSSAM": 100})     # décision du 07/10
    assert pe.mention() == MENTION_QUOTAS and "non probabiliste" in pe.mention()
    terrain = plan_terrain.charger(PROJET_EDM / "plan_terrain.yaml")
    assert [(c.ville, c.quota, c.titulaires, c.capacite) for c in capacite(pe, terrain)] == [
        ("DOUALA", 200, 3, 225), ("YAOUNDE", 200, 3, 225), ("BAFOUSSAM", 100, 2, 150)]                 # 25 fiches × 3 jours
    assert verifier(pe, terrain) == []


def test_taille_d_echantillon_formules_de_reference() -> None:
    """Valeurs de référence du calcul classique (Cochran) : p = 0,5, ± 5 points, 95 % → 385 ; ± 3 points → 1 068 ;
    population de 1 000 → 278 ; effet de plan 2 → 769."""
    assert taille_echantillon(ParametresTaille(marge=0.05)) == 385
    assert taille_echantillon(ParametresTaille(marge=0.03)) == 1068
    assert taille_echantillon(ParametresTaille(marge=0.05, population=1000)) == 278
    assert taille_echantillon(ParametresTaille(marge=0.05, effet_plan=2)) == 769
    assert round(marge_obtenue(385), 4) == 0.0499


def test_repartition_au_plus_fort_reste() -> None:
    assert repartir(500, {"DOUALA": 2, "YAOUNDE": 2, "BAFOUSSAM": 1}) == {"DOUALA": 200, "YAOUNDE": 200, "BAFOUSSAM": 100}
    assert repartir(10, {"A": 1, "B": 1, "C": 1}) == {"A": 4, "B": 3, "C": 3}
    assert sum(repartir(437, {"A": 3.3, "B": 1.7, "C": 5}).values()) == 437
    with pytest.raises(ValueError):
        repartir(10, {"A": 0})


def test_plan_incoherent_refuse(tmp_path: Path) -> None:
    chemin = tmp_path / "pe.yaml"
    chemin.write_text("etude: T\nversion: '01'\nmethode: quotas\nvariable_cible: VOUSETES\nquotas:\n"
                      "  1: {cible: A, DOUALA: 10, YAOUNDE: 5}\n  2: {cible: B, DOUALA: 10}\n", encoding="utf-8")
    with pytest.raises(ValidationError, match="mêmes villes"):
        charger(chemin)
    chemin.write_text("etude: T\nversion: '01'\nmethode: sondage\nvariable_cible: X\nquotas: {}\n", encoding="utf-8")
    with pytest.raises(ValidationError):
        charger(chemin)


def test_capacite_insuffisante_signalee(tmp_path: Path) -> None:
    pe = charger(PROJET_EDM / "plan_echantillonnage.yaml")
    terrain = plan_terrain.charger(PROJET_EDM / "plan_terrain.yaml").model_copy(update={"objectif_jour": 15})
    messages = verifier(pe, terrain)
    assert "BAFOUSSAM : capacité 90 fiches pour un quota de 100 (manque 10)" in messages


def test_plan_aller_retour_fichier(tmp_path) -> None:  # type: ignore[no-untyped-def]
    from plateforme.echantillonnage.plan import Methode, ParametresTaille, PlanEchantillonnage, Quota, charger, enregistrer

    plan = PlanEchantillonnage(
        etude="Étude test", version="02", methode=Methode.QUOTAS, variable_cible="VOUSETES",
        taille=ParametresTaille(marge=0.05),
        quotas=[Quota(code=1, cible="Particulier", villes={"DOUALA": 35, "YAOUNDE": 35}),
                Quota(code=2, cible="Entreprise", villes={"DOUALA": 10, "YAOUNDE": 20})])
    chemin = tmp_path / "plan.yaml"
    enregistrer(plan, chemin)
    assert charger(chemin) == plan
