"""Rapport EDM régénéré (projets/edm_cameroun/rapport.yaml) comparé au rapport livré V14 : chaque chiffre transcrit
doit être retrouvé par le moteur. Données réelles locales (reference/prive/, hors Git)."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path
from typing import Any

import pytest
from base_plateforme import DISPONIBLE, construire
from conftest import REFERENCE
from donnees_reelles import charger as charger_reel

from plateforme.analyse.rapport import chargeur
from plateforme.analyse.rapport.controles import controler
from plateforme.analyse.rapport.modele import nombre_fr, resoudre
from plateforme.analyse.rapport.rendus import arrondi_total_100
from plateforme.codification.qualite import ParametresBase, base_analyse
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.terrain.plan import PlanTerrain

RAPPORT = REFERENCE.parent / "projets" / "edm_cameroun" / "rapport.yaml"
pytestmark = pytest.mark.skipif(not DISPONIBLE, reason="données réelles absentes (reference/prive/, hors Git)")


@pytest.fixture(scope="module")
def rapport(dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> Any:
    b = construire(dico_edm, terrain_edm)
    r = charger_reel(dico_edm, terrain_edm)
    _, note = base_analyse(dico_edm, r.fiches, ParametresBase(), r.decisions)
    jeux = {"analyse": b.complet, "collecte": b.collecte}
    quotas = chargeur.quotas_du_plan(RAPPORT.parent / "plan_echantillonnage.yaml", terrain_edm)
    rap, interdits = chargeur.charger(RAPPORT, jeux, note.texte(), chargeur.chiffres_de_base(note), {"quotas": quotas, "dictionnaire": dico_edm})
    return rap, interdits, jeux


def test_note_de_base_v14(rapport: Any) -> None:
    rap, _, _ = rapport
    c = rap.base_etude.chiffres
    assert (c["collectees"], c["retenues"], c["ecartees"], c["remplissage"], c["copies"]) == (446, 427, 19, 11, 8)   # V14 p. 4


def test_secteurs_graphiques_1_a_8_v14(rapport: Any) -> None:
    """Étiquettes des graphiques 1 à 8 (V14 p. 13-14), arrondies au plus fort reste comme dans le rapport livré."""
    rap, _, _ = rapport
    res = rap.resultats()
    attendus = {"g1": [42, 16, 42], "g2": [32, 10, 12, 4, 42], "g3": [30, 10, 13, 1, 46], "g4": [40, 14, 46],
                "g5": [64, 10, 9, 7, 10], "g6": [74, 16, 10], "g7": [39, 10, 12, 3, 36], "g8": [48, 15, 37]}
    bases = {"g1": 172, "g2": 172, "g3": 172, "g4": 172, "g5": 102, "g6": 102, "g7": 446, "g8": 446}
    for g, attendu in attendus.items():
        assert arrondi_total_100([li.pourcentage for li in res[g].lignes]) == attendu, g
        assert res[g].base == bases[g], g


def test_tableau_3_v14(rapport: Any) -> None:
    rap, _, jeux = rapport
    t3 = rap.resultats()["t3"]
    lignes = {jeux["collecte"].libelle("NUMENQUE", c): [int(x) for x in t3.effectifs[i]] for i, c in enumerate(t3.codes_lignes)}
    assert lignes == {"ENQ1": [25, 24, 18, 2], "ENQ2": [10, 19, 19, 0], "ENQ3": [11, 14, 25, 3], "ENQ4": [24, 1, 14, 12],
                      "ENQ5": [12, 8, 24, 15], "ENQ6": [16, 21, 24, 0], "ENQ7": [0, 18, 19, 23], "ENQ8": [12, 6, 13, 11],
                      "ENQ10": [1, 2, 0, 0]}                                                                  # V14 p. 15-16


def test_tableau_2_v14(rapport: Any) -> None:
    """Réalisé / prévu par cible et par ville (V14 p. 12) ; les quotas viennent du plan d'échantillonnage."""
    t2 = rapport[0].resultats()["t2"]
    assert t2.realise == [[55, 51, 66], [17, 17, 10], [21, 23, 9], [6, 1, 7], [73, 80, 10]]
    assert t2.prevu == [[35, 35, 15], [35, 35, 15], [40, 40, 20], [40, 40, 20], [50, 50, 30]]


