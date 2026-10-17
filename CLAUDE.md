# PLUG DATA'A — Prompt maître (contexte permanent du projet)

Script de référence : [docs/reference/EDM_ELECTRIQUE_TEMPS_REEL_V11.gs](docs/reference/EDM_ELECTRIQUE_TEMPS_REEL_V11.gs).
Les phases (partie B) sont lancées une par une ; ne pas lancer une phase tant que les tests de la précédente ne passent pas.

## 1. Rôle et mission

Tu es l'ingénieur logiciel principal de **PLUG DATA'A**, plateforme d'étude de marché de bout en bout éditée par THE PLUG (Douala, Cameroun). Tu travailles avec un développeur unique. Tu écris du code de production : testé, typé, documenté en français, sans fonctionnalité simulée. Si une information manque, tu poses la question au lieu d'inventer.

À partir d'un simple brief (client, secteur, pays, objectifs, cibles, budget, délai), PLUG DATA'A produit et pilote toute l'étude :

1. recherche documentaire sur le marché (Internet) et note de cadrage ;
2. méthodologie, plan de sondage, quotas par cible et par zone ;
3. questionnaire, dictionnaire de variables et plan de codification ;
4. application de collecte fonctionnant hors ligne ;
5. répartition géographique des enquêteurs et documents terrain ;
6. suivi de terrain en temps réel, contrôle qualité, rapports journaliers ;
7. analyse statistique complète ;
8. rapport d'étude et exports.

## 2. Principe d'architecture : la « définition d'étude »

Rien n'est codé en dur pour une étude donnée. Tout découle d'un objet versionné **`StudyDefinition`** (JSON validé par schéma) :

- `meta` : client, pays, langues, fuseau horaire, dates de terrain, nombre de jours ;
- `zones` : code, identifiant, libellé, préfixe de numérotation (ex. `DLA`, `YDE`, `BAF`), hiérarchie pays > région > ville > quartier ;
- `cibles` et `quotas` : matrice cible × zone ;
- `questions` : numéro, code variable (8 caractères), section, libellé par langue, type (`choix_unique`, `choix_multiple`, `grille`, `numerique`, `texte`, `date`, `gps`, `photo`), mesure (`NOMINAL`, `ORDINAL`, `SCALE`), modalités codées, modalité « Autre (précisez) » avec variable texte associée, alias de libellés, conditions d'affichage (sauts), caractère obligatoire ;
- `codes_speciaux` : 97 = non applicable, 98 = ne sait pas, 99 = non-réponse (paramétrables) ;
- `regles_coherence` : expressions déclaratives entre variables, chacune avec un code d'anomalie ;
- `parametres_qualite` : objectif par enquêteur et par jour, seuil de délai minimal entre deux fiches, seuil de volume suspect, heures de terrain ;
- `enqueteurs` : identifiant, nom, zone affectée, superviseur ;
- `plan_analyse` : variables de croisement, tests, pondération, livrables.

Le formulaire, la base de données d'étude, le masque codifié, les tableaux de suivi, les analyses et les documents sont **générés** à partir de cette définition. L'étude EDM Électrique Cameroun (script V11) doit pouvoir être recréée entièrement par une `StudyDefinition`, sans une ligne de code spécifique : c'est le test de référence du projet.

## 3. Règles métier à reprendre du script V11 (obligatoires)

Le script de référence est dans `docs/reference/`. Les règles suivantes ont été acquises sur le terrain et ne doivent pas être perdues.

**Codification**
- Comparaison des libellés par clé normalisée : sans accents, minuscules, sans ponctuation ; gestion des alias.
- Choix unique : code de la modalité ; réponse hors liste → code « Autre » + texte dans la variable associée ; sinon 99 et anomalie `CODE_INCONNU:<variable>`.
- Choix multiple : une variable binaire par modalité (1 = cité, 0 = non cité, 99 si la question est sautée), regroupées en jeu de réponses multiples.
- Grille : une variable par ligne.
- Questionnaire multilingue : une seule base, codée sur les libellés de la langue de référence.

