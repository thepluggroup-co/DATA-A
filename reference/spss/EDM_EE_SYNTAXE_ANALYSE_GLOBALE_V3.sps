* Encoding: UTF-8.
* =========================================================================.
* ÉTUDE DE MARCHÉ - DISTRIBUTION DU MATÉRIEL ET DES ÉQUIPEMENTS ÉLECTRIQUES.
* Douala - Yaoundé - Bafoussam (Cahier des charges M2B Conseils).
* SYNTAXE D'ANALYSE GLOBALE - VERSION 3 (niveau rapport final).
* Fichier de données attendu : SPSS_EDM_EE.sav (446 répondants, 56 variables).
* Noms de variables = codes du masque de dépouillement (VOUSETES, VILLEREG...).
* =========================================================================.
*.
* COMMENT UTILISER CETTE SYNTAXE.
* 1. Placer SPSS_EDM_EE.sav dans le même dossier que ce fichier .sps.
*    (ou remplacer le chemin dans la commande GET FILE de la PARTIE 0).
* 2. Menu Exécuter > Tout. Chaque tableau est précédé d'un TITRE numéroté.
*    (T3.1, T4.2...) qui apparaît dans l'arborescence de la fenêtre résultats.
* 3. Les lignes commençant par * sont des COMMENTAIRES : elles s'affichent.
*    dans le journal (Log) de la fenêtre résultats, juste avant le tableau.
*    Elles disent COMMENT LIRE le tableau et QUOI ÉCRIRE dans le rapport.
* 4. Les "Repères" cités en commentaire sont les valeurs observées sur la base.
*    de 446 fiches NON pondérée (run V2). Si la base change, les chiffres changent.
*.
* MODULES SPSS NÉCESSAIRES.
* - Statistics Base : parties 0 à 13, 15 (TwoStep) et 16.
* - Regression : partie 14 (LOGISTIC REGRESSION).
* - Categories : partie 15 (CORRESPONDENCE, MULTIPLE CORRESPONDENCE).
* Si un module manque, SPSS signale une erreur sur ce bloc et continue le reste.
*.
* CORRESPONDANCE RAPPORT <-> SYNTAXE.
* Rapport 2. Déroulement / Méthodologie ...... PARTIE 2 (T2.x).
* Rapport 3.1 Traitement des données ......... PARTIE 2 (T2.3 valides/manquants).
* Rapport 3.2 Identification des clients ..... PARTIE 3 (T3.x).
* Rapport 3.3 Comportements d'achat .......... PARTIE 4 (T4.x).
* Rapport 3.4 Marques, critères de choix ..... PARTIE 5 (T5.x).
* Rapport 3.5 Origine des produits (CDC) ..... PARTIE 6 (T6.x).
* Rapport 3.6 Gammes et acceptabilité prix ... PARTIE 7 (T7.x).
* Rapport 3.7 Freins et insatisfactions ...... PARTIE 8 (T8.x).
* Rapport 3.8 Attentes SAV / garantie (CDC) .. PARTIE 9 (T9.x).
* Rapport 3.9 Canaux et achat en ligne ....... PARTIE 10 (T10.x).
* Rapport 3.10 Fidélisation .................. PARTIE 11 (T11.x).
* Rapport 4. Analyses approfondies ........... PARTIES 12 à 15.
* Rapport Synthèse / chiffres clés ........... PARTIE 16 (T16.x, IC 95 %).
*.
* RÈGLES DE TRAITEMENT.
* - 99 = non-réponse (NR) ; 98 = sans avis / NSP : déclarés manquants.
*   SAUF dans les variables *_SA où "Sans avis" est une modalité à part entière.
* - Pourcentages = % des réponses valides (NR exclues du dénominateur).
* - Tests et modèles (parties 12 à 15) : TOUJOURS sur données NON pondérées.
* - Pondération (WT) : réservée aux estimations globales (partie 16).
*   Voir la discussion en PARTIE 2.4 : la pondération CDC n'est PAS une.
*   pondération de représentativité de la population.
* =========================================================================.

* =========================================================================.
* PARTIE 0 - PARAMÉTRAGE : OUVERTURE, AFFICHAGE, ÉTIQUETTES, MANQUANTS.
* =========================================================================.

GET FILE='SPSS_EDM_EE.sav'.
DATASET NAME EDM_EE WINDOW=FRONT.

* Affichage : libellés de variables et de modalités dans les tableaux.
SET TVARS=LABELS TNUMBERS=LABELS OVARS=LABELS ONUMBERS=LABELS.

* -------------------------------------------------------------------------.
* 0.1 Interrupteur de pondération des tableaux descriptifs.
* OFF (défaut) = tableaux bruts, lecture recommandée PAR PROFIL et PAR VILLE.
* Pour pondérer TOUS les tableaux descriptifs : remplacer OFF par BY WT.
* -------------------------------------------------------------------------.
DEFINE !POIDS () OFF !ENDDEFINE.

* -------------------------------------------------------------------------.
* 0.2 Libellés explicites des variables (ils deviennent les TITRES des tableaux).
* -------------------------------------------------------------------------.
VARIABLE LABELS
  ACCRECON "Accepte d'être recontacté à des fins commerciales"
  /VOUSETES "Q1. Profil du répondant (5 catégories CDC)"
  /SEXMAFEM "Q2. Genre du répondant"
  /AGEREPON "Q3. Classe d'âge du répondant"
  /VILLEREG "Q4. Ville d'enquête"
  /REVMENME "Q5. Revenu mensuel du ménage (FCFA)"
  /FREQACHA "Q6. Fréquence d'achat de matériel électrique"
  /LIEACHPR "Q7. Lieu d'achat principal actuel"
  /MONMOYAC "Q8. Montant moyen dépensé par achat (FCFA)"
  /PRACCABL "Q9. Achète : câbles et fils"
  /PRACAPPA "Q9. Achète : appareillage / disjoncteurs"
  /PRACPRIS "Q9. Achète : prises et interrupteurs"
  /PRACLUMI "Q9. Achète : luminaires"
  /PRACSOLA "Q9. Achète : solaire / onduleurs"
  /PRACGROU "Q9. Achète : groupes électrogènes"
  /PAIEPRIV "Q10. Mode de paiement privilégié"
  /IMPOMARQ "Q11. Importance accordée à la marque"
  /MAACPLSO "Q12. Marque achetée le plus souvent (codes du questionnaire)"
  /MAACAUTR "Q12. Autre marque citée (texte libre)"
  /PRCRICHO "Q13. Principal critère de choix d'un produit"
  /ORIGPRIV "Q14. Origine géographique privilégiée à l'achat"
  /MEQUAFIA "Q15. Origine jugée la meilleure en qualité / fiabilité"
  /MEILPRIX "Q16. Origine jugée la meilleure en prix"
  /ORINFACH "Q17. Influence de l'origine sur la décision d'achat"
  /GAACPLSO "Q18. Gamme achetée le plus souvent"
  /DEAVHAGA "Q19. Ce qui définit avant tout le HAUT de gamme"
  /CAAVBAGA "Q20. Ce qui caractérise avant tout le BAS de gamme"
  /ORASHAGA "Q21. Origine associée spontanément au HAUT de gamme"
  /ORASBAGA "Q22. Origine associée spontanément au BAS de gamme"
  /PXHAUTGA "Q23a. Prix attendu d'un disjoncteur HAUT de gamme"
  /PXMOYEGA "Q23b. Prix attendu d'un disjoncteur MOYENNE gamme"
  /PXBASGAM "Q23c. Prix attendu d'un disjoncteur BAS de gamme"
  /ECQUHABA "Q24. Écart de qualité perçu entre haut et bas de gamme"
  /PRIOPRIN "Q25. Priorité principale à l'achat"
  /SUACMOGA "Q26. Surcoût accepté pour monter en gamme"
  /PRINFREI "Q27. Principal frein à l'achat"
  /CRACPRCO "Q28. Crainte d'acheter un produit contrefait / non conforme"
  /DEJDECAC "Q29. Déjà déçu par un achat de matériel électrique"
  /IMSECSAV "Q30. Importance du service client et du SAV"
  /SEATPRIO "Q31. Service après-vente attendu en priorité"
  /DUGAJUAC "Q32. Durée de garantie jugée acceptable"
  /CACOPREF "Q33. Canal de contact préféré avec le fournisseur"
  /BOSAPACH "Q34. Un bon SAV justifierait de payer plus cher"
  /CANAPREF "Q35. Canal d'achat PRÉFÉRÉ (souhaité)"
  /CRCHCANA "Q36. Critère de choix du canal d'achat"
  /DEJACHLI "Q37. A déjà acheté du matériel électrique en ligne"
  /PRETACLI "Q38. Prêt à acheter du matériel électrique en ligne"
  /PRFRACLI "Q39. Principal frein à l'achat en ligne"
  /FIMEFOUR "Q40. Fidélité à un même fournisseur"
  /RFIDPRIX "Q41. Levier de fidélité : prix / promotions"
  /RFIDQUAL "Q41. Levier de fidélité : qualité constante"
  /RFIDSTOC "Q41. Levier de fidélité : disponibilité du stock"
  /RFIDCONS "Q41. Levier de fidélité : bon conseil"
  /RFIDSAVF "Q41. Levier de fidélité : SAV fiable"
  /RFIDPROG "Q41. Levier de fidélité : programme de fidélité"
  /RFIDPAIE "Q41. Levier de fidélité : facilités de paiement".

