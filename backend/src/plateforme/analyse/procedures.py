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
        c = float(code)  # type: ignore[arg-type]
        lignes.append(LigneFrequence(c, jd.libelle(variable, c), float(eff), 100 * p, ic95_normal(p, n)))
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
    ligne: str = ""
    colonne: str = ""
    points_lignes: dict[float, tuple[float, ...]] = field(default_factory=dict)     # code -> coordonnées (normalisation symétrique)
    points_colonnes: dict[float, tuple[float, ...]] = field(default_factory=dict)


def correspondances(jd: JeuDonnees, ligne: str, colonne: str, dimensions: int = 2,
                    inverser_axes: list[int] | None = None) -> Correspondances:
    """Analyse des correspondances (prince). Coordonnées en normalisation SYMÉTRIQUE, comme /NORMALIZATION=SYMMETRICAL
    de SPSS : coordonnées principales divisées par la racine de la valeur singulière de l'axe. Le signe d'un axe est
    arbitraire ; `inverser_axes` (1 = premier axe) oriente la carte comme une sortie de référence."""
    import numpy as np
    import pandas as pd
    import prince

    a, b = jd.valides(ligne), jd.valides(colonne)
    ok = a.notna() & b.notna()
    tab = pd.crosstab(a[ok], b[ok])
    ca = prince.CA(n_components=min(dimensions, min(tab.shape) - 1)).fit(tab)
    inertie = float(ca.total_inertia_)
    parts = [100 * float(v) / inertie for v in ca.eigenvalues_]
    racine_sv = np.sqrt(np.sqrt(np.asarray(ca.eigenvalues_, dtype=float)))
    signes = np.array([-1.0 if k + 1 in (inverser_axes or []) else 1.0 for k in range(len(racine_sv))])
    lignes_xy = ca.row_coordinates(tab).to_numpy() / racine_sv * signes
    colonnes_xy = ca.column_coordinates(tab).to_numpy() / racine_sv * signes
    return Correspondances("CORRESPONDENCE", int(ok.sum()), None,
                           f"CORRESPONDENCE TABLE={ligne}{_plage(jd, ligne)} BY {colonne}{_plage(jd, colonne)} /DIMENSIONS={dimensions} /MEASURE=CHISQ "
                           "/STANDARDIZE=RCMEAN /NORMALIZATION=SYMMETRICAL /PRINT=TABLE RPOINTS CPOINTS.",
                           inertie_totale=inertie, part_axes=parts, ligne=ligne, colonne=colonne,
                           points_lignes={float(c): tuple(float(x) for x in xy) for c, xy in zip(tab.index, lignes_xy, strict=True)},
                           points_colonnes={float(c): tuple(float(x) for x in xy) for c, xy in zip(tab.columns, colonnes_xy, strict=True)})


# ------------------------------------------------------------------------------------------------ régression logistique
@dataclass
class Logistique(Resultat):
    coefficients: dict[str, tuple[float, float, float, float]] = field(default_factory=dict)   # terme -> (Exp(B), IC bas, IC haut, p)
    r2_nagelkerke: float = math.nan
    r2_cox_snell: float = math.nan
    hosmer_lemeshow: tuple[float, int, float] = (math.nan, 0, math.nan)            # (khi-deux, ddl, p)


def hosmer_lemeshow(y: Any, prob: Any, groupes: int = 10) -> tuple[float, int, float]:
    """Test d'ajustement de Hosmer-Lemeshow : groupes formés par les déciles des probabilités prédites (bornes = valeurs
    observées), les fiches de même probabilité restant dans le même groupe ; khi-deux à g - 2 ddl sur le tableau 2 × g."""
    import numpy as np
    from scipy.stats import chi2

    y, prob = np.asarray(y, dtype=float), np.round(np.asarray(prob, dtype=float), 10)
    bornes = [np.quantile(prob, k / groupes, method="higher") for k in range(1, groupes)]
    g = np.searchsorted(bornes, prob, side="right")
    stat = 0.0
    codes = np.unique(g)
    for k in codes:
        dans = g == k
        n, o1, e1 = int(dans.sum()), float(y[dans].sum()), float(prob[dans].sum())
        stat += (o1 - e1) ** 2 / e1 + (o1 - e1) ** 2 / (n - e1)
    ddl = len(codes) - 2
    return stat, ddl, float(chi2.sf(stat, ddl))


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
                     r2_nagelkerke=nagel, r2_cox_snell=cox,
                     hosmer_lemeshow=hosmer_lemeshow(df[dependante].to_numpy(dtype=float), modele.predict(x).to_numpy()))
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


