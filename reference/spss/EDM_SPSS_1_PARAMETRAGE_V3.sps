* Encoding: UTF-8.
* ==========================================================================.
* EDM ÉLECTRIQUE CAMEROUN (Douala, Yaoundé, Bafoussam) — THE PLUG.
* SCRIPT 1 / 2 : PARAMÉTRAGE DE LA BASE SPSS.
*
* CE QUE FAIT CE SCRIPT (rien à modifier) :
*   1. Lit C:\ETUDE_EDM\EXPORT_SPSS.csv (onglet EXPORT_SPSS du Google Sheet, téléchargé en .csv).
*      Lancement conseillé : EDM_SPSS_0_LANCER_TOUT.sps (trouve et vérifie le .csv tout seul).
*   2. Retire la ligne modèle, les lignes vides et les fiches marquées REJETE.
*   3. Donne à chaque colonne son format, son libellé, ses modalités (1 = Homme...),
*      ses valeurs manquantes (97 NA, 98 NSP, 99 NR) et son niveau de mesure.
*   4. Crée les ensembles à réponses multiples (Q9 et Q41) et deux pondérations.
*   5. Affiche des contrôles de qualité puis enregistre EDM_ELECTRIQUE_CAMEROUN.sav.
*
* Dictionnaire identique au Google Sheet EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL,
* onglet MASQUE_DEPOUILLEMENT : 67 colonnes, de A (NUMFICHE) à BO (STATUTQC).
* VERSION 3 : questionnaire « 03 » (Q1 à Q42) + quotas du cahier des charges « 02 ».
* Lancement : EDM_SPSS_0_LANCER_TOUT.sps, ou ici menu Exécuter > Tout.
* ==========================================================================.

DATASET CLOSE ALL.
NEW FILE.

* --------------------------------------------------------------------------.
* 1. LECTURE DU FICHIER CSV (toutes les colonnes lues en texte, puis converties).
* --------------------------------------------------------------------------.
SET DECIMAL=DOT.
GET DATA
  /TYPE=TXT
  /FILE='C:\ETUDE_EDM\EXPORT_SPSS.csv'
  /ENCODING='UTF8'
  /DELCASE=LINE
  /DELIMITERS=","
  /QUALIFIER='"'
  /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2
  /VARIABLES=
    NUMFICHE A20
    CODEENQU A10
    CODEZONE A10
    QUARTIER A60
    SITEENQU A80
    DATEENQU A40
    HEUREENQ A60
    DELAIPRE A10
    ACCRECON A10
    VOUSETES A10
    SEXMAFEM A10
    AGEREPON A10
    VILLEREG A10
    REVMENME A10
    FREQACHA A10
    LIEACHPR A10
    MONMOYAC A10
    PRACCABL A10
    PRACAPPA A10
    PRACPRIS A10
    PRACLUMI A10
    PRACSOLA A10
    PRACGROU A10
    PAIEPRIV A10
    IMPOMARQ A10
    MAACPLSO A10
    MAACAUTR A80
    PRCRICHO A10
    ORIGPRIV A10
    MEQUAFIA A10
    MEILPRIX A10
    ORINFACH A10
    GAACPLSO A10
    DEAVHAGA A10
    CAAVBAGA A10
    ORASHAGA A10
    ORASBAGA A10
    PXHAUTGA A10
    PXMOYEGA A10
    PXBASGAM A10
    ECQUHABA A10
    PRIOPRIN A10
    SUACMOGA A10
    PRINFREI A10
    CRACPRCO A10
    DEJDECAC A10
    IMSECSAV A10
    SEATPRIO A10
    DUGAJUAC A10
    CACOPREF A10
    BOSAPACH A10
    CANAPREF A10
    CRCHCANA A10
    DEJACHLI A10
    PRETACLI A10
    PRFRACLI A10
    FIMEFOUR A10
    RFIDPRIX A10
    RFIDQUAL A10
    RFIDSTOC A10
    RFIDCONS A10
    RFIDSAVF A10
    RFIDPROG A10
    RFIDPAIE A10
    SUGGATTE A500
    ANOMALIE A200
    STATUTQC A10.
EXECUTE.
DATASET NAME EDM_ELEC WINDOW=FRONT.

