# Phase 3 — Suivi de terrain et contrôle qualité (M10, M11, M12)

**État au 18/10/2026 : terminée, en attente de validation du fondateur.** 143 tests verts (avertissements traités comme des erreurs), `ruff` et `mypy --strict` sans erreur.

## Résultats (critère d'acceptation)
| Critère | Résultat | Test |
|---|---|---|
| Tableaux égaux à ceux de l'étude | ✔ TABLEAU_DE_BORD (11 enquêteurs × J1–J4, aujourd'hui, cumul, % réalisé, délais courts, à vérifier, statut, rang ; zones), SUIVI_CIBLES (quotas cible × ville, cibles par jour, enquêteur × cible), RECAP_JOURS, TRI_A_PLAT (toutes les variables, ligne TOTAL = base) : **égaux aux valeurs calculées par V11** au 09/10. Un seul écart, VOLONTAIRE : V11 comptait la note de bas d'onglet ENQUETEURS comme un 12e enquêteur (objectif 300 au lieu de 275) | `test_tableaux_etude.py` |
| Rapports journaliers égaux | ✔ RAPPORT_J1 à J4 et le rapport PROVISOIRE du 09/10 à 7 h 06 : synthèse, recommandations, villes, classement et score des enquêteurs, cibles **égaux** ; en plus, identité avec `calculerRapport_` de V11 (exécuté sous Node) sur 5 bases synthétiques et 4 jours réels | `test_rapports_etude.py`, `test_rapport_oracle.py` |
| Rapport de statut égal | ✔ état des lieux du jour 3 (07/10, 12 h 26) : vue d'ensemble, présents, sortis, remplaçants, villes **égaux** ; export Word | `test_statut_etude.py` |
| Effet enquêteur de Douala détecté | ✔ ENQ1, garantie attendue (Q32) : 43 % « > 2 ans » contre 6 % attendus à profil égal (p corrigé ≈ 10⁻³⁴), **seul signalement de Douala** ; 8 signalements sur 299 tests dans l'étude | `test_effet_enqueteur.py` |

## Constats sur l'étude
- **Q30 (SAV « pas important »)** : l'écart brut ENQ1 / autres (34 % contre 13 %) **disparaît à profil égal** : il tient à la composition des cibles interrogées, pas à l'enquêteur. La lecture de fin d'étude mêlait les deux.
- **ENQ5 (Yaoundé)** est signalé à la fois par l'effet enquêteur et par la détection de copies (phase 2) : deux méthodes indépendantes convergent.
- Les 4 fiches vides du 06/10 étaient un **incident technique** (modification du formulaire) : statut `ANNULEE` (D-024), non imputées aux enquêteurs.

## Ligne de commande
```
plateforme suivi produire TABLEUR.xlsx --dictionnaire … --plan-terrain … --plan-echantillonnage … [--decisions …]
                          [--jour aaaa-mm-jj] [--maintenant aaaa-mm-jjThh:mm] [--graine N] --sortie …
plateforme deploiement liens --modele "<lien pré-rempli>" --enqueteur ENQ1 --ville Douala --plan-terrain … --sortie …
```

## Plan court
1. **Tableaux de suivi** (`suivi/tableaux.py`) : tableau de bord par enquêteur et par jour (J1…Jn, aujourd'hui, cumul, objectif, % réalisé, délais courts, à vérifier, rejetées, statut, rang), récapitulatif par ville, quotas cible × ville en premier plan, récapitulatif par jour, tri à plat avec ligne TOTAL = base.
   Oracle : valeurs calculées par V11 et conservées dans le masque du 09/10 (TABLEAU_DE_BORD, SUIVI_CIBLES, RECAP_JOURS, TRI_A_PLAT).
2. **Rapport journalier** (`suivi/rapport.py`) : transposition de `calculerRapport_` (synthèse, recommandations du lendemain, production par ville, classement et score des enquêteurs avec formule affichée, cibles, tendances avec seuil de base, questions sautées, rythme horaire ; provisoire au prorata de la journée, définitif ensuite).
   Oracles : `calculerRapport_` de V11 exécuté sous Node sur la même base ; valeurs des onglets RAPPORT_J1 à J4 produits pendant l'étude.
3. **Rapport de statut des enquêteurs** (`suivi/statut.py`) : postes, titulaires présents (objectif atteint / non atteint, reste à remplir), sortis (jour, motif), remplaçants, situation par ville ; à une heure donnée ; export Word.
   Oracle : chiffres de l'état des lieux du jour 3 (07/10, 12 h 26). Les noms des personnes restent hors du dépôt : le test ne porte que sur les chiffres.
4. **Effet enquêteur** (`qualite/effet_enqueteur.py`) : pour chaque ville, chaque enquêteur et chaque question, écart entre ses réponses et celles attendues À PROFIL ÉGAL (même composition par cible, d'après les autres enquêteurs de la ville), test du khi-deux, correction de Bonferroni, taille d'effet.
   Critère : ENQ1 à Douala signalé sur la garantie (Q32) et l'importance du SAV (Q30), comme dans `EDM_EE_REPRODUCTION_RAPPORT_427.sps` (65,0 % contre 10,8 % ; 34,0 % contre 13,1 %).
5. **Contrôle qualité** : rappels téléphoniques de contrôle tirés au sort (reproductibles), priorité aux délais courts et aux copies probables ; file des fiches `A_VERIFIER`.
6. **Déploiement (M10)** : liens personnels pré-remplis (identifiant + ville, par langue) générés depuis UN lien pré-rempli modèle copié dans Google Forms (« Obtenir le lien prérempli »), QR code. Oracle : les liens de l'onglet ENQUETEURS.
7. Ligne de commande `plateforme suivi …` ; exports Excel et Word.

Hors phase 3 : la console web (espaces client et usine) arrive en phase 7 ; la phase 3 livre le moteur, les exports et la ligne de commande.

## Critère d'acceptation
Tableaux, rapports journaliers et rapport de statut égaux à ceux produits pendant l'étude ; effet enquêteur de Douala détecté automatiquement.
