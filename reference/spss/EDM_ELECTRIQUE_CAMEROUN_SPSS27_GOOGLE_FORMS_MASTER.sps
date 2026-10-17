* ======================================================================.
* ETUDE EDM ELECTRIQUE CAMEROUN - SPSS 27 - MASTER GOOGLE FORMS.
* ======================================================================.
* OBJECTIF : importer l'export Excel de Google Forms, recoder automatiquement
* les réponses et produire un fichier SAV prêt pour l'analyse.
*
* UTILISATION MINIMALE :
* 1. Dans Google Forms -> Réponses -> ouvrir dans Google Sheets.
* 2. Dans Google Sheets : Fichier -> Télécharger -> Microsoft Excel (.xlsx).
* 3. Enregistrer le fichier sous :
*    C:\ETUDE EDM\EDM_ELECTRIQUE_CAMEROUN_REPONSES.xlsx
* 4. Ouvrir CE SCRIPT dans SPSS 27.
* 5. Menu Run -> All.
* 6. Le fichier final est créé automatiquement :
*    C:\ETUDE EDM\EDM_ELECTRIQUE_CAMEROUN_FINAL.sav
*
* IMPORTANT :
* - Ne modifiez pas l'ordre des colonnes dans l'export Google Forms.
* - Le script lit les 63 premières colonnes A:BK de l'export.
* - Il conserve les réponses brutes utiles (nom, téléphone, e-mail, etc.)
*   séparément des variables quantitatives/codées utilisées pour l'analyse.
* - Les questions à réponses multiples Q9 et Q41 sont transformées en
*   variables binaires 0/1, ce qui permet les fréquences et croisements.
* - Les réponses manquantes aux questions fermées sont codées 99.
* - NSP / Sans avis sont codés 98 lorsque prévu par le questionnaire.
* - Les valeurs inattendues ne sont PAS silencieusement transformées :
*   elles sont signalées dans la variable ANOMALIE.
*
* Le formulaire consulté contient notamment : identifiant enquêteur,
* zone/site, coordonnées de contact, consentement, Q1-Q42, Q9/Q41
* en réponses multiples et Q23 sous forme de grille. Le script tient
* compte de cette structure.
* ======================================================================.

SET UNICODE=YES.
SET DECIMAL=DOT.

DEFINE !XLSX()
'C:\ETUDE EDM\EDM_ELECTRIQUE_CAMEROUN_REPONSES.xlsx'
!ENDDEFINE.

DEFINE !SAVOUT()
'C:\ETUDE EDM\EDM_ELECTRIQUE_CAMEROUN_FINAL.sav'
!ENDDEFINE.

* ----------------------------------------------------------------------.
* 1. IMPORT BRUT DE GOOGLE FORMS.
* ----------------------------------------------------------------------.

GET DATA
 /TYPE=XLSX
 /FILE=!XLSX
 /SHEET=INDEX 1
 /CELLRANGE=RANGE 'A2:BK10000'
 /READNAMES=OFF.

DATASET NAME EDM_RAW.

* Les 63 colonnes correspondent à l'ordre du formulaire exporté.
* A1:BK = 63 colonnes.

RENAME VARIABLES
 (VAR00001=RAW01) (VAR00002=RAW02) (VAR00003=RAW03) (VAR00004=RAW04)
 (VAR00005=RAW05) (VAR00006=RAW06) (VAR00007=RAW07) (VAR00008=RAW08)
 (VAR00009=RAW09) (VAR00010=RAW10) (VAR00011=RAW11) (VAR00012=RAW12)
 (VAR00013=RAW13) (VAR00014=RAW14) (VAR00015=RAW15) (VAR00016=RAW16)
 (VAR00017=RAW17) (VAR00018=RAW18) (VAR00019=RAW19) (VAR00020=RAW20)
 (VAR00021=RAW21) (VAR00022=RAW22) (VAR00023=RAW23) (VAR00024=RAW24)
 (VAR00025=RAW25) (VAR00026=RAW26) (VAR00027=RAW27) (VAR00028=RAW28)
 (VAR00029=RAW29) (VAR00030=RAW30) (VAR00031=RAW31) (VAR00032=RAW32)
 (VAR00033=RAW33) (VAR00034=RAW34) (VAR00035=RAW35) (VAR00036=RAW36)
 (VAR00037=RAW37) (VAR00038=RAW38) (VAR00039=RAW39) (VAR00040=RAW40)
 (VAR00041=RAW41) (VAR00042=RAW42) (VAR00043=RAW43) (VAR00044=RAW44)
 (VAR00045=RAW45) (VAR00046=RAW46) (VAR00047=RAW47) (VAR00048=RAW48)
 (VAR00049=RAW49) (VAR00050=RAW50) (VAR00051=RAW51) (VAR00052=RAW52)
 (VAR00053=RAW53) (VAR00054=RAW54) (VAR00055=RAW55) (VAR00056=RAW56)
 (VAR00057=RAW57) (VAR00058=RAW58) (VAR00059=RAW59) (VAR00060=RAW60)
 (VAR00061=RAW61) (VAR00062=RAW62) (VAR00063=RAW63).

