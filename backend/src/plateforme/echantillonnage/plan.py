"""Plan d'échantillonnage (2e source de vérité du projet).

Format YAML (celui de l'EDM, conservé) :

    etude: …
    version: "02"
    methode: quotas                 # quotas | aleatoire | stratifie
    variable_cible: VOUSETES        # question qui porte les quotas (rôle « cible » du dictionnaire)
    taille: {proportion: 0.5, marge: 0.05, confiance: 0.95, population: null, effet_plan: 1.0}   # facultatif
    quotas:                          # code de la cible : libellé + quota par ville (identifiants du plan de terrain)
      1: {cible: Particulier, DOUALA: 35, YAOUNDE: 35, BAFOUSSAM: 15}

Un échantillon par quotas est non probabiliste : la mention est imposée dans le plan et dans le rapport (CLAUDE.md §M2).
"""

from __future__ import annotations

import math
from enum import StrEnum
from pathlib import Path
from typing import TYPE_CHECKING, Any, Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

if TYPE_CHECKING:
    from plateforme.terrain.plan import PlanTerrain

MENTION_QUOTAS = ("Échantillon par quotas, non probabiliste : les résultats décrivent les personnes interrogées ; ils ne "
                  "s'extrapolent pas à l'ensemble de la population et aucune marge d'erreur ne s'y applique au sens strict.")


class Methode(StrEnum):
    QUOTAS = "quotas"
    ALEATOIRE = "aleatoire"
    STRATIFIE = "stratifie"


class ParametresTaille(BaseModel):
    """Taille d'un échantillon aléatoire simple pour estimer une proportion (référence de dimensionnement)."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    proportion: float = Field(default=0.5, gt=0, lt=1)
    marge: float = Field(gt=0, lt=0.5, description="Demi-largeur de l'intervalle (0,05 = ± 5 points)")
    confiance: float = Field(default=0.95, gt=0.5, lt=1)
    population: int | None = Field(default=None, gt=0, description="Taille de la population (correction de population finie)")
    effet_plan: float = Field(default=1.0, ge=1)


class Quota(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    code: int
    cible: str
    villes: dict[str, int]

    @model_validator(mode="after")
    def _positifs(self) -> Self:
        if any(n < 0 for n in self.villes.values()):
            raise ValueError(f"cible {self.code} : quota négatif")
        return self


class PlanEchantillonnage(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    etude: str
    version: str
    methode: Methode
    variable_cible: str
    taille: ParametresTaille | None = None
    quotas: list[Quota]
    parametres_qualite: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _coherence(self) -> Self:
        codes = [q.code for q in self.quotas]
        if len(codes) != len(set(codes)):
            raise ValueError("cible en double dans le plan d'échantillonnage")
        villes = {tuple(q.villes) for q in self.quotas}
        if len(villes) > 1:
            raise ValueError("toutes les cibles doivent porter un quota pour les mêmes villes")
        return self

    @property
    def villes(self) -> list[str]:
        return list(self.quotas[0].villes) if self.quotas else []

    def total(self) -> int:
        return sum(sum(q.villes.values()) for q in self.quotas)

    def par_ville(self) -> dict[str, int]:
        return {v: sum(q.villes[v] for q in self.quotas) for v in self.villes}

    def mention(self) -> str:
        return MENTION_QUOTAS if self.methode is Methode.QUOTAS else ""


def charger(chemin: str | Path) -> PlanEchantillonnage:
    brut: dict[str, Any] = yaml.safe_load(Path(chemin).read_text(encoding="utf-8")) or {}
    quotas = []
    for code, q in (brut.pop("quotas", None) or {}).items():
        q = dict(q)
        quotas.append({"code": int(code), "cible": str(q.pop("cible")), "villes": {str(k): int(v) for k, v in q.items()}})
    return PlanEchantillonnage.model_validate({**brut, "quotas": quotas})


def vers_dict(plan: PlanEchantillonnage) -> dict[str, Any]:
    """Format YAML du plan (celui que lit `charger`) : un aller-retour charger → vers_dict → charger est sans perte."""
    out: dict[str, Any] = {"etude": plan.etude, "version": plan.version, "methode": plan.methode.value,
                           "variable_cible": plan.variable_cible}
    if plan.taille is not None:
        out["taille"] = plan.taille.model_dump()
    out["quotas"] = {q.code: {"cible": q.cible, **q.villes} for q in plan.quotas}
    if plan.parametres_qualite:
        out["parametres_qualite"] = dict(plan.parametres_qualite)
    return out


def enregistrer(plan: PlanEchantillonnage, chemin: str | Path) -> None:
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(yaml.safe_dump(vers_dict(plan), allow_unicode=True, sort_keys=False, width=160), encoding="utf-8")


# ------------------------------------------------------------------------------------------------ calculs
def taille_echantillon(p: ParametresTaille) -> int:
    """n0 = z² p (1 − p) / e² × effet de plan, puis correction de population finie n = n0 / (1 + (n0 − 1) / N) ;
    arrondi à l'entier supérieur."""
    from scipy.stats import norm

    z = float(norm.ppf(1 - (1 - p.confiance) / 2))
    n0 = z * z * p.proportion * (1 - p.proportion) / (p.marge * p.marge) * p.effet_plan
    n = n0 / (1 + (n0 - 1) / p.population) if p.population else n0
    return math.ceil(n - 1e-9)