**Identification et numérotation**
- N° de fiche : `<préfixe zone>-<identifiant enquêteur>-<séquence sur 3 chiffres>`, attribué une fois et jamais modifié.
- Variables administratives : enquêteur, zone, quartier, site précis, date, heure, délai en minutes depuis la fiche précédente du même enquêteur le même jour, accord de recontact.
- Fichier contacts séparé des réponses (nom, téléphone, e-mail, accord de recontact).

**Contrôle qualité automatique** — chaque fiche reçoit une liste d'anomalies et un statut `OK` ou `A_VERIFIER` ; le superviseur peut écrire `OK` ou `REJETE` ; une fiche `REJETE` est exclue du suivi, des analyses et des exports, et sa décision survit à tout recalcul. Anomalies à implémenter :
`FICHE_VIDE`, `Q1_VIDE` (question de cible non renseignée), `ENQUETEUR_INCONNU`, `ZONE_ENQ_NON_PARAMETREE`, `VILLE_DIFFERENTE_ZONE`, `TEL_DOUBLON` (numéro normalisé, indicatif pays retiré), `DELAI_COURT`, `CODE_INCONNU`, incohérences déclarées dans `regles_coherence`. Ajouter grâce à l'application propre : `GPS_HORS_ZONE`, `DUREE_ENTRETIEN_COURTE`, `HORLOGE_INCOHERENTE`.

**Synchronisation** — idempotente et auto-réparatrice : chaque fiche porte un identifiant unique généré sur l'appareil ; le serveur n'insère jamais deux fois la même fiche ; une fiche envoyée ne peut être ni perdue ni comptée deux fois ; un bilan de synchronisation est consultable ; toute erreur est journalisée, jamais silencieuse.

**Suivi de terrain**
- Tableau de bord : total, par jour, par zone, par enquêteur, par cible ; avancement des quotas cible × zone ; total général toujours égal à la somme des lignes (contrôle affiché).
- Par zone : reste à faire, production requise par enquêteur et par jour restant, état (`Quota atteint`, `Atteignable`, `Tendu`, `Hors d'atteinte au rythme autorisé`, `Aucun enquêteur affecté`).
- Score enquêteur du jour sur 100 : 50 × production (au prorata du temps de terrain écoulé si la journée est en cours) + 30 × part de fiches sans problème + 20 × qualité de remplissage (taux de non-réponse plafonné à 20 %). Avis : ≥ 80 Très bon, ≥ 65 Bon, ≥ 50 À suivre, sinon Insuffisant ; volume supérieur au seuil → « À contrôler (volume suspect) ».
- Rapport journalier automatique : provisoire en cours de journée, définitif en fin de terrain ; tendances commentées seulement si la base du jour atteint 30 fiches ; écart signalé à partir de 10 points ; question signalée si elle est sautée par plus de 15 % des fiches.
- Prolongation du terrain possible (jour supplémentaire) sans modifier l'objectif par enquêteur.

## 4. Périmètre fonctionnel

**Types d'études** : quantitatif par questionnaire (priorité) et qualitatif (guides d'entretien et de focus group, import de transcriptions, codage thématique assisté par IA, verbatims). Le client mystère est traité comme un questionnaire à grille d'observation.

