# Phase 0 — Cadrage (réponse de l'agent, en attente de validation)

Rédigé le 17/10/2026 en réponse à la section 12 de `CLAUDE.md`. **Aucun code applicatif n'est écrit avant la validation écrite du fondateur.**
Les décisions proposées sont reprises une à une dans [`DECISIONS.md`](../DECISIONS.md).

**Sources réellement lues pour ce cadrage** : `CLAUDE.md` (V2), le script `EDM_ELECTRIQUE_TEMPS_REEL_V11.gs` (lu en entier et exécuté sous Node : 42 questions, 67 colonnes de masque, toutes à 8 caractères). Les autres fichiers de la section 3 n'ont **pas encore été lus** : la plupart se trouvent dans `Téléchargements`, pas dans le dépôt (inventaire dans [`reference/README.md`](../reference/README.md)). Les points qui en dépendent sont marqués *« à confirmer à la lecture »*.

---

## 1. Compréhension du processus (20 lignes)

1. Un client s'abonne et décrit son besoin (M0). La plateforme pré-estime l'échantillon, les enquêteurs, les jours et le coût, puis produit un cahier des charges versionné et un devis.
2. L'étude exploratoire (M1) rassemble des sources secondaires citées et datées.
3. Trois objets forment la source de vérité unique du projet : le **dictionnaire**, le **plan d'échantillonnage** et le **plan de terrain**. Tout le reste est dérivé et régénérable, avec un rapport de différences.
4. Le dictionnaire génère le formulaire (Google Forms en V1), le masque, le dictionnaire SPSS, les contrôles et le gabarit de tri à plat (M4).
5. Le plan de terrain génère l'organisation (villes → secteurs → quartiers → enquêteurs), le chronogramme, les documents des enquêteurs, la formation, les liens personnels et les finances (M5–M10, M13).
6. Pendant le terrain, chaque réponse brute est conservée telle quelle, puis codée de façon rejouable. Elle reçoit des anomalies et un statut QC. Le superviseur tranche : `OK` ou `REJETE`, et sa décision survit à tout recodage (M11–M12).
7. Le suivi pilote d'abord les **quotas cible × ville**, pas le volume. Les rapports journaliers sont automatiques.
8. Après le terrain : traitement, pondération, analyses de niveau SPSS avec syntaxe équivalente, export `.sav` natif (M14).
9. Le rapport (M15) est rédigé par l'IA, mais chaque chiffre est lié à sa requête. Un chiffre sans lien bloque l'export, et une validation humaine est obligatoire.
10. Après livraison, le client lance seul des croisements, sous garde-fous : base minimale, k-anonymat, avertissement « non probabiliste ».
11. L'usine (THE PLUG) pilote ce qui reste humain : recrutement, formation, supervision, validation.

**Ce qui reste flou**
- Qui est le **responsable de traitement** au sens de la loi 2024/017 : le client, THE PLUG, ou les deux conjointement ? Cela change les obligations de déclaration et le contrat.
- La part **quali** dans les phases 1 à 5 : le texte la mentionne dans M4, M5 et M14, mais toutes les portes de validation sont quanti.
- « Application mobile » côté client : application publiée sur un store, ou web installable ?
- Le **pays suivant** : les téléchargements contiennent une étude « pâtes alimentaires, Côte d'Ivoire », ce qui suggère que le multi-pays est proche.

---

## 2. Arbitrages sur la section 4

| Sujet | Arbitrage proposé | Raison |
|---|---|---|
| **Liste des cibles** | La référence est **V11 / cahier des charges 02** : 5 cibles, 500 fiches (Douala 200, Yaoundé 200, Bafoussam 100). La liste du PDF d'organisation (600 fiches, 5 autres cibles) devient la **version 01 du plan d'échantillonnage**. Le questionnaire PDF (4 profils + « Autre ») devient la **version antérieure du dictionnaire**. | C'est la liste qui a réellement tourné sur le terrain, dans les quotas et dans SPSS. Garder les deux autres comme versions antérieures donne gratuitement les cas de test du versionnage et du rapport de différences, ce qui est l'objet même de la phase 1. |
| **Volume** | Plan = **500**. Les chiffres 446 et 427 sont des **résultats** (collectées / retenues), pas des paramètres : ils deviennent des valeurs attendues des tests de phase 2. | Mélanger plan et résultat est la cause de la confusion « 446 / 427 ». La note de base automatique les distinguera. |
| **Codification** | **Codes V11** (8 lettres, 97/98/99, « Autre » = code dédié + variable texte). De `PARAMETRAGE_V001`, on reprend la **structure** des onglets `00_PARAMETRES` à `08_EXPORT` comme format d'import/export Excel, pas son contenu. | V11 est validé par SPSS et par le client. |
| **Hiérarchie géographique** | Organisation hiérarchique du PDF, mais avec une **correction de vocabulaire** (voir ci-dessous). | Le mot « zone » désigne deux choses différentes dans les sources. |

