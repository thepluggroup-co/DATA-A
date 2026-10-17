* Encoding: UTF-8.
* =========================================================================.
* ÉTUDE DE MARCHÉ - DISTRIBUTION DU MATÉRIEL ET DES ÉQUIPEMENTS ÉLECTRIQUES.
* Douala - Yaoundé - Bafoussam (Cahier des charges M2B Conseils).
* SYNTAXE D'ANALYSE GLOBALE - VERSION 4.0 (à lancer APRÈS la reconfiguration V4.1).
* Fichier de données attendu : SPSS_EDM_EE_V4.sav (446 fiches, 74 variables).
* =========================================================================.
*.
* ORDRE D'EXÉCUTION.
* 1. EDM_EE_RECONFIGURATION_V4_1.sps  (crée SPSS_EDM_EE_V4.sav).
* 2. CETTE SYNTAXE                     (produit tous les tableaux du rapport).
*.
* COMMENT UTILISER CETTE SYNTAXE.
* 1. Indiquer le dossier dans la commande CD (PARTIE 0) : seule ligne à modifier.
* 2. Menu Exécuter > Tout. Chaque tableau porte un TITRE numéroté (T3.1...).
*    identique à la V3.3 : le numéro du tableau dans le rapport ne change pas.
* 3. Les lignes commençant par * sont des commentaires : elles disent.
*    COMMENT LIRE le tableau et QUOI ÉCRIRE dans le rapport.
* 4. Les "Repère V4" sont les valeurs attendues sur les 427 fiches retenues.
*    Si SPSS affiche ces valeurs, l'exécution est correcte.
*.
* CE QUI CHANGE PAR RAPPORT À LA V3.3.
* - Le dictionnaire (libellés, manquants, mesures, rôles) vient du fichier V4 :.
*   cette syntaxe NE LE RÉÉCRIT PLUS (fini les 98 déclarés manquants en douce).
* - Analyse sur les 427 fiches retenues (FILTER BY FILTRE_QUAL).
*   Seule la partie 2 (déroulement du terrain) montre les 446 fiches.
* - "Sans avis" (Q15, Q16, Q21, Q22) est une réponse : base = tous les répondants.
*   Les versions *_AV donnent la lecture "parmi ceux qui ont un avis".
* - Q41 : variable à réponse unique LEVFIDEL (plus de réponses multiples).
* - Marques : MARQUE_G et ORIG_MARQ intègrent le texte libre (Yaki, Schneider...).
* - Revenu : REVMEN_P, particuliers seulement (y compris dans les corrélations).
* - Tous les tableaux croisés sont lus PAR VILLE, PAR MAILLON (CATEG3) et PAR PROFIL.
* - Pondération CDC SUPPRIMÉE : les quotas du CDC sont une répartition du.
*   travail, pas la structure du marché. Les chiffres clés (partie 16) sont.
*   bruts, avec intervalle de confiance, et détaillés par maillon et par ville.
*.
* MODULES SPSS NÉCESSAIRES.
* - Statistics Base : parties 0 à 13, 15 (TwoStep) et 16.
* - Regression : partie 14 (LOGISTIC REGRESSION).
* - Categories : partie 15 (CORRESPONDENCE, MULTIPLE CORRESPONDENCE).
* Si un module manque, SPSS signale une erreur sur ce bloc et continue le reste.
* =========================================================================.

* =========================================================================.
* PARTIE 0 - OUVERTURE ET AFFICHAGE.
* =========================================================================.
CD 'C:\EDM_EE'.
GET FILE='SPSS_EDM_EE_V4.sav'.
DATASET NAME EDM_EE WINDOW=FRONT.
SET TVARS=LABELS TNUMBERS=LABELS OVARS=LABELS ONUMBERS=LABELS.
WEIGHT OFF.

* Macros d'affichage.
* !FREQ : tri à plat + diagramme en barres (en %).
* !TAB  : tableau croisé par VILLE, par MAILLON et par PROFIL, % en colonne.
*         + test z des proportions de colonnes (lettres A, B, C).
* !TEST : khi-deux + V de Cramer + résidus ajustés (partie 13).
* LECTURE DES LETTRES (BPROP) : une lettre dans une cellule signifie que la.
* proportion est significativement différente (p<0,05, Bonferroni) de celle.
* de la colonne portant cette lettre. Aucune lettre = pas d'écart prouvé.
DEFINE !FREQ (v = !CMDEND)
FREQUENCIES VARIABLES=!v /BARCHART PERCENT /ORDER=ANALYSIS.
!ENDDEFINE.

DEFINE !TAB (v = !CMDEND)
CROSSTABS /TABLES=!v BY VILLEREG CATEG3 PROFIL4
  /FORMAT=AVALUE TABLES
  /CELLS=COUNT COLUMN BPROP.
!ENDDEFINE.

DEFINE !TEST (v = !CMDEND)
CROSSTABS /TABLES=!v BY VILLEREG CATEG3 AGE3
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.
!ENDDEFINE.

* =========================================================================.
* PARTIE 1 - VARIABLES D'ANALYSE (indicateurs, scores, montants).
* PROFIL4, CATEG3, AGE3, REVMEN_P, MARQUE_G, ORIG_MARQ, LEVFIDEL, *_AV,.
* NB_NR, TX_REMPL existent déjà dans le fichier V4 : on ne les recrée pas.
* =========================================================================.

