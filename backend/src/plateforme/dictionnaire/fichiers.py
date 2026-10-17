"""Lecture et écriture d'un dictionnaire au format YAML (fichier lisible et versionnable)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from plateforme.dictionnaire.modele import Dictionnaire


def _alleger(valeur: Any, profondeur: int = 0) -> Any:
    """Retire les champs vides (None, [], {}) sous le premier niveau, pour un YAML lisible."""
    if isinstance(valeur, dict):
        sortie = {}
        for k, v in valeur.items():
            v = _alleger(v, profondeur + 1)
            if profondeur > 0 and (v is None or v == [] or v == {}):
                continue
            sortie[k] = v
        return sortie
    if isinstance(valeur, list):
        return [_alleger(v, profondeur + 1) for v in valeur]
    return valeur


def vers_texte(dico: Dictionnaire) -> str:
    donnees = _alleger(dico.model_dump(mode="json"))
    return yaml.safe_dump(donnees, allow_unicode=True, sort_keys=False, width=160)


def depuis_texte(texte: str) -> Dictionnaire:
    return Dictionnaire.model_validate(yaml.safe_load(texte))


def charger(chemin: str | Path) -> Dictionnaire:
    return depuis_texte(Path(chemin).read_text(encoding="utf-8"))


def enregistrer(dico: Dictionnaire, chemin: str | Path, entete: str = "") -> None:
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    prefixe = "".join(f"# {ligne}\n" for ligne in entete.splitlines()) if entete else ""
    chemin.write_text(prefixe + vers_texte(dico), encoding="utf-8")
