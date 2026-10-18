"""Rapport journalier (`calculerRapport_` de V11, rendu générique).

Contenu : synthèse du jour, recommandations pour le lendemain, production par ville, classement des
enquêteurs (score affiché avec sa formule), cibles (Q de cible), tendances comparées aux jours
précédents (commentées seulement au-delà d'une base minimale), questions sautées, rythme horaire.
Un rapport demandé pendant la journée est PROVISOIRE : la production est jugée au prorata du temps
de terrain écoulé (8 h – 18 h par défaut).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.generateurs.masque import Colonne
from plateforme.suivi.base import Enqueteur, FicheSuivi, Ville, arrondi, fixe1, pc, variables_questions

RAPPORT_VARS = ("MAACPLSO", "GAACPLSO", "ORIGPRIV", "PRCRICHO", "PRINFREI", "LIEACHPR", "CANAPREF", "PRETACLI")


@dataclass(frozen=True)
class ParametresRapport:
    jour: str                                   # « yyyy-MM-dd »
    jours: list[str]                            # jours de terrain déclarés
    nb_jours: int
    enqueteurs: list[Enqueteur]
    villes: list[Ville]
    quotas: dict[int, tuple[str, list[int]]]    # code cible -> (libellé, quota par ville dans l'ordre de `villes`)
    objectif_jour: float = 25
    seuil_delai: float = 6
    seuil_volume: float = 30
    maintenant: tuple[str, float] | None = None  # (jour, heure décimale) pour un rapport provisoire
    variables_tendance: tuple[str, ...] = RAPPORT_VARS
    seuil_base_tendance: int = 30
    seuil_ecart_points: float = 10
    seuil_nr_question: float = 0.15
    debut_journee: float = 8
    fin_journee: float = 18


@dataclass
class Rapport:
    partiel: bool
    part: float
    jour: str
    rang: int
    declare: bool
    restants: int
    nJ: int
    objectif: float
    synthese: list[list[Any]] = field(default_factory=list)
    recos: list[list[str]] = field(default_factory=list)
    villes: list[dict[str, Any]] = field(default_factory=list)
    classement: list[dict[str, Any]] = field(default_factory=list)
    cibles: list[dict[str, Any]] = field(default_factory=list)
    tendances: list[dict[str, Any]] = field(default_factory=list)
    nonRep: list[dict[str, Any]] = field(default_factory=list)
    heures: list[list[Any]] = field(default_factory=list)


def _moy(t: list[float]) -> float | None:
    return sum(t) / len(t) if t else None


def calculer_rapport(dico: Dictionnaire, colonnes: list[Colonne], base: list[FicheSuivi], p: ParametresRapport) -> Rapport:
    nr = dico.codes_speciaux.non_reponse
    jour, obj = p.jour, p.objectif_jour
    partiel = bool(p.maintenant and p.maintenant[0] == jour and p.maintenant[1] < p.fin_journee)
    part = min(1.0, max(0.1, (p.maintenant[1] - p.debut_journee) / (p.fin_journee - p.debut_journee))) if partiel and p.maintenant else 1
    obj_score = obj * part
    valides = [o for o in base if not o["_rej"]]
    J = [o for o in valides if o["_jour"] == jour]
    AV = [o for o in valides if o["_jour"] < jour]
    CU = [o for o in valides if o["_jour"] <= jour]
    rejJ = [o for o in base if o["_rej"] and o["_jour"] == jour]
    obs: list[str] = []
    for o in CU:
        if o["_jour"] not in obs:
            obs.append(o["_jour"])
    declare = jour in p.jours
    rang = p.jours.index(jour) + 1 if declare else len(obs)
    restants = sum(1 for d in p.jours if d > jour) if declare else max(0, p.nb_jours - len(obs))

    qv = variables_questions(dico)

    def tx_nr(o: FicheSuivi) -> float:
        return sum(1 for q in qv if o.get(q[0]) == nr) / len(qv)

    def anomalies(o: FicheSuivi) -> list[str]:
        return [x for x in str(o.get("ANOMALIE") or "").split(" | ") if x and x != "ZONE_ENQ_NON_PARAMETREE"]

    def a(o: FicheSuivi, mot: str) -> bool:
        return mot in str(o.get("ANOMALIE") or "")

    # ---------- Classement des enquêteurs ----------
    liste = list(p.enqueteurs)
    connus = {e.id for e in liste}
    for o in J + rejJ:
        i = str(o.get("CODEENQU") or "")
        if i and i not in connus:
            connus.add(i)
            liste.append(Enqueteur(i, "(hors liste)", ""))
    classement: list[dict[str, Any]] = []
    for e in liste:
        f = [o for o in J if o.get("CODEENQU") == e.id]
        rj = sum(1 for o in rejJ if o.get("CODEENQU") == e.id)
        n, tot = len(f), len(f) + rj
        pb = sum(1 for o in f if o.get("STATUTQC") == "A_VERIFIER" and anomalies(o))
        dc = sum(1 for o in f if a(o, "DELAI_COURT"))
        nr_moy = _moy([tx_nr(o) for o in f])
        prod = min(1, n / obj_score) if obj_score > 0 else 0
        score = arrondi(50 * prod + 30 * (1 - (pb + rj) / tot) + 20 * (1 - min(1, (nr_moy or 0) / 0.20))) if tot else 0
        avis = "Très bon" if score >= 80 else "Bon" if score >= 65 else "À suivre" if score >= 50 else "Insuffisant"
        if not tot:
            avis = "Aucune fiche"
        elif n > p.seuil_volume:
            avis = "À contrôler (volume suspect)"
        classement.append({"id": e.id, "nom": e.nom, "zone": e.zone, "n": n, "pObj": n / obj if obj > 0 else None,
                           "cumul": sum(1 for o in CU if o.get("CODEENQU") == e.id), "pb": pb, "rej": rj, "dc": dc, "nr": nr_moy,
                           "tel": sum(1 for o in f if a(o, "TEL_DOUBLON")), "score": score, "avis": avis})
    classement.sort(key=lambda c: (-c["score"], -c["n"], c["id"]))
    for position, ligne in enumerate(classement):
        ligne["rang"] = position + 1

    # ---------- Villes ----------
    villes: list[dict[str, Any]] = []
    for k, z in enumerate(p.villes):
        quota = sum(q[1][k] for q in p.quotas.values())
        n_j = sum(1 for o in J if o.get("CODEZONE") == z.code)
        cu = sum(1 for o in CU if o.get("CODEZONE") == z.code)
        n_enq = sum(1 for e in p.enqueteurs if e.zone == z.id)
        reste = max(0, quota - cu)
        requis = reste / n_enq / restants if reste and restants and n_enq else None
        if not reste:
            etat = "Quota atteint"
        elif not restants:
            etat = f"Quota non atteint : {reste} fiches manquantes"
        elif not n_enq:
            etat = "Aucun enquêteur affecté"
        elif requis is not None and requis <= obj:
            etat = "Atteignable"
        elif requis is not None and requis <= p.seuil_volume:
            etat = "Tendu"
        else:
            etat = "Hors d'atteinte au rythme autorisé"
        villes.append({"z": z, "nJ": n_j, "cumul": cu, "quota": quota, "reste": reste, "nEnq": n_enq, "requis": requis, "etat": etat})

    # ---------- Cibles ----------
    cible = dico.question_cible()
    var_cible = cible.code if cible else "VOUSETES"
    cellules: list[dict[str, Any]] = []
    cibles: list[dict[str, Any]] = []
    for code_cible, (lib, qs) in p.quotas.items():
        n_j = sum(1 for o in J if o.get(var_cible) == code_cible)
        cu = sum(1 for o in CU if o.get(var_cible) == code_cible)
        quota = sum(qs)
        for k, z in enumerate(p.villes):
            r = sum(1 for o in CU if o.get(var_cible) == code_cible and o.get("CODEZONE") == z.code)
            cellules.append({"cible": lib, "ville": z.libelle, "quota": qs[k], "fait": r, "reste": max(0, qs[k] - r),
                             "taux": r / qs[k] if qs[k] else None})
        cibles.append({"lib": lib, "nJ": n_j, "pJ": n_j / len(J) if J else None, "cumul": cu, "quota": quota,
                       "pQ": cu / quota if quota else None, "reste": max(0, quota - cu)})
    sans_q1_j = [o for o in J if o.get(var_cible) == nr]
    sans_q1 = sum(1 for o in CU if o.get(var_cible) == nr)
    if sans_q1:
        cibles.append({"lib": f"Q{cible.numero if cible else 1} non renseignée (code {nr})", "nJ": len(sans_q1_j),
                       "pJ": len(sans_q1_j) / len(J) if J else None, "cumul": sans_q1, "quota": "", "pQ": None, "reste": ""})

    # ---------- Tendances ----------
    par_code = {c.code: c for c in colonnes}
    signaux: list[str] = []
    tendances: list[dict[str, Any]] = []

    def valide_code(o: FicheSuivi, code: str) -> bool:
        v = o.get(code)
        return isinstance(v, int | float) and not isinstance(v, bool) and v < 97

    for code in p.variables_tendance:
        col = par_code[code]
        mods = [m for m in (col.valeurs or ()) if m[0] < 97]
        b_j = [o for o in J if valide_code(o, code)]
        b_a = [o for o in AV if valide_code(o, code)]
        fiable = len(b_j) >= p.seuil_base_tendance and len(b_a) >= p.seuil_base_tendance
        rows: list[dict[str, Any]] = []
        for m in mods:
            n_j = sum(1 for o in b_j if o[code] == m[0])
            n_a = sum(1 for o in b_a if o[code] == m[0])
            p_j = n_j / len(b_j) if b_j else None
            p_a = n_a / len(b_a) if b_a else None
            ec = 100 * (p_j - p_a) if p_j is not None and p_a is not None else None
            sig = ""
            if fiable and ec is not None and abs(ec) >= p.seuil_ecart_points:
                sig = ("▲ +" if ec > 0 else "▼ ") + f"{arrondi(ec)} pts"
                signaux.append(f"{col.label.split('.')[0]} « {m[1]} » : {pc(p_j)} aujourd'hui contre {pc(p_a)} les jours précédents "
                               f"({'+' if ec > 0 else ''}{arrondi(ec)} points)")
            rows.append({"lib": m[1], "nJ": n_j, "pJ": p_j, "pA": p_a, "ec": ec, "sig": sig})
        tete = max(rows, key=lambda x: x["nJ"]) if rows else None              # max() garde le premier à égalité, comme le tri stable de V11
        tendances.append({"code": code, "label": col.label, "baseJ": len(b_j), "baseA": len(b_a), "fiable": fiable, "rows": rows,
                          "tete": tete if tete and tete["nJ"] else None})

    # ---------- Non-réponse par question, rythme horaire ----------
    non_rep: list[dict[str, Any]] = []
    for var, lib in qv:
        n = sum(1 for o in J if o.get(var) == nr)
        if n > 0:
            non_rep.append({"q": lib, "n": n, "tx": n / len(J) if J else None})
    non_rep = sorted(non_rep, key=lambda x: -x["n"])[:10]
    hs = [o["_heure"] for o in J if o.get("_heure") is not None]
    heures = [[f"{h} h", hs.count(h)] for h in range(min(hs), max(hs) + 1)] if hs else []

    # ---------- Synthèse ----------
    a_verif = sum(1 for o in J if o.get("STATUTQC") == "A_VERIFIER")
    actifs = sum(1 for c in classement if c["n"] > 0)
    obj_jour = len(p.enqueteurs) * obj
    quota_tot = sum(v["quota"] for v in villes)
    cu_tot = len(CU)
    nr_jour = _moy([tx_nr(o) for o in J])
    delais = sorted(o["DELAIPRE"] for o in J if isinstance(o.get("DELAIPRE"), int | float) and not isinstance(o.get("DELAIPRE"), bool))
    synthese: list[list[Any]] = [
        ["Fiches valides du jour", len(J), f"objectif {_n(obj_jour)} ({len(p.enqueteurs)} enquêteurs × {_n(obj)}) : {pc(len(J) / obj_jour)}"
         if obj_jour else ""],
        ["Cumul depuis le début du terrain", cu_tot, f"quota total {quota_tot} : {pc(cu_tot / quota_tot)} ; reste {max(0, quota_tot - cu_tot)}"
         if quota_tot else ""],
        ["Enquêteurs ayant produit", actifs, f"sur {len(p.enqueteurs)} inscrits"
         + (f" ; {fixe1(len(J) / actifs)} fiches par enquêteur actif" if actifs else "")],
        ["Fiches à vérifier", a_verif, f"{pc(a_verif / len(J))} des fiches du jour" if J else ""],
        ["Fiches rejetées par le superviseur", len(rejJ), ""],
        ["Taux moyen de questions sans réponse", "—" if nr_jour is None else pc(nr_jour),
         f"part des {len(qv)} questions codées laissées vides (code {nr})"],
        ["Minutes médianes entre deux fiches", delais[len(delais) // 2] if delais else "—", f"seuil d'alerte : {_n(p.seuil_delai)} min"],
        ["Jours de terrain restants", restants, "d'après les dates de l'onglet PARAMETRES" if declare
         else "estimation : ce jour n'est pas déclaré dans PARAMETRES"],
    ]
    if partiel and p.maintenant:
        hh = int(p.maintenant[1])
        mi = arrondi((p.maintenant[1] - hh) * 60)
        synthese.insert(0, ["RAPPORT PROVISOIRE", f"à {hh} h {mi:02d}", f"journée en cours : le classement juge la production sur {pc(part)} "
                            f"de l'objectif du jour ({_n(arrondi(obj_score * 10) / 10)} fiches par enquêteur à cette heure). "
                            "Rapport définitif à 19 h."])

    recos = _recommandations(p, J, classement, villes, cellules, non_rep, sans_q1_j, a_verif, signaux, declare, restants, obj, nr,
                             cible.numero if cible else 1, dico.texte(cible.libelles) if cible else "Vous êtes", a)
    return Rapport(partiel, part, jour, rang, declare, restants, len(J), obj, synthese, recos, villes, classement, cibles, tendances,
                   non_rep, heures)


def _n(x: float) -> str:
    """Nombre affiché comme en JavaScript (25.0 → « 25 »)."""
    return str(int(x)) if float(x).is_integer() else repr(float(x))


def _recommandations(p: ParametresRapport, J: list[FicheSuivi], classement: list[dict[str, Any]], villes: list[dict[str, Any]],
                     cellules: list[dict[str, Any]], non_rep: list[dict[str, Any]], sans_q1_j: list[FicheSuivi], a_verif: int,
                     signaux: list[str], declare: bool, restants: int, obj: float, nr: int, num_cible: int,
                     lib_cible: str, a: Any) -> list[list[str]]:
    R: list[list[str]] = []

    def noms(t: list[dict[str, Any]]) -> str:
        return ", ".join(c["id"] + (f" ({c['nom']})" if c["nom"] and c["nom"] != "(hors liste)" else "") for c in t)

    if not J:
        R.append(["Production", "Aucune fiche valide ce jour : vérifier que les enquêteurs utilisent bien leur lien personnel "
                                "et que le formulaire accepte les réponses."])
    if not declare:
        R.append(["Paramétrage", "Ce jour n'est pas déclaré dans l'onglet PARAMETRES (DATE_J1 à J4) : les colonnes par jour des autres "
                                 "tableaux l'ignorent. Saisir les dates réelles du terrain."])
    for v in villes:
        lib = v["z"].libelle
        if not v["reste"]:
            R.append(["Production", f"{lib} : quota atteint ({v['cumul']}/{v['quota']}). Arrêter la collecte ou réaffecter les enquêteurs "
                                    "vers une ville en retard."])
        elif not restants:
            jours = math.ceil(v["reste"] / max(1, v["nEnq"] * obj))
            R.append(["Production", f"{lib} : il manque {v['reste']} fiches ({v['cumul']}/{v['quota']}) et aucun jour de terrain ne reste. "
                                    f"Prévoir une journée de rattrapage : environ {jours} jour(s) avec {v['nEnq']} enquêteur(s)."])
        elif v["requis"] is not None:
            texte = (f"{lib} : reste {v['reste']} fiches, soit {fixe1(v['requis'])} par enquêteur et par jour sur {restants} jour(s) "
                     f"({v['etat'].lower()}).")
            if v["requis"] > obj:
                texte += f" Renforcer l'équipe ou ajouter un jour : au-delà de {_n(obj)} fiches/jour, la qualité des entretiens baisse."
            R.append(["Production", texte])
        else:
            R.append(["Production", f"{lib} : {v['etat'].lower()} (reste {v['reste']} fiches)."])
    retard = sorted([c for c in cellules if c["reste"] > 0 and c["quota"]], key=lambda x: (x["taux"], -x["reste"]))[:5]
    if retard:
        R.append(["Cibles", "À rechercher en priorité demain : " + " ; ".join(f"{c['cible']} à {c['ville']} ({c['fait']}/{c['quota']})"
                                                                             for c in retard) + "."])
    pleines = [c for c in cellules if c["quota"] and c["fait"] >= c["quota"]]
    if pleines:
        R.append(["Cibles", "Quota atteint, ne plus interroger : " + " ; ".join(f"{c['cible']} à {c['ville']} ({c['fait']}/{c['quota']})"
                                                                               for c in pleines) + "."])

    def grp(av: str) -> list[dict[str, Any]]:
        return [c for c in classement if c["avis"] == av]

    if grp("Très bon"):
        R.append(["Enquêteurs", f"Très bon travail : {noms(grp('Très bon'))}. À citer en exemple au briefing ; leur confier les cibles difficiles."])
    if grp("À suivre"):
        R.append(["Enquêteurs", f"À suivre de près : {noms(grp('À suivre'))}. Faire le point avec chacun avant le départ sur le terrain."])
    if grp("Insuffisant"):
        R.append(["Enquêteurs", f"Travail insuffisant : {noms(grp('Insuffisant'))}. Entretien individuel, puis accompagnement en binôme sur "
                                "les premières fiches."])
    if grp("Aucune fiche"):
        R.append(["Enquêteurs", f"Aucune fiche ce jour : {noms(grp('Aucune fiche'))}. Vérifier la présence, le lien utilisé et la connexion."])
    suspects = grp("À contrôler (volume suspect)")
    if suspects:
        R.append(["Enquêteurs", f"Volume anormalement élevé (plus de {_n(p.seuil_volume)} fiches) : {noms(suspects)}. Rappeler 5 enquêtés "
                                "par téléphone avant de valider leurs fiches."])
    for c in classement:
        if c["dc"] >= 3 or (c["n"] >= 5 and c["dc"] / c["n"] >= 0.2):
            R.append(["Contrôle", f"{c['id']} : {c['dc']} fiche(s) à moins de {_n(p.seuil_delai)} minutes de la précédente. Rappeler au moins 3 "
                                  "de ces enquêtés par téléphone pour confirmer l'entretien."])
    for c in classement:
        if c["n"] >= 5 and c["nr"] is not None and c["nr"] >= p.seuil_nr_question:
            R.append(["Qualité", f"{c['id']} laisse {pc(c['nr'])} des questions sans réponse. Lui rappeler de poser toutes les questions jusqu'à Q41."])
    sautees = [x for x in non_rep if x["tx"] is not None and x["tx"] >= p.seuil_nr_question][:5]
    if sautees:
        R.append(["Qualité", "Questions les plus sautées : " + ", ".join(f"{x['q'].split('.')[0]} ({pc(x['tx'])})" for x in sautees)
                  + ". Les reformuler au briefing ; envisager de les rendre obligatoires dans le formulaire."])
    if sans_q1_j:
        R.append(["Contrôle", f"{len(sans_q1_j)} fiche(s) du jour sans réponse à Q{num_cible} « {lib_cible} » ("
                              + ", ".join(str(o.get("NUMFICHE")) for o in sans_q1_j)
                              + ") : inutilisables pour les quotas. Les passer en REJETE dans MASQUE_DEPOUILLEMENT, puis rappeler aux "
                                "enquêteurs concernés de recharger le formulaire avant chaque fiche."])
    if a_verif:
        R.append(["Contrôle", f"{a_verif} fiche(s) à vérifier : le superviseur les traite ce soir dans MASQUE_DEPOUILLEMENT (colonne STATUTQC : "
                              "OK ou REJETE)."])
    tel = sum(1 for o in J if a(o, "TEL_DOUBLON"))
    if tel:
        R.append(["Contrôle", f"{tel} fiche(s) avec un téléphone déjà enregistré : la même personne a peut-être été interrogée deux fois."])
    sans_zone = [c for c in classement if not c["zone"] and c["nom"] != "(hors liste)"]
    if sans_zone:
        R.append(["Paramétrage", f"Zone non saisie dans l'onglet ENQUETEURS pour {noms(sans_zone)} : la saisir puis exécuter actualiser()."])
    hors = [c for c in classement if c["nom"] == "(hors liste)"]
    if hors:
        R.append(["Paramétrage", f"Des fiches portent un identifiant absent de l'onglet ENQUETEURS : {noms(hors)}."])
    for s in signaux[:6]:
        R.append(["Tendance", f"{s}. Vérifier s'il s'agit d'un effet de cible ou de quartier avant de conclure."])
    if J and len(J) < p.seuil_base_tendance:
        R.append(["Lecture", f"Moins de {p.seuil_base_tendance} fiches ce jour : les pourcentages du jour sont indicatifs, ne pas en tirer de conclusion."])
    return R
