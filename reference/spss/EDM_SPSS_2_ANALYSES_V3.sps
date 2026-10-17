* Encoding: UTF-8.
* ==========================================================================.
* EDM ÉLECTRIQUE CAMEROUN — THE PLUG.
* SCRIPT 2 / 2 (V3) : PLAN D'ANALYSES A01 à A24 (même plan que l'onglet PLAN_ANALYSES du Sheet).
* À lancer APRÈS le script 1 (qui crée EDM_ELECTRIQUE_CAMEROUN.sav).
* Lancement : menu Exécuter > Tout. Résultats : fenêtre de résultats + fichier Excel
* C:\ETUDE_EDM\RESULTATS_EDM_ELECTRIQUE.xlsx.
*
* Organisation (selon votre licence SPSS) :
*   PARTIE A : module de base (présent dans toutes les licences).
*   PARTIE C : option « Categories » (AFC, ACM, typologie).
*   PARTIE D : option « Custom Tables » (tableaux avec lettres A/B/C).
*   Si C ou D affichent une erreur, c'est que l'option n'est pas dans votre licence :
*   les résultats de la partie A restent valables et déjà exportés.
* ==========================================================================.

GET FILE='C:\ETUDE_EDM\EDM_ELECTRIQUE_CAMEROUN.sav'.
DATASET NAME EDM_ELEC WINDOW=FRONT.
SHOW LICENSE.

* --------------------------------------------------------------------------.
* PONDÉRATION (facultatif) : retirer l'astérisque devant UNE seule ligne.
*   POIDS_V  = redressement sur le poids réel des villes.
*   POIDS_VC = redressement ville x cible sur les quotas.
* Sans pondération : ne rien changer.
* --------------------------------------------------------------------------.
* WEIGHT BY POIDS_V.
* WEIGHT BY POIDS_VC.

* ==========================================================================.
* PARTIE A — MODULE DE BASE.
* ==========================================================================.

* A01 — Profil des répondants.
FREQUENCIES VARIABLES=VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME
  /BARCHART PERCENT
  /ORDER=ANALYSIS.

* A02 — Habitudes d'achat.
FREQUENCIES VARIABLES=FREQACHA LIEACHPR MONMOYAC PAIEPRIV
  /BARCHART PERCENT
  /ORDER=ANALYSIS.

* A03 — Q9 Produits achetés (réponses multiples), par ville.
* (nom de groupe limité à 7 caractères dans MULT RESPONSE : PRODACH).
MULT RESPONSE GROUPS=PRODACH 'Q9. Produits achetés' (PRACCABL TO PRACGROU (1))
  /VARIABLES=CODEZONE(1,3)
  /FREQUENCIES=PRODACH
  /TABLES=PRODACH BY CODEZONE
  /CELLS=COLUMN
  /BASE=CASES.

* A04 à A10 — Tableaux croisés : effectifs, % ligne et colonne, résidus ajustés,
* khi-deux (Fisher automatique en 2x2), Phi et V de Cramer.
* BPROP = comparaison des % de colonnes, correction de Bonferroni (lettres en indice).

* A04 — Marque achetée le plus souvent, par ville.
CROSSTABS /TABLES=MAACPLSO BY CODEZONE
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT ROW COLUMN ASRESID BPROP
  /COUNT ROUND CELL.

* A05 — Marque achetée le plus souvent, par cible.
CROSSTABS /TABLES=MAACPLSO BY VOUSETES
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT ROW COLUMN ASRESID BPROP
  /COUNT ROUND CELL.

* A06 — Gamme achetée, par cible.
CROSSTABS /TABLES=GAACPLSO BY VOUSETES
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT ROW COLUMN ASRESID BPROP
  /COUNT ROUND CELL.

* A07 — Origine privilégiée, par cible.
CROSSTABS /TABLES=ORIGPRIV BY VOUSETES
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT ROW COLUMN ASRESID BPROP
  /COUNT ROUND CELL.

* A08 — Principal frein, par ville.
CROSSTABS /TABLES=PRINFREI BY CODEZONE
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT ROW COLUMN ASRESID BPROP
  /COUNT ROUND CELL.

* A09 — Canal préféré, par cible.
CROSSTABS /TABLES=CANAPREF BY VOUSETES
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT ROW COLUMN ASRESID BPROP
  /COUNT ROUND CELL.