* -------------------------------------------------------------------------.
* 0.3 Libellés des modalités (réécrits en entier : corrige les fautes du .sav).
* Exemples corrigés : "Partuculier", "Quincallerie", "Grossiste spécialié".
* -------------------------------------------------------------------------.
VALUE LABELS ACCRECON 1 "Oui" 2 "Non" 99 "NR".
VALUE LABELS VOUSETES 1 "Particulier (ménage)" 2 "Entreprise (PME, industrie)" 3 "Électricien / artisan" 4 "Entreprise BTP" 5 "Revendeur / grossiste" 99 "NR".
VALUE LABELS SEXMAFEM 1 "Homme" 2 "Femme" 99 "NR".
VALUE LABELS AGEREPON 1 "Moins de 25 ans" 2 "25-34 ans" 3 "35-44 ans" 4 "45-54 ans" 5 "55 ans et plus" 99 "NR".
VALUE LABELS VILLEREG 1 "Douala" 2 "Yaoundé" 3 "Bafoussam" 99 "NR".
* REVMENME : le code 5 (6 cas) était sans libellé dans le .sav.
* Le DICTIONNAIRE du masque V7 indique 5 = "> 1 M" : libellé restauré.
* (la V2 excluait ces 6 cas : c'étaient les revenus les plus élevés).
* A VÉRIFIER sur 2 ou 3 fiches papier avant publication.
VALUE LABELS REVMENME 1 "Moins de 100 000" 2 "100 000 - 250 000" 3 "250 000 - 500 000" 4 "500 000 - 1 M" 5 "Plus de 1 M" 6 "NSP" 98 "NSP" 99 "NR".
VALUE LABELS FREQACHA 1 "Chaque semaine" 2 "1 à 3 fois par mois" 3 "Quelques fois par an" 4 "Rarement" 99 "NR".
VALUE LABELS LIEACHPR CANAPREF 1 "Quincaillerie" 2 "Grossiste spécialisé" 3 "Magasin spécialisé" 4 "Marché" 5 "Importateur" 6 "En ligne" 99 "NR".
VALUE LABELS MONMOYAC 1 "Moins de 25 000" 2 "25 000 - 100 000" 3 "100 000 - 500 000" 4 "500 000 - 2 M" 5 "Plus de 2 M" 99 "NR".
VALUE LABELS PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE 1 "Cité" 0 "Non cité" 99 "NR".
VALUE LABELS PAIEPRIV 1 "Espèces" 2 "Mobile Money" 3 "Virement" 4 "Crédit fournisseur" 99 "NR".
VALUE LABELS IMPOMARQ IMSECSAV 1 "Très importante" 2 "Importante" 3 "Peu importante" 4 "Pas importante" 99 "NR".
VALUE LABELS MAACPLSO 1 "Schneider" 2 "Legrand" 3 "Vectron" 4 "Hager" 5 "ABB" 6 "Siemens" 7 "Chint / chinoise" 8 "Philips" 9 "JA Solar" 10 "Longi" 11 "Growatt" 12 "Autre marque" 99 "NR".
VALUE LABELS PRCRICHO 1 "Prix" 2 "Qualité / durabilité" 3 "Disponibilité" 4 "Notoriété" 5 "Garantie / SAV" 6 "Conformité aux normes" 99 "NR".
VALUE LABELS ORIGPRIV 1 "Europe" 2 "Asie" 3 "Amérique" 4 "Aucune préférence" 99 "NR".
VALUE LABELS MEQUAFIA MEILPRIX ORASHAGA ORASBAGA 1 "Europe" 2 "Asie" 3 "Amérique" 98 "Sans avis" 99 "NR".
VALUE LABELS ORINFACH 1 "Fortement" 2 "Modérément" 3 "Faiblement" 4 "Pas du tout" 99 "NR".
VALUE LABELS GAACPLSO 1 "Haut de gamme" 2 "Moyenne gamme" 3 "Bas de gamme" 4 "Selon le projet" 99 "NR".
VALUE LABELS DEAVHAGA 1 "Un prix élevé" 2 "Une marque reconnue" 3 "La durabilité / fiabilité" 4 "L'origine" 5 "Certifications / normes" 6 "Une garantie longue" 99 "NR".
VALUE LABELS CAAVBAGA 1 "Un prix bas" 2 "Origine asiatique générique" 3 "Absence de marque connue" 4 "Durée de vie courte" 5 "Absence de garantie" 6 "Risque de non-conformité" 99 "NR".
VALUE LABELS PXHAUTGA PXMOYEGA PXBASGAM 1 "Moins de 5 000 FCFA" 2 "5 000 - 15 000 FCFA" 3 "15 000 - 40 000 FCFA" 4 "Plus de 40 000 FCFA" 99 "NR".
VALUE LABELS ECQUHABA 1 "Très important" 2 "Important" 3 "Modéré" 4 "Faible" 5 "Inexistant" 99 "NR".
VALUE LABELS PRIOPRIN 1 "Le moins cher" 2 "Meilleur rapport qualité/prix" 3 "Meilleure qualité quel que soit le prix" 99 "NR".
VALUE LABELS SUACMOGA 1 "Aucun surcoût" 2 "Jusqu'à +10 %" 3 "+10 à +25 %" 4 "+25 à +50 %" 5 "Plus de +50 %" 99 "NR".
VALUE LABELS PRINFREI 1 "Prix élevé" 2 "Doute qualité / contrefaçon" 3 "Indisponibilité" 4 "Manque de conseil" 5 "Absence de garantie" 6 "Délais de livraison" 99 "NR".
VALUE LABELS CRACPRCO 1 "Souvent" 2 "Parfois" 3 "Rarement" 4 "Jamais" 99 "NR".
VALUE LABELS DEJDECAC 1 "Oui, plusieurs fois" 2 "Oui, une fois" 3 "Non" 99 "NR".
VALUE LABELS SEATPRIO 1 "Garantie / remplacement" 2 "Conseil technique" 3 "Réparation / pièces" 4 "Réactivité du contact" 5 "Livraison / installation" 99 "NR".
VALUE LABELS DUGAJUAC 1 "Moins de 6 mois" 2 "6 mois - 1 an" 3 "1 - 2 ans" 4 "Plus de 2 ans" 99 "NR".
VALUE LABELS CACOPREF 1 "En personne" 2 "Téléphone" 3 "WhatsApp" 4 "E-mail" 5 "Réseaux sociaux" 99 "NR".
VALUE LABELS BOSAPACH PRETACLI 1 "Oui" 2 "Peut-être" 3 "Non" 99 "NR".
VALUE LABELS CRCHCANA 1 "Proximité" 2 "Prix" 3 "Largeur du choix" 4 "Disponibilité" 5 "Conseil" 6 "Confiance" 99 "NR".
VALUE LABELS DEJACHLI 1 "Oui" 2 "Non" 0 "Non" 99 "NR".
VALUE LABELS PRFRACLI 1 "Doute qualité / conformité" 2 "Ne pas voir le produit" 3 "Confiance dans le paiement" 4 "Livraison" 5 "Absence de SAV" 99 "NR".
VALUE LABELS FIMEFOUR 1 "Toujours" 2 "Souvent" 3 "Parfois" 4 "Rarement" 5 "Jamais" 99 "NR".

* -------------------------------------------------------------------------.
* 0.4 Déclaration des valeurs manquantes (listes explicites, sans TO).
* -------------------------------------------------------------------------.
MISSING VALUES ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA LIEACHPR MONMOYAC
  PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU PAIEPRIV IMPOMARQ MAACPLSO
  PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA
  PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC
  IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI FIMEFOUR
  RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE (98, 99).

* Niveaux de mesure (utiles pour les graphiques et les procédures).
VARIABLE LEVEL VOUSETES SEXMAFEM VILLEREG LIEACHPR PAIEPRIV MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX
  GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PRINFREI SEATPRIO CACOPREF CANAPREF CRCHCANA DEJACHLI PRFRACLI (NOMINAL)
  /AGEREPON REVMENME FREQACHA MONMOYAC IMPOMARQ ORINFACH PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN
  SUACMOGA CRACPRCO DEJDECAC IMSECSAV DUGAJUAC BOSAPACH PRETACLI FIMEFOUR (ORDINAL).

* -------------------------------------------------------------------------.
* 0.5 Macros d'affichage (évitent de répéter les mêmes options).
* !FREQ : tri à plat + diagramme en barres (en %).
* !TAB  : tableau croisé PAR VILLE et PAR PROFIL, % en colonne + test z.
*         des proportions de colonnes (lettres A, B, C : voir LECTURE ci-dessous).
* !TEST : khi-deux + V de Cramer + résidus ajustés (partie 13).
* -------------------------------------------------------------------------.
* LECTURE DES LETTRES (BPROP) : dans un tableau croisé, chaque colonne reçoit.
* une lettre. Une lettre affichée dans une cellule signifie que la proportion.
* de cette cellule est significativement différente (p<0,05, Bonferroni) de.
* celle de la colonne portant cette lettre. Aucune lettre = pas d'écart prouvé.
DEFINE !FREQ (v = !CMDEND)
FREQUENCIES VARIABLES=!v /BARCHART PERCENT /ORDER=ANALYSIS.
!ENDDEFINE.

DEFINE !TAB (v = !CMDEND)
CROSSTABS /TABLES=!v BY VILLEREG PROFIL4
  /FORMAT=AVALUE TABLES
  /CELLS=COUNT COLUMN BPROP.
!ENDDEFINE.

DEFINE !TEST (v = !CMDEND)
CROSSTABS /TABLES=!v BY VILLEREG PROFIL4 AGE3
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ PHI
  /CELLS=COUNT COLUMN ASRESID.
!ENDDEFINE.

* =========================================================================.
* PARTIE 1 - VARIABLES DÉRIVÉES (regroupements, indicateurs, scores).
* =========================================================================.

* 1.1 Regroupements de profils.
* PROFIL4 : PME et BTP fusionnés (BTP n=14 : trop peu pour être lu seul).
RECODE VOUSETES (1=1) (2,4=2) (3=3) (5=4) (ELSE=SYSMIS) INTO PROFIL4.
VARIABLE LABELS PROFIL4 "Profil du répondant (4 groupes d'analyse)".
VALUE LABELS PROFIL4 1 "Particuliers" 2 "Entreprises (PME + BTP)" 3 "Électriciens / artisans" 4 "Revendeurs / grossistes".

* CATEG3 : les 3 familles de cibles du cahier des charges M2B.
RECODE VOUSETES (1,2=1) (3,4=2) (5=3) (ELSE=SYSMIS) INTO CATEG3.
VARIABLE LABELS CATEG3 "Famille de cibles (cahier des charges)".
VALUE LABELS CATEG3 1 "Utilisateurs finaux" 2 "Prescripteurs" 3 "Distributeurs".

RECODE AGEREPON (1,2=1) (3=2) (4,5=3) (ELSE=SYSMIS) INTO AGE3.
VARIABLE LABELS AGE3 "Âge du répondant (3 classes)".
VALUE LABELS AGE3 1 "Moins de 35 ans" 2 "35-44 ans" 3 "45 ans et plus".

* Revenu : NSP (6 ou 98) et NR exclus.
RECODE REVMENME (1 THRU 5=COPY) (ELSE=SYSMIS) INTO REVMEN_R.
VARIABLE LABELS REVMEN_R "Revenu mensuel du ménage (NSP et NR exclus)".
VALUE LABELS REVMEN_R 1 "Moins de 100 000" 2 "100 000 - 250 000" 3 "250 000 - 500 000" 4 "500 000 - 1 M" 5 "Plus de 1 M".

* 1.2 Indicateurs binaires (1 = oui, 0 = non) : leur moyenne = un pourcentage.
RECODE PRETACLI (1=1) (2,3=0) (ELSE=SYSMIS) INTO ONLIN_FERME.
RECODE PRETACLI (1,2=1) (3=0) (ELSE=SYSMIS) INTO ONLIN_POT.
RECODE DEJACHLI (1=1) (0,2=0) (ELSE=SYSMIS) INTO DEJA_LIGNE.
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
RECODE LIEACHPR (1=1) (2=2) (3=3) (4=4) (5=5) (6=6) (ELSE=SYSMIS) INTO LIEU_ACT.
* Dilemme qualité/prix : Europe jugée meilleure en qualité ET Asie en prix.
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
  /LIEU_ACT "Lieu d'achat ACTUEL (Q7)"
  /DILEMME "Perçoit Europe = qualité ET Asie = prix".
VALUE LABELS ONLIN_FERME ONLIN_POT DEJA_LIGNE SAV_OUI SAV_POT SAV_TRESIMP MARQ_TRESIMP MONT_100K HEBDO DECU
  HAUTGAMME FIDELE CRIT_QUAL CRIT_PRIX PREF_EUROPE PREF_ASIE PREF_AUCUNE CONTREF_SOUV ESPECES GARANT_1AN
  SURCOUT_10 CONTACT_WA DILEMME 0 "Non" 1 "Oui".
VALUE LABELS LIEU_ACT 1 "Quincaillerie" 2 "Grossiste spécialisé" 3 "Magasin spécialisé" 4 "Marché" 5 "Importateur" 6 "En ligne".

* 1.3 Versions "avec Sans avis" (98 = modalité valide 4) pour Q15, Q16, Q21, Q22.
* POURQUOI : dans la V2, "Sans avis" était exclu du calcul. Résultat trompeur :.
* "90,7 % associent le bas de gamme à l'Asie" était calculé sur 215 personnes,.
* alors que 222 répondants (sur 446) n'ont PAS su associer une origine.
* L'incapacité à associer une origine EST un résultat (faible culture produit).
RECODE MEQUAFIA (1=1) (2=2) (3=3) (98=4) (ELSE=SYSMIS) INTO MEQUA_SA.
RECODE MEILPRIX (1=1) (2=2) (3=3) (98=4) (ELSE=SYSMIS) INTO MEILP_SA.
RECODE ORASHAGA (1=1) (2=2) (3=3) (98=4) (ELSE=SYSMIS) INTO ORHG_SA.
RECODE ORASBAGA (1=1) (2=2) (3=3) (98=4) (ELSE=SYSMIS) INTO ORBG_SA.
VARIABLE LABELS MEQUA_SA "Q15. Origine meilleure en qualité (Sans avis inclus)"
  /MEILP_SA "Q16. Origine meilleure en prix (Sans avis inclus)"
  /ORHG_SA "Q21. Origine associée au haut de gamme (Sans avis inclus)"
  /ORBG_SA "Q22. Origine associée au bas de gamme (Sans avis inclus)".
VALUE LABELS MEQUA_SA MEILP_SA ORHG_SA ORBG_SA 1 "Europe" 2 "Asie" 3 "Amérique" 4 "Sans avis".

* 1.4 Marque regroupée (Yaki isolée à partir du texte libre de la modalité Autre).
* ATTENTION : MAACAUTR est en A8 dans le .sav : les mentions longues sont.
* tronquées. Pour un recodage complet, ré-importer le texte en A100.
COMPUTE YAKI = 0.
IF (MAACPLSO = 12 AND (INDEX(UPCASE(MAACAUTR),'YAK') > 0 OR INDEX(UPCASE(MAACAUTR),'YAQ') > 0)) YAKI = 1.
RECODE MAACPLSO (1=1) (2=2) (7=3) (8=4) (3,4,5,6,9,10,11=5) (12=6) (ELSE=SYSMIS) INTO MARQUE_G.
IF (YAKI = 1) MARQUE_G = 7.
VARIABLE LABELS MARQUE_G "Marque achetée le plus souvent (regroupée)".
VALUE LABELS MARQUE_G 1 "Schneider" 2 "Legrand" 3 "Chint / chinoise" 4 "Philips" 5 "Autres marques référencées" 6 "Autres marques (hors Yaki)" 7 "Yaki".

* Origine de la marque achetée (proxy de la part de marché par origine, objectif CDC).
* Europe : Schneider, Legrand, Hager, ABB, Siemens, Philips.
* Asie : Chint, JA Solar, Longi, Growatt.
* Non classé : Vectron, Yaki, autres (origine non vérifiée : NE PAS deviner).
RECODE MAACPLSO (1,2,4,5,6,8=1) (7,9,10,11=2) (3,12=3) (ELSE=SYSMIS) INTO ORIG_MARQ.
IF (YAKI = 1) ORIG_MARQ = 3.
VARIABLE LABELS ORIG_MARQ "Origine de la marque achetée le plus souvent (proxy)".
VALUE LABELS ORIG_MARQ 1 "Marque européenne" 2 "Marque asiatique" 3 "Origine non classée (Yaki, autres)".

* 1.5 Scores orientés : PLUS LE SCORE EST ÉLEVÉ, PLUS L'ATTITUDE EST FORTE.
* (les codes du questionnaire vont dans le sens inverse : 1 = très important).
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

* 1.6 Indices 0-100 (lecture : 0 = minimum possible, 100 = maximum possible).
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

* 1.7 Variables monétaires approchées (points milieux des tranches : HYPOTHÈSES).
* Montant par achat : <25k=15 000 ; 25-100k=62 500 ; 100-500k=300 000 ;.
*   500k-2M=1 250 000 ; >2M=3 000 000 (borne ouverte : hypothèse prudente).
* Achats par an : hebdo=52 ; 1-3/mois=24 ; quelques fois/an=4 ; rarement=1.
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

* 1.8 Complétude de chaque fiche (nombre de NR sur les 55 questions fermées).
COUNT NB_NR = ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA LIEACHPR MONMOYAC
  PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU PAIEPRIV IMPOMARQ MAACPLSO
  PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA
  PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC
  IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI FIMEFOUR
  RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE (99).
COMPUTE TX_REMPL = 100 * (1 - NB_NR / 55).
RECODE TX_REMPL (95 THRU HI=1) (80 THRU 95=2) (LO THRU 80=3) INTO QUAL_FICHE.
VARIABLE LABELS NB_NR "Nombre de non-réponses dans la fiche"
  /TX_REMPL "Taux de remplissage de la fiche (%)"
  /QUAL_FICHE "Qualité de remplissage de la fiche".
VALUE LABELS QUAL_FICHE 1 "Complète (95 % et +)" 2 "Acceptable (80-95 %)" 3 "Faible (moins de 80 %)".
FORMATS TX_REMPL (F5.1) NB_NR QUAL_FICHE (F3.0).
EXECUTE.

* =========================================================================.
* PARTIE 2 - MÉTHODOLOGIE ET QUALITÉ DES DONNÉES (rapport : Déroulement).
* =========================================================================.
WEIGHT OFF.

TITLE "T2.1 Plan d'échantillonnage réalisé : profil x ville".
* OBJECTIF : remplir le tableau "Ciblage / fréquence des cibles interrogées".
* PLAN PRÉVU (CDC, tableau à 500) - Douala / Yaoundé / Bafoussam / Total :.
*   Particuliers 35/35/15 = 85 ; PME 35/35/15 = 85 ; Artisans 40/40/20 = 100 ;.
*   BTP 40/40/20 = 100 ; Revendeurs 50/50/30 = 130 ; TOTAL 200/200/100 = 500.
* NOTE : le texte du CDC (section 4a) annonce 400 (150/150/100) : incohérence.
* interne au CDC, à signaler au client. Le tableau détaillé (500) fait foi ici.
CROSSTABS /TABLES=VOUSETES BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN TOTAL.
* Repère : 446 fiches = 89,2 % de 500. Douala 172 (86 %), Yaoundé 172 (86 %),.
* Bafoussam 102 (102 %). PAR PROFIL : particuliers 172 pour 85 prévus (202 %),.
* revendeurs 163/130 (125 %), artisans 53/100 (53 %), PME 44/85 (52 %),.
* BTP 14/100 (14 %). A ÉCRIRE : quota global quasi atteint, mais structure.
* très déformée (particuliers et revendeurs sur-représentés, BTP quasi absent).
* Conséquence : les résultats BTP ne sont PAS publiables isolément.

TITLE "T2.2 Taux de réalisation des quotas par strate".
* Tableau calculé : effectif réalisé, cible CDC et taux de réalisation (%).
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
* LECTURE : taux < 50 % = strate fragile (résultats à présenter avec réserve) ;.
* taux > 150 % = strate sur-représentée (pèse trop dans les totaux bruts).

TITLE "T2.3 Récapitulatif des données valides et manquantes".
* Remplit le tableau "Récapitulatif des données" du rapport (N valides / N manquants).
FREQUENCIES VARIABLES=VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA LIEACHPR MONMOYAC
  PRACCABL PAIEPRIV IMPOMARQ MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH GAACPLSO DEAVHAGA
  CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO
  DEJDECAC IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI
  FIMEFOUR RFIDPRIX
  /FORMAT=NOTABLE.
* Repère : questions les plus "trouées" = ORASBAGA (52 % sans avis/NR), revenu (35 %),.
* ORASHAGA (34 %), MEQUAFIA / MEILPRIX (28 %), fourchettes de prix Q23 (22-27 %),.
* SUACMOGA (23 %), PRFRACLI (20 %), MAACPLSO (19 %), MONMOYAC (18 %).
* A ÉCRIRE : au-delà de 20 % de manquants, le résultat est donné "sur base réduite".
* et la base (n) est TOUJOURS citée sous le graphique.

TITLE "T2.4 Qualité de remplissage des fiches".
FREQUENCIES VARIABLES=QUAL_FICHE /BARCHART PERCENT.
MEANS TABLES=TX_REMPL NB_NR BY VILLEREG PROFIL4 /CELLS=MEAN MIN MAX COUNT.
* LECTURE : une ville ou un profil avec un remplissage nettement plus faible.
* signale un problème d'administration (enquêteur, longueur, cible réticente).

TITLE "T2.5 Contrôles de cohérence".
* (a) Filtre achat en ligne : qui n'a jamais acheté en ligne peut être prêt.
* à le faire ; ce tableau sert à vérifier qu'il n'y a pas de saisie absurde.
CROSSTABS /TABLES=DEJACHLI BY PRETACLI /FORMAT=AVALUE TABLES /CELLS=COUNT.
* (b) Consentement recontact : répartition EXACTEMENT 223 / 223 en V2.
* Une égalité parfaite est statistiquement suspecte : vérifier la saisie.
FREQUENCIES VARIABLES=ACCRECON.
* (c) Revenu du ménage : question pertinente pour les PARTICULIERS uniquement.
CROSSTABS /TABLES=REVMENME BY VOUSETES /FORMAT=AVALUE TABLES /CELLS=COUNT.
* (d) Lieu d'achat actuel "En ligne" (Q7) contre "déjà acheté en ligne" (Q37).
CROSSTABS /TABLES=LIEACHPR BY DEJACHLI /FORMAT=AVALUE TABLES /CELLS=COUNT.
* Un répondant qui achète principalement en ligne mais déclare n'avoir jamais.
* acheté en ligne = incohérence à corriger dans le masque.

* -------------------------------------------------------------------------.
* 2.6 Pondération de redressement (raking sur les marges du CDC).
* Marges : ville 40/40/20 ; profil 17/17/20/20/26 (particuliers, PME,.
* artisans, BTP, revendeurs) ; poids plafonnés à 4, puis moyenne ramenée à 1.
*.
* AVERTISSEMENT D'EXPERT (à reprendre dans la note méthodologique) :.
* Les quotas du CDC sont une RÉPARTITION DE TRAVAIL, pas la structure réelle.
* du marché (personne ne connaît le poids réel des BTP dans la demande).
* Redresser sur ces marges reproduit le plan prévu, PAS la population.
* De plus, avec BTP n=14, le plafond à 4 empêche d'atteindre la cible :.
* les marges pondérées resteront décalées pour le BTP. Conclusion :.
* - les résultats PAR PROFIL (bruts) sont les plus solides ;.
* - le total pondéré sert de "vue d'ensemble à structure CDC", rien de plus.
* -------------------------------------------------------------------------.
COMPUTE W = 1.
EXECUTE.

DEFINE !RAKING (n = !TOKENS(1))
!DO !i = 1 !TO !n
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES OVERWRITE=YES /BREAK=VILLEREG /SV=SUM(W).
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES OVERWRITE=YES /TOT=SUM(W).
DO IF (VILLEREG = 1 OR VILLEREG = 2).
COMPUTE W = W * 0.40 * TOT / SV.
ELSE IF (VILLEREG = 3).
COMPUTE W = W * 0.20 * TOT / SV.
END IF.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES OVERWRITE=YES /BREAK=VOUSETES /SP=SUM(W).
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES OVERWRITE=YES /TOT=SUM(W).
DO IF (VOUSETES = 1 OR VOUSETES = 2).
COMPUTE W = W * 0.17 * TOT / SP.
ELSE IF (VOUSETES = 3 OR VOUSETES = 4).
COMPUTE W = W * 0.20 * TOT / SP.
ELSE IF (VOUSETES = 5).
COMPUTE W = W * 0.26 * TOT / SP.
END IF.
!DOEND
!ENDDEFINE.

!RAKING n=30.

COMPUTE WT = MIN(W, 4).
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES OVERWRITE=YES /MWT=MEAN(WT).
COMPUTE WT = WT / MWT.
COMPUTE WT2 = WT * WT.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES OVERWRITE=YES /SW=SUM(WT) /SW2=SUM(WT2) /NBRUT=N.
COMPUTE NEFF = SW * SW / SW2.
COMPUTE DEFF = NBRUT / NEFF.
EXECUTE.
VARIABLE LABELS WT "Poids de redressement (raking CDC, plafonné à 4)"
  /NEFF "Taille effective de l'échantillon pondéré (Kish)"
  /DEFF "Effet de plan dû à la pondération".
FORMATS WT DEFF (F6.3) NEFF (F6.0).
DELETE VARIABLES W SV SP TOT MWT SW SW2.

TITLE "T2.6 Poids de redressement et taille effective".
DESCRIPTIVES VARIABLES=WT NEFF DEFF /STATISTICS=MEAN MIN MAX.
MEANS TABLES=WT BY VOUSETES VILLEREG /CELLS=MEAN MIN MAX COUNT.
* Repère attendu : poids de 0,3 à 4 ; NEFF voisin de 270 ; DEFF voisin de 1,65.
* A ÉCRIRE : "après redressement, l'échantillon équivaut à environ NEFF.
* répondants tirés au hasard ; les marges d'erreur sont élargies d'un facteur.
* racine(DEFF), soit environ x 1,3".

TITLE "T2.7 Contrôle des marges après pondération".
WEIGHT BY WT.
FREQUENCIES VARIABLES=VILLEREG VOUSETES CATEG3.
WEIGHT OFF.
* LECTURE : comparer aux cibles 40/40/20 et 17/17/20/20/26.
* L'écart restant sur le BTP est la conséquence directe du plafond à 4.

* =========================================================================.
* PARTIE 3 - PROFIL DES RÉPONDANTS (objectif CDC n°1 : profils socio-économiques).
* =========================================================================.
WEIGHT !POIDS.

TITLE "T3.1 Répartition des répondants par profil et par famille".
!FREQ v=VOUSETES PROFIL4 CATEG3.
* Repère : particuliers 38,6 % ; revendeurs 36,5 % ; artisans 11,9 % ;.
* PME 9,9 % ; BTP 3,1 %. A ÉCRIRE : rappeler que cette structure est celle de.
* l'échantillon, pas celle du marché (voir T2.1).

TITLE "T3.2 Profil des répondants par ville".
CROSSTABS /TABLES=VOUSETES BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN BPROP.
* Remplace les graphiques "Fréquences des cibles interrogées par ville".

TITLE "T3.3 Genre et âge des répondants".
!FREQ v=SEXMAFEM AGEREPON AGE3.
!TAB v=SEXMAFEM AGE3.
* Repère : 83,2 % d'hommes ; 25-44 ans = 73,8 %. A ÉCRIRE : marché porté par.
* des acheteurs masculins d'âge actif ; les femmes sont surtout présentes.
* chez les particuliers (à confirmer par le tableau croisé).

TITLE "T3.4 Revenu mensuel des ménages (particuliers)".
* Le revenu n'a de sens que pour les particuliers : filtre temporaire.
TEMPORARY.
SELECT IF (VOUSETES = 1).
FREQUENCIES VARIABLES=REVMEN_R /BARCHART PERCENT.
* A ÉCRIRE : distribution du revenu des ménages acheteurs, base = particuliers.
* ayant répondu (citer n). Ne pas commenter le revenu des entreprises.

* =========================================================================.
* PARTIE 4 - HABITUDES D'ACHAT (rapport : comportements d'achat).
* =========================================================================.

