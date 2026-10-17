* Encoding: UTF-8.
* =========================================================================.
* ÉTUDE DE MARCHÉ - MATÉRIEL ET ÉQUIPEMENTS ÉLECTRIQUES (Douala, Yaoundé, Bafoussam).
* SYNTAXE DE REPRODUCTION DES RÉSULTATS DU RAPPORT (version 12).
* Base : SPSS_EDM_EE_V6_ANALYSE_427.sav (427 fiches retenues, 128 variables).
* Compatible IBM SPSS Statistics 27.
* =========================================================================.
*.
* MODE D'EMPLOI (2 gestes).
* 1. Ouvrir SPSS_EDM_EE_V6_ANALYSE_427.sav (fenêtre de données au premier plan).
* 2. Ouvrir cette syntaxe, menu Exécuter > Tout.
* Aucune commande CD, GET FILE ni SAVE : la syntaxe travaille sur la base
* active et ne modifie aucun fichier sur le disque.
*.
* CORRESPONDANCE AVEC LE RAPPORT.
* Chaque bloc porte le numéro du tableau ou du graphique du rapport (TITLE).
* Les pourcentages du rapport sont des pourcentages VALIDES : non-réponse
* (99) exclue ; « Sans avis » (98) comptée comme réponse pour Q15, Q16, Q21,
* Q22 ; « NSP » (98) exclue pour Q5. C'est le paramétrage de la base : il n'y
* a rien à déclarer. Les graphiques 1 à 8, les tableaux 2 et 3 et le contrôle
* qualité portent sur les 446 fiches collectées : voir la syntaxe
* EDM_EE_REPRODUCTION_COLLECTE_446.sps, sur la base de collecte.
*.
* MODULES : Statistics Base pour tout, sauf LOGISTIC REGRESSION (module
* Regression) et CORRESPONDENCE (module Categories). Si un module manque, SPSS
* signale une erreur sur ce bloc et exécute le reste.
* =========================================================================.

SET TVARS=LABELS TNUMBERS=LABELS OVARS=LABELS ONUMBERS=LABELS.
WEIGHT OFF.
FILTER OFF.
USE ALL.

* -------------------------------------------------------------------------.
* Contrôle de la base active : cette syntaxe doit tourner sur la base
* d'analyse (427 fiches). Si le tableau affiche ERREUR, ouvrir
* SPSS_EDM_EE_V6_ANALYSE_427.sav, la mettre au premier plan et relancer.
* -------------------------------------------------------------------------.
COMPUTE CTRL_UN = 1.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=CTRL_UN /CTRL_N=N.
COMPUTE CTRL_BASE = (CTRL_N = 427).
VARIABLE LABELS CTRL_BASE "Contrôle de la base active".
VALUE LABELS CTRL_BASE 1 "OK : base d'analyse, 427 fiches"
  0 "ERREUR : la base active n'a pas 427 fiches, résultats non valides".
TITLE "Contrôle - la base active doit compter 427 fiches".
FREQUENCIES VARIABLES=CTRL_BASE.
DELETE VARIABLES CTRL_UN CTRL_N CTRL_BASE.

* -------------------------------------------------------------------------.
* 0. Indicateurs 0/1 de la synthèse et du tableau 2 bis (non enregistrés).
* -------------------------------------------------------------------------.
RECODE CRACPRCO (1,2=1) (3,4=0) (ELSE=SYSMIS) INTO R_CONTREF.
RECODE SUACMOGA (1,2=1) (3 THRU 5=0) (ELSE=SYSMIS) INTO R_REFUS10.
RECODE GAACPLSO (2=1) (1,3,4=0) (ELSE=SYSMIS) INTO R_MOYGAM.
RECODE MARQUE_G (1=1) (2 THRU 10=0) (ELSE=SYSMIS) INTO R_SCHNEI.
RECODE SEATPRIO (1=1) (2 THRU 5=0) (ELSE=SYSMIS) INTO R_GARREM.
RECODE LIEACHPR (2=1) (1,3,4,5,6=0) (ELSE=SYSMIS) INTO R_GROSSI.
VARIABLE LABELS R_CONTREF "Craint la contrefaçon (souvent ou parfois)"
  /R_REFUS10 "Refuse un surcoût de plus de 10 %"
  /R_MOYGAM "Achète surtout de la moyenne gamme"
  /R_SCHNEI "Schneider, marque la plus achetée"
  /R_GARREM "Garantie avec remplacement, premier service attendu"
  /R_GROSSI "Achète d'abord chez un grossiste spécialisé".
