* ======================================================================.
* EDM ELECTRIQUE CAMEROUN - FICHIER MAITRE SPSS 27 - V3.
* ======================================================================.
* 67 variables issues de DICTIONNAIRE.
* BLOC A = AVANT TERRAIN.
* BLOC B = APRES TERRAIN.
* Exécuter les blocs séparément.
* ======================================================================.

DEFINE !XLSX()
'C:\EDM\EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL.xlsx'
!ENDDEFINE.

DEFINE !SAVPRE()
'C:\EDM\EDM_ELECTRIQUE_CAMEROUN_AVANT_TERRAIN.sav'
!ENDDEFINE.

DEFINE !SAVPOST()
'C:\EDM\EDM_ELECTRIQUE_CAMEROUN.sav'
!ENDDEFINE.


* ======================================================================.
* BLOC A - AVANT LA DESCENTE DE TERRAIN.
* ======================================================================.

NEW FILE.

DATA LIST LIST /
 NUMFICHE A20 CODEENQU A6 CODEZONE F2.0 QUARTIER A60 SITEENQU A80 DATEENQU SDATE10 HEUREENQ A5 DELAIPRE F4.0 ACCRECON F2.0 VOUSETES F2.0 SEXMAFEM F2.0 AGEREPON F2.0 VILLEREG F2.0 REVMENME F2.0 FREQACHA F2.0 LIEACHPR F2.0 MONMOYAC F2.0 PRACCABL F2.0 PRACAPPA F2.0 PRACPRIS F2.0 PRACLUMI F2.0 PRACSOLA F2.0 PRACGROU F2.0 PAIEPRIV F2.0 IMPOMARQ F2.0 MAACPLSO F2.0 MAACAUTR A80 PRCRICHO F2.0 ORIGPRIV F2.0 MEQUAFIA F2.0 MEILPRIX F2.0 ORINFACH F2.0 GAACPLSO F2.0 DEAVHAGA F2.0 CAAVBAGA F2.0 ORASHAGA F2.0 ORASBAGA F2.0 PXHAUTGA F2.0 PXMOYEGA F2.0 PXBASGAM F2.0 ECQUHABA F2.0 PRIOPRIN F2.0 SUACMOGA F2.0 PRINFREI F2.0 CRACPRCO F2.0 DEJDECAC F2.0 IMSECSAV F2.0 SEATPRIO F2.0 DUGAJUAC F2.0 CACOPREF F2.0 BOSAPACH F2.0 CANAPREF F2.0 CRCHCANA F2.0 DEJACHLI F2.0 PRETACLI F2.0 PRFRACLI F2.0 FIMEFOUR F2.0 RFIDPRIX F2.0 RFIDQUAL F2.0 RFIDSTOC F2.0 RFIDCONS F2.0 RFIDSAVF F2.0 RFIDPROG F2.0 RFIDPAIE F2.0 SUGGATTE A500 ANOMALIE A200 STATUTQC A10.

INPUT PROGRAM.
END FILE.
END INPUT PROGRAM.

DATASET NAME EDM_CAMEROUN.

VARIABLE LABELS
  NUMFICHE 'N° de fiche'
  CODEENQU 'Identifiant enquêteur'
  CODEZONE 'Zone d''étude'
  QUARTIER 'Quartier / zone'
  SITEENQU 'Site précis / repère'
  DATEENQU 'Date de l''enquête'
  HEUREENQ 'Heure de soumission'
  DELAIPRE 'Minutes depuis la fiche précédente du même enquêteur'
  ACCRECON 'Accepte d''être recontacté à des fins commerciales'
  VOUSETES 'Q1. Vous êtes'
  SEXMAFEM 'Q2. Genre'
  AGEREPON 'Q3. Âge'
  VILLEREG 'Q4. Ville / région'
  REVMENME 'Q5. Revenu mensuel du ménage (FCFA)'
  FREQACHA 'Q6. Fréquence d''achat'
  LIEACHPR 'Q7. Lieu d''achat principal'
  MONMOYAC 'Q8. Montant moyen par achat (FCFA)'
  PRACCABL 'Q9. Produits achetés - Câbles/fils'
  PRACAPPA 'Q9. Produits achetés - Appareillage/disjoncteurs'
  PRACPRIS 'Q9. Produits achetés - Prises/interrupteurs'
  PRACLUMI 'Q9. Produits achetés - Luminaires'
  PRACSOLA 'Q9. Produits achetés - Solaire/onduleurs'
  PRACGROU 'Q9. Produits achetés - Groupes électrogènes'
  PAIEPRIV 'Q10. Paiement privilégié'
  IMPOMARQ 'Q11. Importance de la marque'
  MAACPLSO 'Q12. Marque achetée le plus souvent'
  MAACAUTR 'Q12. Marque achetée le plus souvent - Autre (précisez)'
  PRCRICHO 'Q13. Principal critère de choix'
  ORIGPRIV 'Q14. Origine privilégiée'
  MEQUAFIA 'Q15. Meilleure qualité/fiabilité selon vous'
  MEILPRIX 'Q16. Meilleur prix selon vous'
  ORINFACH 'Q17. L''origine influence votre achat'
  GAACPLSO 'Q18. Gamme achetée le plus souvent'
  DEAVHAGA 'Q19. Pour vous, ce qui définit AVANT TOUT un produit HAUT DE GAMME'
  CAAVBAGA 'Q20. Pour vous, ce qui caractérise AVANT TOUT un produit BAS DE GAMME'
  ORASHAGA 'Q21. À quelle origine associez-vous spontanément le HAUT DE GAMME ?'
  ORASBAGA 'Q22. À quelle origine associez-vous spontanément le BAS DE GAMME ?'
  PXHAUTGA 'Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme - Haut de gamme'
  PXMOYEGA 'Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme - Moyenne gamme'
  PXBASGAM 'Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme - Bas de gamme'
  ECQUHABA 'Q24. Selon vous, l''écart de qualité entre le haut et le bas de gamme est'
  PRIOPRIN 'Q25. Priorité principale'
  SUACMOGA 'Q26. Surcoût accepté pour monter en gamme'
  PRINFREI 'Q27. Principal frein'
  CRACPRCO 'Q28. Crainte d''acheter un produit contrefait/non conforme'
  DEJDECAC 'Q29. Déjà déçu par un achat'
  IMSECSAV 'Q30. Importance du service client et du SAV'
  SEATPRIO 'Q31. Service attendu en priorité'
  DUGAJUAC 'Q32. Durée de garantie jugée acceptable'
  CACOPREF 'Q33. Canal de contact préféré'
  BOSAPACH 'Q34. Un bon SAV/service vous ferait payer plus cher'
  CANAPREF 'Q35. Canal préféré'
  CRCHCANA 'Q36. Critère de choix du canal'
  DEJACHLI 'Q37. Déjà acheté en ligne'
  PRETACLI 'Q38. Prêt à acheter en ligne'
  PRFRACLI 'Q39. Principal frein à l''achat en ligne'
  FIMEFOUR 'Q40. Fidèle à un même fournisseur'
  RFIDPRIX 'Q41. Ce qui renforcerait votre fidélité - Prix/promotions'
  RFIDQUAL 'Q41. Ce qui renforcerait votre fidélité - Qualité constante'
  RFIDSTOC 'Q41. Ce qui renforcerait votre fidélité - Disponibilité du stock'
  RFIDCONS 'Q41. Ce qui renforcerait votre fidélité - Bon conseil'
  RFIDSAVF 'Q41. Ce qui renforcerait votre fidélité - SAV fiable'
  RFIDPROG 'Q41. Ce qui renforcerait votre fidélité - Programme de fidélité'
  RFIDPAIE 'Q41. Ce qui renforcerait votre fidélité - Facilités de paiement'
  SUGGATTE 'Q42. Une suggestion / attente (facultatif)'
  ANOMALIE 'Anomalies détectées automatiquement'
  STATUTQC 'Statut contrôle qualité'.

