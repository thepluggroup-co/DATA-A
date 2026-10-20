# Phase 7 — SaaS : espaces client et usine, abonnements, croisements à la demande, sécurité

**État : VALIDÉE (D-055, 19/10/2026).** Cadrage : D-051 à D-054.

## Critères d'acceptation
- CLAUDE.md §11 : deux clients fictifs isolés ; croisement à la demande refusé sous la base minimale ; audit de sécurité passé.
- Demande du fondateur (19/10/2026) : **le front-end passe de bout en bout** — tests Playwright dans un vrai navigateur,
  du compte client (brief, suivi agrégé, livrables, croisement) à la console usine (projets, documents, terrain).

## Point de départ
- Moteur complet en Python (phases 1 à 6), piloté en ligne de commande ; couche de stockage PostgreSQL multi-locataire
  amorcée (`stockage/`, organisation_id, D-007/D-008).
- **Aucun front-end** ; pile validée au cadrage (D-006) : FastAPI, React + TypeScript (Vite), une seule application pour
  client et usine avec droits par rôle, Playwright pour le bout en bout.
- Contrainte du poste : 4,4 Go libres sur C: (97 % plein).

## Plan court
1. **API FastAPI** au-dessus du moteur : authentification (sessions, double authentification TOTP pour l'usine), rôles,
   isolation stricte par organisation (filtre applicatif + Row-Level Security PostgreSQL), journal d'audit chaîné.
2. **Espace client** : brief guidé et pré-estimation, suivi agrégé du terrain (sans données personnelles), livrables,
   croisements à la demande avec garde-fous (base minimale, effectifs théoriques faibles, mention non probabiliste,
   k-anonymat), journalisation et export.
3. **Console usine** : file des projets, initialisation et cohérence, génération des documents (phase 6), terrain et
   qualité (phases 3-4), validation.
4. **Abonnements** : formules paramétrables (cadrage §4), droits par formule, devis et factures.
5. **Sécurité** : audit (dépendances, en-têtes, CSRF, limites de débit, isolation, 2FA, secrets), sauvegarde/restauration testée.
6. **Bout en bout** : Playwright sur les parcours client et usine, deux clients isolés.

## Fait (19/10/2026)
| Brique | Livré | Où |
|---|---|---|
| Base | migration 0003 : utilisateurs, sessions, journal d'audit chaîné inaltérable, formules, abonnements, factures, paiements, livrables, croisements ; **RLS forcée** sur 12 tables | `migrations/versions/0003_saas.py` |
| API | authentification (Argon2id, sessions, CSRF, TOTP usine, verrouillage, limite de débit), espace client, console usine, en-têtes de sécurité | `src/plateforme/api/` |
| Croisements | moteur avec garde-fous (base minimale, k-anonymat, effectifs théoriques, tests de colonnes Bonferroni, commentaire prudent), export Excel + syntaxe SPSS | `analyse/croisement.py` |
| Abonnements | 3 formules paramétrables (cadrage §4), droits (plafond de croisements), factures, paiements saisis par l'usine (D-052) | `api/app.py`, `saas/demo.py` |
| Front-end | une application React + TypeScript (Vite), charte DATA'A : connexion + double authentification ; client (études, abonnement, factures, suivi agrégé, croisements, livrables, brief) ; usine (file des projets, cohérence, documents, partage, clients, facturation, journal d'audit) | `web/` |
| Démonstration | jeu fictif (usine, clients A et B, bases synthétiques) et serveur autonome | `saas/` |

**Critères d'acceptation**
- Deux clients fictifs isolés : tests API et RLS (`test_api_saas.py`) + navigateur.
- Croisement refusé sous la base minimale : tests unitaires, API et navigateur.
- Audit de sécurité : `docs/AUDIT_SECURITE.md` (contrôles testés, 4 défauts trouvés et corrigés, dépendances auditées).
- **Bout en bout (demande du fondateur)** : 6 parcours Playwright dans Chromium, du client à l'usine et retour
  (`web/e2e/parcours.spec.ts`) : 4 séries consécutives à 6/6 après correction de deux défauts révélés par ces tests
  (validation après la réponse, serveurs orphelins). Navigateur : Chromium de Playwright, ou Edge du poste
  (`PW_CANAL=msedge`) quand le réseau empêche de télécharger Chromium.

**Lancer** : `cd web && pnpm run test:e2e` (construit le front, démarre la démonstration, exécute les parcours, nettoie).
**Démonstration manuelle** : `cd backend && uv run python -m plateforme.saas.serveur_demo --web ../web/dist`, puis
http://127.0.0.1:8765 (comptes affichés au démarrage ; usine : code TOTP du secret de démonstration).

## Reste à faire (voir aussi AUDIT_SECURITE.md §4)
- Chiffrement au repos (contacts, secrets TOTP), sauvegardes testées, conservation et purge, export et suppression sur demande.
- Conditions générales et propriété des données : gabarit pour avocat (CLAUDE.md §8).
- Déploiement (Docker Compose, Caddy/HTTPS, serveur au Cameroun) ; page publique de vérification des badges.
- Prestataire de paiement en ligne (adaptateur prévu, D-052) ; migration React Router 7 (D-054).
- Écrans à aligner sur la maquette Claude Design dès son dépôt (D-052).
