"""Diagnostic formulaire ↔ dictionnaire (`diagnostiquer` + `verifierFormulaire` de V11).

Compare un plan de formulaire (généré, ou relu depuis l'outil de collecte) au dictionnaire :
questions absentes, types, modalités inconnues (qui seraient codées 99), lignes de grille,
option « Autre », caractère obligatoire, éléments hors dictionnaire. Puis cherche un
CHEMIN qui mènerait à l'envoi sans passer par la question de cible (cas réel du 06/10 :
4 fiches envoyées avec l'identification seule).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from plateforme.dictionnaire.modele import Dictionnaire, Question, TypeQuestion
from plateforme.generateurs.formulaire import ENVOI, SUIVANTE, TITRE_LANGUE, Element, PlanFormulaire
from plateforme.noyau.textes import cle, normaliser, numero_question

OK, ALERTE, BLOCAGE = "✔", "⚠", "✘"
TYPES_ATTENDUS = {TypeQuestion.CHOIX_UNIQUE: {"radio", "liste"}, TypeQuestion.CHOIX_MULTIPLE: {"cases"},
                  TypeQuestion.GRILLE: {"grille"}, TypeQuestion.TEXTE: {"texte_court", "texte_long"},
                  TypeQuestion.NUMERIQUE: {"texte_court"}, TypeQuestion.DATE: {"texte_court"}}


@dataclass
class LigneDiagnostic:
    element: str
    statut: str
    detail: str


@dataclass
class Diagnostic:
    lignes: list[LigneDiagnostic] = field(default_factory=list)
    chemin_sans_cible: list[str] | None = None

    @property
    def blocages(self) -> int:
        return sum(1 for li in self.lignes if li.statut == BLOCAGE)

    @property
    def alertes(self) -> int:
        return sum(1 for li in self.lignes if li.statut == ALERTE)

    def verdict(self) -> str:
        if self.blocages:
            return f"{BLOCAGE} {self.blocages} blocage(s), {self.alertes} alerte(s) : corriger avant le terrain"
        return f"{OK} Codification possible — {self.alertes} alerte(s) à lire"


def _langue_element(dico: Dictionnaire, q: Question, e: Element, prises: set[str]) -> str | None:
    """Langue d'un élément : titre identique d'abord (« Âge » ≠ « Age »), puis même clé, parmi les langues non prises."""
    libres = [lg for lg in dico.langues if lg not in prises]
    for lg in libres:
        if normaliser(e.titre) == normaliser(dico.titre_question(q, lg)):
            return lg
    for lg in libres:
        if cle(e.titre) == cle(dico.titre_question(q, lg)):
            return lg
    return None


def _verifier_question(dico: Dictionnaire, q: Question, e: Element, langue: str) -> LigneDiagnostic:
    statut, msgs = OK, []

    def degrader(s: str) -> None:
        nonlocal statut
        if s == BLOCAGE or statut == OK:
            statut = s

    if e.type not in TYPES_ATTENDUS[q.type]:
        degrader(BLOCAGE)
        msgs.append(f"type « {e.type} » au lieu de « {q.type.value} »")
    attendus = [dico.texte(m.libelles, langue) for m in q.modalites]
    acceptes = {cle(x) for x in attendus} | {cle(a) for m in q.modalites for a in m.alias}
    inconnues = [o.valeur for o in e.options if cle(o.valeur) not in acceptes]
    presentes = {cle(o.valeur) for o in e.options}
    manquantes = [x for x in attendus if cle(x) not in presentes]
    if inconnues:
        degrader(BLOCAGE)
        msgs.append("modalités inconnues du dictionnaire (codées 99) : " + " ; ".join(inconnues))
    if manquantes:
        degrader(ALERTE)
        msgs.append("modalités du dictionnaire absentes du formulaire : " + " ; ".join(manquantes))
    if q.type is TypeQuestion.GRILLE:
        lignes_form = {cle(x) for x in e.lignes}
        absentes = [dico.texte(li.libelles, langue) for li in q.lignes if cle(dico.texte(li.libelles, langue)) not in lignes_form]
        if absentes:
            degrader(BLOCAGE)
            msgs.append("lignes de grille introuvables : " + " ; ".join(absentes))
    if q.autre and not e.autre:
        degrader(ALERTE)
        msgs.append(f"option « Autre » désactivée : {q.autre.variable} restera vide")
    if q.role == "cible" and not e.obligatoire:
        degrader(BLOCAGE)
        msgs.append("question de cible FACULTATIVE : des fiches pourraient être envoyées sans elle")
    elif q.obligatoire and not e.obligatoire:
        degrader(ALERTE)
        msgs.append("facultative : une question sautée sera codée 99")
    return LigneDiagnostic(e.titre, statut, " | ".join(msgs) or "Conforme")


def _chemin_sans_cible(plan: PlanFormulaire, ids_cible: set[str]) -> list[str] | None:
    """Recherche en profondeur d'un chemin page 1 → ENVOI qui ne traverse aucune page contenant la cible obligatoire."""
    index = {p.id: i for i, p in enumerate(plan.pages)}

    def suivante(i: int) -> int | str:
        return i + 1 if i + 1 < len(plan.pages) else ENVOI

    def destination(i: int, nav: str | None) -> int | str:
        if nav in (None, SUIVANTE):
            return suivante(i)
        if nav == ENVOI:
            return ENVOI
        return index.get(nav, suivante(i))

    def sorties(i: int) -> list[int | str]:
        p, out, impose = plan.pages[i], [], False
        for e in p.elements:
            if e.type not in ("radio", "liste") or not any(o.navigation for o in e.options):
                continue
            out += [destination(i, o.navigation) for o in e.options]
            impose = impose or e.obligatoire        # question obligatoire avec aiguillage : la fin de page ne s'applique pas
        if not impose:
            out.append(destination(i, p.fin))
        return out

    vues: set[int] = set()

    def explorer(i: int | str, chemin: list[str]) -> list[str] | None:
        if i == ENVOI:
            return [*chemin, "ENVOI"]
        assert isinstance(i, int)
        p = plan.pages[i]
        if i in vues or any(e.id in ids_cible and e.obligatoire for e in p.elements):
            return None
        vues.add(i)
        for d in sorties(i):
            trouve = explorer(d, [*chemin, p.titre or p.id])
            if trouve:
                return trouve
        return None

    return explorer(0, [])