* ----------------------------------------------------------------------.
* 2. VARIABLES BRUTES CONSERVEES.
* ----------------------------------------------------------------------.

RENAME VARIABLES
 (RAW01=HORODAT) (RAW02=CODEENQU) (RAW03=QUARTIER) (RAW04=SITEENQU)
 (RAW05=NOMENQ) (RAW06=TELENQ) (RAW07=EMAILENQ) (RAW08=ACCRECON_RAW)
 (RAW09=VOUSETES_RAW) (RAW10=SEXMAFEM_RAW) (RAW11=AGEREPON_RAW)
 (RAW12=VILLEREG_RAW) (RAW13=REVMENME_RAW) (RAW14=FREQACHA_RAW)
 (RAW15=LIEACHPR_RAW) (RAW16=MONMOYAC_RAW) (RAW17=PRACCABL_RAW)
 (RAW18=PRACAPPA_RAW) (RAW19=PRACPRIS_RAW) (RAW20=PRACLUMI_RAW)
 (RAW21=PRACSOLA_RAW) (RAW22=PRACGROU_RAW) (RAW23=PAIEPRIV_RAW)
 (RAW24=IMPOMARQ_RAW) (RAW25=MAACPLSO_RAW) (RAW26=MAACAUTR_RAW)
 (RAW27=PRCRICHO_RAW) (RAW28=ORIGPRIV_RAW) (RAW29=MEQUAFIA_RAW)
 (RAW30=MEILPRIX_RAW) (RAW31=ORINFACH_RAW) (RAW32=GAACPLSO_RAW)
 (RAW33=DEAVHAGA_RAW) (RAW34=CAAVBAGA_RAW) (RAW35=ORASHAGA_RAW)
 (RAW36=ORASBAGA_RAW) (RAW37=PXHAUTGA_RAW) (RAW38=PXMOYEGA_RAW)
 (RAW39=PXBASGAM_RAW) (RAW40=ECQUHABA_RAW) (RAW41=PRIOPRIN_RAW)
 (RAW42=SUACMOGA_RAW) (RAW43=PRINFREI_RAW) (RAW44=CRACPRCO_RAW)
 (RAW45=DEJDECAC_RAW) (RAW46=IMSECSAV_RAW) (RAW47=SEATPRIO_RAW)
 (RAW48=DUGAJUAC_RAW) (RAW49=CACOPREF_RAW) (RAW50=BOSAPACH_RAW)
 (RAW51=CANAPREF_RAW) (RAW52=CRCHCANA_RAW) (RAW53=DEJACHLI_RAW)
 (RAW54=PRETACLI_RAW) (RAW55=PRFRACLI_RAW) (RAW56=FIMEFOUR_RAW)
 (RAW57=RFIDPRIX_RAW) (RAW58=RFIDQUAL_RAW) (RAW59=RFIDSTOC_RAW)
 (RAW60=RFIDCONS_RAW) (RAW61=RFIDSAVF_RAW) (RAW62=RFIDPROG_RAW)
 (RAW63=RFIDPAIE_RAW).

* ----------------------------------------------------------------------.
* 3. VARIABLES ANALYTIQUES NUMERIQUES.
* ----------------------------------------------------------------------.

NUMERIC
 NUMFICHE CODEZONE DELAIPRE ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG
 REVMENME FREQACHA LIEACHPR MONMOYAC PRACCABL PRACAPPA PRACPRIS PRACLUMI
 PRACSOLA PRACGROU PAIEPRIV IMPOMARQ MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA
 MEILPRIX ORINFACH GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA
 PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC
 IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI
 PRETACLI PRFRACLI FIMEFOUR RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF
 RFIDPROG RFIDPAIE (F8.0).

