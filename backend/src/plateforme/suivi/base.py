"""Base de suivi : une fiche = un dictionnaire de valeurs codées + jour, heure, rejet (`lireBase_` de V11)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from plateforme.codification.fiche import FicheCodee
from plateforme.codification.rejeu import ANNULEE, REJETE
from plateforme.dictionnaire.modele import Dictionnaire, TypeQuestion

FicheSuivi = dict[str, Any]


def base_suivi(fiches: list[FicheCodee]) -> list[FicheSuivi]:
    out = []
    for f in fiches:
        if f.statut == ANNULEE:            # incident technique : absente de tout suivi
            continue
        o: FicheSuivi = dict(f.valeurs)
        o["_jour"] = str(f.valeurs.get("DATEENQU", ""))[:10]
        h = str(f.valeurs.get("HEUREENQ", ""))
        o["_heure"] = int(h.split(":")[0]) if ":" in h else None
        o["_rej"] = f.statut == REJETE
        out.append(o)
    return out


def variables_questions(dico: Dictionnaire) -> list[tuple[str, str]]:
    """Une variable par question codée (`varsQuestions_` de V11) : (variable, libellé)."""
    out = []
    for q in dico.questions:
        titre = dico.titre_question(q)
        if q.type is TypeQuestion.CHOIX_UNIQUE:
            out.append((q.code, titre))
        elif q.type is TypeQuestion.CHOIX_MULTIPLE:
            out.append((q.variables()[0], titre))
        elif q.type is TypeQuestion.GRILLE:
            for li in q.lignes:
                out.append((li.variable, f"Q{q.numero}. Fourchette de prix — {dico.texte(li.libelles)}"))
    return out


def arrondi(x: float) -> int:
    """Math.round de JavaScript (0,5 vers le haut)."""
    return math.floor(x + 0.5)


def pc(x: float | None) -> str:
    return "—" if x is None else f"{arrondi(100 * x)} %"


def fixe1(x: float) -> str:
    """Number.prototype.toFixed(1) de JavaScript : sur la valeur binaire exacte, égalité tranchée vers le haut
    (5.25 → « 5.3 », alors que le format Python arrondit au pair : « 5.2 »)."""
    return str(Decimal(x).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


@dataclass(frozen=True)
class Ville:
    code: int
    id: str
    libelle: str


@dataclass(frozen=True)
class Enqueteur:
    id: str
    nom: str
    zone: str
