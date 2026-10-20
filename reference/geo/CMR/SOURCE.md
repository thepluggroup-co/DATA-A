# Référentiel géographique — Cameroun (CMR)

## `admin.csv` — unités administratives (niveaux 0 à 3)
- **Jeu de données** : *Cameroon – Subnational Administrative Boundaries* (COD-AB), https://data.humdata.org/dataset/cod-ab-cmr
- **Source** : Institut National de Cartographie (INC) ; publié par OCHA Field Information Services Section (FISS) ;
  consolidé par OCHA avec l'IMWG de Yaoundé (et REACH pour le Sud-Ouest).
- **Licence** : Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO 3.0),
  http://creativecommons.org/licenses/by/3.0/igo/legalcode — vérifiée le 19/10/2026 sur l'API HDX
  (`package_show?id=cod-ab-cmr`, champ `license_id = cc-by-igo`). Attribution obligatoire : « Source : INC, OCHA (HDX) ».
- **Version** : ressource `cmr_admin_boundaries.xlsx`, dernière modification HDX du 26/01/2026 ; période couverte
  2019-01-04 au 2025-10-30 ; codes `v01`.
- **Contenu importé** : feuilles faisant foi `cmr_admin0` à `cmr_admin3` (pas les variantes `_em`) ; nom français
  (`admN_name1`), nom anglais (`admN_name`), P-code et P-code parent.
- **Effectifs** : 1 pays, **10 régions**, **58 départements**, **360 arrondissements** (429 unités).
- **Reproduire** : `plateforme geo importer-hdx cmr_admin_boundaries.xlsx --iso3 CMR --sortie reference/geo/CMR/admin.csv`

Niveaux : 0 pays, 1 région, 2 département, 3 arrondissement. Les quartiers ne sont pas un niveau administratif de cette
source : ils sont saisis dans `localites.yaml`, chacun avec son document d'origine.

## `localites.yaml` — villes, quartiers, points de collecte
Saisis depuis les documents des études (organisation EDM pour commencer, D-048) ; rattachement des villes vérifié dans
la feuille des chefs-lieux de la même source HDX (`cmr_admincapitals`) : Douala → Wouri, Yaoundé → Mfoundi,
Bafoussam → Mifi, Dschang → Menoua (arrondissement de Dschang).
