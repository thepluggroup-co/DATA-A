* Encoding: UTF-8.
* ======================================================================.
* EDM ELECTRIQUE CAMEROUN - ROLES DES VARIABLES, VERSION ORIENTEE CAHIER DES CHARGES.
* Logique : etude descriptive et comparative (CDC 02) - facteurs de comparaison et profils = Input ;
* variables mesurees pour l'objectif general et les objectifs 2 a 5 = Target ; technique = None.
* Roles : Input = 6 | Target = 49 | None = 12 | Both = 0 | Partition = 0 | Split = 0.
* Le role n'agit que sur les boites de dialogue qui gerent les roles (aucun effet sur la syntaxe).
* ======================================================================.

VARIABLE ROLE
  /INPUT
    CODEZONE VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME
  /TARGET
    FREQACHA LIEACHPR MONMOYAC PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU PAIEPRIV
    IMPOMARQ MAACPLSO PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH GAACPLSO DEAVHAGA CAAVBAGA
    ORASHAGA ORASBAGA PXHAUTGA PXMOYEGA PXBASGAM ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO
    DEJDECAC IMSECSAV SEATPRIO DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI
    PRFRACLI FIMEFOUR RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE
  /NONE
    NUMFICHE CODEENQU QUARTIER SITEENQU DATEENQU HEUREENQ DELAIPRE ACCRECON MAACAUTR SUGGATTE
    ANOMALIE STATUTQC.

* Controle : Vue des variables > colonne Role (attendu : 6 Input, 49 Target, 12 None).
EXECUTE.