# ------------------------------------------------------------------------------------------------ tableaux composés
# Assemblages de procédures déjà validées (aucun calcul nouveau) : ce sont les tableaux de synthèse des rapports.
@dataclass
class Indicateurs(Resultat):
    """Une ligne par indicateur : (variable, libellé, moyenne, N). Pour des indicateurs 0/100, la moyenne est un %."""
    lignes: list[tuple[str, str, float, float]] = field(default_factory=list)
    ic95: dict[str, tuple[float, float]] = field(default_factory=dict)        # variable -> repère IC 95 % (en %)


def indicateurs(jd: JeuDonnees, variables: list[str], poids: str | None = None, ic95: bool = False) -> Indicateurs:
    """Chiffres clés (MEANS TABLES=v1 v2 … /CELLS=MEAN COUNT) : chaque ligne garde SA base. `ic95` : repère d'intervalle
    de confiance des indicateurs en % (0/100), non pondérés seulement (N08_A:85)."""
    import pandas as pd

    nom_poids = poids if poids is not None else jd.poids
    if ic95 and nom_poids:
        raise ValueError("repère IC 95 % non défini sur des indicateurs pondérés")
    lignes = []
    res = Indicateurs("MEANS", 0, nom_poids,
                      (f"WEIGHT BY {nom_poids}.\n" if nom_poids else "") + f"MEANS TABLES={' '.join(variables)} /CELLS=MEAN COUNT.")
    for v in variables:
        m = moyennes(jd, v, poids=poids)
        lignes.append((v, jd.variables[v].label if v in jd.variables else v, m.moyenne, m.effectif))
        if ic95:
            valeurs = set(jd.valides(v).dropna().unique())
            if not valeurs <= {0.0, 100.0}:
                raise ValueError(f"{v} : repère IC 95 % réservé aux indicateurs 0/100")
            res.ic95[v] = ic95_normal(m.moyenne / 100, int(m.effectif))
    res.lignes = lignes
    res.base = int(pd.DataFrame({v: jd.valides(v).notna() for v in variables}).any(axis=1).sum())
    if ic95:
        res.avertissements.append("repère IC 95 % sous hypothèse d'échantillonnage aléatoire, non représentatif d'un plan par quotas")
    return res