**Deux incohérences supplémentaires relevées (non listées en section 4)**
1. **« Zone » est ambigu.** Dans V11, `CODEZONE` désigne la **ville** (1 Douala, 2 Yaoundé, 3 Bafoussam), et le préfixe du N° de fiche (`DLA`) est celui de la ville. Dans le PDF d'organisation, une « zone » est un **secteur à l'intérieur d'une ville**. Proposition : dans le modèle, `ville` et `secteur` sont deux niveaux distincts. `CODEZONE` reste une variable d'export calculée depuis la ville, pour la compatibilité avec V11 et les syntaxes SPSS.
2. **Numérotation et contenu des secteurs de Bafoussam.** Les zones y sont numérotées 3 et 4 alors que Douala et Yaoundé repartent à 1. Et **Dschang**, une autre ville (département de la Menoua), figure dans la « Zone 4 » de Bafoussam. Il faut confirmer s'il s'agit d'un point de collecte réel hors de Bafoussam. Je ne l'inscrirai pas comme quartier de Bafoussam sans votre confirmation.

---

## 3. Modèle de données, stack, hébergement

### 3.1 Modèle de données (grandes lignes)

```
Organisation (locataire) ──< Utilisateur (rôles)   ──< Abonnement ── Formule (droits paramétrables)
        │
        └──< Projet ──┬── DictionnaireVersion   (JSONB validé, n° de version, gelé pendant le terrain)
                      ├── PlanEchantillonVersion (cibles, quotas cible × ville × secteur)
                      ├── PlanTerrainVersion     (secteurs, points, affectations, calendrier J1…Jn, rémunérations)
                      ├──< Formulaire (adaptateur : google_forms | natif) ── lien vers DictionnaireVersion
                      ├──< ReponseBrute   (IMMUABLE ; clé d'idempotence = source + id de réponse)
                      ├──< FicheCodee     (RECALCULABLE depuis ReponseBrute + DictionnaireVersion ; N° de fiche figé)
                      ├──< DecisionQC     (table séparée : OK / REJETE, auteur, date, motif — survit au recodage)
                      ├──< Contact        (schéma séparé, colonnes chiffrées, consentement horodaté)
                      ├──< Affectation ── Enqueteur (personne, transverse aux projets : historique de performance)
                      ├──< Livrable / Croisement (journalisé, requête source conservée)
                      └──< JournalSync, JournalAudit (ajout seul, chaînage par empreinte)

Référentiel géographique (partagé) : Pays ──< UniteAdmin (niveau, parent, source, date, licence) ──< PointCollecte (géométrie PostGIS)
```

- **Isolation des clients** : colonne `organisation_id` sur toutes les tables du projet, et **Row-Level Security PostgreSQL**. Une requête qui oublie son filtre ne renvoie rien au lieu de renvoyer les données d'un autre client.
- Les trois objets sources sont stockés en **JSONB versionné** et validés par des modèles Pydantic. Les tables relationnelles servent seulement à ce qui est interrogé souvent (fiches, décisions, affectations).
- Le N° de fiche est attribué **une seule fois**, à l'insertion de la fiche codée, puis copié tel quel lors des recodages. C'est la règle V11 `seqForce`, rendue structurelle.

### 3.2 Stack proposée (un seul développeur, un seul déploiement)

