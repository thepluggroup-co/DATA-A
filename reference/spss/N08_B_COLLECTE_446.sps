* Encoding: UTF-8.
* =========================================================================.
* ÉTUDE DE MARCHÉ - MATÉRIEL ET ÉQUIPEMENTS ÉLECTRIQUES.
* SYNTAXE DE REPRODUCTION - PARTIE COLLECTE (446 fiches).
* Base : SPSS_EDM_EE_V6_COLLECTE_446.sav. Compatible IBM SPSS Statistics 27.
* Reproduit : tableaux 2 et 3, graphiques 1 à 8, contrôle de qualité (19 fiches.
* écartées). Ouvrir la base, puis Exécuter > Tout. Aucun fichier modifié.
* =========================================================================.
SET TVARS=LABELS TNUMBERS=LABELS OVARS=LABELS ONUMBERS=LABELS.
WEIGHT OFF.
FILTER OFF.
USE ALL.

* -------------------------------------------------------------------------.
* Contrôle de la base active : cette syntaxe doit tourner sur la base
* d'analyse (446 fiches). Si le tableau affiche ERREUR, ouvrir
* SPSS_EDM_EE_V6_COLLECTE_446.sav, la mettre au premier plan et relancer.
* -------------------------------------------------------------------------.
COMPUTE CTRL_UN = 1.
AGGREGATE /OUTFILE=* MODE=ADDVARIABLES /BREAK=CTRL_UN /CTRL_N=N.
COMPUTE CTRL_BASE = (CTRL_N = 446).
VARIABLE LABELS CTRL_BASE "Contrôle de la base active".
VALUE LABELS CTRL_BASE 1 "OK : base de collecte, 446 fiches"
  0 "ERREUR : la base active n'a pas 446 fiches, résultats non valides".
TITLE "Contrôle - la base active doit compter 446 fiches".
FREQUENCIES VARIABLES=CTRL_BASE.
DELETE VARIABLES CTRL_UN CTRL_N CTRL_BASE.

TITLE "Tableau 2, graphiques 2, 3, 5, 7 - Profils".
CROSSTABS /TABLES=VOUSETES BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN TOTAL.
TITLE "Graphiques 1, 4, 6, 8 - Familles de cibles".
CROSSTABS /TABLES=CATEG3 BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT COLUMN TOTAL.

TITLE "Tableau 3 - Production par enquêteur et par jour de terrain".
CROSSTABS /TABLES=CODEENQU BY JOURTERR /FORMAT=AVALUE TABLES /CELLS=COUNT.
TITLE "Note du tableau 3 - Ville déclarée (Q4) selon l'enquêteur".
CROSSTABS /TABLES=CODEENQU BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT.
FREQUENCIES VARIABLES=DATEENQU /FORMAT=NOTABLE /STATISTICS=MINIMUM MAXIMUM.

TITLE "Contrôle de qualité - 427 fiches retenues, 19 écartées".
FREQUENCIES VARIABLES=FILTRE_QUAL DOUBLON_SUSP.
CROSSTABS /TABLES=FILTRE_QUAL BY VILLEREG /FORMAT=AVALUE TABLES /CELLS=COUNT.
CROSSTABS /TABLES=DOUBLON_SUSP BY FILTRE_QUAL /FORMAT=AVALUE TABLES /CELLS=COUNT.
COMPUTE MOINS70 = (TX_REMPL < 70).
VARIABLE LABELS MOINS70 "Fiche remplie à moins de 70 %".
VALUE LABELS MOINS70 0 "Non" 1 "Oui".
CROSSTABS /TABLES=MOINS70 BY FILTRE_QUAL /FORMAT=AVALUE TABLES /CELLS=COUNT.
* Repères : 11 fiches à moins de 70 % ; 8 copies probables (DOUBLON_SUSP = 2).
DELETE VARIABLES MOINS70.
TITLE "Fin".
