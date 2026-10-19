"""Contrôles bloquants du rapport : un rapport conforme passe ; chaque défaut vécu sur le terrain est refusé."""

from __future__ import annotations

import copy

import pandas as pd
import pytest

from plateforme.analyse.donnees import JeuDonnees, Variable
from plateforme.analyse.procedures import frequences, moyennes, reponses_multiples
from plateforme.analyse.rapport.controles import bloquantes, controler
from plateforme.analyse.rapport.modele import Figure, Paragraphe, Rapport, ReferenceInvalide, TableauRapport, Titre, nombre_fr, resoudre

INTERDITS = ["boissons", "Garoua", "peinture"]


@pytest.fixture
def jd() -> JeuDonnees:
    table = pd.DataFrame({"VILLE": [1, 1, 1, 2, 2, 3, 3, 3, 3, 3], "MARQ": [1, 1, 2, 2, 2, 1, 3, 99, 1, 2],
                          "MONT": [10.0, 20, 30, 40, 50, 60, 70, 80, 90, 100], "SOL": [1, 0, 0, 1, 0, 0, 0, 1, 0, 1]})
    return JeuDonnees(table, {"VILLE": Variable("VILLE", "Ville", {1.0: "Douala", 2.0: "Yaoundé", 3.0: "Bafoussam"}),
                              "MARQ": Variable("MARQ", "Marque", {1.0: "Schneider", 2.0: "Legrand", 3.0: "Chint"}, {99.0}),
                              "MONT": Variable("MONT", mesure="scale"), "SOL": Variable("SOL", "Solaire")})


@pytest.fixture
def rapport(jd: JeuDonnees) -> Rapport:
    marques = frequences(jd, "MARQ")
    return Rapport("Distribution du matériel électrique", "EDM", "Base : 10 fiches retenues.", [
        Titre(1, "Résultats"),
        TableauRapport("1", "Répartition par ville", "villes", frequences(jd, "VILLE"), "plan d'analyse : V4:253", "Base : 10 fiches."),
        TableauRapport("2", "Marque achetée le plus souvent", "marques", marques, "V4:375", "Base : 9 répondants (1 non-réponse)."),
        TableauRapport("2 bis", "Marque, profils égaux", "marques_bis", None, "R427:77", ""),
        Figure("1", "Montant moyen", "montant", moyennes(jd, "MONT"), "N05:220", "Base : 10 fiches.", legende="En FCFA."),
        Paragraphe("Schneider est citée par [[marques.pct(1)]] % des [[marques.base]] répondants (tableau 2), "
                   "le solaire par [[solaire.pct(SOL)]] % (question Q9, base de [[lit:2026]])."),
        TableauRapport("3", "Produits achetés", "solaire", reponses_multiples(jd, ["SOL"]), "V4:345", "Base : 4 fiches."),
        Titre(1, "Conclusions", role="conclusions"),
        Paragraphe("Le marché est dominé par deux marques européennes (voir tableau 2 bis)."),
        Titre(1, "Recommandations", role="recommandations"),
        Paragraphe("Nous recommandons de renforcer le service après-vente."),
    ])


def test_rapport_conforme(rapport: Rapport, jd: JeuDonnees) -> None:
    assert controler(rapport, jd, INTERDITS) == []
    texte = resoudre(rapport.elements[5].texte, rapport.resultats())        # type: ignore[union-attr]
    assert texte.startswith("Schneider est citée par 44,4 % des 9 répondants (tableau 2), le solaire par 100,0 %")
    assert texte.endswith("base de 2026).")


def _codes(rapport: Rapport, jd: JeuDonnees) -> set[str]:
    return {a.code for a in bloquantes(controler(rapport, jd, INTERDITS))}


def _modifier(rapport: Rapport, i: int, **champs: object) -> Rapport:
    r = copy.deepcopy(rapport)
    for k, v in champs.items():
        setattr(r.elements[i], k, v)
    return r


@pytest.mark.parametrize(("i", "champs", "code"), [
    (2, {"numero": "1"}, "NUMERO_DOUBLE"),
    (6, {"numero": "4"}, "NUMERO_MANQUANT"),
    (3, {"numero": "3 bis"}, "NUMERO_DESORDRE"),
    (2, {"source": ""}, "SOURCE_MANQUANTE"),
    (2, {"titre": " "}, "LEGENDE_MANQUANTE"),
    (2, {"note_base": ""}, "BASE_MANQUANTE"),
    (2, {"note_base": "Base : 10 répondants."}, "BASE_DIFFERENTE"),
    (5, {"texte": "Schneider est citée par 44,4 % des répondants."}, "CHIFFRE_SANS_LIEN"),
    (5, {"texte": "Schneider : [[marques.pct(7)]] %."}, "REFERENCE_INVALIDE"),
    (5, {"texte": "Voir [[inconnu.base]]."}, "REFERENCE_INVALIDE"),
    (5, {"texte": "Comme pour les boissons, la marque compte."}, "TERME_ETRANGER"),
    (5, {"texte": "À Garoua aussi."}, "TERME_ETRANGER"),
    (5, {"texte": "Le marchÃ© est dominÃ©."}, "ENCODAGE"),
    (8, {"texte": "Voir le tableau 12."}, "RENVOI_INEXISTANT"),
    (9, {"role": ""}, "SECTIONS_CONCLUSIONS"),
])
def test_defauts_refuses(rapport: Rapport, jd: JeuDonnees, i: int, champs: dict[str, object], code: str) -> None:
    assert code in _codes(_modifier(rapport, i, **champs), jd)


def test_total_faux_refuse(rapport: Rapport, jd: JeuDonnees) -> None:
    r = copy.deepcopy(rapport)
    marques = r.elements[2].resultat                                               # type: ignore[union-attr]
    marques.lignes[0].effectif += 1                                                # type: ignore[union-attr]
    assert "TOTAL_DIFFERENT" in _codes(r, jd)


def test_base_du_rapport_differente_de_la_base_d_analyse(rapport: Rapport, jd: JeuDonnees) -> None:
    autre = jd.filtrer(jd.valides("VILLE") != 3, "sans Bafoussam")
    assert "BASE_DIFFERENTE" in _codes(rapport, autre), "un tableau calculé sur une autre base que celle du .sav est refusé"


def test_recommandation_dans_les_conclusions_signalee_sans_bloquer(rapport: Rapport, jd: JeuDonnees) -> None:
    r = _modifier(rapport, 8, texte="Il faudrait baisser les prix.")
    anomalies = controler(r, jd, INTERDITS)
    assert [a.code for a in anomalies] == ["RECOMMANDATION_DANS_CONCLUSIONS"] and not bloquantes(anomalies)


def test_chiffres_admis_hors_reference(rapport: Rapport, jd: JeuDonnees) -> None:
    r = _modifier(rapport, 5, texte="Les tableaux 1 et 2, la question Q12, la partie III.B.2, ENQ10 et M2B Conseils ne sont pas des chiffres d'enquête.")
    assert controler(r, jd, INTERDITS) == []
    r = _modifier(rapport, 5, texte="M2B a interrogé 427 acheteurs.")
    assert [a.code for a in controler(r, jd, INTERDITS)] == ["CHIFFRE_SANS_LIEN"], "le nom propre est admis, pas le chiffre"


def test_nombres_a_la_francaise() -> None:
    assert nombre_fr(3250000, 0) == "3 250 000"
    assert nombre_fr(31.25, 1) == "31,3", "demi vers le haut, comme SPSS et le rapport livré"
    with pytest.raises(ReferenceInvalide):
        nombre_fr(float("nan"))