| Couche | Choix | Pourquoi |
|---|---|---|
| Back-end | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic 2 | Même langage que les bibliothèques statistiques. |
| Base | PostgreSQL 16 + PostGIS | Imposé par le prompt. RLS pour le multi-locataire. |
| Tâches de fond | **Procrastinate** (file de tâches stockée dans PostgreSQL) | Évite d'ajouter Redis ou RabbitMQ : un composant de moins. |
| Statistiques | pandas, scipy, statsmodels, pingouin, scikit-learn, factor_analyzer, prince, pyreadstat | Bibliothèques éprouvées uniquement. |
| Documents | docxtpl / python-docx, python-pptx, openpyxl, WeasyPrint (PDF) | Gabarits Word modifiables par l'usine. |
| Front | React + TypeScript (Vite), **une seule application** pour client et usine, droits par rôle ; PWA installable | Une seule base de code front. |
| Collecte V1 | Adaptateur Google Forms (API REST + script Apps Script minimal pour les déclencheurs) | Ce qui a fonctionné. |
| Déploiement | Docker Compose : `app`, `worker`, `db`, `caddy` (HTTPS automatique) | Quatre conteneurs, un serveur. |
| Outillage | `uv` (Python), `pnpm` (front), `pytest`, `ruff`, `mypy`, Playwright (tests de bout en bout) | |

**Oracle de test** : V11 exporte ses fonctions pures (`module.exports`) et se charge sous Node (vérifié : `colonnesMasque_()` renvoie 67 colonnes). Les tests des phases 1 et 2 compareront donc la sortie Python à la sortie de V11 elle-même, et non à une copie manuelle.

**Environnement de ce poste** (vérifié) : Node 24 et pnpm 11 sont présents. **Python, uv et Docker ne sont pas installés** : il faudra les installer avant la phase 1.

### 3.3 Hébergement : deux options

Le point décisif : selon plusieurs synthèses juridiques, la loi 2024/017 soumet tout **transfert de données personnelles hors du Cameroun à une autorisation préalable** de l'Autorité de protection, à l'**article 32**. Cette référence est citée par une source secondaire : **je n'ai pas encore pu lire le texte officiel** (voir §5).