* Heure : garde « HH:MM » même si Google Sheets l'a exportée en date complète.
IF (CHAR.INDEX(HEUREENQ, ':') > 2) HEUREENQ = CHAR.SUBSTR(HEUREENQ, CHAR.INDEX(HEUREENQ, ':') - 2, 5).
EXECUTE.

* Mise au bon format (texte -> nombre pour les questions codées).
* (texte ou nombre : ALTER TYPE convertit dans les deux cas).
ALTER TYPE NUMFICHE (A20).
ALTER TYPE CODEENQU (A6).
ALTER TYPE QUARTIER (A60).
ALTER TYPE SITEENQU (A80).
ALTER TYPE DATEENQU (A40).
ALTER TYPE HEUREENQ (A8).
ALTER TYPE MAACAUTR (A80).
ALTER TYPE SUGGATTE (A500).
ALTER TYPE ANOMALIE (A200).
ALTER TYPE STATUTQC (A10).
ALTER TYPE
  CODEZONE DELAIPRE ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME
  FREQACHA LIEACHPR MONMOYAC PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA
  PRACGROU PAIEPRIV IMPOMARQ MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX
  ORINFACH GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA PXMOYEGA
  PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC IMSECSAV
  SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI
  PRFRACLI FIMEFOUR RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG
  RFIDPAIE
  (F4.0).

* >>> BLOC_TEST_DEBUT (repère technique, ne pas supprimer).
* --------------------------------------------------------------------------.
* 2. NETTOYAGE : ligne modèle, lignes vides, fiches REJETE.
* --------------------------------------------------------------------------.
SELECT IF (LTRIM(NUMFICHE) <> '' AND INDEX(UPCASE(NUMFICHE), 'GABARIT') = 0).
SELECT IF (UPCASE(LTRIM(STATUTQC)) <> 'REJETE').
EXECUTE.

* Date : accepte 28/09/2026, 2026-09-28, 28-SEP-2026 ou un numéro de série Excel.
STRING D_TXT (A40).
COMPUTE D_TXT = LTRIM(DATEENQU).
COMPUTE D_C3 = INDEX('0123456789', SUBSTR(CONCAT(RTRIM(D_TXT), '#####'), 3, 1)) > 0.
COMPUTE D_C4 = INDEX('0123456789', SUBSTR(CONCAT(RTRIM(D_TXT), '#####'), 4, 1)) > 0.
COMPUTE D_C5 = INDEX('0123456789', SUBSTR(CONCAT(RTRIM(D_TXT), '#####'), 5, 1)) > 0.
COMPUTE D_NUM = $SYSMIS.
DO IF (LENGTH(RTRIM(D_TXT)) >= 10 AND D_C3 = 0 AND D_C4 = 1).
+  COMPUTE D_NUM = NUMBER(SUBSTR(D_TXT, 1, 10), EDATE10).
ELSE IF (LENGTH(RTRIM(D_TXT)) >= 11 AND D_C3 = 0 AND D_C4 = 0).
+  COMPUTE D_NUM = NUMBER(SUBSTR(D_TXT, 1, 11), DATE11).
ELSE IF (LENGTH(RTRIM(D_TXT)) >= 10 AND D_C3 = 1 AND D_C4 = 1 AND D_C5 = 0).
+  COMPUTE D_NUM = NUMBER(SUBSTR(D_TXT, 1, 10), SDATE10).
ELSE IF (LENGTH(RTRIM(D_TXT)) > 0).
+  COMPUTE D_SER = NUMBER(D_TXT, F16.0).
+  IF (D_SER > 30000 AND D_SER < 80000) D_NUM = DATE.DMY(30, 12, 1899) + TRUNC(D_SER) * 86400.
END IF.
EXECUTE.
DELETE VARIABLES DATEENQU D_TXT D_C3 D_C4 D_C5.
RENAME VARIABLES (D_NUM = DATEENQU).
FORMATS DATEENQU (EDATE10).

