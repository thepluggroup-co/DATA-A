"""Initialisation des plans depuis le brief (sans ressaisie) : le brief, les tarifs de l'usine, le référentiel géographique
et le vivier suffisent à rédiger un plan d'échantillonnage et un plan de terrain complets, que l'équipe affine ensuite.

Règles :
- quotas : effectif du brief réparti par ville (poids des villes) puis par cible (poids des cibles), au plus fort reste ;
- enquêteurs : pré-estimation (fiches de la ville / (objectif journalier × jours)), plus les réserves des tarifs ;
- zones : une par titulaire, chacune recevant une part contiguë des quartiers et points de la ville (référentiel) ;
- personnes : meilleurs scores mobilisables du vivier dans la ville (titulaires, puis réserves) ; encadrement donné ;
- dates : chronogramme du gabarit à partir du démarrage du brief (formation, pré-test, jours de collecte).
"""

from __future__ import annotations

from typing import Any

from plateforme.echantillonnage.plan import repartir
from plateforme.geo.referentiel import Referentiel
from plateforme.projet.brief import Brief, Cabinet, Tarifs, pre_estimation
from plateforme.terrain.chronogramme import Gabarit, jours_ouvres_entre, planifier
from plateforme.terrain.vivier import MOBILISABLES, Vivier


def plan_echantillonnage(brief: Brief, variable_cible: str) -> dict[str, Any]:
    rep = brief.repartition()
    return {
        "etude": brief.etude, "version": brief.version, "methode": "quotas", "variable_cible": variable_cible,
        **({"taille": brief.taille.model_dump()} if not isinstance(brief.taille, int) else {}),
        "quotas": {c.code: {"cible": c.libelle, **{v: rep[v][c.code] for v in brief.villes}} for c in brief.cibles},
    }


def plan_terrain(brief: Brief, tarifs: Tarifs, ref: Referentiel, gabarit: Gabarit, vivier: Vivier | None = None,
                 encadrement: dict[str, str] | None = None, cabinet: Cabinet | None = None) -> dict[str, Any]:
    """`encadrement` : {identifiant d'équipe : personne du vivier} (EXPERT, APPUI_1, SUP_<VILLE>…)."""
    pre = pre_estimation(brief, tarifs)
    chrono = planifier(gabarit, brief.debut, brief.type.value, durees={"COLLECTE": tarifs.jours_terrain})
    collecte, formation, pretest = chrono.tache("COLLECTE"), chrono.tache("FORM"), chrono.tache("PRETEST")
    enc = encadrement or {}
    villes, zones, enqueteurs, equipe = [], [], [], []
    for m_id, fonction in (("EXPERT", "expert"), ("APPUI_1", "appui_1")):
        equipe.append({"id": m_id, "fonction": fonction, **({"personne": enc[m_id]} if m_id in enc else {})})
    numero = 0
    deja: set[str] = set(enc.values())
    for k, vid in enumerate(brief.villes, start=1):
        loc = ref.localite(vid)
        sup = f"SUP_{vid}"
        equipe.append({"id": sup, "fonction": "superviseur", "ville": vid, **({"personne": enc[sup]} if sup in enc else {})})
        villes.append({"code": k, "id": vid, "libelle": loc.nom, "prefixe": loc.prefixe(), "localite": vid, "superviseur": sup})
        titulaires = pre.enqueteurs[vid]
        lieux = [x.id for x in ref.localites if x.parent == vid or (x.parent and ref.ville_de(x.id).id == vid and x.id != vid)]
        lieux = list(dict.fromkeys(lieux))
        parts = repartir(len(lieux), {str(z): 1 for z in range(titulaires)}) if lieux else {str(z): 0 for z in range(titulaires)}
        debut_lieux = 0
        candidats = [p for p, _ in vivier.classement(vid)] if vivier else []
        candidats = [p for p in candidats if p.statut in MOBILISABLES and p.id not in deja]
        for z in range(titulaires):
            zid = f"{loc.prefixe()}_Z{z + 1}"
            n = parts[str(z)]
            zones.append({"id": zid, "ville": vid, "libelle": f"Zone {z + 1}", "localites": lieux[debut_lieux:debut_lieux + n]})
            debut_lieux += n
            numero += 1
            poste: dict[str, Any] = {"id": f"ENQ{numero}", "ville": vid, "zones": [zid]}
            if candidats:
                poste["personne"] = candidats.pop(0).id
                deja.add(poste["personne"])
            enqueteurs.append(poste)
        for _ in range(tarifs.reserve_par_ville):
            numero += 1
            poste = {"id": f"ENQ{numero}", "ville": vid, "role": "reserve"}
            if candidats:
                poste["personne"] = candidats.pop(0).id
                deja.add(poste["personne"])
            enqueteurs.append(poste)
    return {
        "etude": brief.etude, "fuseau": "Africa/Douala", "pays": brief.pays,
        "objectif_total": pre.effectif, "objectif_jour": tarifs.objectif_jour, "nb_jours": tarifs.jours_terrain,
        "jours": [j.isoformat() for j in jours_ouvres_entre(collecte.debut, collecte.fin, set())],
        "villes": villes, "zones": zones, "enqueteurs": enqueteurs, "equipe": equipe,
        "calendrier": {"formation": formation.debut.isoformat(), "pre_test": pretest.debut.isoformat()},
        "baremes": tarifs.baremes,
        **({"url_verification": cabinet.url_verification} if cabinet and cabinet.url_verification else {}),
    }