TITLE "T4.1 Fréquence d'achat de matériel électrique".
!FREQ v=FREQACHA.
!TAB v=FREQACHA.
* Repère : 32,3 % chaque semaine ; 42,2 % 1 à 3 fois par mois.
* LECTURE : les achats hebdomadaires viennent surtout des professionnels.
* (revendeurs, électriciens) : vérifier avec les lettres BPROP du tableau.

TITLE "T4.2 Lieu d'achat principal actuel".
!FREQ v=LIEACHPR.
!TAB v=LIEACHPR.
* Repère : grossistes spécialisés 35,1 % ; importateurs 19,1 % ; marché 18,7 % ;.
* quincailleries 17,3 % ; en ligne 1,1 %. A ÉCRIRE : le grossiste spécialisé.
* est le pivot de la distribution ; le canal en ligne est encore marginal.

TITLE "T4.3 Montant moyen par achat".
!FREQ v=MONMOYAC.
!TAB v=MONMOYAC.
* Repère : 25 000 - 100 000 FCFA = 39 % ; 100 000 - 500 000 = 30,5 %.

TITLE "T4.4 Dépense annuelle estimée par profil et par ville".
* Proxy calculé (point milieu des tranches x fréquence) : ordre de grandeur.
MEANS TABLES=MONTANT_FCFA ACHATS_AN DEPENSE_AN BY PROFIL4 VILLEREG
  /CELLS=MEAN MEDIAN COUNT.
