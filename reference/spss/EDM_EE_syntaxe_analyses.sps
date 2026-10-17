* Encoding: UTF-8.
* ======================================================================.
* ETUDE DE MARCHE - MATERIEL ET EQUIPEMENTS ELECTRIQUES (CAMEROUN).
* Syntaxe adaptee au fichier SPSS_EDM_EE.sav (446 repondants, 56 variables).
* Noms de variables du masque de depouillement (VOUSETES, VILLEREG, etc.).
* Placer le .sav et ce .sps dans le meme dossier, ou adapter le chemin ci-dessous.
* Blocs : A controle / B tris a plat / C reponses multiples / D croisements /
*         E tests / F indicateurs / G segmentation / H-I regressions / J controles.
* Reperes : 99 = NR, 98 = question non applicable (filtre).
* ======================================================================.

GET FILE='SPSS_EDM_EE.sav'.
DATASET NAME EDM_EE WINDOW=FRONT.

* ---------------------------------------------------------------------.
* A. CONTROLE DES DONNEES ET DECLARATION DES NON-REPONSES.
* ---------------------------------------------------------------------.
* NR (99) et non applicable (98) declares valeurs manquantes utilisateur.
* MAACAUTR est une chaine : exclue des plages numeriques.
MISSING VALUES ACCRECON TO MAACPLSO (98, 99).
MISSING VALUES PRCRICHO TO RFIDPAIE (98, 99).

ADD VALUE LABELS REVMENME MEQUAFIA MEILPRIX ORASHAGA ORASBAGA 98 'Non applicable (filtre)'.

* REVMENME : le code 5 (6 cas) n'a pas de libelle : exclu en attendant verification du masque.
RECODE REVMENME (5=SYSMIS) (ELSE=COPY) INTO REVMEN_R.
VARIABLE LABELS REVMEN_R 'Revenu mensuel menage (code 5 non libelle exclu)'.
VALUE LABELS REVMEN_R 1 '<100k' 2 '100k-250k' 3 '250k-500k' 4 '500k-1M'.
MISSING VALUES REVMEN_R (98, 99).

* ATTENTION : MAACAUTR est en A8 : les mentions longues sont tronquees.
* Verifier la largeur de la variable a l'import et la porter a A100 avant recodage.

FREQUENCIES VARIABLES=VILLEREG VOUSETES SEXMAFEM AGEREPON /FORMAT=NOTABLE.
DESCRIPTIVES VARIABLES=ACCRECON TO RFIDPAIE /STATISTICS=MEAN STDDEV MIN MAX.

* Controle de coherence des filtres en ligne.
CROSSTABS /TABLES=DEJACHLI BY PRETACLI /CELLS=COUNT.

* ---------------------------------------------------------------------.
* VARIABLES DERIVEES (utilisees dans les blocs suivants).
* ---------------------------------------------------------------------.
RECODE VOUSETES (1=1) (2,4=2) (3=3) (5=4) (ELSE=SYSMIS) INTO PROFIL4.
VARIABLE LABELS PROFIL4 'Profil regroupe'.
VALUE LABELS PROFIL4 1 'Particulier' 2 'Entreprise (PME/BTP)' 3 'Electricien/artisan' 4 'Revendeur/Grossiste'.

RECODE AGEREPON (1,2=1) (3=2) (4,5=3) (ELSE=SYSMIS) INTO AGE3.
VARIABLE LABELS AGE3 'Age regroupe'.
VALUE LABELS AGE3 1 '<35 ans' 2 '35-44 ans' 3 '45 ans et +'.

