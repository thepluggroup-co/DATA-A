"""Codage d'un lot de réponses avec les décisions du superviseur : même chemin pour la ligne de commande et l'API."""

from __future__ import annotations

from typing import Any

from plateforme.codification.fiche import FicheCodee, ParametresCodification
from plateforme.codification.rejeu import DecisionQC, recoder
from plateforme.codification.reponses import ReponseBrute
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.terrain.plan import PlanTerrain


class DecisionsInconnues(ValueError):
    """Le fichier de décisions cite des fiches absentes du tableur."""


def parametres(terrain: PlanTerrain) -> ParametresCodification:
    return ParametresCodification(villes=terrain.villes_masque(), enqueteurs={e.id: e.ville or "" for e in terrain.enqueteurs},
                                  seuil_delai_min=terrain.seuil_delai_min, fuseau=terrain.fuseau)


def coder(dico: Dictionnaire, terrain: PlanTerrain, reponses: list[ReponseBrute],
          brutes: dict[str, dict[str, Any]] | None = None) -> tuple[list[FicheCodee], dict[str, DecisionQC]]:
    """Code les réponses et applique les décisions `{identifiant de réponse ou N° de fiche: {statut, motif…}}`.

    Les EXCLUE (tests) sont appliquées d'abord : elles changent la numérotation ; les N° des autres décisions
    sont donc lus APRÈS exclusion.
    """
    params = parametres(terrain)
    fiches = recoder(dico, reponses, params)
    if not brutes:
        return fiches, {}
    ids = {r.id for r in reponses}

    def decision(d: dict[str, Any]) -> DecisionQC:
        return DecisionQC(str(d["statut"]), anomalies_vues=str(d.get("anomalies_vues", "")), motif=str(d.get("motif", "")))

    decisions = {k: decision(d) for k, d in brutes.items() if k in ids}
    fiches = recoder(dico, reponses, params, decisions=decisions)
    par_num = {f.numfiche: f.id_reponse for f in fiches}
    inconnus = sorted(k for k in brutes if k not in ids and k not in par_num)
    if inconnus:
        raise DecisionsInconnues("fiches inconnues dans les décisions : " + ", ".join(inconnus))
    decisions |= {par_num[k]: decision(d) for k, d in brutes.items() if k in par_num}
    return recoder(dico, reponses, params, decisions=decisions), decisions