* Remise des colonnes dans l'ordre exact du masque.
MATCH FILES /FILE=*
  /KEEP=
    NUMFICHE CODEENQU CODEZONE QUARTIER SITEENQU DATEENQU HEUREENQ DELAIPRE
    ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA LIEACHPR
    MONMOYAC PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU PAIEPRIV
    IMPOMARQ MAACPLSO MAACAUTR PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH
    GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA PXMOYEGA PXBASGAM
    ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC IMSECSAV SEATPRIO
    DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI
    FIMEFOUR RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE
    SUGGATTE ANOMALIE STATUTQC
.
EXECUTE.

* --------------------------------------------------------------------------.
* 3. DICTIONNAIRE (libellés, modalités, manquants, mesure).
* --------------------------------------------------------------------------.
FORMATS
  CODEZONE ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA
  LIEACHPR MONMOYAC PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU
  PAIEPRIV IMPOMARQ MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH
  GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA PXMOYEGA PXBASGAM
  ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC IMSECSAV SEATPRIO
  DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI
  FIMEFOUR RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE (F2.0)
  /DELAIPRE (F4.0).

VARIABLE LABELS
  NUMFICHE 'N° de fiche'
  /  CODEENQU 'Identifiant enquêteur'
  /  CODEZONE 'Zone d''étude'
  /  QUARTIER 'Quartier / zone'
  /  SITEENQU 'Site précis / repère'
  /  DATEENQU 'Date de l''enquête'
  /  HEUREENQ 'Heure de soumission'
  /  DELAIPRE 'Minutes depuis la fiche précédente du même enquêteur (même jour)'
  /  ACCRECON 'Accepte d''être recontacté à des fins commerciales'
  /  VOUSETES 'Q1. Vous êtes'
  /  SEXMAFEM 'Q2. Genre'
  /  AGEREPON 'Q3. Âge'
  /  VILLEREG 'Q4. Ville / région'
  /  REVMENME 'Q5. Revenu mensuel du ménage (FCFA)'
  /  FREQACHA 'Q6. Fréquence d''achat'
  /  LIEACHPR 'Q7. Lieu d''achat principal'
  /  MONMOYAC 'Q8. Montant moyen par achat (FCFA)'
  /  PRACCABL 'Q9. Produits achetés - Câbles/fils'
  /  PRACAPPA 'Q9. Produits achetés - Appareillage/disjoncteurs'
  /  PRACPRIS 'Q9. Produits achetés - Prises/interrupteurs'
  /  PRACLUMI 'Q9. Produits achetés - Luminaires'
  /  PRACSOLA 'Q9. Produits achetés - Solaire/onduleurs'
  /  PRACGROU 'Q9. Produits achetés - Groupes électrogènes'
  /  PAIEPRIV 'Q10. Paiement privilégié'
  /  IMPOMARQ 'Q11. Importance de la marque'
  /  MAACPLSO 'Q12. Marque achetée le plus souvent'
  /  MAACAUTR 'Q12. Marque achetée le plus souvent - Autre (précisez)'
  /  PRCRICHO 'Q13. Principal critère de choix'
  /  ORIGPRIV 'Q14. Origine privilégiée'
  /  MEQUAFIA 'Q15. Meilleure qualité/fiabilité selon vous'
  /  MEILPRIX 'Q16. Meilleur prix selon vous'
  /  ORINFACH 'Q17. L''origine influence votre achat'
  /  GAACPLSO 'Q18. Gamme achetée le plus souvent'
  /  DEAVHAGA 'Q19. Pour vous, ce qui définit AVANT TOUT un produit HAUT DE GAMME'
  /  CAAVBAGA 'Q20. Pour vous, ce qui caractérise AVANT TOUT un produit BAS DE GAMME'
  /  ORASHAGA 'Q21. À quelle origine associez-vous spontanément le HAUT DE GAMME ?'
  /  ORASBAGA 'Q22. À quelle origine associez-vous spontanément le BAS DE GAMME ?'
  /  PXHAUTGA 'Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme - Haut de gamme'
  /  PXMOYEGA 'Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme - Moyenne gamme'
  /  PXBASGAM 'Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme - Bas de gamme'
  /  ECQUHABA 'Q24. Selon vous, l''écart de qualité entre le haut et le bas de gamme est'
  /  PRIOPRIN 'Q25. Priorité principale'
  /  SUACMOGA 'Q26. Surcoût accepté pour monter en gamme'
  /  PRINFREI 'Q27. Principal frein'
  /  CRACPRCO 'Q28. Crainte d''acheter un produit contrefait/non conforme'
  /  DEJDECAC 'Q29. Déjà déçu par un achat'
  /  IMSECSAV 'Q30. Importance du service client et du SAV'
  /  SEATPRIO 'Q31. Service attendu en priorité'
  /  DUGAJUAC 'Q32. Durée de garantie jugée acceptable'
  /  CACOPREF 'Q33. Canal de contact préféré'
  /  BOSAPACH 'Q34. Un bon SAV/service vous ferait payer plus cher'
  /  CANAPREF 'Q35. Canal préféré'
  /  CRCHCANA 'Q36. Critère de choix du canal'
  /  DEJACHLI 'Q37. Déjà acheté en ligne'
  /  PRETACLI 'Q38. Prêt à acheter en ligne'
  /  PRFRACLI 'Q39. Principal frein à l''achat en ligne'
  /  FIMEFOUR 'Q40. Fidèle à un même fournisseur'
  /  RFIDPRIX 'Q41. Ce qui renforcerait votre fidélité - Prix/promotions'
  /  RFIDQUAL 'Q41. Ce qui renforcerait votre fidélité - Qualité constante'
  /  RFIDSTOC 'Q41. Ce qui renforcerait votre fidélité - Disponibilité du stock'
  /  RFIDCONS 'Q41. Ce qui renforcerait votre fidélité - Bon conseil'
  /  RFIDSAVF 'Q41. Ce qui renforcerait votre fidélité - SAV fiable'
  /  RFIDPROG 'Q41. Ce qui renforcerait votre fidélité - Programme de fidélité'
  /  RFIDPAIE 'Q41. Ce qui renforcerait votre fidélité - Facilités de paiement'
  /  SUGGATTE 'Q42. Une suggestion / attente (facultatif)'
  /  ANOMALIE 'Anomalies détectées automatiquement'
  /  STATUTQC 'Statut contrôle qualité'.