def test_tableau_2bis_v14(rapport: Any) -> None:
    t = rapport[0].resultats()["t2bis"]
    ecarts = [round(e, 1) for *_, e in t.lignes]
    assert ecarts == [1.6, 1.9, 5.1, 3.2, 3.7, 4.3, 4.2, 0.7, 2.8, 1.8]                                       # V14 p. 13


def test_textes_resolus(rapport: Any) -> None:
    rap, _, _ = rapport
    res = rap.resultats()
    textes = [resoudre(e.texte, res) for e in rap.elements if hasattr(e, "texte") and "[[" in getattr(e, "texte", "")]
    assert any(t.startswith("446 fiches collectées, 427 fiches analysées. La collecte s'est déroulée du 5 au 8 octobre 2026") for t in textes)
    assert any("80,0 % des acheteurs ont déjà été déçus par un achat (n = 426)" in t for t in textes)
    assert any("de 14 à 19 % des acheteurs selon la pondération" in t for t in textes)
    # Le rapport V14 écrivait « aucun indicateur ne varie de plus de 5 points » alors que son tableau 2 bis donne 5,1 pts
    # (qualité) : la référence affiche la valeur exacte.
    assert any("ne varie de plus de 5,1 points" in t for t in textes)
    assert any("Les ressources déployées ont permis d'atteindre 89,2 % des objectifs visés, soit 446 questionnaires collectés : 172 à Douala, "
               "172 à Yaoundé et 102 à Bafoussam" in t for t in textes)                                     # V14 p. 12
    assert any("particuliers 172 fiches pour 85 prévues (202 %), revendeurs 163 pour 130 (125 %), électriciens 53 pour 100 (53 %), "
               "PME 44 pour 85 (52 %), BTP 14 pour 100 (14 %)" in t for t in textes)                         # V14 p. 12


def test_acceptation_phase_5_rapport_regenere_sans_incoherence(rapport: Any, tmp_path: Path) -> None:
    """Critère d'acceptation de la phase 5 (CLAUDE.md §11) : le rapport complet est régénéré sans aucune incohérence de
    base, de total ou de numérotation. Aucune anomalie (bloquante ou non), puis production Word et PowerPoint (et PDF si
    un convertisseur est présent sur le poste)."""
    from plateforme.analyse.rapport.rendus import charger_charte, produire

    rap, interdits, jeux = rapport
    assert controler(rap, jeux, interdits) == []
    numeros = [e.numero for e in rap.numerotes()]
    tableaux = [n for n, e in zip(numeros, rap.numerotes(), strict=True) if type(e).__name__ == "TableauRapport"]
    graphiques = [n for n, e in zip(numeros, rap.numerotes(), strict=True) if type(e).__name__ == "Figure"]
    assert graphiques == [str(k) for k in range(1, 58)]                                         # V14 : graphiques 1 à 57
    assert tableaux == ["S1", "1", "2", "2 bis", "3", "4", "5", "6", "7", "8", "9", "10", "11", "A2"]   # V14 : 14 tableaux
    charte = charger_charte(RAPPORT.parent / str(rap.charte))
    formats = ["docx", "pptx"] + (["pdf"] if shutil.which("soffice") or sys.platform == "win32" else [])
    try:
        ecrits, anomalies = produire(rap, jeux, interdits, tmp_path, "RAPPORT_EDM", formats, charte)
    except RuntimeError as e:                                                                  # conversion PDF absente
        pytest.skip(f"conversion PDF indisponible sur ce poste : {e}")
    assert anomalies == [] and ecrits["docx"].stat().st_size > 0 and ecrits["pptx"].stat().st_size > 0


def test_chartes() -> None:
    from plateforme.analyse.rapport.rendus import charger_charte, charte_par_defaut

    data_a = charte_par_defaut()
    assert (data_a.nom, data_a.couleur_titres, data_a.logo is not None and data_a.logo.exists()) == ("DATA'A", "021C43", True)
    m2b = charger_charte(RAPPORT.parent / "charte_m2b.yaml")
    assert (m2b.police, m2b.fond_entete, m2b.logo == data_a.logo.resolve() or m2b.logo.resolve() == data_a.logo.resolve()) == ("Candara", "223962", True)


