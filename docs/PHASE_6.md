# Phase 6 — Amont et documents (M0–M3, M5–M9, M13)

**État : VALIDÉE (D-051, 19/10/2026).** Cadrage : D-047 à D-050. 396 tests au vert, ruff et mypy strict sans erreur.

## Critère d'acceptation (CLAUDE.md §11)
Un projet fictif « 3 villes » passe du brief au badge, à la charte, au contrat, à l'ordre de mission, au chronogramme et à la
fiche de paiement **sans ressaisie**.

## Principe
Tout est dérivé des trois sources de vérité (dictionnaire, plan d'échantillonnage, plan de terrain), complétées en amont par
le **brief** (M0) et, en aval, par le **vivier** des enquêteurs (M6). Un document n'est jamais saisi : il est généré, versionné
et régénéré quand une source change (avec rapport de différences). Montants et barèmes : paramètres du projet, aucun en dur.

## Sources lues (19/10/2026)
| Gabarit | Où | Ce qu'on en tire |
|---|---|---|
| Chronogramme EDM (`prive/documents/chonnogramme EDM.pdf`) | local | 4 phases, 13 tâches, durées en jours ouvrés, ressources affectées (cabinet M2B) |
| Organisation EDM (PDF + XMind) | local | cibles par maillon → villes → zones → quartiers → enquêteurs ; objectifs 600 (version 01) ; écarts avec CLAUDE.md (D-048) |
| Formation EDM (XMind) | local | plan en 7 parties, identique à CLAUDE.md §3.1 |
| Maquette de badge (docx) | local | champs : photo, nom, prénom, matricule, fonction, région, téléphone, N° de badge, QR code, coordonnateur, mention de mandat |
| Chronogramme B-SOLUTIONS, profil de paiement SOLINA, charte PEINTURE, image de badge | **introuvables** (reference/README.md) | structure décrite dans CLAUDE.md §3.2 seulement |

## Plan court (ordre de construction)
1. **Modèles validés** des sources amont : brief (M0), plan d'échantillonnage (M2, calculs de taille, répartition, quotas,
   capacité), référentiel géographique (M3), plan de terrain enrichi (zones, quartiers, points, affectations, calendrier,
   rôles, barèmes) — avec leurs contrôles de cohérence croisés (quotas = objectifs, capacité ≥ quotas, jours ouvrés…).
2. **Générateurs de documents** depuis ces modèles : chronogramme (Gantt), organigramme du terrain, badge, charte, ordre de
   mission, contrat et engagement de confidentialité (gabarits à faire valider par un avocat), support de formation et quiz,
   fiche profil des paiements.
3. **Vivier et pipeline** des enquêteurs (M6), registre privé hors dépôt pour les données personnelles.
4. **Projet fictif « 3 villes »** et test d'acceptation de bout en bout.

## Fait (19/10/2026)
| Module | Livré | Où |
|---|---|---|
| M3 Référentiel géographique | 10 régions, 58 départements, **360 arrondissements** (HDX COD-AB, INC/OCHA, licence CC BY-IGO vérifiée) ; 4 villes, 37 quartiers et points de l'organisation EDM, chacun avec sa source | `geo/`, `reference/geo/CMR/`, `plateforme geo importer-hdx|verifier` |
| M2 Échantillonnage | plan validé (mention « non probabiliste » imposée), taille (Cochran, population finie, effet de plan), répartition au plus fort reste, capacité du terrain | `echantillonnage/plan.py` |
| M0 Brief et devis | brief versionné, tarifs de l'usine (aucun montant dans le code), pré-estimation, cahier des charges, devis | `projet/brief.py`, `documents/gestion.py` |
| M9 Organisation | plan de terrain enrichi (zones, localités, équipe, superviseurs, calendrier, barèmes), initialisation depuis le brief, organigramme du terrain | `terrain/plan.py`, `projet/initialiser.py` |
| M5 Chronogramme | gabarit tiré du chronogramme EDM (24 jours ouvrés retrouvés), ancres du terrain, ressources et % d'occupation, Gantt Word et Excel | `terrain/chronogramme.py`, `reference/gabarits/` |
| M6 Vivier | pipeline (transitions contrôlées, motif d'écart obligatoire), score paramétrable, historique de performance (re-casting) | `terrain/vivier.py` |
| M7 Documents | badges CR80 8 par A4 avec QR, charte (I à IV), ordres de mission, contrats et engagements (modèles juridiques) | `documents/badges.py`, `documents/enqueteur.py` |
| M8 Formation | support en 8 parties (Word et PowerPoint), quiz avec corrigé et notation | `documents/formation.py` |
| M13 Finances | fiche profil des paiements (remplacements, réserves, impressions, contrôle des totaux), devis | `finances/paiements.py` |

**Projet fictif « 3 villes »** (`projets/demo_3_villes/`) : brief, tarifs, cabinet, vivier et dictionnaire saisis une fois ;
plans générés ; 11 familles de documents produites par `plateforme projet documents … --pdf` (28 fichiers).

**Test d'acceptation** (`tests/test_phase6.py`) : depuis une copie SANS plans → `projet initialiser` → sources cohérentes →
tous les documents ; mêmes identifiants, noms, dates et montants dans les badges, ordres de mission, contrats, engagements,
organisation, chronogramme et fiche de paiement ; une source modifiée est signalée et répercutée ; une liste de cibles
divergente bloque la production.

## Reste à faire (hors porte ou en attente de fichiers)
- Gabarits SOLINA, PEINTURE, B-SOLUTIONS : ajuster les documents quand ils seront déposés (D-049).
- Contrat, engagement de confidentialité, consentement : validation par un avocat ; lecture du texte officiel de la loi n° 2024/017 pour citer les articles (CLAUDE.md §8).
- Page publique de vérification des badges : phase 7 (hébergement).
- Recherche documentaire assistée (M1) : registre des sources (titre, lien, date, licence) à construire avec l'étude exploratoire ; sans IA (D-037).
- Plan de terrain EDM : reporter les zones de l'organisation (référentiel prêt).
