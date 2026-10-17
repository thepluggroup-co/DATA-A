# PLUG DATA'A — Prompts de phase (partie B)

Lancer les phases une par une. Ne pas lancer une phase tant que les tests de la précédente ne passent pas.

**Phase 1 — Socle et définition d'étude**
> Crée le dépôt (backend, web, collecte, docs), Docker Compose, PostgreSQL, authentification, organisations, rôles. Définis le schéma `StudyDefinition` complet avec validation. Écris `docs/reference/edm_cameroun.json` : la traduction intégrale du script V11 (42 questions, 3 zones, quotas, règles de cohérence, paramètres qualité, FR et EN). Critère de réussite : la définition EDM est validée par le schéma et le nombre de variables codées générées est identique à celui du masque V11.

**Phase 2 — Moteur de codification et contrôle qualité**
> Implémente en fonctions pures le moteur qui transforme une réponse brute en fiche codifiée : codes, « Autre », choix multiples, grilles, numéro de fiche, variables administratives, toutes les anomalies de la partie A.3, statut QC. Critère de réussite : tests unitaires couvrant chaque anomalie et chaque type de question, sur la définition EDM.

**Phase 3 — Application de collecte hors ligne**
> Construis la PWA enquêteur : connexion par code personnel, questionnaire généré depuis la définition (sauts, obligations, langues), enregistrement local, GPS, file d'envoi, synchronisation idempotente, écran « mes fiches du jour » et quotas restants. Critère de réussite : test automatisé — 50 fiches saisies sans réseau, réseau coupé en plein envoi, relance : 50 fiches en base, aucun doublon.

**Phase 4 — Suivi de terrain**
> Construis la console superviseur : tableau de bord temps réel, quotas cible × zone, états par zone, score et classement des enquêteurs, file des fiches à vérifier avec validation ou rejet, bilan de synchronisation, rapport journalier provisoire puis définitif. Critère de réussite : sur un jeu de données EDM de démonstration, les chiffres sont identiques à ceux calculés à la main dans un test.

**Phase 5 — Moteur statistique**
> Implémente les procédures de la partie A.4 dans l'ordre : tris à plat, réponses multiples, tris croisés et tests, pondération, comparaisons de moyennes, corrélations, régressions, analyses factorielles, segmentation. Interface de construction de tableaux. Export `.sav`, Excel, CSV. Critère de réussite : chaque procédure a un test de comparaison à une valeur de référence, avec tolérance explicite.

**Phase 6 — Agents IA et recherche Internet**
> Construis le module d'agents : du brief à la `StudyDefinition` complète (recherche documentaire sourcée, méthodologie, plan de sondage, quotas, questionnaire, règles de cohérence, plan d'analyse), puis commentaires des résultats et codage des questions ouvertes. Modes automatique et avec validation. Critère de réussite : à partir d'un brief de dix lignes, une définition valide par le schéma est produite ; toute donnée de marché porte une source.

**Phase 7 — Générateur de documents**
> Construis les modèles et l'export Word, PDF, PowerPoint, Excel de tous les documents de la partie A.4, avec charte graphique paramétrable par organisation, choix du format et de la langue à l'export. Critère de réussite : le kit terrain complet et le rapport final de l'étude EDM sont générés sans retouche manuelle, et chaque chiffre du rapport est tracé vers un tableau du moteur statistique.

**Phase 8 — Qualitatif, durcissement, mise en production**
> Ajoute le module qualitatif (guides, transcriptions, codage thématique, verbatims). Puis : sauvegardes, journal d'audit, gestion des erreurs, test de charge (20 enquêteurs simultanés, 5 000 fiches), documentation d'exploitation, procédure de déploiement. Critère de réussite : une étude fictive complète est menée de bout en bout par une personne qui n'a pas écrit le code.