* 1.1 Indicateurs binaires (1 = oui, 0 = non) : leur moyenne = un pourcentage.
RECODE PRETACLI (1=1) (2,3=0) (ELSE=SYSMIS) INTO ONLIN_FERME.
RECODE PRETACLI (1,2=1) (3=0) (ELSE=SYSMIS) INTO ONLIN_POT.
RECODE DEJACHLI (1=1) (2=0) (ELSE=SYSMIS) INTO DEJA_LIGNE.
RECODE BOSAPACH (1=1) (2,3=0) (ELSE=SYSMIS) INTO SAV_OUI.
RECODE BOSAPACH (1,2=1) (3=0) (ELSE=SYSMIS) INTO SAV_POT.
RECODE IMSECSAV (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO SAV_TRESIMP.
RECODE IMPOMARQ (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO MARQ_TRESIMP.
RECODE MONMOYAC (3,4,5=1) (1,2=0) (ELSE=SYSMIS) INTO MONT_100K.
RECODE FREQACHA (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO HEBDO.
RECODE DEJDECAC (1,2=1) (3=0) (ELSE=SYSMIS) INTO DECU.
RECODE GAACPLSO (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO HAUTGAMME.
RECODE FIMEFOUR (1,2=1) (3,4,5=0) (ELSE=SYSMIS) INTO FIDELE.
RECODE PRCRICHO (2=1) (1,3,4,5,6=0) (ELSE=SYSMIS) INTO CRIT_QUAL.
RECODE PRCRICHO (1=1) (2,3,4,5,6=0) (ELSE=SYSMIS) INTO CRIT_PRIX.
RECODE ORIGPRIV (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO PREF_EUROPE.
RECODE ORIGPRIV (2=1) (1,3,4=0) (ELSE=SYSMIS) INTO PREF_ASIE.
RECODE ORIGPRIV (4=1) (1,2,3=0) (ELSE=SYSMIS) INTO PREF_AUCUNE.
RECODE CRACPRCO (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO CONTREF_SOUV.
RECODE PAIEPRIV (1=1) (2,3,4=0) (ELSE=SYSMIS) INTO ESPECES.
RECODE DUGAJUAC (3,4=1) (1,2=0) (ELSE=SYSMIS) INTO GARANT_1AN.
RECODE SUACMOGA (3,4,5=1) (1,2=0) (ELSE=SYSMIS) INTO SURCOUT_10.
RECODE CACOPREF (3=1) (1,2,4,5=0) (ELSE=SYSMIS) INTO CONTACT_WA.
RECODE MARQUE_G (5=1) (1,2,3,4,6,7,8,9,10=0) (ELSE=SYSMIS) INTO ACHAT_YAKI.
RECODE LIEACHPR (1=1) (2=2) (3=3) (4=4) (5=5) (6=6) (ELSE=SYSMIS) INTO LIEU_ACT.
* Dilemme : Europe jugée meilleure en qualité ET Asie en prix.
* Base = répondants ayant un avis sur les deux questions.
COMPUTE DILEMME = $SYSMIS.
IF (MEQUAFIA GE 1 AND MEQUAFIA LE 3 AND MEILPRIX GE 1 AND MEILPRIX LE 3) DILEMME = (MEQUAFIA = 1 AND MEILPRIX = 2).
VARIABLE LABELS ONLIN_FERME "Intention FERME d'achat en ligne (Oui)"
  /ONLIN_POT "Intention POTENTIELLE d'achat en ligne (Oui + Peut-être)"
  /DEJA_LIGNE "A déjà acheté en ligne"
  /SAV_OUI "Paierait plus cher pour un bon SAV (Oui)"
  /SAV_POT "Paierait plus cher pour un bon SAV (Oui + Peut-être)"
  /SAV_TRESIMP "SAV jugé TRÈS important"
  /MARQ_TRESIMP "Marque jugée TRÈS importante"
  /MONT_100K "Achat moyen de 100 000 FCFA ou plus"
  /HEBDO "Achète chaque semaine"
  /DECU "A déjà été déçu par un achat"
  /HAUTGAMME "Achète surtout du haut de gamme"
  /FIDELE "Fidèle (toujours / souvent) au même fournisseur"
  /CRIT_QUAL "Critère n°1 = qualité / durabilité"
  /CRIT_PRIX "Critère n°1 = prix"
  /PREF_EUROPE "Préfère l'origine Europe"
  /PREF_ASIE "Préfère l'origine Asie"
  /PREF_AUCUNE "Aucune préférence d'origine"
  /CONTREF_SOUV "Craint SOUVENT d'acheter un produit contrefait"
  /ESPECES "Paie principalement en espèces"
  /GARANT_1AN "Attend une garantie d'au moins 1 an"
  /SURCOUT_10 "Accepte un surcoût de plus de 10 % pour monter en gamme"
  /CONTACT_WA "Préfère WhatsApp comme canal de contact"
  /ACHAT_YAKI "Achète surtout la marque Yaki"
  /LIEU_ACT "Lieu d'achat ACTUEL (Q7)"
  /DILEMME "Perçoit Europe = qualité ET Asie = prix (avis exprimés)".
VALUE LABELS ONLIN_FERME ONLIN_POT DEJA_LIGNE SAV_OUI SAV_POT SAV_TRESIMP MARQ_TRESIMP MONT_100K HEBDO DECU
  HAUTGAMME FIDELE CRIT_QUAL CRIT_PRIX PREF_EUROPE PREF_ASIE PREF_AUCUNE CONTREF_SOUV ESPECES GARANT_1AN
  SURCOUT_10 CONTACT_WA ACHAT_YAKI DILEMME 0 "Non" 1 "Oui".
VALUE LABELS LIEU_ACT 1 "Quincaillerie" 2 "Grossiste spécialisé" 3 "Magasin spécialisé" 4 "Marché" 5 "Importateur" 6 "En ligne".

* 1.2 Scores orientés : PLUS LE SCORE EST ÉLEVÉ, PLUS L'ATTITUDE EST FORTE.
RECODE IMPOMARQ (1=4) (2=3) (3=2) (4=1) (ELSE=SYSMIS) INTO S_MARQUE.
RECODE IMSECSAV (1=4) (2=3) (3=2) (4=1) (ELSE=SYSMIS) INTO S_SAV.
RECODE ORINFACH (1=4) (2=3) (3=2) (4=1) (ELSE=SYSMIS) INTO S_ORIGINE.
RECODE CRACPRCO (1=4) (2=3) (3=2) (4=1) (ELSE=SYSMIS) INTO S_CONTREF.
RECODE FIMEFOUR (1=5) (2=4) (3=3) (4=2) (5=1) (ELSE=SYSMIS) INTO S_FIDEL.
RECODE DEJDECAC (1=3) (2=2) (3=1) (ELSE=SYSMIS) INTO S_DECEP.
RECODE PRETACLI (1=3) (2=2) (3=1) (ELSE=SYSMIS) INTO S_ONLINE.
RECODE BOSAPACH (1=3) (2=2) (3=1) (ELSE=SYSMIS) INTO S_PAYSAV.
RECODE ECQUHABA (1=5) (2=4) (3=3) (4=2) (5=1) (ELSE=SYSMIS) INTO S_ECART.
RECODE FREQACHA (1=4) (2=3) (3=2) (4=1) (ELSE=SYSMIS) INTO S_FREQ.
VARIABLE LABELS S_MARQUE "Score importance de la marque (1 à 4)"
  /S_SAV "Score importance du SAV (1 à 4)"
  /S_ORIGINE "Score influence de l'origine (1 à 4)"
  /S_CONTREF "Score crainte de la contrefaçon (1 à 4)"
  /S_FIDEL "Score fidélité fournisseur (1 à 5)"
  /S_DECEP "Score déception passée (1 à 3)"
  /S_ONLINE "Score disposition achat en ligne (1 à 3)"
  /S_PAYSAV "Score disposition à payer le SAV (1 à 3)"
  /S_ECART "Score écart de qualité perçu haut/bas de gamme (1 à 5)"
  /S_FREQ "Score fréquence d'achat (1 à 4)".

* 1.3 Indices 0-100.
COMPUTE IDX_MARQUE = (S_MARQUE - 1) / 3 * 100.
COMPUTE IDX_SAV = (S_SAV - 1) / 3 * 100.
COMPUTE IDX_ORIGINE = (S_ORIGINE - 1) / 3 * 100.
COMPUTE IDX_CONTREF = (S_CONTREF - 1) / 3 * 100.
COMPUTE IDX_FIDEL = (S_FIDEL - 1) / 4 * 100.
COMPUTE IDX_DECEP = (S_DECEP - 1) / 2 * 100.
COMPUTE IDX_ONLINE = (S_ONLINE - 1) / 2 * 100.
COMPUTE IDX_PAYSAV = (S_PAYSAV - 1) / 2 * 100.
VARIABLE LABELS IDX_MARQUE "Indice d'attachement à la marque (0-100)"
  /IDX_SAV "Indice d'exigence SAV (0-100)"
  /IDX_ORIGINE "Indice de sensibilité à l'origine (0-100)"
  /IDX_CONTREF "Indice de crainte de la contrefaçon (0-100)"
  /IDX_FIDEL "Indice de fidélité fournisseur (0-100)"
  /IDX_DECEP "Indice de déception passée (0-100)"
  /IDX_ONLINE "Indice d'appétence achat en ligne (0-100)"
  /IDX_PAYSAV "Indice de disposition à payer le SAV (0-100)".
FORMATS IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV (F5.1).

* 1.4 Variables monétaires approchées (points milieux des tranches : HYPOTHÈSES).
* A ÉCRIRE DANS LE RAPPORT : "estimation indicative à partir des tranches".
RECODE MONMOYAC (1=15000) (2=62500) (3=300000) (4=1250000) (5=3000000) (ELSE=SYSMIS) INTO MONTANT_FCFA.
RECODE FREQACHA (1=52) (2=24) (3=4) (4=1) (ELSE=SYSMIS) INTO ACHATS_AN.
COMPUTE DEPENSE_AN = MONTANT_FCFA * ACHATS_AN.
RECODE SUACMOGA (1=0) (2=5) (3=17.5) (4=37.5) (5=60) (ELSE=SYSMIS) INTO SURCOUT_PCT.
RECODE DUGAJUAC (1=3) (2=9) (3=18) (4=30) (ELSE=SYSMIS) INTO GARANTIE_MOIS.
VARIABLE LABELS MONTANT_FCFA "Montant estimé par achat (FCFA, point milieu)"
  /ACHATS_AN "Nombre estimé d'achats par an"
  /DEPENSE_AN "Dépense annuelle estimée (FCFA, proxy)"
  /SURCOUT_PCT "Surcoût accepté pour monter en gamme (%, point milieu)"
  /GARANTIE_MOIS "Durée de garantie attendue (mois, point milieu)".
FORMATS MONTANT_FCFA DEPENSE_AN (COMMA14.0) SURCOUT_PCT (F5.1) GARANTIE_MOIS ACHATS_AN (F4.0).
VARIABLE LEVEL ONLIN_FERME ONLIN_POT DEJA_LIGNE SAV_OUI SAV_POT SAV_TRESIMP MARQ_TRESIMP MONT_100K
  HEBDO DECU HAUTGAMME FIDELE CRIT_QUAL CRIT_PRIX PREF_EUROPE PREF_ASIE PREF_AUCUNE CONTREF_SOUV
  ESPECES GARANT_1AN SURCOUT_10 CONTACT_WA ACHAT_YAKI LIEU_ACT DILEMME (NOMINAL)
  /S_MARQUE S_SAV S_ORIGINE S_CONTREF S_FIDEL S_DECEP S_ONLINE S_PAYSAV S_ECART S_FREQ (ORDINAL)
  /IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV
  MONTANT_FCFA ACHATS_AN DEPENSE_AN SURCOUT_PCT GARANTIE_MOIS (SCALE).
EXECUTE.

* =========================================================================.
* PARTIE 2 - MÉTHODOLOGIE ET QUALITÉ DES DONNÉES (rapport : Déroulement).
* Cette partie porte sur les 446 fiches collectées (filtre désactivé).
* =========================================================================.
FILTER OFF.
USE ALL.

TITLE "T2.1 Plan d'échantillonnage réalisé : profil x ville".
* PLAN PRÉVU (CDC, tableau à 500) - Douala / Yaoundé / Bafoussam / Total :.
*   Particuliers 35/35/15 = 85 ; PME 35/35/15 = 85 ; Artisans 40/40/20 = 100 ;.
*   BTP 40/40/20 = 100 ; Revendeurs 50/50/30 = 130 ; TOTAL 200/200/100 = 500.
CROSSTABS /TABLES=VOUSETES BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN TOTAL.
* Repère V4 (446 fiches collectées) : Douala 172, Yaoundé 172, Bafoussam 102.
* Particuliers 172 pour 85 prévus ; revendeurs 163/130 ; artisans 53/100 ;.
* PME 44/85 ; BTP 14/100. A ÉCRIRE : quota global quasi atteint, structure.
* très déformée. Les résultats BTP ne sont PAS publiables isolément.

TITLE "T2.2 Taux de réalisation des quotas par strate".
DATASET DECLARE PLAN_REALISE.
AGGREGATE /OUTFILE=PLAN_REALISE /BREAK=VILLEREG VOUSETES /REALISE=N.
DATASET ACTIVATE PLAN_REALISE.
SELECT IF (VILLEREG LE 3 AND VOUSETES LE 5).
DO IF (VOUSETES LE 2).
COMPUTE CIBLE_CDC = 35.
ELSE IF (VOUSETES LE 4).
COMPUTE CIBLE_CDC = 40.
ELSE.
COMPUTE CIBLE_CDC = 50.
END IF.
IF (VILLEREG = 3 AND VOUSETES LE 2) CIBLE_CDC = 15.
IF (VILLEREG = 3 AND (VOUSETES = 3 OR VOUSETES = 4)) CIBLE_CDC = 20.
IF (VILLEREG = 3 AND VOUSETES = 5) CIBLE_CDC = 30.
COMPUTE TX_REAL = 100 * REALISE / CIBLE_CDC.
VARIABLE LABELS REALISE "Fiches réalisées" /CIBLE_CDC "Cible CDC" /TX_REAL "Taux de réalisation (%)".
FORMATS REALISE CIBLE_CDC (F4.0) TX_REAL (F6.1).
SUMMARIZE /TABLES=VILLEREG VOUSETES REALISE CIBLE_CDC TX_REAL
  /FORMAT=LIST NOCASENUM NOTOTAL
  /TITLE="T2.2 Plan prévu (CDC) contre plan réalisé, par ville et par profil"
  /MISSING=VARIABLE
  /CELLS=NONE.
DATASET ACTIVATE EDM_EE.
DATASET CLOSE PLAN_REALISE.
* LECTURE : taux < 50 % = strate fragile ; taux > 150 % = strate sur-représentée.

TITLE "T2.3 Contrôle qualité et fiches retenues".
FREQUENCIES VARIABLES=FILTRE_QUAL DOUBLON_SUSP BLOC_WEB_VIDE.
CROSSTABS /TABLES=FILTRE_QUAL DOUBLON_SUSP BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.
MEANS TABLES=TX_REMPL NB_NR BY VILLEREG PROFIL4 /CELLS=MEAN MIN MAX COUNT.
* Repère V4 : 427 fiches retenues (Douala 163, Yaoundé 162, Bafoussam 102).
* 19 écartées : 11 remplies à moins de 70 % (dont 9 à Douala) et 8 copies.
* probables à Yaoundé. Remplissage moyen : Douala 89,6 % ; Yaoundé 92,6 % ;.
* Bafoussam 98,8 %. A ÉCRIRE (note méthodologique) : "un contrôle de cohérence.
* a conduit à écarter 19 fiches sur 446 (4,3 %) ; les résultats portent sur 427".

TITLE "T2.4 Contrôles de cohérence".
CROSSTABS /TABLES=DEJACHLI BY PRETACLI /FORMAT=AVALUE TABLES /CELLS=COUNT.
CROSSTABS /TABLES=REVMENME BY VOUSETES /FORMAT=AVALUE TABLES /CELLS=COUNT.
CROSSTABS /TABLES=LIEACHPR BY DEJACHLI /FORMAT=AVALUE TABLES /CELLS=COUNT.
FREQUENCIES VARIABLES=NB_LEV.
* Repère V4 : Q41 = 1 seul levier coché sur 429 fiches sur 429 valides.
* A ÉCRIRE : "Q41 a été recueillie en réponse unique : on présente le levier.
* principal de fidélisation, et non un cumul de leviers".
* NOTE : le consentement au recontact (223 / 223) n'est pas suspect.
* (répartitions très différentes selon les villes).

* -------------------------------------------------------------------------.
* À PARTIR D'ICI : ANALYSE SUR LES 427 FICHES RETENUES.
* -------------------------------------------------------------------------.
FILTER BY FILTRE_QUAL.

TITLE "T2.5 Récapitulatif des données valides et manquantes".
FREQUENCIES VARIABLES=VOUSETES SEXMAFEM AGEREPON VILLEREG REVMEN_P FREQACHA LIEACHPR MONMOYAC
  PRACCABL PAIEPRIV IMPOMARQ MARQUE_G PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH GAACPLSO DEAVHAGA
  CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO
  DEJDECAC IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI
  FIMEFOUR LEVFIDEL
  /FORMAT=NOTABLE.
* A ÉCRIRE : au-delà de 20 % de manquants, résultat donné "sur base réduite".
* Bases réduites en V4 : prix par gamme Q23 (316 à 337), SUACMOGA (333),.
* PRFRACLI (347), MONMOYAC (352), MARQUE_G (355). Citer TOUJOURS la base (n).

* =========================================================================.
* PARTIE 3 - PROFIL DES RÉPONDANTS (objectif CDC n°1).
* =========================================================================.

TITLE "T3.1 Répartition par profil, groupe et maillon".
!FREQ v=VOUSETES PROFIL4 CATEG3.
* Repère V4 : particuliers 38,9 % ; revendeurs 36,5 % ; artisans 11,7 % ;.
* PME 9,6 % ; BTP 3,3 %. Maillons : utilisateurs finaux 48,5 % ;.
* distributeurs 36,5 % ; prescripteurs 15,0 %.
* A ÉCRIRE : structure de l'échantillon, pas du marché (voir T2.1).

TITLE "T3.2 Profil des répondants par ville".
CROSSTABS /TABLES=VOUSETES CATEG3 BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN BPROP.

TITLE "T3.3 Genre et âge des répondants".
!FREQ v=SEXMAFEM AGEREPON AGE3.
!TAB v=SEXMAFEM AGE3.
* Repère V4 : hommes 83,4 % ; moins de 35 ans 43,4 % ; 35-44 ans 34,8 %.

TITLE "T3.4 Revenu mensuel des ménages (particuliers)".
FREQUENCIES VARIABLES=REVMEN_P /BARCHART PERCENT.
* Repère V4 (particuliers, n=123) : 100-250 000 = 47,2 % ; moins de 100 000.
* = 34,1 % ; 250-500 000 = 17,1 %. Base = particuliers ayant répondu.

* =========================================================================.
* PARTIE 4 - HABITUDES D'ACHAT.
* =========================================================================.

TITLE "T4.1 Fréquence d'achat de matériel électrique".
!FREQ v=FREQACHA.
!TAB v=FREQACHA.
* Repère V4 : chaque semaine 32,7 % ; 1 à 3 fois par mois 41,7 %.
* Par maillon : hebdomadaire = distributeurs 45,5 % ; utilisateurs 28,3 % ;.
* prescripteurs 15,9 %.

TITLE "T4.2 Lieu d'achat principal actuel".
!FREQ v=LIEACHPR.
!TAB v=LIEACHPR.
* Repère V4 : grossiste spécialisé 34,4 % ; marché 19,2 % ; importateur 18,3 % ;.
* quincaillerie 18,0 % ; en ligne 1,2 %.

TITLE "T4.3 Montant moyen par achat".
!FREQ v=MONMOYAC.
!TAB v=MONMOYAC.
* Repère V4 (n=352) : 25-100 000 = 38,1 % ; 100-500 000 = 31,2 %.

TITLE "T4.4 Dépense annuelle estimée par maillon et par ville".
MEANS TABLES=MONTANT_FCFA ACHATS_AN DEPENSE_AN BY CATEG3 PROFIL4 VILLEREG
  /CELLS=MEAN MEDIAN COUNT.
* LECTURE : citer la MÉDIANE plutôt que la moyenne.

TITLE "T4.5 Produits achetés (réponses multiples)".
MULT RESPONSE GROUPS=$PRODUITS "Q9. Familles de produits achetées" (PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU (1))
  /VARIABLES=CATEG3 (1,3) PROFIL4 (1,4) VILLEREG (1,3)
  /FREQUENCIES=$PRODUITS
  /TABLES=$PRODUITS BY CATEG3 PROFIL4 VILLEREG
  /CELLS=COLUMN
  /BASE=CASES.
* Lire la colonne "% des observations". Total supérieur à 100 % (normal).
* Repère V4 (n=424) : prises 84,7 % ; câbles 80,4 % ; appareillage 78,5 % ;.
* luminaires 60,8 % ; solaire 20,8 % ; groupes électrogènes 10,4 %.

TITLE "T4.6 Mode de paiement privilégié".
!FREQ v=PAIEPRIV.
!TAB v=PAIEPRIV.
* Repère V4 : espèces 82,2 % ; Mobile Money 8,5 % ; virement 7,1 % ;.
* crédit fournisseur 2,1 %.

* =========================================================================.
* PARTIE 5 - MARQUES ET CRITÈRES DE CHOIX (objectifs CDC n°2 et n°3).
* =========================================================================.

TITLE "T5.1 Importance accordée à la marque".
!FREQ v=IMPOMARQ.
!TAB v=IMPOMARQ.
* Repère V4 : très importante 36,8 % + importante 38,7 % = 75,5 %.

TITLE "T5.2 Principal critère de choix d'un produit".
!FREQ v=PRCRICHO.
!TAB v=PRCRICHO.
* Repère V4 : qualité / durabilité 66,0 % ; prix 23,7 % ; disponibilité 5,9 %.

TITLE "T5.3 Marque achetée : liste du questionnaire".
FREQUENCIES VARIABLES=MAACPLSO /FORMAT=DFREQ.
* NOTE : mesure la PÉNÉTRATION (marque la plus achetée), PAS la notoriété.

TITLE "T5.4 Marque achetée le plus souvent (texte libre intégré)".
FREQUENCIES VARIABLES=MARQUE_G /FORMAT=DFREQ /BARCHART PERCENT.
!TAB v=MARQUE_G.
* Repère V4 (n=355) : Schneider 31,5 % ; Yaki 18,6 % ; Chint 16,3 % ;.
* Legrand 13,2 % ; pas de marque fixe 5,9 % ; autres citées 4,8 %.
* Par maillon : Yaki = distributeurs 29,3 %, utilisateurs 16,2 %,.
* prescripteurs 3,7 % ; Schneider = prescripteurs 40,7 %.
* A ÉCRIRE : Yaki, absente de la liste, est la 2e marque et passe surtout par.
* les distributeurs ; les installateurs restent sur Schneider.

TITLE "T5.5 Part de marché des marques EN VALEUR (proxy)".
WEIGHT BY DEPENSE_AN.
FREQUENCIES VARIABLES=MARQUE_G ORIG_MARQ /FORMAT=DFREQ.
WEIGHT OFF.
* Comparer la part en VOLUME (T5.4) et la part en VALEUR (T5.5).

TITLE "T5.6 Marque achetée selon le critère et la gamme".
CROSSTABS /TABLES=MARQUE_G BY PRCRICHO GAACPLSO /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN BPROP.

* =========================================================================.
* PARTIE 6 - ORIGINE DES PRODUITS (objectif CDC n°4).
* =========================================================================.

TITLE "T6.1 Origine privilégiée à l'achat".
!FREQ v=ORIGPRIV.
!TAB v=ORIGPRIV.
* Repère V4 : aucune préférence 40,3 % ; Europe 30,6 % ; Asie 28,4 %.

TITLE "T6.2 Origine de la marque réellement achetée".
!FREQ v=ORIG_MARQ.
!TAB v=ORIG_MARQ.
* Repère V4 (n=355) : européenne 51,3 % ; origine non établie 25,4 % ;.
* asiatique 17,5 % ; pas de marque fixe 5,9 %.

TITLE "T6.3 Préférence déclarée contre marque achetée".
CROSSTABS /TABLES=ORIGPRIV BY ORIG_MARQ /FORMAT=AVALUE TABLES /CELLS=COUNT ROW TOTAL.

TITLE "T6.4 Origines jugées les meilleures (qualité, prix)".
!FREQ v=MEQUAFIA MEILPRIX.
!TAB v=MEQUAFIA MEILPRIX.
FREQUENCIES VARIABLES=MEQUA_AV MEILP_AV.
* Repère V4 (base = tous) : qualité = Europe 46,3 %, sans avis 26,0 % ;.
* prix = Asie 58,7 %, sans avis 25,7 %.
* Parmi ceux qui ont un avis : qualité = Europe 62,6 % ; prix = Asie 79,0 %.
* A ÉCRIRE LES DEUX, avec la base : "46 % des acheteurs (63 % de ceux qui ont.
* un avis) désignent l'Europe ; un sur quatre n'a pas d'avis".

TITLE "T6.5 Le dilemme qualité européenne / prix asiatique".
CROSSTABS /TABLES=MEQUAFIA BY MEILPRIX /FORMAT=AVALUE TABLES /CELLS=COUNT TOTAL.
!TAB v=DILEMME.

TITLE "T6.6 Influence de l'origine sur la décision".
!FREQ v=ORINFACH.
!TAB v=ORINFACH.
* Repère V4 : pas du tout 34,0 % ; modérément 28,1 % ; fortement 19,6 %.

TITLE "T6.7 Origine associée au haut et au bas de gamme".
!FREQ v=ORASHAGA ORASBAGA.
!TAB v=ORASHAGA ORASBAGA.
FREQUENCIES VARIABLES=ORHG_AV ORBG_AV.
* Repère V4 (base = tous) : haut de gamme = Europe 47,6 %, sans avis 32,5 % ;.
* bas de gamme = sans avis 50,1 %, Asie 45,2 %.
* Parmi ceux qui ont un avis : haut = Europe 70,6 % ; bas = Asie 90,6 %.
* A ÉCRIRE : "la moitié des acheteurs n'associe le bas de gamme à aucune.
* origine" (le chiffre de 90 % ne vaut que pour 212 répondants).

* =========================================================================.
* PARTIE 7 - GAMMES ET ACCEPTABILITÉ DES PRIX.
* =========================================================================.

TITLE "T7.1 Gamme achetée le plus souvent".
!FREQ v=GAACPLSO.
!TAB v=GAACPLSO.
* Repère V4 : moyenne gamme 51,0 % ; haut 19,8 % ; selon le projet 19,5 % ;.
* bas 9,8 %.

TITLE "T7.2 Définition perçue du haut et du bas de gamme".
!FREQ v=DEAVHAGA CAAVBAGA.
!TAB v=DEAVHAGA CAAVBAGA.
* Repère V4 : haut de gamme = durabilité / fiabilité 52,4 % ;.
* bas de gamme = durée de vie courte 44,4 %.

TITLE "T7.3 Prix attendus d'un disjoncteur selon la gamme".
FREQUENCIES VARIABLES=PXHAUTGA PXMOYEGA PXBASGAM.
CROSSTABS /TABLES=PXHAUTGA PXMOYEGA PXBASGAM BY CATEG3 PROFIL4 /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.
* Repère V4 : haut 15-40 000 (39,5 %) ; moyenne 5-15 000 (48,2 %) ;.
* bas moins de 5 000 (78,2 %). Bases réduites (316 à 337).

TITLE "T7.4 Écart de qualité perçu entre gammes".
!FREQ v=ECQUHABA.
!TAB v=ECQUHABA.
* Repère V4 : très important 28,3 % + important 43,7 % = 72,0 %.

TITLE "T7.5 Priorité principale à l'achat".
!FREQ v=PRIOPRIN.
!TAB v=PRIOPRIN.
* Repère V4 : meilleur rapport qualité/prix 71,6 % ; qualité à tout prix.
* 16,0 % ; le moins cher 12,4 %.

TITLE "T7.6 Surcoût accepté pour monter en gamme".
!FREQ v=SUACMOGA.
!TAB v=SUACMOGA.
MEANS TABLES=SURCOUT_PCT BY CATEG3 PROFIL4 VILLEREG GAACPLSO /CELLS=MEAN MEDIAN COUNT.
* Repère V4 (n=333) : aucun 32,1 % ; jusqu'à +10 % 48,6 % ; plus de 10 % = 19,2 %.

* =========================================================================.
* PARTIE 8 - FREINS, CONTREFAÇON ET DÉCEPTIONS.
* =========================================================================.

TITLE "T8.1 Principal frein à l'achat".
!FREQ v=PRINFREI.
!TAB v=PRINFREI.
* Repère V4 : doute qualité / contrefaçon 36,7 % ; prix élevé 34,7 % ;.
* indisponibilité 19,6 %.

TITLE "T8.2 Crainte d'acheter un produit contrefait".
!FREQ v=CRACPRCO.
!TAB v=CRACPRCO.
* Repère V4 : souvent 45,4 % ; parfois 35,1 %.

TITLE "T8.3 Déceptions passées".
!FREQ v=DEJDECAC.
!TAB v=DEJDECAC.
* Repère V4 : déjà déçu 80,0 % dont plusieurs fois 63,1 %.

TITLE "T8.4 Déception et crainte selon la gamme et l'origine".
CROSSTABS /TABLES=DEJDECAC CRACPRCO BY GAACPLSO ORIG_MARQ /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN BPROP.

* =========================================================================.
* PARTIE 9 - SERVICE APRÈS-VENTE ET GARANTIE (objectif CDC n°5).
* =========================================================================.

TITLE "T9.1 Importance du service client et du SAV".
!FREQ v=IMSECSAV.
!TAB v=IMSECSAV.
* Repère V4 : très importante 37,8 % + importante 45,7 % = 83,5 %.

TITLE "T9.2 Service attendu en priorité".
!FREQ v=SEATPRIO.
!TAB v=SEATPRIO.
* Repère V4 : garantie / remplacement 62,1 % ; conseil technique 20,7 %.

TITLE "T9.3 Durée de garantie jugée acceptable".
!FREQ v=DUGAJUAC.
!TAB v=DUGAJUAC.
MEANS TABLES=GARANTIE_MOIS BY CATEG3 PROFIL4 VILLEREG /CELLS=MEAN MEDIAN COUNT.
* Repère V4 : moins de 6 mois 43,0 % ; 6 mois - 1 an 42,5 %.

TITLE "T9.4 Canal de contact préféré".
!FREQ v=CACOPREF.
!TAB v=CACOPREF.
* Repère V4 : en personne 60,9 % ; WhatsApp 19,9 % ; téléphone 17,7 %.

TITLE "T9.5 Disposition à payer plus pour un bon SAV".
!FREQ v=BOSAPACH.
!TAB v=BOSAPACH.
* Repère V4 : oui 24,4 % ; peut-être 44,2 % ; non 31,4 %.
* Par maillon (oui + peut-être) : utilisateurs 76,0 % ; prescripteurs 69,5 % ;.
* distributeurs 58,0 %.

* =========================================================================.
* PARTIE 10 - CANAUX DE DISTRIBUTION ET ACHAT EN LIGNE.
* =========================================================================.

TITLE "T10.1 Canal d'achat préféré".
!FREQ v=CANAPREF.
!TAB v=CANAPREF.
* Repère V4 : grossiste spécialisé 33,2 % ; marché 19,3 % ; quincaillerie 18,1 %.

TITLE "T10.2 Canal actuel contre canal préféré (migration)".
CROSSTABS /TABLES=LIEU_ACT BY CANAPREF /FORMAT=AVALUE TABLES
  /STATISTICS=MCNEMAR
  /CELLS=COUNT ROW TOTAL.

TITLE "T10.3 Critère de choix du canal".
!FREQ v=CRCHCANA.
!TAB v=CRCHCANA.
* Repère V4 : prix 28,8 % ; largeur du choix 21,1 % ; confiance 18,2 %.

TITLE "T10.4 Achat en ligne : expérience et intention".
!FREQ v=DEJACHLI PRETACLI.
!TAB v=DEJACHLI PRETACLI.
* Repère V4 : déjà acheté 29,2 % ; prêt : oui 21,5 %, peut-être 29,2 %,.
* non 49,3 %.

TITLE "T10.5 Principal frein à l'achat en ligne".
!FREQ v=PRFRACLI.
!TAB v=PRFRACLI.
* Repère V4 : qualité / conformité 36,6 % ; ne pas voir le produit 35,7 %.

TITLE "T10.6 Intention d'achat en ligne selon l'expérience".
CROSSTABS /TABLES=PRETACLI BY DEJACHLI MONMOYAC IMSECSAV AGE3 /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN BPROP.

* =========================================================================.
* PARTIE 11 - FIDÉLISATION.
* =========================================================================.

TITLE "T11.1 Fidélité à un même fournisseur".
!FREQ v=FIMEFOUR.
!TAB v=FIMEFOUR.
* Repère V4 : toujours 21,3 % + souvent 31,9 % = 53,2 % de fidèles.

TITLE "T11.2 Principal levier de fidélité (réponse unique)".
!FREQ v=LEVFIDEL.
!TAB v=LEVFIDEL.
* Repère V4 (n=416) : prix / promotions 34,9 % ; qualité constante 34,4 % ;.
* stock 19,7 % ; SAV fiable 5,3 % ; conseil 2,6 % ; paiement 1,9 %.
* A ÉCRIRE : total = 100 %. Le SAV fiable n'est cité en PREMIER que par 5 %.
* car prix et qualité passent avant ; ce n'est PAS une contradiction avec.
* l'importance du SAV (T9.1) : la question ne permettait qu'un seul choix.

* =========================================================================.
* PARTIE 12 - INDICES SYNTHÉTIQUES : VILLES, MAILLONS, PROFILS.
* =========================================================================.

TITLE "T12.1 Indices d'attitude (0-100) par maillon".
MEANS TABLES=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV BY CATEG3
  /CELLS=MEAN COUNT STDDEV
  /STATISTICS=ANOVA.

TITLE "T12.2 Indices d'attitude (0-100) par profil".
MEANS TABLES=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV BY PROFIL4
  /CELLS=MEAN COUNT STDDEV
  /STATISTICS=ANOVA.

TITLE "T12.3 Indices d'attitude (0-100) par ville".
MEANS TABLES=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV BY VILLEREG
  /CELLS=MEAN COUNT STDDEV
  /STATISTICS=ANOVA.
* LECTURE : Sig. < 0,05 = écart significatif ; Eta carré 0,01 faible ;.
* 0,06 moyen ; 0,14 fort.

TITLE "T12.4 Confirmation non paramétrique (Kruskal-Wallis)".
NPAR TESTS /K-W=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV BY CATEG3(1,3).
NPAR TESTS /K-W=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV BY VILLEREG(1,3).
NPAR TESTS /K-W=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV BY PROFIL4(1,4).
* A ÉCRIRE : ne retenir que les écarts significatifs dans LES DEUX tests.

* =========================================================================.
* PARTIE 13 - TESTS D'ASSOCIATION ET CORRÉLATIONS.
* =========================================================================.

TITLE "T13.1 Khi-deux et V de Cramer : comportements".
!TEST v=PRCRICHO GAACPLSO ORIGPRIV FIMEFOUR MARQUE_G.
TITLE "T13.2 Khi-deux et V de Cramer : attentes et canaux".
!TEST v=PRETACLI BOSAPACH CANAPREF SEATPRIO LEVFIDEL.
* LECTURE : 1) Sig. < 0,05 = lien établi (vérifier la note sur les effectifs.
* théoriques < 5) ; 2) V de Cramer : < 0,10 négligeable, 0,10-0,20 faible,.
* 0,20-0,30 moyen, > 0,30 fort ; 3) résidus ajustés > +1,96 ou < -1,96.

TITLE "T13.3 Corrélations de Spearman entre attitudes".
NONPAR CORR
  /VARIABLES=S_ONLINE S_PAYSAV WITH AGEREPON S_FREQ MONMOYAC S_MARQUE S_SAV S_ORIGINE S_CONTREF S_DECEP S_FIDEL S_ECART SUACMOGA GARANTIE_MOIS
  /PRINT=SPEARMAN TWOTAIL NOSIG
  /MISSING=PAIRWISE.
TITLE "T13.4 Revenu et attitudes (particuliers seulement)".
NONPAR CORR
  /VARIABLES=S_ONLINE S_PAYSAV S_MARQUE S_SAV WITH REVMEN_P
  /PRINT=SPEARMAN TWOTAIL NOSIG
  /MISSING=PAIRWISE.
* REVMEN_P n'existe que pour les particuliers (n=123) : corrélation séparée.

* =========================================================================.
* PARTIE 14 - MODÈLES EXPLICATIFS (régression logistique).
* =========================================================================.
* RÈGLE : environ 10 événements par paramètre estimé.
* LECTURE : Exp(B) = rapport de cotes ; retenir si Sig. < 0,05 ET si.
* l'intervalle de confiance 95 % ne contient pas 1.
* Référence des variables catégorielles = première modalité (Douala,.
* utilisateurs finaux, moins de 35 ans).

TITLE "T14.1 Qui est prêt à acheter en ligne ? Modèle principal".
LOGISTIC REGRESSION VARIABLES ONLIN_FERME
  /METHOD=ENTER VILLEREG SAV_TRESIMP MONT_100K DECU
  /CATEGORICAL=VILLEREG
  /CONTRAST (VILLEREG)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).

TITLE "T14.2 Achat en ligne : modèle complet exploratoire".
LOGISTIC REGRESSION VARIABLES ONLIN_FERME
  /METHOD=ENTER VILLEREG CATEG3 AGE3 SAV_TRESIMP MONT_100K HEBDO MARQ_TRESIMP DECU
  /CATEGORICAL=VILLEREG CATEG3 AGE3
  /CONTRAST (VILLEREG)=INDICATOR(1)
  /CONTRAST (CATEG3)=INDICATOR(1)
  /CONTRAST (AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).
* A citer en annexe seulement (sur-paramétré).

TITLE "T14.3 Intention potentielle d'achat en ligne".
LOGISTIC REGRESSION VARIABLES ONLIN_POT
  /METHOD=ENTER VILLEREG CATEG3 AGE3 SAV_TRESIMP MONT_100K HEBDO MARQ_TRESIMP DECU
  /CATEGORICAL=VILLEREG CATEG3 AGE3
  /CONTRAST (VILLEREG)=INDICATOR(1)
  /CONTRAST (CATEG3)=INDICATOR(1)
  /CONTRAST (AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).

TITLE "T14.4 Qui paierait plus pour un bon SAV ?".
LOGISTIC REGRESSION VARIABLES SAV_POT
  /METHOD=ENTER VILLEREG CATEG3 AGE3 SAV_TRESIMP MARQ_TRESIMP HAUTGAMME DECU FIDELE MONT_100K
  /CATEGORICAL=VILLEREG CATEG3 AGE3
  /CONTRAST (VILLEREG)=INDICATOR(1)
  /CONTRAST (CATEG3)=INDICATOR(1)
  /CONTRAST (AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).

TITLE "T14.5 Paiement ferme du SAV (Oui seulement)".
LOGISTIC REGRESSION VARIABLES SAV_OUI
  /METHOD=ENTER CATEG3 SAV_TRESIMP HAUTGAMME AGE3
  /CATEGORICAL=CATEG3 AGE3
  /CONTRAST (CATEG3)=INDICATOR(1)
  /CONTRAST (AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).

TITLE "T14.6 Qui achète Yaki ?".
LOGISTIC REGRESSION VARIABLES ACHAT_YAKI
  /METHOD=ENTER CATEG3 VILLEREG CRIT_PRIX MONT_100K
  /CATEGORICAL=CATEG3 VILLEREG
  /CONTRAST (CATEG3)=INDICATOR(1)
  /CONTRAST (VILLEREG)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).
