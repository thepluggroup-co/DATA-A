* Encoding: UTF-8.
* =========================================================================.
* ÉTUDE DE MARCHÉ - MATÉRIEL ET ÉQUIPEMENTS ÉLECTRIQUES (Douala, Yaoundé, Bafoussam).
* SYNTAXE DE RECONFIGURATION DU FICHIER SPSS - VERSION 4.
* Fichier d'entrée  : SPSS_EDM_EE.sav  (446 fiches, 56 variables, ordre d'origine).
* Fichier de sortie : SPSS_EDM_EE_V4.sav (dictionnaire corrigé + variables de contrôle).
* =========================================================================.
*.
* UTILISATION.
* 1. Modifier UNE SEULE ligne : le dossier dans la commande CD ci-dessous.
* 2. Menu Exécuter > Tout.
* 3. Lire la PARTIE 9 (contrôles) dans la fenêtre de résultats.
* 4. Toutes les analyses se font ensuite sur SPSS_EDM_EE_V4.sav.
*.
* IMPORTANT : exécuter ce script sur le fichier D'ORIGINE, NON TRIÉ.
* Les fiches suspectes (partie 7) sont repérées par leur rang d'origine (ID_CASE).
*.
* CE QUE CORRIGE CE SCRIPT (diagnostic du 11/10/2026).
* A. Valeurs manquantes : 99 (NR) n'était déclaré manquant QUE pour ACCRECON.
*    Partout ailleurs, 99 était compté comme une réponse : % faux, moyennes.
*    absurdes (âge moyen = 5,35 au lieu de 2,76 ; revenu moyen = 34,8).
* B. Codes sans libellé : 0 dans les 13 variables à réponses multiples.
*    (libellé 2 = Non, alors que la donnée vaut 0) ; 98 dans REVMENME,.
*    MEQUAFIA, MEILPRIX, ORASHAGA, ORASBAGA (libellé 4 ou 6, donnée 98) ;.
*    5 (> 1 M) sans libellé dans REVMENME.
* C. Niveaux de mesure inversés : PRFRACLI (ordinal -> nominal),.
*    FIMEFOUR et PRETACLI (nominal -> ordinal).
* D. Rôles parasites (IMPOMARQ et PRETACLI en Cible, MAACAUTR en Aucun).
* E. Aucun ensemble à réponses multiples défini.
* F. Q41 (leviers de fidélité) : prévue en réponses multiples, mais CHAQUE.
*    fiche a exactement 1 levier coché (429 fiches sur 429 valides).
*    La donnée est en réalité à réponse UNIQUE : elle est convertie en une.
*    variable unique LEVFIDEL. Ne PAS l'analyser en réponses multiples.
* G. MAACAUTR est en A8 : le texte saisi est TRONQUÉ à 8 caractères.
*    Ce qui est perdu ne peut pas être récupéré dans SPSS (ré-importer depuis.
*    le Google Sheet si le texte complet est nécessaire). Le recodage de la.
*    partie 5 exploite ce qui reste (Yaki = 2e marque, Schneider saisi en Autre...).
* H. Fiches à contrôler : 15 fiches de Yaoundé quasi identiques entre elles.
*    (1 à 6 réponses différentes sur 53) et 11 fiches remplies à moins de 70 %.
* I. Fautes de libellés (Partuculier, Quincallerie, 5=Absence de garantie...).
* =========================================================================.

* -------------------------------------------------------------------------.
* PARTIE 0 - OUVERTURE (seule ligne à modifier : le chemin du dossier).
* -------------------------------------------------------------------------.
CD 'C:\EDM_EE'.
GET FILE='SPSS_EDM_EE.sav'.
DATASET NAME EDM_V4 WINDOW=FRONT.

* Rang d'origine de chaque fiche (avant tout tri) : identifiant technique.
COMPUTE ID_CASE = $CASENUM.
FORMATS ID_CASE (F4.0).
VARIABLE LABELS ID_CASE "N° de ligne dans le fichier d'origine (identifiant technique)".
EXECUTE.