def marge_obtenue(n: int, proportion: float = 0.5, confiance: float = 0.95, effet_plan: float = 1.0) -> float:
    """Demi-largeur de l'intervalle pour n répondants (repère indicatif, sous hypothèse d'échantillon aléatoire)."""
    from scipy.stats import norm

    z = float(norm.ppf(1 - (1 - confiance) / 2))
    return z * math.sqrt(proportion * (1 - proportion) * effet_plan / n)


def repartir[K](total: int, poids: dict[K, float]) -> dict[K, int]:
    """Répartition entière proportionnelle aux poids (méthode du plus fort reste) : la somme vaut exactement `total`."""
    if total < 0 or not poids or any(w < 0 for w in poids.values()) or sum(poids.values()) <= 0:
        raise ValueError("répartition : total positif et poids positifs attendus")
    somme = sum(poids.values())
    exacts = {k: total * w / somme for k, w in poids.items()}
    out = {k: math.floor(v) for k, v in exacts.items()}
    reste = total - sum(out.values())
    for k in sorted(exacts, key=lambda k: (-(exacts[k] - out[k]), list(poids).index(k)))[:reste]:
        out[k] += 1
    return out


class Capacite(BaseModel):
    model_config = ConfigDict(frozen=True)
    ville: str
    quota: int
    titulaires: int
    capacite: int

    @property
    def ecart(self) -> int:
        """Capacité − quota : négatif = le terrain ne peut pas atteindre le quota au rythme prévu."""
        return self.capacite - self.quota


def capacite(plan: PlanEchantillonnage, terrain: PlanTerrain) -> list[Capacite]:
    """Capacité du terrain par ville : postes titulaires × objectif journalier × jours prévus (les réserves ne comptent
    pas tant qu'elles ne sont pas activées, CLAUDE.md §6)."""
    from plateforme.terrain.plan import Role

    out = []
    for v in terrain.villes:
        if v.id not in plan.villes:
            continue
        titulaires = sum(1 for e in terrain.enqueteurs if e.ville == v.id and e.role is Role.TITULAIRE)
        out.append(Capacite(ville=v.id, quota=plan.par_ville()[v.id], titulaires=titulaires,
                            capacite=round(titulaires * terrain.objectif_jour * terrain.nb_jours)))
    return out


def verifier(plan: PlanEchantillonnage, terrain: PlanTerrain) -> list[str]:
    """Écarts entre les deux sources de vérité (messages en clair ; liste vide = cohérent)."""
    out = []
    ids = {v.id for v in terrain.villes}
    inconnues = [v for v in plan.villes if v not in ids]
    if inconnues:
        out.append(f"villes du plan d'échantillonnage absentes du plan de terrain : {', '.join(inconnues)}")
    if terrain.objectif_total is not None and terrain.objectif_total != plan.total():
        out.append(f"objectif du terrain ({terrain.objectif_total}) différent du total des quotas ({plan.total()})")
    for c in capacite(plan, terrain):
        if c.ecart < 0:
            out.append(f"{c.ville} : capacité {c.capacite} fiches pour un quota de {c.quota} (manque {-c.ecart})")
    return out
