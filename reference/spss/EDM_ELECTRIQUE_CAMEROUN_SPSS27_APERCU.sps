* EDM ELECTRIQUE CAMEROUN - APERCU SPSS 27.
SET UNICODE=ON.
SET DECIMAL DOT.
GET DATA
 /TYPE=XLSX
 /FILE='C:\\A_REMPLACER\EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL.xlsx'
 /SHEET=NAME 'SPSS_EXPORT'
 /READNAMES=ON.
DATASET NAME EDM_ELECTRIQUE WINDOW=FRONT.
EXECUTE.

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

VALUE LABELS CODEZONE
 1 'Douala'
 2 'Yaoundé'
 3 'Bafoussam'
 99 'Enquêteur inconnu'
.
VALUE LABELS ACCRECON
 1 'Oui'
 2 'Non'
 99 'Non-réponse'
.
VALUE LABELS VOUSETES
 1 'Particulier'
 2 'Entreprises (PME, Industries…)'
 3 'Électricien/artisan'
 4 'Entreprise BTP'
 5 'Revendeur/Grossiste/Distributeur'
 99 'Non-réponse'
.
VALUE LABELS SEXMAFEM
 1 'Homme'
 2 'Femme'
 99 'Non-réponse'
.
VALUE LABELS AGEREPON
 1 '<25'
 2 '25–34'
 3 '35–44'
 4 '45–54'
 5 '55+'
 99 'Non-réponse'
.
VALUE LABELS VILLEREG
 1 'Douala'
 2 'Yaoundé'
 3 'Bafoussam'
 99 'Non-réponse'
.
VALUE LABELS REVMENME
 1 '<100k'
 2 '100k–250k'
 3 '250k–500k'
 4 '500k–1M'
 5 '>1M'
 98 'NSP'
 99 'Non-réponse'
.
VALUE LABELS FREQACHA
 1 'Chaque semaine'
 2 '1–3×/mois'
 3 'Quelques fois/an'
 4 'Rarement'
 99 'Non-réponse'
.
VALUE LABELS LIEACHPR
 1 'Quincaillerie'
 2 'Grossiste spécialisé'
 3 'Magasin spécialisé'
 4 'Marché'
 5 'Importateur'
 6 'En ligne'
 99 'Non-réponse'
.
VALUE LABELS MONMOYAC
 1 '<25k'
 2 '25k–100k'
 3 '100k–500k'
 4 '500k–2M'
 5 '>2M'
 99 'Non-réponse'
.
VALUE LABELS PRACCABL
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS PRACAPPA
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS PRACPRIS
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS PRACLUMI
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS PRACSOLA
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS PRACGROU
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS PAIEPRIV
 1 'Espèces'
 2 'Mobile Money'
 3 'Virement'
 4 'Crédit fournisseur'
 99 'Non-réponse'
.
VALUE LABELS IMPOMARQ
 1 'Très importante'
 2 'Importante'
 3 'Peu importante'
 4 'Pas importante'
 99 'Non-réponse'
.
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
 99 'Non-réponse'
.
VALUE LABELS PRCRICHO
 1 'Prix'
 2 'Qualité/durabilité'
 3 'Disponibilité'
 4 'Notoriété'
 5 'Garantie/SAV'
 6 'Conformité normes'
 99 'Non-réponse'
.
VALUE LABELS ORIGPRIV
 1 'Europe'
 2 'Asie'
 3 'Amérique'
 4 'Aucune préférence'
 99 'Non-réponse'
.
VALUE LABELS MEQUAFIA
 1 'Europe'
 2 'Asie'
 3 'Amérique'
 98 'Sans avis'
 99 'Non-réponse'
.
VALUE LABELS MEILPRIX
 1 'Europe'
 2 'Asie'
 3 'Amérique'
 98 'Sans avis'
 99 'Non-réponse'
.
VALUE LABELS ORINFACH
 1 'Fortement'
 2 'Modérément'
 3 'Faiblement'
 4 'Pas du tout'
 99 'Non-réponse'