STRING ANOMALIE (A200) STATUTQC (A20).
COMPUTE NUMFICHE=$CASENUM.

* ----------------------------------------------------------------------.
* 4. RECODAGE DES VARIABLES FERMEES.
* ----------------------------------------------------------------------.

RECODE ACCRECON_RAW ('Oui'=1) ('Non'=2) INTO ACCRECON.
RECODE VOUSETES_RAW
 ('Particulier'=1) ('Entreprises (PME, Industries…)'=2) ('Électricien/artisan'=3)
 ('Entreprise BTP'=4) ('Revendeur/Grossiste/Distributeur'=5) INTO VOUSETES.
RECODE SEXMAFEM_RAW ('Homme'=1) ('Femme'=2) INTO SEXMAFEM.
RECODE AGEREPON_RAW ('<25'=1) ('25–34'=2) ('35–44'=3) ('45–54'=4) ('55+'=5) INTO AGEREPON.
RECODE VILLEREG_RAW ('Douala'=1) ('Yaoundé'=2) ('Bafoussam'=3) INTO VILLEREG.
RECODE REVMENME_RAW ('<100k'=1) ('100k–250k'=2) ('250k–500k'=3) ('500k–1M'=4) ('>1M'=5) ('NSP'=98) INTO REVMENME.
RECODE FREQACHA_RAW ('Chaque semaine'=1) ('1–3×/mois'=2) ('Quelques fois/an'=3) ('Rarement'=4) INTO FREQACHA.
RECODE LIEACHPR_RAW ('Quincaillerie'=1) ('Grossiste spécialisé'=2) ('Magasin spécialisé'=3) ('Marché'=4) ('Importateur'=5) ('En ligne'=6) INTO LIEACHPR.
RECODE MONMOYAC_RAW ('<25k'=1) ('25k–100k'=2) ('100k–500k'=3) ('500k–2M'=4) ('>2M'=5) INTO MONMOYAC.
RECODE PAIEPRIV_RAW ('Espèces'=1) ('Mobile Money'=2) ('Virement'=3) ('Crédit fournisseur'=4) INTO PAIEPRIV.
RECODE IMPOMARQ_RAW ('Très importante'=1) ('Importante'=2) ('Peu importante'=3) ('Pas importante'=4) INTO IMPOMARQ.
RECODE MAACPLSO_RAW ('Schneider'=1) ('Legrand'=2) ('Vectron'=3) ('Hager'=4) ('ABB'=5) ('Siemens'=6) ('Chint/chinoise'=7) ('Philips'=8) ('JA Solar'=9) ('Longi'=10) ('Growatt'=11) ('Autre'=12) INTO MAACPLSO.
IF (INDEX(MAACPLSO_RAW,'Other')>0) MAACPLSO=12.
IF (INDEX(MAACPLSO_RAW,'Autre')>0) MAACPLSO=12.
RECODE PRCRICHO_RAW ('Prix'=1) ('Qualité/durabilité'=2) ('Disponibilité'=3) ('Notoriété'=4) ('Garantie/SAV'=5) ('Conformité normes'=6) INTO PRCRICHO.
RECODE ORIGPRIV_RAW ('Europe'=1) ('Asie'=2) ('Amérique'=3) ('Aucune préférence'=4) INTO ORIGPRIV.
RECODE MEQUAFIA_RAW ('Europe'=1) ('Asie'=2) ('Amérique'=3) ('Sans avis'=98) INTO MEQUAFIA.
RECODE MEILPRIX_RAW ('Europe'=1) ('Asie'=2) ('Amérique'=3) ('Sans avis'=98) INTO MEILPRIX.
RECODE ORINFACH_RAW ('Fortement'=1) ('Modérément'=2) ('Faiblement'=3) ('Pas du tout'=4) INTO ORINFACH.
RECODE GAACPLSO_RAW ('Haut de gamme'=1) ('Moyenne gamme'=2) ('Bas de gamme'=3) ('Selon le projet'=4) INTO GAACPLSO.
RECODE DEAVHAGA_RAW ('Un prix élevé'=1) ('Une marque reconnue'=2) ('La durabilité / fiabilité'=3) ('L''origine (Europe, Asie, etc.)'=4) ('Les certifications / conformité aux normes'=5) ('Une garantie longue'=6) INTO DEAVHAGA.
RECODE CAAVBAGA_RAW ('Un prix bas'=1) ('Une origine asiatique générique'=2) ('L''absence de marque connue'=3) ('Une durée de vie courte'=4) ('L''absence de garantie'=5) ('Un risque de non-conformité'=6) INTO CAAVBAGA.
RECODE ORASHAGA_RAW ('Europe'=1) ('Asie'=2) ('Amérique'=3) ('Sans avis'=98) INTO ORASHAGA.
RECODE ORASBAGA_RAW ('Europe'=1) ('Asie'=2) ('Amérique'=3) ('Sans avis'=98) INTO ORASBAGA.
RECODE PXHAUTGA_RAW ('< 5 000 FCFA'=1) ('5 000 – 15 000'=2) ('15 000 – 40 000'=3) ('> 40 000 FCFA'=4) INTO PXHAUTGA.
RECODE PXMOYEGA_RAW ('< 5 000 FCFA'=1) ('5 000 – 15 000'=2) ('15 000 – 40 000'=3) ('> 40 000 FCFA'=4) INTO PXMOYEGA.
RECODE PXBASGAM_RAW ('< 5 000 FCFA'=1) ('5 000 – 15 000'=2) ('15 000 – 40 000'=3) ('> 40 000 FCFA'=4) INTO PXBASGAM.
RECODE ECQUHABA_RAW ('Très important'=1) ('Important'=2) ('Modéré'=3) ('Faible'=4) ('Inexistant'=5) INTO ECQUHABA.
RECODE PRIOPRIN_RAW ('Le moins cher'=1) ('Meilleur rapport qualité/prix'=2) ('Meilleure qualité quel que soit le prix'=3) INTO PRIOPRIN.
RECODE SUACMOGA_RAW ('Aucun'=1) ('Jusqu''à +10 %'=2) ('+10–25 %'=3) ('+25–50 %'=4) ('>+50 %'=5) INTO SUACMOGA.
RECODE PRINFREI_RAW ('Prix élevé'=1) ('Doute qualité/contrefaçon'=2) ('Indisponibilité'=3) ('Manque de conseil'=4) ('Absence de garantie'=5) ('Délais de livraison'=6) INTO PRINFREI.
RECODE CRACPRCO_RAW ('Souvent'=1) ('Parfois'=2) ('Rarement'=3) ('Jamais'=4) INTO CRACPRCO.
RECODE DEJDECAC_RAW ('Oui, plusieurs fois'=1) ('Oui, une fois'=2) ('Non'=3) INTO DEJDECAC.
RECODE IMSECSAV_RAW ('Très importante'=1) ('Importante'=2) ('Peu importante'=3) ('Pas importante'=4) INTO IMSECSAV.
RECODE SEATPRIO_RAW ('Garantie/remplacement'=1) ('Conseil technique'=2) ('Réparation/pièces'=3) ('Réactivité du contact'=4) ('Livraison/installation'=5) INTO SEATPRIO.
RECODE DUGAJUAC_RAW ('<6 mois'=1) ('6 mois–1 an'=2) ('1–2 ans'=3) ('>2 ans'=4) INTO DUGAJUAC.
RECODE CACOPREF_RAW ('En personne'=1) ('Téléphone'=2) ('WhatsApp'=3) ('E-mail'=4) ('Réseaux sociaux'=5) INTO CACOPREF.
RECODE BOSAPACH_RAW ('Oui'=1) ('Peut-être'=2) ('Non'=3) INTO BOSAPACH.
RECODE CANAPREF_RAW ('Quincaillerie'=1) ('Grossiste spécialisé'=2) ('Magasin spécialisé'=3) ('Marché'=4) ('Importateur'=5) ('En ligne'=6) INTO CANAPREF.
RECODE CRCHCANA_RAW ('Proximité'=1) ('Prix'=2) ('Largeur du choix'=3) ('Disponibilité'=4) ('Conseil'=5) ('Confiance'=6) INTO CRCHCANA.
RECODE DEJACHLI_RAW ('Oui'=1) ('Non'=2) INTO DEJACHLI.
RECODE PRETACLI_RAW ('Oui'=1) ('Peut-être'=2) ('Non'=3) INTO PRETACLI.
RECODE PRFRACLI_RAW ('Qualité/conformité'=1) ('Ne pas voir le produit'=2) ('Confiance paiement'=3) ('Livraison'=4) ('Absence de SAV'=5) INTO PRFRACLI.
RECODE FIMEFOUR_RAW ('Toujours'=1) ('Souvent'=2) ('Parfois'=3) ('Rarement'=4) ('Jamais'=5) INTO FIMEFOUR.

