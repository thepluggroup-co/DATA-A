"""Lecture du plan de terrain (phase 1 : villes et identifiants d'enquêteurs)."""

from __future__ import annotations

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


class EnqueteurPlan(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    id: str = Field(pattern=r"^\S{1,15}$")
    ville: str | None = None


class PlanTerrain(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    etude: str
    fuseau: str = "Africa/Douala"
    villes: list[VillePlan]
    enqueteurs: list[EnqueteurPlan] = Field(default_factory=list)

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
