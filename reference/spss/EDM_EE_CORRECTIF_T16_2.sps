* Encoding: UTF-8.
* =========================================================================.
* CORRECTIF T16.2 - Chiffres clés par profil (à exécuter SEUL).
* PRÉREQUIS : le fichier de données de la V3.2 est encore ouvert dans SPSS.
* (variables WT, PROFIL4, VILLEREG et indicateurs ONLIN_FERME... déjà créés).
* Si SPSS a été fermé entre-temps : rouvrir SPSS_EDM_EE_ANALYSE_V3.sav.
* (sauvegardé en fin de V3.2) ou réexécuter les parties 0 à 2 de la V3.3.
* Menu : Exécuter > Tout (ce fichier seulement).
* =========================================================================.
DATASET NAME EDM_EE WINDOW=FRONT.
WEIGHT OFF.
DATASET ACTIVATE EDM_EE.
DATASET COPY KPI_LONG.
DATASET ACTIVATE KPI_LONG.
VARSTOCASES
  /MAKE VALEUR FROM ONLIN_FERME ONLIN_POT DEJA_LIGNE SAV_OUI SAV_POT SAV_TRESIMP MARQ_TRESIMP
    CRIT_QUAL CRIT_PRIX PREF_EUROPE PREF_ASIE PREF_AUCUNE DILEMME HAUTGAMME CONTREF_SOUV DECU
    FIDELE ESPECES GARANT_1AN SURCOUT_10 CONTACT_WA MONT_100K HEBDO
  /INDEX=INDIC
  /KEEP=WT PROFIL4 VILLEREG
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
  13 "Dilemme Europe-qualité / Asie-prix"
  14 "Achètent surtout du haut de gamme"
  15 "Craignent souvent la contrefaçon"
  16 "Déjà déçus par un achat"
  17 "Fidèles à leur fournisseur"
  18 "Paient surtout en espèces"
  19 "Attendent une garantie d'1 an et plus"
  20 "Acceptent plus de 10 % de surcoût"
  21 "Préfèrent WhatsApp pour le contact"
  22 "Achat moyen de 100 000 FCFA et plus"
  23 "Achètent chaque semaine".
VARIABLE LABELS INDIC "Indicateur clé".
COMPUTE VALW = VALEUR * WT.
COMPUTE WT2 = WT * WT.
EXECUTE.

* 16.2 Par profil (% pondérés par la ville à l'intérieur de chaque profil).
DATASET ACTIVATE KPI_LONG.
DATASET DECLARE KPI_PROF.
AGGREGATE /OUTFILE=KPI_PROF /BREAK=INDIC PROFIL4 /SW=SUM(WT) /SVW=SUM(VALW) /NB=N(VALEUR).
DATASET ACTIVATE KPI_PROF.
SELECT IF NOT MISSING(PROFIL4).
FORMATS PROFIL4 (F1.0).
COMPUTE P = 100 * SVW / SW.
FORMATS P (F5.1) NB (F5.0).
EXECUTE.
DELETE VARIABLES SW SVW.
SORT CASES BY INDIC PROFIL4.
CASESTOVARS /ID=INDIC /INDEX=PROFIL4 /SEPARATOR="_" /GROUPBY=VARIABLE.
VARIABLE LABELS P_1 "Particuliers %" /P_2 "Entreprises %" /P_3 "Artisans %" /P_4 "Revendeurs %"
  /NB_1 "n Part." /NB_2 "n Entr." /NB_3 "n Artis." /NB_4 "n Revend.".
SUMMARIZE /TABLES=INDIC P_1 P_2 P_3 P_4 NB_1 NB_2 NB_3 NB_4
  /FORMAT=LIST NOCASENUM NOTOTAL
  /TITLE="T16.2 Chiffres clés par profil de répondant (%)"
  /MISSING=VARIABLE
  /CELLS=NONE.
* LECTURE : comparer les colonnes. Un écart de moins de 10 points entre deux.
* profils dont l'un a n < 60 n'est pas interprétable.

DATASET ACTIVATE EDM_EE.
DATASET CLOSE KPI_LONG.
DATASET CLOSE KPI_PROF.