* Les mêmes indicateurs en pourcentage (0 ou 100) : leur moyenne se lit directement en %.
DO REPEAT P = P_DECU P_CONTREF P_QUAL P_REFUS10 P_MOYGAM P_SCHNEI P_YAKI P_GARREM P_GROSSI P_ONLINE
  /X = DECU R_CONTREF CRIT_QUAL R_REFUS10 R_MOYGAM R_SCHNEI ACHAT_YAKI R_GARREM R_GROSSI ONLIN_FERME.
COMPUTE P = 100 * X.
END REPEAT.
FORMATS P_DECU TO P_ONLINE (F5.1).
VARIABLE LABELS P_DECU "Déjà déçus par un achat (%)" /P_CONTREF "Craignent la contrefaçon, souvent ou parfois (%)"
  /P_QUAL "Qualité / durabilité, premier critère (%)" /P_REFUS10 "Refusent un surcoût de plus de 10 % (%)"
  /P_MOYGAM "Achètent surtout de la moyenne gamme (%)" /P_SCHNEI "Schneider, marque la plus achetée (%)"
  /P_YAKI "Yaki, deuxième marque achetée (%)" /P_GARREM "Garantie avec remplacement, 1er service attendu (%)"
  /P_GROSSI "Achètent d'abord chez un grossiste (%)" /P_ONLINE "Prêts à acheter en ligne (%)".
EXECUTE.

* =========================================================================.
* SYNTHÈSE EXÉCUTIVE - TABLEAU S1 (chiffres clés).
* =========================================================================.
TITLE "Tableau S1 - Chiffres clés (en %)".
MEANS TABLES=P_DECU P_CONTREF P_QUAL P_REFUS10 P_MOYGAM P_SCHNEI P_YAKI P_GARREM P_GROSSI P_ONLINE
  /CELLS=MEAN COUNT.
* Repères : 80,0 (426) ; 80,5 (390) ; 66,0 (427) ; 80,8 (333) ; 51,0 (420) ;.
* 31,5 (355) ; 18,6 (355) ; 62,1 (367) ; 34,4 (427) ; 21,5 (377).
* Repère IC 95 % du rapport = p ± 1,96 x racine(p x (1 - p) / n).

* =========================================================================.
* TABLEAU 2 bis - Sensibilité à la composition de l'échantillon.
* Poids = (427 / nombre de groupes) / effectif du groupe : chaque groupe pèse
* autant que les autres. Profil = PROFIL4 (4 groupes, PME et BTP réunis).
* =========================================================================.
COMPUTE UN = 1.
SORT CASES BY UN.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=UN /N_TOT=N.
SORT CASES BY PROFIL4.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=PROFIL4 /N_PROF=N.
SORT CASES BY CATEG3.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=CATEG3 /N_MAIL=N.
SORT CASES BY VILLEREG.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=VILLEREG /N_VILL=N.
COMPUTE W_PROF = (N_TOT / 4) / N_PROF.
COMPUTE W_MAIL = (N_TOT / 3) / N_MAIL.
COMPUTE W_VILL = (N_TOT / 3) / N_VILL.
SORT CASES BY ID_CASE.
EXECUTE.
TITLE "Tableau 2 bis - colonne Profils égaux".
WEIGHT BY W_PROF.
MEANS TABLES=P_DECU P_CONTREF P_QUAL P_REFUS10 P_MOYGAM P_SCHNEI P_YAKI P_GARREM P_GROSSI P_ONLINE /CELLS=MEAN.
TITLE "Tableau 2 bis - colonne Maillons égaux".
WEIGHT BY W_MAIL.
MEANS TABLES=P_DECU P_CONTREF P_QUAL P_REFUS10 P_MOYGAM P_SCHNEI P_YAKI P_GARREM P_GROSSI P_ONLINE /CELLS=MEAN.
TITLE "Tableau 2 bis - colonne Villes égales".
WEIGHT BY W_VILL.
MEANS TABLES=P_DECU P_CONTREF P_QUAL P_REFUS10 P_MOYGAM P_SCHNEI P_YAKI P_GARREM P_GROSSI P_ONLINE /CELLS=MEAN.
WEIGHT OFF.
* Repères profils égaux : 78,4 ; 80,9 ; 69,7 ; 78,6 ; 47,3 ; 34,3 ; 14,4 ; 62,8 ; 34,3 ; 21,4.