FORMATS
  NUMFICHE (A20)
  CODEENQU (A6)
  CODEZONE (F2.0)
  QUARTIER (A60)
  SITEENQU (A80)
  DATEENQU (SDATE10)
  HEUREENQ (A5)
  DELAIPRE (F4.0)
  ACCRECON (F2.0)
  VOUSETES (F2.0)
  SEXMAFEM (F2.0)
  AGEREPON (F2.0)
  VILLEREG (F2.0)
  REVMENME (F2.0)
  FREQACHA (F2.0)
  LIEACHPR (F2.0)
  MONMOYAC (F2.0)
  PRACCABL (F2.0)
  PRACAPPA (F2.0)
  PRACPRIS (F2.0)
  PRACLUMI (F2.0)
  PRACSOLA (F2.0)
  PRACGROU (F2.0)
  PAIEPRIV (F2.0)
  IMPOMARQ (F2.0)
  MAACPLSO (F2.0)
  MAACAUTR (A80)
  PRCRICHO (F2.0)
  ORIGPRIV (F2.0)
  MEQUAFIA (F2.0)
  MEILPRIX (F2.0)
  ORINFACH (F2.0)
  GAACPLSO (F2.0)
  DEAVHAGA (F2.0)
  CAAVBAGA (F2.0)
  ORASHAGA (F2.0)
  ORASBAGA (F2.0)
  PXHAUTGA (F2.0)
  PXMOYEGA (F2.0)
  PXBASGAM (F2.0)
  ECQUHABA (F2.0)
  PRIOPRIN (F2.0)
  SUACMOGA (F2.0)
  PRINFREI (F2.0)
  CRACPRCO (F2.0)
  DEJDECAC (F2.0)
  IMSECSAV (F2.0)
  SEATPRIO (F2.0)
  DUGAJUAC (F2.0)
  CACOPREF (F2.0)
  BOSAPACH (F2.0)
  CANAPREF (F2.0)
  CRCHCANA (F2.0)
  DEJACHLI (F2.0)
  PRETACLI (F2.0)
  PRFRACLI (F2.0)
  FIMEFOUR (F2.0)
  RFIDPRIX (F2.0)
  RFIDQUAL (F2.0)
  RFIDSTOC (F2.0)
  RFIDCONS (F2.0)
  RFIDSAVF (F2.0)
  RFIDPROG (F2.0)
  RFIDPAIE (F2.0)
  SUGGATTE (A500)
  ANOMALIE (A200)
  STATUTQC (A10).

VALUE LABELS CODEZONE
  1 'Douala'
  2 'Yaoundé'
  3 'Bafoussam'
  99 'Enquêteur inconnu'.

VALUE LABELS ACCRECON
  1 'Oui'
  2 'Non'
  99 'Non-réponse'.

VALUE LABELS VOUSETES
  1 'Particulier'
  2 'Entreprises (PME, Industries…)'
  3 'Électricien/artisan'
  4 'Entreprise BTP'
  5 'Revendeur/Grossiste/Distributeur'
  99 'Non-réponse'.

VALUE LABELS SEXMAFEM
  1 'Homme'
  2 'Femme'
  99 'Non-réponse'.

VALUE LABELS AGEREPON
  1 '<25'
  2 '25–34'
  3 '35–44'
  4 '45–54'
  5 '55+'
  99 'Non-réponse'.

VALUE LABELS VILLEREG
  1 'Douala'
  2 'Yaoundé'
  3 'Bafoussam'
  99 'Non-réponse'.

VALUE LABELS REVMENME
  1 '<100k'
  2 '100k–250k'
  3 '250k–500k'
  4 '500k–1M'
  5 '>1M'
  98 'NSP'
  99 'Non-réponse'.

VALUE LABELS FREQACHA
  1 'Chaque semaine'
  2 '1–3×/mois'
  3 'Quelques fois/an'
  4 'Rarement'
  99 'Non-réponse'.