def diagnostiquer(dico: Dictionnaire, plan: PlanFormulaire) -> Diagnostic:
    diag = Diagnostic()
    elements = [e for p in plan.pages for e in p.elements]
    reconnus: set[str] = set()
    for d in dico.identification:
        cles = {cle(t) for t in d.libelles.values()}
        e = next((x for x in elements if numero_question(x.titre) is None and cle(x.titre) in cles), None)
        if e is None:
            critique = d.role.value == "enqueteur"
            diag.lignes.append(LigneDiagnostic(dico.texte(d.libelles), BLOCAGE if critique else ALERTE, "Absente du formulaire"))
            continue
        reconnus.add(e.id)
        statut = ALERTE if d.obligatoire and not e.obligatoire else OK
        diag.lignes.append(LigneDiagnostic(e.titre, statut, "Obligatoire" if e.obligatoire else "Facultative"))

    ids_cible: set[str] = set()
    for q in dico.questions:
        occurrences = [e for e in elements if numero_question(e.titre) == q.numero]
        par_langue: dict[str, Element] = {}
        for e in occurrences:
            lg = _langue_element(dico, q, e, set(par_langue)) \
                or (dico.langue_reference if dico.langue_reference not in par_langue else None)
            if lg is None or lg in par_langue:
                diag.lignes.append(LigneDiagnostic(e.titre, ALERTE, f"numéro Q{q.numero} en double : non codé"))
                continue
            par_langue[lg] = e
        if dico.langue_reference not in par_langue:
            diag.lignes.append(LigneDiagnostic(dico.titre_question(q), BLOCAGE, "question absente : la variable sera toujours vide (99)"))
        for lg, e in par_langue.items():
            reconnus.add(e.id)
            if q.role == "cible":
                ids_cible.add(e.id)
            diag.lignes.append(_verifier_question(dico, q, e, lg))
        for lg in dico.langues:
            if lg not in par_langue and lg != dico.langue_reference:
                diag.lignes.append(LigneDiagnostic(dico.titre_question(q, lg), ALERTE, f"version « {lg} » absente"))

    for e in elements:
        if e.id in reconnus or e.type == "section" or cle(e.titre) == cle(TITRE_LANGUE):
            continue
        diag.lignes.append(LigneDiagnostic(e.titre, ALERTE, "élément hors dictionnaire : non codé, non exporté"))

    if dico.question_cible() is not None:
        diag.chemin_sans_cible = _chemin_sans_cible(plan, ids_cible)
        if diag.chemin_sans_cible:
            diag.lignes.append(LigneDiagnostic("Chemin d'envoi", BLOCAGE, "une fiche peut être envoyée SANS la question de cible : "
                                               + " → ".join(diag.chemin_sans_cible)))
        else:
            diag.lignes.append(LigneDiagnostic("Chemin d'envoi", OK, "aucun chemin ne contourne la question de cible"))
    return diag