* =========================================================================.
* III.A - TRAITEMENT DES DONNÉES.
* =========================================================================.
TITLE "Tableau 5 - Écarts villes et profils (khi-deux)".
CROSSTABS /TABLES=MARQ_AC DUGAJUAC ORIG_MARQ IMSECSAV FIMEFOUR ECQUHABA MEQUAFIA CRACPRCO ORINFACH
    FREQACHA SUACMOGA PRETACLI GAACPLSO PRIOPRIN DEJDECAC MEME_CANAL DEJACHLI BY VILLEREG PROFIL4
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.
NPAR TESTS /K-W=SUACMOGA BY VILLEREG(1 3) /K-W=SUACMOGA DUGAJUAC BY PROFIL4(1 4) /MISSING ANALYSIS.

TITLE "Tableau 6 - Récapitulatif des 56 variables".
FREQUENCIES VARIABLES=ACCRECON TO MAACPLSO PRCRICHO TO RFIDPAIE /ORDER=ANALYSIS.
FREQUENCIES VARIABLES=MAACAUTR /FORMAT=NOTABLE.

* =========================================================================.
* III.B.1 - OFFRE.
* =========================================================================.
TITLE "Tableau 7 et graphique 9 - Marques et origine".
FREQUENCIES VARIABLES=MARQUE_G ORIG_MARQ /FORMAT=DFREQ.
TEMPORARY.
SELECT IF NOT MISSING(MARQUE_G).
FREQUENCIES VARIABLES=MAACPLSO.
* Tableau 7 : détail des marques de la liste (Philips, Siemens, ABB, Hager...)
* parmi les 355 acheteurs dont la marque est connue.

TITLE "Graphique 10 - Importance de la marque".
FREQUENCIES VARIABLES=IMPOMARQ.
CROSSTABS /TABLES=IMPOMARQ BY PROFIL4 /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

* =========================================================================.
* III.B.2 - DEMANDE.
* =========================================================================.
TITLE "Graphique 11 - Produits achetés (Q9)".
MULT RESPONSE GROUPS=$Q9PROD 'Q9. Produits achetés' (PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU (1))
  /VARIABLES=PROFIL4(1 4)
  /FREQUENCIES=$Q9PROD
  /TABLES=$Q9PROD BY PROFIL4
  /CELLS=COLUMN
  /BASE=CASES.
* Lire « % des observations » (total supérieur à 100 %). Solaire : 40,0 % des entreprises.

TITLE "Graphiques 12 à 16 - Gamme, montant, critère".
FREQUENCIES VARIABLES=GAACPLSO MONMOYAC PRCRICHO LIEACHPR VOUSETES CATEG3.

TITLE "Graphiques 17 à 21 - Prix d'un disjoncteur".
FREQUENCIES VARIABLES=PXHAUTGA PXMOYEGA PXBASGAM.
CROSSTABS /TABLES=PXHAUTGA PXMOYEGA PXBASGAM BY PROFIL4 /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

TITLE "Graphiques 22, 24, 25 - Croisements par ville".
CROSSTABS /TABLES=ECQUHABA PRIOPRIN GAACPLSO BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.
TITLE "Graphiques 23, 26 à 28 - Croisements par profil".
CROSSTABS /TABLES=PRIOPRIN GAACPLSO ECQUHABA MONMOYAC BY PROFIL4 /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

