"""Procédures statistiques (niveau SPSS). AUCUNE formule statistique n'est réécrite : chaque calcul délègue à une
bibliothèque éprouvée (pandas, scipy, statsmodels, prince). Chaque résultat porte :
- sa base (n non pondéré, et somme des poids si pondéré) et la pondération utilisée ;
- les conditions d'application non respectées (effectifs théoriques < 5, base réduite…) ;
- la syntaxe SPSS équivalente, pour que l'analyste puisse refaire le calcul dans SPSS.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from plateforme.analyse.donnees import JeuDonnees

SEUIL_BASE_REDUITE = 0.20        # au-delà de 20 % de manquants : « base réduite » (consigne de la syntaxe V4)


def _plage(jd: JeuDonnees, variable: str) -> str:
    """Plage de codes valides « (min max) », exigée par SPSS dans CORRESPONDENCE et NPAR TESTS /K-W."""
    s = jd.valides(variable).dropna()
    return f"({s.min():g} {s.max():g})" if len(s) else "(1 1)"


@dataclass
class Resultat:
    procedure: str
    base: int                                  # fiches prises en compte (non pondéré)
    ponderation: str | None
    syntaxe_spss: str
    avertissements: list[str] = field(default_factory=list)


# ------------------------------------------------------------------------------------------------ fréquences
@dataclass
class LigneFrequence:
    code: float
    libelle: str
    effectif: float                            # pondéré si pondération
    pourcentage: float                         # % valide (0-100)
    ic95: tuple[float, float]                  # p ± 1,96 × √(p(1-p)/n) (repère du rapport), en %


@dataclass
class Frequences(Resultat):
    variable: str = ""
    lignes: list[LigneFrequence] = field(default_factory=list)
    manquants: int = 0
    total_pondere: float = 0.0

    def pct(self, *codes: float) -> float:
        return sum(li.pourcentage for li in self.lignes if li.code in {float(c) for c in codes})


def frequences(jd: JeuDonnees, variable: str, poids: str | None = None) -> Frequences:
    s = jd.valides(variable)
    w = jd.poids_serie(poids)
    ok = s.notna() & w.notna() & (w > 0)
    total = float(w[ok].sum())
    n = int(ok.sum())
    lignes = []
    for code, eff in w[ok].groupby(s[ok]).sum().sort_index().items():
        p = eff / total if total else 0
        demi = 1.96 * math.sqrt(p * (1 - p) / n) if n else 0
        c = float(code)  # type: ignore[arg-type]
        lignes.append(LigneFrequence(c, jd.libelle(variable, c), float(eff), 100 * p, (100 * (p - demi), 100 * (p + demi))))
    nom_poids = poids if poids is not None else jd.poids
    res = Frequences("FREQUENCIES", n, nom_poids,
                     (f"WEIGHT BY {nom_poids}.\n" if nom_poids else "") + f"FREQUENCIES VARIABLES={variable}.",
                     variable=variable, lignes=lignes, manquants=int(len(s) - n), total_pondere=total)
    if len(s) and (len(s) - n) / len(s) > SEUIL_BASE_REDUITE:
        res.avertissements.append(f"base réduite : {len(s) - n} fiches sans réponse valide sur {len(s)} (citer n = {n})")
    return res


# ------------------------------------------------------------------------------------------------ moyennes
@dataclass
class Moyenne(Resultat):
    variable: str = ""
    moyenne: float = math.nan
    mediane: float = math.nan
    effectif: float = 0.0                      # somme des poids (N de SPSS MEANS)
    groupes: dict[float, tuple[float, float, float]] = field(default_factory=dict)   # code -> (moyenne, médiane, N)


def moyennes(jd: JeuDonnees, variable: str, par: str | None = None, poids: str | None = None) -> Moyenne:
    import numpy as np

    x, w = jd.valides(variable), jd.poids_serie(poids)
    ok = x.notna() & w.notna() & (w > 0)

    nom_poids = poids if poids is not None else jd.poids
    # Médiane pondérée : la règle de SPSS MEANS n'est pas vérifiée par un test de référence ; elle n'est donc pas donnée.
    pondere = nom_poids is not None and w[ok].nunique() > 1

    def stats(masque: Any) -> tuple[float, float, float]:
        xs, ws = x[masque], w[masque]
        if ws.sum() == 0:
            return math.nan, math.nan, 0.0
        return float(np.average(xs, weights=ws)), math.nan if pondere else float(xs.median()), float(ws.sum())

    m, med, n = stats(ok)
    res = Moyenne("MEANS", int(ok.sum()), nom_poids, (f"WEIGHT BY {nom_poids}.\n" if nom_poids else "")
                  + f"MEANS TABLES={variable}" + (f" BY {par}" if par else "") + " /CELLS=MEAN MEDIAN COUNT.",
                  variable=variable, moyenne=m, mediane=med, effectif=n)
    if pondere:
        res.avertissements.append("médiane non calculée sur données pondérées (règle de SPSS non vérifiée par un test de référence)")
    if par:
        g = jd.valides(par)
        for code in sorted(g[ok].dropna().unique()):
            res.groupes[float(code)] = stats(ok & (g == code))
    return res


# ------------------------------------------------------------------------------------------------ tris croisés
@dataclass
class TriCroise(Resultat):
    ligne: str = ""
    colonne: str = ""
    codes_lignes: list[float] = field(default_factory=list)
    codes_colonnes: list[float] = field(default_factory=list)
    effectifs: list[list[float]] = field(default_factory=list)
    pct_colonne: list[list[float]] = field(default_factory=list)
    residus_ajustes: list[list[float]] = field(default_factory=list)
    khi2: float = math.nan
    ddl: int = 0
    p: float = math.nan
    v_cramer: float = math.nan
    part_theoriques_faibles: float = 0.0


def tri_croise(jd: JeuDonnees, ligne: str, colonne: str, poids: str | None = None) -> TriCroise:
    """CROSSTABS. Avec une pondération, les effectifs des cases sont arrondis à l'entier (demi vers le haut) avant
    pourcentages et tests, comme l'option par défaut de SPSS (« Arrondir les effectifs des cases »)."""
    import numpy as np
    import pandas as pd
    from scipy.stats import chi2_contingency
    from scipy.stats.contingency import association
    from statsmodels.stats.contingency_tables import Table

    a, b, w = jd.valides(ligne), jd.valides(colonne), jd.poids_serie(poids)
    ok = a.notna() & b.notna() & w.notna() & (w > 0)
    tab = pd.crosstab(a[ok], b[ok], values=w[ok], aggfunc="sum").fillna(0.0)
    nom_poids = poids if poids is not None else jd.poids
    obs = np.floor(tab.to_numpy() + 0.5).astype(np.int64)
    res = TriCroise("CROSSTABS", int(ok.sum()), nom_poids,
                    (f"WEIGHT BY {nom_poids}.\n" if nom_poids else "")
                    + f"CROSSTABS /TABLES={ligne} BY {colonne} /STATISTICS=CHISQ PHI /CELLS=COUNT COLUMN ASRESID.",
                    ligne=ligne, colonne=colonne, codes_lignes=[float(c) for c in tab.index],
                    codes_colonnes=[float(c) for c in tab.columns], effectifs=obs.tolist(),
                    pct_colonne=(100 * obs / obs.sum(axis=0)).tolist())
    if nom_poids:
        res.avertissements.append("effectifs pondérés arrondis à l'entier par case (comme SPSS CROSSTABS)")
    if obs.shape[0] > 1 and obs.shape[1] > 1:
        khi2, p, ddl, attendus = chi2_contingency(obs, correction=False)
        res.khi2, res.p, res.ddl = float(khi2), float(p), int(ddl)
        res.v_cramer = float(association(obs, method="cramer", correction=False))
        res.residus_ajustes = Table(obs).standardized_resids.tolist()
        res.part_theoriques_faibles = float((attendus < 5).mean())
        if res.part_theoriques_faibles > 0.20:
            res.avertissements.append(f"{100 * res.part_theoriques_faibles:.1f} % des cases ont un effectif théorique < 5 : "
                                      "khi-deux peu fiable, citer l'écart comme descriptif")
    return res


