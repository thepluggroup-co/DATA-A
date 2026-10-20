"""Brief client (M0) et paramètres tarifaires de l'usine.

Le brief est versionné (cahier des charges 01, 02…). Les tarifs sont des paramètres du cabinet : aucun montant n'est écrit
dans le code. La pré-estimation donne, dès le choix des villes, un ordre de grandeur de l'échantillon, des enquêteurs, des
jours et du coût ; le devis définitif se calcule ensuite sur les plans (finances/paiements.py).
"""

from __future__ import annotations

import math
from datetime import date
from enum import StrEnum
from pathlib import Path
from typing import Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from plateforme.echantillonnage.plan import ParametresTaille, repartir, taille_echantillon


class TypeEtude(StrEnum):
    QUANTI = "quanti"
    QUALI = "quali"
    MIXTE = "mixte"


class ModeCollecte(StrEnum):
    FORMULAIRE_EN_LIGNE = "formulaire_en_ligne"     # Google Forms en V1 (adaptateur)
    APPLICATION = "application"                      # collecte native hors ligne (phase 8)
    TELEPHONE = "telephone"
    ENTRETIEN = "entretien"                          # quali : entretiens individuels ou de groupe


class Format(StrEnum):
    DOCX = "docx"
    PDF = "pdf"
    PPTX = "pptx"
    XLSX = "xlsx"
    SAV = "sav"


