"""Croisements à la demande (CLAUDE.md §7.3) : le client choisit lignes, colonnes, filtre et pondération ; la plateforme
calcule tableau, pourcentages, tests et commentaire de lecture, avec garde-fous automatiques.

Garde-fous :
- **base minimale** : croisement refusé si la base totale est sous le seuil ; une colonne sous le seuil reste affichée en
  effectifs, sans pourcentage ni commentaire ;
- **k-anonymat** : toute case de 1 à k − 1 répondants est masquée (« < k ») ; un croisement dont toutes les cases non
  vides seraient masquées est refusé (il isolerait des répondants) ;
- **effectifs théoriques faibles** signalés (khi-deux peu fiable) ;
- **échantillon par quotas** : mention « non probabiliste » imposée ;
- tests : khi-deux et V de Cramér ; comparaisons de colonnes deux à deux (proportions, correction de Bonferroni), lettres
  A, B, C… comme SPSS.
Le commentaire n'affirme une différence que si elle est testée et significative.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from itertools import combinations

from plateforme.analyse.donnees import JeuDonnees
from plateforme.analyse.procedures import TriCroise
from plateforme.analyse.tableaux import Tableau, TableauInvalide, calculer
from plateforme.echantillonnage.plan import MENTION_QUOTAS

LETTRES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


@dataclass(frozen=True)
class Demande:
    ligne: str
    colonne: str
    filtre: str = ""
    poids: str | None = None


@dataclass(frozen=True)
class Garde:
    base_min: int = 30
    k: int = 5
    seuil: float = 0.05
    quotas: bool = True


class CroisementRefuse(ValueError):
    pass


@dataclass
class Cellule:
    effectif: int | None                  # None = masqué (k-anonymat)
    pct: float | None                     # None = non affiché (colonne sous la base minimale ou case masquée)
    lettres: str = ""                     # colonnes significativement plus basses (Bonferroni)


@dataclass
class Croisement:
    demande: Demande
    base: int
    lignes: list[tuple[float, str]]
    colonnes: list[tuple[float, str, str]]          # (code, libellé, lettre)
    bases_colonnes: list[int]
    cellules: list[list[Cellule]]
    khi2: float
    p: float
    v_cramer: float
    avertissements: list[str] = field(default_factory=list)
    commentaire: str = ""
    syntaxe_spss: str = ""


def croiser(jd: JeuDonnees, d: Demande, g: Garde | None = None) -> Croisement:
    g = g or Garde()
    for v in (d.ligne, d.colonne):
        if v not in jd.variables:
            raise CroisementRefuse(f"variable inconnue : {v}")
    if d.ligne == d.colonne:
        raise CroisementRefuse("lignes et colonnes doivent être deux variables différentes")
    try:
        rt = calculer(Tableau("croisement", "tri_croise", {"ligne": d.ligne, "colonne": d.colonne,
                                                             **({"poids": d.poids} if d.poids else {})}, "", d.filtre), jd)
    except (TableauInvalide, ValueError, KeyError) as e:
        raise CroisementRefuse(f"demande invalide : {e}") from e
    t = rt.resultat
    assert isinstance(t, TriCroise)
    if t.base < g.base_min:
        raise CroisementRefuse(f"base de {t.base} répondants, sous la base minimale de {g.base_min} : croisement refusé")
    bases = [int(sum(t.effectifs[i][j] for i in range(len(t.codes_lignes)))) for j in range(len(t.codes_colonnes))]
    non_vides = [x for li in t.effectifs for x in li if x > 0]
    if non_vides and all(x < g.k for x in non_vides):
        raise CroisementRefuse(f"toutes les cases comptent moins de {g.k} répondants : le croisement isolerait des personnes")
    lettres_col = _comparaisons(t, bases, g)
    cellules = []
    for i in range(len(t.codes_lignes)):
        rangee = []
        for j in range(len(t.codes_colonnes)):
            n = int(t.effectifs[i][j])
            masque = 0 < n < g.k
            rangee.append(Cellule(effectif=None if masque else n,
                                  pct=None if masque or bases[j] < g.base_min else t.pct_colonne[i][j],
                                  lettres="" if masque or bases[j] < g.base_min else lettres_col[i][j]))
        cellules.append(rangee)
    res = Croisement(
        demande=d, base=t.base,
        lignes=[(c, jd.libelle(d.ligne, c)) for c in t.codes_lignes],
        colonnes=[(c, jd.libelle(d.colonne, c), LETTRES[j % 26]) for j, c in enumerate(t.codes_colonnes)],
        bases_colonnes=bases, cellules=cellules, khi2=t.khi2, p=t.p, v_cramer=t.v_cramer,
        avertissements=list(t.avertissements), syntaxe_spss=t.syntaxe_spss)
    if any(c.effectif is None for li in cellules for c in li):
        res.avertissements.append(f"cases de moins de {g.k} répondants masquées (k-anonymat)")
    petites = [lib for (_, lib, _), b in zip(res.colonnes, bases, strict=True) if b < g.base_min]
    if petites:
        res.avertissements.append(f"colonnes sous la base minimale ({g.base_min}) : pourcentages non affichés ({', '.join(petites)})")
    if g.quotas:
        res.avertissements.append(MENTION_QUOTAS)
    res.commentaire = _commentaire(res, jd, g)
    return res


def _comparaisons(t: TriCroise, bases: list[int], g: Garde) -> list[list[str]]:
    """Pour chaque ligne : lettres des colonnes dont la proportion est significativement plus basse (test z de deux
    proportions, p corrigé de Bonferroni par le nombre de paires), colonnes sous la base minimale exclues."""
    from scipy.stats import norm

    out = [["" for _ in t.codes_colonnes] for _ in t.codes_lignes]
    eligibles = [j for j, b in enumerate(bases) if b >= g.base_min]
    paires = list(combinations(eligibles, 2))
    if not paires:
        return out
    for i in range(len(t.codes_lignes)):
        for a, b in paires:
            na, nb = bases[a], bases[b]
            pa, pb = t.effectifs[i][a] / na, t.effectifs[i][b] / nb
            pc = (t.effectifs[i][a] + t.effectifs[i][b]) / (na + nb)
            se = math.sqrt(pc * (1 - pc) * (1 / na + 1 / nb))
            if se == 0:
                continue
            p = min(1.0, 2 * float(norm.sf(abs(pa - pb) / se)) * len(paires))
            if p < g.seuil:
                haute, basse = (a, b) if pa > pb else (b, a)
                out[i][haute] += LETTRES[basse % 26]
    return out


def _commentaire(r: Croisement, jd: JeuDonnees, g: Garde) -> str:
    var_l = jd.variables[r.demande.ligne].label or r.demande.ligne
    var_c = jd.variables[r.demande.colonne].label or r.demande.colonne
    phrases = [f"Base : {r.base} répondants."]
    if math.isnan(r.p):
        phrases.append("Test d'indépendance non calculable (une seule ligne ou colonne).")
    elif r.p < g.seuil:
        phrases.append(f"« {var_l} » varie selon « {var_c} » (khi-deux, p {'< 0,001' if r.p < 0.001 else '= ' + f'{r.p:.3f}'.replace('.', ',')} ; "
                       f"V de Cramér = {f'{r.v_cramer:.2f}'.replace('.', ',')}).")
        ecarts = [f"{lib_l} : {lib_c}" for i, (_, lib_l) in enumerate(r.lignes) for j, (_, lib_c, _) in enumerate(r.colonnes)
                  if r.cellules[i][j].lettres]
        if ecarts:
            phrases.append("Proportions significativement plus élevées (Bonferroni) : " + " ; ".join(ecarts[:5]) + ".")
    else:
        phrases.append(f"Aucun écart significatif entre les colonnes au seuil de {round(100 * g.seuil)} % : les différences "
                       "observées se lisent comme descriptives.")
    return " ".join(phrases)