* LECTURE : citer la MÉDIANE (robuste) plutôt que la moyenne, tirée par les.
* gros acheteurs. L'écart particuliers / revendeurs mesure le poids des.
* professionnels dans la valeur du marché, même s'ils sont moins nombreux.

TITLE "T4.5 Produits achetés (réponses multiples)".
MULT RESPONSE GROUPS=$PRODUITS "Q9. Familles de produits achetées" (PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU (1))
  /VARIABLES=PROFIL4 (1,4) VILLEREG (1,3)
  /FREQUENCIES=$PRODUITS
  /TABLES=$PRODUITS BY PROFIL4 VILLEREG
  /CELLS=COLUMN
  /BASE=CASES.
* LECTURE : la colonne "% des observations" (cas) est celle du rapport :.
* elle dit quelle part des répondants achète chaque famille.
* Le total dépasse 100 % (plusieurs réponses possibles).
* Repère : prises/interrupteurs 84,4 % ; câbles 80,3 % ; appareillage 78,0 % ;.
* luminaires 60,1 % ; solaire/onduleurs 21,8 % ; groupes électrogènes 10,0 %.
* A ÉCRIRE : un coeur de gamme "second oeuvre" (câbles, appareillage,.
* prises) acheté par presque tous ; le solaire est un marché de niche à suivre.

