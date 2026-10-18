# Console « usine » — API et interface web

**État au 18/10/2026 :** première version branchée sur le moteur des phases 1 à 3 (D-029, D-030). 125 tests verts côté moteur et API (avertissements traités comme des erreurs), `ruff` et `mypy --strict` sans erreur, TypeScript strict sans erreur.

## Lancer
```
cd frontend && npm ci && npm run build      # une fois, ou après chaque modification de l'interface
cd backend && uv run plateforme serveur     # http://127.0.0.1:8000
```
Développement de l'interface : `uv run plateforme serveur --recharger` et `npm run dev` dans `frontend/` (http://127.0.0.1:5173, l'API est relayée).

## Écrans et code appelé
| Écran | Route API | Moteur |
|---|---|---|
| Projets | `GET /api/projets`, `/api/projets/{id}` | lecture des 3 sources de vérité |
| Questionnaire | `…/dictionnaire`, `…/dictionnaire/diagnostic`, `…/dictionnaire/versions`, `…/dictionnaire/diff`, `…/dictionnaire/generations.zip` | `dictionnaire.*`, `generateurs.*` |
| Organisation | `…/terrain`, `POST …/deploiement/liens` | `terrain.plan`, `deploiement.liens` |
| Suivi temps réel | `POST …/suivi`, `POST …/suivi/livrables.zip` | `suivi.tableaux`, `suivi.rapport`, `suivi.statut`, `suivi.livrables` |
| Contrôle qualité | (résultat de `…/suivi`) | `codification.qualite`, `controle.effet_enqueteur`, `controle.rappels` |
| Base et analyse | `POST …/base.zip` | `exports.sav`, `exports.tableaux` |
| Finances | — | à construire (M13, phase 6) |

Le classeur de réponses (export `.xlsx` de Google Sheets) est envoyé à chaque calcul ; il n'est pas conservé sur le serveur.

## Données personnelles
- JSON : aucun nom, téléphone, e-mail ni quartier saisi de répondant (test `test_suivi_complet_sans_donnee_personnelle`).
- Archives : `RAPPELS_*.xlsx` (téléphones) et `CONTACTS/` (contacts) — usage interne de l'usine, signalés à l'écran.

## Tests
`backend/tests/test_api.py` utilise un classeur **fictif** (`tests/tableur_fictif.py`, valeurs tirées au hasard) : ses chiffres ne décrivent pas l'étude réelle.
