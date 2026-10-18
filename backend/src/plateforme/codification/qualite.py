"""Qualité des fiches et base d'analyse : taux de remplissage, quasi-doublons, note de base.

Reprend la partie 7 de `reference/spss/EDM_EE_RECONFIGURATION_V4_1.sps`, qui a fixé la base de
427 fiches retenues sur 446 collectées :
- taux de remplissage sur les questions codées (un choix multiple compte pour une question, une
  grille pour une question par ligne) et l'accord de recontact ; seuil : 70 % ;
- fiches quasi identiques d'une même ville, comparées sur toutes les variables codées hors ville
  et hors texte : les fiches à `seuil_copie` écarts ou moins forment des groupes ; dans chaque
  groupe la première fiche est gardée, les autres sont des « copies probables » (écartées) ; une
  fiche à `seuil_suspect` écarts ou moins d'un membre d'un groupe est une « ressemblance forte ».
Ce qui était une liste de lignes fixée à la main dans SPSS devient une règle automatique,
paramétrable et traçable ; le superviseur garde la décision finale (une décision OK l'emporte).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from plateforme.codification.fiche import FicheCodee
from plateforme.codification.rejeu import ANNULEE, HORS_COMPTAGE, OK, REJETE, DecisionQC
from plateforme.dictionnaire.modele import Dictionnaire, TypeQuestion

AUCUN, SUSPECT, COPIE = 0, 1, 2
REJETEES = "rejetées par le superviseur"
ANNULEES = "annulées (incident technique, non imputées)"


@dataclass(frozen=True)
class ParametresBase:
    seuil_remplissage: float = 70.0     # % minimal de questions renseignées
    seuil_suspect: int = 6              # écarts au plus : ressemblance forte, à vérifier
    seuil_copie: int = 3                # écarts au plus avec une fiche antérieure : copie probable, écartée
    variable_groupe: str = "CODEZONE"   # comparaison des paires à l'intérieur d'une même ville


@dataclass
class NoteDeBase:
    collectees: int
    retenues: int
    ecartees: dict[str, int] = field(default_factory=dict)       # motif -> nombre

    @property
    def rejetees(self) -> int:
        return self.ecartees.get(REJETEES, 0)

    @property
    def annulees(self) -> int:
        return self.ecartees.get(ANNULEES, 0)

    @property
    def valides(self) -> int:
        return self.collectees - self.rejetees - self.annulees

    def texte(self) -> str:
        """Note de base à placer en tête de rapport et sous chaque tableau (leçon : base 446 / 427 non expliquée)."""
        motifs = " ; ".join(f"{m} : {n}" for m, n in self.ecartees.items() if n and m not in (REJETEES, ANNULEES))
        debut = f"Base : {self.collectees} fiches reçues"
        hors = [f"{n} {m}" for m, n in ((ANNULEES, self.annulees), (REJETEES, self.rejetees)) if n]
        if hors:
            debut += f", dont {' et '.join(hors)}, soit {self.valides} fiches valides collectées"
        ecartees = self.valides - self.retenues
        return (debut + (f" ; {ecartees} écartées de l'analyse ({motifs})" if ecartees else "")
                + f" ; {self.retenues} fiches retenues pour l'analyse.")


def variables_remplissage(dico: Dictionnaire) -> list[str]:
    """Une variable par question codée (première modalité d'un choix multiple, chaque ligne de grille) + accord de recontact."""
    out = ["ACCRECON"] if any(d.role.value == "accord_recontact" for d in dico.identification) else []
    for q in dico.questions:
        if q.type is TypeQuestion.CHOIX_MULTIPLE:
            out.append(q.variables()[0])
        elif q.type in (TypeQuestion.CHOIX_UNIQUE, TypeQuestion.GRILLE, TypeQuestion.NUMERIQUE):
            out += q.variables_codees()
    return out


def taux_remplissage(dico: Dictionnaire, fiche: FicheCodee) -> float:
    nr = dico.codes_speciaux.non_reponse
    variables = variables_remplissage(dico)
    manquantes = sum(1 for v in variables if fiche.valeurs.get(v) == nr)
    return 100 * (1 - manquantes / len(variables))


def variables_comparaison(dico: Dictionnaire) -> list[str]:
    """Variables codées des questions, hors question pré-remplie (ville) et hors textes."""
    return [v for q in dico.questions if q.prerempli is None and q.type is not TypeQuestion.TEXTE for v in q.variables_codees()]


def quasi_doublons(dico: Dictionnaire, fiches: list[FicheCodee], params: ParametresBase) -> dict[str, int]:
    """id de réponse -> AUCUN / SUSPECT / COPIE. `fiches` dans l'ordre d'arrivée.

    1. Les fiches d'un même groupe (ville) à `seuil_copie` écarts ou moins sont reliées ; chaque
       ensemble relié (composante connexe) forme un groupe de copies.
    2. Dans chaque groupe, la PREMIÈRE fiche est gardée (SUSPECT) ; les autres sont des COPIES.
    3. Une fiche à `seuil_suspect` écarts ou moins d'un membre d'un groupe est SUSPECTE.
    """
    variables = variables_comparaison(dico)
    vecteurs = [tuple(f.valeurs.get(v) for v in variables) for f in fiches]
    n = len(fiches)
    distances: dict[tuple[int, int], int] = {}
    for i in range(n):
        for j in range(i):
            if fiches[i].valeurs.get(params.variable_groupe) == fiches[j].valeurs.get(params.variable_groupe):
                distances[(j, i)] = sum(1 for a, b in zip(vecteurs[i], vecteurs[j], strict=True) if a != b)
    parent = list(range(n))

    def racine(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for (j, i), d in distances.items():
        if d <= params.seuil_copie:
            parent[max(racine(i), racine(j))] = min(racine(i), racine(j))
    groupes: dict[int, list[int]] = {}
    for i in range(n):
        groupes.setdefault(racine(i), []).append(i)
    etat = {f.id_reponse: AUCUN for f in fiches}
    membres: set[int] = set()
    for g in groupes.values():
        if len(g) > 1:
            g.sort()
            etat[fiches[g[0]].id_reponse] = SUSPECT
            for i in g[1:]:
                etat[fiches[i].id_reponse] = COPIE
            membres.update(g)
    for (j, i), d in distances.items():
        if d <= params.seuil_suspect and (i in membres) != (j in membres):
            autre = j if i in membres else i
            etat[fiches[autre].id_reponse] = max(etat[fiches[autre].id_reponse], SUSPECT)
    return etat


def base_analyse(dico: Dictionnaire, fiches: list[FicheCodee], params: ParametresBase,
                 decisions: dict[str, DecisionQC] | None = None) -> tuple[list[FicheCodee], NoteDeBase]:
    """Fiches retenues pour l'analyse et note de base. Une décision OK du superviseur prime sur les règles automatiques."""
    decisions = decisions or {}
    doublons = quasi_doublons(dico, [f for f in fiches if f.statut not in HORS_COMPTAGE], params)
    retenues, motifs = [], {ANNULEES: 0, REJETEES: 0, f"remplissage < {params.seuil_remplissage:g} %": 0,
                            "copies probables": 0}
    for f in fiches:
        valide = decisions.get(f.id_reponse, DecisionQC("")).statut == OK
        if f.statut == ANNULEE:
            motifs[ANNULEES] += 1
        elif f.statut == REJETE:
            motifs[REJETEES] += 1
        elif not valide and taux_remplissage(dico, f) < params.seuil_remplissage:
            motifs[f"remplissage < {params.seuil_remplissage:g} %"] += 1
        elif not valide and doublons.get(f.id_reponse) == COPIE:
            motifs["copies probables"] += 1
        else:
            retenues.append(f)
    return retenues, NoteDeBase(len(fiches), len(retenues), motifs)
