"""Plan d'analyse (YAML) : valeurs manquantes par variable, variables dérivées et tableaux de résultats ; jeu de données
depuis la base codée."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from plateforme.analyse.derivees import Derivation, appliquer
from plateforme.analyse.donnees import JeuDonnees, Variable
from plateforme.analyse.tableaux import Tableau, depuis_yaml
from plateforme.codification.fiche import FicheCodee
from plateforme.generateurs.masque import Colonne

CHAMPS = {"nom", "label", "valeurs", "manquants", "mesure", "recode", "calcul", "etapes", "compte", "premier", "source"}


@dataclass
class PlanAnalyse:
    manquants_defaut: list[float] = field(default_factory=list)
    manquants: dict[str, list[float]] = field(default_factory=dict)
    derivations: list[Derivation] = field(default_factory=list)
    tableaux: list[Tableau] = field(default_factory=list)


def charger(chemin: str | Path) -> PlanAnalyse:
    brut: dict[str, Any] = yaml.safe_load(Path(chemin).read_text(encoding="utf-8"))
    m = dict(brut.get("manquants") or {})
    defaut = [float(x) for x in m.pop("defaut", [])]
    derivations = []
    for d in brut.get("derivations") or []:
        inconnus = set(d) - CHAMPS
        if inconnus:
            raise ValueError(f"{d.get('nom')} : champs inconnus {sorted(inconnus)}")
        derivations.append(Derivation(nom=d["nom"], label=d.get("label", ""), valeurs={float(k): str(v) for k, v in (d.get("valeurs") or {}).items()},
                                      manquants=[float(x) for x in d.get("manquants", [])], mesure=d.get("mesure", "nominal"),
                                      recode=d.get("recode"), calcul=d.get("calcul"), etapes=d.get("etapes"), compte=d.get("compte"),
                                      premier=d.get("premier"), source=d.get("source", "")))
    return PlanAnalyse(defaut, {k: [float(x) for x in v] for k, v in m.items()}, derivations, depuis_yaml(brut.get("tableaux") or []))


def jeu_depuis_fiches(colonnes: list[Colonne], fiches: list[FicheCodee], plan: PlanAnalyse, deriver: bool = True,
                      controles: tuple[dict[str, dict[str, Any]], dict[str, Variable]] | None = None) -> JeuDonnees:
    """Jeu de données d'analyse depuis la base codée : codes bruts + manquants du plan, variables de contrôle de la
    plateforme (analyse/controle.py, si fournies), puis variables dérivées (qui peuvent utiliser les précédentes)."""
    import pandas as pd

    table = pd.DataFrame([{c.code: f.valeurs.get(c.code, "") for c in colonnes} for f in fiches], columns=[c.code for c in colonnes])
    variables = {}
    for c in colonnes:
        if c.est_numerique():
            table[c.code] = pd.to_numeric(table[c.code], errors="coerce")
        manq = plan.manquants.get(c.code, plan.manquants_defaut if c.valeurs else [])
        variables[c.code] = Variable(c.code, c.label, {float(k): v for k, v in (c.valeurs or ())}, set(manq),
                                     (c.mesure or "nominal").lower())
    if controles is not None:
        valeurs, metas = controles
        for nom, meta in metas.items():
            table[nom] = pd.to_numeric(pd.Series([valeurs.get(f.id_reponse, {}).get(nom) for f in fiches], index=table.index), errors="coerce")
            variables[nom] = meta
    jd = JeuDonnees(table, variables, description=f"base codée ({len(fiches)} fiches)")
    return appliquer(jd, plan.derivations) if deriver else jd
