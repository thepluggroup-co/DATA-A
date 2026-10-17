"""Formulaire généré, requêtes Google Forms et diagnostic (dont la recherche d'un envoi sans Q1)."""

from __future__ import annotations

import copy

import pytest

from plateforme.dictionnaire.diagnostic import BLOCAGE, diagnostiquer
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.generateurs.formulaire import ENVOI, Element, Option, PlanFormulaire, plan_formulaire, requetes_google_forms
from plateforme.terrain.plan import PlanTerrain


@pytest.fixture
def plan(dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> PlanFormulaire:
    return plan_formulaire(dico_edm, [e.id for e in terrain_edm.enqueteurs])


def _element(plan: PlanFormulaire, page: str, debut_titre: str) -> Element:
    p = next(p for p in plan.pages if p.id == page)
    return next(e for e in p.elements if e.titre.startswith(debut_titre))


def test_structure_bilingue_comme_v11(plan: PlanFormulaire) -> None:
    assert [p.id for p in plan.pages] == ["identification", "page_fr", "page_en"]
    assert [p.fin for p in plan.pages[1:]] == [ENVOI, ENVOI]
    langue = plan.pages[0].elements[-1]
    assert langue.titre == "Langue du questionnaire / Questionnaire language" and not langue.obligatoire
    assert [(o.valeur, o.navigation) for o in langue.options] == [("Français", "page_fr"), ("English", "page_en")]
    assert _element(plan, "page_en", "Q1.").titre == "Q1. You are"
    assert _element(plan, "page_fr", "Q9.").titre == "Q9. Produits achetés (plusieurs réponses)"
    assert _element(plan, "page_fr", "Q12.").autre
    assert [o.valeur for o in _element(plan, "identification", "Identifiant").options][:3] == ["ENQ1", "ENQ2", "ENQ3"]


def test_formulaire_genere_sans_blocage(dico_edm: Dictionnaire, plan: PlanFormulaire) -> None:
    diag = diagnostiquer(dico_edm, plan)
    assert diag.blocages == 0, [li for li in diag.lignes if li.statut == BLOCAGE]
    assert diag.alertes == 0, [li for li in diag.lignes if li.statut != "✔"]   # ex. « Âge » / « Age » pris pour un doublon
    assert diag.chemin_sans_cible is None


def test_chemin_envoi_sans_q1_detecte(dico_edm: Dictionnaire, plan: PlanFormulaire) -> None:
    """Cas réel du 06/10 : une option qui mène directement à l'envoi permet des fiches sans Q1."""
    p = copy.deepcopy(plan)
    p.pages[0].elements[-1].options[1].navigation = ENVOI
    diag = diagnostiquer(dico_edm, p)
    assert diag.chemin_sans_cible is not None and diag.chemin_sans_cible[-1] == "ENVOI"
    assert diag.blocages >= 1


def test_q1_facultative_detectee(dico_edm: Dictionnaire, plan: PlanFormulaire) -> None:
    p = copy.deepcopy(plan)
    for page in ("page_fr", "page_en"):
        _element(p, page, "Q1.").obligatoire = False
    diag = diagnostiquer(dico_edm, p)
    assert diag.chemin_sans_cible is not None
    assert any("FACULTATIVE" in li.detail for li in diag.lignes)


def test_ecarts_formulaire_dictionnaire(dico_edm: Dictionnaire, plan: PlanFormulaire) -> None:
    p = copy.deepcopy(plan)
    _element(p, "page_fr", "Q12.").options.append(Option("Marque inventée"))
    _element(p, "page_fr", "Q12.").autre = False
    _element(p, "page_fr", "Q3.").type = "cases"
    fr = next(x for x in p.pages if x.id == "page_fr")
    fr.elements = [e for e in fr.elements if not e.titre.startswith("Q40.")]
    fr.elements.append(Element(id="x", titre="Question ajoutée à la main", type="radio"))
    lignes = {li.element: li for li in diagnostiquer(dico_edm, p).lignes}
    assert "Marque inventée" in lignes["Q12. Marque achetée le plus souvent"].detail
    assert "MAACAUTR restera vide" in lignes["Q12. Marque achetée le plus souvent"].detail
    assert lignes["Q3. Âge"].statut == BLOCAGE
    assert lignes["Q40. Fidèle à un même fournisseur"].statut == BLOCAGE
    assert "hors dictionnaire" in lignes["Question ajoutée à la main"].detail


def test_enqueteur_absent_bloquant(dico_edm: Dictionnaire, plan: PlanFormulaire) -> None:
    p = copy.deepcopy(plan)
    p.pages[0].elements = [e for e in p.pages[0].elements if not e.titre.startswith("Identifiant")]
    assert any(li.statut == BLOCAGE and "Absente" in li.detail for li in diagnostiquer(dico_edm, p).lignes)


def test_requetes_google_forms(plan: PlanFormulaire) -> None:
    req = requetes_google_forms(plan)
    creations = [r["createItem"] for r in req.requetes if "createItem" in r]
    assert [c["location"]["index"] for c in creations] == list(range(len(creations)))
    assert len(creations) == sum(len(p.elements) for p in plan.pages) + len(plan.pages) - 1
    ids = [c["item"]["itemId"] for c in creations]
    assert len(ids) == len(set(ids)), "itemId en double"
    sauts = {c["item"]["itemId"] for c in creations if "pageBreakItem" in c["item"]}
    langue = next(c["item"] for c in creations if c["item"]["title"].startswith("Langue du questionnaire"))
    cibles = {o["goToSectionId"] for o in langue["questionItem"]["question"]["choiceQuestion"]["options"]}
    assert cibles <= sauts and len(cibles) == 2
    q12 = next(c["item"] for c in creations if c["item"]["title"] == "Q12. Marque achetée le plus souvent")
    assert q12["questionItem"]["question"]["choiceQuestion"]["options"][-1] == {"isOther": True}
    q23 = next(c["item"] for c in creations if c["item"]["title"].startswith("Q23."))
    assert len(q23["questionGroupItem"]["questions"]) == 3
    assert any("SUBMIT" in a for a in req.actions_apps_script)
    assert requetes_google_forms(plan).requetes == req.requetes, "génération non déterministe"