* Environ 66 acheteurs de Yaki : 6 paramètres au plus.

* =========================================================================.
* PARTIE 15 - SEGMENTATION ET CARTOGRAPHIES.
* =========================================================================.

TITLE "T15.1 Segmentation des acheteurs (TwoStep, 4 segments)".
* ATTENTION : TwoStep dépend de l'ordre des fiches. Ne pas trier le fichier.
TWOSTEP CLUSTER
  /CATEGORICAL VARIABLES=FREQACHA PRCRICHO GAACPLSO IMPOMARQ IMSECSAV FIMEFOUR PRIOPRIN CRACPRCO
  /DISTANCE LIKELIHOOD
  /NUMCLUSTERS FIXED=4
  /HANDLENOISE 0
  /MEMALLOCATE 64
  /CRITERIA INITHRESHOLD(0) MXBRANCH(8) MXLEVEL(3)
  /PRINT IC COUNT SUMMARY
  /SAVE VARIABLE=SEGMENT.
VARIABLE LABELS SEGMENT "Segment d'acheteurs (TwoStep)".

TITLE "T15.2 Portrait des segments".
CROSSTABS /TABLES=CATEG3 PROFIL4 VILLEREG PRCRICHO GAACPLSO ORIGPRIV PRETACLI BOSAPACH MARQUE_G BY SEGMENT
  /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN BPROP.
