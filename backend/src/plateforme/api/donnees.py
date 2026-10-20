"""Données d'un projet pour l'API : base d'analyse livrée (.sav), suivi agrégé des quotas, variables croisables.

Le client ne voit jamais de donnée personnelle : la base d'analyse livrée est anonymisée (contacts dans un fichier
séparé, CLAUDE.md §M14) et le suivi n'affiche que des agrégats cible × ville.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from plateforme.analyse.donnees import JeuDonnees, depuis_sav
from plateforme.projet import projet as pj

EXCLUES = {"NUMFICHE", "ID_CASE", "NUMENQUE", "CODEENQU"}      # identifiants techniques et enquêteurs : jamais croisés


@lru_cache(maxsize=16)
def _sav(chemin: str, mtime: float) -> JeuDonnees:
    return depuis_sav(chemin)


def jeu(chemin: Path) -> JeuDonnees:
    return _sav(str(chemin), chemin.stat().st_mtime)


def variables(jd: JeuDonnees) -> list[dict[str, Any]]:
    """Variables qualitatives croisables : 2 à 30 modalités étiquetées, hors identifiants."""
    out = []
    for nom, v in jd.variables.items():
        if nom in EXCLUES or not 2 <= len(v.valeurs) <= 30 or nom not in jd.table.columns:
            continue
        out.append({"nom": nom, "libelle": v.label or nom,
                    "modalites": [{"code": c, "libelle": lib} for c, lib in sorted(v.valeurs.items()) if c not in v.manquants]})
    return out


def suivi(dossier: Path, jd: JeuDonnees) -> dict[str, Any]:
    """Quotas cible × ville du plan d'échantillonnage face aux fiches de la base (agrégats seulement)."""
    p = pj.charger(dossier)
    pe, t, d = p.exiger_echantillonnage(), p.exiger_terrain(), p.dictionnaire
    qv = next((q.code for q in d.questions if q.prerempli == "ville"), None)
    cible, ville = jd.valides(pe.variable_cible), jd.valides(qv) if qv else None
    lignes: list[dict[str, Any]] = []
    for q in pe.quotas:
        for v in t.villes:
            prevu = q.villes.get(v.id, 0)
            realise = int(((cible == q.code) & (ville == v.code)).sum()) if ville is not None else 0
            lignes.append({"cible": q.cible, "ville": v.libelle, "quota": prevu, "realise": realise,
                           "taux": round(100 * realise / prevu, 1) if prevu else None})
    return {"total_quota": pe.total(), "total_realise": int(sum(li["realise"] for li in lignes)), "lignes": lignes,
            "mention": pe.mention()}