# ------------------------------------------------------------------------------------------------ réponses multiples
@dataclass
class ReponsesMultiples(Resultat):
    variables: list[str] = field(default_factory=list)
    pct_observations: dict[str, float] = field(default_factory=dict)     # variable -> % des observations
    pct_reponses: dict[str, float] = field(default_factory=dict)


def reponses_multiples(jd: JeuDonnees, variables: list[str], valeur: float = 1, poids: str | None = None) -> ReponsesMultiples:
    """MULT RESPONSE (dichotomies) : base = observations ayant au moins une modalité comptée (BASE=CASES de SPSS)."""
    import pandas as pd

    cites = pd.DataFrame({v: (jd.valides(v) == valeur) for v in variables})
    w = jd.poids_serie(poids)
    base = cites.any(axis=1) & w.notna() & (w > 0)
    total_obs = float(w[base].sum())
    total_rep = float(sum(w[base & cites[v]].sum() for v in variables))
    res = ReponsesMultiples("MULT RESPONSE", int(base.sum()), poids if poids is not None else jd.poids,
                            f"MULT RESPONSE GROUPS=$ENSEMBLE ({' '.join(variables)} ({valeur:g})) /FREQUENCIES=$ENSEMBLE /BASE=CASES.",
                            variables=variables)
    for v in variables:
        n = float(w[base & cites[v]].sum())
        res.pct_observations[v] = 100 * n / total_obs if total_obs else math.nan
        res.pct_reponses[v] = 100 * n / total_rep if total_rep else math.nan
    return res


