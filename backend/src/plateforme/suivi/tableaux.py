"""Tableaux de suivi de terrain (onglets TABLEAU_DE_BORD, SUIVI_CIBLES, RECAP_JOURS, TRI_A_PLAT de V11).

Les formules des onglets de V11 sont transposées en calcul direct sur la base de suivi :
- fiches REJETE exclues des comptes (comptées à part), fiches ANNULEE absentes (incident technique) ;
- quotas cible × ville en premier plan ; total général = somme des lignes (contrôle affiché) ;
- écart volontaire avec V11 : l'objectif du jour de RECAP_JOURS y comptait la note de bas d'onglet comme
  un enquêteur (COUNTA sur la colonne des identifiants) ; ici, seuls les enquêteurs déclarés comptent.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from plateforme.suivi.base import Enqueteur, FicheSuivi, Ville


@dataclass(frozen=True)
class ParametresSuivi:
    enqueteurs: list[Enqueteur]
    villes: list[Ville]
    jours: list[str]                                # J1…Jn déclarés (« yyyy-MM-dd »)
    quotas: dict[int, tuple[str, list[int]]]        # code cible -> (libellé, quota par ville)
    objectif_jour: float = 25
    nb_jours: int = 3
    seuil_volume: float = 30
    aujourdhui: str = ""
    variable_cible: str = "VOUSETES"
    code_non_reponse: int = 99


def _valides(base: list[FicheSuivi]) -> list[FicheSuivi]:
    return [o for o in base if not o["_rej"]]


def _rangs(valeurs: list[int]) -> list[int | str]:
    """RANK de Google Sheets (ordre décroissant, ex æquo au même rang) ; vide si la valeur est nulle."""
    return [("" if v == 0 else 1 + sum(1 for w in valeurs if w > v)) for v in valeurs]


@dataclass
class TableauDeBord:
    lignes: list[dict[str, Any]] = field(default_factory=list)
    hors_liste: int = 0
    total: dict[str, Any] = field(default_factory=dict)
    zones: list[dict[str, Any]] = field(default_factory=list)
    total_zones: dict[str, Any] = field(default_factory=dict)
    sans_cible: int = 0


def tableau_de_bord(base: list[FicheSuivi], p: ParametresSuivi) -> TableauDeBord:
    v = _valides(base)
    objectif = p.objectif_jour * p.nb_jours
    tb = TableauDeBord()
    for e in p.enqueteurs:
        siennes = [o for o in v if o.get("CODEENQU") == e.id]
        cumul = len(siennes)
        aujourdhui = sum(1 for o in siennes if o["_jour"] == p.aujourdhui)
        delais = sum(1 for o in siennes if "DELAI_COURT" in str(o.get("ANOMALIE") or ""))
        if not e.zone:
            statut = "⚠ Zone à saisir"
        elif aujourdhui > p.seuil_volume:
            statut = "⚠ Volume suspect"
        elif cumul >= objectif:
            statut = "✔ Objectif atteint"
        elif delais > 0:
            statut = "⚠ Délais courts"
        else:
            statut = "En cours"
        tb.lignes.append({
            "id": e.id, "zone": e.zone, "jours": [sum(1 for o in siennes if o["_jour"] == j) for j in p.jours],
            "aujourdhui": aujourdhui, "cumul": cumul, "objectif": objectif, "realise": cumul / objectif if objectif else 0,
            "delais_courts": delais,
            "a_verifier": sum(1 for o in base if o.get("CODEENQU") == e.id and o.get("STATUTQC") == "A_VERIFIER"),
            "rejetees": sum(1 for o in base if o.get("CODEENQU") == e.id and o["_rej"]), "statut": statut})
    for ligne, rang in zip(tb.lignes, _rangs([li["cumul"] for li in tb.lignes]), strict=True):
        ligne["rang"] = rang
    avec_enq = [o for o in v if o.get("CODEENQU")]
    tb.hors_liste = len(avec_enq) - sum(li["cumul"] for li in tb.lignes)
    obj_total = objectif * len(p.enqueteurs)
    tb.total = {"jours": [sum(1 for o in avec_enq if o["_jour"] == j) for j in p.jours],
                "aujourdhui": sum(1 for o in avec_enq if o["_jour"] == p.aujourdhui), "cumul": len(avec_enq), "objectif": obj_total,
                "realise": len(avec_enq) / obj_total if obj_total else 0,
                "delais_courts": sum(1 for o in v if "DELAI_COURT" in str(o.get("ANOMALIE") or "")),
                "a_verifier": sum(1 for o in base if o.get("STATUTQC") == "A_VERIFIER"), "rejetees": sum(1 for o in base if o["_rej"])}
    for k, z in enumerate(p.villes):
        quota = sum(q[1][k] for q in p.quotas.values())
        cumul = sum(1 for o in v if o.get("CODEZONE") == z.code)
        tb.zones.append({"id": z.id, "enqueteurs": sum(1 for e in p.enqueteurs if e.zone == z.id),
                         "jours": [sum(1 for o in v if o.get("CODEZONE") == z.code and o["_jour"] == j) for j in p.jours],
                         "cumul": cumul, "capacite": objectif * sum(1 for e in p.enqueteurs if e.zone == z.id), "quota": quota,
                         "part_quota": cumul / quota if quota else 0})
    quota_tot = sum(z["quota"] for z in tb.zones)
    tb.total_zones = {"enqueteurs": sum(z["enqueteurs"] for z in tb.zones),
                      "jours": [sum(z["jours"][i] for z in tb.zones) for i in range(len(p.jours))],
                      "cumul": sum(z["cumul"] for z in tb.zones), "capacite": sum(z["capacite"] for z in tb.zones), "quota": quota_tot,
                      "part_quota": sum(z["cumul"] for z in tb.zones) / quota_tot if quota_tot else 0}
    tb.sans_cible = sum(1 for o in avec_enq if o.get(p.variable_cible) == p.code_non_reponse)
    return tb


@dataclass
class SuiviCibles:
    quotas: list[dict[str, Any]] = field(default_factory=list)          # une ligne par cible
    total: dict[str, Any] = field(default_factory=dict)
    sans_cible: list[int] = field(default_factory=list)                 # par ville, puis total
    total_general: list[int] = field(default_factory=list)              # par ville, puis total (= tableau de bord)
    par_jour: list[dict[str, Any]] = field(default_factory=list)         # cible -> [ville × jour] puis [total × jour]
    par_enqueteur: dict[str, list[dict[str, Any]]] = field(default_factory=dict)   # « CUMUL », « JOUR k »


def suivi_cibles(base: list[FicheSuivi], p: ParametresSuivi) -> SuiviCibles:
    v = _valides(base)
    sc = SuiviCibles()
    cv = p.variable_cible
    for code, (lib, qs) in p.quotas.items():
        villes = []
        for k, z in enumerate(p.villes):
            fait = sum(1 for o in v if o.get(cv) == code and o.get("CODEZONE") == z.code)
            villes.append({"quota": qs[k], "realise": fait, "part": fait / qs[k] if qs[k] else 0})
        total_q, total_r = sum(qs), sum(x["realise"] for x in villes)
        sc.quotas.append({"code": code, "cible": lib, "villes": villes, "total": {"quota": total_q, "realise": total_r,
                                                                                 "part": total_r / total_q if total_q else 0}})
        sc.par_jour.append({"code": code, "cible": lib,
                            "villes": [[sum(1 for o in v if o.get(cv) == code and o.get("CODEZONE") == z.code and o["_jour"] == j) for j in p.jours]
                                       for z in p.villes],
                            "total": [sum(1 for o in v if o.get(cv) == code and o["_jour"] == j) for j in p.jours]})
    villes_tot = []
    for k in range(len(p.villes)):
        q = sum(c["villes"][k]["quota"] for c in sc.quotas)
        r = sum(c["villes"][k]["realise"] for c in sc.quotas)
        villes_tot.append({"quota": q, "realise": r, "part": r / q if q else 0})
    tq, tr = sum(x["quota"] for x in villes_tot), sum(x["realise"] for x in villes_tot)
    sc.total = {"villes": villes_tot, "total": {"quota": tq, "realise": tr, "part": tr / tq if tq else 0}}
    sc.sans_cible = [sum(1 for o in v if o.get(cv) == p.code_non_reponse and o.get("CODEZONE") == z.code) for z in p.villes]
    sc.sans_cible.append(sum(1 for o in v if o.get(cv) == p.code_non_reponse and o.get("CODEENQU")))
    sc.total_general = [villes_tot[k]["realise"] + sc.sans_cible[k] for k in range(len(p.villes))]
    sc.total_general.append(sum(1 for o in v if o.get("CODEENQU")))
    for nom, jour in [("CUMUL", None), *[(f"JOUR {i + 1}", j) for i, j in enumerate(p.jours)]]:
        lignes = []
        for e in p.enqueteurs:
            comptes = [sum(1 for o in v if o.get("CODEENQU") == e.id and o.get(cv) == code and (jour is None or o["_jour"] == jour))
                       for code in p.quotas]
            lignes.append({"id": e.id, "zone": e.zone, "cibles": comptes, "total": sum(comptes)})
        sc.par_enqueteur[nom] = lignes
    return sc


def recap_jours(base: list[FicheSuivi], p: ParametresSuivi) -> dict[str, list[Any]]:
    """Indicateurs par jour (J1…Jn) puis cumul. Clé = libellé de l'indicateur."""
    v = _valides(base)
    jours: list[str | None] = [*p.jours, None]

    def du(j: str | None, fs: list[FicheSuivi]) -> list[FicheSuivi]:
        return fs if j is None else [o for o in fs if o["_jour"] == j]

    def avec(mot: str, fs: list[FicheSuivi]) -> int:
        return sum(1 for o in fs if mot in str(o.get("ANOMALIE") or ""))

    nb_enq = len(p.enqueteurs)
    out: dict[str, list[Any]] = {}
    out["Fiches valides"] = [len([o for o in du(j, v) if o.get("CODEENQU")]) for j in jours]
    out["Objectif (enquêteurs × objectif/jour)"] = [nb_enq * p.objectif_jour] * len(p.jours) + [nb_enq * p.objectif_jour * p.nb_jours]
    out["% de l'objectif"] = [f / o if o else "" for f, o in zip(out["Fiches valides"], out["Objectif (enquêteurs × objectif/jour)"], strict=True)]
    out["Enquêteurs ayant produit"] = [len({o.get("CODEENQU") for o in du(j, v)}) for j in jours]
    out["Fiches par enquêteur actif"] = [f / a if a else "" for f, a in zip(out["Fiches valides"], out["Enquêteurs ayant produit"], strict=True)]
    out["Fiches à vérifier"] = [sum(1 for o in du(j, base) if o.get("STATUTQC") == "A_VERIFIER") for j in jours]
    out["% à vérifier"] = [a / f if f else "" for a, f in zip(out["Fiches à vérifier"], out["Fiches valides"], strict=True)]
    out["Fiches rejetées par le superviseur"] = [sum(1 for o in du(j, base) if o["_rej"]) for j in jours]
    out["Fiches sans réponse à la question de cible"] = [
        sum(1 for o in du(j, v) if o.get(p.variable_cible) == p.code_non_reponse and o.get("CODEENQU")) for j in jours]
    out["Fiches vides (aucune question renseignée)"] = [avec("FICHE_VIDE", du(j, v)) for j in jours]
    out["Fiches avec délai court"] = [avec("DELAI_COURT", du(j, v)) for j in jours]
    out["Fiches avec incohérence de réponses"] = [avec("INCOHERENCE", du(j, v)) for j in jours]
    out["Téléphones en double"] = [avec("TEL_DOUBLON", du(j, v)) for j in jours]
    delais = [[o["DELAIPRE"] for o in du(j, v) if isinstance(o.get("DELAIPRE"), int | float) and not isinstance(o.get("DELAIPRE"), bool)]
              for j in jours]
    out["Minutes moyennes entre deux fiches"] = [sum(d) / len(d) if d else "" for d in delais]
    for z in p.villes:
        out[f"Ville : {z.libelle}"] = [sum(1 for o in du(j, v) if o.get("CODEZONE") == z.code) for j in jours]
    return out


