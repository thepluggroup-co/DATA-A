"""Modèle du rapport : une suite d'éléments (titres, paragraphes, tableaux, figures), chacun lié aux résultats du moteur.

Règle M15 « chaque chiffre lié à sa source » : un paragraphe n'écrit AUCUN chiffre d'enquête en dur. Il écrit une
référence `[[identifiant.champ]]` résolue depuis le résultat nommé, par exemple :
- `[[marques.base]]` → base du tableau « marques » ;
- `[[marques.pct(1)]]` → % de la modalité 1 (fréquences), `[[produits.pct(PRACSOLA)]]` → % des observations (réponses
  multiples) ;
- `[[s1.ligne(P_DECU)]]` : valeur d'une ligne d'un tableau d'indicateurs (chiffres clés), `[[s1.n(P_DECU)]]` sa base ;
- `[[t2bis.ecart_max]]`, `[[t2bis.ligne_min(P_YAKI)]]`, `[[t2bis.ligne_max(P_YAKI)]]` : test de sensibilité ;
- `[[t3.case(9,1)]]` : effectif d'une case d'un tri croisé (code de ligne, code de colonne) ;
- `[[x.col(1,2|3)]]` : % de la colonne 3 d'un tri croisé, cumulé sur les lignes 1 et 2 ; `[[x.pct(8,9,10)]]` : % cumulé ;
- `[[x.p_txt]]` : « = 0,027 » ou « < 0,001 » (à écrire « p [[x.p_txt]] ») ;
- `[[t5.v_min]]`, `[[t5.v_max]]` : plus petit et plus grand V de Cramér parmi les écarts significatifs (p < 0,05) ;
- répartitions : `[[r.pct(Douala|1)]]`, `[[r.n(Douala|)]]` ; parts bootstrap : `[[v.part(Schneider)]]`, `[[v.bas(…)]]`,
  `[[v.haut(…)]]` (bornes à l'entier) ; correspondances : `[[c.inertie]]`, `[[c.axe(1)]]` ;
- décimales imposées : `[[t.col(1|2)~0]]` (« 79 % ») ;
- batterie : `[[b.pct(VAR|1,2)]]`, `[[b.n(VAR|)]]`, `[[b.base_min]]`, `[[b.base_max]]` ;
- moyennes : `[[m.mediane_millions]]`, `[[m.moyenne_millions]]`, `[[m.groupe_mediane_millions(2)]]`, `[[m.groupe_mediane(2)]]`
  (millions de FCFA, deux décimales au plus) ; corrélation : `[[r.rho_abs]]` (valeur absolue de rho) ;
- `[[t2.realise_total]]`, `[[t2.prevu_total]]`, `[[t2.taux]]`, `[[t2.realise(4)]]`, `[[t2.prevu(4)]]`, `[[t2.atteinte(4)]]` :
  quotas réalisés / prévus (taux d'atteinte en %) ;
- `[[base.retenues]]`, `[[base.collectees]]`, `[[base.ecartees]]`, `[[base.remplissage]]`, `[[base.copies]]`,
  `[[base.recues]]`, `[[base.annulees]]` : chiffres de la note de base (fiches) ;
- `[[depense.moyenne]]`, `[[depense.mediane]]`, `[[depense.groupe(2)]]` (moyenne du groupe 2), `[[croise.v]]` (V de Cramér),
  `[[croise.p]]`, `[[logit.r2]]` (Nagelkerke) ;
- `[[lit:2024]]` : nombre qui n'est PAS un chiffre d'enquête (année, numéro de loi), écrit tel quel et listé au contrôle.
Les nombres sont écrits à la française (virgule décimale, une décimale pour les %, espace fine pour les milliers).
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from plateforme.analyse import procedures as p

REFERENCE = re.compile(r"\[\[([^\]]+)\]\]")


class ReferenceInvalide(ValueError):
    """Référence de chiffre introuvable ou mal formée."""


@dataclass
class Titre:
    niveau: int
    texte: str
    role: str = ""                     # "conclusions" | "recommandations" | "" : sections que le gabarit doit séparer


@dataclass
class Paragraphe:
    texte: str                         # avec références [[…]]
    origine: str = ""                  # "dictionnaire" : texte généré depuis le dictionnaire (annexe questionnaire)


@dataclass
class ElementNumerote:
    """Tableau ou figure : numéro affiché (« 5 », « 2 bis », « S1 », « A2 »), titre, source, résultat du moteur."""
    numero: str
    titre: str
    identifiant: str                   # nom du résultat, utilisé par les références [[identifiant.champ]]
    resultat: p.Resultat | None
    source: str = ""                   # requête d'origine (ex. « plan d'analyse : tableau 12 ; V4:375 »)
    note_base: str = ""                # note de base affichée sous l'élément
    base: str = "analyse"              # base de calcul : « analyse » (fiches retenues) ou « collecte » (fiches valides)
    filtre: str = ""                   # sous-population (même syntaxe que les conditions du plan d'analyse)


AFFICHAGES = ("complet", "effectifs", "pourcentages")
FORMES = ("barres", "secteurs", "groupees", "empilees", "panneaux", "secteurs_colonnes", "carte")


@dataclass
class TableauRapport(ElementNumerote):
    affichage: str = "complet"          # tri croisé : « complet », « effectifs » (avec totaux) ou « pourcentages »
    contenu: list[list[str]] | None = None    # tableau STATIQUE (sans chiffre d'enquête) : en-tête puis lignes


@dataclass
class Figure(ElementNumerote):
    legende: str = ""
    forme: str = "barres"               # « barres », « secteurs » (une variable), « groupees » ou « empilees » (tri croisé)


@dataclass
class Calcul:
    """Résultat calculé et sourcé, cité par le texte mais non affiché (ex. un % tiré d'un croisement que le rapport ne
    montre pas). Il reste traçable : il figure dans l'annexe des sources et dans la syntaxe SPSS."""
    identifiant: str
    resultat: p.Resultat
    source: str
    base: str = "analyse"
    filtre: str = ""


