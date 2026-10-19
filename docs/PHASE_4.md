# Phase 4 — Moteur d'analyse (M14)

**État : terminée, en attente de validation du fondateur.** 313 tests au vert (dont 170 pour la phase 4, ajouts du 18/10 compris), ruff et mypy strict sans erreur.

## Critère d'acceptation
Test d'or : sorties des syntaxes `EDM_EE_*` reproduites à l'arrondi près ; écarts expliqués.

« À l'arrondi près » : écart ≤ 0,05 avec un repère écrit à une décimale (une valeur à mi-chemin, comme 31,25 % écrit 31,2, est donc conforme quel que soit le sens d'arrondi).

## Résultat du test d'or

| Étage | Ce qui est comparé | Résultat |
|---|---|---|
| 1. Repères des syntaxes | 64 repères recopiés des syntaxes `EDM_EE_SYNTAXE_ANALYSE_GLOBALE_V4`, `EDM_EE_REPRODUCTION_RAPPORT_427` et `EDM_EE_ANALYSES_N05_FILTREES`, chacun avec son fichier:ligne : fréquences et bases, tris croisés, réponses multiples, moyennes et médianes, pondérations (profils égaux, dépense annuelle), AFC, régression logistique. | Les 64 sont reproduits **deux fois** : sur le `.sav` livré au client et sur la base reconstruite par la plateforme à partir des réponses brutes. |
| 2. Base d'analyse | La base produite par la plateforme (réponses brutes → fiches codées → base 427 → variables de contrôle → 62 variables dérivées) comparée **fiche par fiche, variable par variable** à `SPSS_EDM_EE_V6_ANALYSE_427.sav`. | Mêmes 427 fiches. 59 variables brutes identiques, 62 dérivées identiques, variables de contrôle identiques, à deux écarts expliqués près (ci-dessous). |
| 2 bis. Base de collecte | Même comparaison avec `SPSS_EDM_EE_V6_COLLECTE_446.sav` (446 fiches, 127 variables communes). | Identique, aux mêmes deux écarts près. Repères de `N08_B_COLLECTE_446.sps` retrouvés : 427 retenues ; 19 écartées = 11 remplies à moins de 70 % + 8 copies probables. |
| Bout en bout | Le `.sav` d'analyse **écrit** par la plateforme, relu, comparé au `.sav` livré. | Identique aux mêmes deux écarts près. |

## Écarts expliqués (et vérifiés par des tests, pas seulement décrits)

1. **MAACAUTR (texte « Autre marque »).** SPSS l'a importé tronqué à 8 **octets** UTF-8 (« Il achète » devient « Il achè » : le « è » compte double). La syntaxe le signale elle-même (R41:35 et R41:97, qui disent « 8 caractères »). La plateforme garde le texte complet, et le test vérifie que le texte livré est exactement notre texte coupé à 8 octets.
   - Conséquence pour la marque (MARQUE_G et ses dérivées) : R41:253 dit « on retient la PREMIÈRE marque citée dans le texte ». Appliquées telles quelles au texte complet, les règles de R41 auraient classé 7 fiches retenues en Ingelec, alors que leur première marque citée est autre (« Chint, ingelect, Schneider… »). Les règles de texte portent donc sur la première citation (`premiere_citation`, texte avant la première virgule ou le premier « ; »), et la règle Ingelec porte sur son premier mot (`premier_mot`) : une fiche écartée cite ses marques sans virgule.
   - Résultat : les dérivées sont identiques au `.sav` avec le texte complet comme avec le texte tronqué. Aucun chiffre publié ne change.
2. **DOUBLON_SUSP = 1 (« ressemblance forte, à vérifier »).** Dans R41:321-330, ce niveau est une liste de lignes écrite à la main, sans règle chiffrée. Exemple : la fiche 352 y figure avec 6 écarts minimum, mais les fiches 369 et 373, à 6 écarts d'un membre, n'y figurent pas.
   - La règle écrite de la plateforme (≤ 6 écarts d'un membre d'un groupe, D-019) signale ces 2 fiches en plus.
   - Les copies probables (niveau 2, écartées) sont identiques : la base retenue ne change pas.
   - Aucune règle n'a été ajustée pour coller à la liste.
3. **SEG_TS** (typologie TwoStep, N05:355-368) : algorithme propriétaire de SPSS, qui dépend de l'ordre des fiches. Il n'est pas reproduit, et c'est la seule variable du `.sav` absente de la base de la plateforme.

## Ce qui a été construit

