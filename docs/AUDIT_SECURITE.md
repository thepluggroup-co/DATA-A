# Audit de sécurité — phase 7 (19/10/2026)

Audit **automatisé et reproductible** mené par l'agent sur le code de la plateforme (API FastAPI, base PostgreSQL, front-end
React). Il ne remplace pas un test d'intrusion externe, recommandé avant la mise en production (voir « Reste à faire »).

## 1. Contrôles vérifiés par des tests (tous au vert)

| Exigence (CLAUDE.md §8) | Mesure | Preuve |
|---|---|---|
| Isolation stricte entre clients | Filtre applicatif **et** Row-Level Security PostgreSQL **forcée** sur 12 tables ; l'application se connecte avec le rôle `plateforme_app` (ni propriétaire ni superutilisateur) et fixe le contexte à chaque transaction | `test_deux_clients_isoles`, `test_rls_dans_la_base_meme_sans_filtre_applicatif` (une requête SANS filtre ne voit que l'organisation du contexte ; une écriture chez un autre client est refusée par la base) ; navigateur : `isolation : le client B ne voit ni l'étude ni les données du client A` |
| Rôles et droits fins | client administrateur / lecteur, usine administrateur / opérateur ; routes usine refusées aux clients ; brief réservé à l'administrateur du client | `test_csrf_double_facteur_et_roles` |
| Double authentification de l'usine | TOTP (RFC 6238) obligatoire avant tout accès usine ; code faux refusé et journalisé | idem ; navigateur : parcours usine |
| Mots de passe | Argon2id ; 12 caractères au moins, lettres et chiffres ; verrouillage 15 min après 5 échecs | `test_verrouillage_apres_echecs`, `test_nouveau_client_et_brief` ; navigateur : refus d'un mot de passe faible |
| Sessions | jeton aléatoire de 256 bits ; **seule son empreinte SHA-256 est stockée** ; cookie HttpOnly, SameSite=Strict, Secure en production ; expiration 8 h | `contexte.py`, `app.py` |
| CSRF | jeton par session exigé en en-tête pour toute écriture | `test_csrf_double_facteur_et_roles` (sans jeton et faux jeton : 403) |
| Limitation de débit | 20 tentatives de connexion / 10 min par adresse | `app.py` |
| En-têtes | CSP stricte (`default-src 'self'`, `frame-ancestors 'none'`), nosniff, DENY, no-referrer, Permissions-Policy, COOP, HSTS en production, `Cache-Control: no-store` sur l'API | `test_en_tetes_et_chemins` |
| Traversée de chemin | tout fichier servi est confiné au dossier de stockage (`chemin_sur`) | `test_en_tetes_et_chemins` |
| Injection | aucun SQL construit à partir d'une saisie (ORM paramétré) ; le filtre de croisement passe par l'évaluateur du plan d'analyse, qui refuse toute expression hors grammaire | `test_suivi_agrege_et_croisement_avec_garde_fous` (`__import__('os')` refusé) |
| Journal d'audit inaltérable | chaîne d'empreintes SHA-256 ; déclencheur qui refuse UPDATE et DELETE ; droits UPDATE/DELETE retirés au rôle applicatif ; vérification de la chaîne dans la console | `test_usine_documents_partage_facture_paiement_et_audit` |
| Données personnelles | le client ne voit que des agrégats (suivi) et la base d'analyse livrée, sans contacts ; identifiants et enquêteurs exclus des croisements | `test_suivi_agrege_…` |
| k-anonymat et base minimale | croisement refusé sous la base minimale ; cases de 1 à k − 1 masquées ; refus si toutes les cases isolent des personnes | `test_croisement.py`, `test_api_saas.py` ; navigateur : refus affiché |

## 2. Défauts trouvés par l'audit, corrigés
1. **Verrouillage de compte inopérant** : l'erreur renvoyée annulait la transaction, donc le compteur d'échecs et la ligne
   d'audit. Corrigé : l'échec est enregistré dans sa propre transaction, validée avant le refus.
2. **Serveurs PostgreSQL orphelins** : un serveur de démonstration tué brutalement laissait sa base tourner (54 processus
   accumulés, contribuant à la saturation mémoire du poste). Corrigé : arrêt des orphelins au démarrage et en fin de tests.
3. **Échecs intermittents du calcul sous contrainte mémoire** (OpenBLAS) : un fil de calcul par processus serveur.
4. **Écart migration / modèles** (identifiants 64 bits des journaux) : aligné, test de conformité au vert.
5. **Transaction validée après la réponse** : par défaut, FastAPI ferme la dépendance de base de données APRÈS l'envoi
   de la réponse ; un échec de validation aurait été masqué derrière un succès, et une relecture immédiate pouvait ne
   pas voir l'écriture (test de bout en bout instable). Corrigé : `scope="function"` sur toutes les dépendances de
   base, vérifié par `test_transactions_validees_avant_la_reponse`.

## 3. Dépendances (vulnérabilités connues)
- **Python** : `pip-audit` sur les 241 dépendances verrouillées → **aucune vulnérabilité connue** (19/10/2026).
- **JavaScript** : `pnpm audit` → 21 signalements au départ ; après mise à jour (react-router-dom 6.30.6, vite 6.4.4,
  Playwright 1.64.1), **2 modérés restants**, dans `react-router`, corrigés seulement en version 7 (refonte majeure) :
  - redirection ouverte par barre oblique inverse dans `<Link>` / `useNavigate` : **non exploitable ici**, les liens et
    redirections n'utilisent que des chemins internes écrits dans le code ou des identifiants renvoyés par l'API ;
  - injection lors du rendu serveur (SSR) : **sans objet**, l'application n'a pas de rendu serveur.
  Risque accepté et motivé (D-054) ; passage à React Router 7 à planifier.

## 4. Reste à faire avant la production (non couvert par cet audit)
- Chiffrement au repos des coordonnées des répondants (table `contact`, D-008) et des secrets TOTP.
- Sauvegardes **testées** (restauration effective) et durées de conservation / purge ; export et suppression sur demande.
- HTTPS de bout en bout (Caddy, Docker Compose, D-006) et hébergement au Cameroun (D-010) ; secrets hors du dépôt.
- Test d'intrusion externe et revue juridique (loi n° 2024/017, articles à citer après lecture du texte officiel).
- Comptes de démonstration (`saas/demo.py`) : mots de passe et secret TOTP publics, **réservés à la démonstration**.
