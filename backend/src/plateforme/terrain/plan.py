"""Plan de terrain (3e source de vérité) : villes, zones d'enquête et localités, postes d'enquêteurs (titulaire, réserve)
et affectations datées (remplacements), équipe d'encadrement, calendrier et barèmes de rémunération.

Aucun nom de personne ni motif de départ n'est stocké ici : un poste renvoie au plus à l'identifiant d'une personne du
vivier (terrain/vivier.py), tenu à part (registre privé pour une étude réelle).
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
    localite: str | None = Field(default=None, description="Ville du référentiel géographique (geo/referentiel.py)")
    superviseur: str | None = Field(default=None, description="Membre de l'équipe qui supervise la ville")


class Zone(BaseModel):
    """Zone d'enquête d'une ville (« Zone 1 »…) : regroupement de quartiers et de points de collecte du référentiel."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    id: str = Field(pattern=r"^[A-Z0-9_]+$")
    ville: str
    libelle: str
    localites: list[str] = Field(default_factory=list)


class FonctionEquipe(StrEnum):
    EXPERT = "expert"                    # chef de projet
    APPUI_1 = "appui_1"                  # consultant senior
    APPUI_2 = "appui_2"                  # consultant junior
    SUPERVISEUR = "superviseur"          # superviseur de ville
    DEPOUILLEUR = "depouilleur"


LIBELLES_FONCTIONS = {"expert": "Expert (chef de projet)", "appui_1": "Appui 1 (consultant senior)",
                      "appui_2": "Appui 2 (consultant junior)", "superviseur": "Superviseur de ville", "depouilleur": "Dépouilleur",
                      "titulaire": "Enquêteur titulaire", "remplacant": "Enquêteur remplaçant", "reserve": "Enquêteur de réserve"}


class MembreEquipe(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    id: str = Field(pattern=r"^[A-Z0-9_]+$")
    fonction: FonctionEquipe
    ville: str | None = None
    personne: str | None = Field(default=None, description="Identifiant de la personne dans le vivier")


class Ligne(BaseModel):
    """Rubrique de rémunération : prix unitaire (FCFA) × quantité. Aucun montant n'est écrit dans le code."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    pu: float = Field(ge=0)
    qte: float = Field(default=1, ge=0)


class Bareme(BaseModel):
    """Barème d'une fonction (« titulaire », « superviseur »…). « collecte » : PU par jour de terrain (quantité = jours
    prévus si absente) ; « formation » : versée aux titulaires seulement si `formation_titulaires_seuls`."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    honoraires: float = Field(default=0, ge=0)
    formation: Ligne | None = None
    collecte: Ligne | None = None
    transport: Ligne | None = None
    hebergement: Ligne | None = None
    depouillement: Ligne | None = None
    avance: float = Field(default=0, ge=0, description="Avance versée au démarrage")


class Calendrier(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    formation: date | None = None
    pre_test: date | None = None
    jours_non_ouvres: list[date] = Field(default_factory=list, description="Jours fériés ou chômés déclarés pour l'étude")


class Role(StrEnum):
    TITULAIRE = "titulaire"
    RESERVE = "reserve"          # ne compte dans aucune statistique d'équipe tant qu'elle n'est pas activée


class Affectation(BaseModel):
    """Période pendant laquelle une personne occupe le poste ; les fiches sont attribuées selon leur horodatage."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    personne: str = Field(description="Libellé non nominatif : « titulaire », « remplaçant 1 »…")
    personne_id: str | None = Field(default=None, description="Identifiant de la personne dans le vivier")
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
    zones: list[str] = Field(default_factory=list, description="Zones d'enquête du poste")
    localites: list[str] = Field(default_factory=list, description="Quartiers ou points attribués en propre (sinon : ceux des zones)")
    personne: str | None = Field(default=None, description="Personne du vivier qui occupe le poste (sans affectations datées)")

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
    pays: str | None = Field(default=None, description="Référentiel géographique (ex. CMR)")
    zones: list[Zone] = Field(default_factory=list)
    equipe: list[MembreEquipe] = Field(default_factory=list)
    calendrier: Calendrier = Field(default_factory=Calendrier)
    baremes: dict[str, Bareme] = Field(default_factory=dict, description="Par fonction : titulaire, remplacant, reserve, superviseur…")
    formation_titulaires_seuls: bool = True
    url_verification: str | None = Field(default=None, description="Adresse de base de la page de vérification des badges (QR)")

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
        zones = {z.id: z for z in self.zones}
        if len(zones) != len(self.zones):
            raise ValueError("zone en double dans le plan de terrain")
        for z in self.zones:
            if z.ville not in ids:
                raise ValueError(f"zone {z.id} : ville inconnue « {z.ville} »")
        for e in self.enqueteurs:
            for zid in e.zones:
                if zid not in zones or zones[zid].ville != e.ville:
                    raise ValueError(f"{e.id} : zone « {zid} » inconnue ou hors de sa ville")
        equipe = {m.id for m in self.equipe}
        if len(equipe) != len(self.equipe):
            raise ValueError("membre de l'équipe en double")
        for v in self.villes:
            if v.superviseur is not None and v.superviseur not in equipe:
                raise ValueError(f"{v.id} : superviseur « {v.superviseur} » absent de l'équipe")
        for m in self.equipe:
            if m.ville is not None and m.ville not in ids:
                raise ValueError(f"{m.id} : ville inconnue « {m.ville} »")
        return self

    def zones_de(self, e: EnqueteurPlan) -> list[Zone]:
        return [z for z in self.zones if z.id in e.zones]

    def localites_de(self, e: EnqueteurPlan) -> list[str]:
        """Localités du poste : attribuées en propre, sinon celles de ses zones."""
        return list(e.localites) or [loc for z in self.zones_de(e) for loc in z.localites]

    def ville(self, ident: str) -> VillePlan:
        return next(v for v in self.villes if v.id == ident)

    def jours_ouvres(self) -> list[date]:
        return [j for j in self.jours if j not in self.calendrier.jours_non_ouvres]

    def villes_masque(self) -> list[Ville]:
        return [Ville(v.code, v.id, v.libelle, v.prefixe) for v in self.villes]


def charger(chemin: str | Path) -> PlanTerrain:
    return PlanTerrain.model_validate(yaml.safe_load(Path(chemin).read_text(encoding="utf-8")))