- **Jeu de données d'analyse** (`analyse/donnees.py`) : table et métadonnées par variable (libellé, modalités, valeurs manquantes, mesure). Il se charge depuis la base codée ou depuis un `.sav` (manquants déclarés lus dans le fichier).
- **Procédures** (`analyse/procedures.py`), sur des bibliothèques éprouvées uniquement (pandas, scipy, statsmodels, prince). Aucune formule statistique n'est réécrite. Chaque résultat porte sa base, sa pondération, ses avertissements et sa syntaxe SPSS équivalente.
  - Fréquences : % valides, IC 95 %, avertissement « base réduite ».
  - Moyennes et médianes, éventuellement pondérées.
  - Tris croisés : % colonne, khi-deux, V de Cramér, résidus ajustés, alerte quand les effectifs théoriques sont inférieurs à 5. Avec une pondération, les effectifs de chaque case sont arrondis comme le fait SPSS par défaut.
  - Réponses multiples (BASE=CASES).
  - Kruskal-Wallis, Mann-Whitney, Spearman.
  - AFC.
  - Régression logistique : Exp(B), IC, R² de Cox-Snell et de Nagelkerke.
- **Variables de contrôle** (`analyse/controle.py`) : ID_CASE, JOURTERR, NB_NR, TX_REMPL, DOUBLON_SUSP, FILTRE_QUAL. Elles sont calculées avec les mêmes règles que la base d'analyse (une seule source de vérité, décisions du superviseur comprises). JOURTERR range un jour de rattrapage dans le dernier jour prévu, ce qui correspond au libellé « J4 et rattrapage (8-9 oct.) ».
- **Variables dérivées déclaratives** (`analyse/derivees.py`, `projets/edm_cameroun/plan_analyse.yaml`) : 62 règles, chacune citant sa ligne d'origine dans les syntaxes.
  - Types de règles : recodage, calcul, étapes conditionnelles, comptage, rang, fonctions de texte.
  - Sémantique SPSS respectée : un manquant ne vérifie aucune condition, et `valeur(X)` correspond à `VALUE(X)`.
  - Les expressions passent par une liste blanche, sans `eval`.
- **Exports** (`analyse/exports.py`) :
  - classeur Excel, avec un tableau par résultat, base, pondération, avertissements, et une ligne TOTAL contrôlée (export refusé si elle diffère de la somme des lignes) ;
  - syntaxe SPSS `.sps` équivalente à chaque tableau ;
  - `.sav` natif du jeu d'analyse, avec les valeurs manquantes propres à chaque variable (REVMENME : 97, 98, 99). Il est relu et comparé après écriture.
- **Ligne de commande** : `plateforme analyse base <tableur> --dictionnaire … --plan-terrain … --plan-analyse … --decisions … --sortie …` produit `BASE_COLLECTE.sav` (fiches valides, avec FILTRE_QUAL) et `BASE_ANALYSE_DERIVEES.sav` (fiches retenues).

## Corrections faites en cours de phase
- Comparaison avec une constante dans les règles : un masque mal aligné rendait toutes les conditions fausses sauf sur la première ligne. Le défaut a été trouvé par l'étage 2.
- Médiane pondérée : elle était calculée sans tenir compte des poids. Elle n'est plus donnée sur des données pondérées, et un avertissement le signale, tant qu'aucun test de référence SPSS ne la valide.
- Syntaxes SPSS de `CORRESPONDENCE` et `NPAR TESTS /K-W` : les plages de codes, exigées par SPSS, ont été ajoutées.

## Ajouts du 18/10/2026 (après la livraison de la phase)
- **Régression linéaire, ANOVA à un facteur, test t de Student** (variances égales) : validés sur les valeurs certifiées du NIST (StRD : Longley, SiRstv, AtmWtAg), lues directement dans les fichiers officiels copiés dans `backend/tests/reference_nist/` (écart relatif ≤ 10⁻⁷ pour Longley, ≤ 10⁻⁶ pour les ANOVA ; avec 2 groupes, t² = F).
- **Tableaux déclarés** dans `plan_analyse.yaml` (section `tableaux`, 20 tableaux EDM repris des syntaxes et vérifiés par le test d'or) ; filtre traduit en `TEMPORARY. SELECT IF` ; toutes les déclarations vérifiées avant le premier calcul.
- **Commande** `plateforme analyse resultats` : `RESULTATS.xlsx` et `RESULTATS.sps`. La syntaxe ne contient aucun chemin de fichier et contrôle l'effectif de la base active en tête (comme `N08_B_COLLECTE_446.sps`).

## Ce qui n'est pas testé ou pas fait
- Les syntaxes `.sps` générées et les `.sav` écrits n'ont **pas été exécutés ni ouverts dans SPSS 27** : aucun poste équipé (question de cadrage Q8).
- Procédures de M14 encore sans test de référence, donc non déclarées disponibles : tests de colonnes A/B/C avec Bonferroni, Welch, post hoc, Pearson, ACP et analyse factorielle, ACM, typologies, calage sur marges (voir `RESTE_A_FAIRE.md`).
- La médiane pondérée et la typologie TwoStep ne sont pas fournies.