# ------------------------------------------------------------------------------------------------ tests non paramétriques
@dataclass
class TestStatistique(Resultat):
    statistique: float = math.nan
    p: float = math.nan
    ddl: int | None = None
    detail: dict[str, Any] = field(default_factory=dict)


def kruskal_wallis(jd: JeuDonnees, variable: str, groupe: str) -> TestStatistique:
    from scipy.stats import kruskal

    x, g = jd.valides(variable), jd.valides(groupe)
    ok = x.notna() & g.notna()
    echantillons = [x[ok & (g == c)].to_numpy() for c in sorted(g[ok].unique())]
    stat, p = kruskal(*echantillons)
    return TestStatistique("NPAR TESTS /K-W", int(ok.sum()), None, f"NPAR TESTS /K-W={variable} BY {groupe}{_plage(jd, groupe)} /MISSING ANALYSIS.",
                           statistique=float(stat), p=float(p), ddl=len(echantillons) - 1)


def mann_whitney(jd: JeuDonnees, variable: str, groupe: str, codes: tuple[float, float]) -> TestStatistique:
    from scipy.stats import mannwhitneyu

    x, g = jd.valides(variable), jd.valides(groupe)
    a, b = x[g == codes[0]].dropna(), x[g == codes[1]].dropna()
    r = mannwhitneyu(a, b, alternative="two-sided", method="asymptotic", use_continuity=False)
    return TestStatistique("NPAR TESTS /M-W", len(a) + len(b), None,
                           f"NPAR TESTS /M-W={variable} BY {groupe}({codes[0]:g} {codes[1]:g}) /MISSING ANALYSIS.",
                           statistique=float(r.statistic), p=float(r.pvalue))


def spearman(jd: JeuDonnees, x: str, y: str) -> TestStatistique:
    from scipy.stats import spearmanr

    a, b = jd.valides(x), jd.valides(y)
    ok = a.notna() & b.notna()
    r = spearmanr(a[ok], b[ok])
    return TestStatistique("NONPAR CORR", int(ok.sum()), None, f"NONPAR CORR /VARIABLES={x} WITH {y} /PRINT=SPEARMAN TWOTAIL "
                           "/MISSING=PAIRWISE.", statistique=float(r.statistic), p=float(r.pvalue))


# ------------------------------------------------------------------------------------------------ analyse des correspondances
@dataclass
class Correspondances(Resultat):
    inertie_totale: float = math.nan
    part_axes: list[float] = field(default_factory=list)                 # % d'inertie par axe