MEANS TABLES=IDX_MARQUE IDX_SAV IDX_CONTREF IDX_FIDEL IDX_ONLINE IDX_PAYSAV DEPENSE_AN BY SEGMENT
  /CELLS=MEAN MEDIAN COUNT.
* NOMMER chaque segment d'après ses traits dominants.

TITLE "T15.3 Carte des marques par ville (AFC)".
CORRESPONDENCE TABLE=MARQUE_G(1,9) BY VILLEREG(1,3)
  /DIMENSIONS=2
  /MEASURE=CHISQ
  /STANDARDIZE=RCMEAN
  /NORMALIZATION=SYMMETRICAL
  /PRINT=TABLE RPOINTS CPOINTS
  /PLOT=NDIM(1,MAX) BIPLOT(20).

TITLE "T15.4 Carte des marques par profil (AFC)".
CORRESPONDENCE TABLE=MARQUE_G(1,9) BY PROFIL4(1,4)
  /DIMENSIONS=2
  /MEASURE=CHISQ
  /STANDARDIZE=RCMEAN
  /NORMALIZATION=SYMMETRICAL
  /PRINT=TABLE RPOINTS CPOINTS
  /PLOT=NDIM(1,MAX) BIPLOT(20).
* Commenter seulement les axes qui expliquent une part notable de l'inertie.

