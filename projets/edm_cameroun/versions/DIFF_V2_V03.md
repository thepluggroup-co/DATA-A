# Différences EDM_EQUIPEMENTS_ELECTRIQUES_CAMEROUN : version 02 → 03

48 écart(s), dont 14 imposant une migration des données déjà collectées.

## Écarts imposant une migration

| Question | Écart | Détail |
|---|---|---|
| VOUSETES | modalité recodée | « Électricien/artisan » : 2 → 3 |
| VOUSETES | modalité recodée | « Entreprise BTP » : 3 → 4 |
| VOUSETES | modalité recodée | « Revendeur/grossiste » devient « Revendeur/Grossiste/Distributeur », ancien libellé conservé en alias ; code 4 → 5 |
| VOUSETES | « Autre » supprimé | code 5, variable VOUSAUTR |
| VOUSETES | variable supprimée | VOUSAUTR |
| MAACPLSO | modalité recodée | « Hager » : 3 → 4 |
| MAACPLSO | modalité recodée | « ABB » : 4 → 5 |
| MAACPLSO | modalité recodée | « Siemens » : 5 → 6 |
| MAACPLSO | modalité recodée | « Chint/chinoise » : 6 → 7 |
| MAACPLSO | modalité recodée | « Philips » : 7 → 8 |
| MAACPLSO | modalité recodée | « JA Solar » : 8 → 9 |
| MAACPLSO | modalité recodée | « Longi » : 9 → 10 |
| MAACPLSO | modalité recodée | « Growatt » : 10 → 11 |
| MAACPLSO | « Autre » recodé | 11 → 12 |

## Autres écarts

| Question | Écart | Détail |
|---|---|---|
| * | langue ajoutée | en |
| VOUSETES | modalité ajoutée | « Entreprises (PME, Industries…) » (2) |
| MAACPLSO | modalité ajoutée | « Vectron » (3) |
| DEAVHAGA | question ajoutée | Q19. Pour vous, ce qui définit AVANT TOUT un produit HAUT DE GAMME |
| CAAVBAGA | question ajoutée | Q20. Pour vous, ce qui caractérise AVANT TOUT un produit BAS DE GAMME |
| ORASHAGA | question ajoutée | Q21. À quelle origine associez-vous spontanément le HAUT DE GAMME ? |
| ORASBAGA | question ajoutée | Q22. À quelle origine associez-vous spontanément le BAS DE GAMME ? |
| FOPRGAMM | question ajoutée | Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme ? |
| FOPRGAMM | variable ajoutée | PXHAUTGA |
| FOPRGAMM | variable ajoutée | PXMOYEGA |
| FOPRGAMM | variable ajoutée | PXBASGAM |
| ECQUHABA | question ajoutée | Q24. Selon vous, l'écart de qualité entre le haut et le bas de gamme est |
| PRIOPRIN | question renumérotée | Q19 → Q25 |
| SUACMOGA | question renumérotée | Q20 → Q26 |
| PRINFREI | question renumérotée | Q21 → Q27 |
| CRACPRCO | question renumérotée | Q22 → Q28 |
| DEJDECAC | question renumérotée | Q23 → Q29 |
| IMSECSAV | question renumérotée | Q24 → Q30 |
| SEATPRIO | question renumérotée | Q25 → Q31 |
| DUGAJUAC | question renumérotée | Q26 → Q32 |
| CACOPREF | question renumérotée | Q27 → Q33 |
| BOSAPACH | question renumérotée | Q28 → Q34 |
| CANAPREF | question renumérotée | Q29 → Q35 |
| CRCHCANA | question renumérotée | Q30 → Q36 |
| DEJACHLI | question renumérotée | Q31 → Q37 |
| PRETACLI | question renumérotée | Q32 → Q38 |
| PRFRACLI | question renumérotée | Q33 → Q39 |
| FIMEFOUR | question renumérotée | Q34 → Q40 |
| RENFFIDE | question renumérotée | Q35 → Q41 |
| SUGGATTE | question renumérotée | Q36 → Q42 |
| INCOHERENCE_Q35_Q38 | règle ajoutée | CANAPREF == 6 and PRETACLI == 3 |
| INCOHERENCE_Q7_Q37 | règle ajoutée | LIEACHPR == 6 and DEJACHLI == 2 |
| INCOHERENCE_Q23 | règle ajoutée | PXHAUTGA < PXBASGAM |
| INCOHERENCE_Q25_Q26 | règle ajoutée | PRIOPRIN == 3 and SUACMOGA == 1 |