TITLE "Graphiques 29 à 31 - Définition et origine des gammes".
FREQUENCIES VARIABLES=DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA ORHG_AV ORBG_AV.

TITLE "Graphique 32 - Fréquence d'achat par ville et par profil".
FREQUENCIES VARIABLES=FREQACHA.
CROSSTABS /TABLES=FREQACHA BY VILLEREG PROFIL4 /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

TITLE "Texte III.B.2 - Dépense annuelle estimée".
MEANS TABLES=DEPENSE_AN BY PROFIL4 VILLEREG /CELLS=MEDIAN MEAN COUNT.
NPAR TESTS /M-W=DEPENSE_AN BY VILLEREG(1 2) /MISSING ANALYSIS.
* Médiane : 3,25 millions FCFA ; entreprises 7,2 ; électriciens 1,5 ;.
* Douala = Yaoundé = 3,25 ; Bafoussam 7,2 ; moyenne 11,7 millions.

TITLE "Graphique 33 - Montant moyen par achat, par ville".
CROSSTABS /TABLES=MONMOYAC BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN TOTAL.

TITLE "Graphiques 34 et 35 - Surcoût accepté".
CROSSTABS /TABLES=SUACMOGA BY PROFIL4 VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN TOTAL.
MEANS TABLES=SURCOUT_PCT BY PROFIL4 VILLEREG GAACPLSO CATEG3 /CELLS=MEAN MEDIAN COUNT.
NPAR TESTS /K-W=SUACMOGA BY CATEG3(1 3) /MISSING ANALYSIS.
NONPAR CORR /VARIABLES=SUACMOGA WITH IMSECSAV CRACPRCO ECQUHABA IMPOMARQ BOSAPACH FIMEFOUR
  /PRINT=SPEARMAN TWOTAIL NOSIG /MISSING=PAIRWISE.
* Signe négatif dans la sortie : les attitudes sont codées 1 = « très » à 4 = « pas du tout ».

TITLE "Graphiques 36 et 48 - Payer plus pour le SAV".
FREQUENCIES VARIABLES=BOSAPACH.
CROSSTABS /TABLES=BOSAPACH BY PROFIL4 CATEG3 /FORMAT=AVALUE TABLES /STATISTICS=CHISQ /CELLS=COUNT COLUMN.

TITLE "Graphique 37 - Importance des caractéristiques".
FREQUENCIES VARIABLES=IMSECSAV IMPOMARQ ECQUHABA ORINFACH.

TITLE "Graphique 38 - Déceptions, crainte, freins".
FREQUENCIES VARIABLES=DEJDECAC CRACPRCO PRINFREI FIMEFOUR.
CROSSTABS /TABLES=DEJDECAC CRACPRCO PRINFREI BY ORIG_MARQ GAACPLSO
  /FORMAT=AVALUE TABLES /STATISTICS=CHISQ PHI /CELLS=COUNT COLUMN ASRESID.

TITLE "Graphiques 39 et 54 - Service attendu, par ville et ensemble".
FREQUENCIES VARIABLES=SEATPRIO.
CROSSTABS /TABLES=SEATPRIO BY VILLEREG CATEG3 /FORMAT=AVALUE TABLES /STATISTICS=CHISQ /CELLS=COUNT COLUMN.

TITLE "Graphique 40 - Principal levier de fidélité".
FREQUENCIES VARIABLES=LEVFIDEL NB_LEV.
CROSSTABS /TABLES=LEVFIDEL BY PROFIL4 /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

TITLE "Volume et potentiel du marché (e)".
FREQUENCIES VARIABLES=HEBDO ONLIN_POT /FORMAT=NOTABLE /STATISTICS=MEAN.
FREQUENCIES VARIABLES=FREQACHA PRETACLI.

* =========================================================================.
* III.B.3 - CONCURRENCE.
* =========================================================================.
TITLE "Graphiques 41 et 42 - Marques par ville".
CROSSTABS /TABLES=MARQUE_G BY VILLEREG PROFIL4 PRCRICHO /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