def _dixieme(x: float) -> float:
    """Arrondi au dixième, demi vers le haut (affichage du rapport)."""
    from decimal import ROUND_HALF_UP, Decimal

    return float(Decimal(repr(x)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def ic95_normal(p: float, n: int) -> tuple[float, float]:
    """Repère d'intervalle de confiance à 95 % d'une proportion, approximation normale (statsmodels), en %."""
    from statsmodels.stats.proportion import proportion_confint

    if n <= 0:
        return (math.nan, math.nan)
    bas, haut = proportion_confint(p * n, n, alpha=0.05, method="normal")
    return (100 * float(bas), 100 * float(haut))


@dataclass
class SyntheseKhi2(Resultat):
    """Une ligne par croisement : (variable, croisée par, n, khi-deux, ddl, p, V de Cramér, part des théoriques < 5).
    `ecarts` : pour le PREMIER critère de `par`, la case au plus fort résidu ajusté (modalité, colonne, % colonne,
    résidu), seulement si l'écart est significatif (p < 0,05). `kruskal` : p de Kruskal-Wallis demandés."""
    lignes: list[tuple[str, str, int, float, int, float, float, float]] = field(default_factory=list)
    par: list[str] = field(default_factory=list)
    ecarts: dict[str, tuple[str, str, float, float]] = field(default_factory=dict)
    kruskal: dict[tuple[str, str], float] = field(default_factory=dict)


def synthese_khi2(jd: JeuDonnees, variables: list[str], par: list[str],
                  kruskal: dict[str, list[str]] | list[str] | None = None) -> SyntheseKhi2:
    """Tableau des écarts entre groupes (CROSSTABS /TABLES=v… BY p… /STATISTICS=CHISQ PHI), une ligne par croisement ;
    `kruskal` : {variable ordonnée: [critères]} (ou liste de variables, pour tous les critères) pour lesquels le test de
    Kruskal-Wallis complète le khi-deux (NPAR TESTS /K-W)."""
    kw = {v: list(par) for v in kruskal} if isinstance(kruskal, list) else dict(kruskal or {})
    res = SyntheseKhi2("CROSSTABS", len(jd.table), jd.poids,
                       f"CROSSTABS /TABLES={' '.join(variables)} BY {' '.join(par)} /FORMAT=AVALUE TABLES "
                       "/STATISTICS=CHISQ PHI /CELLS=COUNT COLUMN ASRESID.", par=list(par))
    for v in variables:
        for k, g in enumerate(par):
            t = tri_croise(jd, v, g)
            res.lignes.append((v, g, t.base, t.khi2, t.ddl, t.p, t.v_cramer, t.part_theoriques_faibles))
            if t.part_theoriques_faibles > 0.20:
                res.avertissements.append(f"{v} × {g} : {100 * t.part_theoriques_faibles:.0f} % des effectifs théoriques < 5")
            if k == 0 and t.p < 0.05 and t.residus_ajustes:
                i, j = max(((i, j) for i in range(len(t.codes_lignes)) for j in range(len(t.codes_colonnes))),
                           key=lambda ij: abs(t.residus_ajustes[ij[0]][ij[1]]))
                res.ecarts[v] = (jd.libelle(v, t.codes_lignes[i]), jd.libelle(g, t.codes_colonnes[j]), t.pct_colonne[i][j],
                                 t.residus_ajustes[i][j])
            if g in kw.get(v, []):
                res.kruskal[(v, g)] = kruskal_wallis(jd, v, g).p
    return res


@dataclass
class Recapitulatif(Resultat):
    """Une ligne par variable : (variable, libellé, base, modalité principale, % de la modalité principale)."""
    lignes: list[tuple[str, str, int, str, float]] = field(default_factory=list)
    attendu: int | None = None                 # nombre de variables que le tableau doit couvrir (contrôle de complétude)


def recapitulatif(jd: JeuDonnees, variables: list[str], attendu: int | None = None) -> Recapitulatif:
    """Récapitulatif des variables (FREQUENCIES /ORDER=ANALYSIS) : base et modalité la plus citée de chacune."""
    res = Recapitulatif("FREQUENCIES", len(jd.table), jd.poids,
                        f"FREQUENCIES VARIABLES={' '.join(variables)} /ORDER=ANALYSIS.", attendu=attendu)
    for v in variables:
        f = frequences(jd, v)
        tete = max(f.lignes, key=lambda li: li.effectif, default=None)
        res.lignes.append((v, jd.variables[v].label if v in jd.variables else v, f.base,
                           tete.libelle if tete else "", tete.pourcentage if tete else math.nan))
    if attendu is not None and attendu != len(variables):
        res.avertissements.append(f"incomplet : {len(variables)} variables sur {attendu} attendues")
    return res


@dataclass
class Sensibilite(Resultat):
    """Test de sensibilité à la composition de l'échantillon : chaque indicateur recalculé sous plusieurs pondérations.
    Une ligne : (variable, libellé, base non pondérée, valeur non pondérée, {colonne: valeur pondérée}, écart maximal)."""
    colonnes: list[str] = field(default_factory=list)
    lignes: list[tuple[str, str, float, float, dict[str, float], float]] = field(default_factory=list)


def sensibilite(jd: JeuDonnees, variables: list[str], ponderations: dict[str, str]) -> Sensibilite:
    """Tableau 2 bis du rapport EDM : `ponderations` = {titre de colonne: variable de poids}. L'écart maximal est
    l'étendue (maximum − minimum) entre la valeur non pondérée et les valeurs pondérées, calculée sur les valeurs
    arrondies au dixième telles qu'elles sont affichées, comme dans le rapport livré (V14 p. 13 : 81,4 − 79,5 = 1,9 pt)."""
    brut = indicateurs(jd, variables)
    ponderes = {titre: indicateurs(jd, variables, poids=w) for titre, w in ponderations.items()}
    res = Sensibilite("MEANS", brut.base, None,
                      "\n".join([f"MEANS TABLES={' '.join(variables)} /CELLS=MEAN COUNT."]
                                + [f"WEIGHT BY {w}.\nMEANS TABLES={' '.join(variables)} /CELLS=MEAN.\nWEIGHT OFF."
                                   for w in ponderations.values()]),
                      colonnes=list(ponderations))
    for k, (v, lib, m, n) in enumerate(brut.lignes):
        valeurs = {titre: r.lignes[k][2] for titre, r in ponderes.items()}
        tout = [_dixieme(x) for x in (m, *valeurs.values())]       # sur les valeurs AFFICHÉES : le lecteur refait le calcul
        res.lignes.append((v, lib, n, m, valeurs, round(max(tout) - min(tout), 1)))
    return res


@dataclass
class QuotasRealises(Resultat):
    """Fiches réalisées et quotas prévus, cible × ville (tableau 2 du rapport EDM)."""
    cible: str = ""
    ville: str = ""
    codes_cibles: list[float] = field(default_factory=list)
    codes_villes: list[float] = field(default_factory=list)
    realise: list[list[int]] = field(default_factory=list)       # [cible][ville]
    prevu: list[list[int]] = field(default_factory=list)


def quotas_realises(jd: JeuDonnees, cible: str, ville: str, prevu: dict[Any, dict[Any, int]]) -> QuotasRealises:
    """Comptage cible × ville (CROSSTABS, effectifs) rapproché des quotas du plan d'échantillonnage `prevu`
    ({code cible: {code ville: quota}}). Les cibles et villes sont celles du plan, dans son ordre."""
    c, v = jd.valides(cible), jd.valides(ville)
    plan = {float(k): {float(kv): int(n) for kv, n in q.items()} for k, q in prevu.items()}
    codes_c = list(plan)
    codes_v = sorted({kv for q in plan.values() for kv in q})
    res = QuotasRealises("CROSSTABS", int((c.notna() & v.notna()).sum()), jd.poids,
                         f"CROSSTABS /TABLES={cible} BY {ville} /FORMAT=AVALUE TABLES /CELLS=COUNT TOTAL.",
                         cible=cible, ville=ville, codes_cibles=codes_c, codes_villes=codes_v)
    for kc in codes_c:
        res.realise.append([int(((c == kc) & (v == kv)).sum()) for kv in codes_v])
        res.prevu.append([plan[kc].get(kv, 0) for kv in codes_v])
    hors = int((c.notna() & v.notna()).sum()) - sum(map(sum, res.realise))
    if hors:
        res.avertissements.append(f"{hors} fiches hors des cibles ou des villes du plan")
    return res


@dataclass
class Remplissage(Resultat):
    """Tableau de traitement des données (tableau 6 du rapport EDM) : pour chaque variable, part des réponses, des
    « Sans avis / NSP » (code 98, seulement si le questionnaire propose cette case) et des non-réponses (code 99).
    Une ligne : (groupe, variable, libellé, base, % réponses, % 98 ou None, % 99)."""
    lignes: list[tuple[str, str, str, int, float, float | None, float]] = field(default_factory=list)
    attendu: int | None = None


def remplissage(jd: JeuDonnees, groupes: dict[str, list[str]], attendu: int | None = None,
                bases: dict[str, str] | None = None) -> Remplissage:
    """`groupes` : {titre de rubrique: [variables]} dans l'ordre du questionnaire ; `bases` : sous-population propre à
    une variable (ex. le texte « Autre » rapporté aux fiches qui ont coché « Autre »), condition du plan d'analyse."""
    import pandas as pd

    from plateforme.analyse.derivees import _Evaluateur

    res = Remplissage("FREQUENCIES", len(jd.table), jd.poids, "", attendu=attendu)
    variables = [v for vs in groupes.values() for v in vs]
    res.syntaxe_spss = f"FREQUENCIES VARIABLES={' '.join(variables)} /FORMAT=NOTABLE /STATISTICS=NONE /MISSING=INCLUDE."
    for groupe, vs in groupes.items():
        for v in vs:
            brut = jd.table[v]
            if bases and v in bases:
                brut = brut[_Evaluateur._bool(_Evaluateur(jd)(bases[v])).to_numpy()]
            n = len(brut)
            vide = brut.isna() | (brut.astype(str).str.strip() == "")
            codes = pd.to_numeric(brut, errors="coerce")
            propose_98 = 98.0 in (jd.variables[v].valeurs if v in jd.variables else {})
            if codes.notna().sum() == 0 and (~vide).any():          # variable texte : réponse = case remplie
                nsp, nr = 0, int(vide.sum())
            else:
                nsp = int((codes == 98).sum()) if propose_98 else 0
                nr = int((codes == 99).sum() + vide.sum())
            lib = jd.variables[v].label if v in jd.variables and jd.variables[v].label else v
            res.lignes.append((groupe, v, lib, n, _part(n - nr - nsp, n), _part(nsp, n) if propose_98 else None, _part(nr, n)))
    if attendu is not None and attendu != len(variables):
        res.avertissements.append(f"incomplet : {len(variables)} variables sur {attendu} attendues")
    return res


def _part(k: int, n: int) -> float:
    return 100 * k / n if n else math.nan


@dataclass
class Batterie(Resultat):
    """Plusieurs questions présentées ensemble (ex. prix attendus pour trois gammes) : une distribution par variable,
    chacune sur SES réponses valides."""
    variables: list[str] = field(default_factory=list)
    frequences: dict[str, Frequences] = field(default_factory=dict)


def batterie(jd: JeuDonnees, variables: list[str]) -> Batterie:
    """FREQUENCIES VARIABLES=v1 v2 … : chaque variable garde sa base (réponses valides)."""
    res = Batterie("FREQUENCIES", 0, jd.poids, f"FREQUENCIES VARIABLES={' '.join(variables)}.", variables=list(variables))
    for v in variables:
        res.frequences[v] = frequences(jd, v)
    res.base = max((f.base for f in res.frequences.values()), default=0)
    return res


@dataclass
class Repartitions(Resultat):
    """Une même question répartie dans plusieurs sous-populations présentées côte à côte (ex. une ville, puis l'ensemble)."""
    variable: str = ""
    parts: dict[str, Frequences] = field(default_factory=dict)          # titre -> fréquences
    conditions: dict[str, str] = field(default_factory=dict)            # titre -> condition (vide = ensemble)


def repartitions(jd: JeuDonnees, variable: str, groupes: dict[str, str]) -> Repartitions:
    """`groupes` : {titre: condition du plan d'analyse} ; condition vide = ensemble des fiches."""
    from plateforme.analyse.derivees import _Evaluateur

    res = Repartitions("FREQUENCIES", 0, jd.poids, "", variable=variable, conditions=dict(groupes))
    syntaxes = []
    for titre, condition in groupes.items():
        sous = jd.filtrer(_Evaluateur._bool(_Evaluateur(jd)(condition)), condition) if condition else jd
        res.parts[titre] = frequences(sous, variable)
        syntaxes.append(f"* {titre}.")
        syntaxes.append(f"FREQUENCIES VARIABLES={variable}.")
    res.syntaxe_spss = "\n".join(syntaxes)
    res.base = max((f.base for f in res.parts.values()), default=0)
    return res


@dataclass
class PartsBootstrap(Resultat):
    """Parts d'une variable pondérée (ex. part de la dépense estimée par marque), avec intervalle bootstrap à 95 %.
    `parts` : titre -> (part, borne basse, borne haute), en %."""
    variable: str = ""
    poids_variable: str = ""
    tirages: int = 1000
    graine: int = 0
    parts: dict[str, tuple[float, float, float]] = field(default_factory=dict)


def parts_bootstrap(jd: JeuDonnees, variable: str, poids: str, groupes: dict[str, list[float]], tirages: int = 1000,
                    graine: int = 2026) -> PartsBootstrap:
    """Part pondérée de chaque groupe de modalités et intervalle bootstrap percentile à 95 % (scipy.stats.bootstrap,
    rééchantillonnage des fiches avec leur poids, `tirages` tirages, graine fixe : résultat reproductible). Équivalent de
    BOOTSTRAP /SAMPLING METHOD=SIMPLE … /CRITERIA CILEVEL=95 CITYPE=PERCENTILE de SPSS, dont les tirages sont aléatoires."""
    import numpy as np
    from scipy.stats import bootstrap

    x, w = jd.valides(variable), jd.valides(poids)
    ok = x.notna() & w.notna() & (w > 0)
    xv, wv = x[ok].to_numpy(dtype=float), w[ok].to_numpy(dtype=float)
    res = PartsBootstrap("FREQUENCIES (BOOTSTRAP)", int(ok.sum()), poids,
                         f"TEMPORARY.\nSELECT IF NOT MISSING({poids}).\nWEIGHT BY {poids}.\n"
                         f"BOOTSTRAP /SAMPLING METHOD=SIMPLE /VARIABLES INPUT={variable} /CRITERIA CILEVEL=95 CITYPE=PERCENTILE "
                         f"NSAMPLES={tirages}.\nFREQUENCIES VARIABLES={variable}.",
                         variable=variable, poids_variable=poids, tirages=tirages, graine=graine)
    for titre, codes in groupes.items():
        def part(xs: Any, ws: Any, codes: list[float] = codes) -> float:
            return float(100 * np.sum(ws * np.isin(xs, codes)) / np.sum(ws))
        ic = bootstrap((xv, wv), part, paired=True, vectorized=False, n_resamples=tirages, method="percentile",
                       random_state=np.random.default_rng(graine)).confidence_interval
        res.parts[titre] = (part(xv, wv), float(ic.low), float(ic.high))
    res.avertissements.append(f"intervalles bootstrap ({tirages} tirages, graine {graine}) : repère indicatif sous hypothèse "
                              "d'échantillonnage aléatoire")
    return res