VALUE LABELS LIEACHPR
  1 'Quincaillerie'
  2 'Grossiste spécialisé'
  3 'Magasin spécialisé'
  4 'Marché'
  5 'Importateur'
  6 'En ligne'
  99 'Non-réponse'.

VALUE LABELS MONMOYAC
  1 '<25k'
  2 '25k–100k'
  3 '100k–500k'
  4 '500k–2M'
  5 '>2M'
  99 'Non-réponse'.

VALUE LABELS PRACCABL
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PRACAPPA
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PRACPRIS
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PRACLUMI
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PRACSOLA
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PRACGROU
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PAIEPRIV
  1 'Espèces'
  2 'Mobile Money'
  3 'Virement'
  4 'Crédit fournisseur'
  99 'Non-réponse'.

VALUE LABELS IMPOMARQ
  1 'Très importante'
  2 'Importante'
  3 'Peu importante'
  4 'Pas importante'
  99 'Non-réponse'.

VALUE LABELS MAACPLSO
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
  99 'Non-réponse'.

VALUE LABELS PRCRICHO
  1 'Prix'
  2 'Qualité/durabilité'
  3 'Disponibilité'
  4 'Notoriété'
  5 'Garantie/SAV'
  6 'Conformité normes'
  99 'Non-réponse'.

VALUE LABELS ORIGPRIV
  1 'Europe'
  2 'Asie'
  3 'Amérique'
  4 'Aucune préférence'
  99 'Non-réponse'.

VALUE LABELS MEQUAFIA
  1 'Europe'
  2 'Asie'
  3 'Amérique'
  98 'Sans avis'
  99 'Non-réponse'.

VALUE LABELS MEILPRIX
  1 'Europe'
  2 'Asie'
  3 'Amérique'
  98 'Sans avis'
  99 'Non-réponse'.

VALUE LABELS ORINFACH
  1 'Fortement'
  2 'Modérément'
  3 'Faiblement'
  4 'Pas du tout'
  99 'Non-réponse'.

VALUE LABELS GAACPLSO
  1 'Haut de gamme'
  2 'Moyenne gamme'
  3 'Bas de gamme'
  4 'Selon le projet'
  99 'Non-réponse'.

VALUE LABELS DEAVHAGA
  1 'Un prix élevé'
  2 'Une marque reconnue'
  3 'La durabilité / fiabilité'
  4 'L''origine (Europe, Asie, etc.)'
  5 'Les certifications / conformité aux normes'
  6 'Une garantie longue'
  99 'Non-réponse'.

VALUE LABELS CAAVBAGA
  1 'Un prix bas'
  2 'Une origine asiatique générique'
  3 'L''absence de marque connue'
  4 'Une durée de vie courte'
  5 'L''absence de garantie'
  6 'Un risque de non-conformité'
  99 'Non-réponse'.

VALUE LABELS ORASHAGA
  1 'Europe'
  2 'Asie'
  3 'Amérique'
  98 'Sans avis'
  99 'Non-réponse'.

VALUE LABELS ORASBAGA
  1 'Europe'
  2 'Asie'
  3 'Amérique'
  98 'Sans avis'
  99 'Non-réponse'.

VALUE LABELS PXHAUTGA
  1 '< 5 000 FCFA'
  2 '5 000 – 15 000'
  3 '15 000 – 40 000'
  4 '> 40 000 FCFA'
  99 'Non-réponse'.

VALUE LABELS PXMOYEGA
  1 '< 5 000 FCFA'
  2 '5 000 – 15 000'
  3 '15 000 – 40 000'
  4 '> 40 000 FCFA'
  99 'Non-réponse'.

VALUE LABELS PXBASGAM
  1 '< 5 000 FCFA'
  2 '5 000 – 15 000'
  3 '15 000 – 40 000'
  4 '> 40 000 FCFA'
  99 'Non-réponse'.

VALUE LABELS ECQUHABA
  1 'Très important'
  2 'Important'
  3 'Modéré'
  4 'Faible'
  5 'Inexistant'
  99 'Non-réponse'.

VALUE LABELS PRIOPRIN
  1 'Le moins cher'
  2 'Meilleur rapport qualité/prix'
  3 'Meilleure qualité quel que soit le prix'
  99 'Non-réponse'.

VALUE LABELS SUACMOGA
  1 'Aucun'
  2 'Jusqu''à +10 %'
  3 '+10–25 %'
  4 '+25–50 %'
  5 '>+50 %'
  99 'Non-réponse'.

VALUE LABELS PRINFREI
  1 'Prix élevé'
  2 'Doute qualité/contrefaçon'
  3 'Indisponibilité'
  4 'Manque de conseil'
  5 'Absence de garantie'
  6 'Délais de livraison'
  99 'Non-réponse'.

VALUE LABELS CRACPRCO
  1 'Souvent'
  2 'Parfois'
  3 'Rarement'
  4 'Jamais'
  99 'Non-réponse'.

VALUE LABELS DEJDECAC
  1 'Oui, plusieurs fois'
  2 'Oui, une fois'
  3 'Non'
  99 'Non-réponse'.

VALUE LABELS IMSECSAV
  1 'Très importante'
  2 'Importante'
  3 'Peu importante'
  4 'Pas importante'
  99 'Non-réponse'.

VALUE LABELS SEATPRIO
  1 'Garantie/remplacement'
  2 'Conseil technique'
  3 'Réparation/pièces'
  4 'Réactivité du contact'
  5 'Livraison/installation'
  99 'Non-réponse'.

VALUE LABELS DUGAJUAC
  1 '<6 mois'
  2 '6 mois–1 an'
  3 '1–2 ans'
  4 '>2 ans'
  99 'Non-réponse'.

VALUE LABELS CACOPREF
  1 'En personne'
  2 'Téléphone'
  3 'WhatsApp'
  4 'E-mail'
  5 'Réseaux sociaux'
  99 'Non-réponse'.

VALUE LABELS BOSAPACH
  1 'Oui'
  2 'Peut-être'
  3 'Non'
  99 'Non-réponse'.

