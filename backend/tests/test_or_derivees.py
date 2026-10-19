"""TEST D'OR DE LA PHASE 4 (étage 2) : la base d'analyse produite par la PLATEFORME (fiches codées → base 427 →
plan d'analyse) est identique, fiche par fiche et variable par variable, à la base livrée au client
(SPSS_EDM_EE_V6_ANALYSE_427.sav, produite par les syntaxes EDM_EE_*).

Écarts expliqués (et vérifiés ci-dessous, pas seulement décrits) :
1. MAACAUTR (texte « Autre marque ») : SPSS l'a importé TRONQUÉ à 8 octets UTF-8 (R41:35 et R41:97 disent « 8 caractères ») ;
   la plateforme garde le texte complet. La règle écrite de R41:253 (« on retient la PREMIÈRE marque citée ») est
   appliquée à la première citation du texte complet : les dérivées sont identiques avec le texte complet comme avec le
   texte tronqué. (Appliquée au texte complet sans cette précaution, la règle Ingelec de R41, « contient GELEC », aurait
   classé 7 fiches en Ingelec alors que leur première marque citée est autre ; une 8e, écartée de la base, cite ses
   marques sans virgule : la règle Ingelec porte donc sur le premier mot.)
2. DOUBLON_SUSP = 1 (« ressemblance forte, à vérifier ») : dans R41:328 c'est une liste de lignes écrite à la main,
   sans règle chiffrée ; la règle écrite de la plateforme (≤ 6 écarts d'un membre d'un groupe, D-019) en signale 2 de
   plus. Les copies (= 2, écartées) sont identiques : la base retenue ne change pas.
3. SEG_TS (typologie TwoStep, N05:355-368) : algorithme propriétaire SPSS, non reproduit (voir RESTE_A_FAIRE).
"""

from __future__ import annotations

import datetime as dt
import math
from pathlib import Path
from typing import Any

import pytest
from base_plateforme import DISPONIBLE, SAV_427, SAV_446, construire, octets8

from plateforme.analyse.controle import VARIABLES, jour_terrain
from plateforme.analyse.donnees import JeuDonnees, depuis_sav
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.terrain.plan import PlanTerrain

reelles = pytest.mark.skipif(not DISPONIBLE, reason="données réelles absentes (reference/prive/, hors Git)")


