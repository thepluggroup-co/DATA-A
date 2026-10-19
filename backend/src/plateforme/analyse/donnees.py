"""Jeu de données d'analyse : table + métadonnées (libellés, modalités, valeurs manquantes PAR VARIABLE, mesure).

Les valeurs manquantes sont un choix d'analyse, déclaré variable par variable (exemple EDM : « Sans avis » (98)
est une réponse valide pour Q15, Q16, Q21, Q22, alors que « NSP » (98) est exclu pour Q5). Les codes restent
dans la table ; `valides()` renvoie la série où les manquants sont remplacés par NaN.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import pandas as pd


@dataclass
class Variable:
    nom: str
    label: str = ""
    valeurs: dict[float, str] = field(default_factory=dict)
    manquants: set[float] = field(default_factory=set)
    mesure: str = "nominal"             # nominal | ordinal | scale


@dataclass
class JeuDonnees:
    table: pd.DataFrame
    variables: dict[str, Variable]
    poids: str | None = None
    description: str = ""

    def variable(self, nom: str) -> Variable:
        return self.variables.get(nom) or Variable(nom)

    def valides(self, nom: str) -> pd.Series:
        """Série numérique, NaN pour les valeurs manquantes déclarées (et les cellules vides)."""
        import pandas as pd

        s = pd.to_numeric(self.table[nom], errors="coerce")
        manq = self.variable(nom).manquants
        return s.where(~s.isin(list(manq))) if manq else s

    def libelle(self, nom: str, code: float) -> str:
        return self.variable(nom).valeurs.get(float(code), str(code))

    def filtrer(self, masque: pd.Series, description: str = "") -> JeuDonnees:
        return JeuDonnees(self.table[masque].reset_index(drop=True), self.variables, self.poids,
                          (self.description + " ; " if self.description else "") + description)

    def poids_serie(self, poids: str | None = None) -> pd.Series:
        import pandas as pd

        nom = poids if poids is not None else self.poids
        if nom is None:
            return pd.Series(1.0, index=self.table.index)
        return pd.to_numeric(self.table[nom], errors="coerce")

    def avec_variable(self, nom: str, valeurs: Any, variable: Variable | None = None) -> JeuDonnees:
        table = self.table.copy()
        table[nom] = valeurs
        return JeuDonnees(table, {**self.variables, nom: variable or Variable(nom)}, self.poids, self.description)


def depuis_sav(chemin: str | Path) -> JeuDonnees:
    """Charge un .sav en gardant les codes de manquants (user_missing) et les déclarations du fichier."""
    import pyreadstat

    df, meta = pyreadstat.read_sav(str(chemin), user_missing=True)
    variables = {}
    for nom in meta.column_names:
        manq: set[float] = set()
        for r in meta.missing_ranges.get(nom, []):
            if isinstance(r, dict) and r.get("lo") == r.get("hi"):
                manq.add(float(r["lo"]))
            elif isinstance(r, int | float):
                manq.add(float(r))
        variables[nom] = Variable(nom, meta.column_names_to_labels.get(nom) or "",
                                  {float(k): str(v) for k, v in (meta.variable_value_labels.get(nom) or {}).items()},
                                  manq, meta.variable_measure.get(nom) or "nominal")
    return JeuDonnees(df, variables, description=f"{Path(chemin).name} ({len(df)} fiches)")