* -------------------------------------------------------------------------.
* PARTIE 1 - CORRECTION DES CODES DANS LES DONNÉES.
* -------------------------------------------------------------------------.
* 1.1 Q9 et Q41 : le code 0 = "non cité" (déjà en 0 dans la donnée, rien à changer).
* 1.2 Origines Q15, Q16, Q21, Q22 : "Sans avis" est saisi 98 (le libellé 4 n'a.
*     jamais été utilisé). On garde 98 = Sans avis. Rien à recoder.
* 1.3 REVMENME : 5 = "> 1 M" (6 fiches), 98 = NSP (39 fiches). Rien à recoder.
* 1.4 MAACAUTR : élargi pour une future ré-importation du texte complet.
ALTER TYPE MAACAUTR (A100).

* Formats d'affichage compacts.
FORMATS ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA LIEACHPR MONMOYAC
  PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU PAIEPRIV IMPOMARQ MAACPLSO
  PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA
  PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC
  IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI FIMEFOUR
  RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE (F2.0).

* -------------------------------------------------------------------------.
* PARTIE 2 - LIBELLÉS DES VARIABLES (numérotation du questionnaire 03).
* -------------------------------------------------------------------------.
VARIABLE LABELS
  ACCRECON "Accepte d'être recontacté à des fins commerciales"
  /VOUSETES "Q1. Profil du répondant"
  /SEXMAFEM "Q2. Genre"
  /AGEREPON "Q3. Classe d'âge"
  /VILLEREG "Q4. Ville d'enquête"
  /REVMENME "Q5. Revenu mensuel du ménage (FCFA) - posée à tous"
  /FREQACHA "Q6. Fréquence d'achat de matériel électrique"
  /LIEACHPR "Q7. Lieu d'achat principal (actuel)"
  /MONMOYAC "Q8. Montant moyen par achat (FCFA)"
  /PRACCABL "Q9. Achète : câbles / fils"
  /PRACAPPA "Q9. Achète : appareillage / disjoncteurs"
  /PRACPRIS "Q9. Achète : prises / interrupteurs"
  /PRACLUMI "Q9. Achète : luminaires"
  /PRACSOLA "Q9. Achète : solaire / onduleurs"
  /PRACGROU "Q9. Achète : groupes électrogènes"
  /PAIEPRIV "Q10. Mode de paiement privilégié"
  /IMPOMARQ "Q11. Importance de la marque"
  /MAACPLSO "Q12. Marque achetée le plus souvent (liste du questionnaire)"
  /MAACAUTR "Q12. Autre marque (texte TRONQUÉ à 8 caractères à l'import)"
  /PRCRICHO "Q13. Principal critère de choix"
  /ORIGPRIV "Q14. Origine privilégiée"
  /MEQUAFIA "Q15. Origine jugée la meilleure en qualité / fiabilité"
  /MEILPRIX "Q16. Origine jugée la meilleure en prix"
  /ORINFACH "Q17. Influence de l'origine sur l'achat"
  /GAACPLSO "Q18. Gamme achetée le plus souvent"
  /DEAVHAGA "Q19. Ce qui définit avant tout le HAUT de gamme"
  /CAAVBAGA "Q20. Ce qui caractérise avant tout le BAS de gamme"
  /ORASHAGA "Q21. Origine associée au HAUT de gamme"
  /ORASBAGA "Q22. Origine associée au BAS de gamme"
  /PXHAUTGA "Q23a. Prix associé au HAUT de gamme (article courant, ex. disjoncteur)"
  /PXMOYEGA "Q23b. Prix associé à la MOYENNE gamme (article courant)"
  /PXBASGAM "Q23c. Prix associé au BAS de gamme (article courant)"
  /ECQUHABA "Q24. Écart de qualité perçu entre haut et bas de gamme"
  /PRIOPRIN "Q25. Priorité principale à l'achat"
  /SUACMOGA "Q26. Surcoût accepté pour monter en gamme"
  /PRINFREI "Q27. Principal frein à l'achat"
  /CRACPRCO "Q28. Crainte d'acheter un produit contrefait / non conforme"
  /DEJDECAC "Q29. Déjà déçu par un achat"
  /IMSECSAV "Q30. Importance du service client et du SAV"
  /SEATPRIO "Q31. Service attendu en priorité"
  /DUGAJUAC "Q32. Durée de garantie jugée acceptable"
  /CACOPREF "Q33. Canal de contact préféré"
  /BOSAPACH "Q34. Un bon SAV justifierait de payer plus cher"
  /CANAPREF "Q35. Canal d'achat préféré (souhaité)"
  /CRCHCANA "Q36. Critère de choix du canal"
  /DEJACHLI "Q37. Déjà acheté en ligne"
  /PRETACLI "Q38. Prêt à acheter en ligne"
  /PRFRACLI "Q39. Principal frein à l'achat en ligne"
  /FIMEFOUR "Q40. Fidélité à un même fournisseur"
  /RFIDPRIX "Q41. Levier de fidélité : prix / promotions (1 seul levier saisi)"
  /RFIDQUAL "Q41. Levier de fidélité : qualité constante (1 seul levier saisi)"
  /RFIDSTOC "Q41. Levier de fidélité : disponibilité du stock (1 seul levier saisi)"
  /RFIDCONS "Q41. Levier de fidélité : bon conseil (1 seul levier saisi)"
  /RFIDSAVF "Q41. Levier de fidélité : SAV fiable (1 seul levier saisi)"
  /RFIDPROG "Q41. Levier de fidélité : programme de fidélité (1 seul levier saisi)"
  /RFIDPAIE "Q41. Levier de fidélité : facilités de paiement (1 seul levier saisi)".