def test_tableau_5_v14(rapport: Any) -> None:
    """V de Cramér, p et case qui fait l'écart (V14 p. 21-22)."""
    from plateforme.analyse.exports import _lignes

    rap, _, jeux = rapport
    _, lignes, _ = _lignes(rap.resultats()["t5"], jeux["analyse"])
    v14 = {"MARQ_AC": (355, "0,44 (< 0,001)", "0,20 (< 0,001)", "38,7 % (+8,0)"),
           "DUGAJUAC": (407, "0,39 (< 0,001)", "0,12 (0,061) n.s. * ; K-W 0,006", "67,3 % (+7,9)"),
           "IMSECSAV": (405, "0,32 (< 0,001)", "0,07 (0,697) n.s. *", "19,9 % (+6,9)"),
           "ECQUHABA": (410, "0,31 (< 0,001)", "0,15 (0,004) *", "4,0 % (−6,3)"),
           "SUACMOGA": (333, "0,24 (< 0,001)", "0,17 (0,004) *", "45,5 % (+4,0)"),
           "DEJACHLI": (387, "0,08 (0,301) n.s.", "0,04 (0,920) n.s.", "—")}
    par_var = {li[0]: li for li in lignes}
    for v, (n, ville, profil, case) in v14.items():
        li = par_var[v]
        assert (li[2], li[3], li[4]) == (n, ville, profil), v
        assert li[5].endswith(case), v


def test_tableau_6_v14(rapport: Any) -> None:
    t6 = rapport[0].resultats()["t6"]
    assert len(t6.lignes) == t6.attendu == 56
    parts = {v: (round(a, 1), None if b is None else round(b, 1), round(c, 1)) for _, v, _, _, a, b, c in t6.lignes}
    assert parts["REVMENME"] == (66.7, 9.1, 24.1) and parts["ORASBAGA"] == (49.6, 49.9, 0.5)          # V14 p. 22-23
    assert parts["MAACAUTR"] == (100.0, None, 0.0) and parts["SEATPRIO"] == (85.9, None, 14.1)
    assert parts["RFIDPAIE"] == (97.4, None, 2.6) and parts["PRFRACLI"] == (81.3, None, 18.7)          # V14 p. 24


def test_v_de_cramer_texte(rapport: Any) -> None:
    rap, _, _ = rapport
    textes = [resoudre(e.texte, rap.resultats()) for e in rap.elements if "[[t5.v_min]]" in getattr(e, "texte", "")]
    assert textes and "(V de Cramér de 0,13 à 0,44)" in textes[0]                                      # V14 p. 21


def _textes(rap: Any) -> list[str]:
    from plateforme.analyse.rapport.modele import Paragraphe

    res = rap.resultats()
    return [resoudre(e.texte, res) for e in rap.elements if isinstance(e, Paragraphe)]


