"""Rapport déclaré dans un fichier YAML du projet, calculé sur les bases de la plateforme.

Format (une liste `elements`, dans l'ordre du rapport) :
    titre: "…"
    termes_interdits: [boissons, …]            # propres au projet (autres études, villes hors périmètre…)
    charte: charte.yaml                         # charte graphique de l'étude (D-039), chemin relatif à ce fichier
    elements:
      - {section: "Synthèse exécutive", niveau: 1}
      - {section: "Conclusions", niveau: 1, role: conclusions}
      - {texte: "Schneider est citée par [[marques.pct(1)]] % des acheteurs (tableau 7)."}
      - {tableau: "7", id: marques, titre: "…", source: "N08:136-142", procedure: frequences, arguments: {variable: MARQUE_G}}
      - {figure: "11", id: produits, titre: "…", legende: "…", source: "…", procedure: reponses_multiples, arguments: {…},
         filtre: "PROFIL4 == 2", base: collecte}
`procedure`, `arguments` et `filtre` : comme les tableaux du plan d'analyse (analyse/tableaux.py). `base` : « analyse »
(défaut, fiches retenues) ou « collecte » (fiches valides). La note de base sous chaque élément est générée.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from plateforme.analyse import procedures as p
from plateforme.analyse.donnees import JeuDonnees
from plateforme.analyse.rapport.modele import AFFICHAGES, FORMES, BaseEtude, Calcul, Element, Figure, Paragraphe, Rapport, TableauRapport, Titre, nombre_fr
from plateforme.analyse.tableaux import Tableau, calculer
from plateforme.codification.qualite import NoteDeBase
from plateforme.terrain.plan import PlanTerrain

CHAMPS = {"source_affichee", "questionnaire", "section", "niveau", "role", "texte", "tableau", "figure", "id", "titre", "legende", "source",
          "procedure", "arguments", "filtre", "base", "forme", "affichage", "contenu", "calcul"}


class RapportInvalide(ValueError):
    """Déclaration du rapport mal formée."""


def filtre_lisible(filtre: str, jd: JeuDonnees | None) -> str:
    """« VILLEREG == 1 » → « Q4. Ville / région = Douala » ; toute autre forme est rendue telle quelle."""
    m = re.fullmatch(r"\s*([A-Z][A-Z0-9_]*)\s*==\s*(\d+(?:\.\d+)?)\s*", filtre)
    if not m or jd is None or m[1] not in jd.variables:
        return filtre
    v = jd.variables[m[1]]
    return f"{v.label or m[1]} = {v.valeurs.get(float(m[2]), m[2])}"


def note_base(r: p.Resultat, base: str, jd: JeuDonnees | None = None) -> str:
    """Note de base affichée sous un tableau ou une figure : effectif, population, pondération, filtre."""
    population = "fiches collectées valides" if base == "collecte" else "fiches retenues"
    filtre = next((a.removeprefix("filtre : ") for a in r.avertissements if a.startswith("filtre : ")), "")
    if filtre:
        expression, _, reste = filtre.partition(" (")
        filtre = filtre_lisible(expression, jd) + (f" ({reste}" if reste else "")
    if isinstance(r, p.Indicateurs):
        bases = [int(n) for _, _, _, n in r.lignes]
        texte = f"Base : {r.base} {population} ; base de chaque indicateur de {min(bases)} à {max(bases)} (réponses valides)"
    elif isinstance(r, p.Frequences) and r.manquants:
        texte = f"Base : {r.base} répondants ({r.manquants} sans réponse valide exclus)"
    elif isinstance(r, p.Batterie):
        bases = [f.base for f in r.frequences.values()]
        texte = (f"Base : {min(bases)} à {max(bases)} répondants selon la question" if min(bases) != max(bases)
                 else f"Base : {bases[0]} répondants")
    elif isinstance(r, p.Repartitions):
        morceaux = [f"{f.base} ({titre})" for titre, f in r.parts.items()]
        texte = "Base : n = " + (" et ".join([", ".join(morceaux[:-1]), morceaux[-1]]) if len(morceaux) > 1 else morceaux[0])
    elif isinstance(r, p.ReponsesMultiples):
        texte = f"Base : {r.base} répondants ayant cité au moins une modalité ; total supérieur à 100 % (plusieurs réponses)"
    else:
        repondants = isinstance(r, p.Frequences | p.TriCroise | p.Moyenne | p.Correspondances | p.PartsBootstrap)
        texte = f"Base : {r.base} {'répondants' if repondants else population}"
    if filtre:
        texte += f" ; sous-population : {filtre}"
    if r.ponderation:
        texte += f" ; pondération : {r.ponderation}"
    return texte + "."


def chiffres_de_base(note: NoteDeBase) -> dict[str, float]:
    """Chiffres de la note de base citables dans le texte : « collectees » = fiches valides collectées (446 pour l'EDM),
    « recues » = toutes les réponses reçues, y compris les annulées."""
    remplissage = next((n for m, n in note.ecartees.items() if m.startswith("remplissage")), 0)
    return {"recues": note.collectees, "annulees": note.annulees, "rejetees": note.rejetees, "collectees": note.valides,
            "ecartees": note.valides - note.retenues, "remplissage": remplissage, "copies": note.ecartees.get("copies probables", 0),
            "retenues": note.retenues}


def quotas_du_plan(plan_echantillonnage: str | Path, terrain: PlanTerrain) -> dict[float, dict[float, int]]:
    """Quotas du plan d'échantillonnage (2e source de vérité) : {code cible: {code ville: quota}}, codes de ville du plan
    de terrain (VILLEREG)."""
    from plateforme.echantillonnage.plan import charger as charger_plan

    pe = charger_plan(plan_echantillonnage)
    return {float(q.code): {float(v.code): q.villes[v.id] for v in terrain.villes if v.id in q.villes} for q in pe.quotas}


def _arguments(d: dict[str, Any], contexte: dict[str, Any], k: int) -> dict[str, Any]:
    """Arguments d'une procédure ; une valeur « @nom » est remplacée par contexte[nom] (ex. « @quotas » = quotas du plan
    d'échantillonnage : le rapport ne recopie jamais une donnée d'un autre objet du projet)."""
    out = {}
    for nom, valeur in dict(d.get("arguments") or {}).items():
        if isinstance(valeur, str) and valeur.startswith("@"):
            if valeur[1:] not in contexte:
                raise RapportInvalide(f"élément {k} : « {valeur} » non fourni (contexte : {', '.join(contexte) or 'vide'})")
            valeur = contexte[valeur[1:]]
        out[nom] = valeur
    return out


def charger(chemin: str | Path, jeux: dict[str, JeuDonnees], note_generale: str,
            chiffres_base: dict[str, float] | None = None, contexte: dict[str, Any] | None = None) -> tuple[Rapport, list[str]]:
    """(rapport calculé, termes interdits). `jeux` : {"analyse": …, "collecte": …} ; `chiffres_base` : chiffres_de_base() ;
    `contexte` : objets du projet cités par « @nom » dans les arguments (ex. {"quotas": quotas_du_plan(…)})."""
    brut: dict[str, Any] = yaml.safe_load(Path(chemin).read_text(encoding="utf-8")) or {}
    elements: list[Element] = []
    ids: set[str] = set()
    sources_affichees: dict[str, str] = {}
    for k, d in enumerate(brut.get("elements") or [], start=1):
        inconnus = set(d) - CHAMPS
        if inconnus:
            raise RapportInvalide(f"élément {k} : champs inconnus {sorted(inconnus)}")
        if "questionnaire" in d:                         # annexe générée depuis le dictionnaire (« @dictionnaire »)
            from plateforme.analyse.rapport.questionnaire import elements_questionnaire
            from plateforme.dictionnaire.modele import Dictionnaire

            dico = _arguments({"arguments": {"q": d["questionnaire"]}}, contexte or {}, k)["q"]
            if not isinstance(dico, Dictionnaire):
                raise RapportInvalide(f"élément {k} : « questionnaire » attend le dictionnaire du projet (« @dictionnaire »)")
            elements += elements_questionnaire(dico, int(d.get("niveau", 3)))
        elif "section" in d:
            elements.append(Titre(int(d.get("niveau", 1)), str(d["section"]), str(d.get("role", ""))))
        elif "texte" in d:
            elements.append(Paragraphe(str(d["texte"])))
        elif "calcul" in d:
            ident, base = str(d["calcul"]), str(d.get("base", "analyse"))
            if ident in ids or not d.get("source") or "procedure" not in d or base not in jeux:
                raise RapportInvalide(f"élément {k} : calcul « {ident} » en double, sans source, sans procédure ou base inconnue")
            ids.add(ident)
            rt = calculer(Tableau(ident, str(d["procedure"]), _arguments(d, contexte or {}, k), str(d["source"]),
                                  str(d.get("filtre", ""))), jeux[base])
            elements.append(Calcul(ident, rt.resultat, str(d["source"]), base, str(d.get("filtre", ""))))
        elif "tableau" in d or "figure" in d:
            ident = str(d.get("id", ""))
            if not ident or ident in ids:
                raise RapportInvalide(f"élément {k} : identifiant absent ou en double ({ident!r})")
            ids.add(ident)
            base = str(d.get("base", "analyse"))
            if base not in jeux:
                raise RapportInvalide(f"élément {k} : base « {base} » inconnue ({', '.join(jeux)})")
            resultat = None
            if "procedure" in d:
                rt = calculer(Tableau(str(d.get("titre", "")), str(d["procedure"]), _arguments(d, contexte or {}, k),
                                      str(d.get("source", "")), str(d.get("filtre", ""))), jeux[base])
                resultat = rt.resultat
            numero, titre, source = str(d.get("tableau", d.get("figure"))), str(d.get("titre", "")), str(d.get("source", ""))
            if d.get("source_affichee"):
                sources_affichees[ident] = str(d["source_affichee"])
            note = note_base(resultat, base, jeux[base]) if resultat is not None else ""
            if "tableau" in d:
                affichage, contenu = str(d.get("affichage", "complet")), d.get("contenu")
                if affichage not in AFFICHAGES:
                    raise RapportInvalide(f"élément {k} : affichage « {affichage} » inconnu ({', '.join(AFFICHAGES)})")
                if contenu is not None and ("procedure" in d or not isinstance(contenu, list)
                                            or not all(isinstance(li, list) for li in contenu)):
                    raise RapportInvalide(f"élément {k} : « contenu » = liste de lignes, et jamais avec une procédure")
                if contenu is None and "procedure" not in d:
                    raise RapportInvalide(f"élément {k} : tableau sans procédure ni contenu")
                elements.append(TableauRapport(numero, titre, ident, resultat, source, note, base, str(d.get("filtre", "")),
                                               affichage, [[str(c) for c in li] for li in contenu] if contenu else None))
            else:
                forme = str(d.get("forme", "barres"))
                if forme not in FORMES:
                    raise RapportInvalide(f"élément {k} : forme « {forme} » inconnue ({', '.join(FORMES)})")
                if "procedure" not in d:
                    raise RapportInvalide(f"élément {k} : graphique sans procédure")
                elements.append(Figure(numero, titre, ident, resultat, source, note, base, str(d.get("filtre", "")),
                                       legende=str(d.get("legende", "")), forme=forme))
        else:
            raise RapportInvalide(f"élément {k} : ni section, ni texte, ni tableau, ni figure")
    charte = Path(chemin).parent / str(brut["charte"]) if brut.get("charte") else None
    if charte is not None and not charte.exists():
        raise RapportInvalide(f"charte introuvable : {charte}")
    base_etude = BaseEtude("NOTE DE BASE", int(chiffres_base.get("retenues", 0)), None, "", chiffres=dict(chiffres_base)) if chiffres_base else None
    rapport = Rapport(str(brut.get("titre", "")), str(brut.get("etude", "")), note_generale, elements, charte, base_etude,
                      str(brut.get("source_etude", "")), sources_affichees)
    return rapport, [str(t) for t in brut.get("termes_interdits") or []]


__all__ = ["RapportInvalide", "charger", "nombre_fr", "note_base"]