TITLE "T15.5 Carte du marché (ACM)".
MULTIPLE CORRESPONDENCE VARIABLES=CATEG3 AGE3 LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF
  /ANALYSIS=CATEG3 AGE3 LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF
  /DIMENSION=2
  /NORMALIZATION=VPRINCIPAL
  /PRINT=CORR DISCRIM
  /PLOT=JOINTCAT DISCRIM.

* =========================================================================.
* PARTIE 16 - CHIFFRES CLÉS (BRUTS, IC 95 %, PAR MAILLON ET PAR VILLE).
* =========================================================================.
* Remplace le tableau pondéré CDC de la V3.3.
* A ÉCRIRE : "x % (IC 95 % : a - b), base n". Deux chiffres dont les IC se.
* chevauchent largement ne doivent pas être présentés comme différents.

DATASET ACTIVATE EDM_EE.
DATASET COPY KPI_LONG.
DATASET ACTIVATE KPI_LONG.
FILTER OFF.
SELECT IF (FILTRE_QUAL = 1).
VARSTOCASES
  /MAKE VALEUR FROM ONLIN_FERME ONLIN_POT DEJA_LIGNE SAV_OUI SAV_POT SAV_TRESIMP MARQ_TRESIMP
    CRIT_QUAL CRIT_PRIX PREF_EUROPE PREF_ASIE PREF_AUCUNE DILEMME HAUTGAMME CONTREF_SOUV DECU
    FIDELE ESPECES GARANT_1AN SURCOUT_10 CONTACT_WA MONT_100K HEBDO ACHAT_YAKI
  /INDEX=INDIC
  /KEEP=CATEG3 VILLEREG
  /NULL=DROP.