* -------------------------------------------------------------------------.
* PARTIE 3 - LIBELLÉS DES MODALITÉS (réécrits en entier).
* -------------------------------------------------------------------------.
VALUE LABELS ACCRECON 1 "Oui" 2 "Non" 99 "NR".
VALUE LABELS VOUSETES 1 "Particulier" 2 "Entreprise (PME, industrie)" 3 "Électricien / artisan" 4 "Entreprise BTP" 5 "Revendeur / grossiste / distributeur" 99 "NR".
VALUE LABELS SEXMAFEM 1 "Homme" 2 "Femme" 99 "NR".
VALUE LABELS AGEREPON 1 "Moins de 25 ans" 2 "25-34 ans" 3 "35-44 ans" 4 "45-54 ans" 5 "55 ans et plus" 99 "NR".
VALUE LABELS VILLEREG 1 "Douala" 2 "Yaoundé" 3 "Bafoussam" 99 "NR".
VALUE LABELS REVMENME 1 "Moins de 100 000" 2 "100 000 - 250 000" 3 "250 000 - 500 000" 4 "500 000 - 1 M" 5 "Plus de 1 M" 97 "Non applicable" 98 "NSP" 99 "NR".
VALUE LABELS FREQACHA 1 "Chaque semaine" 2 "1 à 3 fois par mois" 3 "Quelques fois par an" 4 "Rarement" 99 "NR".
VALUE LABELS LIEACHPR CANAPREF 1 "Quincaillerie" 2 "Grossiste spécialisé" 3 "Magasin spécialisé" 4 "Marché" 5 "Importateur" 6 "En ligne" 99 "NR".
VALUE LABELS MONMOYAC 1 "Moins de 25 000" 2 "25 000 - 100 000" 3 "100 000 - 500 000" 4 "500 000 - 2 M" 5 "Plus de 2 M" 99 "NR".
VALUE LABELS PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU
  RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE 0 "Non cité" 1 "Cité" 99 "NR".
