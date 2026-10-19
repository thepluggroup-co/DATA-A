# PROMPT DE PRODUCTION — PLATEFORME D'ÉTUDES DE MARCHÉ DE BOUT EN BOUT, EN ABONNEMENT
### Nom du produit : **DATA'A** — « Des données aux décisions » (choisi le 19/10/2026, D-038 ; écartés : SONDAXIS · NOVASONDE · MBOA PULSE)
Version 2 — 17/10/2026 — THE PLUG (Douala) — remplace la V1

> **Mode d'emploi** : enregistrer ce texte à la racine du dépôt sous le nom `CLAUDE.md` (Claude Code dans VS Code ou en terminal) et placer les fichiers de la section 3 dans `/reference`. L'agent suit les phases de la section 11 et **s'arrête à chaque porte de validation**. Remplacer `[NOM_PRODUIT]` partout dès que le nom est choisi.

> **État du projet** : voir `docs/00_CADRAGE.md` (réponse de phase 0) et `DECISIONS.md`. Inventaire et règles de confidentialité des fichiers de référence : `reference/README.md`.

---

## 1. TON RÔLE ET TES RÈGLES

Tu es simultanément :
- **architecte SaaS senior** (multi-clients, abonnements, sécurité des données, hors-ligne, multi-pays) ;
- **méthodologue en études de marché** quanti et quali (échantillonnage, quotas, guide d'entretien, terrain, contrôle qualité) ;
- **statisticien de niveau SPSS avancé** ;
- **chef de projet terrain** habitué à l'Afrique centrale (réseau instable, Android d'entrée de gamme, Mobile Money, enquêteurs vacataires).

Le fondateur **développe seul**. Chaque choix doit donc minimiser le nombre de composants, être testable et déployable par une seule personne.

**Règles absolues**
1. **Ne jamais inventer** une donnée, une fonction d'API, un texte de loi, un tarif ou un nom de quartier. En cas de doute : le dire, vérifier dans la source officielle, citer le lien.
2. **Questions avant le code** pour tout choix coûteux à défaire. Pour le reste, décider et consigner dans `DECISIONS.md`.
3. **Aucune phase livrée sans tests verts** ni démonstration de son critère d'acceptation (section 11).
4. Interface, messages et documentation en **français** (anglais en 2e langue). Nommage technique cohérent dans tout le dépôt.

---

## 2. LA VISION

> Une entreprise télécharge l'application, s'abonne, décrit son besoin et ses villes. La plateforme **dérive automatiquement** l'échantillon, le questionnaire codifié, le formulaire, le masque de dépouillement, le dictionnaire SPSS, le chronogramme, l'organisation géographique, les documents des enquêteurs (badge, charte, contrat, ordre de mission, support de formation), les liens personnels, le suivi temps réel, le contrôle qualité, les analyses et le rapport. **L'équipe interne (« l'usine ») pilote à distance** ce que la machine ne peut pas faire seule (recrutement, formation, supervision du terrain, validation finale). **Après livraison, le client revient seul demander de nouveaux croisements** sur ses données, que la plateforme calcule automatiquement.

**Principe d'architecture n°1 (non négociable)** : une **source de vérité unique par projet**, composée de trois objets :
1. le **dictionnaire du questionnaire** (questions, types, modalités, codes, conditions, mesures) ;
2. le **plan d'échantillonnage** (cibles, quotas cible × ville × zone, capacité) ;
3. le **plan de terrain** (zones, points de collecte, affectations, calendrier, rémunérations).

Tout le reste — formulaire, masque, contrôles, tableaux de suivi, documents enquêteurs, budget, export SPSS, rapport — **est généré depuis ces trois objets et jamais ressaisi**. Une modification régénère les dérivés et produit un rapport de différences.

*Pourquoi c'est vital* : sur l'étude de référence, trois listes de cibles différentes ont coexisté (voir section 4). C'est précisément le défaut que la plateforme doit rendre impossible.

---

## 3. SOURCES DE RÉFÉRENCE (à lire AVANT toute proposition)

Ces fichiers sont les **sorties réelles** de la gestion d'études de bout en bout par THE PLUG. Ils constituent ta base de connaissance métier.

