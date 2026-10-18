"""Le rapport journalier reproduit `calculerRapport_` de V11 à l'identique (synthèse, recommandations, classement,
villes, cibles, tendances, questions sautées, rythme), sur des bases synthétiques et sur les données réelles."""

from __future__ import annotations

import json
import random
import shutil
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from conftest import SCRIPT_V11
from test_codification_oracle import ENQUETEURS_TEST, _items_aleatoires, _params

from plateforme.codification.fiche import EtatCodification, FicheCodee, construire_fiche
from plateforme.codification.reponses import ItemReponse, ReponseBrute
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.generateurs.masque import colonnes_masque
from plateforme.suivi.base import Enqueteur, Ville, base_suivi
from plateforme.suivi.rapport import ParametresRapport, Rapport, calculer_rapport
from plateforme.terrain.plan import PlanTerrain

ORACLE = Path(__file__).with_name("oracle_rapport.js")
QUOTAS = {1: ("Particulier", [35, 35, 15]), 2: ("Entreprises (PME, Industries…)", [35, 35, 15]), 3: ("Électricien/artisan", [40, 40, 20]),
          4: ("Entreprise BTP", [40, 40, 20]), 5: ("Revendeur/Grossiste/Distributeur", [50, 50, 30])}


def _params_rapport(terrain: PlanTerrain, jour: str, enqueteurs: dict[str, str], maintenant: tuple[str, float] | None = None,
                    jours: list[str] | None = None) -> ParametresRapport:
    return ParametresRapport(jour=jour, jours=jours if jours is not None else ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"],
                             nb_jours=3, enqueteurs=[Enqueteur(i, "", z) for i, z in enqueteurs.items()],
                             villes=[Ville(v.code, v.id, v.libelle) for v in terrain.villes], quotas=QUOTAS, maintenant=maintenant)


def _p_v11(p: ParametresRapport) -> dict[str, Any]:
    p_js: dict[str, Any] = {
        "jour": p.jour, "jours": p.jours, "nbJours": p.nb_jours, "objectifJour": p.objectif_jour, "seuilDelai": p.seuil_delai,
        "seuilVolume": p.seuil_volume, "enqueteurs": [{"id": e.id, "nom": e.nom, "zone": e.zone} for e in p.enqueteurs],
        "quotas": {str(c): [lib, *qs] for c, (lib, qs) in p.quotas.items()}}
    if p.maintenant:
        p_js["maintenant"] = {"jour": p.maintenant[0], "heure": p.maintenant[1]}
    return p_js


def _oracle(base: list[dict[str, Any]], p: ParametresRapport) -> dict[str, Any]:
    node = shutil.which("node")
    if node is None:
        pytest.fail("Node.js est requis pour l'oracle V11")
    res = subprocess.run([node, str(ORACLE)], input=json.dumps({"script": str(SCRIPT_V11), "base": base, "p": _p_v11(p)}).encode("utf-8"),
                         capture_output=True, check=False)
    assert res.returncode == 0, res.stderr.decode("utf-8", "replace")
    sortie: dict[str, Any] = json.loads(res.stdout.decode("utf-8"))
    return sortie


def _normaliser(x: Any) -> Any:
    if isinstance(x, float):
        return round(x, 9)
    if isinstance(x, dict):
        return {k: _normaliser(v) for k, v in x.items()}
    if isinstance(x, list | tuple):
        return [_normaliser(v) for v in x]
    return x


def _comparer(r: Rapport, attendu: dict[str, Any]) -> None:
    obtenu = {"partiel": r.partiel, "part": r.part, "jour": r.jour, "rang": r.rang, "declare": r.declare, "restants": r.restants,
              "nJ": r.nJ, "objectif": r.objectif, "synthese": r.synthese, "recos": r.recos, "classement": r.classement, "cibles": r.cibles,
              "nonRep": r.nonRep, "heures": r.heures,
              "villes": [{**v, "z": None} for v in r.villes],
              "tendances": r.tendances}
    attendu = {**attendu, "villes": [{**v, "z": None} for v in attendu["villes"]]}
    for cle in obtenu:
        assert _normaliser(obtenu[cle]) == _normaliser(attendu[cle]), cle


def _fiches(dico: Dictionnaire, terrain: PlanTerrain, graine: int, n: int) -> list[FicheCodee]:
    rnd, etat, params = random.Random(graine), EtatCodification(), _params(terrain)
    t, out = datetime(2026, 10, 5, 6, 30, tzinfo=UTC), []
    for i in range(n):
        t += timedelta(minutes=rnd.choice([1, 4, 9, 20, 45, 300, 600]))
        items = tuple(ItemReponse(x["titre"], x["rep"], tuple(x["lignes"]) if x["lignes"] else None)
                      for x in _items_aleatoires(dico, rnd, ["", "694388296", "677000001"]))
        f = construire_fiche(dico, ReponseBrute(f"S{i}", t, items), params, etat)
        if rnd.random() < 0.04:
            f.statut = "REJETE"
        out.append(f)
    return out


@pytest.mark.parametrize(("graine", "jour", "maintenant", "jours"), [
    (1, "2026-10-05", None, None),
    (2, "2026-10-06", ("2026-10-06", 12.4333), None),                 # rapport PROVISOIRE de la mi-journée
    (3, "2026-10-07", None, None),
    (4, "2026-10-08", None, ["2026-10-05", "2026-10-06", "2026-10-07"]),   # jour non déclaré (prolongation)
    (5, "2026-10-09", None, None),                                    # aucun jour restant
])
def test_rapport_identique_a_v11(graine: int, jour: str, maintenant: tuple[str, float] | None, jours: list[str] | None,
                                 dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> None:
    base = base_suivi(_fiches(dico_edm, terrain_edm, graine, 260))
    p = _params_rapport(terrain_edm, jour, ENQUETEURS_TEST, maintenant, jours)
    r = calculer_rapport(dico_edm, colonnes_masque(dico_edm, terrain_edm.villes_masque()), base, p)
    _comparer(r, _oracle(base, p))
    assert r.recos, "aucune recommandation : le test ne couvrirait rien"


MASQUE = Path(__file__).resolve().parents[2] / "reference" / "prive" / "donnees" / "EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL__7_.xlsx"


@pytest.mark.skipif(not MASQUE.exists(), reason="données réelles absentes (reference/prive/, hors Git)")
@pytest.mark.parametrize("jour", ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"])
def test_rapports_reels_identiques_a_v11(jour: str, dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> None:
    from donnees_reelles import charger
    reel = charger(dico_edm, terrain_edm)
    base = base_suivi(reel.fiches)
    p = _params_rapport(terrain_edm, jour, {e.id: e.ville or "" for e in terrain_edm.enqueteurs})
    r = calculer_rapport(dico_edm, colonnes_masque(dico_edm, terrain_edm.villes_masque()), base, p)
    _comparer(r, _oracle(base, p))