class Client(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    raison_sociale: str
    secteur: str = ""
    interlocuteur: str = Field(default="", description="Fonction de l'interlocuteur (pas de nom dans le dépôt)")


class Cabinet(BaseModel):
    """Cabinet qui conduit l'étude : apparaît sur les badges, chartes, ordres de mission et devis."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    nom: str
    telephone: str = ""
    email: str = ""
    ville: str = ""
    logo: str | None = None
    url_verification: str | None = Field(default=None, description="Adresse de base de la page publique de vérification des badges")


class Cible(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    code: int = Field(ge=1)
    libelle: str
    poids: float = Field(default=1, gt=0, description="Poids dans la répartition de l'échantillon")
    maillon: str = Field(default="", description="Regroupement (distributeurs, prescripteurs, utilisateurs finaux…)")


class Brief(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    etude: str = Field(pattern=r"^[A-Z0-9_]+$")
    version: str = Field(pattern=r"^\d{2}$", description="Version du cahier des charges (01, 02…)")
    titre: str
    client: Client
    besoin: str = Field(description="Besoin d'information exprimé par le client")
    antecedents: str = Field(default="", description="Historique du client et travaux antérieurs")
    marche: str = Field(default="", description="Description du marché étudié")
    produits: str = Field(default="", description="Produits ou services concernés")
    attentes: str = Field(default="", description="Décisions, projections et livrables attendus")
    objectifs: list[str] = Field(min_length=1)
    cibles: list[Cible] = Field(min_length=1)
    pays: str = Field(pattern=r"^[A-Z]{3}$")
    villes: list[str] = Field(min_length=1, description="Villes du référentiel géographique")
    poids_villes: dict[str, float] = Field(default_factory=dict, description="Répartition de l'échantillon (égale par défaut)")
    type: TypeEtude = TypeEtude.QUANTI
    mode_collecte: ModeCollecte = ModeCollecte.FORMULAIRE_EN_LIGNE
    taille: int | ParametresTaille = Field(description="Effectif voulu, ou paramètres de calcul de la taille")
    debut: date = Field(description="Date de démarrage souhaitée")
    echeance: date
    budget_indicatif: float | None = Field(default=None, ge=0)
    langues: list[str] = Field(default_factory=lambda: ["fr"])
    livrables: list[str] = Field(default_factory=list)
    formats: list[Format] = Field(default_factory=lambda: [Format.DOCX, Format.PDF])
    duree_entretien: int | None = Field(default=None, gt=0, description="Durée annoncée de l'entretien, en minutes (mesurée au pré-test)")
    fictif: bool = False

    @model_validator(mode="after")
    def _coherence(self) -> Self:
        if self.echeance <= self.debut:
            raise ValueError("l'échéance doit suivre la date de démarrage")
        codes = [c.code for c in self.cibles]
        if len(codes) != len(set(codes)) or len(self.villes) != len(set(self.villes)):
            raise ValueError("cible ou ville en double dans le brief")
        if set(self.poids_villes) - set(self.villes):
            raise ValueError("poids donné pour une ville absente du brief")
        return self

    def effectif(self) -> int:
        return self.taille if isinstance(self.taille, int) else taille_echantillon(self.taille)

    def repartition(self) -> dict[str, dict[int, int]]:
        """{ville: {cible: quota}} : d'abord par ville (poids des villes), puis par cible (poids des cibles)."""
        par_ville = repartir(self.effectif(), {v: self.poids_villes.get(v, 1.0) for v in self.villes})
        return {v: repartir(n, {c.code: c.poids for c in self.cibles}) for v, n in par_ville.items()}


class Impression(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    badge: float = Field(default=0, ge=0)
    charte: float = Field(default=0, ge=0)
    ordre_mission: float = Field(default=0, ge=0)
    contrat: float = Field(default=0, ge=0)


class Tarifs(BaseModel):
    """Paramètres de l'usine (THE PLUG) : rythme de collecte, effectifs d'encadrement, barèmes, frais et marge."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    devise: str = "FCFA"
    objectif_jour: float = Field(gt=0, description="Fiches par enquêteur et par jour")
    jours_terrain: int = Field(gt=0)
    reserve_par_ville: int = Field(default=0, ge=0)
    baremes: dict[str, dict[str, object]] = Field(description="Barème par fonction (format terrain/plan.py, Bareme)")
    impression: Impression = Field(default_factory=Impression)
    frais_fixes: dict[str, float] = Field(default_factory=dict, description="Autres frais du projet (libellé : montant)")
    marge: float = Field(ge=0, lt=1, description="Marge appliquée au coût (0,25 = 25 %)")
    fictif: bool = False


class PreEstimation(BaseModel):
    model_config = ConfigDict(frozen=True)
    effectif: int
    par_ville: dict[str, int]
    enqueteurs: dict[str, int]
    jours_terrain: int
    cout_collecte: float


def pre_estimation(brief: Brief, tarifs: Tarifs) -> PreEstimation:
    """Ordre de grandeur dès le choix des villes : enquêteurs = fiches de la ville / (objectif journalier × jours), arrondi
    au supérieur ; coût de collecte = enquêteurs × jours × PU de collecte du titulaire."""
    rep = brief.repartition()
    par_ville = {v: sum(q.values()) for v, q in rep.items()}
    enqueteurs = {v: max(1, math.ceil(n / (tarifs.objectif_jour * tarifs.jours_terrain))) for v, n in par_ville.items()}
    collecte = tarifs.baremes.get("titulaire", {}).get("collecte")
    pu = float(collecte.get("pu", 0)) if isinstance(collecte, dict) else 0.0
    return PreEstimation(effectif=sum(par_ville.values()), par_ville=par_ville, enqueteurs=enqueteurs,
                         jours_terrain=tarifs.jours_terrain, cout_collecte=sum(enqueteurs.values()) * tarifs.jours_terrain * pu)


def charger_brief(chemin: str | Path) -> Brief:
    return Brief.model_validate(yaml.safe_load(Path(chemin).read_text(encoding="utf-8")))


def charger_tarifs(chemin: str | Path) -> Tarifs:
    return Tarifs.model_validate(yaml.safe_load(Path(chemin).read_text(encoding="utf-8")))


def charger_cabinet(chemin: str | Path) -> Cabinet:
    return Cabinet.model_validate(yaml.safe_load(Path(chemin).read_text(encoding="utf-8")))