* ----------------------------------------------------------------------.
* 5. Q9 - PRODUITS ACHETES : REPONSES MULTIPLES.
* ----------------------------------------------------------------------.
COMPUTE PRACCABL=(INDEX(PRACCABL_RAW,'Câbles/fils')>0).
COMPUTE PRACAPPA=(INDEX(PRACAPPA_RAW,'Appareillage/disjoncteurs')>0).
COMPUTE PRACPRIS=(INDEX(PRACPRIS_RAW,'Prises/interrupteurs')>0).
COMPUTE PRACLUMI=(INDEX(PRACLUMI_RAW,'Luminaires')>0).
COMPUTE PRACSOLA=(INDEX(PRACSOLA_RAW,'Solaire/onduleurs')>0).
COMPUTE PRACGROU=(INDEX(PRACGROU_RAW,'Groupes électrogènes')>0).

* ----------------------------------------------------------------------.
* 6. Q41 - FIDELISATION : REPONSES MULTIPLES.
* ----------------------------------------------------------------------.
COMPUTE RFIDPRIX=(INDEX(RFIDPRIX_RAW,'Prix/promotions')>0).
COMPUTE RFIDQUAL=(INDEX(RFIDQUAL_RAW,'Qualité constante')>0).
COMPUTE RFIDSTOC=(INDEX(RFIDSTOC_RAW,'Disponibilité du stock')>0).
COMPUTE RFIDCONS=(INDEX(RFIDCONS_RAW,'Bon conseil')>0).
COMPUTE RFIDSAVF=(INDEX(RFIDSAVF_RAW,'SAV fiable')>0).
COMPUTE RFIDPROG=(INDEX(RFIDPROG_RAW,'Programme de fidélité')>0).
COMPUTE RFIDPAIE=(INDEX(RFIDPAIE_RAW,'Facilités de paiement')>0).

