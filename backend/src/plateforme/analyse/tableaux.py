"""Tableaux de résultats déclarés dans le plan d'analyse (section `tableaux`), calculés sur le jeu d'analyse.

Chaque tableau : `titre`, `procedure` (liste blanche ci-dessous), `arguments` (ceux de la procédure, sans le jeu de
données), `source` (référence de la syntaxe ou du cahier des charges) et `filtre` facultatif (même syntaxe que les
conditions des variables dérivées, ex. « PROFIL4 == 2 »). Le filtre est appliqué au calcul ET traduit en
`TEMPORARY. SELECT IF (…)` dans la syntaxe SPSS, pour que l'analyste obtienne le même tableau dans SPSS.
"""

from __future__ import annotations

import ast
import inspect
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from plateforme.analyse import procedures as p
from plateforme.analyse.derivees import RegleInvalide, _Evaluateur
from plateforme.analyse.donnees import JeuDonnees
from plateforme.analyse.exports import ResultatTitre

PROCEDURES: dict[str, Callable[..., p.Resultat]] = {
    "frequences": p.frequences, "moyennes": p.moyennes, "tri_croise": p.tri_croise, "reponses_multiples": p.reponses_multiples,
    "kruskal_wallis": p.kruskal_wallis, "mann_whitney": p.mann_whitney, "spearman": p.spearman, "correspondances": p.correspondances,
    "logistique": p.logistique, "regression_lineaire": p.regression_lineaire, "anova_un_facteur": p.anova_un_facteur,
    "t_student": p.t_student, "indicateurs": p.indicateurs, "synthese_khi2": p.synthese_khi2, "recapitulatif": p.recapitulatif,
    "sensibilite": p.sensibilite, "quotas_realises": p.quotas_realises,
    "remplissage": p.remplissage, "batterie": p.batterie,
    "repartitions": p.repartitions, "parts_bootstrap": p.parts_bootstrap,
}
# arguments qui désignent des variables du jeu de données (vérifiés avant tout calcul)
ARGUMENTS_VARIABLES = {"variable", "par", "poids", "ligne", "colonne", "groupe", "x", "y", "dependante", "variables", "explicatives",
                       "categorielles", "ponderations"}


class TableauInvalide(ValueError):
    """Tableau mal déclaré : procédure inconnue, argument inconnu ou manquant, variable absente, filtre non traduisible."""


@dataclass
class Tableau:
    titre: str
    procedure: str
    arguments: dict[str, Any] = field(default_factory=dict)
    source: str = ""
    filtre: str = ""


def depuis_yaml(brut: list[dict[str, Any]]) -> list[Tableau]:
    out = []
    for d in brut:
        inconnus = set(d) - {"titre", "procedure", "arguments", "source", "filtre"}
        if inconnus or "titre" not in d or "procedure" not in d:
            raise TableauInvalide(f"tableau {d.get('titre', '?')} : champs inconnus {sorted(inconnus)} ou titre/procédure manquant")
        out.append(Tableau(str(d["titre"]), str(d["procedure"]), dict(d.get("arguments") or {}), str(d.get("source", "")),
                           str(d.get("filtre", ""))))
    return out


# ------------------------------------------------------------------------------------------------ filtre → SPSS
_OPS = {ast.Eq: "=", ast.NotEq: "~=", ast.Lt: "<", ast.LtE: "<=", ast.Gt: ">", ast.GtE: ">="}


