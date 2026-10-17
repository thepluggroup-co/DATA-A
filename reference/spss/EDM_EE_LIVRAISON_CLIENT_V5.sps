* Encoding: UTF-8.
* =========================================================================.
* ÉTUDE DE MARCHÉ - MATÉRIEL ET ÉQUIPEMENTS ÉLECTRIQUES (Douala, Yaoundé, Bafoussam).
* SYNTAXE DE MISE EN FORME DE LA BASE DE LIVRAISON CLIENT - VERSION 5.
* Fichier d'entrée  : SPSS EDM EE 04.sav (145 variables, 446 fiches).
* Fichier de sortie : SPSS_EDM_EE_V5_CLIENT.sav (à enregistrer, voir fin).
* =========================================================================.
*.
* MODE D'EMPLOI (3 gestes).
* 1. Ouvrir SPSS EDM EE 04.sav (il doit être la base active).
* 2. Ouvrir cette syntaxe, menu Exécuter > Tout.
* 3. Fichier > Enregistrer sous : SPSS_EDM_EE_V5_CLIENT.sav.
* Aucune commande CD, GET FILE ni SAVE : rien ne peut échouer sur un chemin.
*.
* CE QUE FAIT CETTE SYNTAXE (réponse aux retours client du 12/10/2026).
* 1. Les variables 1 à 56 (le questionnaire) restent en tête, dans leur ordre,
*    sans aucune donnée modifiée.
* 2. Les variables 57 et suivantes étaient des variables CALCULÉES, empilées par
*    trois syntaxes successives sans nettoyage (145 variables au total).
*    On supprime 21 variables obsolètes ou en double :
*    - REVMEN_R remplacée par REVMEN_P (revenu des seuls particuliers) ;
*    - MEQUA_SA MEILP_SA ORHG_SA ORBG_SA : copies de Q15, Q16, Q21, Q22
*      (même contenu que les variables d'origine) ;
*    - YAKI (sans libellé, comptait les non-réponses comme des "non")
*      remplacée par ACHAT_YAKI ;
*    - SEGMENT (ancienne typologie, non retenue) remplacée par SEG_TS ;
*    - QUAL_FICHE (seuil 80 %) remplacée par FILTRE_QUAL (seuil 70 %
*      + copies écartées), qui est le filtre réellement utilisé ;
*    - LIEU_ACT : copie de Q7 ;
*    - CIBLE N_CASE N_TOT W WT MWT WT2 SW SW2 NBRUT NEFF DEFF : calculs de
*      pondération abandonnés (aucune analyse livrée n'est pondérée).
* 3. Les variables calculées conservées sont regroupées par bloc, et leur
*    libellé suit une règle unique :
*    "Qxx." en tête = question du questionnaire (variables 1 à 56) ;
*    "[C]" en tête  = variable de contrôle qualité ;
*    "[D]" en tête  = variable dérivée, avec sa question source en fin de libellé.
*    Plus aucune variable sans libellé.
* 4. Formats : plus de décimales sur les codes (1 et non 1,00). Les décimales
*    ne restent que sur les vraies mesures (taux, indices, pourcentages).
* 5. Q5 (REVMENME) : le libellé 97 "Non applicable" est retiré (aucune fiche
*    ne porte ce code). 98 = NSP (case "NSP" du questionnaire, 39 fiches) et
*    99 = non-réponse (112 fiches) restent déclarés manquants.
* =========================================================================.

TITLE "V5 - Mise en forme de la base de livraison client".

* -------------------------------------------------------------------------.
* PARTIE 1 - SUPPRESSION DES VARIABLES OBSOLÈTES OU EN DOUBLE.
* -------------------------------------------------------------------------.
DELETE VARIABLES
REVMEN_R MEQUA_SA MEILP_SA ORHG_SA ORBG_SA YAKI SEGMENT QUAL_FICHE LIEU_ACT
  CIBLE N_CASE N_TOT W WT MWT WT2 SW SW2 NBRUT NEFF DEFF.

* -------------------------------------------------------------------------.
* PARTIE 2 - QUESTION Q5 : CODE 97 SANS OBJET.
* -------------------------------------------------------------------------.
VALUE LABELS REVMENME 1 "Moins de 100 000" 2 "100 000 - 250 000" 3 "250 000 - 500 000"
  4 "500 000 - 1 M" 5 "Plus de 1 M" 98 "NSP" 99 "NR".
MISSING VALUES REVMENME (98, 99).
VARIABLE LABELS REVMENME "Q5. Revenu mensuel du ménage (FCFA)"
  /MAACAUTR "Q12. Autre marque, texte libre (limité à 8 caractères à l'import)".

* -------------------------------------------------------------------------.
* PARTIE 3 - LIBELLÉS DES VARIABLES CALCULÉES (règle [C] / [D]).
* -------------------------------------------------------------------------.
VARIABLE LABELS
  ID_CASE "[C] N° de ligne de la fiche dans la base d'origine"
  /FILTRE_QUAL "[C] Fiche retenue pour l'analyse (remplie à 70 % et plus, hors copies)"
  /DOUBLON_SUSP "[C] Fiche quasi identique à une autre"
  /TX_REMPL "[C] Taux de remplissage de la fiche (%)"
  /NB_NR "[C] Nombre de questions sans réponse (sur 44)"
  /BLOC_WEB_VIDE "[C] Bloc achat en ligne Q37 à Q39 entièrement vide"
  /NB_LEV "[C] Nombre de leviers cochés à Q41 (contrôle : 1 seul par fiche)"
  /PROFIL4 "[D] Profil en 4 groupes, PME et BTP fusionnés (source Q1)"
  /CATEG3 "[D] Maillon : utilisateurs, prescripteurs, distributeurs (source Q1)"
  /AGE3 "[D] Âge en 3 classes (source Q3)"
  /REVMEN_P "[D] Revenu du ménage, particuliers uniquement (source Q5)"
  /MARQUE_G "[D] Marque achetée, liste + texte libre recodé (source Q12)"
  /MARQ_AC "[D] Marque achetée, regroupée en 6 postes (source Q12)"
  /ORIG_MARQ "[D] Origine de la marque achetée (source Q12)"
  /ACHAT_YAKI "[D] Achète surtout la marque Yaki (source Q12)"
  /MARQ_TRESIMP "[D] Marque jugée très importante (source Q11)"
  /CRIT_QUAL "[D] Critère n°1 = qualité / durabilité (source Q13)"
  /CRIT_PRIX "[D] Critère n°1 = prix (source Q13)"
  /PREF_EUROPE "[D] Préfère l'origine Europe (source Q14)"
  /PREF_ASIE "[D] Préfère l'origine Asie (source Q14)"
  /PREF_AUCUNE "[D] Aucune préférence d'origine (source Q14)"
  /MEQUA_AV "[D] Origine meilleure en qualité, avis exprimés seulement (source Q15)"
  /MEILP_AV "[D] Origine meilleure en prix, avis exprimés seulement (source Q16)"
  /DILEMME "[D] Europe = qualité ET Asie = prix, avis exprimés (sources Q15, Q16)"
  /ORHG_AV "[D] Origine du haut de gamme, avis exprimés seulement (source Q21)"
  /ORBG_AV "[D] Origine du bas de gamme, avis exprimés seulement (source Q22)"
  /HEBDO "[D] Achète chaque semaine (source Q6)"
  /MONT_100K "[D] Achat moyen de 100 000 FCFA ou plus (source Q8)"
  /ESPECES "[D] Paie principalement en espèces (source Q10)"
  /HAUTGAMME "[D] Achète surtout du haut de gamme (source Q18)"
  /SURCOUT_10 "[D] Accepte plus de 10 % de surcoût pour monter en gamme (source Q26)"
  /CONTREF_SOUV "[D] Craint souvent la contrefaçon (source Q28)"
  /DECU "[D] Déjà déçu par un achat (source Q29)"
  /SAV_TRESIMP "[D] SAV jugé très important (source Q30)"
  /GARANT_1AN "[D] Attend une garantie d'au moins 1 an (source Q32)"
  /CONTACT_WA "[D] Préfère WhatsApp pour le contact (source Q33)"
  /SAV_OUI "[D] Paierait plus pour un bon SAV : oui (source Q34)"
  /SAV_POT "[D] Paierait plus pour un bon SAV : oui + peut-être (source Q34)"
  /MEME_CANAL "[D] Canal souhaité = canal actuel (sources Q7, Q35)"
  /DEJA_LIGNE "[D] A déjà acheté en ligne (source Q37)"
  /ONLIN_FERME "[D] Prêt à acheter en ligne : oui (source Q38)"
  /ONLIN_POT "[D] Prêt à acheter en ligne : oui + peut-être (source Q38)"
  /FIDELE "[D] Fidèle (toujours / souvent) au fournisseur (source Q40)"
  /LEVFIDEL "[D] Principal levier de fidélité, réponse unique (source Q41)"
  /S_FREQ "[D] Score fréquence d'achat, 1 à 4 (source Q6)"
  /S_MARQUE "[D] Score importance de la marque, 1 à 4 (source Q11)"
  /S_ORIGINE "[D] Score influence de l'origine, 1 à 4 (source Q17)"
  /S_ECART "[D] Score écart de qualité haut / bas de gamme, 1 à 5 (source Q24)"
  /S_CONTREF "[D] Score crainte de la contrefaçon, 1 à 4 (source Q28)"
  /S_DECEP "[D] Score déception passée, 1 à 3 (source Q29)"
  /S_SAV "[D] Score importance du SAV, 1 à 4 (source Q30)"
  /S_PAYSAV "[D] Score disposition à payer le SAV, 1 à 3 (source Q34)"
  /S_ONLINE "[D] Score disposition à acheter en ligne, 1 à 3 (source Q38)"
  /S_FIDEL "[D] Score fidélité au fournisseur, 1 à 5 (source Q40)"
  /IDX_MARQUE "[D] Indice d'attachement à la marque, 0-100 (source Q11)"
  /IDX_ORIGINE "[D] Indice de sensibilité à l'origine, 0-100 (source Q17)"
  /IDX_CONTREF "[D] Indice de crainte de la contrefaçon, 0-100 (source Q28)"
  /IDX_DECEP "[D] Indice de déception passée, 0-100 (source Q29)"
  /IDX_SAV "[D] Indice d'exigence SAV, 0-100 (source Q30)"
  /IDX_PAYSAV "[D] Indice de disposition à payer le SAV, 0-100 (source Q34)"
  /IDX_ONLINE "[D] Indice d'appétence achat en ligne, 0-100 (source Q38)"
  /IDX_FIDEL "[D] Indice de fidélité au fournisseur, 0-100 (source Q40)"
  /MONTANT_FCFA "[D] Montant estimé par achat, FCFA, point milieu (source Q8)"
  /ACHATS_AN "[D] Nombre estimé d'achats par an (source Q6)"
  /DEPENSE_AN "[D] Dépense annuelle estimée, FCFA (sources Q6 x Q8)"
  /SURCOUT_PCT "[D] Surcoût accepté, %, point milieu (source Q26)"
  /GARANTIE_MOIS "[D] Garantie attendue, mois, point milieu (source Q32)"
  /SEG_TS "[D] Groupe d'acheteurs, typologie TwoStep à 4 groupes".

VALUE LABELS SEG_TS 1 "Groupe 1" 2 "Groupe 2" 3 "Groupe 3" 4 "Groupe 4".
* Les 4 groupes restent à NOMMER d'après leur portrait (partie N3 de N05).

* -------------------------------------------------------------------------.
* PARTIE 4 - FORMATS D'AFFICHAGE (plus de décimales sur les codes).
* -------------------------------------------------------------------------.
FORMATS
  ID_CASE (F4.0).
FORMATS
  FILTRE_QUAL DOUBLON_SUSP BLOC_WEB_VIDE ACHAT_YAKI MARQ_TRESIMP CRIT_QUAL
  CRIT_PRIX PREF_EUROPE PREF_ASIE PREF_AUCUNE DILEMME HEBDO MONT_100K ESPECES
  HAUTGAMME SURCOUT_10 CONTREF_SOUV DECU SAV_TRESIMP GARANT_1AN CONTACT_WA
  SAV_OUI SAV_POT MEME_CANAL DEJA_LIGNE ONLIN_FERME ONLIN_POT FIDELE S_FREQ
  S_MARQUE S_ORIGINE S_ECART S_CONTREF S_DECEP S_SAV S_PAYSAV S_ONLINE
  S_FIDEL SEG_TS (F1.0).
FORMATS
  TX_REMPL IDX_MARQUE IDX_ORIGINE IDX_CONTREF IDX_DECEP IDX_SAV IDX_PAYSAV
  IDX_ONLINE IDX_FIDEL SURCOUT_PCT (F5.1).
FORMATS
  NB_NR ACHATS_AN GARANTIE_MOIS (F3.0).
FORMATS
  NB_LEV PROFIL4 CATEG3 AGE3 REVMEN_P MARQUE_G MARQ_AC ORIG_MARQ MEQUA_AV
  MEILP_AV ORHG_AV ORBG_AV LEVFIDEL (F2.0).
FORMATS
  MONTANT_FCFA DEPENSE_AN (COMMA12.0).

* -------------------------------------------------------------------------.
* PARTIE 5 - ORDRE DES VARIABLES : questionnaire (1 à 56), puis blocs.
* -------------------------------------------------------------------------.
* BLOC C - CONTRÔLE QUALITÉ ET IDENTIFIANT TECHNIQUE : ID_CASE FILTRE_QUAL DOUBLON_SUSP TX_REMPL NB_NR BLOC_WEB_VIDE NB_LEV.
* BLOC D1 - REGROUPEMENTS DE PROFIL : PROFIL4 CATEG3 AGE3 REVMEN_P.
* BLOC D2 - MARQUES ET ORIGINES : MARQUE_G MARQ_AC ORIG_MARQ ACHAT_YAKI MARQ_TRESIMP CRIT_QUAL CRIT_PRIX PREF_EUROPE PREF_ASIE PREF_AUCUNE MEQUA_AV MEILP_AV DILEMME ORHG_AV ORBG_AV.
* BLOC D3 - INDICATEURS OUI / NON (moyenne = pourcentage) : HEBDO MONT_100K ESPECES HAUTGAMME SURCOUT_10 CONTREF_SOUV DECU SAV_TRESIMP GARANT_1AN CONTACT_WA SAV_OUI SAV_POT MEME_CANAL DEJA_LIGNE ONLIN_FERME ONLIN_POT FIDELE LEVFIDEL.
* BLOC D4 - SCORES ORIENTÉS (plus c'est élevé, plus l'attitude est forte) : S_FREQ S_MARQUE S_ORIGINE S_ECART S_CONTREF S_DECEP S_SAV S_PAYSAV S_ONLINE S_FIDEL.
* BLOC D5 - INDICES 0 À 100 : IDX_MARQUE IDX_ORIGINE IDX_CONTREF IDX_DECEP IDX_SAV IDX_PAYSAV IDX_ONLINE IDX_FIDEL.
* BLOC D6 - ESTIMATIONS EN POINTS MILIEUX DE TRANCHES (hypothèses) : MONTANT_FCFA ACHATS_AN DEPENSE_AN SURCOUT_PCT GARANTIE_MOIS.
* BLOC D7 - TYPOLOGIE : SEG_TS.
ADD FILES FILE=* /KEEP=
  ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA LIEACHPR
  MONMOYAC PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU PAIEPRIV
  IMPOMARQ MAACPLSO MAACAUTR PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH
  GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA PXMOYEGA PXBASGAM
  ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC IMSECSAV SEATPRIO
  DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI
  FIMEFOUR RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE
  ID_CASE FILTRE_QUAL DOUBLON_SUSP TX_REMPL NB_NR BLOC_WEB_VIDE NB_LEV
  PROFIL4 CATEG3 AGE3 REVMEN_P MARQUE_G MARQ_AC ORIG_MARQ ACHAT_YAKI
  MARQ_TRESIMP CRIT_QUAL CRIT_PRIX PREF_EUROPE PREF_ASIE PREF_AUCUNE MEQUA_AV
  MEILP_AV DILEMME ORHG_AV ORBG_AV HEBDO MONT_100K ESPECES HAUTGAMME
  SURCOUT_10 CONTREF_SOUV DECU SAV_TRESIMP GARANT_1AN CONTACT_WA SAV_OUI
  SAV_POT MEME_CANAL DEJA_LIGNE ONLIN_FERME ONLIN_POT FIDELE LEVFIDEL S_FREQ
  S_MARQUE S_ORIGINE S_ECART S_CONTREF S_DECEP S_SAV S_PAYSAV S_ONLINE
  S_FIDEL IDX_MARQUE IDX_ORIGINE IDX_CONTREF IDX_DECEP IDX_SAV IDX_PAYSAV
  IDX_ONLINE IDX_FIDEL MONTANT_FCFA ACHATS_AN DEPENSE_AN SURCOUT_PCT
  GARANTIE_MOIS SEG_TS.
EXECUTE.

* -------------------------------------------------------------------------.
* PARTIE 6 - CONTRÔLES (à lire dans la fenêtre de résultats).
* -------------------------------------------------------------------------.
TITLE "V5 - Contrôle : 446 fiches, 427 retenues".
FREQUENCIES VARIABLES=FILTRE_QUAL REVMENME.
* Attendu : FILTRE_QUAL Retenue 427 / Écartée 19 ; REVMENME 98 = 39 et 99 = 112.
DISPLAY DICTIONARY.
* Attendu : 124 variables, toutes avec un libellé.

* ÉTAPE FINALE : Fichier > Enregistrer sous > SPSS_EDM_EE_V5_CLIENT.sav.
* FIN.