VALUE LABELS INDIC
  1 "Prêts à acheter en ligne (Oui)"
  2 "Ouverts à l'achat en ligne (Oui + Peut-être)"
  3 "Ont déjà acheté en ligne"
  4 "Paieraient plus pour un bon SAV (Oui)"
  5 "Paieraient plus pour un bon SAV (Oui + Peut-être)"
  6 "SAV jugé très important"
  7 "Marque jugée très importante"
  8 "Critère n°1 = qualité / durabilité"
  9 "Critère n°1 = prix"
  10 "Préfèrent l'origine Europe"
  11 "Préfèrent l'origine Asie"
  12 "Sans préférence d'origine"
  13 "Dilemme Europe-qualité / Asie-prix (avis exprimés)"
  14 "Achètent surtout du haut de gamme"
  15 "Craignent souvent la contrefaçon"
  16 "Déjà déçus par un achat"
  17 "Fidèles à leur fournisseur"
  18 "Paient surtout en espèces"
  19 "Attendent une garantie d'1 an et plus"
  20 "Acceptent plus de 10 % de surcoût"
  21 "Préfèrent WhatsApp pour le contact"
  22 "Achat moyen de 100 000 FCFA et plus"
  23 "Achètent chaque semaine"
  24 "Achètent surtout Yaki".