* ----------------------------------------------------------------------.
* 7. ZONE D'ETUDE, MANQUANTS ET CONTROLE QUALITE.
* ----------------------------------------------------------------------.
RECODE VILLEREG INTO CODEZONE.

DO IF (MISSING(CODEZONE)).
 COMPUTE CODEZONE=99.
END IF.

* Pour toutes les questions fermées : blanc = 99.
DO REPEAT v=ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA
 LIEACHPR MONMOYAC PAIEPRIV IMPOMARQ MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA
 MEILPRIX ORINFACH GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA
 PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC
 IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI
 PRETACLI PRFRACLI FIMEFOUR.
 IF MISSING(v) v=99.
END REPEAT.

* Les multi-réponses sont déjà 0/1 ; on ne remplace pas leurs valeurs.

* Anomalies : toute réponse textuelle non vide sur une variable fermée
* qui n'a pas pu être recodée reste détectable par le contrôle ci-dessous.
COMPUTE ANOMALIE=''.
IF (MISSING(VOUSETES) AND RTRIM(VOUSETES_RAW)<>'') ANOMALIE=CONCAT(ANOMALIE,'Q1;').
IF (MISSING(SEXMAFEM) AND RTRIM(SEXMAFEM_RAW)<>'') ANOMALIE=CONCAT(ANOMALIE,'Q2;').
IF (MISSING(AGEREPON) AND RTRIM(AGEREPON_RAW)<>'') ANOMALIE=CONCAT(ANOMALIE,'Q3;').
IF (MISSING(VILLEREG) AND RTRIM(VILLEREG_RAW)<>'') ANOMALIE=CONCAT(ANOMALIE,'Q4;').
IF (MISSING(FREQACHA) AND RTRIM(FREQACHA_RAW)<>'') ANOMALIE=CONCAT(ANOMALIE,'Q6;').
IF (MISSING(FIMEFOUR) AND RTRIM(FIMEFOUR_RAW)<>'') ANOMALIE=CONCAT(ANOMALIE,'Q40;').

COMPUTE STATUTQC='OK'.
IF (LENGTH(RTRIM(ANOMALIE))>0) STATUTQC='A_VERIFIER'.
IF (MISSING(CODEENQU) OR RTRIM(CODEENQU)='') STATUTQC='A_VERIFIER'.

