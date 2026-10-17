"""CRITÈRE D'ACCEPTATION DE LA PHASE 1 : le dictionnaire EDM génère exactement le masque de V11.

L'oracle est le script V11 lui-même, exécuté sous Node : aucune valeur attendue n'est recopiée à la main.
"""

from __future__ import annotations

from typing import Any

from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.generateurs.masque import Colonne, colonnes_masque
from plateforme.imports import apps_script
from plateforme.terrain.plan import PlanTerrain


def _normaliser_v11(c: dict[str, Any]) -> dict[str, Any]:
    return {"section": c["section"], "code": c["code"], "label": c["label"], "spss": c["spss"], "mesure": c.get("mesure"),
            "valeurs": [tuple(v) for v in c["valeurs"]] if c.get("valeurs") else None, "groupe": c.get("groupe")}


def _normaliser(c: Colonne) -> dict[str, Any]:
    return {"section": c.section, "code": c.code, "label": c.label, "spss": c.spss, "mesure": c.mesure,
            "valeurs": list(c.valeurs) if c.valeurs else None, "groupe": c.groupe}


def test_67_colonnes_identiques_a_v11(dico_edm: Dictionnaire, terrain_edm: PlanTerrain, oracle_v11: dict[str, Any]) -> None:
    attendu = [_normaliser_v11(c) for c in oracle_v11["colonnes"]]
    obtenu = [_normaliser(c) for c in colonnes_masque(dico_edm, terrain_edm.villes_masque())]
    assert len(attendu) == 67
    assert [c["code"] for c in obtenu] == [c["code"] for c in attendu], "ordre ou liste des variables"
    for a, o in zip(attendu, obtenu, strict=True):
        assert o == a, f"colonne {a['code']}"


def test_villes_identiques_a_v11(terrain_edm: PlanTerrain, oracle_v11: dict[str, Any]) -> None:
    assert [(v.code, v.id, v.libelle, v.prefixe) for v in terrain_edm.villes_masque()] == \
           [(z["code"], z["id"], z["libelle"], z["prefixe"]) for z in oracle_v11["ZONES"]]


def test_import_v11_coherent_avec_le_dictionnaire_de_reference(dico_edm: Dictionnaire, oracle_v11: dict[str, Any]) -> None:
    """Réimporter V11 redonne les mêmes questions, modalités, libellés FR/EN et codes que `dictionnaire.yaml`.

    Le YAML ajoute ce que le dictionnaire ITEMS de V11 ne contient pas (aides, règles de cohérence,
    détails d'identification, titre français) : ces champs sont exclus de la comparaison.
    """
    importe = apps_script.vers_dictionnaire(oracle_v11, dico_edm.etude, dico_edm.version, source="V11")
    exclus = {"aide"}
    for qi, qd in zip(importe.questions, dico_edm.questions, strict=True):
        assert qi.model_dump(exclude=exclus) == qd.model_dump(exclude=exclus), f"Q{qd.numero}"
    assert importe.sections == dico_edm.sections


def test_quotas_portent_sur_la_question_cible(dico_edm: Dictionnaire, oracle_v11: dict[str, Any]) -> None:
    cible = dico_edm.question_cible()
    assert cible is not None and cible.code == "VOUSETES" and cible.obligatoire
    assert sorted(int(k) for k in oracle_v11["QUOTAS"]) == [m.code for m in cible.modalites]


def test_regles_de_coherence_de_v11(dico_edm: Dictionnaire) -> None:
    """Les 4 incohérences codées en dur dans coderFiche_ (V11) sont déclarées dans le dictionnaire."""
    assert {r.code for r in dico_edm.regles_coherence} == {
        "INCOHERENCE_Q35_Q38", "INCOHERENCE_Q7_Q37", "INCOHERENCE_Q23", "INCOHERENCE_Q25_Q26"}
