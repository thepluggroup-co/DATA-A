"""TEST D'OR DE LA PHASE 4 (étage 1) : le moteur d'analyse reproduit, à l'arrondi près, les repères des syntaxes
SPSS de l'étude, calculés sur la base livrée au client (SPSS_EDM_EE_V6_ANALYSE_427.sav, 427 fiches), et sur la même
base reconstruite par la plateforme à partir des réponses brutes.

Chaque repère est recopié de la syntaxe avec sa ligne d'origine (fichier:ligne), pour vérification.
« À l'arrondi près » : la valeur calculée ne s'écarte du repère que d'un demi-dixième au plus (0,05). Une valeur
exactement à mi-chemin est donc conforme quel que soit le sens d'arrondi retenu (cas réel : MONMOYAC « 100-500 000 »
= 110 / 352 = 31,25 %, écrit 31,2 dans la syntaxe V4, ligne 330).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from base_plateforme import DISPONIBLE, construire

from plateforme.analyse.donnees import JeuDonnees, depuis_sav

SAV = Path(__file__).resolve().parents[2] / "reference" / "prive" / "sav" / "SPSS_EDM_EE_V6_ANALYSE_427.sav"
pytestmark = pytest.mark.skipif(not SAV.exists(), reason="base livrée absente (reference/prive/, hors Git)")
V4 = "EDM_EE_SYNTAXE_ANALYSE_GLOBALE_V4.sps"
R427 = "EDM_EE_REPRODUCTION_RAPPORT_427.sps"
N05 = "EDM_EE_ANALYSES_N05_FILTREES.sps"


@pytest.fixture(scope="module", params=["sav_livre", "plateforme"])
def jd(request: pytest.FixtureRequest) -> JeuDonnees:
    """Chaque repère est vérifié deux fois : sur la base livrée (.sav) et sur la base PRODUITE PAR LA PLATEFORME
    (fiches codées → base 427 → plan d'analyse, texte complet de MAACAUTR ; voir test_or_derivees.py)."""
    if request.param == "sav_livre":
        return depuis_sav(SAV)
    if not DISPONIBLE:
        pytest.skip("données réelles absentes (reference/prive/, hors Git)")
    return construire(request.getfixturevalue("dico_edm"), request.getfixturevalue("terrain_edm")).complet


class _Arrondi(float):
    """Valeur comparée « à l'arrondi près » (écart ≤ 0,05) à un repère écrit avec une décimale."""

    def __eq__(self, autre: object) -> bool:
        return isinstance(autre, int | float) and abs(float(self) - float(autre)) <= 0.05 + 1e-9

    def __hash__(self) -> int:
        return hash(round(float(self), 1))


def _r(x: float) -> _Arrondi:
    return _Arrondi(x)


# (source, variable, {codes: % attendu}, base attendue ou None)
FREQUENCES = [
    (f"{V4}:292", "VOUSETES", {(1,): 38.9, (5,): 36.5, (3,): 11.7, (2,): 9.6, (4,): 3.3}, None),
    (f"{V4}:293", "CATEG3", {(1,): 48.5, (3,): 36.5, (2,): 15.0}, None),
    (f"{V4}:303", "SEXMAFEM", {(1,): 83.4}, None),
    (f"{V4}:303", "AGE3", {(1,): 43.4, (2,): 34.8}, None),
    (f"{V4}:307", "REVMEN_P", {(2,): 47.2, (1,): 34.1, (3,): 17.1}, 123),
    (f"{V4}:317", "FREQACHA", {(1,): 32.7, (2,): 41.7}, None),
    (f"{V4}:324", "LIEACHPR", {(2,): 34.4, (4,): 19.2, (5,): 18.3, (1,): 18.0, (6,): 1.2}, None),
    (f"{V4}:330", "MONMOYAC", {(2,): 38.1, (3,): 31.2}, 352),
    (f"{V4}:351", "PAIEPRIV", {(1,): 82.2, (2,): 8.5, (3,): 7.1, (4,): 2.1}, None),
    (f"{V4}:361", "IMPOMARQ", {(1,): 36.8, (2,): 38.7, (1, 2): 75.5}, None),
    (f"{V4}:366", "PRCRICHO", {(2,): 66.0, (1,): 23.7, (3,): 5.9}, None),
    (f"{V4}:375", "MARQUE_G", {(1,): 31.5, (5,): 18.6, (3,): 16.3, (2,): 13.2, (9,): 5.9, (8,): 4.8}, 355),
    (f"{V4}:398", "ORIGPRIV", {(4,): 40.3, (1,): 30.6, (2,): 28.4}, None),
    (f"{V4}:403", "ORIG_MARQ", {(1,): 51.3, (3,): 25.4, (2,): 17.5, (4,): 5.9}, 355),
    (f"{V4}:413", "MEQUAFIA", {(1,): 46.3, (98,): 26.0}, None),
    (f"{V4}:414", "MEILPRIX", {(2,): 58.7, (98,): 25.7}, None),
    (f"{V4}:415", "MEQUA_AV", {(1,): 62.6}, None),
    (f"{V4}:415", "MEILP_AV", {(2,): 79.0}, None),
    (f"{V4}:426", "ORINFACH", {(4,): 34.0, (2,): 28.1, (1,): 19.6}, None),
    (f"{V4}:432", "ORASHAGA", {(1,): 47.6, (98,): 32.5}, None),
    (f"{V4}:433", "ORASBAGA", {(98,): 50.1, (2,): 45.2}, None),
    (f"{V4}:434", "ORHG_AV", {(1,): 70.6}, None),
    (f"{V4}:434", "ORBG_AV", {(2,): 90.6}, 212),
    (f"{V4}:445", "GAACPLSO", {(2,): 51.0, (1,): 19.8, (4,): 19.5, (3,): 9.8}, None),
    (f"{V4}:451", "DEAVHAGA", {(3,): 52.4}, None),
    (f"{V4}:452", "CAAVBAGA", {(4,): 44.4}, None),
    (f"{V4}:457", "PXHAUTGA", {(3,): 39.5}, None),
    (f"{V4}:457", "PXMOYEGA", {(2,): 48.2}, None),
    (f"{V4}:458", "PXBASGAM", {(1,): 78.2}, None),
    (f"{V4}:463", "ECQUHABA", {(1,): 28.3, (2,): 43.7, (1, 2): 72.0}, None),
    (f"{V4}:468", "PRIOPRIN", {(2,): 71.6, (3,): 16.0, (1,): 12.4}, None),
    (f"{V4}:475", "SUACMOGA", {(1,): 32.1, (2,): 48.6, (3, 4, 5): 19.2}, 333),
    (f"{V4}:484", "PRINFREI", {(2,): 36.7, (1,): 34.7, (3,): 19.6}, None),
    (f"{V4}:490", "CRACPRCO", {(1,): 45.4, (2,): 35.1}, None),
    (f"{V4}:495", "DEJDECAC", {(1, 2): 80.0}, None),
    (f"{V4}:507", "IMSECSAV", {(1,): 37.8, (2,): 45.7, (1, 2): 83.5}, None),
    (f"{V4}:512", "SEATPRIO", {(1,): 62.1, (2,): 20.7}, None),
    (f"{V4}:518", "DUGAJUAC", {(1,): 43.0, (2,): 42.5}, None),
    (f"{V4}:523", "CACOPREF", {(1,): 60.9, (3,): 19.9, (2,): 17.7}, None),
    (f"{V4}:528", "BOSAPACH", {(1,): 24.4, (2,): 44.2, (3,): 31.4}, None),
    (f"{V4}:539", "CANAPREF", {(2,): 33.2, (4,): 19.3, (1,): 18.1}, None),
    (f"{V4}:549", "CRCHCANA", {(2,): 28.8, (3,): 21.1, (6,): 18.2}, None),
    (f"{V4}:554", "DEJACHLI", {(1,): 29.2}, None),
    (f"{V4}:554", "PRETACLI", {(1,): 21.5, (2,): 29.2, (3,): 49.3}, None),
    (f"{V4}:560", "PRFRACLI", {(1,): 36.6, (2,): 35.7}, None),
    (f"{V4}:572", "FIMEFOUR", {(1,): 21.3, (2,): 31.9, (1, 2): 53.2}, None),
    (f"{V4}:577", "LEVFIDEL", {(1,): 34.9, (2,): 34.4, (3,): 19.7, (5,): 5.3, (4,): 2.6, (7,): 1.9}, 416),
]


@pytest.mark.parametrize(("source", "variable", "attendus", "base"), FREQUENCES, ids=[f"{s}:{v}" for s, v, _, _ in FREQUENCES])
def test_frequences(jd: JeuDonnees, source: str, variable: str, attendus: dict[tuple[int, ...], float], base: int | None) -> None:
    from plateforme.analyse.procedures import frequences
    f = frequences(jd, variable)
    if base is not None:
        assert f.base == base, f"{source} : base {f.base} au lieu de {base}"
    for codes, attendu in attendus.items():
        assert _r(f.pct(*codes)) == attendu, f"{source} : {variable} {codes} = {f.pct(*codes):.3f} au lieu de {attendu}"


def test_effectifs_par_ville(jd: JeuDonnees) -> None:
    from plateforme.analyse.procedures import frequences
    assert [li.effectif for li in frequences(jd, "VILLEREG").lignes] == [163, 162, 102]       # V4:253 et N05:141


# Tris croisés : (source, ligne, colonne, codes de ligne additionnés, {code de colonne: % colonne})
CROISES = [
    (f"{V4}:318", "FREQACHA", "CATEG3", (1,), {3: 45.5, 1: 28.3, 2: 15.9}),
    (f"{V4}:377", "MARQUE_G", "CATEG3", (5,), {3: 29.3, 1: 16.2, 2: 3.7}),
    (f"{V4}:378", "MARQUE_G", "CATEG3", (1,), {2: 40.7}),
    (f"{V4}:529", "BOSAPACH", "CATEG3", (1, 2), {1: 76.0, 2: 69.5, 3: 58.0}),
    (f"{N05}:266", "DUGAJUAC", "VILLEREG", (1,), {3: 74.3}),
    (f"{N05}:267", "DUGAJUAC", "VILLEREG", (2,), {2: 67.3}),
    (f"{N05}:267", "DUGAJUAC", "VILLEREG", (3, 4), {1: 32.0}),
]


@pytest.mark.parametrize(("source", "ligne", "colonne", "codes", "attendus"), CROISES, ids=[c[0] for c in CROISES])
def test_tris_croises(jd: JeuDonnees, source: str, ligne: str, colonne: str, codes: tuple[int, ...], attendus: dict[int, float]) -> None:
    from plateforme.analyse.procedures import tri_croise
    t = tri_croise(jd, ligne, colonne)
    for col, attendu in attendus.items():
        j = t.codes_colonnes.index(float(col))
        pct = sum(t.pct_colonne[t.codes_lignes.index(float(c))][j] for c in codes)
        assert _r(pct) == attendu, f"{source} : {ligne} {codes} × {colonne}={col} : {pct:.3f} au lieu de {attendu}"


def test_reponses_multiples(jd: JeuDonnees) -> None:
    from plateforme.analyse.procedures import reponses_multiples
    q9 = ["PRACCABL", "PRACAPPA", "PRACPRIS", "PRACLUMI", "PRACSOLA", "PRACGROU"]
    r = reponses_multiples(jd, q9)
    assert r.base == 424                                                                    # V4:345
    assert {v: _r(p) for v, p in r.pct_observations.items()} == {"PRACPRIS": 84.7, "PRACCABL": 80.4, "PRACAPPA": 78.5,
                                                                  "PRACLUMI": 60.8, "PRACSOLA": 20.8, "PRACGROU": 10.4}
    entreprises = reponses_multiples(jd.filtrer(jd.valides("PROFIL4") == 2, "entreprises"), q9)
    assert _r(entreprises.pct_observations["PRACSOLA"]) == 40.0                             # R427:143


def _indicateurs(jd: JeuDonnees) -> JeuDonnees:
    """Indicateurs 0/1 de la synthèse, recodés comme dans R427:37-53 (RECODE … INTO R_*, puis P_* = 100 × X)."""
    import numpy as np
    def recode(var: str, uns: tuple[int, ...], zeros: tuple[int, ...]) -> object:
        s = jd.valides(var)
        return np.where(s.isin(uns), 1.0, np.where(s.isin(zeros), 0.0, np.nan))
    nouveaux = {"R_CONTREF": recode("CRACPRCO", (1, 2), (3, 4)), "R_REFUS10": recode("SUACMOGA", (1, 2), (3, 4, 5)),
                "R_MOYGAM": recode("GAACPLSO", (2,), (1, 3, 4)), "R_SCHNEI": recode("MARQUE_G", (1,), tuple(range(2, 11))),
                "R_GARREM": recode("SEATPRIO", (1,), (2, 3, 4, 5)), "R_GROSSI": recode("LIEACHPR", (2,), (1, 3, 4, 5, 6))}
    for nom, x in [("P_DECU", "DECU"), ("P_CONTREF", "R_CONTREF"), ("P_QUAL", "CRIT_QUAL"), ("P_REFUS10", "R_REFUS10"),
                   ("P_MOYGAM", "R_MOYGAM"), ("P_SCHNEI", "R_SCHNEI"), ("P_YAKI", "ACHAT_YAKI"), ("P_GARREM", "R_GARREM"),
                   ("P_GROSSI", "R_GROSSI"), ("P_ONLINE", "ONLIN_FERME")]:
        source = nouveaux[x] if x in nouveaux else jd.valides(x).to_numpy()
        jd = jd.avec_variable(nom, 100 * np.asarray(source, dtype=float))
    return jd


INDICATEURS = ["P_DECU", "P_CONTREF", "P_QUAL", "P_REFUS10", "P_MOYGAM", "P_SCHNEI", "P_YAKI", "P_GARREM", "P_GROSSI", "P_ONLINE"]


def test_tableau_s1_chiffres_cles(jd: JeuDonnees) -> None:
    from plateforme.analyse.procedures import moyennes
    j = _indicateurs(jd)
    obtenu = [(_r(m.moyenne), int(m.effectif)) for m in (moyennes(j, v) for v in INDICATEURS)]
    assert obtenu == [(80.0, 426), (80.5, 390), (66.0, 427), (80.8, 333), (51.0, 420), (31.5, 355), (18.6, 355), (62.1, 367),
                      (34.4, 427), (21.5, 377)]                                                  # R427:68-69


def test_tableau_2bis_profils_egaux(jd: JeuDonnees) -> None:
    """Pondération « chaque profil pèse autant » : W = (N / 4) / effectif du profil (R427:77-101)."""
    from plateforme.analyse.procedures import moyennes
    j = _indicateurs(jd)
    profil = j.valides("PROFIL4")
    j = j.avec_variable("W_PROF", (len(profil) / 4) / profil.map(profil.value_counts()))
    obtenu = [_r(moyennes(j, v, poids="W_PROF").moyenne) for v in INDICATEURS]
    assert obtenu == [78.4, 80.9, 69.7, 78.6, 47.3, 34.3, 14.4, 62.8, 34.3, 21.4]


def test_depense_annuelle_medianes(jd: JeuDonnees) -> None:
    from plateforme.analyse.procedures import moyennes
    m = moyennes(jd, "DEPENSE_AN", par="PROFIL4")
    assert (m.mediane, round(m.moyenne / 1e6, 1)) == (3_250_000, 11.7)                      # R427:167-168
    assert (m.groupes[2.0][1], m.groupes[3.0][1]) == (7_200_000, 1_500_000)
    v = moyennes(jd, "DEPENSE_AN", par="VILLEREG")
    assert [v.groupes[c][1] for c in (1.0, 2.0, 3.0)] == [3_250_000, 3_250_000, 7_200_000]


def test_surcout_accepte(jd: JeuDonnees) -> None:
    from plateforme.analyse.procedures import moyennes
    m = moyennes(jd, "SURCOUT_PCT", par="VILLEREG")
    assert (_r(m.moyenne), m.mediane, _r(m.groupes[2.0][0])) == (7.6, 5.0, 11.0)          # N05:220


def test_parts_en_valeur(jd: JeuDonnees) -> None:
    """Pondération par la dépense annuelle (R427:222-226) : parts en VALEUR, 286 acheteurs."""
    from plateforme.analyse.procedures import frequences
    f = frequences(jd, "MARQUE_G", poids="DEPENSE_AN")
    assert f.base == 286
    assert {c: _r(f.pct(c)) for c in (1, 3, 2, 5)} == {1: 22.8, 3: 22.6, 2: 13.7, 5: 10.0}
    assert _r(frequences(jd, "ORIG_MARQ", poids="DEPENSE_AN").pct(1)) == 44.4


def test_correspondances(jd: JeuDonnees) -> None:
    from plateforme.analyse.procedures import correspondances
    ville = correspondances(jd, "MARQ_AC", "VILLEREG")
    profil = correspondances(jd, "MARQ_AC", "PROFIL4")
    assert (round(ville.inertie_totale, 2), round(profil.inertie_totale, 2), _r(ville.part_axes[0])) == (0.39, 0.12, 69.3)   # R427:219


def test_regression_logistique(jd: JeuDonnees) -> None:
    from plateforme.analyse.procedures import logistique
    r = logistique(jd, "ONLIN_FERME", ["VILLEREG", "CATEG3", "AGE3", "SAV_TRESIMP", "MONT_100K", "DECU"],
                   categorielles=["VILLEREG", "CATEG3", "AGE3"])
    assert r.base == 295                                                                    # R427:282
    sav, mont, baf = r.coefficients["SAV_TRESIMP"], r.coefficients["MONT_100K"], r.coefficients["VILLEREG_3"]
    assert (round(sav[0], 1), round(sav[1], 1), round(sav[2], 1)) == (3.5, 1.9, 6.7)        # R427:294-296
    assert (round(mont[0], 1), round(mont[1], 1), round(mont[2], 1)) == (2.4, 1.2, 4.9)
    assert (round(baf[0], 2), round(baf[1], 2), round(baf[2], 2)) == (0.23, 0.09, 0.61)
    assert round(r.r2_nagelkerke, 2) == 0.23
    assert (r.hosmer_lemeshow[1], round(r.hosmer_lemeshow[2], 3)) == (8, 0.004)                # N08_A_RAPPORT_427.sps:314


def test_meme_canal(jd: JeuDonnees) -> None:
    from plateforme.analyse.procedures import frequences
    assert round(frequences(jd, "MEME_CANAL").pct(1)) == 84                                 # N05:296 (« environ 84 % »)
