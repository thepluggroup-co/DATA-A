# Phase 5 — Rapport et restitution (M15)

**État : critère d'acceptation atteint le 19/10/2026 ; en attente de la validation écrite du fondateur** (porte de validation, CLAUDE.md §11). Réponses du fondateur le 18/10/2026 (D-036, D-037) : il fournit le rapport Word livré et la charte THE PLUG ; texte sans IA ; formats Word, PowerPoint et PDF. En attendant ces fichiers, les parties qui n'en dépendent pas sont construites (contrôles bloquants, note de base, graphiques).

## Critère d'acceptation
Rapport régénéré sans aucune incohérence de base, de total ou de numérotation.

## Sources disponibles
- **Le rapport Word livré au client n'est pas dans les fichiers de référence** (`reference/`, `reference/prive/documents/`).
- Son inventaire numéroté est connu par les syntaxes qui le reproduisent : `N08_A_RAPPORT_427.sps` et `EDM_EE_REPRODUCTION_RAPPORT_427.sps` (un TITLE par tableau ou graphique). On y trouve :
  - les tableaux S1, 2, 2 bis, 3, 5, 6, 7, 9, 10 et A2 ;
  - les graphiques 1 à 57 ;
  - les textes III.B.2 (dépense annuelle), III.B.3 (parts en valeur) et III.B.4 (effet enquêteur, régression logistique).
- Les chiffres viennent du moteur d'analyse validé (phase 4). Le plan d'analyse déclare déjà 20 tableaux vérifiés.