VALUE LABELS
  CODEZONE
    1 'Douala'
    2 'Yaoundé'
    3 'Bafoussam'
    99 'Enquêteur inconnu'
  /  ACCRECON
    1 'Oui'
    2 'Non'
    99 'Non-réponse'
  /  VOUSETES
    1 'Particulier'
    2 'Entreprises (PME, Industries…)'
    3 'Électricien/artisan'
    4 'Entreprise BTP'
    5 'Revendeur/Grossiste/Distributeur'
    99 'Non-réponse'
  /  SEXMAFEM
    1 'Homme'
    2 'Femme'
    99 'Non-réponse'
  /  AGEREPON
    1 '<25'
    2 '25–34'
    3 '35–44'
    4 '45–54'
    5 '55+'
    99 'Non-réponse'
  /  VILLEREG
    1 'Douala'
    2 'Yaoundé'
    3 'Bafoussam'
    99 'Non-réponse'
  /  REVMENME
    1 '<100k'
    2 '100k–250k'
    3 '250k–500k'
    4 '500k–1M'
    5 '>1M'
    98 'NSP'
    99 'Non-réponse'
  /  FREQACHA
    1 'Chaque semaine'
    2 '1–3×/mois'
    3 'Quelques fois/an'
    4 'Rarement'
    99 'Non-réponse'
  /  LIEACHPR
    1 'Quincaillerie'
    2 'Grossiste spécialisé'
    3 'Magasin spécialisé'
    4 'Marché'
    5 'Importateur'
    6 'En ligne'
    99 'Non-réponse'
  /  MONMOYAC
    1 '<25k'
    2 '25k–100k'
    3 '100k–500k'
    4 '500k–2M'
    5 '>2M'
    99 'Non-réponse'
  /  PRACCABL
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  PRACAPPA
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  PRACPRIS
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  PRACLUMI
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  PRACSOLA
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  PRACGROU
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  PAIEPRIV
    1 'Espèces'
    2 'Mobile Money'
    3 'Virement'
    4 'Crédit fournisseur'
    99 'Non-réponse'
  /  IMPOMARQ
    1 'Très importante'
    2 'Importante'
    3 'Peu importante'
    4 'Pas importante'
    99 'Non-réponse'
  /  MAACPLSO
    1 'Schneider'
    2 'Legrand'
    3 'Vectron'
    4 'Hager'
    5 'ABB'
    6 'Siemens'
    7 'Chint/chinoise'
    8 'Philips'
    9 'JA Solar'
    10 'Longi'
    11 'Growatt'
    12 'Autre'
    99 'Non-réponse'
  /  PRCRICHO
    1 'Prix'
    2 'Qualité/durabilité'
    3 'Disponibilité'
    4 'Notoriété'
    5 'Garantie/SAV'
    6 'Conformité normes'
    99 'Non-réponse'
  /  ORIGPRIV
    1 'Europe'
    2 'Asie'
    3 'Amérique'
    4 'Aucune préférence'
    99 'Non-réponse'
  /  MEQUAFIA
    1 'Europe'
    2 'Asie'
    3 'Amérique'
    98 'Sans avis'
    99 'Non-réponse'
  /  MEILPRIX
    1 'Europe'
    2 'Asie'
    3 'Amérique'
    98 'Sans avis'
    99 'Non-réponse'
  /  ORINFACH
    1 'Fortement'
    2 'Modérément'
    3 'Faiblement'
    4 'Pas du tout'
    99 'Non-réponse'
  /  GAACPLSO
    1 'Haut de gamme'
    2 'Moyenne gamme'
    3 'Bas de gamme'
    4 'Selon le projet'
    99 'Non-réponse'
  /  DEAVHAGA
    1 'Un prix élevé'
    2 'Une marque reconnue'
    3 'La durabilité / fiabilité'
    4 'L''origine (Europe, Asie, etc.)'
    5 'Les certifications / conformité aux normes'
    6 'Une garantie longue'
    99 'Non-réponse'
  /  CAAVBAGA
    1 'Un prix bas'
    2 'Une origine asiatique générique'
    3 'L''absence de marque connue'
    4 'Une durée de vie courte'
    5 'L''absence de garantie'
    6 'Un risque de non-conformité'
    99 'Non-réponse'
  /  ORASHAGA
    1 'Europe'
    2 'Asie'
    3 'Amérique'
    98 'Sans avis'
    99 'Non-réponse'
  /  ORASBAGA
    1 'Europe'
    2 'Asie'
    3 'Amérique'
    98 'Sans avis'
    99 'Non-réponse'
  /  PXHAUTGA
    1 '< 5 000 FCFA'
    2 '5 000 – 15 000'
    3 '15 000 – 40 000'
    4 '> 40 000 FCFA'
    99 'Non-réponse'
  /  PXMOYEGA
    1 '< 5 000 FCFA'
    2 '5 000 – 15 000'
    3 '15 000 – 40 000'
    4 '> 40 000 FCFA'
    99 'Non-réponse'
  /  PXBASGAM
    1 '< 5 000 FCFA'
    2 '5 000 – 15 000'
    3 '15 000 – 40 000'
    4 '> 40 000 FCFA'
    99 'Non-réponse'
  /  ECQUHABA
    1 'Très important'
    2 'Important'
    3 'Modéré'
    4 'Faible'
    5 'Inexistant'
    99 'Non-réponse'
  /  PRIOPRIN
    1 'Le moins cher'
    2 'Meilleur rapport qualité/prix'
    3 'Meilleure qualité quel que soit le prix'
    99 'Non-réponse'
  /  SUACMOGA
    1 'Aucun'
    2 'Jusqu''à +10 %'
    3 '+10–25 %'
    4 '+25–50 %'
    5 '>+50 %'
    99 'Non-réponse'
  /  PRINFREI
    1 'Prix élevé'
    2 'Doute qualité/contrefaçon'
    3 'Indisponibilité'
    4 'Manque de conseil'
    5 'Absence de garantie'
    6 'Délais de livraison'
    99 'Non-réponse'
  /  CRACPRCO
    1 'Souvent'
    2 'Parfois'
    3 'Rarement'
    4 'Jamais'
    99 'Non-réponse'
  /  DEJDECAC
    1 'Oui, plusieurs fois'
    2 'Oui, une fois'
    3 'Non'
    99 'Non-réponse'
  /  IMSECSAV
    1 'Très importante'
    2 'Importante'
    3 'Peu importante'
    4 'Pas importante'
    99 'Non-réponse'
  /  SEATPRIO
    1 'Garantie/remplacement'
    2 'Conseil technique'
    3 'Réparation/pièces'
    4 'Réactivité du contact'
    5 'Livraison/installation'
    99 'Non-réponse'
  /  DUGAJUAC
    1 '<6 mois'
    2 '6 mois–1 an'
    3 '1–2 ans'
    4 '>2 ans'
    99 'Non-réponse'
  /  CACOPREF
    1 'En personne'
    2 'Téléphone'
    3 'WhatsApp'
    4 'E-mail'
    5 'Réseaux sociaux'
    99 'Non-réponse'
  /  BOSAPACH
    1 'Oui'
    2 'Peut-être'
    3 'Non'
    99 'Non-réponse'
  /  CANAPREF
    1 'Quincaillerie'
    2 'Grossiste spécialisé'
    3 'Magasin spécialisé'
    4 'Marché'
    5 'Importateur'
    6 'En ligne'
    99 'Non-réponse'
  /  CRCHCANA
    1 'Proximité'
    2 'Prix'
    3 'Largeur du choix'
    4 'Disponibilité'
    5 'Conseil'
    6 'Confiance'
    99 'Non-réponse'
  /  DEJACHLI
    1 'Oui'
    2 'Non'
    99 'Non-réponse'
  /  PRETACLI
    1 'Oui'
    2 'Peut-être'
    3 'Non'
    99 'Non-réponse'
  /  PRFRACLI
    1 'Qualité/conformité'
    2 'Ne pas voir le produit'
    3 'Confiance paiement'
    4 'Livraison'
    5 'Absence de SAV'
    99 'Non-réponse'
  /  FIMEFOUR
    1 'Toujours'
    2 'Souvent'
    3 'Parfois'
    4 'Rarement'
    5 'Jamais'
    99 'Non-réponse'
  /  RFIDPRIX
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  RFIDQUAL
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  RFIDSTOC
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  RFIDCONS
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  RFIDSAVF
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  RFIDPROG
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'
  /  RFIDPAIE
    1 'Cité'
    0 'Non cité'
    99 'Non-réponse'.

