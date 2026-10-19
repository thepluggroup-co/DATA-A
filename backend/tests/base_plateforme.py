"""Base d'analyse EDM produite par la PLATEFORME (données réelles locales, hors Git) : fiches codées → base 427 →
variables de contrôle → plan d'analyse. Partagée par les tests d'or de la phase 4 (étages 1 et 2)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from conftest import REFERENCE
from donnees_reelles import MASQUE_0910
from donnees_reelles import charger as charger_reel

from plateforme.analyse import plan as plan_analyse
from plateforme.analyse.controle import variables_controle
from plateforme.analyse.derivees import appliquer
from plateforme.analyse.donnees import JeuDonnees
from plateforme.codification.qualite import ParametresBase, base_analyse
from plateforme.codification.rejeu import HORS_COMPTAGE
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.generateurs.masque import colonnes_masque
from plateforme.terrain.plan import PlanTerrain

SAV_427 = REFERENCE / "prive" / "sav" / "SPSS_EDM_EE_V6_ANALYSE_427.sav"
SAV_446 = REFERENCE / "prive" / "sav" / "SPSS_EDM_EE_V6_COLLECTE_446.sav"
PLAN = REFERENCE.parent / "projets" / "edm_cameroun" / "plan_analyse.yaml"
DISPONIBLE = SAV_427.exists() and SAV_446.exists() and MASQUE_0910.exists()


def octets8(x: Any) -> str:
    """Troncature de l'import SPSS de MAACAUTR : 8 OCTETS UTF-8 (« Il achète » → « Il achè », le « è » compte double)."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return ""
    return str(x).rstrip().encode("utf-8")[:8].decode("utf-8", errors="ignore")


@dataclass
class BasesPlateforme:
    plan: plan_analyse.PlanAnalyse
    brut: JeuDonnees          # codes + variables de contrôle, sans dérivées
    complet: JeuDonnees       # dérivées sur le texte complet de MAACAUTR (ce que livre la plateforme)
    tronque: JeuDonnees       # dérivées sur MAACAUTR tronqué comme l'import SPSS (pour la comparaison d'or)
    collecte: JeuDonnees      # toutes les fiches valides (hors REJETE/ANNULEE), dérivées comprises : base de collecte


def construire(dico: Dictionnaire, terrain: PlanTerrain) -> BasesPlateforme:
    r = charger_reel(dico, terrain)
    retenues, _ = base_analyse(dico, r.fiches, ParametresBase(), r.decisions)
    pa = plan_analyse.charger(PLAN)
    controles = variables_controle(dico, r.fiches, terrain.jours, decisions=r.decisions, enqueteurs=[e.id for e in terrain.enqueteurs])
    colonnes = colonnes_masque(dico, terrain.villes_masque())
    brut = plan_analyse.jeu_depuis_fiches(colonnes, retenues, pa, deriver=False, controles=controles)
    tronque = brut.avec_variable("MAACAUTR", brut.table["MAACAUTR"].map(octets8), brut.variables["MAACAUTR"])
    valides = [f for f in r.fiches if f.statut not in HORS_COMPTAGE]
    collecte = plan_analyse.jeu_depuis_fiches(colonnes, valides, pa, controles=controles)
    return BasesPlateforme(pa, brut, appliquer(brut, pa.derivations), appliquer(tronque, pa.derivations), collecte)