TITLE "T4.6 Mode de paiement privilégié".
!FREQ v=PAIEPRIV.
!TAB v=PAIEPRIV.
* Repère : espèces 82,2 % ; Mobile Money 8,2 % ; virement 7,5 % ;.
* crédit fournisseur 2,1 %. A ÉCRIRE : marché très "cash" ; le crédit.
* fournisseur reste rare, ce qui peut être un levier commercial pour les pros.

* =========================================================================.
* PARTIE 5 - MARQUES ET CRITÈRES DE CHOIX (objectifs CDC n°2 et n°3).
* =========================================================================.

TITLE "T5.1 Importance accordée à la marque".
!FREQ v=IMPOMARQ.
!TAB v=IMPOMARQ.
* Repère : très importante 36,4 % + importante 39,0 % = 75,4 %.

TITLE "T5.2 Principal critère de choix d'un produit".
!FREQ v=PRCRICHO.
!TAB v=PRCRICHO.
* Repère : qualité/durabilité 64,8 % ; prix 24,4 % ; disponibilité 5,9 %.
* A ÉCRIRE : le discours "qualité" domine ; le prix est le critère d'un quart.
* des acheteurs. Comparer avec Q25 (T7.6) : le déclaratif "qualité" cohabite.
* avec une recherche massive du meilleur rapport qualité/prix.

TITLE "T5.3 Marque achetée le plus souvent (détail)".
FREQUENCIES VARIABLES=MAACPLSO /FORMAT=DFREQ.
* NOTE : le questionnaire ne mesure PAS la notoriété (spontanée ou assistée).
* Ce tableau mesure la PÉNÉTRATION (marque la plus achetée). Ne pas titrer.
* "notoriété" dans le rapport sans le préciser.

TITLE "T5.4 Marque achetée le plus souvent (regroupée)".
FREQUENCIES VARIABLES=MARQUE_G /FORMAT=DFREQ /BARCHART PERCENT.
!TAB v=MARQUE_G.
* Repère : Schneider 28,5 % ; Yaki 18,6 % (recodé depuis "Autre") ;.
* autres hors Yaki 16,6 % ; Chint 15,5 % ; Legrand 13,0 %.
* A ÉCRIRE : Schneider leader ; Yaki, absente de la liste du questionnaire,.
* est la 2e marque citée : défaut du questionnaire à corriger pour une vague 2.

TITLE "T5.5 Part de marché des marques EN VALEUR (proxy)".
* Chaque répondant pèse selon sa dépense annuelle estimée (DEPENSE_AN).
* Lecture : part de la dépense totale captée par chaque marque.
WEIGHT BY DEPENSE_AN.
FREQUENCIES VARIABLES=MARQUE_G ORIG_MARQ /FORMAT=DFREQ.
WEIGHT !POIDS.
* A ÉCRIRE : comparer la part en VOLUME (T5.4) et la part en VALEUR (T5.5).
* Une marque dont la part en valeur dépasse la part en volume est achetée.
* par les gros acheteurs (professionnels) : c'est la marque des pros.
* Indiquer clairement : estimation fondée sur les tranches déclarées.

TITLE "T5.6 Marque achetée selon le critère de choix".
CROSSTABS /TABLES=MARQUE_G BY PRCRICHO GAACPLSO /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN BPROP.
* LECTURE : positionnement perçu de chaque marque (qualité, prix, gamme).

* =========================================================================.
* PARTIE 6 - ORIGINE DES PRODUITS (objectif CDC n°4 : part par origine).
* =========================================================================.

TITLE "T6.1 Origine privilégiée à l'achat".
!FREQ v=ORIGPRIV.
!TAB v=ORIGPRIV.
* Repère : aucune préférence 40,0 % ; Europe 30,3 % ; Asie 29,0 % ; Amérique 0,7 %.
* A ÉCRIRE : 4 acheteurs sur 10 n'ont pas de préférence d'origine ; Europe.
* et Asie font jeu égal dans les préférences déclarées.

TITLE "T6.2 Origine de la marque réellement achetée".
!FREQ v=ORIG_MARQ.
!TAB v=ORIG_MARQ.
* C'est la meilleure approximation disponible de la "part de marché par.
* origine" demandée par le CDC (en volume ; la valeur est en T5.5).

TITLE "T6.3 Préférence déclarée contre marque achetée".
CROSSTABS /TABLES=ORIGPRIV BY ORIG_MARQ /FORMAT=AVALUE TABLES /CELLS=COUNT ROW TOTAL.
* LECTURE : écart entre ce que les gens disent préférer et ce qu'ils achètent.
* Ex. : part des "préfère Europe" qui achètent une marque asiatique = demande.
* européenne non servie (problème de prix ou de disponibilité).

TITLE "T6.4 Origines jugées les meilleures (qualité, prix)".
!FREQ v=MEQUA_SA MEILP_SA.
* Version AVEC "Sans avis" : base = tous les répondants.
FREQUENCIES VARIABLES=MEQUAFIA MEILPRIX.
* Version SANS "Sans avis" : base = ceux qui ont un avis (V2).
* Repère (avec avis) : qualité = Europe 62,1 % ; prix = Asie 78,3 %.
* A ÉCRIRE LES DEUX : "parmi ceux qui ont un avis, ..." ET "x % n'ont pas.
* d'avis". Ne JAMAIS publier le seul pourcentage "avec avis" sans sa base.

TITLE "T6.5 Le dilemme qualité européenne / prix asiatique".
CROSSTABS /TABLES=MEQUAFIA BY MEILPRIX /FORMAT=AVALUE TABLES /CELLS=COUNT TOTAL.
!TAB v=DILEMME.
* LECTURE : part des répondants qui associent la qualité à l'Europe ET le prix.
* à l'Asie. C'est le coeur du positionnement : un distributeur qui offre.
* une "qualité européenne vérifiable à prix intermédiaire" vise cet espace.

TITLE "T6.6 Influence de l'origine sur la décision".
!FREQ v=ORINFACH.
!TAB v=ORINFACH.
* Repère : fortement 19,3 % ; modérément 28,5 % ; faiblement 18,6 % ;.
* pas du tout 33,6 %. A ÉCRIRE : l'origine influence la moitié des acheteurs.

TITLE "T6.7 Origine associée au haut et au bas de gamme".
!FREQ v=ORHG_SA ORBG_SA.
!TAB v=ORHG_SA ORBG_SA.
* Repère (avec avis) : haut de gamme = Europe 69,7 % ; bas de gamme = Asie 90,7 %.
* MAIS 222 répondants sur 446 n'associent aucune origine au bas de gamme.