MISSING VALUES
  CODEZONE ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA
  LIEACHPR MONMOYAC PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU
  PAIEPRIV IMPOMARQ MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH
  GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA PXMOYEGA PXBASGAM
  ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC IMSECSAV SEATPRIO
  DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI
  FIMEFOUR RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE
  (97, 98, 99).

VARIABLE LEVEL
  CODEZONE ACCRECON VOUSETES SEXMAFEM VILLEREG LIEACHPR PRACCABL PRACAPPA
  PRACPRIS PRACLUMI PRACSOLA PRACGROU PAIEPRIV MAACPLSO PRCRICHO ORIGPRIV
  MEQUAFIA MEILPRIX GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PRINFREI
  SEATPRIO CACOPREF CANAPREF CRCHCANA DEJACHLI PRFRACLI RFIDPRIX RFIDQUAL
  RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE (NOMINAL).
VARIABLE LEVEL
  AGEREPON REVMENME FREQACHA MONMOYAC IMPOMARQ ORINFACH PXHAUTGA PXMOYEGA
  PXBASGAM ECQUHABA PRIOPRIN SUACMOGA CRACPRCO DEJDECAC IMSECSAV DUGAJUAC
  BOSAPACH PRETACLI FIMEFOUR (ORDINAL).
VARIABLE LEVEL
  DELAIPRE (SCALE).