VARIABLE LABELS INDIC "Indicateur clé".
EXECUTE.

* 16.1 Ensemble des fiches retenues.
DATASET DECLARE KPI_TOT.
AGGREGATE /OUTFILE=KPI_TOT /BREAK=INDIC /P=MEAN(VALEUR) /N_BASE=N(VALEUR).
DATASET ACTIVATE KPI_TOT.
COMPUTE ERR = 1.96 * SQRT(P * (1 - P) / N_BASE).
COMPUTE IC_BAS = 100 * MAX(0, P - ERR).
COMPUTE IC_HAUT = 100 * MIN(1, P + ERR).
COMPUTE P = 100 * P.
VARIABLE LABELS P "%" /IC_BAS "IC 95 % bas" /IC_HAUT "IC 95 % haut" /N_BASE "Base (n)".
FORMATS P IC_BAS IC_HAUT (F5.1) N_BASE (F5.0).
SUMMARIZE /TABLES=INDIC P IC_BAS IC_HAUT N_BASE
  /FORMAT=LIST NOCASENUM NOTOTAL
  /TITLE="T16.1 Chiffres clés : ensemble (427 fiches, IC 95 %)"
  /MISSING=VARIABLE
  /CELLS=NONE.

* 16.2 Par maillon de la chaîne.
DATASET ACTIVATE KPI_LONG.
DATASET DECLARE KPI_MAIL.
AGGREGATE /OUTFILE=KPI_MAIL /BREAK=INDIC CATEG3 /P=MEAN(VALEUR) /NB=N(VALEUR).
DATASET ACTIVATE KPI_MAIL.
SELECT IF NOT MISSING(CATEG3).
FORMATS CATEG3 (F1.0).
COMPUTE P = 100 * P.
FORMATS P (F5.1) NB (F5.0).
EXECUTE.
SORT CASES BY INDIC CATEG3.
CASESTOVARS /ID=INDIC /INDEX=CATEG3 /SEPARATOR="_" /GROUPBY=VARIABLE.
VARIABLE LABELS P_1 "Utilisateurs finaux %" /P_2 "Prescripteurs %" /P_3 "Distributeurs %"
  /NB_1 "n Util." /NB_2 "n Prescr." /NB_3 "n Distrib.".
