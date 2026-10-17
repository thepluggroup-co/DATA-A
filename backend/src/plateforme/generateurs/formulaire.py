"""Formulaire de collecte généré depuis le dictionnaire.

1. `plan_formulaire` : structure NEUTRE (pages, éléments, options, aiguillages), indépendante
   de l'outil de collecte. Elle reproduit le formulaire bilingue de V11 :
       page 1 : identification + « Langue du questionnaire » (Français → page FR, English → page EN)
       page FR : questionnaire dans la langue de référence ; fin de page → ENVOI
       page EN : même questionnaire traduit ; fin du formulaire → envoi
   Le diagnostic (dictionnaire/diagnostic.py) travaille sur cette structure.
2. `requetes_google_forms` : traduction du plan en requêtes `forms.batchUpdate` de l'API REST
   Google Forms v1 (champs vérifiés dans la référence officielle le 17/10/2026 :
   createItem{item, location.index}, Item.itemId fourni à la création, choiceQuestion
   RADIO/CHECKBOX/DROP_DOWN, Option{value, isOther, goToAction, goToSectionId},
   questionGroupItem.grid, textQuestion.paragraph, pageBreakItem).
   LIMITE CONSTATÉE : `pageBreakItem` n'a aucun champ dans l'API REST ; la navigation de fin
   de page (« fin de la page FR → envoi ») ne peut donc pas être posée par l'API. Elle est
   renvoyée dans `actions_apps_script`, à appliquer par Apps Script (PageBreakItem.setGoToPage).
   Rien n'est envoyé à Google ici : l'envoi réel est une action manuelle confirmée (phase 3).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any

from plateforme.dictionnaire.modele import Dictionnaire, Question, QuestionIdentification, TypeQuestion

ENVOI = "ENVOI"
SUIVANTE = "SUIVANTE"

TITRE_LANGUE = "Langue du questionnaire / Questionnaire language"
AIDE_LANGUE = ("English-speaking respondent: select “English”, then tap Next. — "
               "Répondant francophone : ne rien cocher, toucher Suivant.")
NOMS_LANGUES = {"fr": "Français", "en": "English"}
TITRES_PAGES = {"fr": "Questionnaire en français", "en": "Questionnaire in English"}


@dataclass
class Option:
    valeur: str
    navigation: str | None = None   # None, SUIVANTE, ENVOI, ou id de page


@dataclass
class Element:
    id: str
    titre: str
    type: str                       # radio | cases | liste | grille | texte_court | texte_long | section
    obligatoire: bool = False
    aide: str = ""
    options: list[Option] = field(default_factory=list)
    lignes: list[str] = field(default_factory=list)
    autre: bool = False
    validation: str | None = None


@dataclass
class Page:
    id: str
    titre: str
    elements: list[Element] = field(default_factory=list)
    fin: str = SUIVANTE              # navigation en fin de page : SUIVANTE, ENVOI ou id de page


@dataclass
class PlanFormulaire:
    titre: str
    description: str
    pages: list[Page]


def _id(*parties: str) -> str:
    """Identifiant stable (8 caractères hexadécimaux) : régénérer le plan ne change pas les ids."""
    return hashlib.sha1("|".join(parties).encode("utf-8")).hexdigest()[:8]


def _element_question(dico: Dictionnaire, q: Question, langue: str) -> Element:
    t = dico.texte
    base = Element(id=_id(dico.etude, q.code, langue), titre=dico.titre_question(q, langue), type="",
                   obligatoire=q.obligatoire, aide=t(q.aide, langue) if q.aide else "")
    if q.type is TypeQuestion.CHOIX_UNIQUE:
        base.type, base.autre = "radio", q.autre is not None
        base.options = [Option(t(m.libelles, langue)) for m in q.modalites]
    elif q.type is TypeQuestion.CHOIX_MULTIPLE:
        base.type = "cases"
        base.options = [Option(t(m.libelles, langue)) for m in q.modalites]
    elif q.type is TypeQuestion.GRILLE:
        base.type = "grille"
        base.options = [Option(t(m.libelles, langue)) for m in q.modalites]
        base.lignes = [t(li.libelles, langue) for li in q.lignes]
    else:
        base.type = "texte_long" if q.type is TypeQuestion.TEXTE else "texte_court"
    return base


def _element_identification(dico: Dictionnaire, d: QuestionIdentification, enqueteurs: list[str]) -> Element:
    langue = dico.langue_reference
    e = Element(id=_id(dico.etude, "ident", d.role.value), titre=dico.texte(d.libelles, langue), type="texte_court",
                obligatoire=d.obligatoire, aide=dico.texte(d.aide, langue) if d.aide else "", validation=d.validation)
    if d.role.value == "enqueteur":
        e.type, e.options = "liste", [Option(x) for x in enqueteurs]
    elif d.type is TypeQuestion.CHOIX_UNIQUE:
        e.type, e.options = "radio", [Option(dico.texte(m.libelles, langue)) for m in d.modalites]
    return e


def plan_formulaire(dico: Dictionnaire, enqueteurs: list[str]) -> PlanFormulaire:
    ref = dico.langue_reference
    autres = [lg for lg in dico.langues if lg != ref]
    page1 = Page(id="identification", titre="")
    page1.elements = [_element_identification(dico, d, enqueteurs) for d in dico.identification]
    pages_langues = []
    for langue in [ref, *autres]:
        p = Page(id=f"page_{langue}", titre=TITRES_PAGES.get(langue, langue))
        section_courante = None
        for q in dico.questions:
            if q.section != section_courante:
                section_courante = q.section
                p.elements.append(Element(id=_id(dico.etude, q.section, langue), type="section",
                                          titre=dico.texte(dico.section(q.section).libelles, langue)))
            p.elements.append(_element_question(dico, q, langue))
        pages_langues.append(p)
    if autres:
        page1.elements.append(Element(
            id=_id(dico.etude, "langue"), titre=TITRE_LANGUE, type="radio", obligatoire=False, aide=AIDE_LANGUE,
            options=[Option(NOMS_LANGUES.get(p.id[5:], p.id[5:]), navigation=p.id) for p in pages_langues]))
        for p in pages_langues:
            p.fin = ENVOI                       # chaque langue se termine par l'envoi, sans passer par l'autre
    return PlanFormulaire(titre=dico.texte(dico.titre) or dico.etude, description="", pages=[page1, *pages_langues])


# ---------------------------------------------------------------------------------------------
# Traduction en requêtes de l'API REST Google Forms v1
# ---------------------------------------------------------------------------------------------
@dataclass
class RequetesGoogleForms:
    requetes: list[dict[str, Any]]
    actions_apps_script: list[str]


def _item(e: Element, ids_pages: dict[str, str]) -> dict[str, Any]:
    item: dict[str, Any] = {"itemId": e.id, "title": e.titre}
    if e.aide:
        item["description"] = e.aide
    if e.type == "section":
        item["textItem"] = {}
        return item
    question: dict[str, Any] = {"required": e.obligatoire}
    if e.type in ("radio", "cases", "liste"):
        options: list[dict[str, Any]] = []
        for o in e.options:
            opt: dict[str, Any] = {"value": o.valeur}
            if o.navigation == ENVOI:
                opt["goToAction"] = "SUBMIT_FORM"
            elif o.navigation == SUIVANTE:
                opt["goToAction"] = "NEXT_SECTION"
            elif o.navigation:
                opt["goToSectionId"] = ids_pages[o.navigation]
            options.append(opt)
        if e.autre:
            options.append({"isOther": True})
        question["choiceQuestion"] = {"type": {"radio": "RADIO", "cases": "CHECKBOX", "liste": "DROP_DOWN"}[e.type],
                                      "options": options}
    elif e.type == "grille":
        item["questionGroupItem"] = {
            "questions": [{"required": e.obligatoire, "rowQuestion": {"title": li}} for li in e.lignes],
            "grid": {"columns": {"type": "RADIO", "options": [{"value": o.valeur} for o in e.options]}},
        }
        return item
    else:
        question["textQuestion"] = {"paragraph": e.type == "texte_long"}
    item["questionItem"] = {"question": question}
    return item


def requetes_google_forms(plan: PlanFormulaire) -> RequetesGoogleForms:
    """Requêtes `batchUpdate` qui construisent le formulaire, plus les réglages impossibles par l'API REST."""
    ids_pages = {p.id: _id("page", plan.titre, p.id) for p in plan.pages}
    requetes: list[dict[str, Any]] = [{"updateFormInfo": {"info": {"title": plan.titre, "description": plan.description},
                                                          "updateMask": "title,description"}}]
    actions: list[str] = []
    index = 0
    for i, p in enumerate(plan.pages):
        if i > 0:
            requetes.append({"createItem": {"item": {"itemId": ids_pages[p.id], "title": p.titre, "pageBreakItem": {}},
                                            "location": {"index": index}}})
            index += 1
        for e in p.elements:
            requetes.append({"createItem": {"item": _item(e, ids_pages), "location": {"index": index}}})
            index += 1
            if e.validation:
                actions.append(f"Validation de réponse « {e.validation} » sur « {e.titre} » "
                               "(non générée par l'adaptateur REST : support par l'API non vérifié)")
        if p.fin != SUIVANTE and i + 1 < len(plan.pages):
            cible = "SUBMIT" if p.fin == ENVOI else f"la page « {p.fin} »"
            actions.append(f"Fin de la page « {p.titre or p.id} » → {cible} : PageBreakItem.setGoToPage sur le saut de page "
                           f"suivant (id {ids_pages[plan.pages[i + 1].id]})")
    return RequetesGoogleForms(requetes, actions)