VARIABLE LEVEL
  NUMFICHE CODEENQU QUARTIER SITEENQU DATEENQU HEUREENQ MAACAUTR SUGGATTE
  ANOMALIE STATUTQC (NOMINAL).

MRSETS
  /MDGROUP NAME=$PRODACHE LABEL='Q9. Produits achetés (plusieurs réponses)'
    CATEGORYLABELS=VARLABELS VALUE=1 VARIABLES=
    PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU
  /MDGROUP NAME=$RENFFIDE LABEL='Q41. Ce qui renforcerait votre fidélité (plusieurs réponses)'
    CATEGORYLABELS=VARLABELS VALUE=1 VARIABLES=
    RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE
  /DISPLAY NAME=[$PRODACHE $RENFFIDE].
* >>> BLOC_MRSETS_FIN.

* --------------------------------------------------------------------------.
* 4. CONTRÔLES (à regarder dans la fenêtre de résultats).
* --------------------------------------------------------------------------.
* 4a. L'import a-t-il fonctionné ? « Fiche lue correctement » doit être à 100 %.
COMPUTE CTRL_IMP = NOT SYSMIS(VOUSETES) AND NOT SYSMIS(CODEZONE) AND NOT SYSMIS(DATEENQU).
VARIABLE LABELS CTRL_IMP 'CONTRÔLE : la fiche a été lue correctement'.
VALUE LABELS CTRL_IMP 1 'Fiche lue correctement' 0 'PROBLÈME : fiche mal lue (voir mode d''emploi)'.
FORMATS CTRL_IMP (F1.0).
FREQUENCIES VARIABLES=CTRL_IMP.