.
VALUE LABELS GAACPLSO
 1 'Haut de gamme'
 2 'Moyenne gamme'
 3 'Bas de gamme'
 4 'Selon le projet'
 99 'Non-réponse'
.
VALUE LABELS DEAVHAGA
 1 'Un prix élevé'
 2 'Une marque reconnue'
 3 'La durabilité / fiabilité'
 4 'L''origine (Europe, Asie, etc.)'
 5 'Les certifications / conformité aux normes'
 6 'Une garantie longue'
 99 'Non-réponse'
.
VALUE LABELS CAAVBAGA
 1 'Un prix bas'
 2 'Une origine asiatique générique'
 3 'L''absence de marque connue'
 4 'Une durée de vie courte'
 5 'L''absence de garantie'
 6 'Un risque de non-conformité'
 99 'Non-réponse'
.
VALUE LABELS ORASHAGA
 1 'Europe'
 2 'Asie'
 3 'Amérique'
 98 'Sans avis'
 99 'Non-réponse'
.
VALUE LABELS ORASBAGA
 1 'Europe'
 2 'Asie'
 3 'Amérique'
 98 'Sans avis'
 99 'Non-réponse'
.
VALUE LABELS PXHAUTGA
 1 '< 5 000 FCFA'
 2 '5 000 – 15 000'
 3 '15 000 – 40 000'
 4 '> 40 000 FCFA'
 99 'Non-réponse'
.
VALUE LABELS PXMOYEGA
 1 '< 5 000 FCFA'
 2 '5 000 – 15 000'
 3 '15 000 – 40 000'
 4 '> 40 000 FCFA'
 99 'Non-réponse'
.
VALUE LABELS PXBASGAM
 1 '< 5 000 FCFA'
 2 '5 000 – 15 000'
 3 '15 000 – 40 000'
 4 '> 40 000 FCFA'
 99 'Non-réponse'
.
VALUE LABELS ECQUHABA
 1 'Très important'
 2 'Important'
 3 'Modéré'
 4 'Faible'
 5 'Inexistant'
 99 'Non-réponse'
.
VALUE LABELS PRIOPRIN
 1 'Le moins cher'
 2 'Meilleur rapport qualité/prix'
 3 'Meilleure qualité quel que soit le prix'
 99 'Non-réponse'
.
VALUE LABELS SUACMOGA
 1 'Aucun'
 2 'Jusqu''à +10 %'
 3 '+10–25 %'
 4 '+25–50 %'
 5 '>+50 %'
 99 'Non-réponse'
.
VALUE LABELS PRINFREI
 1 'Prix élevé'
 2 'Doute qualité/contrefaçon'
 3 'Indisponibilité'
 4 'Manque de conseil'
 5 'Absence de garantie'
 6 'Délais de livraison'
 99 'Non-réponse'
.
VALUE LABELS CRACPRCO
 1 'Souvent'
 2 'Parfois'
 3 'Rarement'
 4 'Jamais'
 99 'Non-réponse'
.
VALUE LABELS DEJDECAC
 1 'Oui, plusieurs fois'
 2 'Oui, une fois'
 3 'Non'
 99 'Non-réponse'
.
VALUE LABELS IMSECSAV
 1 'Très importante'
 2 'Importante'
 3 'Peu importante'
 4 'Pas importante'
 99 'Non-réponse'
.
VALUE LABELS SEATPRIO
 1 'Garantie/remplacement'
 2 'Conseil technique'
 3 'Réparation/pièces'
 4 'Réactivité du contact'
 5 'Livraison/installation'
 99 'Non-réponse'
.
VALUE LABELS DUGAJUAC
 1 '<6 mois'
 2 '6 mois–1 an'
 3 '1–2 ans'
 4 '>2 ans'
 99 'Non-réponse'
.
VALUE LABELS CACOPREF
 1 'En personne'
 2 'Téléphone'
 3 'WhatsApp'
 4 'E-mail'
 5 'Réseaux sociaux'
 99 'Non-réponse'