VALUE LABELS CANAPREF
  1 'Quincaillerie'
  2 'Grossiste spécialisé'
  3 'Magasin spécialisé'
  4 'Marché'
  5 'Importateur'
  6 'En ligne'
  99 'Non-réponse'.

VALUE LABELS CRCHCANA
  1 'Proximité'
  2 'Prix'
  3 'Largeur du choix'
  4 'Disponibilité'
  5 'Conseil'
  6 'Confiance'
  99 'Non-réponse'.

VALUE LABELS DEJACHLI
  1 'Oui'
  2 'Non'
  99 'Non-réponse'.

VALUE LABELS PRETACLI
  1 'Oui'
  2 'Peut-être'
  3 'Non'
  99 'Non-réponse'.

VALUE LABELS PRFRACLI
  1 'Qualité/conformité'
  2 'Ne pas voir le produit'
  3 'Confiance paiement'
  4 'Livraison'
  5 'Absence de SAV'
  99 'Non-réponse'.

VALUE LABELS FIMEFOUR
  1 'Toujours'
  2 'Souvent'
  3 'Parfois'
  4 'Rarement'
  5 'Jamais'
  99 'Non-réponse'.

VALUE LABELS RFIDPRIX
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDQUAL
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDSTOC
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDCONS
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDSAVF
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDPROG
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDPAIE
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

MISSING VALUES
  CODEZONE (99)
  ACCRECON (99)
  VOUSETES (99)
  SEXMAFEM (99)
  AGEREPON (99)
  VILLEREG (99)
  REVMENME (98 99)
  FREQACHA (99)
  LIEACHPR (99)
  MONMOYAC (99)
  PRACCABL (99)
  PRACAPPA (99)
  PRACPRIS (99)
  PRACLUMI (99)
  PRACSOLA (99)
  PRACGROU (99)
  PAIEPRIV (99)
  IMPOMARQ (99)
  MAACPLSO (99)
  PRCRICHO (99)
  ORIGPRIV (99)
  MEQUAFIA (98 99)
  MEILPRIX (98 99)
  ORINFACH (99)
  GAACPLSO (99)
  DEAVHAGA (99)
  CAAVBAGA (99)
  ORASHAGA (98 99)
  ORASBAGA (98 99)
  PXHAUTGA (99)
  PXMOYEGA (99)
  PXBASGAM (99)
  ECQUHABA (99)
  PRIOPRIN (99)
  SUACMOGA (99)
  PRINFREI (99)
  CRACPRCO (99)
  DEJDECAC (99)
  IMSECSAV (99)
  SEATPRIO (99)
  DUGAJUAC (99)
  CACOPREF (99)
  BOSAPACH (99)
  CANAPREF (99)
  CRCHCANA (99)
  DEJACHLI (99)
  PRETACLI (99)
  PRFRACLI (99)
  FIMEFOUR (99)
  RFIDPRIX (99)
  RFIDQUAL (99)
  RFIDSTOC (99)
  RFIDCONS (99)
  RFIDSAVF (99)
  RFIDPROG (99)
  RFIDPAIE (99).

VARIABLE LEVEL
  CODEZONE (NOMINAL)
  DELAIPRE (SCALE)
  ACCRECON (NOMINAL)
  VOUSETES (NOMINAL)
  SEXMAFEM (NOMINAL)
  AGEREPON (ORDINAL)
  VILLEREG (NOMINAL)
  REVMENME (ORDINAL)
  FREQACHA (ORDINAL)
  LIEACHPR (NOMINAL)
  MONMOYAC (ORDINAL)
  PRACCABL (NOMINAL)
  PRACAPPA (NOMINAL)
  PRACPRIS (NOMINAL)
  PRACLUMI (NOMINAL)
  PRACSOLA (NOMINAL)
  PRACGROU (NOMINAL)
  PAIEPRIV (NOMINAL)
  IMPOMARQ (ORDINAL)
  MAACPLSO (NOMINAL)
  PRCRICHO (NOMINAL)
  ORIGPRIV (NOMINAL)
  MEQUAFIA (NOMINAL)
  MEILPRIX (NOMINAL)
  ORINFACH (ORDINAL)
  GAACPLSO (NOMINAL)
  DEAVHAGA (NOMINAL)
  CAAVBAGA (NOMINAL)
  ORASHAGA (NOMINAL)
  ORASBAGA (NOMINAL)
  PXHAUTGA (ORDINAL)
  PXMOYEGA (ORDINAL)
  PXBASGAM (ORDINAL)
  ECQUHABA (ORDINAL)
  PRIOPRIN (ORDINAL)
  SUACMOGA (ORDINAL)
  PRINFREI (NOMINAL)
  CRACPRCO (ORDINAL)
  DEJDECAC (ORDINAL)
  IMSECSAV (ORDINAL)
  SEATPRIO (NOMINAL)
  DUGAJUAC (ORDINAL)
  CACOPREF (NOMINAL)
  BOSAPACH (ORDINAL)
  CANAPREF (NOMINAL)
  CRCHCANA (NOMINAL)
  DEJACHLI (NOMINAL)
  PRETACLI (ORDINAL)
  PRFRACLI (NOMINAL)
  FIMEFOUR (ORDINAL)
  RFIDPRIX (NOMINAL)
  RFIDQUAL (NOMINAL)
  RFIDSTOC (NOMINAL)
  RFIDCONS (NOMINAL)
  RFIDSAVF (NOMINAL)
  RFIDPROG (NOMINAL)
  RFIDPAIE (NOMINAL).

EXECUTE.


SAVE OUTFILE=!SAVPRE
 /COMPRESSED.

EXECUTE.


* ======================================================================.
* BLOC B - APRES LA DESCENTE DE TERRAIN.
* ======================================================================.
* MASQUE_DEPOUILLEMENT :
* ligne 2 = noms ; ligne 3 = libellés ; ligne 4 = premières données.
* ======================================================================.

