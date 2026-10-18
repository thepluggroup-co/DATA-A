"""Données réelles de l'étude EDM (locales, hors Git : reference/prive/) et reconstitution de leur historique.

Sources (masque V11 téléchargé le 09/10/2026) :
- « Form Responses 1 » : 451 réponses brutes du formulaire Google (bilingue) ;
- « MASQUE_DEPOUILLEMENT » : les 446 fiches codées par V11 (N° de fiche, codes, anomalies, statuts) ;
- « FICHES_SUPPRIMEES » : 4 fiches vides du 06/10 numérotées puis retirées (motif « Q1 non renseignée ») ;
- « ENQUETEURS » : identifiant → ville (colonnes A et C seulement ; les noms ne sont pas lus).

Historique reconstitué, sans aucune valeur recopiée du masque dans le codage :
- fiches CODÉES : réponses présentes dans le masque (rapprochées par enquêteur, date et minute) ;
- fiches ANNULÉES : les 4 fiches vides supprimées le 07/10, qui ont consommé un N° et comptent dans les délais
  (incident technique : dans la plateforme elles deviennent ANNULEE, jamais effacées, imputées à personne) ;
- fiches ÉCARTÉES : réponses supprimées du formulaire avant toute numérotation (fiche de test du 03/10).
"""

from __future__ import annotations

import collections
import datetime as dt
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from conftest import REFERENCE

from plateforme.codification.fiche import FicheCodee, ParametresCodification
from plateforme.codification.rejeu import ANNULEE, DecisionQC, recoder
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.imports.reponses_tableur import lire_onglet, lire_reponses
from plateforme.terrain.plan import PlanTerrain

MASQUE_0910 = REFERENCE / "prive" / "donnees" / "EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL__7_.xlsx"
SAV_446 = REFERENCE / "prive" / "sav" / "SPSS_EDM_EE_V6_COLLECTE_446.sav"


def _norm(v: object) -> object:
    if v is None:
        return ""
    if isinstance(v, dt.datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, dt.time):
        return v.strftime("%H:%M")
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


@dataclass
class DonneesReelles:
    fiches: list[FicheCodee]                 # codées + rejetées, ordre chronologique
    masque: list[dict[str, Any]]             # lignes du masque V11, dans l'ordre du masque
    nb_reponses: int
    rejetees: set[str]
    ecartees: list[tuple[object, ...]]
    decisions: dict[str, DecisionQC]


def charger(dico: Dictionnaire, terrain: PlanTerrain, chemin: Path = MASQUE_0910) -> DonneesReelles:
    reps = lire_reponses(lire_onglet(chemin, "Form Responses 1"), dico)
    enq = {str(li[0]).strip().upper(): ("" if li[2] is None else str(li[2]).strip().upper())
           for li in lire_onglet(chemin, "ENQUETEURS")[1:] if li and li[0] and len(str(li[0]).strip()) <= 15
           and " " not in str(li[0]).strip()}
    params = ParametresCodification(villes=terrain.villes_masque(), enqueteurs=enq)
    m = lire_onglet(chemin, "MASQUE_DEPOUILLEMENT")
    codes = list(m[1])
    masque = [dict(zip(codes, map(_norm, li), strict=False)) for li in m[3:] if li and li[0]]
    sup = lire_onglet(chemin, "FICHES_SUPPRIMEES")
    cles_sup = collections.Counter((str(li[3]).upper(), _norm(li[7]), _norm(li[8])) for li in sup[1:] if li and li[2])
    cles_masque = collections.Counter((r["CODEENQU"], r["DATEENQU"], r["HEUREENQ"]) for r in masque)

    codees, rejetees, ecartees = set(), set(), []
    for f in recoder(dico, reps, params):
        k = (f.valeurs["CODEENQU"], f.valeurs["DATEENQU"], f.valeurs["HEUREENQ"])
        if cles_masque[k] > 0:
            cles_masque[k] -= 1
            codees.add(f.id_reponse)
        elif cles_sup[k] > 0:
            cles_sup[k] -= 1
            rejetees.add(f.id_reponse)
        else:
            ecartees.append(k)
    decisions = {i: DecisionQC(ANNULEE, motif="Fiche vide née de la modification du formulaire (FICHES_SUPPRIMEES)") for i in rejetees}
    a_coder = [r for r in reps if r.id in codees | rejetees]
    # Décisions OK du superviseur : fiches du masque marquées OK malgré des anomalies
    par_num = {r["NUMFICHE"]: r for r in masque}
    for f in recoder(dico, a_coder, params, decisions=decisions):
        r = par_num.get(f.numfiche)
        if r and r["STATUTQC"] == "OK" and r["ANOMALIE"]:
            decisions[f.id_reponse] = DecisionQC("OK", anomalies_vues=str(r["ANOMALIE"]))
    fiches = recoder(dico, a_coder, params, decisions=decisions)
    return DonneesReelles(fiches, masque, len(reps), rejetees, ecartees, decisions)