.
VALUE LABELS BOSAPACH
 1 'Oui'
 2 'Peut-être'
 3 'Non'
 99 'Non-réponse'
.
VALUE LABELS CANAPREF
 1 'Quincaillerie'
 2 'Grossiste spécialisé'
 3 'Magasin spécialisé'
 4 'Marché'
 5 'Importateur'
 6 'En ligne'
 99 'Non-réponse'
.
VALUE LABELS CRCHCANA
 1 'Proximité'
 2 'Prix'
 3 'Largeur du choix'
 4 'Disponibilité'
 5 'Conseil'
 6 'Confiance'
 99 'Non-réponse'
.
VALUE LABELS DEJACHLI
 1 'Oui'
 2 'Non'
 99 'Non-réponse'
.
VALUE LABELS PRETACLI
 1 'Oui'
 2 'Peut-être'
 3 'Non'
 99 'Non-réponse'
.
VALUE LABELS PRFRACLI
 1 'Qualité/conformité'
 2 'Ne pas voir le produit'
 3 'Confiance paiement'
 4 'Livraison'
 5 'Absence de SAV'
 99 'Non-réponse'
.
VALUE LABELS FIMEFOUR
 1 'Toujours'
 2 'Souvent'
 3 'Parfois'
 4 'Rarement'
 5 'Jamais'
 99 'Non-réponse'
.
VALUE LABELS RFIDPRIX
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS RFIDQUAL
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS RFIDSTOC
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS RFIDCONS
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS RFIDSAVF
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS RFIDPROG
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
VALUE LABELS RFIDPAIE
 1 'Cité'
 0 'Non cité'
 99 'Non-réponse'