@dataclass
class TableTri:
    titre: str
    lignes: list[list[Any]]          # [code, modalité, villes…, total, % base, J1…Jn, % J1…% Jn]
    total: list[Any] | None          # ligne « TOTAL (= base) » (absente pour une modalité de choix multiple)


def tri_a_plat(base: list[FicheSuivi], tables: list[Any], p: ParametresSuivi) -> tuple[int, list[int], list[TableTri]]:
    """Tri à plat par ville et par jour (onglet TRI_A_PLAT de V11) : renvoie (base, base par jour, tables).

    `tables` : gabarit de generateurs/tri_a_plat.py. Ligne TOTAL = base : sinon des fiches manquent ou sont en double.
    """
    v = [o for o in _valides(base) if o.get("CODEENQU")]
    n = len(v)
    par_jour = [sum(1 for o in v if o["_jour"] == j) for j in p.jours]
    resultat = []
    for t in tables:
        lignes = []
        for code, lib in t.lignes:
            villes = [sum(1 for o in v if o.get(t.variable) == code and o.get("CODEZONE") == z.code) for z in p.villes]
            total = sum(1 for o in v if o.get(t.variable) == code)
            jours = [sum(1 for o in v if o.get(t.variable) == code and o["_jour"] == j) for j in p.jours]
            lignes.append([code, lib, *villes, total, total / n if n else 0, *jours,
                           *[(x / b if b else "") for x, b in zip(jours, par_jour, strict=True)]])
        total_ligne = None
        if t.ligne_total:
            k = len(p.villes)
            sommes = [sum(li[2 + i] for li in lignes) for i in range(k + 1)]
            jours_tot = [sum(li[4 + k + i] for li in lignes) for i in range(len(p.jours))]
            total_ligne = ["", "TOTAL (= base)", *sommes, sommes[-1] / n if n else 0, *jours_tot]
        resultat.append(TableTri(t.titre, lignes, total_ligne))
    return n, par_jour, resultat