def correspondances(jd: JeuDonnees, ligne: str, colonne: str, dimensions: int = 2) -> Correspondances:
    import pandas as pd
    import prince

    a, b = jd.valides(ligne), jd.valides(colonne)
    ok = a.notna() & b.notna()
    tab = pd.crosstab(a[ok], b[ok])
    ca = prince.CA(n_components=min(dimensions, min(tab.shape) - 1)).fit(tab)
    inertie = float(ca.total_inertia_)
    parts = [100 * float(v) / inertie for v in ca.eigenvalues_]
    return Correspondances("CORRESPONDENCE", int(ok.sum()), None,
                           f"CORRESPONDENCE TABLE={ligne}{_plage(jd, ligne)} BY {colonne}{_plage(jd, colonne)} /DIMENSIONS={dimensions} /MEASURE=CHISQ "
                           "/STANDARDIZE=RCMEAN /NORMALIZATION=SYMMETRICAL /PRINT=TABLE RPOINTS CPOINTS.",
                           inertie_totale=inertie, part_axes=parts)


# ------------------------------------------------------------------------------------------------ régression logistique
@dataclass
class Logistique(Resultat):
    coefficients: dict[str, tuple[float, float, float, float]] = field(default_factory=dict)   # terme -> (Exp(B), IC bas, IC haut, p)
    r2_nagelkerke: float = math.nan
    r2_cox_snell: float = math.nan


def logistique(jd: JeuDonnees, dependante: str, explicatives: list[str], categorielles: list[str]) -> Logistique:
    """Régression logistique binaire (statsmodels), indicateurs catégoriels avec la 1re modalité en référence
    (/CONTRAST=INDICATOR(1) de SPSS). R² de Cox-Snell et de Nagelkerke calculés depuis les log-vraisemblances."""
    import numpy as np
    import pandas as pd
    import statsmodels.api as sm

    cols = [dependante, *explicatives]
    df = pd.DataFrame({c: jd.valides(c) for c in cols}).dropna()
    x_parts = []
    for v in explicatives:
        if v in categorielles:
            x_parts.append(pd.get_dummies(df[v].astype(int), prefix=v, drop_first=True, dtype=float))
        else:
            x_parts.append(df[[v]].astype(float))
    x = sm.add_constant(pd.concat(x_parts, axis=1))
    modele = sm.Logit(df[dependante].astype(float), x).fit(disp=False)
    n = len(df)
    cox = 1 - math.exp(2 * (modele.llnull - modele.llf) / n)
    nagel = cox / (1 - math.exp(2 * modele.llnull / n))
    ic = modele.conf_int()
    res = Logistique("LOGISTIC REGRESSION", n, None,
                     f"LOGISTIC REGRESSION VARIABLES {dependante} /METHOD=ENTER {' '.join(explicatives)} "
                     + (f"/CATEGORICAL={' '.join(categorielles)} " if categorielles else "")
                     + " ".join(f"/CONTRAST ({c})=INDICATOR(1)" for c in categorielles) + " /PRINT=GOODFIT CI(95).",
                     r2_nagelkerke=nagel, r2_cox_snell=cox)
    for terme in x.columns:
        if terme == "const":
            continue
        res.coefficients[terme] = (float(np.exp(modele.params[terme])), float(np.exp(ic.loc[terme, 0])), float(np.exp(ic.loc[terme, 1])),
                                   float(modele.pvalues[terme]))
    return res


# ------------------------------------------------------------------------------------------------ régression linéaire
@dataclass
class RegressionLineaire(Resultat):
    coefficients: dict[str, tuple[float, float, float]] = field(default_factory=dict)   # terme -> (B, erreur type, p)
    r2: float = math.nan
    r2_ajuste: float = math.nan
    ecart_type_residuel: float = math.nan
    f: float = math.nan
    ddl: tuple[int, int] = (0, 0)                                                          # (modèle, résidus)
    p: float = math.nan