TITLE "Graphique 43 - Carte des marques par ville".
CORRESPONDENCE TABLE=MARQ_AC(1 6) BY VILLEREG(1 3)
  /DIMENSIONS=2 /MEASURE=CHISQ /STANDARDIZE=RCMEAN /NORMALIZATION=SYMMETRICAL
  /PRINT=TABLE RPOINTS CPOINTS /PLOT=BIPLOT(20).
TITLE "Carte des marques par profil (texte du graphique 43)".
CORRESPONDENCE TABLE=MARQ_AC(1 6) BY PROFIL4(1 4)
  /DIMENSIONS=2 /MEASURE=CHISQ /STANDARDIZE=RCMEAN /NORMALIZATION=SYMMETRICAL
  /PRINT=TABLE RPOINTS CPOINTS /PLOT=BIPLOT(20).
* Inertie totale : ,394 (ville) et ,115 (profil), arrondies à 0,39 et 0,12 dans.
* le rapport ; 1er axe ville : 69,3 % ; 1er axe profil : 56,5 %.

TITLE "Texte III.B.3 - Parts estimées en valeur".
TEMPORARY.
SELECT IF NOT MISSING(DEPENSE_AN).
WEIGHT BY DEPENSE_AN.
FREQUENCIES VARIABLES=MARQUE_G ORIG_MARQ.
* Point central (286 acheteurs) : Schneider 22,8 % ; Chint 22,6 % ; Legrand 13,7 % ;.
* Yaki 10,0 % ; européennes 44,4 %. Les fourchettes du rapport (ex. Schneider.
* 15 à 32 %) sont des intervalles bootstrap à 95 % (1 000 tirages). Avec le.
* module Bootstrapping, les obtenir en plaçant avant FREQUENCIES :.
* BOOTSTRAP /SAMPLING METHOD=SIMPLE /VARIABLES INPUT=MARQUE_G.
*   /CRITERIA CILEVEL=95 CITYPE=PERCENTILE NSAMPLES=1000.

TITLE "Tableau 9 - Circuits ; importateurs selon le profil".
FREQUENCIES VARIABLES=LIEACHPR.
CROSSTABS /TABLES=LIEACHPR BY PROFIL4 /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

TITLE "Graphiques 44 et 45 - Moyen de paiement".
FREQUENCIES VARIABLES=PAIEPRIV.
CROSSTABS /TABLES=PAIEPRIV BY PROFIL4 VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

TITLE "Graphiques 46, 47, 51, 52 - Origine".
FREQUENCIES VARIABLES=ORIGPRIV MEQUAFIA MEILPRIX MEQUA_AV MEILP_AV DILEMME ORINFACH PRIOPRIN.
CROSSTABS /TABLES=ORIGPRIV ORINFACH BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.
TITLE "Tableau 10 - Contrefaçon selon l'origine".
CROSSTABS /TABLES=CRACPRCO BY ORIG_MARQ /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

* =========================================================================.
* III.B.4 - NOUVEAU DISTRIBUTEUR, GARANTIE, CANAUX.
* =========================================================================.
TITLE "Graphique 49 - Critère de choix du canal, par profil".
FREQUENCIES VARIABLES=CRCHCANA.
CROSSTABS /TABLES=CRCHCANA BY PROFIL4 /FORMAT=AVALUE TABLES /STATISTICS=CHISQ /CELLS=COUNT COLUMN.

TITLE "Graphique 50 - Durée de garantie, par ville et par profil".
FREQUENCIES VARIABLES=DUGAJUAC.
CROSSTABS /TABLES=DUGAJUAC BY VILLEREG PROFIL4 /FORMAT=AVALUE TABLES /STATISTICS=CHISQ PHI /CELLS=COUNT COLUMN.