* A10 — Disposition à acheter en ligne, par âge.
CROSSTABS /TABLES=PRETACLI BY AGEREPON
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT ROW COLUMN ASRESID BPROP
  /COUNT ROUND CELL.

* A11 — Scores moyens par cible : ANOVA, Levene, post-hoc Bonferroni.
* LECTURE : 1 = « Très importante / Fortement / Souvent » : moyenne BASSE = importance ÉLEVÉE.
ONEWAY IMPOMARQ IMSECSAV ORINFACH CRACPRCO BY VOUSETES
  /STATISTICS DESCRIPTIVES HOMOGENEITY
  /MISSING ANALYSIS
  /POSTHOC=BONFERRONI ALPHA(0.05).

* A12 — Q41 Leviers de fidélité (réponses multiples), par cible.
MULT RESPONSE GROUPS=RENFFID 'Q41. Leviers de fidélité' (RFIDPRIX TO RFIDPAIE (1))
  /VARIABLES=VOUSETES(1,5)
  /FREQUENCIES=RENFFID
  /TABLES=RENFFID BY VOUSETES
  /CELLS=COLUMN
  /BASE=CASES.

* A13 — Perceptions et attentes.
FREQUENCIES VARIABLES=MEQUAFIA MEILPRIX SUACMOGA DUGAJUAC
  /BARCHART PERCENT
  /ORDER=ANALYSIS.

* A14 — Achat en ligne déjà effectué, par genre (2x2 : test exact de Fisher).
CROSSTABS /TABLES=DEJACHLI BY SEXMAFEM
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT ROW COLUMN ASRESID BPROP
  /COUNT ROUND CELL.

* A15 — Régression linéaire : qu'est-ce qui explique l'importance de la marque (IMPOMARQ) ?
* Variables nominales en indicatrices 0/1 ; référence = dernière modalité
* (VOUSETES 5 = Revendeur/grossiste/distributeur, CODEZONE 3 = Bafoussam), comme dans le Sheet.
DO REPEAT D = VOUS_1 VOUS_2 VOUS_3 VOUS_4 VOUS_5 /K = 1 2 3 4 5.
COMPUTE D = (VOUSETES = K).
END REPEAT.
DO REPEAT D = ZONE_1 ZONE_2 ZONE_3 /K = 1 2 3.
COMPUTE D = (CODEZONE = K).
END REPEAT.
VARIABLE LABELS VOUS_1 'Cible : Particulier' /VOUS_2 'Cible : Entreprises (PME, industries)'
  /VOUS_3 'Cible : Électricien/artisan' /VOUS_4 'Cible : Entreprise BTP' /VOUS_5 'Cible : Revendeur/grossiste/distributeur'
  /ZONE_1 'Ville : Douala' /ZONE_2 'Ville : Yaoundé' /ZONE_3 'Ville : Bafoussam'.
FORMATS VOUS_1 TO VOUS_5 ZONE_1 TO ZONE_3 (F1.0).
REGRESSION
  /MISSING LISTWISE
  /STATISTICS COEFF OUTS CI(95) R ANOVA COLLIN TOL
  /CRITERIA=PIN(.05) POUT(.10)
  /NOORIGIN
  /DEPENDENT IMPOMARQ
  /METHOD=ENTER VOUS_1 VOUS_2 VOUS_3 VOUS_4 AGEREPON REVMENME ZONE_1 ZONE_2 PRACSOLA.

* A16 — Régression logistique : qui est prêt à acheter en ligne ? (1 = Oui ; 0 = Peut-être ou Non).
RECODE PRETACLI (1=1) (2,3=0) (ELSE=SYSMIS) INTO Y_PRETAC.
VARIABLE LABELS Y_PRETAC 'Prêt à acheter en ligne (1 = Oui ; 0 = Peut-être/Non)'.
VALUE LABELS Y_PRETAC 1 'Oui' 0 'Peut-être / Non'.
FORMATS Y_PRETAC (F1.0).
LOGISTIC REGRESSION VARIABLES Y_PRETAC
  /METHOD=ENTER AGEREPON VOUSETES CODEZONE REVMENME DEJACHLI
  /CATEGORICAL=VOUSETES CODEZONE DEJACHLI
  /CONTRAST (VOUSETES)=Indicator
  /CONTRAST (CODEZONE)=Indicator
  /CONTRAST (DEJACHLI)=Indicator
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(0.05) POUT(0.10) ITERATE(20) CUT(0.5).

