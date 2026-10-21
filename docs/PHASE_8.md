# Phase 8 — Collecte native hors ligne (application enquêteur)

**État : recette navigateur validée ; essai réel Android restant (ouverte le 19/10/2026, D-055 ; cadrage D-056).**

## Critère d'acceptation (CLAUDE.md §11)
50 fiches saisies hors connexion, synchronisées sans perte ni doublon. Recette : test automatique dans un navigateur
mobile émulé (réseau coupé), puis essai du fondateur sur un vrai téléphone Android.

## Point de départ
- Synchronisation serveur idempotente depuis la phase 2 (`stockage/synchro.py`) : identifiant de réponse unique imposé
  par la base, renvoi identique ignoré, renvoi modifié refusé et journalisé, N° de fiche jamais réattribué.
- Application web React (phase 7) ; forme retenue : application web progressive installable (D-006).

## Réalisé
- API terrain : activation par mission, session par jeton, réception par lots, métadonnées, photos, signalements et révocation.
- Application `/terrain` : formulaire du dictionnaire, file locale chiffrée AES-GCM (clé PIN via PBKDF2), cache hors ligne, reprise après rechargement et envoi automatique au retour du réseau.
- Recette Playwright mobile sur Edge : 50 fiches enregistrées hors ligne, page rechargée et déverrouillée, 50 fiches reçues ; renvoi du lot reconnu comme 50 déjà reçues, sans doublon.

## Plan court
1. **Serveur** : missions (code de mission haché, révocable), session de terrain par jeton, réception des fiches par
   lots (idempotente), métadonnées à part (durée d'entretien, position GPS), photos de points de vente, signalements ;
   isolation RLS comme en phase 7.
2. **Application enquêteur** (`/terrain`) : activation par code, PIN, stockage local chiffré (AES-GCM, clé dérivée du
   PIN), formulaire généré depuis le dictionnaire (identifiant et ville pré-remplis, question de quota obligatoire),
   objectifs du jour et quotas restants, file d'envoi, synchronisation au retour du réseau, fonctionnement hors ligne
   (service worker), installable sur l'écran d'accueil.
3. **À terminer** : essai du fondateur sur un téléphone Android (installation, PIN, collecte hors ligne, reconnexion et
   contrôle du compteur serveur) ; vérifier le comportement du navigateur ciblé et la restauration après fermeture complète.