* 4b. Doublons de numéro de fiche (doit afficher 100 % « Première occurrence »).
SORT CASES BY NUMFICHE.
MATCH FILES /FILE=* /BY NUMFICHE /FIRST=PREMFICH.
VARIABLE LABELS PREMFICH 'CONTRÔLE : numéro de fiche unique'.
VALUE LABELS PREMFICH 1 'Première occurrence' 0 'DOUBLON'.
FREQUENCIES VARIABLES=PREMFICH.

* 4c. Production par ville, par enquêteur et par jour ; statut qualité.
FREQUENCIES VARIABLES=CODEZONE CODEENQU STATUTQC /ORDER=ANALYSIS.
CROSSTABS /TABLES=CODEENQU BY DATEENQU /CELLS=COUNT.

* 4d. Ville déclarée (Q4) contre ville de l'enquêteur : tout doit être sur la diagonale.
CROSSTABS /TABLES=VILLEREG BY CODEZONE /CELLS=COUNT.

* 4e. Cibles (Q1) par ville, à comparer aux quotas.
CROSSTABS /TABLES=VOUSETES BY CODEZONE /CELLS=COUNT COLUMN.

* 4f. OPTION : ne garder que les fiches « OK » (retirer l'astérisque des 2 lignes).
* SELECT IF (STATUTQC = 'OK').
* EXECUTE.

* --------------------------------------------------------------------------.
* 5. PONDÉRATIONS (calculées ici, activées seulement dans le script 2).
* --------------------------------------------------------------------------.
COMPUTE UN = 1.

* 5a. POIDS_V : poids de chaque ville. Saisir la PART RÉELLE de chaque ville (total = 1).
*     Valeurs par défaut = parts de l'échantillon du cahier des charges (200/200/100) : poids proches de 1.
COMPUTE PART_V = $SYSMIS.
IF (CODEZONE = 1) PART_V = 0.400.
IF (CODEZONE = 2) PART_V = 0.400.
IF (CODEZONE = 3) PART_V = 0.200.
SORT CASES BY CODEZONE.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=CODEZONE /N_ZONE=N.
COMPUTE IN_V = NOT MISSING(PART_V).
COMPUTE TMP_A = $SYSMIS.
IF (IN_V) TMP_A = PART_V / N_ZONE.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=UN /N_IN_V=SUM(IN_V) /PARTOBSV=SUM(TMP_A) /N_TOT=N.
COMPUTE POIDS_V = 1.
IF (IN_V) POIDS_V = (PART_V / PARTOBSV) / (N_ZONE / N_IN_V).
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=UN /S_W=SUM(POIDS_V).
COMPUTE POIDS_V = POIDS_V * N_TOT / S_W.

* 5b. POIDS_VC : redresse la structure ville x cible (Q1) sur les quotas de l'onglet CIBLES.
*     Quotas du cahier des charges 02 (500 fiches) : 1 Particuliers, 2 Entreprises, 3 Artisans,
*     4 BTP, 5 Grossistes/revendeurs. Si vous changez les quotas dans le Sheet, reportez-les ici.
COMPUTE QUOTA = $SYSMIS.
IF (VOUSETES = 1 AND CODEZONE = 1) QUOTA = 35.
IF (VOUSETES = 1 AND CODEZONE = 2) QUOTA = 35.
IF (VOUSETES = 1 AND CODEZONE = 3) QUOTA = 15.
IF (VOUSETES = 2 AND CODEZONE = 1) QUOTA = 35.
IF (VOUSETES = 2 AND CODEZONE = 2) QUOTA = 35.
IF (VOUSETES = 2 AND CODEZONE = 3) QUOTA = 15.
IF (VOUSETES = 3 AND CODEZONE = 1) QUOTA = 40.
IF (VOUSETES = 3 AND CODEZONE = 2) QUOTA = 40.
IF (VOUSETES = 3 AND CODEZONE = 3) QUOTA = 20.
IF (VOUSETES = 4 AND CODEZONE = 1) QUOTA = 40.
IF (VOUSETES = 4 AND CODEZONE = 2) QUOTA = 40.
IF (VOUSETES = 4 AND CODEZONE = 3) QUOTA = 20.
IF (VOUSETES = 5 AND CODEZONE = 1) QUOTA = 50.
IF (VOUSETES = 5 AND CODEZONE = 2) QUOTA = 50.
IF (VOUSETES = 5 AND CODEZONE = 3) QUOTA = 30.
SORT CASES BY CODEZONE VOUSETES.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=CODEZONE VOUSETES /N_CELL=N.
COMPUTE IN_VC = 0.
IF (QUOTA > 0) IN_VC = 1.
COMPUTE TMP_B = $SYSMIS.
IF (IN_VC = 1) TMP_B = QUOTA / N_CELL.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=UN /N_IN_VC=SUM(IN_VC) /QTOTOBS=SUM(TMP_B).
COMPUTE POIDS_VC = 1.
IF (IN_VC = 1) POIDS_VC = (QUOTA / QTOTOBS) / (N_CELL / N_IN_VC).
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=UN /S_W2=SUM(POIDS_VC).
COMPUTE POIDS_VC = POIDS_VC * N_TOT / S_W2.

* 5c. Base effective de Kish (perte de précision due à la pondération).
COMPUTE W2_V = POIDS_V**2.
COMPUTE W2_VC = POIDS_VC**2.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=UN /SW2_V=SUM(W2_V) /SW2_VC=SUM(W2_VC).
COMPUTE NEFF_V = N_TOT**2 / SW2_V.
COMPUTE NEFF_VC = N_TOT**2 / SW2_VC.
VARIABLE LABELS POIDS_V 'Poids ville (parts réelles des villes)'
  /POIDS_VC 'Poids ville x cible (quotas)'
  /NEFF_V 'N effectif de Kish - poids ville' /NEFF_VC 'N effectif de Kish - poids ville x cible'.
FORMATS POIDS_V POIDS_VC (F8.4) NEFF_V NEFF_VC (F8.1).
VARIABLE LEVEL POIDS_V POIDS_VC NEFF_V NEFF_VC (SCALE).
MEANS TABLES=POIDS_V POIDS_VC BY CODEZONE /CELLS=MEAN MIN MAX COUNT.
DESCRIPTIVES VARIABLES=NEFF_V NEFF_VC /STATISTICS=MEAN.
* Lecture : poids max > 3 ou N effectif < 70 % du N brut = pondération trop forte.

DELETE VARIABLES UN PART_V N_ZONE TMP_A IN_V N_IN_V PARTOBSV N_TOT S_W QUOTA N_CELL
  IN_VC TMP_B N_IN_VC QTOTOBS S_W2 W2_V W2_VC SW2_V SW2_VC PREMFICH.

* --------------------------------------------------------------------------.
* 6. ENREGISTREMENT.
* --------------------------------------------------------------------------.
SORT CASES BY CODEZONE CODEENQU NUMFICHE.
SAVE OUTFILE='C:\ETUDE_EDM\EDM_ELECTRIQUE_CAMEROUN.sav' /COMPRESSED.
DISPLAY DICTIONARY.
* FIN. Si les contrôles 4a et 4b sont à 100 %, ouvrez et lancez le script 2.