def test_partie_3b1_offre_v14(rapport: Any) -> None:
    """Tableau 7 et textes de l'analyse de l'offre (V14 p. 24-26), chiffres liés au moteur."""
    from plateforme.analyse.rapport.modele import TableauRapport

    rap = rapport[0]
    res = rap.resultats()
    t7 = next(e for e in rap.elements if isinstance(e, TableauRapport) and e.numero == "7")
    assert [[resoudre(c, res) for c in li] for li in t7.contenu[1:]] == [
        ["Schneider", "31,5 %", "Yaki", "18,6 %"], ["Legrand", "13,2 %", "Autres non réf. / sans marque fixe", "12,1 %"],
        ["Philips", "3,7 %", "Chint / chinoises", "16,3 %"], ["Siemens", "1,7 %", "Growatt", "1,1 %"],
        ["ABB / Hager", "1,1 %", "Vectron", "0,6 %"]]
    texte = " ".join(_textes(rap))
    for extrait in ("Schneider s'impose comme la référence (31,5 % des acheteurs), devant Yaki (18,6 %), les marques chinoises (16,3 %) et Legrand (13,2 %)",
                    "Les marques européennes réunissent 51,3 % des acheteurs, les marques asiatiques 17,5 %, et 31,3 %",
                    "75,5 % des acheteurs la jugent très importante ou importante",
                    "92,7 % chez les entreprises, 84,0 % chez les électriciens, contre 70,1 % chez les revendeurs",
                    "qui dominent à Yaoundé (71,4 % des acheteurs", "majoritaires à Bafoussam (68,1 % des acheteurs)",
                    "première marque à Douala (38,7 % des acheteurs)", "29,3 % des revendeurs l'achètent le plus souvent, contre 2,3 % des électriciens"):
        assert extrait in texte, extrait
    assert arrondi_total_100([li.pourcentage for li in res["g9"].lignes]) == [51, 18, 31]           # graphique 9
    # Graphique 10 : parts exactes 36,79 / 38,68 / 18,87 / 5,66. V14 affiche 37 / 38 / 19 / 6 (38,68 arrondi vers le bas,
    # 5,66 vers le haut) : aucune règle constante ne le reproduit. La règle du plus fort reste, qui redonne exactement les
    # graphiques 1 à 9, donne 37 / 39 / 19 / 5 : écart d'affichage expliqué (D-041), totaux à 100 dans les deux cas.
    assert arrondi_total_100([li.pourcentage for li in res["g10"].lignes]) == [37, 39, 19, 5]
    assert [round(li.pourcentage, 1) for li in res["g10"].lignes] == [36.8, 38.7, 18.9, 5.7]


def test_partie_3b2_demande_v14(rapport: Any) -> None:
    """Analyse de la demande (V14 p. 26-41) : extraits des textes, chiffres liés au moteur."""
    texte = " ".join(_textes(rapport[0]))
    for extrait in (
        "prises et interrupteurs (84,7 % des répondants), câbles et fils (80,4 %), appareillage et disjoncteurs (78,5 %), puis luminaires (60,8 %)",
        "40,0 % des entreprises achètent du solaire",
        "entre 100 000 et 500 000 FCFA (31,3 %) ; un acheteur sur cinq (20,2 %)",              # 110 / 352 = 31,25 → 31,3
        "Pour l'ensemble des répondants (n = 316 à 337 selon la gamme)",
        "les particuliers plus bas (42,9 % entre 5 000 et 15 000 FCFA)",
        "il l'est davantage à Yaoundé (88,7 %) qu'à Bafoussam (49,5 %)",
        "l'écart global selon le profil est significatif (p = 0,036)",
        "(71,7 % dépensent 100 000 FCFA ou plus par achat) et le plus faible chez les électriciens (35,6 %)",
        "70,6 % pour l'Europe et le haut de gamme, 90,6 % pour l'Asie et le bas de gamme",
        "est en médiane de 3,25 millions FCFA. Elle est plus élevée pour les entreprises (7,2 millions FCFA)",
        "les électriciens (1,5 million FCFA)",
        "Bafoussam : 100 000 à 500 000 FCFA pour 40,6 % ; 500 000 FCFA et plus pour 46,9 %",
        "(médiane de +5 %)", "particuliers +6,3 % (39,6 % n'acceptent aucun surcoût)",
        "Yaoundé +11,0 % (31,6 % acceptent plus de +10 %)",
        "il varie selon la ville (p < 0,001) et le profil (p = 0,027)",
        "(corrélations de Spearman, n = 310 à 333) : l'importance accordée au SAV (|ρ| = 0,28)",
        "revendeurs / grossistes, oui pour 21,7 % et peut-être pour 36,4 % (42,0 % refusent)",
        "(83,5 % le jugent important ou très important), devant la marque (75,5 %)",
        "le doute sur la qualité (36,7 %) est le premier frein, à égalité avec le prix (34,7 %)",
        "72,5 % ont été déçus plusieurs fois (53,2 % pour les marques asiatiques)",
        "V de Cramér de 0,14 à 0,22 ; bases de 324 à 419",
        "Le conseil technique est davantage attendu à Yaoundé (28,0 %), la réparation à Bafoussam (17,8 %)",
        "les prix et promotions (34,9 %) à égalité avec une qualité constante (34,4 %)",
        "74,4 % achètent au moins une fois par mois", "(moyenne de 11,7 millions FCFA",
        "(50,7 % de « oui » ou « peut-être »)", "contact commercial (19,9 %)",
    ):
        assert extrait in texte, extrait
    # Écart expliqué : bas de gamme à Yaoundé = 18 / 160 = 11,25 %. V14 écrit 11,2 (arrondi vers le bas) alors qu'il écrit
    # 31,3 pour 31,25 : la plateforme arrondit toujours au demi supérieur, comme SPSS.
    assert "à Yaoundé (11,3 %)" in texte


