"""Variables dérivées déclaratives (recodages, calculs, conditions, comptages), rejouables sur toute base.

Les règles viennent du plan d'analyse (YAML) et reproduisent la sémantique de SPSS :
- une variable citée est lue SANS ses valeurs manquantes déclarées (comme SPSS : un manquant ne vérifie aucune
  condition, et un calcul qui l'utilise donne « manquant ») ; `valeur(X)` lit le code brut (VALUE(X) de SPSS) ;
- `recode` : liste [codes, valeur] ; `sinon` : « manquant » (ELSE=SYSMIS) ou « copie » (ELSE=COPY) ;
- `calcul` : expression arithmétique ;
- `etapes` : valeur initiale puis `si … : valeur …` successifs (la dernière condition vraie l'emporte, comme des IF) ;
- `compte` : nombre de variables égales à l'une des valeurs (COUNT) ;
- `premier` : rang (1, 2, …) de la première variable égale à la valeur, sinon manquant.
Fonctions de texte : commence(V, "TXT"), contient(V, "TXT"), vide(V) — sur le texte en majuscules, sans espaces
de tête (UPCASE(LTRIM()) de SPSS). Dans ces trois fonctions, V peut être remplacé par premiere_citation(V) : le texte
avant la première virgule ou le premier point-virgule (règle « première marque citée » d'une liste libre), ou par
premier_mot(V) : le premier mot de cette première citation (listes séparées par de simples espaces).
Les expressions sont analysées par liste blanche (aucun eval).
"""

from __future__ import annotations

import ast
import operator
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from plateforme.analyse.donnees import JeuDonnees, Variable

if TYPE_CHECKING:
    import pandas as pd


class RegleInvalide(ValueError):
    """Règle de dérivation mal formée."""


@dataclass
class Derivation:
    nom: str
    label: str = ""
    valeurs: dict[float, str] = field(default_factory=dict)
    manquants: list[float] = field(default_factory=list)
    mesure: str = "nominal"
    recode: dict[str, Any] | None = None
    calcul: str | None = None
    etapes: list[dict[str, Any]] | None = None
    compte: dict[str, Any] | None = None
    premier: dict[str, Any] | None = None
    source: str = ""                         # référence de la syntaxe d'origine (fichier:ligne)


_ARITH = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv}
_CMP = {ast.Eq: operator.eq, ast.NotEq: operator.ne, ast.Lt: operator.lt, ast.LtE: operator.le, ast.Gt: operator.gt, ast.GtE: operator.ge}


