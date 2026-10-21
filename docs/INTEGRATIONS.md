# Intégrations Radiant et Jarvis

État au 20/10/2026 : les échanges respectent la base d'analyse DATA'A comme source de vérité. Les résultats produits à l'extérieur sont des propositions; ils ne modifient ni les réponses, ni la codification, ni le rapport.

## Radiant

Radiant est utilisé localement comme atelier exploratoire R/Shiny. DATA'A fournit un ZIP versionné depuis la base d'analyse, avec un CSV numérique, un dictionnaire, une empreinte SHA-256, un script R, un gabarit de retour et un guide. Les identifiants, coordonnées GPS, variables d'enquêteur, téléphones et champs texte ne sont pas exportés.

```powershell
uv run plateforme analyse radiant exporter <tableur> --dictionnaire <dictionnaire.yaml> --plan-terrain <plan_terrain.yaml> --plan-analyse <plan_analyse.yaml> --sortie <radiant.zip>
uv run plateforme analyse radiant retour --paquet <radiant.zip> --retour <retour_radiant.json> --sortie <proposition.json>
```

Le retour doit citer l'empreinte du paquet, les variables concernées, le résultat, le code R et les limites. Il est rejeté si le paquet a changé, si l'empreinte ne correspond pas ou si une variable n'appartient pas au dictionnaire exporté. Le retour accepté porte `a_valider`; la validation humaine et les règles de rapport DATA'A restent obligatoires. Le transfert vers Radiant se fait manuellement dans son interface; aucune API de synchronisation Radiant n'a été établie.

Radiant amont est sous AGPL-3.0 selon sa licence; ses fichiers d'aide portent une licence CC BY-NC-SA. DATA'A n'embarque ni ne modifie son code. L'utilisation commerciale de Radiant doit respecter les obligations de licence applicables et être validée juridiquement. Le paquet nécessite R et Radiant installés; l'exécution n'a pas été vérifiée sur ce poste faute de `Rscript`.

## Jarvis et le copilote DATA'A

Jarvis sert de référence d'architecture pour le copilote DATA'A : registre fermé d'outils, routage contrôlé, autorisations, journal d'audit et vérification par preuves. Ces principes sont réimplémentés nativement dans `backend/src/plateforme/assistant.py` et l'API DATA'A; aucun code source Jarvis n'est copié ou embarqué.

Le copilote DATA'A possède deux modes de rédaction. Sans modèle configuré, il répond avec ses gabarits déterministes. Avec `DATAA_OLLAMA_MODEL` configuré, il peut rédiger librement à partir du JSON de preuves agrégées, via Ollama strictement local (`127.0.0.1`, HTTP sans proxy). Le prompt interdit les faits externes, les outils et les mutations; les nombres de la réponse sont comparés aux nombres présents dans les preuves, sinon le texte généré est rejeté et le gabarit déterministe est conservé.

Les outils (`etat_etude`, `suivi_quotas`, `tri_plat`, `synthese`) restent en lecture seule; ils interrogent les projets visibles par l'utilisateur, citent les preuves, appliquent le seuil de base et le masquage des modalités rares. Les clients ne reçoivent que les analyses/recommandations validées. Les questions et le mode de rédaction sont audités. Une réponse ne valide ni ne publie automatiquement un résultat. Aucun enregistrement de données brutes ou de contacts n'est transmis au modèle.

Activation locale, après installation d'un modèle Ollama sur le poste serveur : définir `DATAA_OLLAMA_MODEL` avec son nom; `DATAA_OLLAMA_URL` peut remplacer `http://127.0.0.1:11434` uniquement par une adresse loopback; `DATAA_OLLAMA_TIMEOUT` règle le délai (1 à 120 s). Si le modèle n'est pas installé ou Ollama indisponible, DATA'A continue en mode déterministe.

Le chatbot ne modifie jamais une étude. L'intégration actuelle n'appelle que le service Ollama local; les modes cloud ne sont pas pris en charge. L'installation et l'exécution d'un modèle ne sont pas encore validées sur ce poste, où aucun modèle Ollama n'est téléchargé.

## Références métier V11

Les tests `test_conformite_v11.py`, `test_codification_oracle.py`, `test_rejeu_reel.py` et `test_rapport_oracle.py` vérifient l'alignement du dictionnaire, du masque, des codes, du rejeu et des chiffres du rapport sur l'oracle V11 et les références de l'étude. Le rapport et les tableaux restent produits depuis la base d'analyse reconstruite, pas depuis les sorties Radiant ou Jarvis.