RECODE PRETACLI (1=1) (2,3=0) (ELSE=SYSMIS) INTO ONLIN_FERME.
RECODE PRETACLI (1,2=1) (3=0) (ELSE=SYSMIS) INTO ONLIN_POT.
RECODE BOSAPACH (1=1) (2,3=0) (ELSE=SYSMIS) INTO SAV_OUI.
RECODE BOSAPACH (1,2=1) (3=0) (ELSE=SYSMIS) INTO SAV_POT.
RECODE IMSECSAV (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO SAV_TRESIMP.
RECODE IMPOMARQ (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO MARQ_TRESIMP.
RECODE MONMOYAC (3,4,5=1) (1,2=0) (ELSE=SYSMIS) INTO MONT_100K.
RECODE FREQACHA (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO HEBDO.
RECODE DEJDECAC (1,2=1) (3=0) (ELSE=SYSMIS) INTO DECU.
RECODE GAACPLSO (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO HAUTGAMME.
RECODE FIMEFOUR (1,2=1) (3,4,5=0) (ELSE=SYSMIS) INTO FIDELE.
RECODE DEJACHLI (1=1) (2=0) (ELSE=SYSMIS) INTO DEJA_LIGNE.
VARIABLE LABELS ONLIN_FERME 'Intention ferme achat en ligne (Oui)'
  /ONLIN_POT 'Intention potentielle achat en ligne (Oui + Peut-etre)'
  /SAV_OUI 'Paierait plus pour bon SAV (Oui)'
  /SAV_POT 'Paierait plus pour bon SAV (Oui + Peut-etre)'
  /SAV_TRESIMP 'SAV tres important'
  /MARQ_TRESIMP 'Marque tres importante'
  /MONT_100K 'Achat moyen >= 100k FCFA'
  /HEBDO 'Achat chaque semaine'
  /DECU 'Deja decu par un achat'
  /HAUTGAMME 'Achete surtout du haut de gamme'
  /FIDELE 'Fidele (toujours/souvent) au meme fournisseur'
  /DEJA_LIGNE 'A deja achete en ligne'.
VALUE LABELS ONLIN_FERME ONLIN_POT SAV_OUI SAV_POT SAV_TRESIMP MARQ_TRESIMP MONT_100K HEBDO DECU HAUTGAMME FIDELE DEJA_LIGNE 0 'Non' 1 'Oui'.

* Marque regroupee : Yaki isolee depuis le texte libre (code 12 = Autres).
COMPUTE YAKI = 0.
IF (MAACPLSO = 12 AND (INDEX(UPCASE(MAACAUTR),'YAK') > 0 OR INDEX(UPCASE(MAACAUTR),'YAQ') > 0)) YAKI = 1.
RECODE MAACPLSO (1=1) (2=2) (7=3) (8=4) (3,4,5,6,11=5) (12=6) (ELSE=SYSMIS) INTO MARQUE_G.
IF (YAKI = 1) MARQUE_G = 7.
VARIABLE LABELS MARQUE_G 'Marque achetee le plus souvent (regroupee)'.
VALUE LABELS MARQUE_G 1 'Schneider' 2 'Legrand' 3 'Chint/chinoise' 4 'Philips' 5 'Autres internationales' 6 'Autres (hors Yaki)' 7 'Yaki'.
EXECUTE.

* ---------------------------------------------------------------------.
* B. TRIS A PLAT.
* ---------------------------------------------------------------------.
FREQUENCIES VARIABLES=VOUSETES SEXMAFEM AGEREPON VILLEREG REVMEN_R FREQACHA LIEACHPR MONMOYAC
  PAIEPRIV IMPOMARQ MARQUE_G PRCRICHO ORIGPRIV ORINFACH GAACPLSO DEAVHAGA CAAVBAGA
  PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC
  IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI FIMEFOUR
  /ORDER=ANALYSIS.

* ---------------------------------------------------------------------.
* C. REPONSES MULTIPLES.
* ---------------------------------------------------------------------.
MULT RESPONSE GROUPS=$PRODUITS 'Produits achetes' (PRACCABL TO PRACGROU (1))
  /FREQUENCIES=$PRODUITS.

MULT RESPONSE GROUPS=$FIDELITE 'Leviers de fidelite' (RFIDPRIX TO RFIDPAIE (1))
  /FREQUENCIES=$FIDELITE.

* Produits par profil et par ville.
MULT RESPONSE GROUPS=$PRODUITS 'Produits achetes' (PRACCABL TO PRACGROU (1))
  /VARIABLES=PROFIL4 (1,4) VILLEREG (1,3)
  /TABLES=$PRODUITS BY PROFIL4 VILLEREG
  /CELLS=COLUMN.

* ---------------------------------------------------------------------.
* D. TABLEAUX CROISES (pourcentages en colonnes).
* ---------------------------------------------------------------------.
CROSSTABS /TABLES=PRETACLI BOSAPACH MARQUE_G PRCRICHO GAACPLSO FIMEFOUR PRINFREI BY VILLEREG PROFIL4
  /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

CROSSTABS /TABLES=PRETACLI BOSAPACH BY AGE3 MONMOYAC DEJACHLI IMSECSAV
  /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

* ---------------------------------------------------------------------.
* E. TESTS D'ASSOCIATION (khi-deux, Phi / V de Cramer, Spearman).
* Verifier la note SPSS sur les cellules a effectif attendu < 5.
* ---------------------------------------------------------------------.
CROSSTABS /TABLES=PRETACLI BOSAPACH GAACPLSO PRCRICHO FIMEFOUR CANAPREF BY VILLEREG PROFIL4 AGE3
  /FORMAT=AVALUE TABLES /STATISTICS=CHISQ PHI /CELLS=COUNT EXPECTED.

NONPAR CORR
  /VARIABLES=PRETACLI BOSAPACH WITH AGEREPON REVMEN_R FREQACHA MONMOYAC IMPOMARQ IMSECSAV SUACMOGA DUGAJUAC ECQUHABA CRACPRCO DEJDECAC FIMEFOUR
  /PRINT=SPEARMAN TWOTAIL NOSIG
  /MISSING=PAIRWISE.
* Attention : PRETACLI et BOSAPACH sont codes 1=Oui, 2=Peut-etre, 3=Non ;
* un rho positif signifie donc "moins favorable" quand l'autre variable augmente.

* ---------------------------------------------------------------------.
* F. INDICATEURS COMMERCIAUX : intention ferme vs potentielle.
* ---------------------------------------------------------------------.
FREQUENCIES VARIABLES=ONLIN_FERME ONLIN_POT SAV_OUI SAV_POT DEJA_LIGNE.
MEANS TABLES=ONLIN_FERME ONLIN_POT SAV_OUI SAV_POT BY VILLEREG PROFIL4 AGE3
  /CELLS=MEAN COUNT.

* ---------------------------------------------------------------------.
* G. SEGMENTATION EXPLORATOIRE (TwoStep, variables categorielles).
* Structure faible dans nos essais (silhouette ~0,09) : lecture prudente.
* Les segments TwoStep ne coincideront pas exactement avec ceux du classeur Excel (K-means).
* ---------------------------------------------------------------------.
TWOSTEP CLUSTER
  /CATEGORICAL VARIABLES=FREQACHA PRCRICHO GAACPLSO IMPOMARQ IMSECSAV FIMEFOUR PRIOPRIN CRACPRCO
  /DISTANCE LIKELIHOOD
  /NUMCLUSTERS FIXED=4
  /HANDLENOISE 0
  /MEMALLOCATE 64
  /CRITERIA INITHRESHOLD(0) MXBRANCH(8) MXLEVEL(3)
  /PRINT IC COUNT SUMMARY
  /SAVE VARIABLE=SEGMENT.

CROSSTABS /TABLES=SEGMENT BY VILLEREG PROFIL4 PRETACLI BOSAPACH GAACPLSO PRCRICHO
  /FORMAT=AVALUE TABLES /CELLS=COUNT ROW.

* Analyse factorielle des correspondances : marques x villes.
CORRESPONDENCE TABLE=MARQUE_G(1,7) BY VILLEREG(1,3)
  /DIMENSIONS=2
  /MEASURE=CHISQ
  /NORMALIZATION=SYMMETRICAL
  /PRINT=TABLE RPOINTS CPOINTS
  /PLOT=NDIM(1,MAX) BIPLOT(20).

* ---------------------------------------------------------------------.
* H. REGRESSION LOGISTIQUE : INTENTION D'ACHAT EN LIGNE.
* ---------------------------------------------------------------------.
* H1. Intention ferme, sans l'antecedent d'achat en ligne.
LOGISTIC REGRESSION VARIABLES ONLIN_FERME
  /METHOD=ENTER VILLEREG PROFIL4 AGE3 SAV_TRESIMP MONT_100K HEBDO MARQ_TRESIMP DECU
  /CATEGORICAL=VILLEREG PROFIL4 AGE3
  /CONTRAST(VILLEREG)=INDICATOR(1)
  /CONTRAST(PROFIL4)=INDICATOR(1)
  /CONTRAST(AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).

* H2. Meme modele avec l'antecedent d'achat en ligne.
LOGISTIC REGRESSION VARIABLES ONLIN_FERME
  /METHOD=ENTER VILLEREG PROFIL4 AGE3 SAV_TRESIMP MONT_100K HEBDO DEJA_LIGNE
  /CATEGORICAL=VILLEREG PROFIL4 AGE3
  /CONTRAST(VILLEREG)=INDICATOR(1)
  /CONTRAST(PROFIL4)=INDICATOR(1)
  /CONTRAST(AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).

* H3. Intention potentielle (Oui + Peut-etre).
LOGISTIC REGRESSION VARIABLES ONLIN_POT
  /METHOD=ENTER VILLEREG PROFIL4 AGE3 SAV_TRESIMP MONT_100K HEBDO MARQ_TRESIMP DECU
  /CATEGORICAL=VILLEREG PROFIL4 AGE3
  /CONTRAST(VILLEREG)=INDICATOR(1)
  /CONTRAST(PROFIL4)=INDICATOR(1)
  /CONTRAST(AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).

* ---------------------------------------------------------------------.
* I. DISPOSITION A PAYER PLUS POUR UN BON SAV.
* ---------------------------------------------------------------------.
LOGISTIC REGRESSION VARIABLES SAV_OUI
  /METHOD=ENTER VILLEREG PROFIL4 AGE3 SAV_TRESIMP MARQ_TRESIMP HAUTGAMME DECU FIDELE MONT_100K
  /CATEGORICAL=VILLEREG PROFIL4 AGE3
  /CONTRAST(VILLEREG)=INDICATOR(1)
  /CONTRAST(PROFIL4)=INDICATOR(1)
  /CONTRAST(AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).

LOGISTIC REGRESSION VARIABLES SAV_POT
  /METHOD=ENTER VILLEREG PROFIL4 AGE3 SAV_TRESIMP MARQ_TRESIMP HAUTGAMME DECU FIDELE MONT_100K
  /CATEGORICAL=VILLEREG PROFIL4 AGE3
  /CONTRAST(VILLEREG)=INDICATOR(1)
  /CONTRAST(PROFIL4)=INDICATOR(1)
  /CONTRAST(AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).

* ---------------------------------------------------------------------.
* J. CONTROLES FINAUX.
* ---------------------------------------------------------------------.
FREQUENCIES VARIABLES=PROFIL4 AGE3 ONLIN_FERME ONLIN_POT SAV_OUI SAV_POT MARQUE_G SEGMENT.
* Effectif attendu : 446 observations ; verifier les N valides de chaque modele (SPSS exclut les NR par listwise).
* Exporter les tableaux utiles : Fichier > Exporter (Excel / Word / PDF).