TITLE "Texte III.B.4 - Effet enquêteur à Douala".
STRING ENQ_DLA (A20).
COMPUTE ENQ_DLA = "Autres enquêteurs".
IF (CODEENQU = "ENQ1") ENQ_DLA = "ENQ1".
RECODE DUGAJUAC (3,4=1) (1,2=0) (ELSE=SYSMIS) INTO GAR_PLUS1AN.
RECODE IMSECSAV (4=1) (1,2,3=0) (ELSE=SYSMIS) INTO SAV_PASIMP.
VARIABLE LABELS GAR_PLUS1AN "Attend une garantie de plus d'un an" /SAV_PASIMP "Juge le SAV « pas important »".
TEMPORARY.
SELECT IF (VILLEREG = 1).
CROSSTABS /TABLES=DUGAJUAC GAR_PLUS1AN SAV_PASIMP BY ENQ_DLA CODEENQU /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ /CELLS=COUNT COLUMN.
* Repères (fiches déclarées à Douala) : plus d'un an = 65,0 % pour ENQ1 (n = 60).
* contre 10,8 % pour les autres (n = 93) ; SAV « pas important » 34,0 % contre 13,1 %.

TITLE "Graphique 53 - Canal préféré et maillons".
FREQUENCIES VARIABLES=CANAPREF MEME_CANAL.
CROSSTABS /TABLES=CANAPREF SEATPRIO BOSAPACH FIMEFOUR BY CATEG3 /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI /CELLS=COUNT COLUMN.

TITLE "Graphique 55 - Canal de contact, par ville et par profil".
FREQUENCIES VARIABLES=CACOPREF.
CROSSTABS /TABLES=CACOPREF BY VILLEREG PROFIL4 /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

TITLE "Graphiques 56 et 57 - Achat en ligne".
FREQUENCIES VARIABLES=DEJACHLI PRETACLI PRFRACLI.
CROSSTABS /TABLES=PRETACLI BY DEJACHLI /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.
CROSSTABS /TABLES=PRFRACLI BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.

TITLE "Texte III.B.4 - Régression logistique".
LOGISTIC REGRESSION VARIABLES ONLIN_FERME
  /METHOD=ENTER VILLEREG CATEG3 AGE3 SAV_TRESIMP MONT_100K DECU
  /CATEGORICAL=VILLEREG CATEG3 AGE3
  /CONTRAST (VILLEREG)=INDICATOR(1)
  /CONTRAST (CATEG3)=INDICATOR(1)
  /CONTRAST (AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=ITERATE(20) CUT(0.20).
* Repères Exp(B) : SAV très important 3,5 (1,9 - 6,7) ; panier de 100 000 FCFA.
* et plus 2,4 (1,2 - 4,9) ; Bafoussam 0,23 (0,09 - 0,61).
* R-deux de Nagelkerke ,225 (0,23 arrondi dans le rapport) ; Hosmer-Lemeshow p = ,004.

* =========================================================================.
* ANNEXE 2 - TYPOLOGIE EXPLORATOIRE (groupes enregistrés dans SEG_TS).
* =========================================================================.
TITLE "Tableau A2 - Profil des quatre groupes d'acheteurs".
FREQUENCIES VARIABLES=SEG_TS.
CROSSTABS /TABLES=PRCRICHO GAACPLSO PRIOPRIN IMSECSAV IMPOMARQ FIMEFOUR CRACPRCO FREQACHA VILLEREG PROFIL4 MARQUE_G BY SEG_TS
  /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN ASRESID.
MEANS TABLES=SURCOUT_PCT GARANTIE_MOIS BY SEG_TS /CELLS=MEAN MEDIAN COUNT.
* SEG_TS est le résultat enregistré de TWOSTEP CLUSTER (8 variables, 4 groupes.
* imposés, 361 fiches complètes). Relancer TWOSTEP peut donner des groupes.
* légèrement différents : l'algorithme dépend de l'ordre des fiches.

* Nettoyage des variables de travail (la base reste inchangée).
DELETE VARIABLES R_CONTREF TO R_GROSSI P_DECU TO P_ONLINE UN N_TOT N_PROF N_MAIL N_VILL W_PROF W_MAIL W_VILL ENQ_DLA GAR_PLUS1AN SAV_PASIMP.
TITLE "Fin de la syntaxe de reproduction".
