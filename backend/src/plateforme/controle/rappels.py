"""Rappels téléphoniques de contrôle tirés au sort (M12), reproductibles et motivés.

Par enquêteur, `n` fiches à rappeler pour confirmer que l'entretien a eu lieu :
- d'abord les fiches à risque, par priorité : copie probable (3) ; délai court ou téléphone en double (2) ;
  ressemblance forte ou fiche à vérifier (1) ;
- au moins une fiche SANS alerte, tirée au hasard, pour que chaque enquêteur soit contrôlé même sans alerte ;
- seules les fiches valides avec un numéro de téléphone sont tirées ; le tirage dépend d'une graine publiée
  avec la liste : il peut être refait à l'identique (traçabilité du contrôle).
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from plateforme.codification.fiche import FicheCodee
from plateforme.codification.qualite import COPIE, SUSPECT
from plateforme.codification.rejeu import HORS_COMPTAGE

COLONNE_TELEPHONE = 9          # position du téléphone dans la ligne CONTACT


@dataclass(frozen=True)
class Rappel:
    numfiche: str
    enqueteur: str
    priorite: int
    motif: str
    telephone: str


def _priorite(f: FicheCodee, doublons: dict[str, int]) -> tuple[int, str]:
    anomalies = str(f.valeurs.get("ANOMALIE") or "")
    if doublons.get(f.id_reponse) == COPIE:
        return 3, "copie probable d'une autre fiche"
    if "DELAI_COURT" in anomalies:
        return 2, "délai court avec la fiche précédente"
    if "TEL_DOUBLON" in anomalies:
        return 2, "téléphone déjà enregistré"
    if doublons.get(f.id_reponse) == SUSPECT:
        return 1, "ressemblance forte avec une autre fiche"
    if f.statut == "A_VERIFIER":
        return 1, "fiche à vérifier (anomalie)"
    return 0, "contrôle aléatoire"


def tirer_rappels(fiches: list[FicheCodee], n_par_enqueteur: int = 3, graine: int = 0,
                  doublons: dict[str, int] | None = None) -> list[Rappel]:
    doublons = doublons or {}
    rnd = random.Random(graine)
    par_enq: dict[str, list[FicheCodee]] = {}
    for f in sorted(fiches, key=lambda x: x.numfiche):
        tel = f.contact[COLONNE_TELEPHONE] if len(f.contact) > COLONNE_TELEPHONE else ""
        if f.statut not in HORS_COMPTAGE and tel.strip():
            par_enq.setdefault(str(f.valeurs.get("CODEENQU")), []).append(f)
    rappels: list[Rappel] = []
    for enq in sorted(par_enq):
        candidates = [(*_priorite(f, doublons), rnd.random(), f) for f in par_enq[enq]]
        candidates.sort(key=lambda c: (-c[0], c[2]))
        alertes = [c for c in candidates if c[0] > 0]
        sans_alerte = [c for c in candidates if c[0] == 0]
        # jusqu'à n − 1 fiches à risque (n si aucune fiche sans alerte), complétées par des fiches sans alerte
        choisis = alertes[:n_par_enqueteur - 1 if sans_alerte else n_par_enqueteur]
        choisis += sans_alerte[:n_par_enqueteur - len(choisis)]
        for prio, motif, _, f in choisis:
            rappels.append(Rappel(f.numfiche, enq, prio, motif, f.contact[COLONNE_TELEPHONE]))
    return rappels