.
MISSING VALUES CODEZONE (99).
MISSING VALUES ACCRECON (99).
MISSING VALUES VOUSETES (99).
MISSING VALUES SEXMAFEM (99).
MISSING VALUES AGEREPON (99).
MISSING VALUES VILLEREG (99).
MISSING VALUES REVMENME (98 99).
MISSING VALUES FREQACHA (99).
MISSING VALUES LIEACHPR (99).
MISSING VALUES MONMOYAC (99).
MISSING VALUES PRACCABL (99).
MISSING VALUES PRACAPPA (99).
MISSING VALUES PRACPRIS (99).
MISSING VALUES PRACLUMI (99).
MISSING VALUES PRACSOLA (99).
MISSING VALUES PRACGROU (99).
MISSING VALUES PAIEPRIV (99).
MISSING VALUES IMPOMARQ (99).
MISSING VALUES MAACPLSO (99).
MISSING VALUES PRCRICHO (99).
MISSING VALUES ORIGPRIV (99).
MISSING VALUES MEQUAFIA (98 99).
MISSING VALUES MEILPRIX (98 99).
MISSING VALUES ORINFACH (99).
MISSING VALUES GAACPLSO (99).
MISSING VALUES DEAVHAGA (99).
MISSING VALUES CAAVBAGA (99).
MISSING VALUES ORASHAGA (98 99).
MISSING VALUES ORASBAGA (98 99).
MISSING VALUES PXHAUTGA (99).
MISSING VALUES PXMOYEGA (99).
MISSING VALUES PXBASGAM (99).
MISSING VALUES ECQUHABA (99).
MISSING VALUES PRIOPRIN (99).
MISSING VALUES SUACMOGA (99).
MISSING VALUES PRINFREI (99).
MISSING VALUES CRACPRCO (99).
MISSING VALUES DEJDECAC (99).
MISSING VALUES IMSECSAV (99).
MISSING VALUES SEATPRIO (99).
MISSING VALUES DUGAJUAC (99).
MISSING VALUES CACOPREF (99).
MISSING VALUES BOSAPACH (99).
MISSING VALUES CANAPREF (99).
MISSING VALUES CRCHCANA (99).
MISSING VALUES DEJACHLI (99).
MISSING VALUES PRETACLI (99).
MISSING VALUES PRFRACLI (99).
MISSING VALUES FIMEFOUR (99).
MISSING VALUES RFIDPRIX (99).
MISSING VALUES RFIDQUAL (99).
MISSING VALUES RFIDSTOC (99).
MISSING VALUES RFIDCONS (99).
MISSING VALUES RFIDSAVF (99).
MISSING VALUES RFIDPROG (99).
MISSING VALUES RFIDPAIE (99).
VARIABLE LEVEL CODEZONE (NOMINAL).
VARIABLE LEVEL DELAIPRE (SCALE).
VARIABLE LEVEL ACCRECON (NOMINAL).
VARIABLE LEVEL VOUSETES (NOMINAL).
VARIABLE LEVEL SEXMAFEM (NOMINAL).
VARIABLE LEVEL AGEREPON (ORDINAL).
VARIABLE LEVEL VILLEREG (NOMINAL).
VARIABLE LEVEL REVMENME (ORDINAL).
VARIABLE LEVEL FREQACHA (ORDINAL).
VARIABLE LEVEL LIEACHPR (NOMINAL).
VARIABLE LEVEL MONMOYAC (ORDINAL).
VARIABLE LEVEL PRACCABL (NOMINAL).
VARIABLE LEVEL PRACAPPA (NOMINAL).
VARIABLE LEVEL PRACPRIS (NOMINAL).
VARIABLE LEVEL PRACLUMI (NOMINAL).
VARIABLE LEVEL PRACSOLA (NOMINAL).
VARIABLE LEVEL PRACGROU (NOMINAL).
VARIABLE LEVEL PAIEPRIV (NOMINAL).
VARIABLE LEVEL IMPOMARQ (ORDINAL).
VARIABLE LEVEL MAACPLSO (NOMINAL).
VARIABLE LEVEL PRCRICHO (NOMINAL).
VARIABLE LEVEL ORIGPRIV (NOMINAL).
VARIABLE LEVEL MEQUAFIA (NOMINAL).
VARIABLE LEVEL MEILPRIX (NOMINAL).
VARIABLE LEVEL ORINFACH (ORDINAL).
VARIABLE LEVEL GAACPLSO (NOMINAL).
VARIABLE LEVEL DEAVHAGA (NOMINAL).
VARIABLE LEVEL CAAVBAGA (NOMINAL).
VARIABLE LEVEL ORASHAGA (NOMINAL).
VARIABLE LEVEL ORASBAGA (NOMINAL).
VARIABLE LEVEL PXHAUTGA (ORDINAL).
VARIABLE LEVEL PXMOYEGA (ORDINAL).
VARIABLE LEVEL PXBASGAM (ORDINAL).
VARIABLE LEVEL ECQUHABA (ORDINAL).
VARIABLE LEVEL PRIOPRIN (ORDINAL).
VARIABLE LEVEL SUACMOGA (ORDINAL).
VARIABLE LEVEL PRINFREI (NOMINAL).
VARIABLE LEVEL CRACPRCO (ORDINAL).
VARIABLE LEVEL DEJDECAC (ORDINAL).
VARIABLE LEVEL IMSECSAV (ORDINAL).
VARIABLE LEVEL SEATPRIO (NOMINAL).
VARIABLE LEVEL DUGAJUAC (ORDINAL).
VARIABLE LEVEL CACOPREF (NOMINAL).
VARIABLE LEVEL BOSAPACH (ORDINAL).
VARIABLE LEVEL CANAPREF (NOMINAL).
VARIABLE LEVEL CRCHCANA (NOMINAL).
VARIABLE LEVEL DEJACHLI (NOMINAL).
VARIABLE LEVEL PRETACLI (ORDINAL).
VARIABLE LEVEL PRFRACLI (NOMINAL).
VARIABLE LEVEL FIMEFOUR (ORDINAL).
VARIABLE LEVEL RFIDPRIX (NOMINAL).
VARIABLE LEVEL RFIDQUAL (NOMINAL).
VARIABLE LEVEL RFIDSTOC (NOMINAL).
VARIABLE LEVEL RFIDCONS (NOMINAL).
VARIABLE LEVEL RFIDSAVF (NOMINAL).
VARIABLE LEVEL RFIDPROG (NOMINAL).
VARIABLE LEVEL RFIDPAIE (NOMINAL).
FORMATS NUMFICHE (A20).
FORMATS CODEENQU (A6).
FORMATS CODEZONE (F2.0).
FORMATS QUARTIER (A60).
FORMATS SITEENQU (A80).
FORMATS DATEENQU (SDATE10).
FORMATS HEUREENQ (A5).
FORMATS DELAIPRE (F4.0).
FORMATS ACCRECON (F2.0).
FORMATS VOUSETES (F2.0).
FORMATS SEXMAFEM (F2.0).
FORMATS AGEREPON (F2.0).
FORMATS VILLEREG (F2.0).
FORMATS REVMENME (F2.0).
FORMATS FREQACHA (F2.0).
FORMATS LIEACHPR (F2.0).
FORMATS MONMOYAC (F2.0).
FORMATS PRACCABL (F2.0).
FORMATS PRACAPPA (F2.0).
FORMATS PRACPRIS (F2.0).
FORMATS PRACLUMI (F2.0).
FORMATS PRACSOLA (F2.0).
FORMATS PRACGROU (F2.0).
FORMATS PAIEPRIV (F2.0).
FORMATS IMPOMARQ (F2.0).
FORMATS MAACPLSO (F2.0).
FORMATS MAACAUTR (A80).
FORMATS PRCRICHO (F2.0).
FORMATS ORIGPRIV (F2.0).
FORMATS MEQUAFIA (F2.0).
FORMATS MEILPRIX (F2.0).
FORMATS ORINFACH (F2.0).
FORMATS GAACPLSO (F2.0).
FORMATS DEAVHAGA (F2.0).
FORMATS CAAVBAGA (F2.0).
FORMATS ORASHAGA (F2.0).
FORMATS ORASBAGA (F2.0).
FORMATS PXHAUTGA (F2.0).
FORMATS PXMOYEGA (F2.0).
FORMATS PXBASGAM (F2.0).
FORMATS ECQUHABA (F2.0).
FORMATS PRIOPRIN (F2.0).
FORMATS SUACMOGA (F2.0).
FORMATS PRINFREI (F2.0).
FORMATS CRACPRCO (F2.0).
FORMATS DEJDECAC (F2.0).
FORMATS IMSECSAV (F2.0).
FORMATS SEATPRIO (F2.0).
FORMATS DUGAJUAC (F2.0).
FORMATS CACOPREF (F2.0).
FORMATS BOSAPACH (F2.0).
FORMATS CANAPREF (F2.0).
FORMATS CRCHCANA (F2.0).
FORMATS DEJACHLI (F2.0).
FORMATS PRETACLI (F2.0).
FORMATS PRFRACLI (F2.0).
FORMATS FIMEFOUR (F2.0).
FORMATS RFIDPRIX (F2.0).
FORMATS RFIDQUAL (F2.0).
FORMATS RFIDSTOC (F2.0).
FORMATS RFIDCONS (F2.0).
FORMATS RFIDSAVF (F2.0).
FORMATS RFIDPROG (F2.0).
FORMATS RFIDPAIE (F2.0).
FORMATS SUGGATTE (A500).
FORMATS ANOMALIE (A200).
FORMATS STATUTQC (A10).
MRSETS
 /MDGROUP NAME=$PRODUITS_ACHETES
 VARIABLES=PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU
 VALUE=1
 LABEL='Produits achetés (réponses multiples)'.
MRSETS
 /MDGROUP NAME=$FIDELITE
 VARIABLES=RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE
 VALUE=1
 LABEL='Facteurs renforçant la fidélité (réponses multiples)'.
SAVE OUTFILE="C:\\A_REMPLACER\EDM_ELECTRIQUE_CAMEROUN_SPSS27.sav"
 /COMPRESSED.
EXECUTE.