GET DATA
 /TYPE=XLSX
 /FILE=!XLSX
 /SHEET=NAME 'MASQUE_DEPOUILLEMENT'
 /CELLRANGE=RANGE 'A4:BO10000'
 /READNAMES=OFF.

DATASET NAME EDM_CAMEROUN.

RENAME VARIABLES
(
  VAR00001 = NUMFICHE
  VAR00002 = CODEENQU
  VAR00003 = CODEZONE
  VAR00004 = QUARTIER
  VAR00005 = SITEENQU
  VAR00006 = DATEENQU
  VAR00007 = HEUREENQ
  VAR00008 = DELAIPRE
  VAR00009 = ACCRECON
  VAR00010 = VOUSETES
  VAR00011 = SEXMAFEM
  VAR00012 = AGEREPON
  VAR00013 = VILLEREG
  VAR00014 = REVMENME
  VAR00015 = FREQACHA
  VAR00016 = LIEACHPR
  VAR00017 = MONMOYAC
  VAR00018 = PRACCABL
  VAR00019 = PRACAPPA
  VAR00020 = PRACPRIS
  VAR00021 = PRACLUMI
  VAR00022 = PRACSOLA
  VAR00023 = PRACGROU
  VAR00024 = PAIEPRIV
  VAR00025 = IMPOMARQ
  VAR00026 = MAACPLSO
  VAR00027 = MAACAUTR
  VAR00028 = PRCRICHO
  VAR00029 = ORIGPRIV
  VAR00030 = MEQUAFIA
  VAR00031 = MEILPRIX
  VAR00032 = ORINFACH
  VAR00033 = GAACPLSO
  VAR00034 = DEAVHAGA
  VAR00035 = CAAVBAGA
  VAR00036 = ORASHAGA
  VAR00037 = ORASBAGA
  VAR00038 = PXHAUTGA
  VAR00039 = PXMOYEGA
  VAR00040 = PXBASGAM
  VAR00041 = ECQUHABA
  VAR00042 = PRIOPRIN
  VAR00043 = SUACMOGA
  VAR00044 = PRINFREI
  VAR00045 = CRACPRCO
  VAR00046 = DEJDECAC
  VAR00047 = IMSECSAV
  VAR00048 = SEATPRIO
  VAR00049 = DUGAJUAC
  VAR00050 = CACOPREF
  VAR00051 = BOSAPACH
  VAR00052 = CANAPREF
  VAR00053 = CRCHCANA
  VAR00054 = DEJACHLI
  VAR00055 = PRETACLI
  VAR00056 = PRFRACLI
  VAR00057 = FIMEFOUR
  VAR00058 = RFIDPRIX
  VAR00059 = RFIDQUAL
  VAR00060 = RFIDSTOC
  VAR00061 = RFIDCONS
  VAR00062 = RFIDSAVF
  VAR00063 = RFIDPROG
  VAR00064 = RFIDPAIE
  VAR00065 = SUGGATTE
  VAR00066 = ANOMALIE
  VAR00067 = STATUTQC
).

VARIABLE LABELS
  NUMFICHE 'N° de fiche'
  CODEENQU 'Identifiant enquêteur'
  CODEZONE 'Zone d''étude'
  QUARTIER 'Quartier / zone'
  SITEENQU 'Site précis / repère'
  DATEENQU 'Date de l''enquête'
  HEUREENQ 'Heure de soumission'
  DELAIPRE 'Minutes depuis la fiche précédente du même enquêteur'
  ACCRECON 'Accepte d''être recontacté à des fins commerciales'
  VOUSETES 'Q1. Vous êtes'
  SEXMAFEM 'Q2. Genre'
  AGEREPON 'Q3. Âge'
  VILLEREG 'Q4. Ville / région'
  REVMENME 'Q5. Revenu mensuel du ménage (FCFA)'
  FREQACHA 'Q6. Fréquence d''achat'
  LIEACHPR 'Q7. Lieu d''achat principal'
  MONMOYAC 'Q8. Montant moyen par achat (FCFA)'
  PRACCABL 'Q9. Produits achetés - Câbles/fils'
  PRACAPPA 'Q9. Produits achetés - Appareillage/disjoncteurs'
  PRACPRIS 'Q9. Produits achetés - Prises/interrupteurs'
  PRACLUMI 'Q9. Produits achetés - Luminaires'
  PRACSOLA 'Q9. Produits achetés - Solaire/onduleurs'
  PRACGROU 'Q9. Produits achetés - Groupes électrogènes'
  PAIEPRIV 'Q10. Paiement privilégié'
  IMPOMARQ 'Q11. Importance de la marque'
  MAACPLSO 'Q12. Marque achetée le plus souvent'
  MAACAUTR 'Q12. Marque achetée le plus souvent - Autre (précisez)'
  PRCRICHO 'Q13. Principal critère de choix'
  ORIGPRIV 'Q14. Origine privilégiée'
  MEQUAFIA 'Q15. Meilleure qualité/fiabilité selon vous'
  MEILPRIX 'Q16. Meilleur prix selon vous'
  ORINFACH 'Q17. L''origine influence votre achat'
  GAACPLSO 'Q18. Gamme achetée le plus souvent'
  DEAVHAGA 'Q19. Pour vous, ce qui définit AVANT TOUT un produit HAUT DE GAMME'
  CAAVBAGA 'Q20. Pour vous, ce qui caractérise AVANT TOUT un produit BAS DE GAMME'
  ORASHAGA 'Q21. À quelle origine associez-vous spontanément le HAUT DE GAMME ?'
  ORASBAGA 'Q22. À quelle origine associez-vous spontanément le BAS DE GAMME ?'
  PXHAUTGA 'Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme - Haut de gamme'
  PXMOYEGA 'Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme - Moyenne gamme'
  PXBASGAM 'Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme - Bas de gamme'
  ECQUHABA 'Q24. Selon vous, l''écart de qualité entre le haut et le bas de gamme est'
  PRIOPRIN 'Q25. Priorité principale'
  SUACMOGA 'Q26. Surcoût accepté pour monter en gamme'
  PRINFREI 'Q27. Principal frein'
  CRACPRCO 'Q28. Crainte d''acheter un produit contrefait/non conforme'
  DEJDECAC 'Q29. Déjà déçu par un achat'
  IMSECSAV 'Q30. Importance du service client et du SAV'
  SEATPRIO 'Q31. Service attendu en priorité'
  DUGAJUAC 'Q32. Durée de garantie jugée acceptable'
  CACOPREF 'Q33. Canal de contact préféré'
  BOSAPACH 'Q34. Un bon SAV/service vous ferait payer plus cher'
  CANAPREF 'Q35. Canal préféré'
  CRCHCANA 'Q36. Critère de choix du canal'
  DEJACHLI 'Q37. Déjà acheté en ligne'
  PRETACLI 'Q38. Prêt à acheter en ligne'
  PRFRACLI 'Q39. Principal frein à l''achat en ligne'
  FIMEFOUR 'Q40. Fidèle à un même fournisseur'
  RFIDPRIX 'Q41. Ce qui renforcerait votre fidélité - Prix/promotions'
  RFIDQUAL 'Q41. Ce qui renforcerait votre fidélité - Qualité constante'
  RFIDSTOC 'Q41. Ce qui renforcerait votre fidélité - Disponibilité du stock'
  RFIDCONS 'Q41. Ce qui renforcerait votre fidélité - Bon conseil'
  RFIDSAVF 'Q41. Ce qui renforcerait votre fidélité - SAV fiable'
  RFIDPROG 'Q41. Ce qui renforcerait votre fidélité - Programme de fidélité'
  RFIDPAIE 'Q41. Ce qui renforcerait votre fidélité - Facilités de paiement'
  SUGGATTE 'Q42. Une suggestion / attente (facultatif)'
  ANOMALIE 'Anomalies détectées automatiquement'
  STATUTQC 'Statut contrôle qualité'.