## Plan court
1. **Modèle du rapport** (`analyse/rapport/`) : une suite déclarée (YAML du projet) de sections, tableaux, graphiques et blocs de texte. Chaque élément numéroté pointe vers un résultat du moteur : **aucun chiffre saisi à la main**.
2. **Note de base** automatique en tête du rapport et sous chaque tableau (collectées, écartées avec motifs, retenues ; base du tableau).
3. **Graphiques** générés depuis les résultats (bibliothèque éprouvée : matplotlib).
4. **Contrôles bloquants avant export** :
   - bases et totaux identiques entre rapport, tri à plat et `.sav` ;
   - numérotation continue des tableaux et figures ;
   - légende et source sous chaque élément ;
   - termes étrangers au projet (liste des villes, marques et cibles du dictionnaire ; mots d'autres études) ;
   - accents et encodage ;
   - conclusions séparées des recommandations ;
   - tout chiffre du texte lié à sa requête.
5. **Exports** : Word (python-docx, déjà utilisé), présentation de restitution distincte, PDF selon la réponse à la question 3.
6. **Test d'acceptation** : régénérer le rapport EDM sur la base 427. Les contrôles passent, et des rapports volontairement corrompus (total faux, numéro manquant, terme étranger) sont refusés.

## Fait (18/10/2026)
- **Modèle du rapport** (`analyse/rapport/modele.py`) : titres, paragraphes, tableaux et figures numérotés, chacun lié à un résultat du moteur. Dans les paragraphes, aucun chiffre d'enquête n'est écrit : on écrit une référence `[[marques.pct(1)]]`, résolue et écrite à la française (44,4 ; 3 250 000). `[[lit:2026]]` sert pour les nombres qui ne viennent pas de l'enquête.
- **Contrôles bloquants** (`analyse/rapport/controles.py`), 21 tests :
  - numérotation (doublon, trou, ordre, « bis ») et renvois vers un tableau absent ;
  - titre, source et note de base sous chaque élément ; note de base égale à la base du calcul ;
  - bases et effectifs recalculés sur la base d'analyse (celle du `.sav`) ;
  - chiffre écrit en dur, référence introuvable (y compris une modalité absente du tableau) ;
  - terme étranger au projet, texte abîmé (encodage) ;
  - sections conclusions et recommandations séparées, et alerte non bloquante si une formule de recommandation apparaît dans les conclusions.

## Fait (suite, 18/10/2026)
- **Variables du rapport** dans le plan d'analyse : indicateurs R_* et P_* de la synthèse (N08:52-74), poids « groupes égaux » W_PROF, W_MAIL, W_VILL (N08:92-103), avec les fonctions `effectif_groupe(V)` et `nb_fiches()` (AGGREGATE de SPSS).
  - Le tableau S1 et la colonne « profils égaux » du tableau 2 bis sont identiques aux repères de N08_A, sur la base de la plateforme.
  - Les colonnes « maillons égaux » et « villes égales » n'ont pas de repère écrit dans la syntaxe : elles sont calculées par le même chemin, mais n'ont pas été comparées.
- **Tableaux composés** (assemblages de procédures validées, sans calcul nouveau) : `indicateurs` (S1, 2 bis), `synthese_khi2` (tableau 5) et `recapitulatif` (tableau 6, avec contrôle bloquant `TABLEAU_INCOMPLET`).
- **Rapport déclaré en YAML** (`analyse/rapport/chargeur.py`) :
  - sections, textes à références, tableaux et graphiques numérotés, calculés sur la base d'analyse ou de collecte, avec filtre éventuel ;
  - note de base générée sous chaque élément ;
  - le contrôle des bases recalcule chaque élément sur SA base, avec son filtre.
- **Rendus** (`analyse/rapport/rendus.py`) :
  - Word ;
  - présentation de restitution distincte (une diapositive par graphique) ;
  - PDF (LibreOffice si présent, sinon Word : vérifié sur ce poste) ;
  - graphiques matplotlib ;
  - charte paramétrable (`--charte`), avec une charte sobre provisoire en attendant celle de THE PLUG.
  - Dans le Word, les codes de variables et de modalités sont masqués (ils restent dans l'export Excel), les effectifs sont entiers et la légende ne se sépare jamais de son élément.
- **Commande** `plateforme rapport produire … --rapport … --formats docx,pptx,pdf`. Rien n'est écrit si un contrôle bloque, et chaque anomalie est listée.
- **Tests** : 347 au vert. Un test de bout en bout sur données réelles part du tableur brut et produit un extrait du rapport EDM (tableau S1, graphique 11) en Word et en présentation : 80,0 % déçus, 84,7 % des 424 acheteurs de prises.

## Fait (19/10/2026) — rapport livré V14 reçu
- V14 (`.docx` et `.pdf`) rangé dans `reference/prive/documents/`, hors Git (il contient le nom et le téléphone du chef de mission). Inventaire : 71 éléments numérotés (13 tableaux, 57 graphiques), chacun avec sa base.
- Charte par étude (D-039) : `projets/edm_cameroun/charte_m2b.yaml`, couleurs et police mesurées dans le XML de V14 ; la charte est déclarée par le rapport (`charte:`). Nom du produit : DATA'A (D-038), logo dans `reference/charte/data_a/`.
- Rapport EDM déclaré, partie 1 (`projets/edm_cameroun/rapport.yaml`) : note de lecture, synthèse (tableau S1), partie I, partie II jusqu'au tableau 3. **Chiffres identiques à V14**, vérifiés par `tests/test_rapport_edm.py` :
  - note de base 446 / 427 / 19 / 11 / 8 ;
  - tableau S1, repère IC 95 % compris ;
  - tableau 2 bis, y compris les colonnes « maillons égaux » et « villes égales » et l'écart max ;
  - étiquettes des graphiques 1 à 8 ;
  - tableau 3 (production par enquêteur et par jour, totaux 111 / 113 / 156 / 66).
- Outils ajoutés : références à la note de base (`[[base.retenues]]`…), aux lignes d'indicateurs, au test de sensibilité et aux cases d'un tri croisé ; graphiques en secteurs et en barres empilées ; tableaux croisés en effectifs avec totaux ; tableaux statiques (dont les cellules passent par les mêmes contrôles) ; variable de contrôle `NUMENQUE` (enquêteur numérique, libellés tirés du plan de terrain).
- **Incohérence trouvée dans V14** : le texte dit « aucun indicateur ne varie de plus de 5 points » alors que son tableau 2 bis donne 5,1 points (qualité). Le rapport régénéré cite la valeur par référence : l'incohérence disparaît.

## Fait (19/10/2026, suite) — logo DATA'A seul, parties II et III.A
- **Charte DATA'A** (D-042) : couleurs mesurées dans le logo (021C43, 1658C3, 15ABDC, 15EAE0), teintes calculées pour les fonds ; charte par défaut des rapports. Le rapport EDM garde les couleurs M2B et porte le logo DATA'A.
- **Tableau 2** (réalisé / prévu) : quotas lus dans le plan d'échantillonnage (« @quotas »), jamais recopiés ; identique à V14, ainsi que les phrases « 89,2 % des objectifs visés » et « particuliers 172 pour 85 (202 %)… ».
- **Tableau 4** (équipe) : fonctions seulement, sans nom ni téléphone.
- **Tableau 5** (khi-deux par ville et par profil) : les 17 lignes de V14 (base, V, p, *, Kruskal-Wallis, case et résidu ajusté). Différences de forme : libellés du dictionnaire (« 6 mois–1 an ») ; « n.s. » là où V14 écrivait « limite » (fidélité selon le profil, p = 0,050).
- **Tableau 6** (réponses / 98 / 99 pour les 56 variables) : identique à V14 ; contrôle de complétude (56 / 56).
- **Présentation** : effectifs et pourcentages à la française ; filtres traduits en libellés (« Ville = Yaoundé ») ; jours « J1 (05/10) » ; étiquettes des secteurs lisibles (secteurs étroits à l'extérieur, texte sombre sur fond clair).

## Fait (19/10/2026, suite) — parties III.B.1 et III.B.2
- **III.B.1 offre** (tableau 7, graphiques 9 et 10) et **III.B.2 demande** (tableau 8, graphiques 11 à 40) : 34 éléments et leurs textes ; chaque chiffre cité est une référence au moteur, y compris ceux tirés de croisements non affichés (élément `calcul`, listé en fin de rapport avec sa source).
- **Chiffres identiques à V14**, sauf trois écarts d'affichage expliqués et testés :
  - graphique 10 : V14 affiche 37/38/19/6, notre arrondi au plus fort reste (celui des graphiques 1 à 9) donne 37/39/19/5 ;
  - bas de gamme à Yaoundé = 18/160 = 11,25 % : V14 écrit 11,2 mais 31,3 pour 31,25 ; la plateforme arrondit toujours au demi supérieur, comme SPSS ;
  - « doute qualité » et « prix » : V14 dit l'écart « non significatif » sans test ; le rapport régénéré écrit « à égalité », sans affirmation non testée.
- **Outils ajoutés** : procédure `batterie` (plusieurs questions présentées ensemble) ; graphiques en barres groupées, en panneaux et en secteurs par colonne ; références `col(lignes|colonne)`, `pct(8,9,10)`, `p_txt` (« < 0,001 »), médianes et moyennes en millions ; nombres arrondis au demi supérieur.
- **Corrections** : conversion PDF par Word fiable avec un chemin contenant une apostrophe (« DATA'A ») et message clair en cas d'échec ; notes de base des batteries (« 316 à 337 répondants selon la question »).

## Fait (19/10/2026, suite) — partie III.B.3 concurrence
- **Tableaux 9 et 10, graphiques 41 à 47** et leurs textes ; chiffres identiques à V14 (effectifs des graphiques natifs Word de V14 retrouvés un à un).
- **Outils ajoutés** : répartitions côte à côte (une question par sous-population : graphiques 41-42, base « n = 142 (Douala) et 119 (Yaoundé) », chaque sous-population recontrôlée sur la base) ; carte des correspondances (graphique 43, normalisation symétrique, axe orientable) et rapport d'inerties (« 3,4 fois ») ; parts en valeur avec fourchettes bootstrap à graine fixe (D-043).
- **Écarts expliqués et testés** : bornes des fourchettes en valeur à 1 point près de V14 (tirages aléatoires de SPSS ; D-043) ; « écart à la limite de la significativité » (non testé) retiré ; « plus de 60 % » remplacé par « plus de six acheteurs sur dix » (37,0 + 24,4 ≠ 61,3 affiché).
- Valeurs des barres des graphiques désormais écrites avec le même arrondi que le texte (demi supérieur).

## Fait (19/10/2026, suite) — parties III.B.4 et III.C
- **Graphiques 48 à 57**, textes du nouveau distributeur, de l'effet enquêteur (ENQ1 à Douala : 65,0 % contre 10,8 % de demandes de garantie de plus d'un an), de l'achat en ligne (régression logistique : 3,5 ; 2,4 ; 0,23 ; R² 0,23 ; Hosmer-Lemeshow p = 0,004) et de l'environnement (cadre réglementaire, opportunités, menaces) : chiffres identiques à V14, effectifs des graphiques natifs Word retrouvés un à un.
- **Outils ajoutés** : test de Hosmer-Lemeshow (D-044, règle à confirmer dans le manuel IBM) ; références `or`, `or_bas`, `or_haut`, `hl_p` et `ncol` ; secteurs côte à côte pour plusieurs questions (graphiques 51, 52, 57).

## Fait (19/10/2026, suite) — conclusion, recommandations, annexe 1 : critère d'acceptation atteint
- **Parties IV (conclusion), V (recommandations stratégiques, mix marketing 4P, tableau 11, conditions de réussite et risques) et VI (annexe 1, questionnaire)** transcrites ; chaque chiffre est une référence au moteur.
- **Annexe 1 générée depuis le dictionnaire** (identification, 9 sections, Q1 à Q42), jamais ressaisie (D-045).
- **Critère d'acceptation de la phase 5 atteint** (`test_acceptation_phase_5_rapport_regenere_sans_incoherence`) : rapport complet, **zéro anomalie** (bases, totaux, numérotation, renvois, légendes, notes de base, termes étrangers, encodage, conclusions séparées des recommandations), graphiques 1 à 57 et 13 tableaux numérotés comme V14, Word + PowerPoint + PDF produits (72 pages).
- Production par la ligne de commande : `plateforme rapport produire … --formats docx,pptx,pdf` (sortie de contrôle dans `reference/prive/sorties/`, hors Git).
- Espaces insécables (« 69,3 % » jamais coupé en fin de ligne).

## Fait (19/10/2026, suite) — finalisation
- **Annexe 2 (tableau A2)** : groupes TwoStep importés du .sav livré par N° de fiche (section `imports` du plan d'analyse), chiffres recalculés ; écarts de double arrondi de V14 expliqués (D-046). Le rapport compte désormais **14 tableaux et 57 graphiques, comme V14**.
- **Sources** : « enquête EDM EE, oct. 2026 » sous les éléments (formulation de V14), requête d'origine de chaque élément en annexe des sources (D-046).

## Reste à faire dans la phase (dépend des fichiers attendus)
- **Règle SPSS du test de Hosmer-Lemeshow** à confirmer dans le manuel IBM « Algorithms » (D-044).
- Tableau 4 (équipe d'intervention) : V14 donne le nom et le téléphone du chef de mission ; le rapport régénéré n'affiche que les fonctions (D-026), sauf registre privé à brancher.
- Chronogramme (II.B.2) : tableau non numéroté dans V14 ; généré par le module M5 (phase 6).
- Ouverture du `.sav` et des syntaxes dans SPSS Statistics 27 sur un poste équipé (vérification manuelle, déjà notée en phase 4).
- Faits depuis (pour mémoire) : structure et termes interdits (D-041), charte par étude et logo DATA'A (D-039, D-042), sources alignées sur V14 (D-046), carte AFC (D-043), tableau A2 (D-046), test d'acceptation sur la base 427.

## En attente
- [x] Rapport Word livré au client → `reference/prive/documents/` (V14, 19/10/2026).
- [x] Logos THE PLUG et M2B : non requis, seul le logo DATA'A est utilisé (D-042).
- [ ] Maquette de la console web (Claude Design) : lien ou export → `reference/design/` (D-040).