* A19 — ACP + rotation varimax : dimensions sous-jacentes des attitudes.
FACTOR
  /VARIABLES IMPOMARQ ORINFACH CRACPRCO IMSECSAV FIMEFOUR SUACMOGA
  /MISSING LISTWISE
  /PRINT INITIAL KMO EXTRACTION ROTATION
  /FORMAT SORT
  /PLOT EIGEN
  /CRITERIA MINEIGEN(1) ITERATE(25)
  /EXTRACTION PC
  /CRITERIA ITERATE(25)
  /ROTATION VARIMAX
  /METHOD=CORRELATION.

* ---- V3 : BLOC GAMMES (Q19 à Q24) ----.

* A21 — Perception des gammes : définition du haut / bas de gamme, origines associées, écart de qualité.
FREQUENCIES VARIABLES=DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA ECQUHABA
  /BARCHART PERCENT
  /ORDER=ANALYSIS.

* A22 — Q23 Fourchette de prix associée à chaque gamme (1 = moins de 5 000 ... 4 = plus de 40 000 FCFA).
FREQUENCIES VARIABLES=PXHAUTGA PXMOYEGA PXBASGAM
  /STATISTICS=MEDIAN MODE
  /BARCHART PERCENT
  /ORDER=ANALYSIS.
* Écart perçu haut - bas de gamme, en nombre de tranches (négatif = question mal comprise).
COMPUTE ECPXHABA = PXHAUTGA - PXBASGAM.
VARIABLE LABELS ECPXHABA 'Q23. Écart de tranche de prix haut - bas de gamme'.
FORMATS ECPXHABA (F2.0).
FREQUENCIES VARIABLES=ECPXHABA /ORDER=ANALYSIS.

* A23 — Définition du haut et du bas de gamme, par cible.
CROSSTABS /TABLES=DEAVHAGA CAAVBAGA BY VOUSETES
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT ROW COLUMN ASRESID BPROP
  /COUNT ROUND CELL.

* A24 — Origine associée au haut / bas de gamme, par ville.
CROSSTABS /TABLES=ORASHAGA ORASBAGA BY CODEZONE
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT ROW COLUMN ASRESID BPROP
  /COUNT ROUND CELL.

* Export intermédiaire : la partie A est déjà sauvegardée dans Excel même si C ou D échouent.
OUTPUT EXPORT
  /CONTENTS EXPORT=ALL LAYERS=VISIBLE MODELVIEWS=PRINTSETTING
  /XLSX DOCUMENTFILE='C:\ETUDE_EDM\RESULTATS_EDM_ELECTRIQUE.xlsx'
    OPERATION=CREATEFILE.

* ==========================================================================.
* PARTIE C — OPTION « CATEGORIES » (AFC, ACM, typologie).
* ==========================================================================.

* A17 — AFC : carte marques x cibles.
CORRESPONDENCE TABLE=MAACPLSO(1 12) BY VOUSETES(1 5)
  /DIMENSIONS=2
  /MEASURE=CHISQ
  /STANDARDIZE=RCMEAN
  /NORMALIZATION=SYMMETRICAL
  /PRINT=TABLE RPOINTS CPOINTS RPROFILES CPROFILES
  /PLOT=NDIM(1,MAX) BIPLOT(20).

* A18 — ACM : carte du marché.
MULTIPLE CORRESPONDENCE VARIABLES=VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF
  /ANALYSIS=VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF
  /MISSING=VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF (LISTWISE)
  /DIMENSION=2
  /NORMALIZATION=VPRINCIPAL
  /MAXITER=100
  /CRITITER=.00001
  /PRINT=DISCRIM QUANT(VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF)
  /PLOT=CATEGORY(VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF)
    JOINTCAT(VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF) DISCRIM.

