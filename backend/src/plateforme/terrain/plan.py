"""Plan de terrain : villes, postes d'enquêteurs (titulaire, réserve) et affectations datées (remplacements).

Aucun nom de personne ni motif de départ n'est stocké ici : ce sont des données personnelles (registre privé).
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from pathlib import Path
from typing import Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from plateforme.generateurs.masque import Ville


class VillePlan(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    code: int
    id: str = Field(pattern=r"^[A-Z0-9_]+$")
    libelle: str
    prefixe: str = Field(pattern=r"^[A-Z]{3}$")


class Role(StrEnum):
    TITULAIRE = "titulaire"
    RESERVE = "reserve"          # ne compte dans aucune statistique d'équipe tant qu'elle n'est pas activée


class Affectation(BaseModel):
    """Période pendant laquelle une personne occupe le poste ; les fiches sont attribuées selon leur horodatage."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    personne: str = Field(description="Libellé non nominatif : « titulaire », « remplaçant 1 »…")
    debut: datetime | None = None
    fin: datetime | None = None
    sortie: str = Field(default="", description="Moment de sortie tel qu'affiché (ex. « Jour 02, matin »)")
    demarrage: str = Field(default="", description="Moment de démarrage tel qu'affiché (ex. « Jour 02 »)")


class EnqueteurPlan(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    id: str = Field(pattern=r"^\S{1,15}$")
    ville: str | None = None
    role: Role = Role.TITULAIRE
    affectations: list[Affectation] = Field(default_factory=list)

    @model_validator(mode="after")
    def _periodes(self) -> Self:
        for a, b in zip(self.affectations, self.affectations[1:], strict=False):
            if a.fin is None or b.debut is None or b.debut < a.fin:
                raise ValueError(f"{self.id} : affectations qui se chevauchent ou sans dates")
        return self


class PlanTerrain(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    etude: str
    fuseau: str = "Africa/Douala"
    villes: list[VillePlan]
    enqueteurs: list[EnqueteurPlan] = Field(default_factory=list)
    objectif_total: int | None = Field(default=None, description="Fiches attendues de l'équipe (base du rapport de statut)")
    jours: list[date] = Field(default_factory=list, description="Calendrier J1…Jn (prolongations comprises)")
    objectif_jour: float = 25
    nb_jours: int = 3
    seuil_delai_min: int = 6
    seuil_volume_jour: int = 30

    @model_validator(mode="after")
    def _coherence(self) -> Self:
        for nom, valeurs in (("code", [v.code for v in self.villes]), ("id", [v.id for v in self.villes]),
                             ("préfixe", [v.prefixe for v in self.villes]), ("enquêteur", [e.id for e in self.enqueteurs])):
            if len(valeurs) != len(set(valeurs)):
                raise ValueError(f"{nom} en double dans le plan de terrain")
        ids = {v.id for v in self.villes}
        for e in self.enqueteurs:
            if e.ville is not None and e.ville not in ids:
                raise ValueError(f"{e.id} : ville inconnue « {e.ville} »")
        return self

    def villes_masque(self) -> list[Ville]:
        return [Ville(v.code, v.id, v.libelle, v.prefixe) for v in self.villes]


def charger(chemin: str | Path) -> PlanTerrain:
    return PlanTerrain.model_validate(yaml.safe_load(Path(chemin).read_text(encoding="utf-8")))