* ----------------------------------------------------------------------.
* 8. LABELS DES VARIABLES.
* ----------------------------------------------------------------------.
VARIABLE LABELS
 NUMFICHE 'N° de fiche généré automatiquement'
 HORODAT 'Horodatage Google Forms'
 CODEENQU 'Identifiant enquêteur'
 QUARTIER 'Quartier / zone'
 SITEENQU 'Site précis / repère'
 NOMENQ 'Nom de l''enquêté ou raison sociale'
 TELENQ 'Téléphone de l''enquêté'
 EMAILENQ 'E-mail de l''enquêté'
 ACCRECON 'Accepte d''être recontacté à des fins commerciales'
 CODEZONE 'Zone d''étude codée'
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
 MAACAUTR_RAW 'Q12. Marque - Autre (réponse brute)'
 PRCRICHO 'Q13. Principal critère de choix'
 ORIGPRIV 'Q14. Origine privilégiée'
 MEQUAFIA 'Q15. Meilleure qualité/fiabilité selon vous'
 MEILPRIX 'Q16. Meilleur prix selon vous'
 ORINFACH 'Q17. L''origine influence votre achat'
 GAACPLSO 'Q18. Gamme achetée le plus souvent'
 DEAVHAGA 'Q19. Définition du haut de gamme'
 CAAVBAGA 'Q20. Caractéristique du bas de gamme'
 ORASHAGA 'Q21. Origine spontanément associée au haut de gamme'
 ORASBAGA 'Q22. Origine spontanément associée au bas de gamme'
 PXHAUTGA 'Q23. Prix associé au haut de gamme'
 PXMOYEGA 'Q23. Prix associé à la moyenne gamme'
 PXBASGAM 'Q23. Prix associé au bas de gamme'
 ECQUHABA 'Q24. Ecart de qualité haut/bas de gamme'
 PRIOPRIN 'Q25. Priorité principale'
 SUACMOGA 'Q26. Surcoût accepté pour monter en gamme'
 PRINFREI 'Q27. Principal frein'
 CRACPRCO 'Q28. Crainte de contrefaçon/non-conformité'
 DEJDECAC 'Q29. Déjà déçu par un achat'
 IMSECSAV 'Q30. Importance du service client/SAV'
 SEATPRIO 'Q31. Service attendu en priorité'
 DUGAJUAC 'Q32. Durée de garantie acceptable'
 CACOPREF 'Q33. Canal de contact préféré'
 BOSAPACH 'Q34. Un bon SAV ferait payer plus cher'
 CANAPREF 'Q35. Canal préféré'
 CRCHCANA 'Q36. Critère de choix du canal'
 DEJACHLI 'Q37. Déjà acheté en ligne'
 PRETACLI 'Q38. Prêt à acheter en ligne'
 PRFRACLI 'Q39. Principal frein à l''achat en ligne'
 FIMEFOUR 'Q40. Fidèle à un même fournisseur'
 RFIDPRIX 'Q41. Prix/promotions - cité'
 RFIDQUAL 'Q41. Qualité constante - cité'
 RFIDSTOC 'Q41. Disponibilité du stock - cité'
 RFIDCONS 'Q41. Bon conseil - cité'
 RFIDSAVF 'Q41. SAV fiable - cité'
 RFIDPROG 'Q41. Programme de fidélité - cité'
 RFIDPAIE 'Q41. Facilités de paiement - cité'
 SUGGATTE 'Q42. Une suggestion / attente'
 ANOMALIE 'Questions contenant une réponse inattendue'
 STATUTQC 'Statut du contrôle qualité'.

* ----------------------------------------------------------------------.
* 9. LABELS DE VALEURS.
* ----------------------------------------------------------------------.
VALUE LABELS CODEZONE 1 'Douala' 2 'Yaoundé' 3 'Bafoussam' 99 'Inconnu'.
VALUE LABELS ACCRECON 1 'Oui' 2 'Non' 99 'Non-réponse'.
VALUE LABELS VOUSETES 1 'Particulier' 2 'Entreprises (PME, Industries…)'
 3 'Électricien/artisan' 4 'Entreprise BTP' 5 'Revendeur/Grossiste/Distributeur' 99 'Non-réponse'.
