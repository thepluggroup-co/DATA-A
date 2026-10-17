# Phase 1 — Dictionnaire → générations (M4)

**État au 17/10/2026 : terminée et VALIDÉE par le fondateur (D-016).** 83 tests verts, `ruff` et `mypy --strict` sans erreur.

## Critère d'acceptation (adapté, décision D-014) — atteint
| Critère | Résultat | Test |
|---|---|---|
| Les 67 colonnes générées depuis `projets/edm_cameroun/dictionnaire.yaml` sont identiques à `colonnesMasque_()` de V11 (code, libellé, format SPSS, mesure, valeurs, groupe, ordre) | ✔ — comparaison avec V11 exécuté sous Node, aucune valeur recopiée à la main | `test_conformite_v11.py` |
| Import du PDF « 03 » → écarts de libellés seulement avec V11 | ✔ — un seul écart : Q42 « (Facultatif) » placé avant le texte dans le PDF | `test_import_pdf.py` |
| Version V2 (formulaire en ligne du 26/09) → rapport V2 → V11 conforme au journal « CHANGEMENTS V2 -> V3 » de V3 | ✔ — Q1 et Q12 recodées, « Autre » de Q1 supprimé, Q19 à Q24 ajoutées, Q19 à Q36 renumérotées Q25 à Q42, règles ajoutées ; rien d'autre | `test_versions.py` |

## Ce qui marche (et est testé)
- **Modèle du dictionnaire** (`backend/src/plateforme/dictionnaire/modele.py`) : sections, identification, questions (choix unique, multiple, grille, texte, numérique, date), modalités bilingues, alias, « Autre », mesure, obligation, condition d'affichage, rôle « cible », pré-remplissage, codes spéciaux, règles de cohérence. **Refusés** : code qui n'a pas 8 lettres ou en double, variable réservée, code 99 comme modalité, libellés ambigus au codage, question de cible facultative, deux questions de cible, règle ou condition sur une variable inconnue, champ inconnu.
- **Langage d'expressions** des règles et conditions (`expressions.py`) : analysé par liste blanche, sans `eval` ; non évalué si une réponse manque (règle V11).
- **Normalisation des libellés** identique à `cle_` et `numeroQuestion_` de V11 (comparée à V11 sur un échantillon).
- **Générateurs** : colonnes du masque ; syntaxe SPSS sans chemin, avec contrôle du jeu actif et des limites de longueur ; livre de codes et paramétrage au format `PARAMETRAGE_V001` ; gabarit de tri à plat avec ligne TOTAL ; plan de formulaire bilingue et requêtes `batchUpdate` Google Forms.
- **Diagnostic formulaire ↔ dictionnaire**, dont la recherche d'un chemin d'envoi qui contourne Q1 (cas réel du 06/10 reproduit et détecté).
- **Rapport de différences** entre versions, recodages en tête.
- **Imports** : script Apps Script (via l'oracle Node), livre de codes (CSV ou onglet `.xlsx` seul), PDF (brouillon à revoir).
- **Ligne de commande** : `valider`, `generer`, `diff`, `importer-apps-script`, `importer-livre-de-codes`, `importer-pdf`.

## Ce qui n'est pas fait ou pas testé
Voir `docs/RESTE_A_FAIRE.md`, section « Phase 1 — limites connues ». Points principaux :
- rien n'est envoyé à Google : les requêtes sont générées et vérifiées hors ligne ;
- la navigation « fin de la page FR → envoi » exige Apps Script (limite de l'API REST) ;
- la syntaxe `.sps` n'a pas été exécutée dans SPSS 27 (aucun poste disponible ici) ;
- l'import PDF n'est éprouvé que sur le questionnaire 03.

## Défaut trouvé et corrigé pendant la phase
Le diagnostic prenait la version anglaise de Q3 (« Age ») pour un doublon de la française (« Âge ») : même clé normalisée. Il cherche désormais d'abord une égalité exacte du titre. Le test exige maintenant **zéro alerte** sur le formulaire généré.

## Fichiers produits
- `projets/edm_cameroun/dictionnaire.yaml` : version 03, source de vérité (sources de chaque complément citées en tête).
- `projets/edm_cameroun/versions/dictionnaire_v2.yaml` et `DIFF_V2_V03.md` : version antérieure et rapport de différences.
- `reference/questionnaires/EDM_DICTIONNAIRE_V2_2026-09-26.csv` : onglet DICTIONNAIRE du masque du 26/09, seul (aucune donnée personnelle).

## Commandes
```
cd backend
uv sync
uv run pytest
uv run plateforme dictionnaire valider ../projets/edm_cameroun/dictionnaire.yaml
uv run plateforme dictionnaire generer ../projets/edm_cameroun/dictionnaire.yaml --plan-terrain ../projets/edm_cameroun/plan_terrain.yaml --sortie ../sorties/edm_03
uv run plateforme dictionnaire diff ../projets/edm_cameroun/versions/dictionnaire_v2.yaml ../projets/edm_cameroun/dictionnaire.yaml
```
Prérequis : Python 3.12, `uv`, et **Node.js** (oracle V11 des tests de conformité).