SUMMARIZE /TABLES=INDIC P_1 P_2 P_3 NB_1 NB_2 NB_3
  /FORMAT=LIST NOCASENUM NOTOTAL
  /TITLE="T16.2 Chiffres clés par maillon de la chaîne (%)"
  /MISSING=VARIABLE
  /CELLS=NONE.
* LECTURE : c'est LE tableau de synthèse du rapport. Un écart de moins de.
* 10 points avec n < 70 (prescripteurs : n=64) n'est pas interprétable.

* 16.3 Par ville.
DATASET ACTIVATE KPI_LONG.
DATASET DECLARE KPI_VILLE.
AGGREGATE /OUTFILE=KPI_VILLE /BREAK=INDIC VILLEREG /P=MEAN(VALEUR) /NB=N(VALEUR).
DATASET ACTIVATE KPI_VILLE.
SELECT IF NOT MISSING(VILLEREG).
FORMATS VILLEREG (F1.0).
COMPUTE P = 100 * P.
FORMATS P (F5.1) NB (F5.0).
EXECUTE.
SORT CASES BY INDIC VILLEREG.
CASESTOVARS /ID=INDIC /INDEX=VILLEREG /SEPARATOR="_" /GROUPBY=VARIABLE.
VARIABLE LABELS P_1 "Douala %" /P_2 "Yaoundé %" /P_3 "Bafoussam %"
  /NB_1 "n Douala" /NB_2 "n Yaoundé" /NB_3 "n Bafoussam".
SUMMARIZE /TABLES=INDIC P_1 P_2 P_3 NB_1 NB_2 NB_3
  /FORMAT=LIST NOCASENUM NOTOTAL
  /TITLE="T16.3 Chiffres clés par ville (%)"
  /MISSING=VARIABLE
  /CELLS=NONE.

DATASET ACTIVATE EDM_EE.
DATASET CLOSE KPI_LONG.
DATASET CLOSE KPI_TOT.
DATASET CLOSE KPI_MAIL.
DATASET CLOSE KPI_VILLE.
FILTER BY FILTRE_QUAL.

* =========================================================================.
* PARTIE 17 - CONTRÔLES FINAUX ET SAUVEGARDE.
* =========================================================================.

TITLE "T17.1 Contrôle final des variables d'analyse".
FREQUENCIES VARIABLES=CATEG3 PROFIL4 AGE3 MARQUE_G ORIG_MARQ LEVFIDEL SEGMENT ONLIN_FERME SAV_POT DILEMME /FORMAT=NOTABLE.
DESCRIPTIVES VARIABLES=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV DEPENSE_AN
  /STATISTICS=MEAN STDDEV MIN MAX.
* Attendu : 427 fiches (N valide maximal). Les indices restent entre 0 et 100.

FILTER OFF.
SAVE OUTFILE='SPSS_EDM_EE_ANALYSE_V4.sav' /COMPRESSED.

* EXPORT VERS WORD / EXCEL (facultatif) : retirer l'astérisque des 3 lignes.
* suivantes. Sinon : Fichier > Exporter dans la fenêtre de résultats.
* OUTPUT EXPORT /CONTENTS EXPORT=VISIBLE LAYERS=PRINTSETTING MODELVIEWS=PRINTSETTING.
*   /DOC DOCUMENTFILE='EDM_EE_RESULTATS_V4.docx'.
*   /XLSX DOCUMENTFILE='EDM_EE_RESULTATS_V4.xlsx'.

* FIN DE LA SYNTAXE.
