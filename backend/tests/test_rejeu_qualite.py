"""Recodage rejouable (décisions du superviseur, numéros figés, idempotence) et règles de base d'analyse."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from plateforme.codification.fiche import FicheCodee, ParametresCodification
from plateforme.codification.qualite import (
    AUCUN,
    COPIE,
    SUSPECT,
    ParametresBase,
    base_analyse,
    quasi_doublons,
    taux_remplissage,
    variables_comparaison,
    variables_remplissage,
)
from plateforme.codification.rejeu import EXCLUE, OK, REJETE, DecisionQC, recoder
from plateforme.codification.reponses import ItemReponse, ReponseBrute
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.terrain.plan import PlanTerrain

T0 = datetime(2026, 10, 5, 8, tzinfo=UTC)


def _rep(dico: Dictionnaire, i: int, enq: str, minutes: int, **reponses: str) -> ReponseBrute:
    items = [ItemReponse("Identifiant enquêteur", enq)]
    items += [ItemReponse(dico.titre_question(dico.question(code)), val) for code, val in reponses.items()]
    return ReponseBrute(f"R{i}", T0 + timedelta(minutes=minutes), tuple(items))


@pytest.fixture
def params(terrain_edm: PlanTerrain) -> ParametresCodification:
    return ParametresCodification(villes=terrain_edm.villes_masque(), enqueteurs={e.id: e.ville or "" for e in terrain_edm.enqueteurs})


def test_numeros_figes_et_idempotence(dico_edm: Dictionnaire, params: ParametresCodification) -> None:
    a = _rep(dico_edm, 1, "ENQ1", 0, VOUSETES="Particulier")
    b = _rep(dico_edm, 2, "ENQ1", 30, VOUSETES="Entreprise BTP")
    premier = recoder(dico_edm, [a, b, b], params)                       # b reçue deux fois : codée une fois
    assert [f.numfiche for f in premier] == ["DLA-ENQ1-001", "DLA-ENQ1-002"]
    # Une réponse plus ancienne arrive en retard : les N° déjà attribués ne bougent pas, elle prend le suivant
    tardive = _rep(dico_edm, 3, "ENQ1", -60, VOUSETES="Particulier")
    connus = {f.id_reponse: int(f.numfiche[-3:]) for f in premier}
    second = {f.id_reponse: f.numfiche for f in recoder(dico_edm, [b, tardive, a], params, numeros_connus=connus)}
    assert second == {"R1": "DLA-ENQ1-001", "R2": "DLA-ENQ1-002", "R3": "DLA-ENQ1-003"}


def test_decisions_du_superviseur_survivent(dico_edm: Dictionnaire, params: ParametresCodification) -> None:
    a = _rep(dico_edm, 1, "ENQ1", 0, VOUSETES="Particulier")
    b = _rep(dico_edm, 2, "ENQ1", 2, VOUSETES="Particulier")             # délai de 2 min : DELAI_COURT
    fb = recoder(dico_edm, [a, b], params)[1]
    assert fb.statut == "A_VERIFIER" and "DELAI_COURT" in fb.anomalies
    decisions = {"R1": DecisionQC(REJETE, motif="rappel : entretien non confirmé"),
                 "R2": DecisionQC(OK, anomalies_vues=str(fb.valeurs["ANOMALIE"]))}
    f1, f2 = recoder(dico_edm, [a, b], params, decisions=decisions)
    assert (f1.statut, f1.valeurs["STATUTQC"], f1.contact[-1]) == (REJETE, REJETE, REJETE)
    assert f2.statut == OK
    # Les anomalies changent (règle durcie) : le OK donné sur d'autres anomalies ne vaut plus
    autres = {"R2": DecisionQC(OK, anomalies_vues="DELAI_COURT | TEL_DOUBLON")}
    assert recoder(dico_edm, [a, b], params, decisions=autres)[1].statut == "A_VERIFIER"


def test_reponse_exclue_ni_numerotee_ni_codee(dico_edm: Dictionnaire, params: ParametresCodification) -> None:
    """Réponse de test (pré-test, essai du formulaire) : retirée AVANT la numérotation, sans trou dans les N°."""
    essai = _rep(dico_edm, 0, "ENQ6", -2000, VOUSETES="Particulier")
    vraie = _rep(dico_edm, 1, "ENQ6", 0, VOUSETES="Particulier")
    assert [f.numfiche for f in recoder(dico_edm, [essai, vraie], params)] == ["YDE-ENQ6-001", "YDE-ENQ6-002"]
    fiches = recoder(dico_edm, [essai, vraie], params, decisions={"R0": DecisionQC(EXCLUE, motif="essai du formulaire")})
    assert [(f.id_reponse, f.numfiche) for f in fiches] == [("R1", "YDE-ENQ6-001")]


def _fiche(i: int, ville: int, valeurs: dict[str, object]) -> FicheCodee:
    return FicheCodee(f"F{i}", f"X-{i}", {"CODEZONE": ville, **valeurs}, [], "OK", [])  # type: ignore[dict-item]


def test_quasi_doublons_par_groupes(dico_edm: Dictionnaire) -> None:
    variables = variables_comparaison(dico_edm)
    assert len(variables) == 53 and "VILLEREG" not in variables and "MAACAUTR" not in variables
    base = {v: 1 for v in variables}

    def variante(n: int) -> dict[str, object]:
        return {**base, **{v: 2 for v in variables[:n]}}

    fiches = [_fiche(0, 2, variante(0)), _fiche(1, 2, variante(3)),       # 3 écarts avec 0 : copie
              _fiche(2, 2, {**variante(3), variables[10]: 5}),           # 1 écart avec 1 : même groupe, copie
              _fiche(3, 2, variante(6)),                                  # 3 écarts avec 1, mais relié : copie
              _fiche(4, 1, variante(0)),                                  # autre ville : jamais comparée
              _fiche(5, 2, {**base, **{v: 9 for v in variables[20:30]}})]  # 10 écarts : rien
    etat = quasi_doublons(dico_edm, fiches, ParametresBase())
    assert [etat[f"F{i}"] for i in range(6)] == [SUSPECT, COPIE, COPIE, COPIE, AUCUN, AUCUN]


def test_taux_de_remplissage_et_note_de_base(dico_edm: Dictionnaire) -> None:
    variables = variables_remplissage(dico_edm)
    assert len(variables) == 44 and variables[0] == "ACCRECON"      # comme NB_NR « sur 44 » de la syntaxe V4_1
    pleine = _fiche(1, 1, {v: 1 for v in variables})
    trouee = _fiche(2, 1, {**{v: 1 for v in variables}, **{v: 99 for v in variables[:14]}})
    assert taux_remplissage(dico_edm, pleine) == 100
    assert round(taux_remplissage(dico_edm, trouee), 1) == 68.2
    rejetee = _fiche(3, 1, {v: 1 for v in variables})
    rejetee.statut = REJETE
    retenues, note = base_analyse(dico_edm, [pleine, trouee, rejetee], ParametresBase())
    assert [f.id_reponse for f in retenues] == ["F1"]
    assert note.texte() == ("Base : 3 fiches reçues, dont 1 rejetées par le superviseur, soit 2 fiches valides collectées ; "
                            "1 écartées de l'analyse (remplissage < 70 % : 1) ; 1 fiches retenues pour l'analyse.")
    # Une validation OK du superviseur l'emporte sur la règle automatique
    retenues, _ = base_analyse(dico_edm, [pleine, trouee], ParametresBase(), {"F2": DecisionQC(OK)})
    assert len(retenues) == 2
