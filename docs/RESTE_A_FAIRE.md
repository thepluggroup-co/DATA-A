# Reste à faire

## Bloquants avant la phase 1
- [x] Arbitrages D-002 à D-005 validés le 17/10/2026.
- [x] Version antérieure du questionnaire : reconstituée depuis l'onglet DICTIONNAIRE du masque du 26/09 (D-014).
- [x] Python 3.12.10 et `uv` 0.13.1 installés le 17/10/2026 (installateur Python à signature vérifiée).
- [ ] Docker : nécessaire à partir de la phase 2 (PostgreSQL).

## Phase 4 — limites connues
- [ ] Ouvrir `BASE_COLLECTE.sav` et `BASE_ANALYSE_DERIVEES.sav` dans SPSS 27, et y exécuter les syntaxes `.sps` générées (poste équipé : question Q8).
- [x] Régression linéaire, ANOVA à un facteur et test t de Student (variances égales) : validés le 18/10/2026 sur les valeurs certifiées du NIST (D-033).
- [ ] Procédures M14 **sans test de référence**, donc non déclarées disponibles : tests de colonnes A/B/C avec Bonferroni, correction de Welch et test de Levene, post hoc de l'ANOVA, Wilcoxon, Pearson, régression pondérée et diagnostics (VIF, résidus), ACP et analyse factorielle, ACM, alpha de Cronbach, k-moyennes et CAH avec profilage, calage sur marges avec base effective et test de sensibilité. Il faut pour chacune une référence publiée ou calculée avec R ou SPSS.
- [ ] Médiane pondérée (SPSS MEANS) : règle de SPSS à établir sur un cas de référence avant de la fournir.
- [ ] Typologie remplaçant SEG_TS (TwoStep SPSS, non reproductible) : k-moyennes ou CAH documentées, à valider avec le fondateur.
- [x] Tableaux de résultats déclarés dans le plan d'analyse (section `tableaux`) et commande `plateforme analyse resultats` (classeur Excel + syntaxe SPSS sans chemin, base active contrôlée) : faits le 18/10/2026.
- [x] Console web (frontend) : application React + TypeScript (phase 7), parcours client et usine testés de bout en bout (Playwright). Reste : alignement sur la maquette Claude Design quand elle sera déposée.
- [ ] Codification des questions ouvertes (IA propose, analyste valide) et volet quali de M14 : arrivent avec le module IA.
- [ ] Q41 (leviers de fidélité) : le dictionnaire la déclare en choix multiple, mais chaque fiche n'a qu'un levier coché (R41:31-34, 429 sur 429). Le plan d'analyse la traite donc en réponse unique (LEVFIDEL). À vérifier dans le formulaire (cases à cocher ou bouton radio ?) avant une prochaine vague.

## Phase 3 — limites connues
- [ ] **Automatisation horaire** (rapport provisoire chaque heure, définitif le soir, rattrapage toutes les 10 min) : nécessite la file de tâches (Procrastinate, D-006) et le déploiement ; aujourd'hui, `plateforme suivi produire` est lancé à la demande.
- [ ] **Console web** du superviseur (tableau de bord temps réel, file `A_VERIFIER`, saisie des décisions et des résultats de rappels, notifications) : phase 7 (espaces client et usine).
- [ ] Les recommandations du rapport reprennent le vocabulaire de V11 (« onglet PARAMETRES », « MASQUE_DEPOUILLEMENT », « actualiser() ») pour l'égalité avec l'étude : à adapter aux écrans de la console (phase 7).
- [ ] Noms des enquêteurs et motifs de départ : le vivier (M6, `terrain/vivier.py`) existe ; reste à brancher un registre privé réel (hors dépôt) sur l'export Word du statut (`noms=`).
- [x] Plan d'échantillonnage : modèle validé (`echantillonnage/plan.py`, phase 6) ; les deux chargeurs passent par lui. Reste : paramètres qualité en double avec le plan de terrain, à unifier.