* A20 — Typologie des acheteurs : ACM, puis nuées dynamiques (k-means) sur les coordonnées.
* Réglez CLUSTER(4) sur le nombre de classes voulu (ex. celui retenu dans l'onglet A20 du Sheet).
MULTIPLE CORRESPONDENCE VARIABLES=VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF
  /ANALYSIS=VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF
  /MISSING=VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF (LISTWISE)
  /DIMENSION=2
  /NORMALIZATION=OPRINCIPAL
  /PRINT=NONE
  /SAVE=OBJECT.
QUICK CLUSTER OBSCO1_1 OBSCO2_1
  /MISSING=LISTWISE
  /CRITERIA=CLUSTER(4) MXITER(100) CONVERGE(0)
  /METHOD=KMEANS(NOUPDATE)
  /SAVE CLUSTER(CLASSE)
  /PRINT INITIAL ANOVA.
VARIABLE LABELS CLASSE 'Classe de la typologie'.
* Portrait de chaque classe.
CROSSTABS /TABLES=VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF CODEZONE BY CLASSE
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ
  /CELLS=COUNT COLUMN ASRESID.

* ==========================================================================.
* PARTIE D — OPTION « CUSTOM TABLES » : tableaux d'étude de marché avec lettres A/B/C.
* Une lettre dans une cellule = ce % (ou cette moyenne) est significativement plus
* élevé que dans la colonne portant cette lettre (Bonferroni, 5 %).
* ==========================================================================.
CTABLES
  /VLABELS VARIABLES=ALL DISPLAY=LABEL
  /TABLE MAACPLSO + GAACPLSO + DEAVHAGA + ORASHAGA + ORASBAGA + ORIGPRIV + PRINFREI + CANAPREF
    + PRETACLI + $PRODACHE + $RENFFIDE
    BY CODEZONE [COUNT F40.0, COLPCT.COUNT PCT40.1]
  /CATEGORIES VARIABLES=ALL EMPTY=INCLUDE TOTAL=YES POSITION=AFTER
  /COMPARETEST TYPE=PROP ALPHA=0.05 ADJUST=BONFERRONI INCLUDEMRSETS=YES
    CATEGORIES=ALLVISIBLE MERGE=NO STYLE=SIMPLE SHOWSIG=NO
  /SIGTEST TYPE=CHISQUARE ALPHA=0.05 INCLUDEMRSETS=YES CATEGORIES=ALLVISIBLE
  /TITLES TITLE='Principaux indicateurs par ville'.

CTABLES
  /VLABELS VARIABLES=ALL DISPLAY=LABEL
  /TABLE MAACPLSO + GAACPLSO + DEAVHAGA + ORASHAGA + ORASBAGA + ORIGPRIV + PRINFREI + CANAPREF
    + PRETACLI + $PRODACHE + $RENFFIDE
    BY VOUSETES [COUNT F40.0, COLPCT.COUNT PCT40.1]
  /CATEGORIES VARIABLES=ALL EMPTY=INCLUDE TOTAL=YES POSITION=AFTER
  /COMPARETEST TYPE=PROP ALPHA=0.05 ADJUST=BONFERRONI INCLUDEMRSETS=YES
    CATEGORIES=ALLVISIBLE MERGE=NO STYLE=SIMPLE SHOWSIG=NO
  /SIGTEST TYPE=CHISQUARE ALPHA=0.05 INCLUDEMRSETS=YES CATEGORIES=ALLVISIBLE
  /TITLES TITLE='Principaux indicateurs par cible'.

* Scores moyens par cible, avec lettres (rappel : moyenne basse = importance élevée).
CTABLES
  /VLABELS VARIABLES=ALL DISPLAY=LABEL
  /TABLE IMPOMARQ [S][MEAN F40.2, VALIDN F40.0] + IMSECSAV [S][MEAN F40.2, VALIDN F40.0]
    + ORINFACH [S][MEAN F40.2, VALIDN F40.0] + CRACPRCO [S][MEAN F40.2, VALIDN F40.0]
    BY VOUSETES
  /CATEGORIES VARIABLES=VOUSETES TOTAL=YES POSITION=AFTER
  /COMPARETEST TYPE=MEAN ALPHA=0.05 ADJUST=BONFERRONI
    CATEGORIES=ALLVISIBLE MERGE=NO STYLE=SIMPLE SHOWSIG=NO
  /TITLES TITLE='Scores moyens par cible'.

* ==========================================================================.
* EXPORT FINAL : toute la sortie (parties A, C et D) vers Excel.
* ==========================================================================.
OUTPUT EXPORT
  /CONTENTS EXPORT=ALL LAYERS=VISIBLE MODELVIEWS=PRINTSETTING
  /XLSX DOCUMENTFILE='C:\ETUDE_EDM\RESULTATS_EDM_ELECTRIQUE.xlsx'
    OPERATION=CREATEFILE.
* FIN.
