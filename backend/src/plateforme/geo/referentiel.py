"""Référentiel géographique d'un pays.

- `admin.csv` : unités administratives (niveau, P-code, nom français, nom anglais, P-code parent), importées d'une source
  publique dont la licence a été vérifiée (geo/hdx.py) ; `SOURCE.md` en donne la provenance, la date et la licence.
- `localites.yaml` : villes, quartiers et points de collecte. Chaque localité cite sa source ; une ville est rattachée à
  une unité administrative existante (P-code) ; un quartier ou un point est rattaché à une ville ou à un quartier.
"""

from __future__ import annotations

import csv
import unicodedata
from enum import StrEnum
from pathlib import Path
from typing import Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

COLONNES_ADMIN = ["niveau", "pcode", "nom", "nom_en", "parent"]


class UniteAdmin(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    niveau: int = Field(ge=0, le=4)
    pcode: str
    nom: str
    nom_en: str = ""
    parent: str = ""


class TypeLocalite(StrEnum):
    VILLE = "ville"
    QUARTIER = "quartier"
    POINT = "point"            # point de collecte (marché, gare, carrefour…)


class Localite(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    id: str = Field(pattern=r"^[A-Z0-9_]+(\.[A-Z0-9_]+)*$")
    type: TypeLocalite
    nom: str
    alias: list[str] = Field(default_factory=list, description="Graphies rencontrées dans les sources")
    parent: str = Field(default="", description="Ville ou quartier parent (vide pour une ville)")
    pcode: str = Field(default="", description="Unité administrative de rattachement (obligatoire pour une ville)")
    source: str = Field(min_length=3, description="Document d'où vient le nom (jamais de nom inventé)")
    note: str = ""
    code_court: str | None = Field(default=None, pattern=r"^[A-Z]{3}$", description="Ville : préfixe des N° de fiche (DLA…)")

    def prefixe(self) -> str:
        """Code court déclaré, sinon les trois premières lettres du nom, sans accents."""
        if self.code_court:
            return self.code_court
        lettres = [c for c in _cle(self.nom).upper() if c.isalpha()]
        return "".join(lettres[:3])


class Referentiel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    pays: str = Field(pattern=r"^[A-Z]{3}$")
    niveaux: dict[int, str] = Field(description="Libellé de chaque niveau administratif (ex. 1 : région)")
    unites: list[UniteAdmin]
    localites: list[Localite] = Field(default_factory=list)

    @model_validator(mode="after")
    def _coherence(self) -> Self:
        pcodes = [u.pcode for u in self.unites]
        if len(pcodes) != len(set(pcodes)):
            raise ValueError("P-code en double dans le référentiel administratif")
        connus = set(pcodes)
        for u in self.unites:
            if u.parent and u.parent not in connus:
                raise ValueError(f"{u.pcode} : parent administratif inconnu « {u.parent} »")
            if u.niveau not in self.niveaux:
                raise ValueError(f"{u.pcode} : niveau {u.niveau} non déclaré")
        ids = [loc.id for loc in self.localites]
        doublons = {i for i in ids if ids.count(i) > 1}
        if doublons:
            raise ValueError(f"localité en double : {sorted(doublons)}")
        par_id = {loc.id: loc for loc in self.localites}
        for loc in self.localites:
            if loc.pcode and loc.pcode not in connus:
                raise ValueError(f"{loc.id} : P-code inconnu « {loc.pcode} »")
            if loc.type is TypeLocalite.VILLE:
                if loc.parent or not loc.pcode:
                    raise ValueError(f"{loc.id} : une ville est rattachée à une unité administrative (pcode), sans parent")
            else:
                parent = par_id.get(loc.parent)
                if parent is None or parent.type is TypeLocalite.POINT:
                    raise ValueError(f"{loc.id} : parent « {loc.parent} » absent ou de type point")
                if not loc.id.startswith(loc.parent + "."):
                    raise ValueError(f"{loc.id} : l'identifiant doit commencer par celui du parent ({loc.parent}.)")
        return self

    def unite(self, pcode: str) -> UniteAdmin:
        return next(u for u in self.unites if u.pcode == pcode)

    def localite(self, ident: str) -> Localite:
        try:
            return next(loc for loc in self.localites if loc.id == ident)
        except StopIteration:
            raise KeyError(f"localité inconnue « {ident} »") from None

    def chemin_admin(self, pcode: str) -> list[UniteAdmin]:
        """De la plus haute unité (pays) à l'unité demandée."""
        out: list[UniteAdmin] = []
        u: UniteAdmin | None = self.unite(pcode)
        while u is not None:
            out.insert(0, u)
            u = self.unite(u.parent) if u.parent else None
        return out

    def ville_de(self, ident: str) -> Localite:
        loc = self.localite(ident)
        while loc.type is not TypeLocalite.VILLE:
            loc = self.localite(loc.parent)
        return loc

    def enfants(self, ident: str) -> list[Localite]:
        return [loc for loc in self.localites if loc.parent == ident]

    def chercher(self, nom: str) -> list[Localite]:
        """Localités dont le nom ou un alias correspond (sans tenir compte des accents ni de la casse)."""
        cle = _cle(nom)
        return [loc for loc in self.localites if cle in {_cle(n) for n in (loc.nom, *loc.alias)}]


def _cle(texte: str) -> str:
    sans = "".join(c for c in unicodedata.normalize("NFD", texte) if unicodedata.category(c) != "Mn")
    return " ".join(sans.lower().replace("-", " ").split())


def lire_admin(chemin: str | Path) -> list[UniteAdmin]:
    with Path(chemin).open(encoding="utf-8", newline="") as f:
        return [UniteAdmin(niveau=int(li["niveau"]), pcode=li["pcode"], nom=li["nom"], nom_en=li["nom_en"], parent=li["parent"])
                for li in csv.DictReader(f)]


def ecrire_admin(unites: list[UniteAdmin], chemin: str | Path) -> Path:
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLONNES_ADMIN)
        w.writeheader()
        for u in sorted(unites, key=lambda u: (u.niveau, u.pcode)):
            w.writerow(u.model_dump())
    return chemin


def charger(dossier: str | Path) -> Referentiel:
    """`dossier` : reference/geo/<PAYS>/ avec admin.csv et localites.yaml."""
    dossier = Path(dossier)
    brut = yaml.safe_load((dossier / "localites.yaml").read_text(encoding="utf-8")) or {}
    return Referentiel(pays=brut["pays"], niveaux={int(k): str(v) for k, v in brut["niveaux"].items()},
                       unites=lire_admin(dossier / "admin.csv"), localites=brut.get("localites") or [])
