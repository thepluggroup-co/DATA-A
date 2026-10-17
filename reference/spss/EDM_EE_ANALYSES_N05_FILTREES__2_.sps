* Encoding: UTF-8.
* =========================================================================.
* ÉTUDE DE MARCHÉ - MATÉRIEL ET ÉQUIPEMENTS ÉLECTRIQUES (Douala, Yaoundé,
* Bafoussam).
* SYNTAXE D'ANALYSE N05 : REPRISE CORRIGÉE ET FILTRÉE DES ANALYSES DE LA
* SORTIE RESULTAT_BRUT_N_04 (base d'analyse : 427 fiches retenues).
* Version du 11/10/2026 - compatible IBM SPSS Statistics 27.
* =========================================================================.
*.
* MODE D'EMPLOI (3 gestes).
* 1. Ouvrir dans SPSS le fichier SPSS_EDM_EE_V4.sav que vous avez enregistré
*    (Fichier > Ouvrir > Données). Il doit être la seule base ouverte ou la
*    base active (fenêtre de données au premier plan).
* 2. Ouvrir cette syntaxe, puis menu Exécuter > Tout.
* 3. Lire la fenêtre de résultats dans l'ordre des parties (titres A à N).
*.
* Cette syntaxe ne contient volontairement AUCUNE commande CD, GET FILE ou
* SAVE : elle travaille sur la base active. Elle ne peut donc plus échouer
* sur un chemin de dossier, et elle ne modifie aucun fichier sur le disque.
* Les variables qu'elle crée (SEG_TS, MARQ_AC, MEME_CANAL...) restent dans
* la base active : pour les garder, faire Fichier > Enregistrer sous.
*.
* CORRECTIONS APPORTÉES PAR RAPPORT À LA SORTIE N_04.
* C1. FILTRE : toutes les analyses portent sur les 427 fiches retenues
*     (FILTER BY FILTRE_QUAL), et non plus sur les 446 fiches collectées.
*     Seuls les contrôles de qualité (partie B) restent sur les 446 fiches.
* C2. POURCENTAGES : les tableaux croisés donnent le % EN COLONNE (% dans la
*     ville, le profil, le maillon) au lieu du % du total, plus les résidus
*     standardisés ajustés (|résidu| > 1,96 = case qui s'écarte nettement).
* C3. STATISTIQUES : les quartiles, moyennes et écarts-types demandés sur des
*     variables NOMINALES (ville, profil, lieu d'achat...) n'ont pas de sens
*     et sont supprimés ; les statistiques sont gardées pour les variables
*     d'échelle (taux de remplissage, surcoût et garantie en points milieux).
* C4. DOUBLONS : les commandes répétées dans N_04 (profil exécuté 3 fois,
*     bloc gamme/prix exécuté 2 fois) ne sont exécutées qu'une fois.
* C5. TEST NON PARAMÉTRIQUE : NPTESTS testait 12 attitudes "par groupe de
*     surcoût" (montage inversé). Remplacé par : (a) corrélations de Spearman
*     entre le surcoût accepté et ces 12 attitudes ; (b) tests de
*     Kruskal-Wallis du surcoût et de la garantie selon ville, profil,
*     maillon et gamme (lisibles hors visionneuse de modèles).
* C6. RÉGRESSION LOGISTIQUE : ville, maillon et âge sont déclarés CATÉGORIELS
*     (/CATEGORICAL, modalité de référence = 1re modalité). Seuil de
*     classement ramené à 0,20 (part réelle des "Oui" fermes) ; ajout du test
*     de Hosmer-Lemeshow et des intervalles de confiance des odds ratios.
* C7. TYPOLOGIE TWOSTEP : tri préalable par ID_CASE (le résultat de TwoStep
*     dépend de l'ordre des fiches) ; essai automatique du nombre de groupes
*     (critère BIC) AVANT le modèle à 4 groupes ; enregistrement du groupe
*     (SEG_TS) et profils des groupes en tableaux croisés lisibles.
* C8. CORRESPONDANCES : PROFIL4 était limité à (1 3) et excluait les
*     revendeurs ; corrigé en (1 4). Les petites marques (moins de 20
*     acheteurs) sont regroupées (MARQ_AC) pour ne pas déformer la carte.
* C9. LIEU ACTUEL x CANAL PRÉFÉRÉ : le test de McNemar (prévu pour 2 x 2)
*     est remplacé par l'indicateur MEME_CANAL (le canal préféré est-il le
*     canal actuel ?), croisé par ville, profil et maillon.
*.
* PRÉCAUTION DE LECTURE (à reporter dans le rapport) : l'échantillon est par
* quotas, non probabiliste. Les tests (khi-deux, Kruskal-Wallis, Spearman,
* régression) supposent un tirage aléatoire : ce sont des repères pour
* hiérarchiser les écarts, pas des preuves. Un khi-deux dont plus de 20 % des
* cases ont un effectif théorique < 5 (note "a." sous le tableau) n'est pas
* fiable : citer l'écart comme "descriptif".
* =========================================================================.

* -------------------------------------------------------------------------.
* PARTIE A - PRÉPARATION (variables dérivées recréées à l'identique de N_04).
* -------------------------------------------------------------------------.
TITLE "A. Préparation des variables dérivées".
DATASET NAME EDM_N05 WINDOW=FRONT.
FILTER OFF.
USE ALL.
SORT CASES BY ID_CASE (A).

* A.1 Indicateurs 0/1 utilisés dans N_04 (mêmes définitions que la syntaxe V4).
RECODE PRETACLI (1=1) (2,3=0) (ELSE=SYSMIS) INTO ONLIN_FERME.
RECODE IMSECSAV (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO SAV_TRESIMP.
RECODE MONMOYAC (3,4,5=1) (1,2=0) (ELSE=SYSMIS) INTO MONT_100K.
RECODE DEJDECAC (1,2=1) (3=0) (ELSE=SYSMIS) INTO DECU.
RECODE PRCRICHO (2=1) (1,3,4,5,6=0) (ELSE=SYSMIS) INTO CRIT_QUAL.
RECODE LIEACHPR (1=1) (2=2) (3=3) (4=4) (5=5) (6=6) (ELSE=SYSMIS) INTO LIEU_ACT.
VARIABLE LABELS ONLIN_FERME "Intention FERME d'achat en ligne (Oui)"
  /SAV_TRESIMP "SAV jugé TRÈS important"
  /MONT_100K "Achat moyen de 100 000 FCFA ou plus"
  /DECU "A déjà été déçu par un achat"
  /CRIT_QUAL "Critère n°1 = qualité / durabilité"
  /LIEU_ACT "Lieu d'achat ACTUEL (Q7)".
VALUE LABELS ONLIN_FERME SAV_TRESIMP MONT_100K DECU CRIT_QUAL 0 "Non" 1 "Oui".
VALUE LABELS LIEU_ACT 1 "Quincaillerie" 2 "Grossiste spécialisé"
  3 "Magasin spécialisé" 4 "Marché" 5 "Importateur" 6 "En ligne".

* A.2 Variables d'échelle en points milieux de tranches (HYPOTHÈSES : écrire
* dans le rapport "estimation indicative à partir des tranches").
RECODE SUACMOGA (1=0) (2=5) (3=17.5) (4=37.5) (5=60) (ELSE=SYSMIS) INTO SURCOUT_PCT.
RECODE DUGAJUAC (1=3) (2=9) (3=18) (4=30) (ELSE=SYSMIS) INTO GARANTIE_MOIS.
VARIABLE LABELS SURCOUT_PCT "Surcoût accepté pour monter en gamme (%, point milieu)"
  /GARANTIE_MOIS "Durée de garantie attendue (mois, point milieu)".
FORMATS SURCOUT_PCT (F5.1) GARANTIE_MOIS (F4.0).

* A.3 Nouveaux indicateurs (corrections C8 et C9).
* MARQ_AC : marques regroupées pour l'analyse des correspondances.
RECODE MARQUE_G (1=1) (2=2) (3=3) (5=4) (4,6,7,8,10=5) (9=6) (ELSE=SYSMIS) INTO MARQ_AC.
VARIABLE LABELS MARQ_AC "Marque achetée le plus souvent (regroupée pour l'AFC)".
VALUE LABELS MARQ_AC 1 "Schneider" 2 "Legrand" 3 "Chint / chinoise" 4 "Yaki"
  5 "Autres marques" 6 "Pas de marque fixe".
* MEME_CANAL : le canal souhaité (Q35) est-il le lieu d'achat actuel (Q7).
COMPUTE MEME_CANAL = $SYSMIS.
IF (NOT MISSING(LIEACHPR) AND NOT MISSING(CANAPREF)) MEME_CANAL = (LIEACHPR = CANAPREF).
VARIABLE LABELS MEME_CANAL "Canal préféré = canal d'achat actuel".
VALUE LABELS MEME_CANAL 0 "Non : souhaite changer de canal" 1 "Oui : même canal".

VARIABLE LEVEL ONLIN_FERME SAV_TRESIMP MONT_100K DECU CRIT_QUAL LIEU_ACT MARQ_AC
  MEME_CANAL (NOMINAL) /SURCOUT_PCT GARANTIE_MOIS (SCALE).
EXECUTE.

* -------------------------------------------------------------------------.
* PARTIE B - CONTRÔLE DE LA BASE (sur les 446 fiches, AVANT filtre).
* -------------------------------------------------------------------------.
TITLE "B. Contrôle de la base (446 fiches collectées)".
FREQUENCIES VARIABLES=FILTRE_QUAL DOUBLON_SUSP BLOC_WEB_VIDE
  /ORDER=ANALYSIS.
* Repère : FILTRE_QUAL Retenue = 427, Écartée = 19 ; DOUBLON_SUSP : 8 copies.
* Si ces chiffres diffèrent ou si FILTRE_QUAL est inconnue : la base active
* n'est pas SPSS_EDM_EE_V4.sav. Arrêter et ouvrir le bon fichier.
FREQUENCIES VARIABLES=TX_REMPL
  /FORMAT=NOTABLE
  /STATISTICS=MEAN MEDIAN STDDEV MINIMUM MAXIMUM
  /HISTOGRAM.

* =========================================================================.
* FILTRE D'ANALYSE : À PARTIR D'ICI, 427 FICHES RETENUES.
* =========================================================================.
FILTER BY FILTRE_QUAL.
EXECUTE.

* -------------------------------------------------------------------------.
* PARTIE C - PROFIL DES RÉPONDANTS (base 427).
* -------------------------------------------------------------------------.
TITLE "C. Profil des répondants (427 fiches retenues)".
FREQUENCIES VARIABLES=VOUSETES PROFIL4 CATEG3 SEXMAFEM AGEREPON AGE3 VILLEREG REVMEN_P
  /BARCHART PERCENT
  /ORDER=ANALYSIS.
* Repère : VILLEREG Douala 163, Yaoundé 162, Bafoussam 102 (total 427).
CROSSTABS
  /TABLES=VOUSETES BY VILLEREG
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN.

* -------------------------------------------------------------------------.
* PARTIE D - HABITUDES D'ACHAT.
* -------------------------------------------------------------------------.
TITLE "D. Habitudes d'achat".
FREQUENCIES VARIABLES=FREQACHA LIEACHPR MONMOYAC PAIEPRIV PRACCABL PRACAPPA
    PRACPRIS PRACLUMI PRACSOLA PRACGROU
  /BARCHART PERCENT
  /ORDER=ANALYSIS.
CROSSTABS
  /TABLES=FREQACHA LIEACHPR PAIEPRIV BY VILLEREG
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.

* -------------------------------------------------------------------------.
* PARTIE E - MARQUES.
* -------------------------------------------------------------------------.
TITLE "E. Marques achetées".
FREQUENCIES VARIABLES=IMPOMARQ CRIT_QUAL MARQUE_G ORIG_MARQ
  /BARCHART PERCENT
  /ORDER=ANALYSIS.
* Repère : MARQUE_G valides = 355 ; Schneider 31,5 % ; Yaki 18,6 %.
CROSSTABS
  /TABLES=MARQUE_G ORIG_MARQ BY VILLEREG CATEG3 PROFIL4
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.
* Version robuste (petites marques regroupées : moins de cases vides,
* khi-deux plus fiable). À citer de préférence dans le rapport.
CROSSTABS
  /TABLES=MARQ_AC BY VILLEREG CATEG3 PROFIL4
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.

* -------------------------------------------------------------------------.
* PARTIE F - ORIGINE DES PRODUITS.
* -------------------------------------------------------------------------.
TITLE "F. Origine des produits".
FREQUENCIES VARIABLES=ORIGPRIV ORIG_MARQ MEQUAFIA MEILPRIX MEQUA_AV MEILP_AV
    ORINFACH ORASHAGA ORASBAGA ORHG_AV ORBG_AV
  /BARCHART PERCENT
  /ORDER=ANALYSIS.
* Rappel : 98 = "Sans avis" est une réponse (comptée) dans Q15, Q16, Q21, Q22 ;
* les variables *_AV donnent la même question parmi les seuls avis exprimés.
CROSSTABS
  /TABLES=ORIGPRIV MEQUAFIA MEILPRIX ORINFACH BY VILLEREG CATEG3 PROFIL4
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.

* -------------------------------------------------------------------------.
* PARTIE G - GAMMES, PRIX ET PRIORITÉ D'ACHAT.
* -------------------------------------------------------------------------.
TITLE "G. Gammes, prix attendus et priorité d'achat".
FREQUENCIES VARIABLES=GAACPLSO DEAVHAGA CAAVBAGA PXHAUTGA PXMOYEGA PXBASGAM
    ECQUHABA PRIOPRIN SUACMOGA
  /BARCHART PERCENT
  /ORDER=ANALYSIS.
CROSSTABS
  /TABLES=GAACPLSO PRIOPRIN SUACMOGA PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA
    BY VILLEREG CATEG3 PROFIL4
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.

* -------------------------------------------------------------------------.
* PARTIE H - SURCOÛT ACCEPTÉ (moyennes, médianes et tests corrigés).
* -------------------------------------------------------------------------.
TITLE "H. Surcoût accepté pour monter en gamme".
MEANS TABLES=SURCOUT_PCT BY CATEG3 PROFIL4 VILLEREG GAACPLSO
  /CELLS=MEAN COUNT STDDEV MEDIAN.
* Repère : surcoût moyen +7,6 % ; médiane +5 % ; Yaoundé +11,0 %.
* H.1 Le surcoût diffère-t-il selon le groupe ? (Kruskal-Wallis).
NPAR TESTS
  /K-W=SUACMOGA BY VILLEREG(1 3)
  /K-W=SUACMOGA BY PROFIL4(1 4)
  /K-W=SUACMOGA BY CATEG3(1 3)
  /K-W=SUACMOGA BY GAACPLSO(1 4)
  /MISSING ANALYSIS.
* H.2 Avec quelles attitudes le surcoût accepté varie-t-il ? (Spearman).
* Lecture du signe : les codes vont de 1 = "très / souvent / oui" à 4 ou 5 =
* "pas du tout / jamais / non" pour les attitudes, et de 1 = aucun surcoût à
* 5 = plus de +50 % pour SUACMOGA. Un coefficient NÉGATIF signifie donc :
* plus l'attitude est forte, plus le surcoût accepté est élevé.
NONPAR CORR
  /VARIABLES=SUACMOGA WITH IMPOMARQ ORINFACH PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA
    CRACPRCO IMSECSAV DUGAJUAC BOSAPACH PRETACLI FIMEFOUR
  /PRINT=SPEARMAN TWOTAIL NOSIG
  /MISSING=PAIRWISE.

* -------------------------------------------------------------------------.
* PARTIE I - FREINS, CONTREFAÇON ET DÉCEPTIONS.
* -------------------------------------------------------------------------.
TITLE "I. Freins, contrefaçon et déceptions".
FREQUENCIES VARIABLES=PRINFREI CRACPRCO DEJDECAC
  /BARCHART PERCENT
  /ORDER=ANALYSIS.
CROSSTABS
  /TABLES=PRINFREI CRACPRCO DEJDECAC BY VILLEREG CATEG3 PROFIL4 GAACPLSO ORIG_MARQ
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.

* -------------------------------------------------------------------------.
* PARTIE J - SERVICE CLIENT, SAV ET GARANTIE.
* -------------------------------------------------------------------------.
TITLE "J. Service client, SAV et garantie".
FREQUENCIES VARIABLES=IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH
  /BARCHART PERCENT
  /ORDER=ANALYSIS.
CROSSTABS
  /TABLES=IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH BY VILLEREG CATEG3 PROFIL4
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.
MEANS TABLES=GARANTIE_MOIS BY CATEG3 PROFIL4 VILLEREG
  /CELLS=MEAN COUNT MEDIAN.
* Repère (427 fiches) : garantie de moins de 6 mois = 74,3 % à Bafoussam ;
* 6 mois à 1 an = 67,3 % à Yaoundé ; à Douala, 32,0 % veulent plus d'un an.
NPAR TESTS
  /K-W=DUGAJUAC BY VILLEREG(1 3)
  /K-W=DUGAJUAC BY PROFIL4(1 4)
  /K-W=IMSECSAV BY VILLEREG(1 3)
  /MISSING ANALYSIS.
* POINT DE CONTRÔLE DOUALA : environ 20 % des fiches de Douala jugent le SAV
* "pas important" (contre 1 % à Yaoundé). Si l'identifiant enquêteur est
* disponible dans le Google Sheet, croiser IMSECSAV et DUGAJUAC par enquêteur
* avant d'utiliser ces résultats (risque d'effet enquêteur).

* -------------------------------------------------------------------------.
* PARTIE K - CANAUX D'ACHAT ET ACHAT EN LIGNE.
* -------------------------------------------------------------------------.
TITLE "K. Canaux d'achat et achat en ligne".
FREQUENCIES VARIABLES=CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI
  /BARCHART PERCENT
  /ORDER=ANALYSIS.
CROSSTABS
  /TABLES=CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI BY VILLEREG CATEG3 PROFIL4
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.
* K.1 Lieu actuel x canal préféré : % en ligne = part qui garde son canal.
CROSSTABS
  /TABLES=LIEU_ACT BY CANAPREF
  /FORMAT=AVALUE TABLES
  /CELLS=COUNT ROW.
FREQUENCIES VARIABLES=MEME_CANAL.
* Repère : environ 84 % gardent le même canal.
CROSSTABS
  /TABLES=MEME_CANAL BY VILLEREG CATEG3 PROFIL4
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN.

* -------------------------------------------------------------------------.
* PARTIE L - FIDÉLITÉ.
* -------------------------------------------------------------------------.
TITLE "L. Fidélité au fournisseur et levier principal".
FREQUENCIES VARIABLES=FIMEFOUR LEVFIDEL
  /BARCHART PERCENT
  /ORDER=ANALYSIS.
CROSSTABS
  /TABLES=FIMEFOUR LEVFIDEL BY VILLEREG PROFIL4 CATEG3
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.
* LEVFIDEL a 7 modalités : beaucoup de cases à effectif théorique < 5.
* Citer les écarts par ville ou profil comme "descriptifs".

* -------------------------------------------------------------------------.
* PARTIE M - RÉGRESSION LOGISTIQUE : INTENTION FERME D'ACHAT EN LIGNE.
* -------------------------------------------------------------------------.
TITLE "M. Intention ferme d'achat en ligne (logistique)".
* Référence des variables catégorielles = 1re modalité :
* VILLEREG = Douala ; CATEG3 = Utilisateurs finaux ; AGE3 = moins de 35 ans.
* Lire Exp(B) : > 1 = plus de chances d'intention ferme que la référence.
LOGISTIC REGRESSION VARIABLES ONLIN_FERME
  /METHOD=ENTER VILLEREG CATEG3 AGE3 SAV_TRESIMP MONT_100K DECU
  /CATEGORICAL=VILLEREG CATEG3 AGE3
  /CONTRAST (VILLEREG)=INDICATOR(1)
  /CONTRAST (CATEG3)=INDICATOR(1)
  /CONTRAST (AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=ITERATE(20) CUT(0.20).
* Lecture : le R-deux de Nagelkerke indique la part expliquée (faible si
* < 0,20) ; Hosmer-Lemeshow non significatif (p > 0,05) = ajustement correct.

* -------------------------------------------------------------------------.
* PARTIE N - TYPOLOGIE DES ACHETEURS (TWOSTEP) ET CARTES (CORRESPONDANCES).
* -------------------------------------------------------------------------.
TITLE "N1. Typologie TwoStep : nombre de groupes suggéré (BIC)".
* N.1 Essai automatique : SPSS propose le nombre de groupes (tableau
* "Regroupement automatique", plus fort ratio des variations de BIC).
TWOSTEP CLUSTER
  /CATEGORICAL VARIABLES=FREQACHA PRCRICHO GAACPLSO IMPOMARQ IMSECSAV FIMEFOUR
    PRIOPRIN CRACPRCO
  /DISTANCE LIKELIHOOD
  /NUMCLUSTERS AUTO 8 BIC
  /HANDLENOISE 0
  /MEMALLOCATE 64
  /CRITERIA INITHRESHOLD(0) MXBRANCH(8) MXLEVEL(3)
  /VIEWMODEL DISPLAY=NO
  /PRINT IC COUNT SUMMARY.

TITLE "N2. Typologie TwoStep à 4 groupes (enregistrée)".
* Suppression sans erreur d'un éventuel SEG_TS d'une exécution précédente.
COMPUTE SEG_TS = 0.
EXECUTE.
DELETE VARIABLES SEG_TS.
TWOSTEP CLUSTER
  /CATEGORICAL VARIABLES=FREQACHA PRCRICHO GAACPLSO IMPOMARQ IMSECSAV FIMEFOUR
    PRIOPRIN CRACPRCO
  /DISTANCE LIKELIHOOD
  /NUMCLUSTERS FIXED=4
  /HANDLENOISE 0
  /MEMALLOCATE 64
  /CRITERIA INITHRESHOLD(0) MXBRANCH(8) MXLEVEL(3)
  /VIEWMODEL DISPLAY=YES
  /PRINT IC COUNT SUMMARY
  /SAVE VARIABLE=SEG_TS.
VARIABLE LABELS SEG_TS "Groupe d'acheteurs (TwoStep, 4 groupes)".
VARIABLE LEVEL SEG_TS (NOMINAL).
* Dans la visionneuse de modèles (double-clic sur le résultat), noter la
* "mesure de silhouette de cohésion et de séparation" : < 0,2 = typologie
* faible, 0,2 à 0,5 = moyenne, > 0,5 = bonne. À reporter dans le rapport.

TITLE "N3. Profil des 4 groupes (% dans chaque groupe)".
* Lecture : chaque colonne = un groupe ; les résidus > 1,96 en valeur
* absolue montrent ce qui caractérise le groupe. Donner ensuite un nom à
* chaque groupe à partir de ces caractéristiques.
FREQUENCIES VARIABLES=SEG_TS.
CROSSTABS
  /TABLES=FREQACHA PRCRICHO GAACPLSO IMPOMARQ IMSECSAV FIMEFOUR PRIOPRIN CRACPRCO
    VILLEREG PROFIL4 CATEG3 MARQ_AC DEJDECAC BOSAPACH BY SEG_TS
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.
MEANS TABLES=SURCOUT_PCT GARANTIE_MOIS BY SEG_TS
  /CELLS=MEAN COUNT MEDIAN.

TITLE "N4. Carte des marques par ville (AFC)".
CORRESPONDENCE TABLE=MARQ_AC(1 6) BY VILLEREG(1 3)
  /DIMENSIONS=2
  /MEASURE=CHISQ
  /STANDARDIZE=RCMEAN
  /NORMALIZATION=SYMMETRICAL
  /PRINT=TABLE RPROFILES CPROFILES RPOINTS CPOINTS
  /PLOT=NDIM(1,MAX) BIPLOT(20).

TITLE "N5. Carte des marques par profil (AFC)".
CORRESPONDENCE TABLE=MARQ_AC(1 6) BY PROFIL4(1 4)
  /DIMENSIONS=2
  /MEASURE=CHISQ
  /STANDARDIZE=RCMEAN
  /NORMALIZATION=SYMMETRICAL
  /PRINT=TABLE RPROFILES CPROFILES RPOINTS CPOINTS
  /PLOT=NDIM(1,MAX) BIPLOT(20).
* Lecture : le tableau "Récapitulatif" donne l'inertie expliquée par chaque
* dimension ; une marque proche d'une ville (ou d'un profil) sur la carte y
* est sur-représentée.

* =========================================================================.
* FIN : retrait du filtre (la base active retrouve ses 446 fiches).
* =========================================================================.
FILTER OFF.
USE ALL.
EXECUTE.
TITLE "Fin de la syntaxe N05".