def regression_lineaire(jd: JeuDonnees, dependante: str, explicatives: list[str]) -> RegressionLineaire:
    """Régression linéaire par moindres carrés ordinaires (statsmodels OLS), fiches incomplètes supprimées
    (/MISSING LISTWISE de SPSS). Non pondérée : la pondération de SPSS (poids d'effectif) n'est pas encore validée."""
    import pandas as pd
    import statsmodels.api as sm

    df = pd.DataFrame({c: jd.valides(c) for c in [dependante, *explicatives]}).dropna().astype(float)
    modele = sm.OLS(df[dependante], sm.add_constant(df[explicatives], has_constant="add")).fit()
    res = RegressionLineaire("REGRESSION", len(df), None,
                             f"REGRESSION /MISSING LISTWISE /STATISTICS COEFF R ANOVA /DEPENDENT {dependante} "
                             f"/METHOD=ENTER {' '.join(explicatives)}.",
                             r2=float(modele.rsquared), r2_ajuste=float(modele.rsquared_adj),
                             ecart_type_residuel=math.sqrt(float(modele.mse_resid)), f=float(modele.fvalue),
                             ddl=(int(modele.df_model), int(modele.df_resid)), p=float(modele.f_pvalue))
    for terme in modele.params.index:
        res.coefficients[str(terme)] = (float(modele.params[terme]), float(modele.bse[terme]), float(modele.pvalues[terme]))
    if len(df) < 10 * (len(explicatives) + 1):
        res.avertissements.append(f"{len(df)} observations pour {len(explicatives) + 1} paramètres : moins de 10 observations "
                                  "par paramètre, estimations fragiles")
    return res


# ------------------------------------------------------------------------------------------------ ANOVA, test t
@dataclass
class Anova(Resultat):
    variable: str = ""
    groupe: str = ""
    sc_inter: float = math.nan            # somme des carrés entre groupes
    sc_intra: float = math.nan            # somme des carrés intra-groupes (résidus)
    ddl: tuple[int, int] = (0, 0)
    f: float = math.nan
    p: float = math.nan
    r2: float = math.nan
    ecart_type_residuel: float = math.nan
    moyennes: dict[float, tuple[float, int]] = field(default_factory=dict)              # code -> (moyenne, n)


def anova_un_facteur(jd: JeuDonnees, variable: str, groupe: str) -> Anova:
    """ANOVA à un facteur (statsmodels : modèle linéaire puis table d'analyse de la variance), comme ONEWAY de SPSS."""
    import pandas as pd
    import statsmodels.api as sm
    from statsmodels.formula.api import ols

    df = pd.DataFrame({"y": jd.valides(variable), "g": jd.valides(groupe)}).dropna()
    table = sm.stats.anova_lm(ols("y ~ C(g)", data=df).fit(), typ=1)
    inter, intra = table.loc["C(g)"], table.loc["Residual"]
    res = Anova("ONEWAY", len(df), None, f"ONEWAY {variable} BY {groupe} /STATISTICS DESCRIPTIVES /MISSING ANALYSIS.",
                variable=variable, groupe=groupe, sc_inter=float(inter["sum_sq"]), sc_intra=float(intra["sum_sq"]), ddl=(int(inter["df"]), int(intra["df"])),
                f=float(inter["F"]), p=float(inter["PR(>F)"]),
                r2=float(inter["sum_sq"] / (inter["sum_sq"] + intra["sum_sq"])),
                ecart_type_residuel=math.sqrt(float(intra["sum_sq"] / intra["df"])))
    for code, s in df.groupby("g")["y"]:
        res.moyennes[float(code)] = (float(s.mean()), len(s))  # type: ignore[arg-type]
    if min(n for _, n in res.moyennes.values()) < 2:
        res.avertissements.append("un groupe compte moins de 2 observations")
    return res


def t_student(jd: JeuDonnees, variable: str, groupe: str, codes: tuple[float, float]) -> TestStatistique:
    """Test t de Student pour deux échantillons indépendants, variances supposées égales (scipy) : ligne « Hypothèse
    de variances égales » de T-TEST GROUPS de SPSS. Statistique = t, ddl = n1 + n2 - 2."""
    from scipy.stats import ttest_ind

    x, g = jd.valides(variable), jd.valides(groupe)
    a, b = x[g == codes[0]].dropna(), x[g == codes[1]].dropna()
    r = ttest_ind(a, b, equal_var=True)
    res = TestStatistique("T-TEST", len(a) + len(b), None,
                          f"T-TEST GROUPS={groupe}({codes[0]:g} {codes[1]:g}) /VARIABLES={variable} /MISSING=ANALYSIS.",
                          statistique=float(r.statistic), p=float(r.pvalue), ddl=len(a) + len(b) - 2,
                          detail={"moyenne_1": float(a.mean()), "moyenne_2": float(b.mean())})
    res.avertissements.append("variances supposées égales ; la correction de Welch n'est pas encore validée par un test de référence")
    return res
