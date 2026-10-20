"""Génération de tous les documents du projet, en une fois, depuis ses sources ; refus si les sources sont incohérentes.

Un manifeste (MANIFESTE_DOCUMENTS.json) garde l'empreinte de chaque source et la liste des documents produits : à la
régénération suivante, il dit quelles sources ont changé (rapport de différences, CLAUDE.md §2).
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from plateforme.documents import badges, enqueteur, formation, gestion
from plateforme.projet.projet import Projet, verifier

GENERATEURS: list[tuple[str, Callable[[Projet, Path, bool], list[Path]]]] = [
    ("Cahier des charges", gestion.cahier_des_charges),
    ("Chronogramme", gestion.chronogramme),
    ("Organisation du terrain", gestion.organisation),
    ("Badges", badges.produire),
    ("Charte de l'enquêteur", enqueteur.charte),
    ("Ordres de mission", enqueteur.ordres_de_mission),
    ("Contrats de prestation", enqueteur.contrats),
    ("Engagements de confidentialité", enqueteur.engagements),
    ("Support de formation", formation.support),
    ("Quiz de formation", formation.quiz_docx),
    ("Fiche profil des paiements et devis", gestion.paiements),
]


class ProjetIncoherent(ValueError):
    def __init__(self, ecarts: list[str]) -> None:
        super().__init__("sources du projet incohérentes :\n- " + "\n- ".join(ecarts))
        self.ecarts = ecarts


def empreintes(p: Projet) -> dict[str, str]:
    m = p.manifeste
    fichiers = {"brief": m.brief, "tarifs": m.tarifs, "cabinet": m.cabinet, "vivier": m.vivier, "dictionnaire": m.dictionnaire,
                "plan_echantillonnage": m.plan_echantillonnage, "plan_terrain": m.plan_terrain,
                "gabarit_chronogramme": m.gabarit_chronogramme, "referentiel_localites": f"{m.referentiel}/localites.yaml",
                "referentiel_admin": f"{m.referentiel}/admin.csv"}
    return {nom: hashlib.sha256(p.chemin(rel).read_bytes()).hexdigest() for nom, rel in fichiers.items() if p.chemin(rel).exists()}


def produire(p: Projet, dossier: Path, en_pdf: bool = False) -> tuple[dict[str, list[Path]], list[str]]:
    """({document : fichiers}, sources modifiées depuis la génération précédente)."""
    ecarts = verifier(p)
    if ecarts:
        raise ProjetIncoherent(ecarts)
    dossier.mkdir(parents=True, exist_ok=True)
    manifeste = dossier / "MANIFESTE_DOCUMENTS.json"
    avant = json.loads(manifeste.read_text(encoding="utf-8")).get("sources", {}) if manifeste.exists() else {}
    sources = empreintes(p)
    modifiees = sorted(k for k in sources if avant and avant.get(k) != sources[k])
    ecrits = {nom: gen(p, dossier, en_pdf) for nom, gen in GENERATEURS}
    manifeste.write_text(json.dumps({
        "etude": p.brief.etude, "cahier_des_charges": p.brief.version, "genere_le": datetime.now().isoformat(timespec="seconds"),
        "sources": sources, "sources_modifiees": modifiees,
        "documents": {nom: [f.name for f in fs] for nom, fs in ecrits.items()}}, ensure_ascii=False, indent=2), encoding="utf-8")
    return ecrits, modifiees