def _entier(x: float) -> int:
    """Borne affichée dans le rapport : entier arrondi au demi supérieur."""
    return int(nombre_fr(x, 0))


def test_partie_3b3_concurrence_v14(rapport: Any) -> None:
    """Analyse de la concurrence (V14 p. 41-47) : graphiques natifs Word de V14 (effectifs), carte, parts en valeur, textes."""
    from plateforme.analyse.rapport.modele import TableauRapport

    rap = rapport[0]
    res = rap.resultats()
    # Graphiques 41-42 : effectifs des graphiques natifs de V14 (word/charts/chart47 à 50), 7 groupes de marques
    attendu = {"Douala": [49, 55, 9, 14, 10, 2, 3], "Yaoundé": [44, 7, 15, 29, 8, 8, 8], "Bafoussam": [19, 4, 34, 4, 25, 3, 5],
               "Ensemble": [112, 66, 58, 47, 43, 13, 16]}
    for g in ("g41", "g42"):
        for titre, f in res[g].parts.items():
            assert [round(li.effectif) for li in f.lignes] == attendu[titre], titre
    assert [round(li.effectif) for li in res["g44"].lignes] == [347, 36, 30, 9]                          # graphique 44
    assert res["g45"].effectifs == [[143, 31, 46, 127], [9, 7, 4, 16], [9, 12, 0, 9], [3, 4, 0, 2]]      # graphique 45
    assert res["g46"].effectifs == [[44, 73, 12], [31, 38, 51], [1, 2, 0], [85, 46, 39]]                # graphique 46
    assert [round(li.effectif) for li in res["g47"].frequences["MEQUAFIA"].lignes] == [196, 101, 16, 110]  # graphique 47
    assert [round(li.effectif) for li in res["g47"].frequences["MEILPRIX"].lignes] == [64, 249, 2, 109]
    # Graphique 43 : coordonnées symétriques de la carte V14 (axe 1 orienté comme la sortie SPSS)
    carte = res["g43"]
    assert {k: tuple(round(x, 2) for x in v) for k, v in carte.points_colonnes.items()} == {
        1.0: (-0.74, -0.4), 2.0: (0.03, 0.83), 3.0: (1.07, -0.45)}
    assert round(carte.points_lignes[4.0][0], 2) == -1.04 and round(carte.points_lignes[6.0][0], 2) == 1.37     # Yaki, sans marque fixe
    # Parts en valeur : fourchettes bootstrap. Écart expliqué (D-041) : V14 vient de tirages SPSS aléatoires non
    # conservés ; la plateforme fixe la graine (2026) et retrouve chaque borne affichée de V14 à 1 point près.
    v14 = {"Schneider": (15, 32), "Chint": (12, 35), "Yaki": (5, 17), "Legrand": (7, 23), "AutresSans": (8, 33), "SansMarque": (6, 31)}
    for nom, (bas, haut) in v14.items():
        _, b, h = res["valeurs"].parts[nom]
        assert abs(_entier(b) - bas) <= 1 and abs(_entier(h) - haut) <= 1, nom
    for nom, (bas, haut) in {"Europe": (33, 57), "Asie": (14, 37), "NonVerifiee": (19, 44)}.items():
        _, b, h = res["valeurs_origine"].parts[nom]
        assert abs(_entier(b) - bas) <= 1 and abs(_entier(h) - haut) <= 1, nom
    # Points centraux : commentaire de N08_A_RAPPORT_427.sps:243-244
    assert {k: round(v[0], 1) for k, v in res["valeurs"].parts.items() if k in ("Schneider", "Chint", "Legrand", "Yaki")} == {
        "Schneider": 22.8, "Chint": 22.6, "Legrand": 13.7, "Yaki": 10.0}
    assert round(res["valeurs_origine"].parts["Europe"][0], 1) == 44.4
    t9 = next(e for e in rap.elements if isinstance(e, TableauRapport) and e.numero == "9")
    cellules = " ".join(resoudre(c, res) for li in t9.contenu for c in li)
    for extrait in ("Grossistes spécialisés (34,4 %) ; quincailleries (18,0 %)", "Marchés (19,2 %) ; magasins spécialisés (8,9 %) ; en ligne (1,2 %)",
                    "Importateurs (18,3 %), dont 38,2 % des entreprises", "sans marque fixe (12,1 %), Philips (3,7 %)"):
        assert extrait in cellules, extrait
    t10 = next(e for e in rap.elements if isinstance(e, TableauRapport) and e.numero == "10")
    cellules = " ".join(resoudre(c, res) for li in t10.contenu for c in li)
    for extrait in ("Contact en personne (60,9 %) et WhatsApp (19,9 %)", "premier levier de fidélité (34,9 %)", "levier des entreprises (53,7 %)",
                    "Contrefaçon : 57,7 % des acheteurs de marques européennes", "(63,1 % plusieurs fois)", "(67,4 % achètent Schneider ou Legrand)"):
        assert extrait in cellules, extrait
    texte = " ".join(_textes(rap))
    for extrait in (
        "À Douala, Yaki (38,7 %) et Schneider (34,5 %) se partagent le marché. À Yaoundé, Schneider (37,0 %) et Legrand (24,4 %)",
        "les marques chinoises arrivent en tête (36,2 %), devant Schneider (20,2 %)", "n'a pas de marque fixe (17,0 %)",
        "achètent Schneider ou Legrand à 67,4 %. Chint réunit 32,8 %", "des revendeurs (29,3 % d'entre eux)",
        "Le premier axe, qui porte 69,3 % de l'information", "le second (30,7 %)",
        "3,4 fois plus que le profil de l'acheteur (inertie de 0,39 contre 0,12)",
        "Son premier axe (56,5 % de l'information)", "Schneider (44,2 % des électriciens) et Legrand (23,3 %)",
        "Yaki (29,3 % des revendeurs) et Chint (23,8 % des particuliers)",
        "dans le nombre d'acheteurs (5,9 %)", "Schneider 31,5 % des acheteurs", "Legrand 13,2 % des acheteurs",
        "représentent 12,1 % des acheteurs", "les marques européennes pèsent 51,3 % des acheteurs", "les marques asiatiques 17,5 %",
        "sans marque fixe 31,3 %", "(base : 286 acheteurs",
        "paiement en espèces (82,2 %)", "Le Mobile Money (8,5 %) et le virement (7,1 %)", "entreprises (22,2 % et 7,4 %)",
        "Mobile Money (13,0 %) et le virement (16,0 %)", "ne concerne que 2,1 % des acheteurs",
        "40,3 % des répondants n'ont pas de préférence", "l'Europe (30,6 %) et l'Asie (28,4 %)",
        "Yaoundé est pro-européenne (45,9 %), Bafoussam pro-asiatique (50,0 %) et Douala indifférente (52,8 % sans préférence)",
        "par 46,3 % d'entre eux et l'Asie meilleure en prix par 58,7 %", "(26,0 % et 25,7 %)",
        "(Europe 62,6 % en qualité, Asie 79,0 % en prix) et 41,6 %",
        "57,7 % de leurs acheteurs craignent souvent", "contre 28,8 % pour les marques asiatiques",
        "une niche (20,8 % des acheteurs) mais concerne 40,0 % des entreprises",
    ):
        assert extrait in texte, extrait