* =========================================================================.
* PARTIE 7 - GAMMES ET ACCEPTABILITÉ DES PRIX.
* =========================================================================.

TITLE "T7.1 Gamme achetée le plus souvent".
!FREQ v=GAACPLSO.
!TAB v=GAACPLSO.
* Repère : moyenne gamme 51,0 % ; haut 19,6 % ; selon le projet 19,2 % ; bas 10,2 %.

TITLE "T7.2 Définition perçue du haut et du bas de gamme".
!FREQ v=DEAVHAGA CAAVBAGA.
!TAB v=DEAVHAGA CAAVBAGA.
* Repère : haut de gamme = durabilité/fiabilité 52,9 % ; bas de gamme = durée de.
* vie courte 43,5 %. A ÉCRIRE : la gamme se juge à la DURÉE DE VIE, pas à.
* l'origine (l'origine ne définit le haut de gamme que pour 2,3 %).

TITLE "T7.3 Prix attendus d'un disjoncteur selon la gamme".
FREQUENCIES VARIABLES=PXHAUTGA PXMOYEGA PXBASGAM.
CROSSTABS /TABLES=PXHAUTGA PXMOYEGA PXBASGAM BY PROFIL4 /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN.
* Repère : haut de gamme 15-40 000 FCFA (40,4 %) ; moyenne gamme 5-15 000 (48,7 %) ;.
* bas de gamme moins de 5 000 (77,7 %). A ÉCRIRE : grille de prix psychologique.
* du marché, directement exploitable pour la politique tarifaire.

TITLE "T7.4 Écart de qualité perçu entre gammes".
!FREQ v=ECQUHABA.
!TAB v=ECQUHABA.
* Repère : très important + important = 72,3 %.

TITLE "T7.5 Priorité principale à l'achat".
!FREQ v=PRIOPRIN.
!TAB v=PRIOPRIN.
* Repère : meilleur rapport qualité/prix 71,3 % ; qualité à tout prix 16,7 % ;.
* le moins cher 11,9 %.

TITLE "T7.6 Surcoût accepté pour monter en gamme".
!FREQ v=SUACMOGA.
!TAB v=SUACMOGA.
MEANS TABLES=SURCOUT_PCT BY PROFIL4 VILLEREG GAACPLSO /CELLS=MEAN MEDIAN COUNT.
* Repère : aucun 31,6 % ; jusqu'à +10 % 49,7 % ; plus de 10 % = 18,7 %.
* A ÉCRIRE : la prime de montée en gamme acceptée est faible (médiane de.
* l'ordre de +5 %) : la qualité doit être prouvée, pas seulement facturée.

* =========================================================================.
* PARTIE 8 - FREINS, CONTREFAÇON ET DÉCEPTIONS (proxy de satisfaction).
* =========================================================================.
* NOTE : le questionnaire ne contient pas de question de satisfaction globale.
* La déception passée (Q29) et la crainte de contrefaçon (Q28) en tiennent lieu.

TITLE "T8.1 Principal frein à l'achat".
!FREQ v=PRINFREI.
!TAB v=PRINFREI.
* Repère : doute qualité/contrefaçon 36,2 % ; prix élevé 35,9 % ;.
* indisponibilité 19,2 %.

TITLE "T8.2 Crainte d'acheter un produit contrefait".
!FREQ v=CRACPRCO.
!TAB v=CRACPRCO.
* Repère : souvent 45,6 % ; parfois 35,1 % : 8 acheteurs sur 10 concernés.

TITLE "T8.3 Déceptions passées".
!FREQ v=DEJDECAC.
!TAB v=DEJDECAC.
* Repère : déjà déçu 79,2 % dont plusieurs fois 62,8 %.
* A ÉCRIRE : c'est LE constat central de l'étude : un marché où l'acheteur.
* a appris à se méfier. La confiance (authenticité, garantie) est l'actif rare.

TITLE "T8.4 Déception et crainte selon la gamme achetée".
CROSSTABS /TABLES=DEJDECAC CRACPRCO BY GAACPLSO ORIG_MARQ /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN BPROP.
* LECTURE : les acheteurs de bas de gamme / marques non classées sont-ils plus.
* souvent déçus ? Si oui, argument chiffré pour une offre "qualité garantie".

* =========================================================================.
* PARTIE 9 - SERVICE APRÈS-VENTE ET GARANTIE (objectif CDC n°5 : attentes).
* =========================================================================.

TITLE "T9.1 Importance du service client et du SAV".
!FREQ v=IMSECSAV.
!TAB v=IMSECSAV.
* Repère : très important 38,8 % + important 45,0 % = 83,8 %.

TITLE "T9.2 Service attendu en priorité".
!FREQ v=SEATPRIO.
!TAB v=SEATPRIO.
* Repère : garantie/remplacement 62,8 % ; conseil technique 20,5 %.

TITLE "T9.3 Durée de garantie jugée acceptable".
!FREQ v=DUGAJUAC.
!TAB v=DUGAJUAC.
MEANS TABLES=GARANTIE_MOIS BY PROFIL4 VILLEREG /CELLS=MEAN MEDIAN COUNT.
* Repère : moins de 6 mois 41,3 % ; 6 mois - 1 an 43,4 %.
* A ÉCRIRE : l'attente porte sur la CERTITUDE d'un remplacement rapide, pas.
* sur une garantie longue : une garantie 12 mois "échange immédiat" suffit.

TITLE "T9.4 Canal de contact préféré".
!FREQ v=CACOPREF.
!TAB v=CACOPREF.
* Repère : en personne 60,7 % ; WhatsApp 20,1 % ; téléphone 17,8 %.

TITLE "T9.5 Disposition à payer plus pour un bon SAV".
!FREQ v=BOSAPACH.
!TAB v=BOSAPACH.
* Repère : oui 23,8 % ; peut-être 43,4 % ; non 32,8 %.
* A ÉCRIRE : 2 sur 3 ouverts (oui + peut-être), mais seulement 1 sur 4 ferme.

* =========================================================================.
* PARTIE 10 - CANAUX DE DISTRIBUTION ET ACHAT EN LIGNE.
* =========================================================================.

TITLE "T10.1 Canal d'achat préféré".
!FREQ v=CANAPREF.
!TAB v=CANAPREF.

TITLE "T10.2 Canal actuel contre canal préféré (migration)".
CROSSTABS /TABLES=LIEU_ACT BY CANAPREF /FORMAT=AVALUE TABLES
  /STATISTICS=MCNEMAR
  /CELLS=COUNT ROW TOTAL.
* LECTURE : la diagonale = clients satisfaits de leur canal actuel ;.
* hors diagonale = flux de migration souhaités (ex. quincaillerie -> grossiste).
* Le test de McNemar-Bowker dit si les migrations sont globalement.
* déséquilibrées (p<0,05 = un canal gagne au détriment d'un autre).

TITLE "T10.3 Critère de choix du canal".
!FREQ v=CRCHCANA.
!TAB v=CRCHCANA.
* Repère : prix 29,6 % ; largeur du choix 20,7 % ; confiance 18,9 % ;.
* proximité 16,3 %.

TITLE "T10.4 Achat en ligne : expérience et intention".
!FREQ v=DEJACHLI PRETACLI.
!TAB v=DEJACHLI PRETACLI.
* Repère : déjà acheté en ligne 28,5 % ; prêt : oui 20,9 %, peut-être 29,2 %,.
* non 49,9 %.

TITLE "T10.5 Principal frein à l'achat en ligne".
!FREQ v=PRFRACLI.
!TAB v=PRFRACLI.
* Repère : qualité/conformité 37,2 % ; ne pas voir le produit 34,9 %.
* A ÉCRIRE : les deux premiers freins sont des freins de CONFIANCE produit,.
* pas de logistique : un modèle "click and collect" avec vérification sur.
* place répond aux deux à la fois.

TITLE "T10.6 Intention d'achat en ligne selon l'expérience".
CROSSTABS /TABLES=PRETACLI BY DEJACHLI MONMOYAC IMSECSAV AGE3 /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN BPROP.

* =========================================================================.
* PARTIE 11 - FIDÉLISATION.
* =========================================================================.

TITLE "T11.1 Fidélité à un même fournisseur".
!FREQ v=FIMEFOUR.
!TAB v=FIMEFOUR.
* Repère : toujours 22,0 % + souvent 32,5 % = 54,5 % de fidèles.

TITLE "T11.2 Leviers de fidélité (réponses multiples)".
MULT RESPONSE GROUPS=$FIDELITE "Q41. Ce qui renforcerait la fidélité" (RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE (1))
  /VARIABLES=PROFIL4 (1,4) VILLEREG (1,3)
  /FREQUENCIES=$FIDELITE
  /TABLES=$FIDELITE BY PROFIL4 VILLEREG
  /CELLS=COLUMN
  /BASE=CASES.
* Repère : prix/promotions 35,7 % ; qualité constante 33,8 % ; stock 19,8 %.
* SAV fiable 5,1 % seulement : contradiction apparente avec T9.1 (SAV important.
* à 84 %). A ÉCRIRE : le SAV est un critère d'exigence (sa défaillance fait.
* fuir), pas un levier de fidélisation (sa présence ne retient pas seule).

* =========================================================================.
* PARTIE 12 - INDICES SYNTHÉTIQUES : COMPARAISON DES VILLES ET DES PROFILS.
* =========================================================================.
WEIGHT OFF.

TITLE "T12.1 Indices d'attitude (0-100) par profil".
MEANS TABLES=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV BY PROFIL4
  /CELLS=MEAN COUNT STDDEV
  /STATISTICS=ANOVA.
* LECTURE : un indice de 70 = attitude forte. Le tableau ANOVA donne la.
* significativité de l'écart entre profils (Sig. < 0,05) et l'Eta carré la.
* part de l'écart expliquée par le profil (0,01 faible ; 0,06 moyen ; 0,14 fort).

TITLE "T12.2 Indices d'attitude (0-100) par ville".
MEANS TABLES=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV BY VILLEREG
  /CELLS=MEAN COUNT STDDEV
  /STATISTICS=ANOVA.

TITLE "T12.3 Confirmation non paramétrique (Kruskal-Wallis)".
* Les indices viennent d'échelles ordinales : ce test confirme l'ANOVA.
NPAR TESTS /K-W=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV BY VILLEREG(1,3).
NPAR TESTS /K-W=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV BY PROFIL4(1,4).
* A ÉCRIRE : ne retenir comme "différence entre villes/profils" que les écarts.
* significatifs dans LES DEUX tests (ANOVA et Kruskal-Wallis).

* =========================================================================.
* PARTIE 13 - TESTS D'ASSOCIATION ET CORRÉLATIONS (données non pondérées).
* =========================================================================.

TITLE "T13.1 Khi-deux et V de Cramer : comportements".
!TEST v=PRCRICHO GAACPLSO ORIGPRIV FIMEFOUR.
TITLE "T13.2 Khi-deux et V de Cramer : attentes et canaux".
!TEST v=PRETACLI BOSAPACH CANAPREF SEATPRIO.
* LECTURE EN 3 TEMPS :.
* 1) Sig. du khi-deux de Pearson < 0,05 = lien statistiquement établi.
*    Vérifier la note "cellules d'effectif théorique < 5" : si plus de 20 %,.
*    le test est fragile (regrouper des modalités).
* 2) V de Cramer = intensité : < 0,10 négligeable ; 0,10-0,20 faible ;.
*    0,20-0,30 moyenne ; > 0,30 forte.
* 3) Résidus ajustés : une cellule > +1,96 est sur-représentée, < -1,96.
*    sous-représentée. C'est ce qui permet d'écrire "les revendeurs sont.
*    significativement plus nombreux à...".