VALUE LABELS SEXMAFEM 1 'Homme' 2 'Femme' 99 'Non-réponse'.
VALUE LABELS AGEREPON 1 '<25' 2 '25–34' 3 '35–44' 4 '45–54' 5 '55+' 99 'Non-réponse'.
VALUE LABELS VILLEREG 1 'Douala' 2 'Yaoundé' 3 'Bafoussam' 99 'Non-réponse'.
VALUE LABELS REVMENME 1 '<100k' 2 '100k–250k' 3 '250k–500k' 4 '500k–1M' 5 '>1M' 98 'NSP' 99 'Non-réponse'.
VALUE LABELS FREQACHA 1 'Chaque semaine' 2 '1–3×/mois' 3 'Quelques fois/an' 4 'Rarement' 99 'Non-réponse'.
VALUE LABELS LIEACHPR 1 'Quincaillerie' 2 'Grossiste spécialisé' 3 'Magasin spécialisé' 4 'Marché' 5 'Importateur' 6 'En ligne' 99 'Non-réponse'.
VALUE LABELS MONMOYAC 1 '<25k' 2 '25k–100k' 3 '100k–500k' 4 '500k–2M' 5 '>2M' 99 'Non-réponse'.
VALUE LABELS PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE 1 'Cité' 0 'Non cité'.
VALUE LABELS PAIEPRIV 1 'Espèces' 2 'Mobile Money' 3 'Virement' 4 'Crédit fournisseur' 99 'Non-réponse'.
VALUE LABELS IMPOMARQ 1 'Très importante' 2 'Importante' 3 'Peu importante' 4 'Pas importante' 99 'Non-réponse'.
VALUE LABELS MAACPLSO 1 'Schneider' 2 'Legrand' 3 'Vectron' 4 'Hager' 5 'ABB' 6 'Siemens' 7 'Chint/chinoise' 8 'Philips' 9 'JA Solar' 10 'Longi' 11 'Growatt' 12 'Autre' 99 'Non-réponse'.
VALUE LABELS PRCRICHO 1 'Prix' 2 'Qualité/durabilité' 3 'Disponibilité' 4 'Notoriété' 5 'Garantie/SAV' 6 'Conformité normes' 99 'Non-réponse'.
VALUE LABELS ORIGPRIV 1 'Europe' 2 'Asie' 3 'Amérique' 4 'Aucune préférence' 99 'Non-réponse'.
VALUE LABELS MEQUAFIA MEILPRIX ORASHAGA ORASBAGA 1 'Europe' 2 'Asie' 3 'Amérique' 98 'Sans avis' 99 'Non-réponse'.
VALUE LABELS ORINFACH 1 'Fortement' 2 'Modérément' 3 'Faiblement' 4 'Pas du tout' 99 'Non-réponse'.
VALUE LABELS GAACPLSO 1 'Haut de gamme' 2 'Moyenne gamme' 3 'Bas de gamme' 4 'Selon le projet' 99 'Non-réponse'.
VALUE LABELS DEAVHAGA 1 'Un prix élevé' 2 'Une marque reconnue' 3 'La durabilité / fiabilité' 4 'L''origine' 5 'Certifications / conformité aux normes' 6 'Une garantie longue' 99 'Non-réponse'.
VALUE LABELS CAAVBAGA 1 'Un prix bas' 2 'Une origine asiatique générique' 3 'Absence de marque connue' 4 'Durée de vie courte' 5 'Absence de garantie' 6 'Risque de non-conformité' 99 'Non-réponse'.
VALUE LABELS PXHAUTGA PXMOYEGA PXBASGAM 1 '< 5 000 FCFA' 2 '5 000 – 15 000' 3 '15 000 – 40 000' 4 '> 40 000 FCFA' 99 'Non-réponse'.
VALUE LABELS ECQUHABA 1 'Très important' 2 'Important' 3 'Modéré' 4 'Faible' 5 'Inexistant' 99 'Non-réponse'.
VALUE LABELS PRIOPRIN 1 'Le moins cher' 2 'Meilleur rapport qualité/prix' 3 'Meilleure qualité quel que soit le prix' 99 'Non-réponse'.
VALUE LABELS SUACMOGA 1 'Aucun' 2 'Jusqu''à +10 %' 3 '+10–25 %' 4 '+25–50 %' 5 '>+50 %' 99 'Non-réponse'.
VALUE LABELS PRINFREI 1 'Prix élevé' 2 'Doute qualité/contrefaçon' 3 'Indisponibilité' 4 'Manque de conseil' 5 'Absence de garantie' 6 'Délais de livraison' 99 'Non-réponse'.
VALUE LABELS CRACPRCO 1 'Souvent' 2 'Parfois' 3 'Rarement' 4 'Jamais' 99 'Non-réponse'.
VALUE LABELS DEJDECAC 1 'Oui, plusieurs fois' 2 'Oui, une fois' 3 'Non' 99 'Non-réponse'.
VALUE LABELS IMSECSAV 1 'Très importante' 2 'Importante' 3 'Peu importante' 4 'Pas importante' 99 'Non-réponse'.
VALUE LABELS SEATPRIO 1 'Garantie/remplacement' 2 'Conseil technique' 3 'Réparation/pièces' 4 'Réactivité du contact' 5 'Livraison/installation' 99 'Non-réponse'.
VALUE LABELS DUGAJUAC 1 '<6 mois' 2 '6 mois–1 an' 3 '1–2 ans' 4 '>2 ans' 99 'Non-réponse'.
VALUE LABELS CACOPREF 1 'En personne' 2 'Téléphone' 3 'WhatsApp' 4 'E-mail' 5 'Réseaux sociaux' 99 'Non-réponse'.
VALUE LABELS BOSAPACH 1 'Oui' 2 'Peut-être' 3 'Non' 99 'Non-réponse'.
VALUE LABELS CANAPREF 1 'Quincaillerie' 2 'Grossiste spécialisé' 3 'Magasin spécialisé' 4 'Marché' 5 'Importateur' 6 'En ligne' 99 'Non-réponse'.
VALUE LABELS CRCHCANA 1 'Proximité' 2 'Prix' 3 'Largeur du choix' 4 'Disponibilité' 5 'Conseil' 6 'Confiance' 99 'Non-réponse'.
VALUE LABELS DEJACHLI 1 'Oui' 2 'Non' 99 'Non-réponse'.
VALUE LABELS PRETACLI 1 'Oui' 2 'Peut-être' 3 'Non' 99 'Non-réponse'.
VALUE LABELS PRFRACLI 1 'Qualité/conformité' 2 'Ne pas voir le produit' 3 'Confiance paiement' 4 'Livraison' 5 'Absence de SAV' 99 'Non-réponse'.
VALUE LABELS FIMEFOUR 1 'Toujours' 2 'Souvent' 3 'Parfois' 4 'Rarement' 5 'Jamais' 99 'Non-réponse'.