| | **Option A — Serveur au Cameroun** | **Option B — Serveur hors du territoire (Europe)** |
|---|---|---|
| Exemple vérifié | Cloudstore Africa annonce des datacenters à Douala et Yaoundé, « sans transfert hors du territoire », et des VPS « dès 4 900 FCFA/mois » ([page VPS](https://cloudstore.africa/virtualserver.php), [page Cameroun](https://cloudstore.africa/fr/pays-cameroun)). Ce sont des **affirmations commerciales non vérifiées**. Autres sites recensés : Camtel, Orange, MTN ([dchub](https://dchub.cloud/facilities/in/cm)). | Hébergeurs européens courants. **Tarifs non vérifiés ici** : à relever sur leurs pages officielles au moment du choix. |
| Loi 2024/017 | Compatible sans autorisation de transfert, **à condition** que les sauvegardes restent aussi au Cameroun (second site : Yaoundé si Douala est le principal). | **Autorisation préalable nécessaire** avant d'y stocker des contacts de répondants camerounais. Délai et procédure inconnus. |
| Risques | Fiabilité et SLA à éprouver, qualité du support, peu de services managés. | Bloquant juridique tant que l'autorisation n'est pas obtenue. |
| Connexion instable | Latence faible pour les enquêteurs camerounais. | Latence plus élevée, mais la collecte hors ligne (phase 8) l'absorbe. |

**Point que le prompt ne mentionne pas : la collecte V1 par Google Forms est elle-même un transfert hors du territoire.** Les réponses, dont le nom, le téléphone et l'e-mail des répondants, sont stockées par Google. Quelle que soit l'option d'hébergement retenue, c'est **la question n°1 de la section 6**.

**Recommandation provisoire** : option A pour la production, avec un essai de 30 jours (disponibilité mesurée, restauration de sauvegarde testée) avant tout engagement. Le développement se fait en local.

---

## 4. Trois formules d'abonnement (aucun prix fixé ici)

| Formule | Principe | Pour qui | Risque principal |
|---|---|---|---|
| **1. Accès + crédits d'études** | Abonnement mensuel ou annuel donnant accès à la plateforme (projets, croisements, exports), plus des **crédits** consommés par le terrain, selon le nombre de fiches et de villes. | Clients réguliers : agences, directions marketing. | **Lisibilité** : un client qui ne comprend pas ce que coûte un crédit n'achète pas. Il faut un devis en crédits *et* en FCFA à chaque projet. |
| **2. À l'étude (forfait)** | Prix calculé par le devis automatique (échantillon, villes, durée, coûts terrain + marge), validé par l'usine. La plateforme est incluse pendant le projet, puis une période d'accès aux croisements après livraison. | PME, première étude, appels d'offres. | **Marge** : le terrain réel dérive du devis (remplacements, jour 4, comme sur l'étude EDM). Il faut une clause de révision et un suivi prévu/réalisé (M13). |
| **3. Baromètre** | Abonnement à des **vagues récurrentes** : suivi de marque, relevé de prix, satisfaction. Même dictionnaire d'une vague à l'autre, comparaisons automatiques. | Marques installées, distributeurs. | **Engagement terrain** : il faut des enquêteurs disponibles à date fixe, chaque mois, dans chaque ville. Le risque opérationnel est porté par l'usine. |

Le paiement par Mobile Money exige un prestataire vérifié (§5). La formule 2 peut démarrer avec une facture et un virement, sans intégration de paiement.

---

## 5. Ce que je ne peux pas garantir

**Juridique**
- Je n'ai **pas lu le texte officiel** de la loi 2024/017. Le PDF de synthèse trouvé ([EBA & Associés](https://www.ebaaetassocies.com/doc/focus.pdf)) n'était pas lisible en entier. Les points « autorisation préalable de transfert, art. 32 » et « conformité exigée au 23/06/2026 » viennent de sources **secondaires** ([politique Bridges](https://partners-stg.bridges.cm/privacy-policy), [Techhive Advisory](https://www.techhiveadvisory.africa/insights/operationnalisation-de-la-loi-camerounaise-sur-la-protection-des-donnees-un-examen-des-principales-dispositions-et-des-impacts), [Anove](https://www.anove.ai/fr/regulations/cameroon-law-2024-017), [Africa Data Protection](https://www.africadataprotection.org/en/pays/cameroun.html)). Il faut le texte publié par la Présidence ([prc.cm](https://www.prc.cm)) ou le Journal officiel.
- J'ignore si l'**Autorité de protection est opérationnelle** et comment se demande une autorisation (dossier, délai).
- Contrats, CGU, engagements de confidentialité : je produis des gabarits, **un avocat camerounais doit les valider**.

**API Google** ([référence REST Forms](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms))
- L'API REST permet de créer des questions, des sections, l'aiguillage par option (`goToAction`, `goToSectionId`), les grilles (`QuestionGroupItem.grid`), l'option « Autre » (`isOther`), le caractère obligatoire, et de lire les réponses (`forms.responses`).
- La documentation officielle indique que **les formulaires créés par l'API après le 30/06/2026 ne sont pas publiés par défaut** : l'adaptateur devra appeler `setPublishSettings`.
- Elle ne permet pas de créer une question d'envoi de fichier. `forms.create` n'accepte que le titre : il faut un second appel `batchUpdate`.
- Je n'ai **pas trouvé dans l'API REST l'équivalent de `toPrefilledUrl()`** d'Apps Script, celui qui sert aux liens personnels V11. La notification à la soumission passe par `forms.watches` (Pub/Sub) au lieu d'un déclencheur Apps Script. Ces deux points sont à vérifier en début de phase 1 : sinon, un petit script Apps Script reste nécessaire.
- Le nombre maximal d'éléments par formulaire et par requête n'est pas documenté dans ce que j'ai lu.

**Données géographiques**
- Cameroun : **10 régions, 58 départements, 360 arrondissements** selon l'[INS](https://ins-cameroun.cm/wp-content/uploads/2021/02/0-CHAPITRE-2_ORGANISATION-INSTITUTIONNELLE-ADMINISTRATIVE-ET-POLITIQUE.pdf) (décret 2008/376, tableaux arrêtés au 31/12/2017). Une note du MINAT de décembre 2025, rapportée par la [presse](https://fr.journalducameroun.com/cameroun-le-minat-entend-creer-de-nouveaux-departements-et-arrondissements/), confirme ces chiffres mais annonce de nouveaux découpages : le référentiel doit être daté et versionné.
- Il n'existe, à ma connaissance, **aucun référentiel public des quartiers**. Ils seront saisis projet par projet, en commençant par le PDF d'organisation, jamais générés.
- La licence d'un jeu de limites administratives géolocalisées n'est pas encore vérifiée.

**Reproduction statistique**
- Les tests d'or reproduiront les sorties SPSS « à l'arrondi près » pour les procédures déterministes : effectifs, pourcentages, khi-deux, t, ANOVA, corrélations, régressions.
- Des **écarts sont attendus et seront documentés** sur :
  - le test exact de Fisher au-delà de 2 × 2 ;
  - les rotations en analyse factorielle ;
  - les tests de colonnes pondérés (SPSS utilise ses propres arrondis de bases pondérées) ;
  - les typologies (k-moyennes : dépendance au point de départ) ;
  - l'ACM (prince et SPSS n'utilisent pas exactement la même normalisation).
- **`.sav`** : pyreadstat écrit les étiquettes de variables et de valeurs et les valeurs manquantes. Je n'ai **pas vérifié** qu'il sait écrire les **ensembles de réponses multiples** (MRSETS) : sinon, ils seront fournis dans un `.sps` d'accompagnement.
- L'ouverture « dans SPSS 27 sans manipulation » ne peut être prouvée que sur un poste qui a SPSS 27.

**Paiement**
- **Aucun prestataire Mobile Money n'a encore été vérifié** dans sa documentation officielle. Kora annonce l'encaissement en XAF via MTN MoMo et Orange ([Kora Cameroun](https://www.korahq.com/cameroon/home)). Zitopay annonce 2,6 % + 10 XAF par transaction ([fiche](https://www.softwareadvice.com/online-payment/zitopay-profile/)). Un agrégateur rappelle que les portefeuilles locaux passent par des partenaires agréés BEAC/COBAC ([Orchestrapay](https://www.orchestrapay.com/coverage/africa/cameroon)).
- CinetPay, NotchPay, Campay, Flutterwave : non vérifiés. À faire avant la phase 7.

**IA** : la recherche documentaire citera ses sources, mais je ne peux pas garantir l'exactitude d'une source citée. D'où la validation humaine obligatoire.

---

## 6. Questions de cadrage (classées par impact)

1. **Hébergement et Google Forms.** Choisissez-vous l'option A (serveur au Cameroun) ? Et pour la collecte V1 par Google Forms, qui transfère les contacts des répondants hors du territoire, que préférez-vous : (a) demander l'autorisation à l'Autorité, (b) ne plus collecter nom, téléphone et e-mail dans Google Forms et les saisir dans la plateforme, ou (c) avancer directement la collecte native (phase 8) ?
2. **Responsable de traitement** : le client, THE PLUG, ou les deux ? Avez-vous déjà un avocat pour valider CGU, contrats et ordre de mission ?
3. **Fichiers de référence et données personnelles.** Plusieurs fichiers contiennent des données réelles de répondants ou d'enquêteurs : `.sav`, masques `.xlsx`, liste de recontact, badges, état des enquêteurs. Je propose de les placer dans `reference/prive/`, **exclu de Git**, et de ne versionner que le code, les syntaxes et les gabarits anonymes. D'accord ?
4. **Fichiers manquants.** Pouvez-vous fournir le **questionnaire PDF antérieur**, indispensable à la porte de la phase 1, ainsi que `CREER_FORMULAIRES_MATERIEL_ELECTRIQUE.gs`, V2, V7, V9, le chronogramme B-SOLUTIONS, `PROFIL_EDM_SOLINA.pdf` et `CHARTE_ENQUETE_PROJET_PEINTURE.doc` ? Je ne les ai pas trouvés dans `Téléchargements`.
5. **Arbitrages du §2** : validez-vous V11 / cahier des charges 02 comme référence, le PDF d'organisation comme version 01 du plan et le questionnaire PDF comme version antérieure ? Et la séparation `ville` / `secteur` ?
6. **Dschang** dans la « Zone 4 » de Bafoussam : point de collecte réel hors de la ville, ou erreur ?
7. **Réponses brutes réelles** pour la phase 2 : pouvez-vous exporter les réponses du formulaire Google, CSV ou accès au classeur, avec leurs identifiants de réponse ? Sans elles, impossible de prouver « mêmes N° de fiche que V11 ».
8. **SPSS 27** : avez-vous un poste avec SPSS 27 pour la vérification d'acceptation des phases 2 et 4 ?
9. **Nom du produit** : je propose un nom de code technique neutre (`plateforme`) dans le code, et `[NOM_PRODUIT]` seulement dans l'interface, pour que le changement de nom ne touche qu'un fichier de configuration. D'accord ?
10. **Pays suivant et quali** : la Côte d'Ivoire est-elle le prochain pays ? Le quali doit-il entrer dès la phase 1, guide d'entretien inclus dans le dictionnaire, ou attendre la phase 6 ?

---

## 7. Arborescence du dépôt et contenu de la phase 1

```
.
├── CLAUDE.md                  prompt de production (V2)
├── DECISIONS.md               décisions datées, statut proposé / validé
├── README.md
├── docker-compose.yml         (phase 1 : db seulement ; app, worker, caddy ensuite)
├── reference/                 sources métier versionnées (code, syntaxes, gabarits anonymes)
│   └── prive/                 données réelles — EXCLU DE GIT
├── backend/
│   ├── pyproject.toml
│   ├── src/plateforme/
│   │   ├── noyau/             config, base, multi-locataire, journal d'audit
│   │   ├── dictionnaire/      M4 : modèle, validation, versionnage, diff
│   │   ├── generateurs/       masque, SPSS (.sps), tri à plat, Google Forms (requêtes), diagnostic
│   │   ├── imports/           Excel (03_QUESTIONS / 04_MODALITES), V11 (.gs), PDF (+ revue)
│   │   ├── codification/      (phase 2)
│   │   ├── terrain/           (phase 3)
│   │   ├── analyse/           (phase 4)
│   │   └── api/               routes FastAPI
│   ├── migrations/            Alembic
│   └── tests/
│       └── oracle_v11/        appel Node du script V11 pour les tests de conformité
├── web/                       React + TypeScript (à partir de la phase 3)
├── projets/edm_cameroun/      dictionnaire, plan d'échantillonnage, plan de terrain (YAML)
└── docs/
    ├── 00_CADRAGE.md
    └── RESTE_A_FAIRE.md
```

**Phase 1 — Dictionnaire → générations (M4)**
1. Modèle `Dictionnaire` (Pydantic) : questions, types (choix unique, multiple, grille, texte, numérique, date), modalités codées, « Autre », alias, libellés FR/EN, mesure, obligation, conditions d'affichage, codes spéciaux paramétrables. Validation : codes de 8 lettres uniques, codes de modalités uniques, 97/98/99 réservés.
2. `projets/edm_cameroun/dictionnaire.yaml` : transcription du dictionnaire V11 (Q1–Q42), avec les traductions anglaises de V11.
3. Générateurs : colonnes du masque (ordre SPSS), dictionnaire Excel, syntaxe SPSS (`VARIABLE LABELS`, `VALUE LABELS`, `MISSING VALUES`, `MRSETS`, `VARIABLE LEVEL`, sans chemin absolu), gabarit de tri à plat avec ligne TOTAL, requêtes `batchUpdate` Google Forms (générées et testées hors ligne ; l'envoi réel reste une action manuelle confirmée).
4. Diagnostic formulaire ↔ dictionnaire, comme `diagnostiquer()` dans V11. Il comprend la recherche d'un chemin qui contourne la question de quota, comme `verifierFormulaire()`.
5. Versionnage et rapport de différences : questions et modalités ajoutées, supprimées ou recodées, avec l'impact sur les variables.
6. Import du questionnaire PDF → brouillon de dictionnaire → **revue humaine** → enregistrement comme version antérieure → rapport de différences avec V11.

**Critère d'acceptation (tests)**
- Les 67 colonnes générées sont identiques à `colonnesMasque_()` de V11 : code, libellé, format SPSS, mesure, valeurs, groupe, ordre. La comparaison est faite par l'oracle Node, pas par une copie manuelle.
- Le rapport de différences PDF → V11 signale au minimum : « Autre » retiré de Q1, Vectron ajouté à Q12, bloc gammes Q19–Q24 ajouté. *(À confirmer à la lecture du PDF.)*
- Tests verts, et `docs/RESTE_A_FAIRE.md` à jour.

**Hors phase 1** : base de données en service, API web, interface. La phase 1 livre une bibliothèque testée et une ligne de commande (`plateforme dictionnaire generer|diff|diagnostiquer`).

---

*Fin de la réponse de phase 0. L'agent s'arrête ici et attend la validation écrite du fondateur.*