## Phase 2 — à terminer
- [x] Synchronisation PostgreSQL (schéma, insertion idempotente, bilan, journal) : faite et testée sur PostgreSQL 16 portable (D-021, D-022).
- [ ] **Docker** pour le déploiement (disque C: : 5,4 Go libres, 15 à 20 Go nécessaires ; WSL 2 à installer).
- [ ] **Contacts chiffrés** au repos et politiques **RLS** multi-locataires : phase 7 (sécurité), tables déjà séparées et `organisation_id` déjà présent.
- [ ] Rattrapage périodique automatique (équivalent du « filet de sécurité » de V11, toutes les 10 min) : branché en phase 3 avec l'adaptateur Google Forms (lecture des réponses par l'API).
- [ ] Ouvrir `BASE_ANALYSE.sav` dans SPSS 27 sur un poste équipé (critère « .sav ouvert dans SPSS 27 »).
- [ ] Export final du classeur de réponses (après le 09/10) si des fiches ont été reçues après cette date.
- [ ] Types `numerique` et `date` : codage implémenté, sans étude de référence pour le valider.

## Phase 1 — limites connues
- [ ] **Google Forms, navigation de fin de page** : `pageBreakItem` n'a aucun champ dans l'API REST v1 (référence officielle consultée le 17/10/2026). La règle « fin de la page FR → envoi » du formulaire bilingue doit être posée par Apps Script (`PageBreakItem.setGoToPage`). Le générateur la liste dans `google_forms_actions_apps_script.txt`.
- [ ] **Google Forms, format de `itemId`** : la documentation dit seulement qu'il peut être fourni à la création et doit être inutilisé dans le formulaire. Le générateur produit 8 caractères hexadécimaux : à confirmer au premier envoi réel (phase 3).
- [ ] **Google Forms, validations de réponse** (téléphone, e-mail) : support par l'API REST non vérifié ; listées comme actions Apps Script.
- [ ] **Google Forms, envoi réel et liens personnels pré-remplis** : phase 3 (M10). L'équivalent REST de `toPrefilledUrl()` n'a pas été trouvé.
- [ ] **Limites SPSS** (256 octets pour une étiquette de variable, 120 pour une étiquette de valeur, 64 pour un nom) : valeurs de la documentation IBM, à revérifier sur SPSS 27.
- [ ] **Types de question** `gps` et `photo` : non modélisés (collecte native, phase 8). `numerique` et `date` sont modélisés mais aucune étude de référence ne les utilise.
- [ ] **Import PDF** : extraction heuristique, testée sur le seul questionnaire 03. Brouillon à revoir par un humain.
- [ ] **Règles de cohérence V2** : le livre de codes V2 ne les contient pas ; elles apparaissent comme « ajoutées » dans le rapport V2 → V11.
- [ ] **Plan d'échantillonnage EDM** : modèle et validation faits (phase 6) ; version 01 (PDF d'organisation, 600 fiches, 5 cibles) encore à saisir pour le versionnage.
- [x] **Quartiers et points de collecte** du PDF d'organisation saisis dans le référentiel (`reference/geo/CMR/localites.yaml`, D-048) ; Dschang = commune de la Menoua (HDX). Reste : zones EDM à reporter dans `projets/edm_cameroun/plan_terrain.yaml` ; Balenveng à confirmer.

## Juridique (décision D-013)
- [ ] Obtenir le texte officiel de la loi n° 2024/017 et vérifier l'article sur les transferts (art. 32 selon des sources secondaires).
- [ ] Identifier l'Autorité de protection, sa procédure et son délai, puis déposer la demande d'autorisation de transfert pour la collecte par Google Forms.
- [ ] Jusqu'à l'autorisation : la collecte de contacts de répondants par Google Forms est un risque ouvert.
- [ ] Désigner le responsable de traitement (client, THE PLUG, ou les deux) et un avocat pour les gabarits contractuels.

## Hébergement (décision D-010)
- [ ] Choisir un hébergeur au Cameroun et vérifier ses SLA. Essai de 30 jours : disponibilité mesurée, restauration de sauvegarde testée, second site pour les sauvegardes.

## Questions de cadrage encore ouvertes (docs/00_CADRAGE.md, §6)
- [x] Q6 Dschang dans la « Zone 4 » de Bafoussam : commune distincte (arrondissement de Dschang, Menoua, source HDX COD-AB), rattachée à la zone 4 par l'organisation EDM (D-048).
- [ ] Q7 Export des réponses brutes Google Forms avec identifiants (phase 2).
- [ ] Q8 Poste équipé de SPSS 27 (phases 2 et 4).
- [ ] Q10 Pays suivant ; place du quali.