def test_partie_3b4_et_3c_v14(rapport: Any) -> None:
    """Nouveau distributeur, effet enquêteur, achat en ligne (V14 p. 48-51) et environnement (p. 52-53)."""
    rap = rapport[0]
    res = rap.resultats()
    # Effectifs des graphiques natifs Word de V14 (word/charts/chart55 à 68)
    assert [round(li.effectif) for li in res["g48"].lignes] == [97, 176, 125]
    assert [round(li.effectif) for li in res["g49"].lignes] == [70, 119, 87, 60, 2, 75]
    assert [round(li.effectif) for li in res["g50"].lignes] == [175, 173, 27, 32]
    assert [round(li.effectif) for li in res["g51"].frequences["PRIOPRIN"].lignes] == [52, 300, 67]
    assert [round(li.effectif) for li in res["g51"].frequences["ORINFACH"].lignes] == [83, 119, 77, 144]
    assert [round(li.effectif) for li in res["g52"].frequences["ORIGPRIV"].lignes] == [129, 120, 3, 170]
    assert [round(li.effectif) for li in res["g53"].lignes] == [76, 139, 43, 81, 72, 8]
    assert [round(li.effectif) for li in res["g54"].lignes] == [228, 76, 38, 9, 16]
    assert [round(li.effectif) for li in res["g55"].lignes] == [251, 73, 82, 3, 3]
    assert [round(li.effectif) for li in res["g56"].lignes] == [113, 274]
    assert [round(li.effectif) for li in res["g57"].frequences["PRETACLI"].lignes] == [81, 110, 186]
    assert [round(li.effectif) for li in res["g57"].frequences["PRFRACLI"].lignes] == [127, 124, 51, 24, 21]
    # Régression logistique : repères de N08_A_RAPPORT_427.sps:312-314 (Exp(B), IC 95 %, Nagelkerke ,225, Hosmer-Lemeshow ,004)
    lg = res["achat_ligne"]
    assert {k: tuple(round(x, 2) for x in lg.coefficients[k][:3]) for k in ("SAV_TRESIMP", "MONT_100K", "VILLEREG_3")} == {
        "SAV_TRESIMP": (3.54, 1.86, 6.74), "MONT_100K": (2.41, 1.17, 4.95), "VILLEREG_3": (0.23, 0.09, 0.61)}
    assert (lg.base, round(lg.r2_nagelkerke, 3), lg.hosmer_lemeshow[1], round(lg.hosmer_lemeshow[2], 3)) == (295, 0.225, 8, 0.004)
    # Effet enquêteur à Douala : repères de N08_A_RAPPORT_427.sps:282-283 (ENQ1 n = 60, autres n = 93)
    assert [sum(res["enq_garantie"].effectifs[i][j] for i in range(2)) for j in range(2)] == [60, 93]
    texte = " ".join(_textes(rap))
    for extrait in (
        "68,6 % des répondants paieraient (oui) ou pourraient payer (peut-être) plus cher", "et 28,1 % changent régulièrement de fournisseur",
        "le prix (28,8 %), la largeur du choix (21,1 %), la confiance (18,2 %), la proximité (16,9 %) et la disponibilité (14,5 %)",
        "garantie de 6 mois à 1 an (42,5 %) ou de moins de 6 mois (43,0 %) ; seuls 14,5 %",
        "(V = 0,39, p < 0,001) : 74,3 % des acheteurs de Bafoussam", "67,3 % de ceux de Yaoundé", "(37,3 % moins de 6 mois, 32,0 % plus d'un an)",
        "65,0 % de ses fiches demandent plus d'un an, contre 10,8 %", "chez qui 57,0 % se contentent", "Kruskal-Wallis p = 0,006",
        "(53,1 %), les électriciens attendent davantage (50,0 % entre 6 mois et 1 an, 22,0 % plus d'un an)",
        "(60 fiches retenues à Douala) obtient 65,0 % de demandes de garantie de plus d'un an et 34,0 % de SAV",
        "contre 10,8 % et 13,1 % pour les autres enquêteurs de Douala (Yaoundé : 0,6 %",
        "de 47,8 % des répondants ; elle n'influence pas du tout 34,0 % d'entre eux, et 51,9 % à Douala",
        "grossiste spécialisé (33,2 %), devant le marché (19,3 %), la quincaillerie (18,1 %) et l'importateur (17,2 %). 83,8 %",
        "n'est préféré que par 1,9 %", "la quincaillerie (38,1 %) et attendent davantage de conseil technique (26,3 %)",
        "vers le grossiste (44,4 %) et le marché (23,5 %)", "(23,7 % ne le sont jamais)", "(42,0 % refusent)", "les pièces (15,2 %)",
        "sur la confiance (36,5 %), les particuliers et les électriciens plus souvent sur la proximité (22,8 % et 24,5 %)",
        "(V = 0,26, p < 0,001), le service attendu (p = 0,014), la disposition à payer le SAV (p = 0,007) et la fidélité (p = 0,003)",
        "critère de choix du canal (p = 0,002)",
        "garantie avec remplacement (62,1 %), le conseil technique (20,7 %) et la réparation ou la fourniture de pièces (10,4 %)",
        "en personne (60,9 %), par WhatsApp (19,9 %) ou par téléphone (17,7 %)", "à Douala (30,1 %) et par les entreprises (28,0 %)",
        "29,2 % des répondants ont déjà acheté", "65,0 % sont prêts à recommencer, contre 5,1 %",
        "21,5 % des répondants sont prêts à acheter en ligne et 29,2 % hésitent", "conformité (36,6 %)", "voir le produit (35,7 %)",
        "Une régression logistique (295 fiches complètes)", "multiplie par 3,5 les chances d'une intention ferme (intervalle de 1,9 à 6,7)",
        "ou plus par 2,4 (1,2 à 4,9)", "par rapport à Douala (0,23 ; 0,09 à 0,61)", "(R² de Nagelkerke = 0,23)", "(test de Hosmer-Lemeshow, p = 0,004)",
        "Douala (25,9 %), la livraison à Bafoussam (15,2 %)",
        "80,0 % des acheteurs ont déjà été déçus et 80,5 % craignent la contrefaçon", "(40,0 % des entreprises)",
        "(19,9 %, 30,1 % à Douala)", "en espèces (82,2 %), la prime acceptée pour la qualité est faible (+5 % en médiane) et 83,8 %",
        "Yaoundé (65,4 % de clients fidèles)", "Douala (33,1 % jamais fidèles)",
    ):
        assert extrait in texte, extrait