FORMATS
  NUMFICHE (A20)
  CODEENQU (A6)
  CODEZONE (F2.0)
  QUARTIER (A60)
  SITEENQU (A80)
  DATEENQU (SDATE10)
  HEUREENQ (A5)
  DELAIPRE (F4.0)
  ACCRECON (F2.0)
  VOUSETES (F2.0)
  SEXMAFEM (F2.0)
  AGEREPON (F2.0)
  VILLEREG (F2.0)
  REVMENME (F2.0)
  FREQACHA (F2.0)
  LIEACHPR (F2.0)
  MONMOYAC (F2.0)
  PRACCABL (F2.0)
  PRACAPPA (F2.0)
  PRACPRIS (F2.0)
  PRACLUMI (F2.0)
  PRACSOLA (F2.0)
  PRACGROU (F2.0)
  PAIEPRIV (F2.0)
  IMPOMARQ (F2.0)
  MAACPLSO (F2.0)
  MAACAUTR (A80)
  PRCRICHO (F2.0)
  ORIGPRIV (F2.0)
  MEQUAFIA (F2.0)
  MEILPRIX (F2.0)
  ORINFACH (F2.0)
  GAACPLSO (F2.0)
  DEAVHAGA (F2.0)
  CAAVBAGA (F2.0)
  ORASHAGA (F2.0)
  ORASBAGA (F2.0)
  PXHAUTGA (F2.0)
  PXMOYEGA (F2.0)
  PXBASGAM (F2.0)
  ECQUHABA (F2.0)
  PRIOPRIN (F2.0)
  SUACMOGA (F2.0)
  PRINFREI (F2.0)
  CRACPRCO (F2.0)
  DEJDECAC (F2.0)
  IMSECSAV (F2.0)
  SEATPRIO (F2.0)
  DUGAJUAC (F2.0)
  CACOPREF (F2.0)
  BOSAPACH (F2.0)
  CANAPREF (F2.0)
  CRCHCANA (F2.0)
  DEJACHLI (F2.0)
  PRETACLI (F2.0)
  PRFRACLI (F2.0)
  FIMEFOUR (F2.0)
  RFIDPRIX (F2.0)
  RFIDQUAL (F2.0)
  RFIDSTOC (F2.0)
  RFIDCONS (F2.0)
  RFIDSAVF (F2.0)
  RFIDPROG (F2.0)
  RFIDPAIE (F2.0)
  SUGGATTE (A500)
  ANOMALIE (A200)
  STATUTQC (A10).

VALUE LABELS CODEZONE
  1 'Douala'
  2 'Yaoundé'
  3 'Bafoussam'
  99 'Enquêteur inconnu'.

VALUE LABELS ACCRECON
  1 'Oui'
  2 'Non'
  99 'Non-réponse'.

VALUE LABELS VOUSETES
  1 'Particulier'
  2 'Entreprises (PME, Industries…)'
  3 'Électricien/artisan'
  4 'Entreprise BTP'
  5 'Revendeur/Grossiste/Distributeur'
  99 'Non-réponse'.

VALUE LABELS SEXMAFEM
  1 'Homme'
  2 'Femme'
  99 'Non-réponse'.

VALUE LABELS AGEREPON
  1 '<25'
  2 '25–34'
  3 '35–44'
  4 '45–54'
  5 '55+'
  99 'Non-réponse'.

VALUE LABELS VILLEREG
  1 'Douala'
  2 'Yaoundé'
  3 'Bafoussam'
  99 'Non-réponse'.

VALUE LABELS REVMENME
  1 '<100k'
  2 '100k–250k'
  3 '250k–500k'
  4 '500k–1M'
  5 '>1M'
  98 'NSP'
  99 'Non-réponse'.

VALUE LABELS FREQACHA
  1 'Chaque semaine'
  2 '1–3×/mois'
  3 'Quelques fois/an'
  4 'Rarement'
  99 'Non-réponse'.

