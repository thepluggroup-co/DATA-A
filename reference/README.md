# Sources de référence (gabarits)

Règle (décision D-011) : tous ces fichiers servent de **gabarits**. Ceux qui ne contiennent aucune donnée personnelle sont versionnés. Ceux qui en contiennent restent sur le poste, dans `prive/` (exclu de Git), car le dépôt est poussé sur GitHub.

Contrôle effectué le 17/10/2026 : recherche automatique de numéros camerounais (`6XXXXXXXX`, avec ou sans `237`) et d'adresses e-mail, sans afficher les valeurs.

## Versionnés
| Dossier | Contenu | Contrôle |
|---|---|---|
| `scripts_gs/` | `EDM_ELECTRIQUE_TEMPS_REEL_V3` (4 variantes), `V4`, `V5`, `V6`, `V8`, `V10`, **`V11` (référence)**, `GENERATEUR_SPSS27_EDM.gs` | Aucune donnée personnelle (2 faux positifs : constantes mathématiques dans V3) |
| `spss/` | 27 syntaxes : `EDM_SPSS_0/1/2`, `EDM_EE_*` (dont `SYNTAXE_ANALYSE_GLOBALE_V4`, `RECONFIGURATION_V4_1`, `ANALYSES_N05_FILTREES`, `LIVRAISON_CLIENT_V5`, `REPRODUCTION_COLLECTE_446`, `REPRODUCTION_RAPPORT_427`), `EDM_ELECTRIQUE_CAMEROUN_SPSS27_*`, `N08_*`, `ROLES_SPSS_EDM_CDC`, `SYNTAXE_SPSS_MATERIEL_ELECTRIQUE` | Aucune |
| `parametrage/` | `EDM_ELECTRIQUE_PV_CAMEROUN_PARAMETRAGE_V001.xlsx`, `EDM_EE_DICTIONNAIRE_VARIABLES_V5/V6.xlsx`, `ROLES_SPSS_EDM*.xlsx` | Aucune |

Les doublons de téléchargement identiques (`… (1)`, `… (2)`) n'ont pas été copiés. Les variantes différentes portent un suffixe `__n_`.

## Locaux uniquement (`prive/`, hors Git)
| Dossier | Contenu | Motif |
|---|---|---|
| `prive/donnees/` | Masques `EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL*.xlsx` (7 états successifs), `EDM_EE_LISTE_RECONTACT_OUI.xlsx`, `EDM_EE_TRAITEMENT_DONNEES_SPSS.xlsx`, `EDM_EE_resultats_analyses.xlsx`, `Cible EDM JOURS.xlsx` | Jusqu'à 491 téléphones ou e-mails réels par fichier |
| `prive/sav/` | `SPSS_EDM_EE_V6_COLLECTE_446.sav`, `…_V6_ANALYSE_427.sav`, `…_V5_CLIENT.sav`, `SPSS EDM EE.sav` | Réponses individuelles réelles |
| `prive/documents/` | Badges, maquette de badge, état des enquêteurs, organisation, formation et chronogramme EDM (PDF/XMind) | Noms, photos ou téléphones d'enquêteurs, non vérifiables automatiquement (PDF compressés). Les gabarits anonymisés seront créés dans `reference/gabarits/` quand ils seront lus. |

## Introuvables (demandés au fondateur)
- `QUESTIONNAIRE - LE MARCHE DE LA DISTRIBUTION … .pdf` (**indispensable à la porte de la phase 1**)
- `CREER_FORMULAIRES_MATERIEL_ELECTRIQUE.gs`, `…TEMPS_REEL_V2.gs`, `V7.gs`, `V9.gs`
- `Chronogramme_Etude_de_Marché_B-SOLUTIONS.pdf`, `PROFIL_EDM_SOLINA.pdf`, `CHARTE_ENQUETE_PROJET_PEINTURE.doc`, `badge_enqueteur.png`