TITLE "T13.3 Corrélations de Spearman entre attitudes".
* Grâce aux scores orientés (partie 1.5), un rho POSITIF signifie :.
* "plus l'un est fort, plus l'autre est fort". Lecture directe.
NONPAR CORR
  /VARIABLES=S_ONLINE S_PAYSAV WITH AGEREPON REVMEN_R S_FREQ MONMOYAC S_MARQUE S_SAV S_ORIGINE S_CONTREF S_DECEP S_FIDEL S_ECART SUACMOGA GARANTIE_MOIS
  /PRINT=SPEARMAN TWOTAIL NOSIG
  /MISSING=PAIRWISE.
* Repère (V2, signes remis dans le bon sens) : disposition à payer le SAV.
* liée à l'importance du SAV (rho ~0,28), de la marque (~0,23), à l'écart de.
* qualité perçu (~0,21). Intensité : |rho| < 0,20 faible ; 0,20-0,40 modérée.

* =========================================================================.
* PARTIE 14 - MODÈLES EXPLICATIFS (régression logistique, module Regression).
* =========================================================================.
* RÈGLE D'EXPERT : environ 10 événements par paramètre estimé au minimum.
* Ex. intention ferme en ligne : ~58 événements => 5 à 6 paramètres maximum.
* Les modèles "complets" de la V2 (12 paramètres) sont donc EXPLORATOIRES :.
* on présente dans le rapport le modèle PRINCIPAL (parcimonieux).
* LECTURE : Exp(B) = rapport de cotes (odds ratio). 2,0 = deux fois plus de.
* chances d'être "Oui" ; 0,5 = deux fois moins. Retenir si Sig. < 0,05 ET.
* si l'intervalle de confiance 95 % ne contient pas 1.
* Qualité : R2 de Nagelkerke (part expliquée) ; test de Hosmer-Lemeshow.
* (Sig. > 0,05 = bon ajustement) ; tableau de classement.

TITLE "T14.1 Qui est prêt à acheter en ligne ? Modèle principal".
LOGISTIC REGRESSION VARIABLES ONLIN_FERME
  /METHOD=ENTER VILLEREG SAV_TRESIMP MONT_100K DECU
  /CATEGORICAL=VILLEREG
  /CONTRAST (VILLEREG)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).
* Référence ville = Douala. Repère V2 : Bafoussam nettement moins disposé.
* (OR ~0,2) ; SAV très important (OR ~3) et achats >= 100 000 (OR ~2,8).
* augmentent l'intention ferme.

TITLE "T14.2 Achat en ligne : modèle complet exploratoire".
LOGISTIC REGRESSION VARIABLES ONLIN_FERME
  /METHOD=ENTER VILLEREG PROFIL4 AGE3 SAV_TRESIMP MONT_100K HEBDO MARQ_TRESIMP DECU
  /CATEGORICAL=VILLEREG PROFIL4 AGE3
  /CONTRAST (VILLEREG)=INDICATOR(1)
  /CONTRAST (PROFIL4)=INDICATOR(1)
  /CONTRAST (AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).
* A citer en annexe seulement (sur-paramétré).

TITLE "T14.3 Intention potentielle d'achat en ligne".
LOGISTIC REGRESSION VARIABLES ONLIN_POT
  /METHOD=ENTER VILLEREG PROFIL4 AGE3 SAV_TRESIMP MONT_100K HEBDO MARQ_TRESIMP DECU
  /CATEGORICAL=VILLEREG PROFIL4 AGE3
  /CONTRAST (VILLEREG)=INDICATOR(1)
  /CONTRAST (PROFIL4)=INDICATOR(1)
  /CONTRAST (AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).
* Environ 149 événements : ce modèle supporte 8 variables. Repère V2 : les.
* déçus (OR ~2,8) sont plus ouverts au "peut-être" : l'insatisfaction actuelle.
* pousse à chercher d'autres canaux.

TITLE "T14.4 Qui paierait plus pour un bon SAV ?".
LOGISTIC REGRESSION VARIABLES SAV_POT
  /METHOD=ENTER VILLEREG PROFIL4 AGE3 SAV_TRESIMP MARQ_TRESIMP HAUTGAMME DECU FIDELE MONT_100K
  /CATEGORICAL=VILLEREG PROFIL4 AGE3
  /CONTRAST (VILLEREG)=INDICATOR(1)
  /CONTRAST (PROFIL4)=INDICATOR(1)
  /CONTRAST (AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).
* Environ 207 événements : modèle robuste. Repère V2 : 45 ans et plus (OR ~5),.
* acheteurs haut de gamme (OR ~3,4), déçus (OR ~3,2), fidèles (OR ~2,1).
* A ÉCRIRE : la cible prioritaire d'une offre "SAV premium" est identifiée.

TITLE "T14.5 Paiement ferme du SAV (Oui seulement)".
LOGISTIC REGRESSION VARIABLES SAV_OUI
  /METHOD=ENTER PROFIL4 SAV_TRESIMP HAUTGAMME AGE3
  /CATEGORICAL=PROFIL4 AGE3
  /CONTRAST (PROFIL4)=INDICATOR(1)
  /CONTRAST (AGE3)=INDICATOR(1)
  /PRINT=GOODFIT CI(95)
  /CRITERIA=PIN(.05) POUT(.10) ITERATE(20) CUT(.5).
* Environ 66 événements : modèle réduit à 7 paramètres.

* =========================================================================.
* PARTIE 15 - SEGMENTATION ET CARTOGRAPHIES (CDC : cartographie des préférences).
* =========================================================================.

TITLE "T15.1 Segmentation des acheteurs (TwoStep, 4 segments)".
* ATTENTION : TwoStep dépend de l'ordre des fiches. Ne pas trier le fichier.
* entre deux exécutions si l'on veut des segments reproductibles.
* Structure faible lors des essais (silhouette ~0,09) : segments à présenter.
* comme des "profils types", pas comme des groupes nettement séparés.
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
CROSSTABS /TABLES=PROFIL4 VILLEREG PRCRICHO GAACPLSO ORIGPRIV PRETACLI BOSAPACH BY SEGMENT
  /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN BPROP.
MEANS TABLES=IDX_MARQUE IDX_SAV IDX_CONTREF IDX_FIDEL IDX_ONLINE IDX_PAYSAV DEPENSE_AN BY SEGMENT
  /CELLS=MEAN MEDIAN COUNT.
* NOMMER chaque segment d'après ses traits dominants (ex. V2 : "Exigeants.
* premium connectés", "Chasseurs de prix", "Prudents anti-contrefaçon",.
* "Qualité milieu de gamme"). Les segments TwoStep ne coïncident pas.
* exactement avec ceux de la V2 (calculés par K-means hors SPSS).
* A ÉCRIRE pour chaque segment : poids (%), qui (profil, ville), ce qu'il.
* veut, ce qu'il dépense, comment le capter.

TITLE "T15.3 Carte des marques par ville (AFC)".
* Module Categories requis.
CORRESPONDENCE TABLE=MARQUE_G(1,7) BY VILLEREG(1,3)
  /DIMENSIONS=2
  /MEASURE=CHISQ
  /STANDARDIZE=RCMEAN
  /NORMALIZATION=SYMMETRICAL
  /PRINT=TABLE RPOINTS CPOINTS
  /PLOT=NDIM(1,MAX) BIPLOT(20).