VALUE LABELS LIEACHPR
  1 'Quincaillerie'
  2 'Grossiste spécialisé'
  3 'Magasin spécialisé'
  4 'Marché'
  5 'Importateur'
  6 'En ligne'
  99 'Non-réponse'.

VALUE LABELS MONMOYAC
  1 '<25k'
  2 '25k–100k'
  3 '100k–500k'
  4 '500k–2M'
  5 '>2M'
  99 'Non-réponse'.

VALUE LABELS PRACCABL
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PRACAPPA
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PRACPRIS
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PRACLUMI
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PRACSOLA
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PRACGROU
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS PAIEPRIV
  1 'Espèces'
  2 'Mobile Money'
  3 'Virement'
  4 'Crédit fournisseur'
  99 'Non-réponse'.

VALUE LABELS IMPOMARQ
  1 'Très importante'
  2 'Importante'
  3 'Peu importante'
  4 'Pas importante'
  99 'Non-réponse'.

VALUE LABELS MAACPLSO
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
  99 'Non-réponse'.

VALUE LABELS PRCRICHO
  1 'Prix'
  2 'Qualité/durabilité'
  3 'Disponibilité'
  4 'Notoriété'
  5 'Garantie/SAV'
  6 'Conformité normes'
  99 'Non-réponse'.

VALUE LABELS ORIGPRIV
  1 'Europe'
  2 'Asie'
  3 'Amérique'
  4 'Aucune préférence'
  99 'Non-réponse'.

VALUE LABELS MEQUAFIA
  1 'Europe'
  2 'Asie'
  3 'Amérique'
  98 'Sans avis'
  99 'Non-réponse'.

VALUE LABELS MEILPRIX
  1 'Europe'
  2 'Asie'
  3 'Amérique'
  98 'Sans avis'
  99 'Non-réponse'.

VALUE LABELS ORINFACH
  1 'Fortement'
  2 'Modérément'
  3 'Faiblement'
  4 'Pas du tout'
  99 'Non-réponse'.

VALUE LABELS GAACPLSO
  1 'Haut de gamme'
  2 'Moyenne gamme'
  3 'Bas de gamme'
  4 'Selon le projet'
  99 'Non-réponse'.

VALUE LABELS DEAVHAGA
  1 'Un prix élevé'
  2 'Une marque reconnue'
  3 'La durabilité / fiabilité'
  4 'L''origine (Europe, Asie, etc.)'
  5 'Les certifications / conformité aux normes'
  6 'Une garantie longue'
  99 'Non-réponse'.

VALUE LABELS CAAVBAGA
  1 'Un prix bas'
  2 'Une origine asiatique générique'
  3 'L''absence de marque connue'
  4 'Une durée de vie courte'
  5 'L''absence de garantie'
  6 'Un risque de non-conformité'
  99 'Non-réponse'.

VALUE LABELS ORASHAGA
  1 'Europe'
  2 'Asie'
  3 'Amérique'
  98 'Sans avis'
  99 'Non-réponse'.

VALUE LABELS ORASBAGA
  1 'Europe'
  2 'Asie'
  3 'Amérique'
  98 'Sans avis'
  99 'Non-réponse'.

VALUE LABELS PXHAUTGA
  1 '< 5 000 FCFA'
  2 '5 000 – 15 000'
  3 '15 000 – 40 000'
  4 '> 40 000 FCFA'
  99 'Non-réponse'.

VALUE LABELS PXMOYEGA
  1 '< 5 000 FCFA'
  2 '5 000 – 15 000'
  3 '15 000 – 40 000'
  4 '> 40 000 FCFA'
  99 'Non-réponse'.

VALUE LABELS PXBASGAM
  1 '< 5 000 FCFA'
  2 '5 000 – 15 000'
  3 '15 000 – 40 000'
  4 '> 40 000 FCFA'
  99 'Non-réponse'.

VALUE LABELS ECQUHABA
  1 'Très important'
  2 'Important'
  3 'Modéré'
  4 'Faible'
  5 'Inexistant'
  99 'Non-réponse'.

VALUE LABELS PRIOPRIN
  1 'Le moins cher'
  2 'Meilleur rapport qualité/prix'
  3 'Meilleure qualité quel que soit le prix'
  99 'Non-réponse'.

VALUE LABELS SUACMOGA
  1 'Aucun'
  2 'Jusqu''à +10 %'
  3 '+10–25 %'
  4 '+25–50 %'
  5 '>+50 %'
  99 'Non-réponse'.

VALUE LABELS PRINFREI
  1 'Prix élevé'
  2 'Doute qualité/contrefaçon'
  3 'Indisponibilité'
  4 'Manque de conseil'
  5 'Absence de garantie'
  6 'Délais de livraison'
  99 'Non-réponse'.

VALUE LABELS CRACPRCO
  1 'Souvent'
  2 'Parfois'
  3 'Rarement'
  4 'Jamais'
  99 'Non-réponse'.

VALUE LABELS DEJDECAC
  1 'Oui, plusieurs fois'
  2 'Oui, une fois'
  3 'Non'
  99 'Non-réponse'.

VALUE LABELS IMSECSAV
  1 'Très importante'
  2 'Importante'
  3 'Peu importante'
  4 'Pas importante'
  99 'Non-réponse'.

VALUE LABELS SEATPRIO
  1 'Garantie/remplacement'
  2 'Conseil technique'
  3 'Réparation/pièces'
  4 'Réactivité du contact'
  5 'Livraison/installation'
  99 'Non-réponse'.

VALUE LABELS DUGAJUAC
  1 '<6 mois'
  2 '6 mois–1 an'
  3 '1–2 ans'
  4 '>2 ans'
  99 'Non-réponse'.

VALUE LABELS CACOPREF
  1 'En personne'
  2 'Téléphone'
  3 'WhatsApp'
  4 'E-mail'
  5 'Réseaux sociaux'
  99 'Non-réponse'.

VALUE LABELS BOSAPACH
  1 'Oui'
  2 'Peut-être'
  3 'Non'
  99 'Non-réponse'.

