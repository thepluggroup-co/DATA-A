"""Projet : manifeste (projet.yaml) qui relie le brief, les tarifs, le cabinet, le vivier, le dictionnaire, le référentiel
géographique, le gabarit de chronogramme et les deux plans ; contrôle de cohérence entre toutes ces sources.

La cohérence croisée rend impossible le défaut vécu sur l'EDM (trois listes de cibles différentes) : cibles, villes,
personnes et localités doivent être les mêmes partout.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field

from plateforme.dictionnaire import fichiers
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.echantillonnage import plan as plan_ech
from plateforme.echantillonnage.plan import PlanEchantillonnage
from plateforme.geo import referentiel as geo
from plateforme.geo.referentiel import Referentiel, TypeLocalite
from plateforme.projet import initialiser
from plateforme.projet.brief import Brief, Cabinet, Tarifs, charger_brief, charger_cabinet, charger_tarifs
from plateforme.terrain import plan as plan_terrain
from plateforme.terrain import vivier as viv
from plateforme.terrain.chronogramme import Chronogramme, Gabarit, ancres_du_terrain, charger_gabarit, planifier
from plateforme.terrain.plan import PlanTerrain, Role
from plateforme.terrain.vivier import MOBILISABLES, Vivier


class Manifeste(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    brief: str
    tarifs: str
    cabinet: str
    vivier: str
    dictionnaire: str
    referentiel: str
    gabarit_chronogramme: str
    plan_echantillonnage: str
    plan_terrain: str
    encadrement: dict[str, str] = Field(default_factory=dict)
    vivier_versionne: bool = Field(default=True, description="Vivier dans le dépôt : personnes fictives seulement")


@dataclass
class Projet:
    dossier: Path
    manifeste: Manifeste
    brief: Brief
    tarifs: Tarifs
    cabinet: Cabinet
    vivier: Vivier
    dictionnaire: Dictionnaire
    referentiel: Referentiel
    gabarit: Gabarit
    echantillonnage: PlanEchantillonnage | None = None
    terrain: PlanTerrain | None = None

    def chemin(self, relatif: str) -> Path:
        return (self.dossier / relatif).resolve()

    def chronogramme(self) -> Chronogramme:
        t = self.exiger_terrain()
        ancres = ancres_du_terrain(t.calendrier.formation, t.calendrier.pre_test, t.jours_ouvres())
        return planifier(self.gabarit, self.brief.debut, self.brief.type.value, t.calendrier.jours_non_ouvres, ancres)

    def exiger_terrain(self) -> PlanTerrain:
        if self.terrain is None:
            raise ValueError("plan de terrain absent : lancer « plateforme projet initialiser »")
        return self.terrain

    def exiger_echantillonnage(self) -> PlanEchantillonnage:
        if self.echantillonnage is None:
            raise ValueError("plan d'échantillonnage absent : lancer « plateforme projet initialiser »")
        return self.echantillonnage


def charger(dossier: str | Path) -> Projet:
    dossier = Path(dossier)
    m = Manifeste.model_validate(yaml.safe_load((dossier / "projet.yaml").read_text(encoding="utf-8")))
    p = Projet(dossier=dossier, manifeste=m, brief=charger_brief(dossier / m.brief), tarifs=charger_tarifs(dossier / m.tarifs),
               cabinet=charger_cabinet(dossier / m.cabinet), vivier=viv.charger(dossier / m.vivier, versionne=m.vivier_versionne),
               dictionnaire=fichiers.charger(dossier / m.dictionnaire), referentiel=geo.charger(dossier / m.referentiel),
               gabarit=charger_gabarit(dossier / m.gabarit_chronogramme))
    if (dossier / m.plan_echantillonnage).exists():
        p.echantillonnage = plan_ech.charger(dossier / m.plan_echantillonnage)
    if (dossier / m.plan_terrain).exists():
        p.terrain = plan_terrain.charger(dossier / m.plan_terrain)
    return p


def initialiser_plans(p: Projet, ecraser: bool = False) -> tuple[Path, Path]:
    """Rédige les deux plans depuis le brief. Refus d'écraser un plan existant sans `ecraser` (il a pu être affiné)."""
    cible = p.dictionnaire.question_cible()
    if cible is None:
        raise ValueError("le dictionnaire ne déclare pas de question « cible » (quotas)")
    sorties = (p.dossier / p.manifeste.plan_echantillonnage, p.dossier / p.manifeste.plan_terrain)
    if not ecraser and any(s.exists() for s in sorties):
        raise FileExistsError("plans déjà présents : relancer avec --ecraser pour les régénérer depuis le brief")
    contenus: list[dict[str, Any]] = [
        initialiser.plan_echantillonnage(p.brief, cible.code),
        initialiser.plan_terrain(p.brief, p.tarifs, p.referentiel, p.gabarit, p.vivier, p.manifeste.encadrement, p.cabinet)]
    entete = "# Généré par « plateforme projet initialiser » depuis le brief {v} ; à affiner ici (source de vérité), puis régénérer les documents.\n"
    for chemin, contenu in zip(sorties, contenus, strict=True):
        chemin.write_text(entete.format(v=p.brief.version) + yaml.safe_dump(contenu, allow_unicode=True, sort_keys=False, width=150),
                          encoding="utf-8")
    p.echantillonnage, p.terrain = plan_ech.charger(sorties[0]), plan_terrain.charger(sorties[1])
    return sorties


