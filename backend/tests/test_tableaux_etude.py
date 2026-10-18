"""CRITÈRE D'ACCEPTATION (phase 3) : tableaux de suivi ÉGAUX à ceux produits pendant l'étude.

Référence : valeurs calculées par les formules de V11 et conservées dans le masque du 09/10/2026
(onglets TABLEAU_DE_BORD, SUIVI_CIBLES, RECAP_JOURS ; « aujourd'hui » = 09/10/2026).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from test_rapport_oracle import QUOTAS

from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.suivi.base import Enqueteur, Ville, base_suivi
from plateforme.suivi.tableaux import ParametresSuivi, recap_jours, suivi_cibles, tableau_de_bord
from plateforme.terrain.plan import PlanTerrain

MASQUE = Path(__file__).resolve().parents[2] / "reference" / "prive" / "donnees" / "EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL__7_.xlsx"
pytestmark = pytest.mark.skipif(not MASQUE.exists(), reason="données réelles absentes (reference/prive/, hors Git)")
JOURS = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]


def _onglet(nom: str) -> list[list[Any]]:
    from openpyxl import load_workbook
    wb = load_workbook(MASQUE, read_only=True, data_only=True)
    lignes = [list(li) for li in wb[nom].iter_rows(values_only=True)]
    wb.close()
    return lignes


def _n(x: Any) -> Any:
    return int(x) if isinstance(x, float) and x.is_integer() else ("" if x is None else x)


def _proche(a: Any, b: Any) -> bool:
    a, b = _n(a), _n(b)
    if isinstance(a, int | float) and isinstance(b, int | float):
        return abs(a - b) <= 1e-8 * max(1.0, abs(a), abs(b))         # le classeur stocke 10 chiffres significatifs
    return a == b


@pytest.fixture(scope="module")
def contexte(dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> tuple[list[dict[str, Any]], ParametresSuivi]:
    from donnees_reelles import charger
    reel = charger(dico_edm, terrain_edm)
    p = ParametresSuivi(enqueteurs=[Enqueteur(e.id, "", e.ville or "") for e in terrain_edm.enqueteurs],
                        villes=[Ville(v.code, v.id, v.libelle) for v in terrain_edm.villes], jours=JOURS, quotas=QUOTAS,
                        aujourdhui="2026-10-09")
    return base_suivi(reel.fiches), p


def test_tableau_de_bord(contexte: tuple[list[dict[str, Any]], ParametresSuivi]) -> None:
    base, p = contexte
    tb = tableau_de_bord(base, p)
    feuille = _onglet("TABLEAU_DE_BORD")
    ecarts = []
    for li, attendu in zip(tb.lignes, feuille[4:15], strict=True):
        obtenu = [li["id"], li["zone"], *li["jours"], li["aujourdhui"], li["cumul"], li["objectif"], li["realise"], li["delais_courts"],
                  li["a_verifier"], li["rejetees"], li["statut"], li["rang"]]
        attendu_utile = [attendu[0], *attendu[2:16]]                    # sans la colonne NOM
        ecarts += [f"{li['id']} colonne {j}" for j, (o, a) in enumerate(zip(obtenu, attendu_utile, strict=False)) if not _proche(o, a)]
    total = feuille[16]
    obtenu_total = [*tb.total["jours"], tb.total["aujourdhui"], tb.total["cumul"], tb.total["objectif"], tb.total["realise"],
                    tb.total["delais_courts"], tb.total["a_verifier"], tb.total["rejetees"]]
    ecarts += [f"TOTAL colonne {j}" for j, (o, a) in enumerate(zip(obtenu_total, total[3:14], strict=True)) if not _proche(o, a)]
    assert _proche(tb.hors_liste, feuille[15][8])
    for z, attendu in zip([*tb.zones, tb.total_zones], feuille[20:24], strict=True):
        obtenu = [z["enqueteurs"], *z["jours"], z["cumul"], z["capacite"], z["quota"], z["part_quota"]]
        ecarts += [f"zone {attendu[0]} colonne {j}" for j, (o, a) in enumerate(zip(obtenu, attendu[1:], strict=False)) if not _proche(o, a)]
    assert ecarts == [], ecarts
    assert tb.sans_cible == 0


def test_suivi_des_cibles(contexte: tuple[list[dict[str, Any]], ParametresSuivi]) -> None:
    base, p = contexte
    sc = suivi_cibles(base, p)
    f = _onglet("SUIVI_CIBLES")
    for c, attendu in zip(sc.quotas, f[3:8], strict=True):
        obtenu = [c["code"], c["cible"]] + [x for v in c["villes"] for x in (v["quota"], v["realise"], v["part"])] + \
                 [c["total"]["quota"], c["total"]["realise"], c["total"]["part"]]
        assert all(_proche(o, a) for o, a in zip(obtenu, attendu, strict=False)), c["cible"]
    assert [_n(x) for x in f[9][3:13:3]] == sc.sans_cible
    assert [_n(x) for x in f[10][3:13:3]] == sc.total_general == [173, 171, 102, 446]
    for c, attendu in zip(sc.par_jour, f[15:20], strict=True):
        assert [x for v in c["villes"] for x in v] + c["total"] == [_n(x) for x in attendu[2:18]], c["cible"]
    for li, attendu in zip(sc.par_enqueteur["CUMUL"], f[25:36], strict=True):
        assert [li["id"], li["zone"], *li["cibles"], li["total"]] == [_n(x) for x in attendu[:8]], li["id"]


def test_recapitulatif_par_jour(contexte: tuple[list[dict[str, Any]], ParametresSuivi]) -> None:
    base, p = contexte
    r = recap_jours(base, p)
    f = {str(li[0]): li[1:6] for li in _onglet("RECAP_JOURS") if li and li[0]}
    correspondances = {"Fiches valides": "Fiches valides", "Enquêteurs ayant produit": "Enquêteurs ayant produit",
                       "Fiches par enquêteur actif": "Fiches par enquêteur actif", "Fiches à vérifier": "Fiches à vérifier",
                       "% à vérifier": "% à vérifier", "Fiches rejetées par le superviseur": "Fiches rejetées par le superviseur",
                       "Fiches sans réponse à la question de cible": "Fiches sans réponse à Q1 « Vous êtes » (code 99)",
                       "Fiches vides (aucune question renseignée)": "Fiches vides (aucune question renseignée)",
                       "Fiches avec délai court": "Fiches avec délai court", "Fiches avec incohérence de réponses": "Fiches avec incohérence de réponses",
                       "Téléphones en double": "Téléphones en double", "Minutes moyennes entre deux fiches": "Minutes moyennes entre deux fiches",
                       "Ville : Douala": "Douala", "Ville : Yaoundé": "Yaoundé", "Ville : Bafoussam": "Bafoussam"}
    for nous, v11 in correspondances.items():
        assert all(_proche(o, a) for o, a in zip(r[nous], f[v11], strict=True)), nous
    # Écart volontaire : V11 comptait la note de bas d'onglet ENQUETEURS comme un 12e enquêteur (12 × 25 = 300).
    assert [_n(x) for x in f["Objectif (enquêteurs × objectif/jour)"]] == [300, 300, 300, 300, 900]
    assert r["Objectif (enquêteurs × objectif/jour)"] == [275, 275, 275, 275, 825]


def test_tri_a_plat(contexte: tuple[list[dict[str, Any]], ParametresSuivi], dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> None:
    from plateforme.generateurs.masque import colonnes_masque
    from plateforme.generateurs.tri_a_plat import gabarit
    from plateforme.suivi.tableaux import tri_a_plat
    base, p = contexte
    n, par_jour, tables = tri_a_plat(base, gabarit(dico_edm, colonnes_masque(dico_edm, terrain_edm.villes_masque())), p)
    f = _onglet("TRI_A_PLAT")
    assert (n, par_jour) == (_n(f[1][1]), [_n(x) for x in f[1][7:11]])
    titres = {str(li[0]): i for i, li in enumerate(f) if li and li[0] and " — " in str(li[0])}
    ecarts = []
    for t in tables:
        i = titres[t.titre] + 2                                   # ligne de titre, puis en-tête
        attendues = [*t.lignes, *([t.total] if t.total else [])]
        for j, ligne in enumerate(attendues):
            for k, (o, a) in enumerate(zip(ligne, f[i + j], strict=False)):
                if not _proche(o, a):
                    ecarts.append(f"{t.titre[:30]} ligne {j + 1} colonne {k + 1}")
        if t.total:
            assert t.total[5] == n, f"{t.titre} : ligne TOTAL différente de la base"
    assert len(tables) == len(titres) and ecarts == [], ecarts[:10]