Element = Titre | Paragraphe | TableauRapport | Figure | Calcul


@dataclass
class BaseEtude(p.Resultat):
    """Chiffres de la note de base (fiches reçues, valides, écartées par motif, retenues), cités par [[base.champ]]."""
    chiffres: dict[str, float] = field(default_factory=dict)


@dataclass
class Rapport:
    titre: str
    etude: str
    note_base: str                     # note de base générale (codification/qualite.NoteDeBase.texte())
    elements: list[Element] = field(default_factory=list)
    charte: Path | None = None          # charte graphique déclarée par l'étude (D-039)
    base_etude: BaseEtude | None = None  # chiffres de la note de base, références [[base.retenues]] etc.
    source_etude: str = ""               # source affichée sous chaque tableau et graphique (« enquête EDM EE, oct. 2026 »)
    sources_affichees: dict[str, str] = field(default_factory=dict)   # identifiant -> source affichée propre à l'élément

    def source_affichee(self, e: ElementNumerote) -> str:
        """Source lue par le client sous l'élément ; la requête d'origine (syntaxe, ligne) reste dans l'annexe des sources."""
        return self.sources_affichees.get(e.identifiant) or self.source_etude or e.source

    def numerotes(self) -> list[ElementNumerote]:
        return [e for e in self.elements if isinstance(e, ElementNumerote)]

    def resultats(self) -> dict[str, p.Resultat]:
        out = {e.identifiant: e.resultat for e in self.numerotes() if e.resultat is not None}
        out |= {e.identifiant: e.resultat for e in self.elements if isinstance(e, Calcul)}
        if self.base_etude is not None:
            out["base"] = self.base_etude
        return out


# ------------------------------------------------------------------------------------------------ chiffres
def nombre_fr(x: float, decimales: int = 1) -> str:
    """12 345,6 (espace fine insécable pour les milliers, virgule décimale). Arrondi au demi supérieur, comme l'affichage
    de SPSS et le rapport livré (110 / 352 = 31,25 % s'écrit 31,3)."""
    from decimal import ROUND_HALF_UP, Decimal

    if x is None or (isinstance(x, float) and math.isnan(x)):
        raise ReferenceInvalide("valeur manquante")
    arrondi = Decimal(repr(float(x))).quantize(Decimal(1).scaleb(-decimales), rounding=ROUND_HALF_UP)
    return f"{arrondi:,.{decimales}f}".replace(",", " ").replace(".", ",")


_CHAMP = re.compile(r"^(?P<id>[A-Za-z_][\w]*)\.(?P<champ>[a-z_0-9]+)(?:\((?P<arg>[^)]*)\))?$")