VALUE LABELS PAIEPRIV 1 "Espèces" 2 "Mobile Money" 3 "Virement" 4 "Crédit fournisseur" 99 "NR".
VALUE LABELS IMPOMARQ IMSECSAV 1 "Très importante" 2 "Importante" 3 "Peu importante" 4 "Pas importante" 99 "NR".
VALUE LABELS MAACPLSO 1 "Schneider" 2 "Legrand" 3 "Vectron" 4 "Hager" 5 "ABB" 6 "Siemens" 7 "Chint / chinoise" 8 "Philips" 9 "JA Solar" 10 "Longi" 11 "Growatt" 12 "Autre (voir MAACAUTR)" 99 "NR".
VALUE LABELS PRCRICHO 1 "Prix" 2 "Qualité / durabilité" 3 "Disponibilité" 4 "Notoriété" 5 "Garantie / SAV" 6 "Conformité aux normes" 99 "NR".
VALUE LABELS ORIGPRIV 1 "Europe" 2 "Asie" 3 "Amérique" 4 "Aucune préférence" 99 "NR".
VALUE LABELS MEQUAFIA MEILPRIX ORASHAGA ORASBAGA 1 "Europe" 2 "Asie" 3 "Amérique" 98 "Sans avis" 99 "NR".
VALUE LABELS ORINFACH 1 "Fortement" 2 "Modérément" 3 "Faiblement" 4 "Pas du tout" 99 "NR".
VALUE LABELS GAACPLSO 1 "Haut de gamme" 2 "Moyenne gamme" 3 "Bas de gamme" 4 "Selon le projet" 99 "NR".
VALUE LABELS DEAVHAGA 1 "Un prix élevé" 2 "Une marque reconnue" 3 "La durabilité / fiabilité" 4 "L'origine" 5 "Certifications / conformité aux normes" 6 "Une garantie longue" 99 "NR".
VALUE LABELS CAAVBAGA 1 "Un prix bas" 2 "Une origine asiatique générique" 3 "L'absence de marque connue" 4 "Une durée de vie courte" 5 "L'absence de garantie" 6 "Un risque de non-conformité" 99 "NR".
VALUE LABELS PXHAUTGA PXMOYEGA PXBASGAM 1 "Moins de 5 000 FCFA" 2 "5 000 - 15 000 FCFA" 3 "15 000 - 40 000 FCFA" 4 "Plus de 40 000 FCFA" 99 "NR".
VALUE LABELS ECQUHABA 1 "Très important" 2 "Important" 3 "Modéré" 4 "Faible" 5 "Inexistant" 99 "NR".
VALUE LABELS PRIOPRIN 1 "Le moins cher" 2 "Meilleur rapport qualité / prix" 3 "Meilleure qualité quel que soit le prix" 99 "NR".
VALUE LABELS SUACMOGA 1 "Aucun surcoût" 2 "Jusqu'à +10 %" 3 "+10 à +25 %" 4 "+25 à +50 %" 5 "Plus de +50 %" 99 "NR".
VALUE LABELS PRINFREI 1 "Prix élevé" 2 "Doute qualité / contrefaçon" 3 "Indisponibilité" 4 "Manque de conseil" 5 "Absence de garantie" 6 "Délais de livraison" 99 "NR".
VALUE LABELS CRACPRCO 1 "Souvent" 2 "Parfois" 3 "Rarement" 4 "Jamais" 99 "NR".
VALUE LABELS DEJDECAC 1 "Oui, plusieurs fois" 2 "Oui, une fois" 3 "Non" 99 "NR".
VALUE LABELS SEATPRIO 1 "Garantie / remplacement" 2 "Conseil technique" 3 "Réparation / pièces" 4 "Réactivité du contact" 5 "Livraison / installation" 99 "NR".
VALUE LABELS DUGAJUAC 1 "Moins de 6 mois" 2 "6 mois - 1 an" 3 "1 - 2 ans" 4 "Plus de 2 ans" 99 "NR".
VALUE LABELS CACOPREF 1 "En personne" 2 "Téléphone" 3 "WhatsApp" 4 "E-mail" 5 "Réseaux sociaux" 99 "NR".
VALUE LABELS BOSAPACH PRETACLI 1 "Oui" 2 "Peut-être" 3 "Non" 99 "NR".
VALUE LABELS CRCHCANA 1 "Proximité" 2 "Prix" 3 "Largeur du choix" 4 "Disponibilité" 5 "Conseil" 6 "Confiance" 99 "NR".
VALUE LABELS DEJACHLI 1 "Oui" 2 "Non" 99 "NR".
VALUE LABELS PRFRACLI 1 "Doute qualité / conformité" 2 "Ne pas voir le produit" 3 "Confiance dans le paiement" 4 "Livraison" 5 "Absence de SAV" 99 "NR".
VALUE LABELS FIMEFOUR 1 "Toujours" 2 "Souvent" 3 "Parfois" 4 "Rarement" 5 "Jamais" 99 "NR".

