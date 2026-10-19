"""Variables de contrôle calculées par la plateforme et versées au jeu d'analyse (préfixe [C] de la livraison SPSS).

Elles appliquent les MÊMES règles que la base d'analyse (codification/qualite.py), pour qu'un utilisateur puisse
vérifier dans le fichier livré pourquoi une fiche est retenue ou écartée :
- ID_CASE : rang de la fiche dans la base des fiches valides (hors REJETE et ANNULEE), dans l'ordre d'arrivée ;
- JOURTERR : jour de terrain J1…Jn du calendrier du plan de terrain ; une fiche datée après le dernier jour prévu
  est rangée dans ce dernier jour (rattrapage), une fiche datée avant le premier jour reste manquante ;
- NB_NR / TX_REMPL : questions sans réponse et taux de remplissage (variables_remplissage du dictionnaire) ;
- DOUBLON_SUSP : 0 aucun, 1 ressemblance forte (à vérifier), 2 copie probable (écartée de la base) ;
- FILTRE_QUAL : 1 si la fiche est retenue par base_analyse (décisions du superviseur comprises), sinon 0.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from plateforme.analyse.donnees import Variable
from plateforme.codification.fiche import FicheCodee
from plateforme.codification.qualite import ParametresBase, base_analyse, quasi_doublons, taux_remplissage, variables_remplissage
from plateforme.codification.rejeu import HORS_COMPTAGE, DecisionQC
from plateforme.dictionnaire.modele import Dictionnaire

VARIABLES = {
    "ID_CASE": Variable("ID_CASE", "[C] Rang de la fiche dans la base des fiches valides (ordre d'arrivée)", {}, set(), "nominal"),
    "JOURTERR": Variable("JOURTERR", "[C] Jour de terrain (les jours après le dernier jour prévu y sont rattachés)", {}, set(), "ordinal"),
    "NB_NR": Variable("NB_NR", "[C] Nombre de questions sans réponse", {}, set(), "scale"),
    "TX_REMPL": Variable("TX_REMPL", "[C] Taux de remplissage de la fiche (%)", {}, set(), "scale"),
    "DOUBLON_SUSP": Variable("DOUBLON_SUSP", "[C] Fiche quasi identique à une autre", {0.0: "Non", 1.0: "Ressemblance forte : à vérifier",
                                                                                      2.0: "Copie probable : écartée"}, set(), "nominal"),
    "FILTRE_QUAL": Variable("FILTRE_QUAL", "[C] Fiche retenue pour l'analyse", {0.0: "Écartée", 1.0: "Retenue"}, set(), "nominal"),
}


def jour_terrain(jour: str, calendrier: list[date]) -> int | None:
    """Rang (1…n) d'une date « AAAA-MM-JJ » dans le calendrier ; au-delà du dernier jour : n ; avant le premier : None."""
    if not calendrier or not jour:
        return None
    d = date.fromisoformat(jour)
    if d < calendrier[0]:
        return None
    return next((k for k, j in enumerate(calendrier, start=1) if d == j), len(calendrier) if d > calendrier[-1] else None)


def variables_controle(dico: Dictionnaire, fiches: list[FicheCodee], calendrier: list[date],
                       params: ParametresBase | None = None, decisions: dict[str, DecisionQC] | None = None
                       ) -> tuple[dict[str, dict[str, Any]], dict[str, Variable]]:
    """id de réponse -> {variable: valeur} pour toutes les fiches valides ; `fiches` dans l'ordre d'arrivée."""
    params = params or ParametresBase()
    retenues = {f.id_reponse for f in base_analyse(dico, fiches, params, decisions)[0]}
    valides = [f for f in fiches if f.statut not in HORS_COMPTAGE]
    doublons = quasi_doublons(dico, valides, params)
    n_questions = len(variables_remplissage(dico))
    out: dict[str, dict[str, Any]] = {}
    for rang, f in enumerate(valides, start=1):
        tx = taux_remplissage(dico, f)
        out[f.id_reponse] = {"ID_CASE": rang, "JOURTERR": jour_terrain(str(f.valeurs.get("DATEENQU") or ""), calendrier),
                             "NB_NR": round(n_questions * (1 - tx / 100)), "TX_REMPL": tx, "DOUBLON_SUSP": doublons[f.id_reponse],
                             "FILTRE_QUAL": int(f.id_reponse in retenues)}
    variables = dict(VARIABLES)
    variables["NB_NR"] = Variable("NB_NR", f"[C] Nombre de questions sans réponse (sur {n_questions})", {}, set(), "scale")
    variables["JOURTERR"] = Variable("JOURTERR", VARIABLES["JOURTERR"].label,
                                     {float(k): f"J{k} ({j.isoformat()})" for k, j in enumerate(calendrier, start=1)}, set(), "ordinal")
    return out, variables
