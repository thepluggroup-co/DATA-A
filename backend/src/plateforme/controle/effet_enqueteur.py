"""Détection automatique d'un effet enquêteur (CLAUDE.md, section 5 : « comparaison de distributions par
enquêteur à profil égal »).

Pour chaque groupe (ville), chaque enquêteur et chaque question codée :
1. répartition ATTENDUE des réponses de l'enquêteur À PROFIL ÉGAL : pour chaque cible (question de cible),
   ses fiches reçoivent la répartition observée chez les AUTRES enquêteurs du même groupe pour cette cible
   (standardisation indirecte) — un enquêteur qui interroge plus d'électriciens n'est pas accusé à tort ;
2. écart observé / attendu : khi-deux d'ajustement (scipy.stats.chisquare), taille d'effet w de Cohen ;
3. correction de Bonferroni sur l'ensemble des tests ; signalement si p corrigé < alpha ET si la taille
   d'effet est EXTRÊME parmi tous les écarts de l'étude (au-delà de la barrière haute de Tukey, Q3 + 1,5 × IQR).
   Pourquoi une règle adaptative : avec deux ou trois enquêteurs par ville, chacun dans ses quartiers, l'effet
   enquêteur et l'effet quartier se confondent ; des écarts « significatifs » sont alors la norme (131 sur 299
   à seuil fixe sur l'étude EDM) et seul l'extrême mérite l'attention du superviseur.
Cas de référence : à Douala, ENQ1 se démarque sur la garantie attendue (Q32) et l'importance du SAV (Q30)
(`reference/spss/EDM_EE_REPRODUCTION_RAPPORT_427.sps`, contrôle repéré à la main en fin d'étude).
Un signalement n'est pas une preuve de fraude : il déclenche une vérification (rappels, entretien).
"""

from __future__ import annotations

import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass

from plateforme.codification.fiche import FicheCodee
from plateforme.codification.rejeu import HORS_COMPTAGE
from plateforme.dictionnaire.modele import Dictionnaire, TypeQuestion


@dataclass(frozen=True)
class ParametresEffet:
    variable_groupe: str = "CODEZONE"
    n_min: int = 20                 # fiches minimales de l'enquêteur ET des autres enquêteurs du groupe
    alpha: float = 0.05             # seuil après correction de Bonferroni
    w_min: float = 0.30             # taille d'effet minimale (0,3 = effet moyen selon Cohen)
    barriere_tukey: float = 1.5     # signalement si w > Q3 + k × (Q3 − Q1) de TOUS les écarts de l'étude


@dataclass(frozen=True)
class EcartEnqueteur:
    groupe: object
    enqueteur: str
    variable: str
    libelle: str
    n: int                          # fiches de l'enquêteur prises en compte (réponse valide, cible représentée chez les autres)
    n_autres: int
    khi2: float
    ddl: int
    p: float
    p_corrige: float
    w: float
    modalite_surrepresentee: str
    part_enqueteur: float           # part de cette modalité chez l'enquêteur
    part_attendue: float            # part attendue à profil égal
    signale: bool


def variables_testees(dico: Dictionnaire) -> list[tuple[str, str, dict[int, str]]]:
    """(variable, libellé, modalités valides) : choix uniques et lignes de grille, hors cible et hors question pré-remplie."""
    out = []
    speciaux = dico.codes_speciaux.tous()
    for q in dico.questions:
        if q.role == "cible" or q.prerempli is not None:
            continue
        mods = {m.code: dico.texte(m.libelles) for m in q.modalites if m.code not in speciaux}
        if q.type is TypeQuestion.CHOIX_UNIQUE:
            out.append((q.code, dico.titre_question(q), mods))
        elif q.type is TypeQuestion.GRILLE:
            out += [(li.variable, f"{dico.titre_question(q)} — {dico.texte(li.libelles)}", mods) for li in q.lignes]
    return out


def detecter(dico: Dictionnaire, fiches: list[FicheCodee], params: ParametresEffet | None = None) -> list[EcartEnqueteur]:
    """Tous les tests, triés du plus significatif au moins significatif ; `signale` marque ceux qui dépassent les seuils."""
    from scipy.stats import chisquare

    params = params or ParametresEffet()
    cible = dico.question_cible()
    if cible is None:
        raise ValueError("le dictionnaire n'a pas de question de cible : impossible de comparer à profil égal")
    valides = [f for f in fiches if f.statut not in HORS_COMPTAGE]
    par_groupe: dict[object, list[FicheCodee]] = defaultdict(list)
    for f in valides:
        par_groupe[f.valeurs.get(params.variable_groupe)].append(f)

    bruts: list[tuple[object, str, str, str, int, int, float, int, float, float, str, float, float]] = []
    for groupe, fs in par_groupe.items():
        for enq in sorted({str(f.valeurs.get("CODEENQU")) for f in fs}):
            siennes = [f for f in fs if f.valeurs.get("CODEENQU") == enq]
            autres = [f for f in fs if f.valeurs.get("CODEENQU") != enq]
            if len(siennes) < params.n_min or len(autres) < params.n_min:
                continue
            for var, lib, mods in variables_testees(dico):
                ref: dict[object, Counter[int]] = defaultdict(Counter)
                for f in autres:
                    v = f.valeurs.get(var)
                    if v in mods:
                        ref[f.valeurs.get(cible.code)][v] += 1   # type: ignore[index]
                observe: Counter[int] = Counter()
                attendu: dict[int, float] = dict.fromkeys(mods, 0.0)
                n = 0
                cles = list(mods)
                for f in siennes:
                    v, profil = f.valeurs.get(var), f.valeurs.get(cible.code)
                    total_ref = sum(ref[profil].values())
                    if v not in mods or total_ref == 0:          # cible absente chez les autres : pas de comparaison possible
                        continue
                    n += 1
                    observe[v] += 1   # type: ignore[index]
                    for k in cles:                               # lissage additif de 0,5 (Jeffreys) : aucun attendu nul
                        attendu[k] += (ref[profil][k] + 0.5) / (total_ref + 0.5 * len(cles))
                n_autres = sum(1 for f in autres if f.valeurs.get(var) in mods)
                if n < params.n_min or len(cles) < 2:
                    continue
                obs = [observe[k] for k in cles]
                att = [attendu[k] for k in cles]
                res = chisquare(obs, att)
                khi2, p = float(res.statistic), float(res.pvalue)
                top = max(cles, key=lambda k: observe[k] - attendu[k])
                bruts.append((groupe, enq, var, lib, n, n_autres, khi2, len(cles) - 1, p, (khi2 / n) ** 0.5, mods[top],
                              observe[top] / n, attendu[top] / n))
    m = len(bruts)
    barriere = params.w_min
    if m >= 4:
        q1, _, q3 = statistics.quantiles([b[9] for b in bruts], n=4)
        barriere = max(params.w_min, q3 + params.barriere_tukey * (q3 - q1))
    ecarts = [EcartEnqueteur(g, e, v, lib, n, na, k, d, p, min(1.0, p * m), w, mod, pe, pa,
                             min(1.0, p * m) < params.alpha and w > barriere)
              for g, e, v, lib, n, na, k, d, p, w, mod, pe, pa in bruts]
    return sorted(ecarts, key=lambda x: (x.p, -x.w))