* -------------------------------------------------------------------------.
* PARTIE 4 - VALEURS MANQUANTES, NIVEAUX DE MESURE, RÔLES.
* -------------------------------------------------------------------------.
* RÈGLE : 99 (NR) est manquant partout.
* REVMENME : 97 (non applicable) et 98 (NSP) sont aussi manquants.
* Q15, Q16, Q21, Q22 : "Sans avis" (98) reste une RÉPONSE VALIDE.
*   (jusqu'à 50 % des répondants : l'exclure gonfle artificiellement les %).
*   Pour la lecture "parmi ceux qui ont un avis", utiliser les variables *_AV.
MISSING VALUES ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG FREQACHA LIEACHPR MONMOYAC
  PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU PAIEPRIV IMPOMARQ MAACPLSO
  PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA
  PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC
  IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI FIMEFOUR
  RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE (99).
MISSING VALUES REVMENME (97, 98, 99).

VARIABLE LEVEL ACCRECON VOUSETES SEXMAFEM VILLEREG LIEACHPR PAIEPRIV MAACPLSO MAACAUTR PRCRICHO
  ORIGPRIV MEQUAFIA MEILPRIX GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PRIOPRIN PRINFREI
  SEATPRIO CACOPREF CANAPREF CRCHCANA DEJACHLI PRFRACLI
  PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU
  RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE ID_CASE (NOMINAL)
  /AGEREPON REVMENME FREQACHA MONMOYAC IMPOMARQ ORINFACH PXHAUTGA PXMOYEGA PXBASGAM
  ECQUHABA SUACMOGA CRACPRCO DEJDECAC IMSECSAV DUGAJUAC BOSAPACH PRETACLI FIMEFOUR (ORDINAL).
* NOTE : PRIOPRIN (le moins cher / rapport Q-P / qualité à tout prix) est traité en.
* nominal : ce sont trois stratégies d'achat, pas une échelle d'intensité.
* GAACPLSO reste nominal à cause de la modalité "Selon le projet".

VARIABLE ROLE /INPUT ALL.

* -------------------------------------------------------------------------.
* PARTIE 5 - VARIABLES D'ANALYSE DÉRIVÉES (les variables d'origine restent intactes).
* -------------------------------------------------------------------------.

* 5.1 Groupes de profils.
RECODE VOUSETES (1=1) (2,4=2) (3=3) (5=4) (ELSE=SYSMIS) INTO PROFIL4.
RECODE VOUSETES (1,2=1) (3,4=2) (5=3) (ELSE=SYSMIS) INTO CATEG3.
RECODE AGEREPON (1,2=1) (3=2) (4,5=3) (ELSE=SYSMIS) INTO AGE3.
VARIABLE LABELS PROFIL4 "Profil (4 groupes : PME et BTP fusionnés, BTP n=14)"
  /CATEG3 "Maillon de la chaîne (utilisateurs / prescripteurs / distributeurs)"
  /AGE3 "Âge (3 classes)".
VALUE LABELS PROFIL4 1 "Particuliers" 2 "Entreprises (PME + BTP)" 3 "Électriciens / artisans" 4 "Revendeurs / grossistes".
VALUE LABELS CATEG3 1 "Utilisateurs finaux (particuliers, PME)" 2 "Prescripteurs / installateurs (artisans, BTP)" 3 "Distributeurs (revendeurs, grossistes)".
VALUE LABELS AGE3 1 "Moins de 35 ans" 2 "35-44 ans" 3 "45 ans et plus".

* 5.2 Revenu du ménage : n'a de sens que pour les PARTICULIERS.
* (posée aussi aux revendeurs et entreprises : 112 NR dont 55 chez les revendeurs).
RECODE REVMENME (1 THRU 5=COPY) (ELSE=SYSMIS) INTO REVMEN_P.
IF (VOUSETES NE 1) REVMEN_P = 97.
VARIABLE LABELS REVMEN_P "Q5. Revenu mensuel du ménage - PARTICULIERS uniquement".
VALUE LABELS REVMEN_P 1 "Moins de 100 000" 2 "100 000 - 250 000" 3 "250 000 - 500 000" 4 "500 000 - 1 M" 5 "Plus de 1 M" 97 "Non applicable (non particulier)".
MISSING VALUES REVMEN_P (97).