VALUE LABELS CANAPREF
  1 'Quincaillerie'
  2 'Grossiste spécialisé'
  3 'Magasin spécialisé'
  4 'Marché'
  5 'Importateur'
  6 'En ligne'
  99 'Non-réponse'.

VALUE LABELS CRCHCANA
  1 'Proximité'
  2 'Prix'
  3 'Largeur du choix'
  4 'Disponibilité'
  5 'Conseil'
  6 'Confiance'
  99 'Non-réponse'.

VALUE LABELS DEJACHLI
  1 'Oui'
  2 'Non'
  99 'Non-réponse'.

VALUE LABELS PRETACLI
  1 'Oui'
  2 'Peut-être'
  3 'Non'
  99 'Non-réponse'.

VALUE LABELS PRFRACLI
  1 'Qualité/conformité'
  2 'Ne pas voir le produit'
  3 'Confiance paiement'
  4 'Livraison'
  5 'Absence de SAV'
  99 'Non-réponse'.

VALUE LABELS FIMEFOUR
  1 'Toujours'
  2 'Souvent'
  3 'Parfois'
  4 'Rarement'
  5 'Jamais'
  99 'Non-réponse'.

VALUE LABELS RFIDPRIX
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDQUAL
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDSTOC
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDCONS
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDSAVF
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDPROG
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

VALUE LABELS RFIDPAIE
  1 'Cité'
  0 'Non cité'
  99 'Non-réponse'.

MISSING VALUES
  CODEZONE (99)
  ACCRECON (99)
  VOUSETES (99)
  SEXMAFEM (99)
  AGEREPON (99)
  VILLEREG (99)
  REVMENME (98 99)
  FREQACHA (99)
  LIEACHPR (99)
  MONMOYAC (99)
  PRACCABL (99)
  PRACAPPA (99)
  PRACPRIS (99)
  PRACLUMI (99)
  PRACSOLA (99)
  PRACGROU (99)
  PAIEPRIV (99)
  IMPOMARQ (99)
  MAACPLSO (99)
  PRCRICHO (99)
  ORIGPRIV (99)
  MEQUAFIA (98 99)
  MEILPRIX (98 99)
  ORINFACH (99)
  GAACPLSO (99)
  DEAVHAGA (99)
  CAAVBAGA (99)
  ORASHAGA (98 99)
  ORASBAGA (98 99)
  PXHAUTGA (99)
  PXMOYEGA (99)
  PXBASGAM (99)
  ECQUHABA (99)
  PRIOPRIN (99)
  SUACMOGA (99)
  PRINFREI (99)
  CRACPRCO (99)
  DEJDECAC (99)
  IMSECSAV (99)
  SEATPRIO (99)
  DUGAJUAC (99)
  CACOPREF (99)
  BOSAPACH (99)
  CANAPREF (99)
  CRCHCANA (99)
  DEJACHLI (99)
  PRETACLI (99)
  PRFRACLI (99)
  FIMEFOUR (99)
  RFIDPRIX (99)
  RFIDQUAL (99)
  RFIDSTOC (99)
  RFIDCONS (99)
  RFIDSAVF (99)
  RFIDPROG (99)
  RFIDPAIE (99).

VARIABLE LEVEL
  CODEZONE (NOMINAL)
  DELAIPRE (SCALE)
  ACCRECON (NOMINAL)
  VOUSETES (NOMINAL)
  SEXMAFEM (NOMINAL)
  AGEREPON (ORDINAL)
  VILLEREG (NOMINAL)
  REVMENME (ORDINAL)
  FREQACHA (ORDINAL)
  LIEACHPR (NOMINAL)
  MONMOYAC (ORDINAL)
  PRACCABL (NOMINAL)
  PRACAPPA (NOMINAL)
  PRACPRIS (NOMINAL)
  PRACLUMI (NOMINAL)
  PRACSOLA (NOMINAL)
  PRACGROU (NOMINAL)
  PAIEPRIV (NOMINAL)
  IMPOMARQ (ORDINAL)
  MAACPLSO (NOMINAL)
  PRCRICHO (NOMINAL)
  ORIGPRIV (NOMINAL)
  MEQUAFIA (NOMINAL)
  MEILPRIX (NOMINAL)
  ORINFACH (ORDINAL)
  GAACPLSO (NOMINAL)
  DEAVHAGA (NOMINAL)
  CAAVBAGA (NOMINAL)
  ORASHAGA (NOMINAL)
  ORASBAGA (NOMINAL)
  PXHAUTGA (ORDINAL)
  PXMOYEGA (ORDINAL)
  PXBASGAM (ORDINAL)
  ECQUHABA (ORDINAL)
  PRIOPRIN (ORDINAL)
  SUACMOGA (ORDINAL)
  PRINFREI (NOMINAL)
  CRACPRCO (ORDINAL)
  DEJDECAC (ORDINAL)
  IMSECSAV (ORDINAL)
  SEATPRIO (NOMINAL)
  DUGAJUAC (ORDINAL)
  CACOPREF (NOMINAL)
  BOSAPACH (ORDINAL)
  CANAPREF (NOMINAL)
  CRCHCANA (NOMINAL)
  DEJACHLI (NOMINAL)
  PRETACLI (ORDINAL)
  PRFRACLI (NOMINAL)
  FIMEFOUR (ORDINAL)
  RFIDPRIX (NOMINAL)
  RFIDQUAL (NOMINAL)
  RFIDSTOC (NOMINAL)
  RFIDCONS (NOMINAL)
  RFIDSAVF (NOMINAL)
  RFIDPROG (NOMINAL)
  RFIDPAIE (NOMINAL).

EXECUTE.


FREQUENCIES VARIABLES=CODEZONE CODEENQU VOUSETES SEXMAFEM
 /ORDER=ANALYSIS.

SAVE OUTFILE=!SAVPOST
 /COMPRESSED.

EXECUTE.

* ======================================================================.
* FIN.
* ======================================================================.