class _Evaluateur:
    def __init__(self, jd: JeuDonnees) -> None:
        self.jd = jd

    def texte(self, nom: str) -> pd.Series:
        return self.jd.table[nom].fillna("").astype(str).str.lstrip().str.upper()

    def texte_argument(self, a: ast.expr) -> pd.Series:
        """Texte d'une variable citée par son nom, de sa première citation (premiere_citation(V)) ou du premier mot
        de celle-ci (premier_mot(V))."""
        if isinstance(a, ast.Name):
            return self.texte(a.id)
        if (isinstance(a, ast.Call) and isinstance(a.func, ast.Name) and a.func.id in ("premiere_citation", "premier_mot")
                and len(a.args) == 1 and isinstance(a.args[0], ast.Name)):
            citation = self.texte(a.args[0].id).str.split(r"[,;]", n=1, regex=True).str[0].str.strip()
            return citation if a.func.id == "premiere_citation" else citation.str.split(n=1).str[0].fillna("")
        raise RegleInvalide("argument de texte attendu : nom de variable, premiere_citation(V) ou premier_mot(V)")

    def __call__(self, expression: str) -> Any:
        try:
            arbre = ast.parse(expression.strip(), mode="eval")
        except SyntaxError as e:
            raise RegleInvalide(f"syntaxe invalide « {expression} » : {e.msg}") from e
        return self.noeud(arbre.body)

    def noeud(self, n: ast.AST) -> Any:
        import pandas as pd

        if isinstance(n, ast.Constant) and isinstance(n.value, int | float | str) and not isinstance(n.value, bool):
            return n.value
        if isinstance(n, ast.Name):
            return self.jd.valides(n.id)
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return -self.noeud(n.operand)
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.Not):
            return ~self._bool(self.noeud(n.operand))
        if isinstance(n, ast.BinOp) and type(n.op) in _ARITH:
            return _ARITH[type(n.op)](self.noeud(n.left), self.noeud(n.right))
        if isinstance(n, ast.BoolOp):
            vals = [self._bool(self.noeud(v)) for v in n.values]
            out = vals[0]
            for v in vals[1:]:
                out = (out & v) if isinstance(n.op, ast.And) else (out | v)
            return out
        if isinstance(n, ast.Compare):
            gauche, resultat = self.noeud(n.left), None
            for op, comp in zip(n.ops, n.comparators, strict=True):
                if isinstance(op, ast.In | ast.NotIn) and isinstance(comp, ast.Tuple):
                    valeurs = [self.noeud(e) for e in comp.elts]
                    r = pd.Series(gauche).isin(valeurs)
                    r = ~r if isinstance(op, ast.NotIn) else r
                elif type(op) in _CMP:
                    droite = self.noeud(comp)
                    # Comme SPSS : une comparaison avec une valeur manquante est FAUSSE (en pandas, NaN != 1 serait vrai)
                    r = _CMP[type(op)](gauche, droite)
                    for operande in (gauche, droite):
                        if isinstance(operande, pd.Series):
                            r = r & operande.notna()
                    gauche = droite
                else:
                    raise RegleInvalide(f"comparaison non autorisée : {type(op).__name__}")
                resultat = r if resultat is None else (resultat & r)
            return resultat
        if (isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in ("commence", "contient", "vide")
                and n.args and isinstance(n.args[0], ast.Call)):
            f, texte = n.func.id, self.texte_argument(n.args[0])
            motif = n.args[1].value if len(n.args) == 2 and isinstance(n.args[1], ast.Constant) else None
            if f == "vide" and len(n.args) == 1:
                return texte.str.strip() == ""
            if motif is not None:
                return texte.str.startswith(str(motif)) if f == "commence" else texte.str.contains(str(motif), regex=False)
            raise RegleInvalide(f"arguments invalides pour {f}")
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and all(isinstance(a, ast.Name | ast.Constant) for a in n.args):
            f = n.func.id
            noms = [a.id if isinstance(a, ast.Name) else str(a.value) for a in n.args if isinstance(a, ast.Name | ast.Constant)]
            if f == "valeur" and len(noms) == 1:
                return pd.to_numeric(self.jd.table[noms[0]], errors="coerce")
            if f == "commence" and len(noms) == 2:
                return self.texte(noms[0]).str.startswith(str(noms[1]))
            if f == "contient" and len(noms) == 2:
                return self.texte(noms[0]).str.contains(str(noms[1]), regex=False)
            if f == "vide" and len(noms) == 1:
                return self.texte(noms[0]).str.strip() == ""
            if f == "manquant" and len(noms) == 1:
                return self.jd.valides(noms[0]).isna()
            raise RegleInvalide(f"fonction inconnue : {f}")
        raise RegleInvalide(f"élément non autorisé : {type(n).__name__}")

    @staticmethod
    def _bool(x: Any) -> Any:
        import pandas as pd
        return pd.Series(x).fillna(False).astype(bool) if not isinstance(x, bool) else x


def deriver(jd: JeuDonnees, d: Derivation) -> pd.Series:
    import numpy as np
    import pandas as pd

    ev = _Evaluateur(jd)
    if d.recode is not None:
        src = jd.valides(d.recode["source"])
        out = src.copy() if d.recode.get("sinon") == "copie" else pd.Series(np.nan, index=jd.table.index)
        for codes, valeur in d.recode["regles"]:
            out = out.mask(src.isin(codes if isinstance(codes, list) else [codes]), valeur)
        return out.astype(float)
    if d.calcul is not None:
        return pd.Series(ev(d.calcul), index=jd.table.index).astype(float)
    if d.etapes is not None:
        out = pd.Series(np.nan, index=jd.table.index)
        for e in d.etapes:
            valeur = ev(str(e["valeur"])) if isinstance(e["valeur"], str) else e["valeur"]
            valeur = pd.Series(valeur, index=jd.table.index) if not isinstance(valeur, pd.Series) else valeur
            if isinstance(valeur.dtype, pd.BooleanDtype) or valeur.dtype == bool:
                valeur = valeur.astype(float)
            condition = _Evaluateur._bool(ev(e["si"])) if "si" in e else pd.Series(True, index=jd.table.index)
            out = out.mask(condition, valeur)
        return out.astype(float)
    if d.compte is not None:
        valeurs = d.compte["valeurs"]
        total = pd.Series(0.0, index=jd.table.index)
        for v in d.compte["variables"]:
            total = total + pd.to_numeric(jd.table[v], errors="coerce").isin(valeurs).astype(float)
        return total
    if d.premier is not None:
        out = pd.Series(np.nan, index=jd.table.index)
        for k, v in enumerate(d.premier["variables"], start=1):
            out = out.mask(out.isna() & (jd.valides(v) == d.premier["valeur"]), k)
        return out.astype(float)
    raise RegleInvalide(f"{d.nom} : aucune règle (recode, calcul, etapes, compte, premier)")


def appliquer(jd: JeuDonnees, derivations: list[Derivation]) -> JeuDonnees:
    """Applique les dérivations dans l'ordre (une dérivation peut utiliser les précédentes)."""
    for d in derivations:
        jd = jd.avec_variable(d.nom, deriver(jd, d), Variable(d.nom, d.label, dict(d.valeurs), set(d.manquants), d.mesure))
    return jd
