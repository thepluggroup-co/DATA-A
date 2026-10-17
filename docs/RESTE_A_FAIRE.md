# Reste à faire

## Bloquants avant la phase 1
- [x] Arbitrages D-002 à D-005 validés le 17/10/2026.
- [x] Version antérieure du questionnaire : reconstituée depuis l'onglet DICTIONNAIRE du masque du 26/09 (D-014).
- [x] Python 3.12.10 et `uv` 0.13.1 installés le 17/10/2026 (installateur Python à signature vérifiée).
- [ ] Docker : nécessaire à partir de la phase 2 (PostgreSQL).

## Phase 2 — à terminer
- [ ] **Docker** (disque C: : 5,6 Go libres, 15 à 20 Go nécessaires ; WSL 2 à installer) puis synchronisation PostgreSQL : schéma (réponses brutes JSONB immuables, fiches codées, décisions, contacts séparés), insertion idempotente, rattrapage, bilan de santé, journal des erreurs.
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
- [ ] **Plan d'échantillonnage** (`projets/edm_cameroun/plan_echantillonnage.yaml`) : données seulement, sans modèle ni validation (module M2, phase 6). Version 01 (PDF d'organisation) à saisir.
- [ ] **Secteurs, quartiers et points de collecte** du PDF d'organisation : phase 6 (M9). Dschang à confirmer (question de cadrage 6).

## Juridique (décision D-013)
- [ ] Obtenir le texte officiel de la loi n° 2024/017 et vérifier l'article sur les transferts (art. 32 selon des sources secondaires).
- [ ] Identifier l'Autorité de protection, sa procédure et son délai, puis déposer la demande d'autorisation de transfert pour la collecte par Google Forms.
- [ ] Jusqu'à l'autorisation : la collecte de contacts de répondants par Google Forms est un risque ouvert.
- [ ] Désigner le responsable de traitement (client, THE PLUG, ou les deux) et un avocat pour les gabarits contractuels.

## Hébergement (décision D-010)
- [ ] Choisir un hébergeur au Cameroun et vérifier ses SLA. Essai de 30 jours : disponibilité mesurée, restauration de sauvegarde testée, second site pour les sauvegardes.

## Questions de cadrage encore ouvertes (docs/00_CADRAGE.md, §6)
- [ ] Q6 Dschang dans la « Zone 4 » de Bafoussam.
- [ ] Q7 Export des réponses brutes Google Forms avec identifiants (phase 2).
- [ ] Q8 Poste équipé de SPSS 27 (phases 2 et 4).
- [ ] Q10 Pays suivant ; place du quali.