def test_annexe_2_typologie_v14(rapport: Any) -> None:
    """Tableau A2 (V14 p. 65) : groupes TwoStep enregistrés (SEG_TS), relus dans le .sav livré par N° de fiche (D-046)."""
    from plateforme.analyse.rapport.modele import TableauRapport

    rap = rapport[0]
    res = rap.resultats()
    assert [round(li.effectif) for li in res["typo"].lignes] == [68, 106, 89, 98] and res["typo"].base == 361
    a2 = next(e for e in rap.elements if isinstance(e, TableauRapport) and e.numero == "A2")
    lignes = [[resoudre(c, res) for c in li] for li in a2.contenu[1:]]
    assert [li[1] for li in lignes] == ["68", "106", "89", "98"]
    assert [li[3] for li in lignes] == ["+3,6 %", "+11,4 %", "+6,5 %", "+8,4 %"]
    assert [li[4] for li in lignes] == ["3 mois", "9 mois", "3 mois", "3 mois"]
    for extrait in ("Prix, premier critère (79 %) ; bas de gamme (46 %) ; « le moins cher » (54 %)",
                    "SAV très important (75 %) ; marque très importante (66 %)", "(9 % à Bafoussam)",
                    "Moyenne gamme (66 %) ; rapport qualité/prix (94 %) ; crainte « parfois » (90 %)",
                    "Crainte « souvent » (82 %)", "achats hebdomadaires (43 %)", "Yaki sur-représentée (24 %)"):
        assert extrait in " ".join(li[2] for li in lignes), extrait
    # Écarts expliqués : V14 arrondit deux fois (au dixième, puis à l'unité). Toujours fidèles, groupe 2 : 45 / 106 =
    # 42,45 % → 42 (V14 : 42,5 → 43) ; moyenne gamme, groupe 4 : 72 / 98 = 73,47 % → 73 (V14 : 73,5 → 74).
    assert "toujours fidèles (42 %)" in lignes[1][2] and "moyenne gamme (73 %)" in lignes[3][2]
    assert round(res["typo_fidelite"].pct_colonne[0][1], 2) == 42.45 and round(res["typo_gamme"].pct_colonne[1][3], 2) == 73.47
