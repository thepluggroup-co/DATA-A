import pytest

from plateforme.dictionnaire.expressions import ExpressionInvalide, analyser, evaluer, variables

SPECIAUX = frozenset({97, 98, 99})


def test_variables() -> None:
    assert variables("CANAPREF == 6 and PRETACLI == 3") == {"CANAPREF", "PRETACLI"}
    assert variables("VOUSETES in (1, 2) or not DEJACHLI == 2") == {"VOUSETES", "DEJACHLI"}


@pytest.mark.parametrize(("expression", "valeurs", "attendu"), [
    ("CANAPREF == 6 and PRETACLI == 3", {"CANAPREF": 6, "PRETACLI": 3}, True),
    ("CANAPREF == 6 and PRETACLI == 3", {"CANAPREF": 6, "PRETACLI": 2}, False),
    ("PXHAUTGA < PXBASGAM", {"PXHAUTGA": 1, "PXBASGAM": 3}, True),
    ("PXHAUTGA < PXBASGAM", {"PXHAUTGA": 3, "PXBASGAM": 1}, False),
    ("VOUSETES in (1, 2)", {"VOUSETES": 2}, True),
    ("VOUSETES not in (1, 2)", {"VOUSETES": 2}, False),
    ("1 < AGE <= 3", {"AGE": 3}, True),
    ("not A == 1", {"A": 2}, True),
])
def test_evaluer(expression: str, valeurs: dict[str, int], attendu: bool) -> None:
    assert evaluer(expression, valeurs, SPECIAUX) is attendu


@pytest.mark.parametrize("valeur", [97, 98, 99, None, ""])
def test_manquant_non_evalue(valeur: object) -> None:
    """Règle V11 : une incohérence n'est pas jugée si l'une des réponses manque (ou vaut NSP / NA)."""
    assert evaluer("PXHAUTGA < PXBASGAM", {"PXHAUTGA": 1, "PXBASGAM": valeur}, SPECIAUX) is None
    assert evaluer("PXHAUTGA < PXBASGAM", {"PXHAUTGA": 1}, SPECIAUX) is None


@pytest.mark.parametrize("expression", [
    "__import__('os')", "A.attribut == 1", "A + 1 == 2", "f(A)", "A == [1, 2]", "A == 1.5", "A == True", "A in (B, 1)",
    "lambda: 1", "A if B else C", "A ==", "",
])
def test_expressions_refusees(expression: str) -> None:
    with pytest.raises(ExpressionInvalide):
        analyser(expression)
