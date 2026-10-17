"""Gabarit du tri à plat : une table par variable codée, avec ligne TOTAL contrôlée.

Reprend `creerTriAPlat_` de V11 : la ville (CODEZONE) sert de colonnes, un choix
multiple ne montre que « Cité », et chaque question à réponse unique se termine par
une ligne TOTAL qui doit égaler la base (sinon des fiches manquent ou sont en double).
Les effectifs sont calculés en phase 3 ; ce module fixe la structure.
"""

from __future__ import annotations

from dataclasses import dataclass

from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.generateurs.masque import Colonne

LIBELLE_NON_REPONSE = "Non-réponse (question laissée vide)"


@dataclass(frozen=True)
class TableTriAPlat:
    variable: str
    titre: str
    lignes: tuple[tuple[int, str], ...]
    ligne_total: bool
    groupe: str | None


def gabarit(dico: Dictionnaire, colonnes: list[Colonne]) -> list[TableTriAPlat]:
    nr = dico.codes_speciaux.non_reponse
    tables = []
    for c in colonnes:
        if not c.valeurs or c.code == "CODEZONE":
            continue
        valeurs = tuple(v for v in c.valeurs if v[0] == 1) if c.groupe else c.valeurs
        lignes = tuple((code, LIBELLE_NON_REPONSE if code == nr else lib) for code, lib in valeurs)
        tables.append(TableTriAPlat(c.code, f"{c.code} — {c.label}", lignes, ligne_total=c.groupe is None, groupe=c.groupe))
    return tables
