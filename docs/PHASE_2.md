# Phase 2 — Codification, synchronisation, export

**État au 18/10/2026 : terminée et VALIDÉE par le fondateur (D-023)** (seule réserve : ouverture du .sav dans SPSS 27, aucun poste équipé ici).
115 tests verts, dont 7 d'intégration sur un vrai PostgreSQL 16 et 7 sur les données réelles (locales), avertissements traités comme des erreurs ; `ruff` et `mypy --strict` sans erreur.

## Critère d'acceptation
| Critère | Résultat | Test |
|---|---|---|
| Réponses réelles rejouées : mêmes N° de fiche, codes et anomalies que V11 | ✔ **446 fiches identiques à V11 sur les 67 variables** (N° de fiche, codes, anomalies, statuts, délais), rejouées depuis les 451 réponses brutes | `test_rejeu_reel.py` |
| Codification identique à V11 dans tous les cas, y compris rares | ✔ 600 fiches aléatoires (graine fixe) identiques à `construireLigne_` de V11, 67 valeurs + ligne de contact ; les 12 types d'anomalies déclenchés | `test_codification_oracle.py` |
| 446 collectées / 427 retenues retrouvées | ✔ **les 427 mêmes fiches** que `FILTRE_QUAL` du .sav livré ; taux de remplissage identique pour les 446 ; 8 copies probables identiques | `test_rejeu_reel.py` |
| `.sav` ouvert dans SPSS 27 avec étiquettes | ◐ `.sav` écrit, **relu et vérifié automatiquement** (étiquettes, valeurs manquantes, mesures, formats, données) ; identique au .sav livré sur 59 des 60 variables communes, la 60e (`MAACAUTR`) étant **tronquée à 8 caractères dans le livrable** et complète chez nous. **Ouverture dans SPSS 27 non faite** (aucun poste équipé ici). | `test_exports.py` |
| Synchronisation idempotente (réception, base, bilan de santé) | ✔ sur PostgreSQL 16 : 50 fiches avec coupure en plein envoi puis relance → 50, aucun doublon ; 4 envois simultanés → aucun doublon ; renvoi modifié refusé et journalisé ; réponses et N° immuables (déclencheurs) ; N° jamais réattribués ; **les 451 réponses réelles passées par la base → 446 valides identiques à V11, 427 retenues, bilan sain** | `test_synchro_bd.py` |

## Ce qui marche (et est testé)
- **Réponse brute → fiche codifiée** (`codification/`) : structuration FR/EN (la version répondue l'emporte), codes (référence, autres langues, alias), « Autre », choix multiples, grilles (lignes repérées par libellé), règles de cohérence du dictionnaire, `FICHE_VIDE` / `Q1_VIDE`, N° de fiche figé, variables administratives, délai entre fiches (arrondi `Math.round` de JavaScript), `TEL_DOUBLON` (indicatif retiré), `ENQUETEUR_INCONNU`, `ZONE_ENQ_NON_PARAMETREE`, `VILLE_DIFFERENTE_ZONE`, statut QC, ligne CONTACT séparée.
- **Recodage rejouable** : dédoublonnage par identifiant, ordre chronologique, numéros réservés, décisions `OK` / `REJETE` / `EXCLUE` qui survivent au recodage (D-018).
- **Base d'analyse** : taux de remplissage, quasi-doublons par groupes, note de base (« 450 fiches reçues, dont 4 rejetées, soit 446 valides ; 19 écartées de l'analyse (remplissage < 70 % : 11 ; copies probables : 8) ; 427 retenues ») (D-019).
- **Exports** : `.sav` vérifié + syntaxe des ensembles multiples ; CSV ; masque `.xlsx` ; CONTACTS séparé ; noms de fichiers à double extension refusés (D-020).
- **Lecture d'un tableur de réponses Google** : en-tête hors première ligne, grilles « [Ligne] 2 », cases jointes par virgule, téléphones stockés en nombre, identifiant stable au tri.
- **Ligne de commande** : `plateforme base coder TABLEUR.xlsx --dictionnaire … --plan-terrain … [--decisions …] --sortie …`.

## Constats sur l'étude réelle (trouvés en rejouant)
- L'onglet « Form Responses 1 » avait été **trié** (une réponse au-dessus de l'en-tête), ce que V11 interdisait.
- Une **fiche de test du 03/10** est restée dans le tableur après sa suppression du formulaire.
- Les **4 fiches vides du 06/10** avaient consommé un N° (trou : YDE-ENQ6-021, DLA-ENQ3-015, DLA-ENQ2-017, BAF-ENQ7-006).
- La liste manuelle « ressemblance forte » de SPSS a **omis deux fiches** (YDE-ENQ5-041 et 042) placées comme d'autres fiches signalées ; sans effet sur la base de 427.
- Le `.sav` livré au client a **`MAACAUTR` tronqué à 8 caractères** (60 fiches ; marque la plus longue : 44 octets).

## Synchronisation (stockage/)
- Schéma et migration Alembic `0001` : organisation, projet, `reponse_brute` (JSONB, immuable), `numero_fiche` (registre figé), `fiche_codee` (recalculable), `decision_qc` (historique), `contact` (séparé), `journal_sync` ; `organisation_id` partout.
- `synchro.recevoir` / `coder` / `decider` / `bilan` (D-022). Un test vérifie que la migration correspond exactement aux modèles (il a d'ailleurs trouvé un index manquant).
- Tests : `PLATEFORME_PG_BIN` ou `~/.local/outils/pgsql/bin` (binaires portables, D-021) ; serveur jetable créé et arrêté par les tests.

## Ce qui reste (voir `docs/RESTE_A_FAIRE.md`)
- Ouverture du `.sav` dans SPSS 27 sur un poste équipé.
- Les décisions de l'étude sont reconstituées dans `reference/prive/decisions_qc_edm.yaml` (hors Git).

## Données réelles utilisées (hors Git)
`reference/prive/donnees/EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL__7_.xlsx` (onglets lus : Form Responses 1, MASQUE_DEPOUILLEMENT, FICHES_SUPPRIMEES, ENQUETEURS colonnes A et C) et `reference/prive/sav/SPSS_EDM_EE_V6_COLLECTE_446.sav`, `SPSS_EDM_EE_V6_ANALYSE_427.sav` (colonnes lues : NUMFICHE, TX_REMPL, DOUBLON_SUSP, FILTRE_QUAL, variables du masque).