TITLE "T15.4 Carte des marques par profil (AFC)".
CORRESPONDENCE TABLE=MARQUE_G(1,7) BY PROFIL4(1,4)
  /DIMENSIONS=2
  /MEASURE=CHISQ
  /STANDARDIZE=RCMEAN
  /NORMALIZATION=SYMMETRICAL
  /PRINT=TABLE RPOINTS CPOINTS
  /PLOT=NDIM(1,MAX) BIPLOT(20).
* LECTURE AFC : deux points proches sur la carte = associés (la marque est.
* sur-représentée dans ce profil/cette ville). Commenter seulement les axes.
* qui expliquent une part notable de l'inertie (tableau "Récapitulatif").

TITLE "T15.5 Carte du marché (ACM)".
* Module Categories requis. Carte globale profils x comportements.
MULTIPLE CORRESPONDENCE VARIABLES=PROFIL4 AGE3 LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF
  /ANALYSIS=PROFIL4 AGE3 LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF
  /DIMENSION=2
  /NORMALIZATION=VPRINCIPAL
  /PRINT=CORR DISCRIM
  /PLOT=JOINTCAT DISCRIM.
* LECTURE : "Mesures de discrimination" = variables qui structurent le plus.
* chaque axe ; "Diagramme joint des points de modalité" = carte à commenter.

* =========================================================================.
* PARTIE 16 - TABLEAU DE BORD DES INDICATEURS CLÉS (pondéré CDC, IC 95 %).
* =========================================================================.
* Ce sont les CHIFFRES CLÉS de la synthèse du rapport.
* Pour chaque indicateur : % brut, % pondéré (structure CDC), intervalle de.
* confiance à 95 % calculé sur la TAILLE EFFECTIVE (Kish), donc honnête.
* A ÉCRIRE : "x % (IC 95 % : a - b)". Deux indicateurs dont les IC se.
* chevauchent largement ne doivent pas être présentés comme différents.

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

* 16.1 Ensemble de l'échantillon.
DATASET DECLARE KPI_TOT.
AGGREGATE /OUTFILE=KPI_TOT /BREAK=INDIC
  /P_BRUT=MEAN(VALEUR) /N_BRUT=N(VALEUR) /SW=SUM(WT) /SVW=SUM(VALW) /SW2=SUM(WT2).
DATASET ACTIVATE KPI_TOT.
COMPUTE P_POND = SVW / SW.
COMPUTE NEFF_I = SW * SW / SW2.
COMPUTE ERR = 1.96 * SQRT(P_POND * (1 - P_POND) / NEFF_I).
COMPUTE IC_BAS = 100 * MAX(0, P_POND - ERR).
COMPUTE IC_HAUT = 100 * MIN(1, P_POND + ERR).
COMPUTE P_BRUT = 100 * P_BRUT.
COMPUTE P_POND = 100 * P_POND.
VARIABLE LABELS P_BRUT "% brut" /P_POND "% pondéré (structure CDC)" /IC_BAS "IC 95 % bas"
  /IC_HAUT "IC 95 % haut" /N_BRUT "Base (n répondants)" /NEFF_I "Taille effective".
FORMATS P_BRUT P_POND IC_BAS IC_HAUT (F5.1) N_BRUT NEFF_I (F5.0).
SUMMARIZE /TABLES=INDIC P_BRUT P_POND IC_BAS IC_HAUT N_BRUT NEFF_I
  /FORMAT=LIST NOCASENUM NOTOTAL
  /TITLE="T16.1 Chiffres clés de l'étude : ensemble (IC 95 % sur taille effective)"
  /MISSING=VARIABLE
  /CELLS=NONE.

* 16.2 Par profil (% pondérés par la ville à l'intérieur de chaque profil).
DATASET ACTIVATE KPI_LONG.
DATASET DECLARE KPI_PROF.
AGGREGATE /OUTFILE=KPI_PROF /BREAK=INDIC PROFIL4 /SW=SUM(WT) /SVW=SUM(VALW) /NB=N(VALEUR).
DATASET ACTIVATE KPI_PROF.
SELECT IF NOT MISSING(PROFIL4).
COMPUTE P = 100 * SVW / SW.
FORMATS P (F5.1) NB (F5.0).
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

* 16.3 Par ville.
DATASET ACTIVATE KPI_LONG.
DATASET DECLARE KPI_VILLE.
AGGREGATE /OUTFILE=KPI_VILLE /BREAK=INDIC VILLEREG /SW=SUM(WT) /SVW=SUM(VALW) /NB=N(VALEUR).
DATASET ACTIVATE KPI_VILLE.
SELECT IF NOT MISSING(VILLEREG).
COMPUTE P = 100 * SVW / SW.
FORMATS P (F5.1) NB (F5.0).
DELETE VARIABLES SW SVW.
SORT CASES BY INDIC VILLEREG.
CASESTOVARS /ID=INDIC /INDEX=VILLEREG /SEPARATOR="_" /GROUPBY=VARIABLE.
VARIABLE LABELS P_1 "Douala %" /P_2 "Yaoundé %" /P_3 "Bafoussam %"
  /NB_1 "n Douala" /NB_2 "n Yaoundé" /NB_3 "n Bafoussam".
SUMMARIZE /TABLES=INDIC P_1 P_2 P_3 NB_1 NB_2 NB_3
  /FORMAT=LIST NOCASENUM NOTOTAL
  /TITLE="T16.3 Chiffres clés par ville (%, pondérés par profil)"
  /MISSING=VARIABLE
  /CELLS=NONE.

DATASET ACTIVATE EDM_EE.
DATASET CLOSE KPI_LONG.
DATASET CLOSE KPI_TOT.
DATASET CLOSE KPI_PROF.
DATASET CLOSE KPI_VILLE.

TITLE "T16.4 Tris à plat pondérés (structure CDC)".
WEIGHT BY WT.
FREQUENCIES VARIABLES=FREQACHA LIEACHPR MONMOYAC PAIEPRIV PRCRICHO MARQUE_G ORIG_MARQ ORIGPRIV
  GAACPLSO PRINFREI SEATPRIO CANAPREF PRETACLI FIMEFOUR.
MULT RESPONSE GROUPS=$PRODUITS "Q9. Familles de produits achetées (pondéré)" (PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU (1))
  /FREQUENCIES=$PRODUITS.
MULT RESPONSE GROUPS=$FIDELITE "Q41. Leviers de fidélité (pondéré)" (RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE (1))
  /FREQUENCIES=$FIDELITE.
WEIGHT OFF.

* =========================================================================.
* PARTIE 17 - CONTRÔLES FINAUX, SAUVEGARDE ET EXPORT.
* =========================================================================.

TITLE "T17.1 Contrôle final des variables créées".
FREQUENCIES VARIABLES=PROFIL4 CATEG3 AGE3 MARQUE_G ORIG_MARQ SEGMENT ONLIN_FERME SAV_POT DILEMME /FORMAT=NOTABLE.
DESCRIPTIVES VARIABLES=IDX_MARQUE IDX_SAV IDX_ORIGINE IDX_CONTREF IDX_FIDEL IDX_DECEP IDX_ONLINE IDX_PAYSAV DEPENSE_AN WT
  /STATISTICS=MEAN STDDEV MIN MAX.
* Effectif attendu : 446. Les indices doivent rester entre 0 et 100.
* Vérifier le N valide de chaque modèle (partie 14) : SPSS exclut une fiche.
* dès qu'une variable du modèle est manquante.

* Sauvegarde du fichier enrichi (variables dérivées, poids, segments).
SAVE OUTFILE='SPSS_EDM_EE_ANALYSE_V3.sav' /COMPRESSED.

* EXPORT VERS WORD / EXCEL (facultatif) : retirer l'astérisque des 3 lignes.
* suivantes et adapter le chemin. Sinon : Fichier > Exporter dans les résultats.
* OUTPUT EXPORT /CONTENTS EXPORT=VISIBLE LAYERS=PRINTSETTING MODELVIEWS=PRINTSETTING.
*   /DOC DOCUMENTFILE='EDM_EE_RESULTATS_V3.docx'.
*   /XLSX DOCUMENTFILE='EDM_EE_RESULTATS_V3.xlsx'.

* =========================================================================.
* ANNEXE (facultative) - PERFORMANCE DES ENQUÊTEURS.
* Le .sav actuel (56 variables) ne contient PAS l'identifiant enquêteur.
* Si CODEENQU est ajouté au fichier, exécuter la ligne : !ENQUETEURS.
* =========================================================================.
DEFINE !ENQUETEURS ()
TITLE "TA.1 Production et qualité par enquêteur".
CROSSTABS /TABLES=CODEENQU BY VILLEREG VOUSETES /FORMAT=AVALUE TABLES /CELLS=COUNT.
MEANS TABLES=TX_REMPL NB_NR BY CODEENQU /CELLS=MEAN MIN COUNT.
CROSSTABS /TABLES=CODEENQU BY ACCRECON DEJDECAC PRETACLI /FORMAT=AVALUE TABLES /STATISTICS=CHISQ /CELLS=COUNT ROW.
!ENDDEFINE.
* LECTURE : un enquêteur dont les réponses diffèrent fortement des autres.
* (khi-deux très significatif) ou dont le remplissage est très bas = fiches.
* à contrôler par rappel téléphonique avant de valider la base.

* FIN DE LA SYNTAXE.