* 5.3 Origines : version "parmi ceux qui ont un avis" (Sans avis exclu).
RECODE MEQUAFIA MEILPRIX ORASHAGA ORASBAGA (1=1) (2=2) (3=3) (ELSE=SYSMIS) INTO MEQUA_AV MEILP_AV ORHG_AV ORBG_AV.
VARIABLE LABELS MEQUA_AV "Q15. Origine meilleure en qualité (avis exprimés seulement)"
  /MEILP_AV "Q16. Origine meilleure en prix (avis exprimés seulement)"
  /ORHG_AV "Q21. Origine associée au haut de gamme (avis exprimés seulement)"
  /ORBG_AV "Q22. Origine associée au bas de gamme (avis exprimés seulement)".
VALUE LABELS MEQUA_AV MEILP_AV ORHG_AV ORBG_AV 1 "Europe" 2 "Asie" 3 "Amérique".

* 5.4 Q41 : conversion en variable à réponse unique (voir point F de l'en-tête).
COUNT NB_LEV = RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE (1).
COMPUTE LEVFIDEL = $SYSMIS.
DO REPEAT V = RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE /K = 1 2 3 4 5 6 7.
IF (V = 1 AND MISSING(LEVFIDEL)) LEVFIDEL = K.
END REPEAT.
VARIABLE LABELS NB_LEV "CONTRÔLE Q41 : nombre de leviers cochés (attendu : plusieurs possibles)"
  /LEVFIDEL "Q41. Principal levier de fidélité (1 seul levier saisi par fiche)".
VALUE LABELS LEVFIDEL 1 "Prix / promotions" 2 "Qualité constante" 3 "Disponibilité du stock" 4 "Bon conseil" 5 "SAV fiable" 6 "Programme de fidélité" 7 "Facilités de paiement".
FORMATS NB_LEV LEVFIDEL (F2.0).

* 5.5 Marque : intégration du texte libre "Autre" (MAACAUTR, tronqué à 8 caractères).
* Règle : on retient la PREMIÈRE marque citée dans le texte.
STRING T_MARQ (A100).
COMPUTE T_MARQ = UPCASE(LTRIM(MAACAUTR)).
COMPUTE MARQUE_G = $SYSMIS.
RECODE MAACPLSO (1=1) (2=2) (7=3) (8=4) (3,4,5,6,9,10,11=7) (99=99) INTO MARQUE_G.
DO IF (MAACPLSO = 12).
+  COMPUTE MARQUE_G = 10.
+  IF (LENGTH(RTRIM(T_MARQ)) > 0) MARQUE_G = 8.
+  IF (INDEX(T_MARQ, 'YAK') = 1 OR INDEX(T_MARQ, 'YAQ') = 1) MARQUE_G = 5.
+  IF (INDEX(T_MARQ, 'SCHNEID') = 1) MARQUE_G = 1.
+  IF (INDEX(T_MARQ, 'LEGRAND') = 1) MARQUE_G = 2.
+  IF (INDEX(T_MARQ, 'CHINT') = 1) MARQUE_G = 3.
+  IF (INDEX(T_MARQ, 'PHILIPS') = 1) MARQUE_G = 4.
+  IF (INDEX(T_MARQ, 'GELEC') > 0 OR INDEX(T_MARQ, 'JELEC') > 0) MARQUE_G = 6.
+  IF (INDEX(T_MARQ, 'ANY ') = 1 OR INDEX(T_MARQ, 'AVAILAB') = 1 OR INDEX(T_MARQ, 'BASED') = 1
     OR INDEX(T_MARQ, 'CONSUMER') = 1 OR INDEX(T_MARQ, 'DEMANDE') = 1 OR INDEX(T_MARQ, 'DEPEND') = 1
     OR INDEX(T_MARQ, 'EN FONCT') = 1 OR INDEX(T_MARQ, 'IL ACH') = 1 OR INDEX(T_MARQ, 'IN TERMS') = 1
     OR INDEX(T_MARQ, 'JUSTE') = 1 OR INDEX(T_MARQ, 'MANY') = 1 OR INDEX(T_MARQ, 'MOST') = 1
     OR INDEX(T_MARQ, 'PRATIQUE') = 1 OR INDEX(T_MARQ, 'TOUT') = 1) MARQUE_G = 9.
END IF.
VARIABLE LABELS MARQUE_G "Q12. Marque achetée le plus souvent (liste + texte libre recodé)".
VALUE LABELS MARQUE_G 1 "Schneider" 2 "Legrand" 3 "Chint / chinoise" 4 "Philips" 5 "Yaki" 6 "Ingelec"
  7 "Autres marques de la liste" 8 "Autres marques citées" 9 "Pas de marque fixe (selon dispo / demande)"
  10 "Autre, sans précision" 99 "NR".
MISSING VALUES MARQUE_G (99).
FORMATS MARQUE_G (F2.0).

* Origine de la marque achetée (origine NON devinée quand elle n'est pas établie).
RECODE MARQUE_G (1,2,4=1) (3=2) (5,6,8,10=3) (9=4) (ELSE=SYSMIS) INTO ORIG_MARQ.
IF (MAACPLSO = 4 OR MAACPLSO = 5 OR MAACPLSO = 6) ORIG_MARQ = 1.
IF (MAACPLSO = 9 OR MAACPLSO = 10 OR MAACPLSO = 11) ORIG_MARQ = 2.
IF (MAACPLSO = 3) ORIG_MARQ = 3.
VARIABLE LABELS ORIG_MARQ "Origine de la marque achetée le plus souvent".
VALUE LABELS ORIG_MARQ 1 "Marque européenne" 2 "Marque asiatique" 3 "Origine non établie (Yaki, Ingelec, autres)" 4 "Pas de marque fixe".

* -------------------------------------------------------------------------.
* PARTIE 6 - ENSEMBLE À RÉPONSES MULTIPLES (Q9 seulement).
* -------------------------------------------------------------------------.
MRSETS
  /MDGROUP NAME=$PRODUITS LABEL='Q9. Familles de produits achetées (plusieurs réponses)'
    CATEGORYLABELS=VARLABELS VARIABLES=PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU VALUE=1
  /DISPLAY NAME=[$PRODUITS].
* Q41 n'est volontairement PAS défini en réponses multiples (voir 5.4).

* -------------------------------------------------------------------------.
* NOTE TECHNIQUE : 99 étant déclaré manquant, toute condition IF (X = 99) est.
* ignorée par SPSS. On utilise donc VALUE(X) = 99 dans les conditions ci-dessous.
* -------------------------------------------------------------------------.
* PARTIE 7 - QUALITÉ DES FICHES ET FILTRE D'ANALYSE.
* -------------------------------------------------------------------------.
* 7.1 Taux de remplissage sur 44 questions (Q9 et Q41 comptent pour 1 chacune).
COUNT NB_NR = ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA LIEACHPR MONMOYAC
  PAIEPRIV IMPOMARQ MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH GAACPLSO DEAVHAGA
  CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI
  CRACPRCO DEJDECAC IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI
  PRETACLI PRFRACLI FIMEFOUR (99).
IF (VALUE(PRACCABL) = 99) NB_NR = NB_NR + 1.
IF (VALUE(RFIDPRIX) = 99) NB_NR = NB_NR + 1.
COMPUTE TX_REMPL = 100 * (1 - NB_NR / 44).
VARIABLE LABELS NB_NR "Nombre de questions sans réponse (sur 44)"
  /TX_REMPL "Taux de remplissage de la fiche (%)".
FORMATS NB_NR (F3.0) TX_REMPL (F5.1).

* 7.2 Bloc "achat en ligne" (Q37 à Q39) entièrement vide.
COMPUTE BLOC_WEB_VIDE = (VALUE(DEJACHLI) = 99 AND VALUE(PRETACLI) = 99 AND VALUE(PRFRACLI) = 99).
VARIABLE LABELS BLOC_WEB_VIDE "Bloc achat en ligne (Q37-Q39) entièrement vide".
VALUE LABELS BLOC_WEB_VIDE 0 "Non" 1 "Oui".

* 7.3 Fiches quasi identiques (Yaoundé). Repérées par comparaison de toutes les.
* paires de fiches d'une même ville sur 53 variables (hors MAACAUTR, ACCRECON, ville).
* Groupe A : lignes 318 340 344 348 352 355 366 378 (344-348, 348-378, 355-378 : 3 écarts).
* Groupe B : lignes 432 438 439 441 443 444 445 (438-445 : 1 seul écart sur 53).
* Probabilité qu'un tel niveau de ressemblance soit naturel : très faible ;.
* Douala et Bafoussam n'ont AUCUNE paire à moins de 7 écarts.
COMPUTE DOUBLON_SUSP = 0.
IF (ANY(ID_CASE, 318, 340, 344, 348, 352, 355, 366, 378, 432, 438, 439, 441, 443, 444, 445)) DOUBLON_SUSP = 1.
* Dans chaque groupe, la première fiche est conservée, les copies (3 écarts ou moins) sont écartées.
IF (ANY(ID_CASE, 348, 355, 378, 439, 441, 443, 444, 445)) DOUBLON_SUSP = 2.
VARIABLE LABELS DOUBLON_SUSP "Fiche quasi identique à une autre (à vérifier par rappel)".
VALUE LABELS DOUBLON_SUSP 0 "Non" 1 "Ressemblance forte : à vérifier" 2 "Copie probable : écartée".

* 7.4 Filtre d'analyse : 1 = fiche retenue.
COMPUTE FILTRE_QUAL = (TX_REMPL >= 70 AND DOUBLON_SUSP < 2).
VARIABLE LABELS FILTRE_QUAL "Fiche retenue pour l'analyse (remplie à 70 % et plus, hors copies)".
VALUE LABELS FILTRE_QUAL 0 "Écartée" 1 "Retenue".
FORMATS BLOC_WEB_VIDE DOUBLON_SUSP FILTRE_QUAL (F1.0).

VARIABLE LEVEL PROFIL4 CATEG3 LEVFIDEL MARQUE_G ORIG_MARQ MEQUA_AV MEILP_AV ORHG_AV ORBG_AV
  BLOC_WEB_VIDE DOUBLON_SUSP FILTRE_QUAL (NOMINAL)
  /AGE3 REVMEN_P (ORDINAL) /NB_LEV NB_NR TX_REMPL (SCALE).
VARIABLE ROLE /INPUT ALL.
EXECUTE.
DELETE VARIABLES T_MARQ.

* -------------------------------------------------------------------------.
* PARTIE 8 - ENREGISTREMENT.
* -------------------------------------------------------------------------.
SAVE OUTFILE='SPSS_EDM_EE_V4.sav' /COMPRESSED.

* -------------------------------------------------------------------------.
* PARTIE 9 - CONTRÔLES (à lire dans la fenêtre de résultats).
* -------------------------------------------------------------------------.
TITLE "C1 Q41 : nombre de leviers cochés par fiche".
FREQUENCIES VARIABLES=NB_LEV.
* Attendu sur la base actuelle : 1 levier = 429 fiches, 0 = 17 (NR).
* Si une ré-importation donne des fiches à 2 leviers ou plus, Q41 redevient.
* une vraie question multiple : le signaler avant d'analyser.

TITLE "C2 Marque après intégration du texte libre".
FREQUENCIES VARIABLES=MARQUE_G ORIG_MARQ /FORMAT=DFREQ.
* Attendu : Schneider 114, Yaki 67, Chint 58, Legrand 48, NR 85.

TITLE "C3 Qualité des fiches par ville".
CROSSTABS /TABLES=FILTRE_QUAL DOUBLON_SUSP BLOC_WEB_VIDE BY VILLEREG /CELLS=COUNT COLUMN.
MEANS TABLES=TX_REMPL NB_NR BY VILLEREG /CELLS=MEAN MIN COUNT.
* Attendu : 427 fiches retenues ; NR moyen très bas à Bafoussam (à expliquer).

TITLE "C4 Vérification : plus aucune modalité sans libellé".
FREQUENCIES VARIABLES=REVMENME MEQUAFIA MEILPRIX ORASHAGA ORASBAGA PRACCABL RFIDPRIX.

* Pour analyser seulement les fiches retenues : FILTER BY FILTRE_QUAL.
* (à mettre en tête de la syntaxe d'analyse, juste après GET FILE).
* FIN.