def verifier(p: Projet) -> list[str]:
    """Écarts entre les sources du projet (liste vide = cohérent)."""
    out: list[str] = []
    pe, t, d, ref = p.exiger_echantillonnage(), p.exiger_terrain(), p.dictionnaire, p.referentiel
    # cibles : brief = plan d'échantillonnage = question cible du dictionnaire
    q = d.question_cible()
    cibles_brief = {c.code: c.libelle for c in p.brief.cibles}
    cibles_plan = {x.code: x.cible for x in pe.quotas}
    cibles_dico = {m.code: d.texte(m.libelles) for m in q.modalites} if q else {}
    if cibles_brief != cibles_plan or cibles_brief != cibles_dico:
        out.append(f"cibles différentes : brief {cibles_brief}, plan {cibles_plan}, dictionnaire {cibles_dico}")
    if q is None or pe.variable_cible != q.code:
        out.append(f"variable de quota « {pe.variable_cible} » ≠ question cible du dictionnaire")
    # villes : brief = plans = référentiel = modalités de la question ville
    if p.brief.villes != [v.id for v in t.villes] or set(p.brief.villes) != set(pe.villes):
        out.append(f"villes différentes : brief {p.brief.villes}, terrain {[v.id for v in t.villes]}, quotas {pe.villes}")
    qv = next((x for x in d.questions if x.prerempli == "ville"), None)
    if qv is not None and [(m.code, d.texte(m.libelles)) for m in qv.modalites] != [(v.code, v.libelle) for v in t.villes]:
        out.append("modalités de la question « ville » différentes des villes du plan de terrain (codes ou libellés)")
    for v in t.villes:
        if v.localite is None:
            out.append(f"{v.id} : ville non rattachée au référentiel géographique")
            continue
        try:
            if ref.localite(v.localite).type is not TypeLocalite.VILLE:
                out.append(f"{v.id} : « {v.localite} » n'est pas une ville du référentiel")
        except KeyError as err:
            out.append(str(err))
    for z in t.zones:
        for loc in z.localites:
            try:
                if ref.ville_de(loc).id != t.ville(z.ville).localite:
                    out.append(f"zone {z.id} : « {loc} » n'est pas dans la ville {z.ville}")
            except KeyError as err:
                out.append(f"zone {z.id} : {err}")
    # personnes : connues du vivier, mobilisables, une seule fois
    occupees: dict[str, str] = {}
    for e in t.enqueteurs:
        ids = ([e.personne] if e.personne else []) + [a.personne_id for a in e.affectations if a.personne_id]
        for pid in ids:
            try:
                pers = p.vivier.personne(pid)
            except KeyError as err:
                out.append(f"{e.id} : {err}")
                continue
            if pers.statut not in MOBILISABLES:
                out.append(f"{e.id} : {pid} n'est pas mobilisable (statut « {pers.statut} »)")
            if pid in occupees:
                out.append(f"{pid} occupe deux postes ({occupees[pid]} et {e.id})")
            occupees[pid] = e.id
        if e.role is Role.TITULAIRE and not ids:
            out.append(f"{e.id} : poste titulaire sans personne")
    for m in t.equipe:
        if m.personne:
            try:
                p.vivier.personne(m.personne)
            except KeyError as err:
                out.append(f"{m.id} : {err}")
    out += plan_ech.verifier(pe, t)
    chrono = p.chronogramme()
    out += chrono.anomalies
    if chrono.fin > p.brief.echeance:
        out.append(f"le chronogramme finit le {chrono.fin:%d/%m/%Y}, après l'échéance du {p.brief.echeance:%d/%m/%Y}")
    return out