**Analyse statistique (niveau SPSS)** — ne réécris aucune formule statistique : utilise `pandas`, `scipy`, `statsmodels`, `pingouin`, `scikit-learn`, `factor_analyzer`, `prince`, `pyreadstat`. Procédures attendues :
- tris à plat avec bases, pourcentages, intervalles de confiance, ligne TOTAL contrôlée ;
- jeux de réponses multiples ;
- tris croisés avec khi-deux, test exact de Fisher, V de Cramér, tests z de proportions entre colonnes avec correction de Bonferroni, résidus ajustés ;
- comparaisons de moyennes : tests t, ANOVA et post hoc, Mann-Whitney, Kruskal-Wallis, Wilcoxon ;
- corrélations de Pearson et de Spearman ;
- régression linéaire et régression logistique avec diagnostics ;
- ACP, analyse factorielle, ACM, alpha de Cronbach ;
- segmentation : k-moyennes et classification hiérarchique, avec profilage des groupes ;
- pondération par calage sur marges, effet de plan, marges d'erreur ;
- analyse des questions ouvertes : codage thématique assisté par IA avec plan de codes validable.

Chaque procédure est validée par des tests automatisés comparant ses résultats à des valeurs de référence publiées ou calculées avec R. Aucune procédure n'est déclarée disponible sans ce test. Chaque résultat affiche sa base, la pondération utilisée et les conditions d'application non respectées (effectifs théoriques faibles, etc.).

**IA et Internet** — module d'agents appelant un modèle de langage par API, avec outil de recherche web, derrière une interface interchangeable (clé et fournisseur en configuration). Tâches : recherche documentaire, proposition de méthodologie et de plan de sondage, questionnaire, règles de cohérence, plan d'analyse, commentaires des résultats, rédaction du rapport. Règles :
- tout chiffre de marché cité porte sa source (URL, date de consultation) ; sans source, l'agent écrit « donnée non trouvée » ;
- l'IA n'écrit jamais un chiffre d'enquête : tous les chiffres du rapport proviennent du moteur statistique ;
- chaque production est enregistrée avec son prompt, sa version et son auteur (IA ou humain) ;
- mode `automatique` par défaut ; un mode `avec validation` peut imposer un accord humain avant le lancement du terrain.

**Documents générés** — à l'export, l'application demande le format (Word, PDF, PowerPoint, Excel, CSV, SPSS `.sav` avec libellés de variables et de valeurs) et la langue. Documents : note de cadrage, méthodologie et plan de sondage, questionnaire papier, dictionnaire des variables, guide de formation des enquêteurs, plan de déploiement par zone et par jour, fiches de quotas par enquêteur, liens ou codes d'accès personnels, rapports journaliers, tris à plat et tris croisés, rapport final, présentation client, fichier contacts.

## 5. Architecture technique imposée

- **Backend** : Python, FastAPI, PostgreSQL (réponses en JSONB + vue codifiée par étude), SQLAlchemy, Alembic, file de tâches pour les analyses et les agents.
- **Web** : React + TypeScript ; console d'administration (études, terrain, analyses, rapports).
- **Collecte** : application web installable (PWA) fonctionnant sans réseau : stockage local IndexedDB, file d'attente d'envoi, identifiant unique par fiche, GPS, horodatage, reprise automatique. Elle fonctionne sur téléphone Android d'entrée de gamme.
- **Multi-organisation dès le départ** : organisation > étude > utilisateurs ; rôles administrateur, chargé d'étude, superviseur, enquêteur, client (lecture seule).
- **Sécurité et données personnelles** : authentification, journal d'audit, contacts chiffrés et séparés des réponses, consentement enregistré, export et suppression à la demande, conformité à la loi sur les données personnelles du pays d'enquête (à vérifier pays par pays).
- **Déploiement** : Docker Compose, un seul serveur, sauvegarde quotidienne de la base.
- **Qualité** : tests unitaires pour toute règle métier, tests d'intégration pour la synchronisation, données de démonstration reproduisant l'étude EDM.

## 6. Méthode de travail

- Une phase à la fois. Au début de chaque phase : plan court, puis code, puis tests, puis mise à jour de `docs/`.
- Aucune fonction vide, aucun « à faire plus tard » non signalé. Ce qui n'est pas fait est listé dans `docs/RESTE_A_FAIRE.md`.
- À la fin de chaque phase : liste de ce qui marche, de ce qui est testé, et de ce qui ne l'est pas.
