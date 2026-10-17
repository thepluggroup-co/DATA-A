"""Langage d'expressions des règles de cohérence et des conditions d'affichage.

Syntaxe volontairement réduite, analysée par `ast` puis vérifiée par liste blanche
(aucun `eval`) :
    CANAPREF == 6 and PRETACLI == 3
    PXHAUTGA < PXBASGAM
    VOUSETES in (1, 2) or not DEJACHLI == 2

Éléments autorisés : noms de variables, entiers, chaînes, tuples d'entiers,
`and`, `or`, `not`, comparaisons `== != < <= > >= in not in`.

Règle des manquants : si une variable citée est vide ou porte un code spécial
(97, 98, 99 par défaut), l'expression n'est pas évaluée (résultat None). C'est le
comportement de V11 (« ignorées si une des deux réponses manque »).
"""

from __future__ import annotations

import ast
import operator
from collections.abc import Callable, Mapping
from functools import lru_cache
from typing import Any

_COMPARAISONS: dict[type[ast.cmpop], Callable[[Any, Any], bool]] = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
    ast.In: lambda a, b: a in b,
    ast.NotIn: lambda a, b: a not in b,
}


class ExpressionInvalide(ValueError):
    """Expression hors du langage autorisé."""


def _verifier(noeud: ast.AST) -> None:
    if isinstance(noeud, ast.Expression):
        _verifier(noeud.body)
    elif isinstance(noeud, ast.BoolOp):
        for v in noeud.values:
            _verifier(v)
    elif isinstance(noeud, ast.UnaryOp) and isinstance(noeud.op, ast.Not):
        _verifier(noeud.operand)
    elif isinstance(noeud, ast.Compare):
        if any(type(op) not in _COMPARAISONS for op in noeud.ops):
            raise ExpressionInvalide("opérateur de comparaison non autorisé")
        _verifier(noeud.left)
        for c in noeud.comparators:
            _verifier(c)
    elif isinstance(noeud, ast.Name):
        return
    elif isinstance(noeud, ast.Constant):
        if not isinstance(noeud.value, int | str) or isinstance(noeud.value, bool):
            raise ExpressionInvalide(f"constante non autorisée : {noeud.value!r}")
    elif isinstance(noeud, ast.Tuple):
        for e in noeud.elts:
            if not isinstance(e, ast.Constant):
                raise ExpressionInvalide("un tuple ne peut contenir que des constantes")
            _verifier(e)
    else:
        raise ExpressionInvalide(f"élément non autorisé : {type(noeud).__name__}")


@lru_cache(maxsize=1024)
def analyser(expression: str) -> ast.Expression:
    """Analyse et vérifie une expression ; lève ExpressionInvalide sinon."""
    try:
        arbre = ast.parse(expression.strip(), mode="eval")
    except SyntaxError as e:
        raise ExpressionInvalide(f"syntaxe invalide : {e.msg}") from e
    _verifier(arbre)
    return arbre


def variables(expression: str) -> set[str]:
    """Variables citées par l'expression."""
    return {n.id for n in ast.walk(analyser(expression)) if isinstance(n, ast.Name)}


def _valeur(noeud: ast.AST, valeurs: Mapping[str, Any]) -> Any:
    if isinstance(noeud, ast.Name):
        return valeurs[noeud.id]
    if isinstance(noeud, ast.Constant):
        return noeud.value
    if isinstance(noeud, ast.Tuple):
        return tuple(_valeur(e, valeurs) for e in noeud.elts)
    if isinstance(noeud, ast.BoolOp):
        resultats = (_valeur(v, valeurs) for v in noeud.values)
        return all(resultats) if isinstance(noeud.op, ast.And) else any(resultats)
    if isinstance(noeud, ast.UnaryOp):
        return not _valeur(noeud.operand, valeurs)
    if isinstance(noeud, ast.Compare):
        gauche = _valeur(noeud.left, valeurs)
        for op, comp in zip(noeud.ops, noeud.comparators, strict=True):
            droite = _valeur(comp, valeurs)
            if not _COMPARAISONS[type(op)](gauche, droite):
                return False
            gauche = droite
        return True
    raise ExpressionInvalide(type(noeud).__name__)  # inatteignable : arbre déjà vérifié


def evaluer(expression: str, valeurs: Mapping[str, Any], codes_speciaux: frozenset[int]) -> bool | None:
    """Évalue l'expression ; None si une variable citée est absente, vide ou porte un code spécial."""
    arbre = analyser(expression)
    for nom in variables(expression):
        v = valeurs.get(nom)
        if v is None or v == "" or (isinstance(v, int) and not isinstance(v, bool) and v in codes_speciaux):
            return None
    return bool(_valeur(arbre.body, valeurs))