def valeur_reference(ref: str, resultats: dict[str, p.Resultat]) -> tuple[float, int]:
    """(valeur, décimales) d'une référence « identifiant.champ(argument) »."""
    entier = re.match(r"^(?P<ref>.+)~(?P<dec>\d)$", ref.strip())       # « [[t.col(1|2)~0]] » : décimales imposées (79 %)
    if entier:
        valeur, _ = valeur_reference(entier["ref"], resultats)
        return valeur, int(entier["dec"])
    m = _CHAMP.match(ref.strip())
    if not m:
        raise ReferenceInvalide(f"référence mal formée : [[{ref}]]")
    ident, champ, arg = m["id"], m["champ"], m["arg"]
    if ident not in resultats:
        raise ReferenceInvalide(f"[[{ref}]] : aucun tableau ni figure « {ident} » dans le rapport")
    r: Any = resultats[ident]
    try:
        if isinstance(r, BaseEtude):
            return float(r.chiffres[champ]), 0
        if champ == "base":
            return float(r.base), 0
        if champ == "pct" and isinstance(r, p.Frequences) and arg is not None:
            codes = [float(a) for a in arg.split(",")]
            absents = [c for c in codes if c not in {li.code for li in r.lignes}]
            if absents:
                raise KeyError(f"modalité {absents} absente du tableau")
            return float(r.pct(*codes)), 1
        if champ == "col" and isinstance(r, p.TriCroise) and arg is not None and "|" in arg:
            lignes_txt, colonne = arg.split("|")
            j = r.codes_colonnes.index(float(colonne))
            return float(sum(r.pct_colonne[r.codes_lignes.index(float(c))][j] for c in lignes_txt.split(","))), 1
        if champ == "pct" and isinstance(r, p.ReponsesMultiples) and arg is not None:
            return float(r.pct_observations[arg.strip()]), 1
        if champ == "ligne" and isinstance(r, p.Indicateurs) and arg is not None:
            return float(next(m for v, _, m, _ in r.lignes if v == arg.strip())), 1
        if champ == "n" and isinstance(r, p.Indicateurs) and arg is not None:
            return float(next(n for v, _, _, n in r.lignes if v == arg.strip())), 0
        if champ == "ecart_max" and isinstance(r, p.Sensibilite):
            return float(max(li[5] for li in r.lignes)), 1
        if champ in ("ligne_min", "ligne_max") and isinstance(r, p.Sensibilite) and arg is not None:
            trouvee = next(li for li in r.lignes if li[0] == arg.strip())
            valeurs: list[float] = [trouvee[3], *trouvee[4].values()]
            return float(min(valeurs) if champ == "ligne_min" else max(valeurs)), 0
        if isinstance(r, p.QuotasRealises) and champ in ("realise_total", "prevu_total", "taux"):
            reel, prevu = sum(map(sum, r.realise)), sum(map(sum, r.prevu))
            return (float(reel), 0) if champ == "realise_total" else (float(prevu), 0) if champ == "prevu_total" else (100 * reel / prevu, 1)
        if isinstance(r, p.QuotasRealises) and champ in ("realise", "prevu", "atteinte") and arg is not None:
            i = r.codes_cibles.index(float(arg))
            reel, prevu = sum(r.realise[i]), sum(r.prevu[i])
            return (float(reel), 0) if champ == "realise" else (float(prevu), 0) if champ == "prevu" else (100 * reel / prevu, 0)
        if isinstance(r, p.Repartitions) and champ in ("pct", "n") and arg is not None and "|" in arg:
            titre, codes_txt = arg.split("|")
            freq = r.parts[titre.strip()]
            if champ == "n":
                return float(freq.base), 0
            codes = [float(c) for c in codes_txt.split(",")]
            if any(c not in {li.code for li in freq.lignes} for c in codes):
                raise KeyError(f"modalité absente pour {titre}")
            return float(freq.pct(*codes)), 1
        if isinstance(r, p.PartsBootstrap) and champ in ("part", "bas", "haut") and arg is not None:
            point, bas, haut = r.parts[arg.strip()]
            return {"part": (point, 1), "bas": (bas, 0), "haut": (haut, 0)}[champ]
        if isinstance(r, p.Correspondances) and champ in ("inertie", "axe", "inertie_sur"):
            if champ == "inertie_sur":            # rapport des inerties de deux cartes : [[c1.inertie_sur(c2)]]
                autre = resultats[(arg or "").strip()]
                if not isinstance(autre, p.Correspondances):
                    raise KeyError(f"« {arg} » n'est pas une analyse des correspondances")
                return r.inertie_totale / autre.inertie_totale, 1
            return (r.inertie_totale, 2) if champ == "inertie" else (r.part_axes[int(arg or 1) - 1], 1)
        if isinstance(r, p.Batterie) and champ in ("base_min", "base_max"):
            bases = [f.base for f in r.frequences.values()]
            return float(min(bases) if champ == "base_min" else max(bases)), 0
        if isinstance(r, p.Batterie) and champ in ("pct", "n") and arg is not None and "|" in arg:
            var, codes_txt = arg.split("|")
            f = r.frequences[var.strip()]
            if champ == "n":
                return float(f.base), 0
            codes = [float(c) for c in codes_txt.split(",")]
            if any(c not in {li.code for li in f.lignes} for c in codes):
                raise KeyError(f"modalité absente pour {var}")
            return float(f.pct(*codes)), 1
        if isinstance(r, p.Moyenne) and champ in ("mediane_millions", "moyenne_millions"):
            return (r.mediane / 1e6, -2) if champ == "mediane_millions" else (r.moyenne / 1e6, -1)
        if isinstance(r, p.Moyenne) and champ in ("groupe_mediane_millions", "groupe_moyenne_millions") and arg is not None:
            moy, med, _ = r.groupes[float(arg)]
            return (med if champ == "groupe_mediane_millions" else moy) / 1e6, -2
        if isinstance(r, p.Moyenne) and champ == "groupe_mediane" and arg is not None:
            return float(r.groupes[float(arg)][1]), 1
        if isinstance(r, p.TestStatistique) and champ == "rho_abs":
            return abs(float(r.statistique)), 2
        if champ in ("v_min", "v_max") and isinstance(r, p.SyntheseKhi2):
            significatifs = [li[6] for li in r.lignes if li[5] < 0.05]
            return float(min(significatifs) if champ == "v_min" else max(significatifs)), 2
        if champ == "case" and isinstance(r, p.TriCroise) and arg is not None:
            ligne, colonne = (float(a) for a in arg.split(","))
            return float(r.effectifs[r.codes_lignes.index(ligne)][r.codes_colonnes.index(colonne)]), 0
        if champ in ("moyenne", "mediane") and isinstance(r, p.Moyenne):
            return float(getattr(r, champ)), 1 if champ == "moyenne" else -1      # médiane : « +5 % », pas « +5,0 % »
        if champ == "groupe" and isinstance(r, p.Moyenne) and arg is not None:
            return float(r.groupes[float(arg)][0]), 1
        if isinstance(r, p.Frequences) and champ in ("eff", "eff_min", "eff_max"):  # effectifs : [[f.eff(2)]], [[f.eff_min]]
            if champ == "eff" and arg is not None:
                return float(next(li.effectif for li in r.lignes if li.code == float(arg))), 0
            effectifs = [li.effectif for li in r.lignes]
            return float(min(effectifs) if champ == "eff_min" else max(effectifs)), 0
        if champ == "ncol" and isinstance(r, p.TriCroise) and arg is not None:      # effectif d'une colonne
            j = r.codes_colonnes.index(float(arg))
            return float(sum(r.effectifs[i][j] for i in range(len(r.codes_lignes)))), 0
        if isinstance(r, p.Logistique) and champ in ("or", "or_bas", "or_haut") and arg is not None:
            valeur = r.coefficients[arg.strip()][("or", "or_bas", "or_haut").index(champ)]
            return valeur, (1 if valeur >= 1 else 2)          # rapports de chances : 3,5 ; 0,23 (deux chiffres significatifs)
        if isinstance(r, p.Logistique) and champ == "hl_p":
            return float(r.hosmer_lemeshow[2]), 3
        if champ == "v" and isinstance(r, p.TriCroise):
            return float(r.v_cramer), 2
        if champ in ("p", "p_txt") and hasattr(r, "p"):
            return float(r.p), 3
        if champ == "r2" and isinstance(r, p.Logistique):
            return float(r.r2_nagelkerke), 2
        if champ == "r2" and hasattr(r, "r2"):
            return float(r.r2), 2
    except (KeyError, ValueError, StopIteration) as e:
        raise ReferenceInvalide(f"[[{ref}]] : modalité ou groupe introuvable ({e})") from e
    raise ReferenceInvalide(f"[[{ref}]] : champ « {champ} » non disponible pour {type(r).__name__}")


def resoudre(texte: str, resultats: dict[str, p.Resultat]) -> str:
    """Remplace chaque référence par sa valeur écrite à la française ; `[[lit:…]]` est recopié tel quel."""
    def remplacer(m: re.Match[str]) -> str:
        ref = m.group(1)
        if ref.startswith("lit:"):
            return ref[4:]
        valeur, decimales = valeur_reference(ref, resultats)
        if ref.strip().endswith(".p_txt"):     # « = 0,027 » ou « < 0,001 »
            return "< 0,001" if valeur < 0.001 else "= " + nombre_fr(valeur, 3)
        if decimales < 0:                     # décimales « au plus » (millions : 3,25 ; 7,2 ; 1,5) : zéros finaux retirés
            return nombre_fr(valeur, -decimales).rstrip("0").rstrip(",")
        return nombre_fr(valeur, decimales)
    return REFERENCE.sub(remplacer, texte)
