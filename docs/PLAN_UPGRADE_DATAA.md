# DATA’A — plan d’industrialisation

Ce plan transforme DATA’A en plateforme d’études augmentées. Chaque lot doit être livré avec une démonstration, des tests et une trace d’audit.

## Lot 1 — socle métier et gouvernance (en cours)

- [x] Rôles cabinet, consultant junior, consultant senior, expert étude et enquêteur.
- [x] Permissions métier renvoyées par l’API.
- [x] Workflow junior → senior → expert → livraison.
- [x] Paramétrage centralisé et thèmes clair/nuit.
- [ ] Remplacer les routes historiques `/api/usine` par `/api/cabinet` avec compatibilité temporaire.
- [ ] Ajouter une table de versions du questionnaire, du dictionnaire, du plan terrain et du plan d’analyse.
- [ ] Ajouter le registre des validations et des commentaires par étape.

## Lot 2 — collecte mobile et qualité

- [ ] Application enquêteur hors ligne avec file locale chiffrée.
- [ ] Synchronisation rejouable après coupure réseau.
- [ ] Score de qualité par fiche et par enquêteur.
- [ ] Contrôles de durée, position, appareil, doublon et séquence.
- [ ] Tableau de bord consultant junior en temps réel.

## Lot 3 — atelier d’étude

- [ ] Constructeur de questionnaire depuis le dictionnaire.
- [ ] Calculateur d’échantillon et quotas par ville, quartier et cible.
- [ ] Affectation des équipes et formation certifiante.
- [ ] Tableau de bord consultant senior.
- [ ] Tableau de bord expert étude.

## Lot 4 — analyse augmentée

- [ ] Catalogue des procédures validées avec référence et test oracle.
- [ ] Programmation d’analyses par l’expert.
- [ ] Résultats avec base, filtre, pondération, méthode et avertissements.
- [ ] Comparaison automatique avec SPSS/R sur les jeux de référence.
- [ ] Synthèse exécutive et recommandations liées aux preuves.

## Lot 5 — copilote IA gouverné

- [ ] Assistant de cadrage du brief.
- [ ] Détection des biais et incohérences du questionnaire.
- [ ] Proposition d’analyses et contrôles.
- [ ] Explication en langage naturel avec citations vers les résultats.
- [ ] Blocage de toute conclusion sans base et méthode traçables.
- [ ] Journal des prompts, sources, validations et corrections humaines.

## Lot 6 — connecteurs et production

- [ ] Google Forms/Sheets en production avec reprise et idempotence.
- [ ] E-mails transactionnels.
- [ ] WhatsApp Business pour les alertes terrain.
- [ ] Paiements Mobile Money.
- [ ] Sauvegardes, restauration testée, RLS PostgreSQL et chiffrement des contacts.

## Critères de sortie

Un lot est considéré terminé lorsque son parcours est démontrable dans l’interface, protégé par les permissions, couvert par des tests et visible dans le journal d’audit. Les chiffres d’analyse doivent être reproductibles et chaque recommandation doit pointer vers ses preuves.