* ----------------------------------------------------------------------.
* 10. VALEURS MANQUANTES ET NIVEAUX DE MESURE.
* ----------------------------------------------------------------------.
MISSING VALUES
 CODEZONE ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA
 LIEACHPR MONMOYAC PAIEPRIV IMPOMARQ MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA
 MEILPRIX ORINFACH GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA
 PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC
 IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI
 PRETACLI PRFRACLI FIMEFOUR (99).
MISSING VALUES REVMENME MEQUAFIA MEILPRIX ORASHAGA ORASBAGA (98,99).

VARIABLE LEVEL
 CODEZONE VOUSETES SEXMAFEM VILLEREG PRACCABL PRACAPPA PRACPRIS PRACLUMI
 PRACSOLA PRACGROU PAIEPRIV MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX
 GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PRINFREI SEATPRIO CACOPREF
 CANAPREF CRCHCANA DEJACHLI PRFRACLI RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS
 RFIDSAVF RFIDPROG RFIDPAIE (NOMINAL).
VARIABLE LEVEL
 AGEREPON REVMENME FREQACHA MONMOYAC IMPOMARQ ORINFACH PXHAUTGA PXMOYEGA
 PXBASGAM ECQUHABA PRIOPRIN SUACMOGA CRACPRCO DEJDECAC IMSECSAV DUGAJUAC
 BOSAPACH PRETACLI FIMEFOUR (ORDINAL).

* ----------------------------------------------------------------------.
* 11. CONTROLES AUTOMATIQUES.
* ----------------------------------------------------------------------.
FREQUENCIES VARIABLES=STATUTQC CODEZONE VOUSETES SEXMAFEM VILLEREG
 /ORDER=ANALYSIS.

FREQUENCIES VARIABLES=ACCRECON AGEREPON REVMENME FREQACHA LIEACHPR MONMOYAC
 PAIEPRIV IMPOMARQ MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH
 GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA PXMOYEGA PXBASGAM
 ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC IMSECSAV SEATPRIO
 DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI
 FIMEFOUR.

FREQUENCIES VARIABLES=PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU
 RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE.

EXECUTE.

SAVE OUTFILE=!SAVOUT
 /COMPRESSED.

EXECUTE.

* ======================================================================.
* FIN DU SCRIPT.
* ======================================================================.