def _v(x: Any) -> Any:
    """Valeur comparable : manquant → None, texte sans blancs de fin, date en texte ISO, nombre en flottant."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    if isinstance(x, str):
        return x.rstrip() or None
    if isinstance(x, dt.date | dt.time):
        return x.isoformat()
    try:
        return float(x)
    except (TypeError, ValueError):
        return str(x)


@pytest.fixture(scope="module")
def jeux(dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> dict[str, Any]:
    b = construire(dico_edm, terrain_edm)
    def indexe(jd: JeuDonnees) -> Any:
        return jd.table.assign(NUMFICHE=jd.table["NUMFICHE"].str.strip()).set_index("NUMFICHE")
    return {"plan": b.plan, "brut": b.brut, "complet": b.complet, "tronque": b.tronque, "collecte": b.collecte,
            "livre": indexe(depuis_sav(SAV_427)), "livre_446": indexe(depuis_sav(SAV_446))}


def _ecarts(nous: JeuDonnees, livre: Any, variable: str) -> dict[str, tuple[Any, Any]]:
    t = nous.table.set_index("NUMFICHE")
    return {i: (_v(t.at[i, variable]), _v(livre.at[i, variable])) for i in t.index if _v(t.at[i, variable]) != _v(livre.at[i, variable])}


@reelles
def test_memes_fiches(jeux: dict[str, Any]) -> None:
    nous = list(jeux["brut"].table["NUMFICHE"])
    assert len(nous) == len(set(nous)) == 427
    assert set(nous) == set(jeux["livre"].index)


@reelles
def test_variables_brutes_identiques(jeux: dict[str, Any]) -> None:
    brut, livre = jeux["brut"], jeux["livre"]
    communes = [c for c in brut.table.columns if c in livre.columns and c != "NUMFICHE" and c not in VARIABLES]
    assert len(communes) >= 59
    ecarts = {c: len(e) for c in communes if (e := _ecarts(brut, livre, c))}
    assert set(ecarts) <= {"MAACAUTR"}, ecarts
    # MAACAUTR : le texte livré est exactement notre texte coupé à 8 octets (troncature de l'import SPSS)
    t = brut.table.set_index("NUMFICHE")
    assert all(_v(octets8(t.at[i, "MAACAUTR"])) == _v(livre.at[i, "MAACAUTR"]) for i in t.index)


@reelles
@pytest.mark.parametrize("texte", ["complet", "tronque"])
def test_derivees_identiques(jeux: dict[str, Any], texte: str) -> None:
    pa = jeux["plan"]
    assert len(pa.derivations) >= 62
    ecarts = {d.nom: len(e) for d in pa.derivations if (e := _ecarts(jeux[texte], jeux["livre"], d.nom))}
    assert ecarts == {}


def test_premiere_marque_citee() -> None:
    """« Chint, ingelect, Schneider » : la première marque citée est Chint (3), pas Ingelec (6) ; idem sans virgule."""
    import pandas as pd

    from plateforme.analyse.derivees import Derivation, deriver
    from plateforme.analyse.donnees import Variable

    textes = ["Chint, ingelect, Schneider", "Somef,ingelec", "Schneider; le grand", "Ingelec", "  yaki et autre", "Most available and demanded",
              "Schneider Legrand ingelec", "Engelec"]
    jd = JeuDonnees(pd.DataFrame({"T": textes}), {"T": Variable("T")})
    regles = [{"valeur": 8}, {"si": "commence(premiere_citation(T), 'CHINT')", "valeur": 3},
              {"si": "commence(premiere_citation(T), 'SCHNEID')", "valeur": 1}, {"si": "commence(premiere_citation(T), 'YAK')", "valeur": 5},
              {"si": "contient(premier_mot(T), 'GELEC')", "valeur": 6}, {"si": "commence(premiere_citation(T), 'MOST')", "valeur": 9}]
    assert list(deriver(jd, Derivation("M", etapes=regles))) == [3.0, 8.0, 1.0, 6.0, 5.0, 9.0, 1.0, 6.0]
    sans = [{**r, "si": r["si"].replace("premiere_citation(T)", "T").replace("premier_mot(T)", "T")} if "si" in r else r for r in regles]
    assert list(deriver(jd, Derivation("M", etapes=sans)))[:2] == [6.0, 6.0], "sans la règle, Ingelec l'emporte à tort"


@reelles
@pytest.mark.parametrize("variable", ["ID_CASE", "JOURTERR", "NB_NR", "TX_REMPL", "BLOC_WEB_VIDE"])
def test_variables_de_controle(jeux: dict[str, Any], variable: str) -> None:
    assert _ecarts(jeux["complet"], jeux["livre"], variable) == {}


@reelles
def test_doublons_copies_identiques_suspects_regle_ecrite(jeux: dict[str, Any]) -> None:
    ecarts = _ecarts(jeux["complet"], jeux["livre"], "DOUBLON_SUSP")
    # aucune copie dans la base retenue, des deux côtés ; seul le niveau 1 (liste manuelle de R41) diffère
    assert set(ecarts.values()) == {(1.0, 0.0)} and len(ecarts) == 2


@reelles
def test_base_de_collecte_446(jeux: dict[str, Any]) -> None:
    """SPSS_EDM_EE_V6_COLLECTE_446.sav (N08_B_COLLECTE_446.sps) : mêmes 446 fiches, mêmes valeurs, mêmes écarts expliqués."""
    collecte, livre = jeux["collecte"], jeux["livre_446"]
    assert len(collecte.table) == 446 and set(collecte.table["NUMFICHE"]) == set(livre.index)
    communes = [c for c in collecte.table.columns if c in livre.columns and c != "NUMFICHE"]
    assert len(communes) >= 127
    ecarts = {c: e for c in communes if (e := _ecarts(collecte, livre, c))}
    assert set(ecarts) == {"MAACAUTR", "DOUBLON_SUSP"}
    assert set(ecarts["DOUBLON_SUSP"].values()) == {(1.0, 0.0)} and len(ecarts["DOUBLON_SUSP"]) == 2
    t = collecte.table.set_index("NUMFICHE")
    assert all(_v(octets8(t.at[i, "MAACAUTR"])) == _v(livre.at[i, "MAACAUTR"]) for i in t.index)
    # repères de N08_B_COLLECTE_446.sps:42-49 : 427 retenues, 19 écartées = 11 à moins de 70 % + 8 copies probables
    assert (t["FILTRE_QUAL"] == 1).sum() == 427
    assert ((t["FILTRE_QUAL"] == 0) & (t["TX_REMPL"] < 70)).sum() == 11
    assert ((t["FILTRE_QUAL"] == 0) & (t["DOUBLON_SUSP"] == 2)).sum() == 8


def test_jour_terrain_rattrapage() -> None:
    cal = [dt.date(2026, 10, 5), dt.date(2026, 10, 6), dt.date(2026, 10, 7), dt.date(2026, 10, 8)]
    assert jour_terrain("2026-10-05", cal) == 1
    assert jour_terrain("2026-10-08", cal) == 4
    assert jour_terrain("2026-10-09", cal) == 4, "un jour de rattrapage est rangé dans le dernier jour prévu"
    assert jour_terrain("2026-10-04", cal) is None
    assert jour_terrain("", cal) is None
    assert jour_terrain("2026-10-05", []) is None


@reelles
def test_sav_analyse_produit_par_la_plateforme(jeux: dict[str, Any], tmp_path: Path) -> None:
    """Le .sav d'analyse ÉCRIT par la plateforme, relu, égale la base livrée (aux écarts expliqués près)."""
    from plateforme.analyse.exports import exporter_sav_jeu

    chemin = exporter_sav_jeu(jeux["complet"], tmp_path / "BASE_ANALYSE_427.sav", formats={"DATEENQU": "SDATE10"})
    relu = depuis_sav(chemin)
    assert relu.variables["REVMENME"].manquants == {97.0, 98.0, 99.0}
    communes = [c for c in relu.table.columns if c in jeux["livre"].columns and c != "NUMFICHE"]
    assert len(communes) >= 127 - 1                                         # toutes sauf SEG_TS
    ecarts = {c for c in communes if _ecarts(relu, jeux["livre"], c)}
    assert ecarts == {"MAACAUTR", "DOUBLON_SUSP"}


@reelles
def test_tableaux_du_plan_sur_la_base_de_la_plateforme(jeux: dict[str, Any]) -> None:
    """Les tableaux déclarés dans plan_analyse.yaml redonnent les repères des syntaxes (filtre et pondération compris)."""
    from plateforme.analyse.tableaux import produire

    res = {r.titre.split(" [source")[0]: r.resultat for r in produire(jeux["plan"].tableaux, jeux["complet"])}
    assert len(res) == len(jeux["plan"].tableaux) == 20
    entreprises = res["Produits achetés par les entreprises"]
    assert round(entreprises.pct_observations["PRACSOLA"], 1) == 40.0                      # type: ignore[attr-defined]  R427:143
    valeur = res["Parts de marché en valeur (pondération par la dépense annuelle)"]
    assert valeur.base == 286 and round(valeur.pct(1), 1) == 22.8                           # type: ignore[attr-defined]  R427:222-226
    assert round(res["Facteurs d'achat en ligne (régression logistique)"].r2_nagelkerke, 2) == 0.23   # type: ignore[attr-defined]
