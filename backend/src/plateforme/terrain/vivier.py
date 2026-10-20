"""Vivier des enquêteurs (module M6) : identité, contacts, compétences, pipeline de recrutement, historique de performance.

Données personnelles : pour une étude réelle, le vivier est un registre privé tenu hors du dépôt (reference/prive/ ou base
chiffrée en phase 7). Un vivier versionné ne peut contenir que des personnes fictives (`fictif: true` obligatoire).

Pipeline : candidat → présélectionné → convoqué → formé → testé → recruté → actif | remplaçant | réserve ; écarté à tout
moment, avec motif. Une réserve ou un remplaçant devient actif quand il est activé.
"""

from __future__ import annotations

from datetime import date
from enum import StrEnum
from pathlib import Path
from typing import Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Statut(StrEnum):
    CANDIDAT = "candidat"
    PRESELECTIONNE = "preselectionne"
    CONVOQUE = "convoque"
    FORME = "forme"
    TESTE = "teste"
    RECRUTE = "recrute"
    ACTIF = "actif"
    REMPLACANT = "remplacant"
    RESERVE = "reserve"
    ECARTE = "ecarte"


ORDRE = [Statut.CANDIDAT, Statut.PRESELECTIONNE, Statut.CONVOQUE, Statut.FORME, Statut.TESTE, Statut.RECRUTE]
SUITES: dict[Statut, set[Statut]] = {
    **{s: {ORDRE[k + 1]} for k, s in enumerate(ORDRE[:-1])},
    Statut.RECRUTE: {Statut.ACTIF, Statut.REMPLACANT, Statut.RESERVE},
    Statut.RESERVE: {Statut.ACTIF, Statut.REMPLACANT},
    Statut.REMPLACANT: {Statut.ACTIF},
    Statut.ACTIF: {Statut.RESERVE},
    Statut.ECARTE: set(),
}
MOBILISABLES = {Statut.RECRUTE, Statut.ACTIF, Statut.REMPLACANT, Statut.RESERVE}


class Etape(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    statut: Statut
    date: date
    motif: str = ""


class Performance(BaseModel):
    """Bilan d'une étude, pour le re-casting (CLAUDE.md §M6)."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    etude: str
    fiches: int = Field(ge=0)
    taux_rejet: float = Field(ge=0, le=1)
    effet_enqueteur: bool = False
    score_qualite: float | None = Field(default=None, ge=0, le=100)


class Personne(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    id: str = Field(pattern=r"^[A-Z0-9_]+$")
    nom: str
    prenom: str
    genre: str | None = Field(default=None, pattern=r"^[FH]$", description="F / H : « enquêtrice » ou « enquêteur » sur le badge")
    telephone: str = ""
    whatsapp: str = ""
    ville: str = Field(description="Ville du référentiel (ex. DOUALA)")
    quartier: str = ""
    langues: list[str] = Field(default_factory=list)
    niveau_etudes: str = ""
    experience: int = Field(default=0, ge=0, description="Nombre d'études déjà réalisées")
    smartphone: bool = False
    disponible: bool = True
    piece_verifiee: bool = False
    photo: str | None = Field(default=None, description="Chemin de la photo d'identité (registre privé)")
    historique: list[Etape] = Field(min_length=1)
    performances: list[Performance] = Field(default_factory=list)
    fictif: bool = False

    @model_validator(mode="after")
    def _pipeline(self) -> Self:
        for a, b in zip(self.historique, self.historique[1:], strict=False):
            if b.date < a.date:
                raise ValueError(f"{self.id} : historique non chronologique")
            if b.statut is not Statut.ECARTE and b.statut not in SUITES[a.statut]:
                raise ValueError(f"{self.id} : passage « {a.statut} » → « {b.statut} » non permis")
            if a.statut is Statut.ECARTE:
                raise ValueError(f"{self.id} : aucun statut après « écarté »")
        for e in self.historique:
            if e.statut is Statut.ECARTE and not e.motif.strip():
                raise ValueError(f"{self.id} : un écart exige un motif")
        return self

    @property
    def statut(self) -> Statut:
        return self.historique[-1].statut

    @property
    def nom_complet(self) -> str:
        return f"{self.prenom} {self.nom.upper()}"


class PoidsScore(BaseModel):
    """Score de casting paramétrable (sur 100). Chaque critère rapporte au plus son poids."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    experience: float = 25          # plafonné à `experience_max` études
    experience_max: int = 5
    smartphone: float = 15
    piece_verifiee: float = 15
    langues: float = 10             # 2 langues ou plus
    qualite: float = 35             # 1 − taux de rejet moyen des études passées (neutre à mi-poids sans historique)
    penalite_effet_enqueteur: float = 20


def score(p: Personne, poids: PoidsScore | None = None) -> float:
    w = poids or PoidsScore()
    total = w.experience * min(p.experience, w.experience_max) / w.experience_max
    total += w.smartphone * p.smartphone + w.piece_verifiee * p.piece_verifiee + w.langues * (len(p.langues) >= 2)
    if p.performances:
        rejet = sum(x.taux_rejet for x in p.performances) / len(p.performances)
        total += w.qualite * (1 - rejet)
        total -= w.penalite_effet_enqueteur * any(x.effet_enqueteur for x in p.performances)
    else:
        total += w.qualite / 2
    return round(max(total, 0.0), 1)


class Vivier(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    personnes: list[Personne]

    @model_validator(mode="after")
    def _ids(self) -> Self:
        ids = [p.id for p in self.personnes]
        if len(ids) != len(set(ids)):
            raise ValueError("personne en double dans le vivier")
        return self

    def personne(self, ident: str) -> Personne:
        try:
            return next(p for p in self.personnes if p.id == ident)
        except StopIteration:
            raise KeyError(f"personne inconnue dans le vivier : « {ident} »") from None

    def classement(self, ville: str | None = None, poids: PoidsScore | None = None) -> list[tuple[Personne, float]]:
        """Personnes non écartées, disponibles, par score décroissant (re-casting)."""
        candidats = [p for p in self.personnes if p.statut is not Statut.ECARTE and p.disponible and (ville is None or p.ville == ville)]
        return sorted(((p, score(p, poids)) for p in candidats), key=lambda x: (-x[1], x[0].id))


def charger(chemin: str | Path, versionne: bool = False) -> Vivier:
    """`versionne` : fichier du dépôt → toutes les personnes doivent être fictives (aucune donnée personnelle réelle)."""
    v = Vivier.model_validate(yaml.safe_load(Path(chemin).read_text(encoding="utf-8")) or {"personnes": []})
    if versionne:
        reelles = [p.id for p in v.personnes if not p.fictif]
        if reelles:
            raise ValueError(f"vivier versionné avec des personnes non marquées fictives : {reelles} (registre privé requis)")
    return v