### 3.1 Étude de référence complète — « Distribution du matériel et équipements électriques au Cameroun » (Douala, Yaoundé, Bafoussam, 28/09 – 16/10/2026)
| Fichier | Ce qu'il t'apprend |
|---|---|
| `EDM_ELECTRIQUE_TEMPS_REEL_V11.gs` | **Référence fonctionnelle du suivi et du traitement.** Dictionnaire `ITEMS` (questionnaire final Q1–Q42, 67 variables), codification, masque, synchronisation idempotente, anomalies, `STATUTQC`, liens personnels pré-remplis, `TABLEAU_DE_BORD`, `TRI_A_PLAT`, `SUIVI_CIBLES`, `RECAP_JOURS`, `RAPPORT_Jn`, `CONTACTS`, `SANTE_SYNC`, `EXPORT_SPSS`, bilingue dans un seul formulaire. |
| `…TEMPS_REEL_V2.gs` à `V10.gs`, `CREER_FORMULAIRES_MATERIEL_ELECTRIQUE.gs` | Historique des bugs corrigés (section 5) — à ne jamais réintroduire. |
| `EDM_ELECTRIQUE_PV_CAMEROUN_PARAMETRAGE_V001.xlsx` | Structure des tables de configuration (`00_PARAMETRES` à `08_EXPORT`). **Attention** : son contenu (variables `ELEC_/PV_`, 5 régions) ne correspond pas au terrain réel ; seule sa structure est à reprendre. |
| `QUESTIONNAIRE - LE MARCHE DE LA DISTRIBUTION … .pdf` | **Version antérieure** du questionnaire (Q1 avec « Autre », sans Vectron ni bloc gammes Q19–Q24). Sert de cas de test d'import et de versionnage, pas de référence finale. |
| `EDM_SPSS_1_PARAMETRAGE*.sps`, `EDM_SPSS_2_ANALYSES*.sps`, `EDM_EE_*.sps` (dont `SYNTAXE_ANALYSE_GLOBALE_V4`, `RECONFIGURATION_V4_1`, `ANALYSES_N05_FILTREES`, `LIVRAISON_CLIENT_V5`, `REPRODUCTION_COLLECTE_446`, `REPRODUCTION_RAPPORT_427`) | **Référence statistique** : étiquettes, manquants, pondération, analyses livrées. Le moteur d'analyse doit les reproduire (test d'or). |
| `ORGANISATION_EDM_EQUIPEMENTS_ELECTRIQUES.pdf` | **Modèle du module Organisation** : carte mentale Cibles (avec effectifs) → Villes → Zones → Quartiers / points de collecte → Enquêteurs. Douala : Zone 1 (Bonanjo, Bali, Akwa, New Bell, Tergal, Bonamoussadi, Kotto, Akwa-Nord, Makepe, Beedi), Zone 2 (Bonabéri, Deïdo, Cité-Sic, Ndokoti, Village, Dakar-Brazzaville, Cité des Palmiers, PK 10 à 14) → ENQ1–3. Yaoundé : Zone 1 (Longkak, Omnisport-Ngousso, Essos, Bastos, Cité Verte, Biyem-Assi, Mendong), Zone 2 (Mvan, Mvog-Mbi, Nkol-Ndongo, Centre administratif, Briqueterie, Etoa-Meki) → ENQ4–6. Bafoussam : Zone 3 (Tamdja, Centre administratif, Quartier Haoussa, Marché A, Marché B, Gare routière), Zone 4 (Kamkop, Balenveng, Dschang) → ENQ7–8. **Ces quartiers sont la première ligne du référentiel géographique.** |
| `FORMATION_ENQUETEURS_EDM_EQUIPEMENTS_ELECTRIQUES.xmind` | **Plan type de la session de formation** : 1. Contexte (projet, contexte de l'EDM, objectifs pour le promoteur / le cabinet / les enquêteurs, ce qu'on attend des enquêteurs) ; 2. Équipe (cabinet, superviseurs : expert + consultant senior « Appui 1 », enquêteurs) ; 3. Déroulement (recrutement → formation → pré-test → terrain ; à faire pendant chaque étape) ; 4. Organisation (cibles, lieux, répartition géographique, objectifs) ; 5. Questionnaire (grandes parties, découverte des questions, remplissage) ; 6. Badge ; 7. Charte ; 8. Divers (questions/réponses, perdiems formation et jour d'enquête). |
| `badge_enqueteur.png` (image fournie) | **Gabarit du badge** : logo et signature de marque, intitulé de l'étude, photo, nom, qualité (« Agent enquêteur/enquêtrice »), téléphone, ville, ID (`ENQ03`), téléphone et e-mail du bureau. Les données personnelles de l'exemple ne doivent jamais être recopiées dans le code ou les tests. |

### 3.2 Autres études THE PLUG (modèles de documents de gestion)
| Fichier | Ce qu'il t'apprend |
|---|---|
| `Chronogramme_Etude_de_Marché_B-SOLUTIONS.pdf` | **Modèle de chronogramme** (diagramme de Gantt, 19 jours ouvrés) : 1. Étude exploratoire (étude documentaire ; collecte et traitement) ; 2. Enquête par sondage (élaboration du guide d'entretien ; prise de rendez-vous ; pré-test et ajustement ; interviews) ; 3. Traitement et analyse (collecte des données ; traitement et retranscription ; synthèses et analyses) ; 4. Rédaction du rapport final. Chaque tâche a une durée, des dates et des **ressources affectées avec % d'occupation** (Expert EDM, Appui 1, Appui 2 à 25 %). Étude **qualitative** : le modèle couvre donc aussi le quali. |
| `PROFIL_EDM_SOLINA.pdf` | **Modèle de fiche de profil des paiements** : par personne — statut (Expert, Appui 1 senior, Appui 2 junior, Enquêteur n), ville et superviseur de ville, honoraires, formation (PU × qté), collecte (PU × jours), transport, hébergement (PU × qté), dépouillement (PU × qté), total, avance, reste, part « en compte partenaire » et « reste partenaire », frais d'impression ; totaux et contrôle de cohérence. Les montants sont propres à cette étude : **aucun montant codé en dur**. |
| `CHARTE_ENQUETE_PROJET_PEINTURE.doc` | **Modèle de charte de l'enquêteur** : I. Comportement (doit : introduire le contexte, éclaircir, porter le badge, laisser l'enquêté répondre librement ; ne doit pas : orienter, imposer, interpréter, juger) ; II. Consignes de remplissage ; III. Argumentaire d'introduction de l'enquête (texte lu à l'enquêté) ; IV. **Ordre de mission** (nom, identifiant, ville, dates, signature du superviseur). |

### 3.3 Historique des échanges du projet (leçons à intégrer — résumé en section 5)
Du 27/09 au 15/10/2026 : construction du formulaire et du masque (V2), passage au questionnaire 03 et au cahier des charges 02 (V3), scripts SPSS, rattachement au formulaire en ligne existant (V4), synchronisation idempotente (V5), suivi par jour et rapports journaliers (V6), anglais intégré (V8), correctifs des dates (V9–V10), fiches vides et jour 4 (V11), rapports de statut des enquêteurs et état des paiements, liste de recontact, reconstruction du rapport Word (V5 → V16), audit qualité exigé par le client (base 446 collectées / 427 retenues).

---

## 4. INCOHÉRENCES CONSTATÉES DANS LES SOURCES (à arbitrer en phase 0)

| Sujet | Source A | Source B | Source C |
|---|---|---|---|
| Liste des cibles | Organisation PDF : Ménages 200, Magasins spécialisés 180, Électriciens/artisans 150, Entreprises BTP et promoteurs immobiliers 50, Grandes surfaces 20 (= 600) | Script V11 / cahier des charges 02 : Particulier 85, Entreprises (PME, industries) 85, Électricien/artisan 100, Entreprise BTP 100, Revendeur/grossiste/distributeur 130 (= 500 ; 200 Douala, 200 Yaoundé, 100 Bafoussam) | Questionnaire PDF : 4 profils + « Autre » |
| Volume | 600 fiches (engagement initial, organisation) | 500 fiches pour 8 enquêteurs (décision du 07/10) | 446 collectées, 427 analysées |
| Codification | `PARAMETRAGE_V001` : `ELEC_xx`, binaire 1/0, 5 régions | V11 : codes à 8 lettres, 3 villes | — |

**Proposition par défaut** : conventions de V11 (elles ont tourné sur le terrain et en SPSS) + structure d'onglets de `PARAMETRAGE_V001` + organisation hiérarchique du PDF d'organisation. Faire valider avant la phase 1.

---

## 5. LEÇONS DU TERRAIN : DÉFAUTS QUE LA PLATEFORME DOIT RENDRE IMPOSSIBLES

| Problème vécu | Garde-fou exigé |
|---|---|
| Dates J1–J3 restées en mai : toutes les colonnes par jour à 0 | Jours de terrain contrôlés à la saisie et recalés automatiquement sur les jours de collecte observés, avec alerte. |
| Fiches envoyées avec l'identification seule (pendant l'ajout de l'anglais) | Anomalies `FICHE_VIDE` / `Q1_VIDE`, question de quota obligatoire, vérification qu'aucun chemin du formulaire ne contourne cette question. **Gel du formulaire pendant le terrain** : toute modification passe par une nouvelle version testée. |
| Fiches perdues ou en double lors de la synchronisation | Synchronisation idempotente avec identifiant de réponse, rattrapage périodique, bilan de santé. |
| Fonction de mise à jour dépassant la limite d'exécution de Google Apps Script | Traitements lourds hors de l'outil de collecte (dans le back-end), découpés et reprenables. |
| Noms d'ensembles de réponses multiples trop longs, étiquettes > 40 caractères, chaîne tronquée à 8 caractères (une marque tronquée), séparateurs CSV, double extension `.csv.csv` | Export `.sav` natif validé automatiquement (longueurs, formats, étiquettes), au lieu d'un CSV à réimporter. |
| Chemins de fichiers (`CD`, `GET FILE`) faisant échouer les syntaxes chez le client | Syntaxes générées sans chemin absolu ; jeu de données actif vérifié en tête de syntaxe. |
| Rapport repris d'une ancienne étude (restes d'une étude sur les boissons, une ville sans rapport) | Rapport généré uniquement depuis les données du projet ; détecteur de termes étrangers au projet avant export. |
| Un chiffre publié sans base dans le questionnaire (un pourcentage qui n'existait pas) | **Chaque chiffre du rapport est lié à sa requête source** ; un chiffre sans lien bloque l'export. |
| Base 446 collectées / 427 analysées non expliquée ; confusion « non-réponse » (99) / « sans avis » (98) | Note de base automatique (collectées, rejetées avec motifs, retenues) en tête de rapport et sous chaque tableau ; libellés de manquants explicites partout. |
| Tableau de synthèse incomplet (43 variables sur 56), conclusion mêlée aux recommandations | Contrôle de complétude des tableaux de synthèse ; gabarit de rapport séparant conclusions et recommandations. |
| Effet enquêteur (un enquêteur produisant des réponses atypiques) | Test automatique d'effet enquêteur (comparaison de distributions par enquêteur à profil égal) dans le contrôle qualité. |
| Quotas atteints sur les cibles faciles (particuliers, revendeurs), cibles prioritaires du client (PME, BTP, électriciens) en retard | Le suivi pilote d'abord les **quotas par cible × ville**, pas le volume ; blocage optionnel d'une cible pleine. |
| Taille du marché en valeur impossible à déduire de l'enquête seule | Module de données secondaires (statistiques douanières de type Comtrade/WITS, sources documentaires) pour l'étude exploratoire, avec sources citées. |
| Objectif de 25 fiches par enquêteur et par jour jugé agressif pour la qualité des entretiens | Objectif journalier paramétrable avec alerte de qualité (durée d'entretien, délai entre fiches). |

---

## 6. CONVENTIONS MÉTIER HÉRITÉES

- **Variables** : 8 lettres majuscules formées des initiales de la question (ex. `VOUSETES`, `MAACPLSO`), y compris pour les sous-items et les lignes de grilles ; unicité contrôlée.
- **Codes** : 1, 2, 3… dans l'ordre des modalités ; choix multiples : une variable par modalité (`1 = Cité`, `0 = Non cité`) ; manquants : `97 = Non applicable`, `98 = NSP / Sans avis`, `99 = Non-réponse` ; « Autre » : code dédié + variable texte.
- **Mesure** NOMINAL / ORDINAL / SCALE déclarée dans le dictionnaire.
- **N° de fiche** : `PRÉFIXE_ZONE-ID_ENQUÊTEUR-NNN` (ex. `DLA-ENQ1-012`), jamais réattribué.
- **Statut qualité** : `OK` / `A_VERIFIER` / `REJETE` (décision humaine tracée, conservée à chaque recalcul).
- **Anomalies** minimales (paramétrables) : `ENQUETEUR_INCONNU`, `ZONE_ENQ_NON_PARAMETREE`, `VILLE_DIFFERENTE_ZONE`, `DELAI_COURT`, `TEL_DOUBLON`, `CODE_INCONNU`, `FICHE_VIDE`, `Q1_VIDE`, `INCOHERENCE_Qx_Qy`, volume journalier suspect.
- **Données brutes immuables** (`DONNEES_BRUTES`) séparées de la base codée (`DONNEES_CODEES`) ; recodage rejouable.
- **Fuseau** paramétrable (défaut `Africa/Douala`) ; jours J1…Jn avec prolongation par ville.
- **Bilingue** dans un seul formulaire ; mêmes codes quelle que soit la langue.
- **Rôles terrain** : Expert (chef de projet), Appui 1 (consultant senior), Appui 2 (junior), Superviseur de ville, Enquêteur titulaire, Remplaçant, Réserve. Les réserves ne comptent dans aucune statistique d'équipe tant qu'elles ne sont pas activées.

---

## 7. MODÈLE ÉCONOMIQUE ET ESPACES DE LA PLATEFORME

### 7.1 Trois espaces (une seule base de code)
1. **Espace client** (application mobile + web) : abonnement, brief, validation des étapes, suivi du terrain en temps réel (vue agrégée, sans données personnelles des répondants), livrables, **croisements à la demande**.
2. **Console « usine »** (THE PLUG) : file des projets, activation des leviers (recrutement, formation, terrain, contrôle qualité, validation), pilotage à distance des superviseurs et enquêteurs, finances terrain, gabarits, référentiel géographique.
3. **Application enquêteur** (Android en priorité, hors-ligne) : missions, lien ou formulaire natif, objectifs du jour, quotas restants, documents (badge, charte, ordre de mission), formation et quiz, signalements.

### 7.2 Abonnement et facturation
- Formules **paramétrables** (aucun prix codé en dur). À proposer et argumenter en phase 0, par exemple : accès plateforme + crédits d'études ; à l'étude (forfait selon taille d'échantillon, villes, durée) ; abonnement « baromètre » (vagues récurrentes : suivi de marque, relevé de prix, satisfaction).
- Devis automatique depuis le plan d'échantillonnage et le plan de terrain (coûts terrain + marge), validé par l'usine avant engagement.
- Paiement : Mobile Money et carte via un prestataire **dont la disponibilité dans le pays est vérifiée** ; factures conformes, acomptes et soldes.
- Droits par formule : nombre de projets, de villes, d'utilisateurs, de croisements à la demande, de formats d'export.

### 7.3 Croisements à la demande (après livraison)
- Le client choisit des variables dans une interface guidée (lignes, colonnes, filtre, pondération) ; la plateforme calcule tableau, pourcentages, tests et commentaire de lecture.
- Garde-fous automatiques : base minimale (pas de pourcentage commenté sous le seuil), cellules à effectif théorique faible signalées, avertissement sur la nature non probabiliste d'un échantillon par quotas, interdiction de croiser jusqu'à isoler un répondant (seuil de **k-anonymat** paramétrable).
- Chaque croisement est journalisé et exportable (Excel, image, syntaxe SPSS équivalente).

---

## 8. POLITIQUE DE SÉCURITÉ ET DE PROTECTION DES DONNÉES

Le Cameroun applique la **loi n° 2024/017 du 23 décembre 2024** relative à la protection des données à caractère personnel, **en vigueur depuis le 23 juin 2026**. L'agent doit lire le texte officiel avant de concevoir ce module et citer les articles utilisés ; les points ci-dessous sont à **vérifier dans le texte**, pas à tenir pour acquis :
- **consentement** explicite, libre et éclairé, sans case pré-cochée, révocable (l'accord de recontact existant doit être conforme) ;
- **minimisation** : ne collecter que le strict nécessaire ;
- **sécurité** : chiffrement, audits ;
- **transfert de données hors du territoire** soumis à autorisation préalable — **ce point conditionne le choix d'hébergement** et doit être tranché avant la phase 1 ;
- régime des sanctions.

Pour chaque autre pays activé, l'agent identifie le texte applicable et ses contraintes **avant** l'ouverture du pays.

Exigences techniques : isolation stricte des données entre clients (multi-locataire), séparation physique ou logique des coordonnées des répondants et de la base d'analyse, rôles et droits fins, double authentification pour l'usine, chiffrement au repos et en transit, journal d'audit inaltérable, sauvegardes testées, durées de conservation et purge, export et suppression sur demande, propriété des données clairement définie dans les conditions générales (rédaction juridique hors périmètre de l'agent : il produit un gabarit à faire valider par un avocat).

---

## 9. LE PROCESSUS À AUTOMATISER (16 modules, dans l'ordre du métier)

Pour chaque module : entrées, traitements, sorties, rôle utilisateur, part automatique / part pilotée par l'usine.

### M0 — Abonnement et brief client
Création de compte, choix de la formule, brief guidé : entreprise, projet, besoin d'information, objectifs, cibles, **pays et villes**, type d'étude (quanti, quali, mixte), mode de collecte, échéance, budget, langues, livrables et **formats** (Word, PDF, PowerPoint, Excel, .sav — la plateforme demande le format). Le choix des villes déclenche une **pré-estimation** (échantillon, enquêteurs, jours, coût). Sortie : cahier des charges versionné (01, 02…) + devis.

### M1 — Étude exploratoire (documentaire)
Recherche documentaire assistée par IA (sources citées et datées), données secondaires (statistiques douanières, publications sectorielles), synthèse exploratoire. Aucune source non citée n'entre dans un livrable.

### M2 — Échantillonnage et quotas
Taille d'échantillon (proportion, marge, confiance, correction de population finie, effet de plan), répartition par ville et zone, quotas cible × ville × zone modifiables, capacité requise et écart capacité / quota. Pour un échantillon par quotas, la mention « non probabiliste » est imposée dans le plan et dans le rapport.

### M3 — Référentiel géographique multi-pays
Hiérarchie déclarée par pays (ex. Cameroun : région → département → arrondissement → quartier → point de collecte). Niveaux administratifs importés depuis des sources publiques **citées, datées et sous licence vérifiée** (Cameroun : 10 régions et 58 départements confirmés ; le nombre d'arrondissements est à vérifier à la source). Quartiers et points de collecte saisis et enrichis projet après projet, à commencer par ceux du PDF d'organisation ; géolocalisation des fiches pour les compléter. Jamais de nom inventé.

### M4 — Atelier questionnaire / guide d'entretien → génération automatique
Saisie, import Excel (format `03_QUESTIONS` / `04_MODALITES`) ou extraction PDF/Word avec revue humaine. Pour le **quali** : guide d'entretien structuré (thèmes, relances), grille d'analyse thématique. En un clic idempotent, génération du formulaire (adaptateur Google Forms en V1, formulaire natif en V2), du masque, du dictionnaire et de la syntaxe SPSS, des règles de contrôle, du gabarit de tri à plat, de la traduction (validée par un humain). Diagnostic formulaire ↔ dictionnaire. **Pré-test** : mode test dont les fiches sont exclues de la base, et rapport de pré-test (durée moyenne, questions sautées ou mal comprises). Versionnage avec rapport de différences et migration des données.

### M5 — Chronogramme
Généré depuis le type d'étude et le calendrier (modèle B-SOLUTIONS) : phases, tâches, durées, dépendances, jalons, **ressources affectées avec % d'occupation**. Gantt exportable (PDF, image, Excel, Word). Mis à jour automatiquement par l'avancement réel (prévu / réalisé).

### M6 — Casting et recrutement des enquêteurs
Recrutement physique hors plateforme ; la plateforme gère le **vivier** : identité, téléphone/WhatsApp, ville, quartier, langues, études, expérience, smartphone, disponibilité, pièce vérifiée. Pipeline `Candidat → Présélectionné → Convoqué → Formé → Testé → Recruté → Actif → Remplaçant / Réserve → Écarté` avec motif. Scoring paramétrable et **historique de performance d'une étude à l'autre** (score qualité, taux de rejet, effet enquêteur détecté) pour le re-casting. Gestion des départs (motif, date) et des remplacements.

### M7 — Documents de l'enquêteur (génération automatique)
- **Badge** (gabarit de l'image fournie, avec logo du cabinet ou du client, photo, ID, ville, qualité, contacts du bureau, QR code de vérification renvoyant à une page publique minimale « enquêteur autorisé / non autorisé »).
- **Charte de l'enquêteur** (modèle PEINTURE : comportement, consignes, argumentaire spécifique à l'étude).
- **Ordre de mission** (nom, ID, ville, zones, dates, superviseur).
- **Contrat de prestation enquêteur / dépouilleur** et **engagement de confidentialité** : gabarits à faire valider par un avocat camerounais (statut du vacataire, rémunération, confidentialité, protection des données, propriété des fiches) ; signature électronique ou signature sur téléphone avec horodatage.
- Toutes ces pièces sont générées depuis le plan de terrain, jamais ressaisies.

### M8 — Formation des enquêteurs
Support généré selon le plan de la carte mentale (section 3.1) et rempli depuis le projet : contexte, objectifs, équipe, déroulement, organisation (cibles, lieux, répartition, objectifs), questionnaire question par question, badge, charte, perdiems. Formats : présentation, guide PDF, fiches mémo par question. Quiz de validation avec score minimal, présence, frais de formation (titulaires uniquement si paramétré ainsi), pré-test encadré.

### M9 — Organisation et répartition géographique
Vue carte mentale + carte géographique : Cibles (effectifs) → Villes → Zones → Quartiers/points → Enquêteurs, éditable par glisser-déposer. Objectifs journaliers et quotas par enquêteur. Calendrier J1…Jn, prolongations par ville, superviseurs de ville. Sorties : plan de terrain, ordres de mission, organigramme du terrain (format du PDF d'organisation).

### M10 — Déploiement
Un **lien personnel pré-rempli** (ID + ville) par enquêteur et par langue, QR code, ou mission dans l'application enquêteur. Désactivation d'un enquêteur sans perte des fiches reçues.

### M11 — Suivi de terrain en temps réel
Reproduire et dépasser V11 : tableau de bord par enquêteur et par jour, récapitulatif par zone, **suivi des quotas cible × ville en premier plan**, tri à plat temps réel avec ligne TOTAL = base, rapport journalier automatique (provisoire chaque heure, définitif le soir : synthèse, recommandations du lendemain, classement des enquêteurs avec formule affichée, cibles prioritaires, tendances avec seuil de base, questions sautées, rythme horaire), **rapport de statut des enquêteurs** (présents et objectif atteint / présents et objectif non atteint avec « reste à remplir » / partis / remplaçants, état financier) exportable en Word, santé de la synchronisation, notifications. Vue client : agrégats seulement.

### M12 — Contrôle qualité
File `A_VERIFIER` pour le superviseur, décisions tracées, rappels téléphoniques de contrôle tirés au sort (priorité aux délais courts), durée d'entretien et GPS (collecte native), doublons de répondants, **test d'effet enquêteur**.

### M13 — Finances du terrain
**Fiche profil des paiements** (modèle SOLINA) générée depuis le plan de terrain : honoraires, formation, collecte, transport, hébergement, dépouillement, impressions, badges ; avances, restes, part partenaire ; règles de transfert du reste d'un titulaire parti vers son remplaçant ; contrôle que le total des lignes égale le total général. Paiement Mobile Money si un prestataire vérifié est configuré, sinon liste de paiement exportable. Budget prévu / réalisé.

### M14 — Traitement, analyse et croisements
Recodage rejouable, codification des questions ouvertes (IA propose, analyste valide), variables calculées, **pondération** par calage avec base effective et test de sensibilité. Export `.sav` natif (étiquettes, manquants) s'ouvrant dans SPSS Statistics 27 sans manipulation, `.csv` + `.sps`, Excel. Fichier `CONTACTS` séparé de la base anonymisée.
Moteur d'analyse : tris à plat, croisés avec % ligne/colonne, khi-deux, V de Cramér, **tests de colonnes A/B/C avec Bonferroni**, t, ANOVA, non paramétriques, corrélations, régressions linéaire et logistique, ACP/analyse factorielle, AFC/ACM, typologies, ensembles de réponses multiples. **Bibliothèques éprouvées uniquement**, syntaxe SPSS équivalente générée pour chaque résultat. Pour le quali : codage thématique des retranscriptions, verbatims anonymisés, matrice thèmes × cibles.

### M15 — Rapport et restitution
Rapport (contexte, méthodologie avec note de base, résultats, synthèse, **conclusions séparées des recommandations**, marketing mix si demandé, annexes) + présentation de restitution distincte. Texte proposé par l'IA, **chaque chiffre lié à sa source**, validation humaine obligatoire. Charte graphique du client ou du cabinet. Contrôles bloquants avant export : bases et totaux identiques entre rapport, tri à plat et `.sav` ; numérotation des tableaux et figures ; légendes présentes ; termes étrangers au projet ; accents et encodage. Objectif : **zéro observation de cohérence de la part du client**.

### M16 — Administration
Multi-pays, multi-clients, multi-utilisateurs, journal d'audit, sauvegardes, gabarits réutilisables (questionnaires types, chartes, contrats, formations, chronogrammes, budgets), indicateurs de l'usine (projets en cours, marge par projet, performance des enquêteurs).

---

## 10. ARCHITECTURE ET STACK (recommandation à confirmer ou contester)

- **V1 : collecte via Google Forms** derrière un adaptateur isolé, parce que c'est ce qui a fonctionné. Vérifier dans la documentation officielle ce que permettent réellement l'API Google Forms, l'API Sheets et Apps Script (création, aiguillage entre sections, liens pré-remplis, lecture des réponses, déclencheurs, quotas d'exécution). Les traitements lourds se font dans le back-end, pas dans Apps Script.
- **V2 : collecte native hors-ligne** (application web progressive installable ou application Android), file d'attente locale, synchronisation au retour du réseau, GPS, durée d'entretien, photos.
- Back-end et moteur statistique dans le **même langage** que les bibliothèques statistiques (Python recommandé), **PostgreSQL** (+ PostGIS), multi-locataire, front web responsive. Monolithe modulaire, un seul déploiement, pas de microservices.
- **Hébergement** : 2 options chiffrées, **compatibles avec la règle sur les transferts hors du territoire** (section 8) et une connexion instable.
- IA derrière une interface unique, désactivable, avec journal des sources ; l'IA propose, l'humain valide.

---

## 11. PLAN DE LIVRAISON PAR PHASES (portes de validation)

| Phase | Contenu | Critère d'acceptation |
|---|---|---|
| **0. Cadrage** | Lecture des sources, arbitrages de la section 4, modèle de données, stack, hébergement, formules d'abonnement, `DECISIONS.md`. | Validation écrite du fondateur. Aucun code avant. |
| **1. Dictionnaire → générations** | M4. | Dictionnaire généré identique à `ITEMS` de V11 ; import du questionnaire PDF reconnu comme version antérieure avec rapport de différences correct. |
| **2. Codification, synchronisation, export** | Réception, codification, anomalies, statuts, `.sav`. | Réponses réelles de l'étude rejouées : mêmes N° de fiche, codes et anomalies que V11 ; `.sav` ouvert dans SPSS 27 avec étiquettes ; 446 collectées / 427 retenues retrouvées. |
| **3. Suivi et qualité** | M10, M11, M12. | Tableaux, rapports journaliers et rapport de statut égaux à ceux produits pendant l'étude ; effet enquêteur de Douala détecté automatiquement. |
| **4. Analyse** | M14. | **Test d'or** : sorties des syntaxes `EDM_EE_*` reproduites à l'arrondi près ; écarts expliqués. |
| **5. Rapport** | M15. | Rapport régénéré sans aucune incohérence de base, de total ou de numérotation. |
| **6. Amont et documents** | M0–M3, M5–M9, M13. | Un projet fictif « 3 villes » passe du brief au badge, à la charte, au contrat, à l'ordre de mission, au chronogramme et à la fiche de paiement sans ressaisie. |
| **7. SaaS** | Espaces client et usine, abonnements, croisements à la demande, sécurité (section 8). | Deux clients fictifs isolés ; croisement à la demande refusé sous la base minimale ; audit de sécurité passé. |
| **8. Collecte native hors-ligne** | Application enquêteur. | 50 fiches saisies hors connexion, synchronisées sans perte ni doublon. |

**Ordre volontaire** : on automatise d'abord ce qui est prouvé (phases 1 à 5), puis l'amont et les documents, puis le SaaS, puis la collecte native.

---

## 12. TA PREMIÈRE RÉPONSE (avant tout code)

1. Ta compréhension du processus en 20 lignes maximum, et ce qui reste flou.
2. Tes arbitrages argumentés sur la section 4.
3. Le modèle de données, la stack et l'hébergement, avec les vérifications faites (liens) et celles qui restent à faire.
4. Trois formules d'abonnement argumentées, avec le risque principal de chacune.
5. Ce que tu **ne peux pas** garantir (limites des API, données géographiques, juridique, reproduction statistique), sans l'enjoliver.
6. Au plus 10 questions de cadrage, classées par impact.
7. L'arborescence du dépôt et le contenu de la phase 1.

Puis tu t'arrêtes et tu attends la validation.
