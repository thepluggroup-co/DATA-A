"""CRITÈRE D'ACCEPTATION (phase 3) : rapport de statut des enquêteurs ÉGAL à celui produit pendant l'étude.

Référence : état des lieux du jour 3 (07/10/2026, 12 h 26), document Word conservé dans reference/prive/ (il contient
les noms des enquêteurs : seuls les chiffres, zones, sorties et démarrages sont comparés ; colonnes Nom et Motif ignorées).
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.suivi.statut import exporter_word, pourcent, rapport_statut
from plateforme.terrain.plan import PlanTerrain

RACINE = Path(__file__).resolve().parents[2]
ETAT_J3 = RACINE / "reference" / "prive" / "documents" / "ETAT_ENQUETEURS_EDM_JOUR03.docx"
pytestmark = pytest.mark.skipif(not ETAT_J3.exists(), reason="données réelles absentes (reference/prive/, hors Git)")
JOURS = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]
COUPURE = datetime(2026, 10, 7, 12, 26, tzinfo=ZoneInfo("Africa/Douala"))


def _tableaux(chemin: Path) -> list[list[list[str]]]:
    from docx import Document
    return [[[c.text.strip() for c in ligne.cells] for ligne in t.rows] for t in Document(str(chemin)).tables]


def _sans(colonnes: list[str], lignes: list[list[str]], a_ignorer: set[str]) -> list[list[str]]:
    garder = [i for i, c in enumerate(colonnes) if c not in a_ignorer]
    return [[li[i] for i in garder] for li in lignes]


def test_etat_des_lieux_du_jour_3(dico_edm: Dictionnaire, terrain_edm: PlanTerrain, tmp_path: Path) -> None:
    from donnees_reelles import charger
    reel = charger(dico_edm, terrain_edm)
    r = rapport_statut(reel.fiches, terrain_edm, JOURS, COUPURE)
    attendu = _tableaux(ETAT_J3)
    vue, non_atteints, sortis, remplacants, villes = attendu
    assert r.atteints == []                                              # « Aucun enquêteur n'a atteint son objectif à 12 h 26 »
    assert [str(x) for x in [*r.vue["jours"], r.vue["cumul"], r.vue["objectif"]]] + [pourcent(r.vue["part"]), str(r.vue["reste"])] \
        == vue[1][1:]
    assert [[x.poste, x.ville, *map(str, x.jours), str(x.cumul_poste), pourcent(x.part), str(x.reste)] for x in r.non_atteints] \
        == _sans(non_atteints[0], non_atteints[1:], {"Nom"})
    assert [[x.poste, x.ville, str(x.fiches), x.sortie] for x in r.sortis] == _sans(sortis[0], sortis[1:], {"Nom", "Motif"})
    assert [[x.poste, x.ville, x.demarrage, *["–" if j is None else str(j) for j in x.jours[1:]], str(x.fiches), str(x.cumul_poste),
             pourcent(x.part), str(x.reste)] for x in r.remplacants] == _sans(remplacants[0], remplacants[1:], {"Nom"})
    assert [[v["ville"], str(v["postes"]), str(v["cumul"]), str(round(v["objectif"] + 0.0001)), pourcent(v["part"]), str(v["reste"])]
            for v in r.villes] == villes[1:4]
    # Export Word : mêmes tableaux (le document de l'étude porte en plus les noms, absents ici)
    sortie = _tableaux(exporter_word(r, tmp_path / "ETAT.docx", "EDM MATÉRIELS ET ÉQUIPEMENTS ÉLECTRIQUES"))
    assert sortie[0][1][1:] == vue[1][1:]
    assert sortie[-1] == villes


DECISIONS = RACINE / "reference" / "prive" / "decisions_qc_edm.yaml"


@pytest.mark.skipif(not DECISIONS.exists(), reason="décisions de l'étude absentes (reference/prive/, hors Git)")
def test_ligne_de_commande_suivi(tmp_path: Path) -> None:
    """`plateforme suivi produire` au 07/10 à 12 h 26 : l'état des lieux produit reprend les chiffres de l'étude."""
    from plateforme.cli import main
    projet = RACINE / "projets" / "edm_cameroun"
    code = main(["suivi", "produire", str(RACINE / "reference" / "prive" / "donnees" / "EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL__7_.xlsx"),
                 "--dictionnaire", str(projet / "dictionnaire.yaml"), "--plan-terrain", str(projet / "plan_terrain.yaml"),
                 "--plan-echantillonnage", str(projet / "plan_echantillonnage.yaml"), "--decisions", str(DECISIONS),
                 "--jour", "2026-10-07", "--maintenant", "2026-10-07T12:26", "--graine", "2026", "--sortie", str(tmp_path)])
    assert code == 0
    etat = _tableaux(tmp_path / "ETAT_ENQUETEURS_2026-10-07.docx")
    assert etat[0][1][1:] == _tableaux(ETAT_J3)[0][1][1:]          # vue d'ensemble : 110 | 111 | 62 | 283 | 500 | 57 % | 217
    for f in ("TABLEAU_DE_BORD.xlsx", "RAPPORT_2026-10-07.xlsx", "EFFET_ENQUETEUR.xlsx", "RAPPELS_2026-10-07.xlsx"):
        assert (tmp_path / f).stat().st_size > 0, f
