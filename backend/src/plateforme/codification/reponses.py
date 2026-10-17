"""Réponse brute (immuable) et sa structuration par question.

Une réponse brute est conservée telle que reçue (titres et valeurs de l'outil de collecte) ;
la structuration la rattache aux questions du dictionnaire par le numéro « Qn. » du titre
et aux questions d'identification par leur libellé, dans n'importe quelle langue.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime

from plateforme.dictionnaire.modele import Dictionnaire, RoleIdentification
from plateforme.noyau.textes import cle, normaliser, numero_question

Valeur = str | list[str] | None


@dataclass(frozen=True)
class ItemReponse:
    """Réponse à un élément du formulaire : texte (choix unique, texte), liste (cases, grille)."""

    titre: str
    valeur: Valeur
    lignes: tuple[str, ...] | None = None       # grille : libellés des lignes, dans l'ordre de `valeur`


@dataclass(frozen=True)
class ReponseBrute:
    id: str                                     # identifiant unique de la réponse (clé d'idempotence)
    horodatage: datetime                        # avec fuseau
    items: tuple[ItemReponse, ...]
    source: str = ""


@dataclass
class ReponseStructuree:
    identification: dict[RoleIdentification, Valeur] = field(default_factory=dict)
    questions: dict[int, ItemReponse] = field(default_factory=dict)


def est_vide(v: object) -> bool:
    """`vide_` de V11 : None, chaîne blanche, ou liste dont tous les éléments sont vides."""
    if v is None:
        return True
    if isinstance(v, list | tuple):
        return all(est_vide(x) for x in v)
    return normaliser(v) == ""


def _cle_identification(libelle: str) -> str:
    """Clé d'un libellé d'identification sans ses précisions entre parenthèses : « Quartier / zone (ex. Makepe) » → quartierzone."""
    return cle(re.sub(r"\([^)]*\)", "", libelle))


def structurer(dico: Dictionnaire, items: tuple[ItemReponse, ...] | list[ItemReponse]) -> ReponseStructuree:
    """`structurer_` de V11 : pour une question en double (français et anglais), la version RÉPONDUE l'emporte."""
    roles = [(d.role, {_cle_identification(t) for t in d.libelles.values()}) for d in dico.identification]
    out = ReponseStructuree()
    for it in items:
        n = numero_question(it.titre)
        if n is not None:
            if n not in out.questions or est_vide(out.questions[n].valeur):
                out.questions[n] = it
            continue
        k = cle(it.titre)
        for role, cles in roles:
            if any(c and c in k for c in cles):
                out.identification.setdefault(role, it.valeur)
                break
    return out
