"""Chronogramme (module M5) : tâches d'un gabarit planifiées en jours ouvrés, ancrées sur les dates du plan de terrain
(formation, pré-test, jours de collecte), avec ressources affectées et % d'occupation.

Convention : une tâche de d jours ouvrés commence le jour S et finit le d-ième jour ouvré à partir de S ; une tâche qui
suit commence le jour ouvré suivant la fin de la dernière de ses prédécesseurs. Jours ouvrés : lundi à vendredi, moins
les jours non ouvrés déclarés pour l'étude.
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from typing import Literal, Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

Ancre = Literal["formation", "pre_test", "collecte"]


class Tache(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    id: str = Field(pattern=r"^[A-Z0-9_]+$")
    phase: str
    libelle: str
    duree: int = Field(ge=1, description="Jours ouvrés")
    apres: list[str] = Field(default_factory=list)
    ancre: Ancre | None = None
    types: list[str] = Field(default_factory=lambda: ["quanti", "quali", "mixte"])
    ressources: dict[str, int] = Field(default_factory=dict, description="Fonction : % d'occupation")


class Gabarit(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    nom: str
    source: str
    taches: list[Tache]

    @model_validator(mode="after")
    def _graphe(self) -> Self:
        vus: set[str] = set()
        for t in self.taches:
            if t.id in vus:
                raise ValueError(f"tâche en double : {t.id}")
            inconnus = [a for a in t.apres if a not in vus]
            if inconnus:
                raise ValueError(f"{t.id} : prédécesseur absent ou placé après ({inconnus})")
            vus.add(t.id)
        return self


class TachePlanifiee(BaseModel):
    model_config = ConfigDict(frozen=True)
    tache: Tache
    debut: date
    fin: date
    jours: int


def ouvre(j: date, non_ouvres: set[date]) -> bool:
    return j.weekday() < 5 and j not in non_ouvres


def prochain_ouvre(j: date, non_ouvres: set[date]) -> date:
    while not ouvre(j, non_ouvres):
        j += timedelta(days=1)
    return j


def fin_apres(debut: date, duree: int, non_ouvres: set[date]) -> date:
    j, n = debut, 1
    while n < duree:
        j += timedelta(days=1)
        if ouvre(j, non_ouvres):
            n += 1
    return j


def jours_ouvres_entre(debut: date, fin: date, non_ouvres: set[date]) -> list[date]:
    return [debut + timedelta(days=k) for k in range((fin - debut).days + 1) if ouvre(debut + timedelta(days=k), non_ouvres)]


class Chronogramme(BaseModel):
    model_config = ConfigDict(frozen=True)
    gabarit: str
    source: str
    taches: list[TachePlanifiee]
    anomalies: list[str] = Field(default_factory=list)

    @property
    def debut(self) -> date:
        return min(t.debut for t in self.taches)

    @property
    def fin(self) -> date:
        return max(t.fin for t in self.taches)

    def tache(self, ident: str) -> TachePlanifiee:
        return next(t for t in self.taches if t.tache.id == ident)

    def phases(self) -> list[tuple[str, date, date]]:
        out: list[tuple[str, date, date]] = []
        for t in self.taches:
            if out and out[-1][0] == t.tache.phase:
                out[-1] = (t.tache.phase, min(out[-1][1], t.debut), max(out[-1][2], t.fin))
            else:
                out.append((t.tache.phase, t.debut, t.fin))
        return out


def planifier(gabarit: Gabarit, debut: date, type_etude: str = "quanti", non_ouvres: list[date] | None = None,
              ancres: dict[str, tuple[date, date]] | None = None, durees: dict[str, int] | None = None) -> Chronogramme:
    """`ancres` : {« formation » | « pre_test » | « collecte » : (début, fin)} lus dans le plan de terrain ; `durees` :
    durées imposées par tâche (ex. collecte = jours de terrain prévus). Une ancre placée avant la fin d'un prédécesseur
    est signalée (chevauchement) ; une échéance n'est pas ici une contrainte : elle se contrôle à part."""
    no = set(non_ouvres or [])
    fins: dict[str, date] = {}
    out, anomalies = [], []
    for t in gabarit.taches:
        if type_etude not in t.types:
            continue
        duree = (durees or {}).get(t.id, t.duree)
        preds = [fins[a] for a in t.apres if a in fins]
        au_plus_tot = prochain_ouvre(max(preds) + timedelta(days=1), no) if preds else prochain_ouvre(debut, no)
        if ancres and t.ancre in ancres:
            d, f = ancres[t.ancre]
            if d < au_plus_tot:
                anomalies.append(f"{t.libelle} : prévue le {d:%d/%m/%Y}, avant la fin de la tâche précédente ({au_plus_tot:%d/%m/%Y} au plus tôt)")
            jours = len(jours_ouvres_entre(d, f, no))
        else:
            d, f, jours = au_plus_tot, fin_apres(au_plus_tot, duree, no), duree
        fins[t.id] = f
        out.append(TachePlanifiee(tache=t, debut=d, fin=f, jours=jours))
    return Chronogramme(gabarit=gabarit.nom, source=gabarit.source, taches=out, anomalies=anomalies)


def charger_gabarit(chemin: str | Path) -> Gabarit:
    return Gabarit.model_validate(yaml.safe_load(Path(chemin).read_text(encoding="utf-8")))


def ancres_du_terrain(formation: date | None, pre_test: date | None, jours: list[date]) -> dict[str, tuple[date, date]]:
    out: dict[str, tuple[date, date]] = {}
    if formation:
        out["formation"] = (formation, formation)
    if pre_test:
        out["pre_test"] = (pre_test, pre_test)
    if jours:
        out["collecte"] = (min(jours), max(jours))
    return out