def filtre_spss(expression: str) -> str:
    """Traduit un filtre (comparaisons, and/or/not, `in (…)`, valeur()) en expression SPSS ; sinon TableauInvalide."""
    def t(n: ast.AST) -> str:
        if isinstance(n, ast.Constant) and isinstance(n.value, int | float) and not isinstance(n.value, bool):
            return f"{n.value:g}"
        if isinstance(n, ast.Constant) and isinstance(n.value, str):
            return "'" + n.value.replace("'", "''") + "'"
        if isinstance(n, ast.Name):
            return n.id
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "valeur" and len(n.args) == 1:
            return f"VALUE({t(n.args[0])})"
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "manquant" and len(n.args) == 1:
            return f"MISSING({t(n.args[0])})"
        if isinstance(n, ast.BoolOp):
            return "(" + (" AND " if isinstance(n.op, ast.And) else " OR ").join(t(v) for v in n.values) + ")"
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.Not):
            return f"NOT ({t(n.operand)})"
        if isinstance(n, ast.Compare) and len(n.ops) == 1:
            op, droite = n.ops[0], n.comparators[0]
            if isinstance(op, ast.In | ast.NotIn) and isinstance(droite, ast.Tuple):
                expr = f"ANY({t(n.left)}, {', '.join(t(e) for e in droite.elts)})"
                return f"NOT {expr}" if isinstance(op, ast.NotIn) else expr
            if type(op) in _OPS:
                return f"{t(n.left)} {_OPS[type(op)]} {t(droite)}"
        raise TableauInvalide(f"filtre non traduisible en SPSS : « {expression} »")
    try:
        return t(ast.parse(expression.strip(), mode="eval").body)
    except SyntaxError as e:
        raise TableauInvalide(f"filtre invalide « {expression} » : {e.msg}") from e


# ------------------------------------------------------------------------------------------------ calcul
def _verifier(tab: Tableau, jd: JeuDonnees) -> Callable[..., p.Resultat]:
    if tab.procedure not in PROCEDURES:
        raise TableauInvalide(f"« {tab.titre} » : procédure inconnue {tab.procedure} (connues : {', '.join(sorted(PROCEDURES))})")
    f = PROCEDURES[tab.procedure]
    params = list(inspect.signature(f).parameters.values())[1:]                  # sans le jeu de données
    inconnus = set(tab.arguments) - {q.name for q in params}
    manquants = {q.name for q in params if q.default is inspect.Parameter.empty} - set(tab.arguments)
    if inconnus or manquants:
        raise TableauInvalide(f"« {tab.titre} » : arguments inconnus {sorted(inconnus)}, manquants {sorted(manquants)}")
    for nom, valeur in tab.arguments.items():
        if nom in ARGUMENTS_VARIABLES and valeur is not None:
            noms = list(valeur.values()) if isinstance(valeur, dict) else (valeur if isinstance(valeur, list) else [valeur])
            absentes = [v for v in noms if v not in jd.table.columns]
            if absentes:
                raise TableauInvalide(f"« {tab.titre} » : variables absentes du jeu d'analyse : {', '.join(map(str, absentes))}")
    return f


def calculer(tab: Tableau, jd: JeuDonnees) -> ResultatTitre:
    f = _verifier(tab, jd)
    arguments = {k: (tuple(v) if k == "codes" else v) for k, v in tab.arguments.items()}
    if tab.filtre:
        spss = filtre_spss(tab.filtre)
        try:
            masque = _Evaluateur._bool(_Evaluateur(jd)(tab.filtre))
        except RegleInvalide as e:
            raise TableauInvalide(f"« {tab.titre} » : {e}") from e
        r = f(jd.filtrer(masque, tab.filtre), **arguments)
        r.syntaxe_spss = f"TEMPORARY.\nSELECT IF ({spss}).\n{r.syntaxe_spss}"
        r.avertissements.insert(0, f"filtre : {tab.filtre} ({int(masque.sum())} fiches)")
    else:
        r = f(jd, **arguments)
    titre = tab.titre + (f" [source : {tab.source}]" if tab.source else "")
    return ResultatTitre(titre, r)


def produire(tableaux: list[Tableau], jd: JeuDonnees) -> list[ResultatTitre]:
    """Tous les tableaux ; les déclarations sont TOUTES vérifiées avant le premier calcul."""
    for tab in tableaux:
        _verifier(tab, jd)
        if tab.filtre:
            filtre_spss(tab.filtre)
    return [calculer(tab, jd) for tab in tableaux]
