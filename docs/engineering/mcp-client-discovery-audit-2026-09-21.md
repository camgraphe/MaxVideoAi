# MaxVideoAI : découverte et continuité chez le client

Audit du 21 septembre 2026. Périmètre : incident Codex « Adapter le prompt vidéo viral », plugin local 0.3.5, sources du dépôt et documentation officielle consultée ce jour. Les observations sur ce Mac ne constituent pas une certification de tous les clients. Les changements préparés restent non publiés.

Ce document conserve les mesures initiales. Les modifications réalisées ensuite,
leurs propriétaires et les contrôles de non-régression sont décrits dans le
[guide de l'expérience MCP](mcp-client-experience.md).

## Conclusion

L'incident observé est une perte d'authentification MCP accompagnée d'un diagnostic trop tardif par l'assistant. Le skill était présent et avait été explicitement sélectionné. Il faut améliorer séparément la sélection spontanée, la visibilité des outils, la continuité OAuth et l'explication des pannes.

Un plugin installé peut être proposé implicitement, mais aucun contrat MCP ne garantit qu'un assistant le choisira à chaque mention de vidéo. L'objectif mesurable est une bonne sélection sur les demandes pertinentes, avec une reconnexion compréhensible quand nécessaire. Le protocole laisse le choix d'interface au client. [MCP : outils](https://modelcontextprotocol.io/specification/2026-07-28/server/tools).

## Preuves de l'incident

- Tâche examinée : `01a0c596-8bb3-7783-a155-71a8c2c8d0ea`, « Adapter le prompt vidéo viral ».
- L'assistant annonçait déjà utiliser le skill MaxVideoAI pour préparer les devis. Ce cas ne démontre donc pas un échec de sélection implicite.
- Le journal Codex indique à `2026-09-21T20:09:35.107Z` : serveur `maxvideoai`, état `failed`, raison `reauthenticationRequired`. Il recommande `codex mcp login maxvideoai`.
- Le plugin 0.3.5 est activé ; ses deux skills déclarent `allow_implicit_invocation: true` et leur dépendance au serveur `maxvideoai`.
- Le shell résout `codex` vers `/opt/homebrew/bin/codex`, version **0.46.0**. Le binaire de l'application utilisée est **0.155.0-alpha.9.2**. La première tentative avec l'ancien CLI échouait sur une option expérimentale ; la tâche a ensuite réussi la reconnexion avec le binaire embarqué.
- La tâche a rapporté `Successfully logged in to MCP server 'maxvideoai'`, puis le retour des outils. Cet audit voit également 14 outils MaxVideoAI dans son inventaire disponible. Aucune génération n'a été lancée par cet audit.
- Une requête `initialize` anonyme sur la production retourne **HTTP 401** avec `WWW-Authenticate` et l'URL de découverte de la ressource protégée. Le code authentifie la requête avant de créer le serveur MCP.

La cause qui a rendu la reconnexion nécessaire reste indéterminée : expiration, révocation, renouvellement refusé, état local ou autre incident ne peuvent pas être départagés avec ces éléments. Ne pas présenter « token expiré » ou « bug Supabase » comme un diagnostic établi. Ne pas reproduire de jetons, d'URL OAuth temporaires ou de données de compte dans les preuves.

## Bonnes pratiques confrontées au produit

| Sujet | Constat MaxVideoAI | Action recommandée |
| --- | --- | --- |
| Sélection des skills | Activation implicite déjà autorisée. Dans ce contexte très chargé, la description de génération apparaissait sous la forme « Execute a concrete AI v… ». | Placer l'action et le média dès les premiers mots. Employer les usages réels : animation d'image, Short, Reel, publicité. Garder les exclusions et le respect d'un outil explicitement choisi. |
| Outils différés | Des outils peuvent exister sans figurer dans la liste immédiatement affichée au modèle. | Consulter la découverte disponible ; distinguer outils, ressources et connexion. Ne pas déduire l'absence du plugin d'une liste de ressources vide. |
| Instructions du serveur | Le bloc construit localement pour vidéo/image mesure **9 539 octets UTF-8**. `prepare_generation` commence à l'index 7 009 et `confirm_generation` à 7 592. | Préparer un bloc court, idéalement inférieur à 2 Ko, commençant par la finalité, les outils d'entrée, le devis et la confirmation. Déplacer les détails dans les descriptions et résultats pertinents, sans perdre les contraintes contractuelles. |
| Représentation côté Codex | Les descriptions exposées à cet agent font environ 10–12,5 k caractères chacune, déclaration d'outil comprise, avec un long préambule commun. Les descriptions originales dans les fichiers d'outils sont plus courtes. | Mesurer séparément le `tools/list` brut, `initialize.instructions` et la représentation injectée par chaque hôte. Ne pas attribuer toute cette duplication au serveur. |
| Authentification | La protection globale bloque également l'initialisation anonyme. Ce choix est valide, mais rend toute découverte MCP dépendante de la connexion. | Priorité immédiate : fiabiliser renouvellement et reconnexion. Étudier ensuite un catalogue public minimal, avec authentification maintenue pour compte, médias, devis et génération. |
| Contrats des outils | Outils spécialisés, schémas stricts, annotations de risque, résultats structurés et limites existent déjà. | Préserver ces acquis ; compléter seulement les lacunes confirmées par tests, notamment les schémas de sortie et les métadonnées spécifiques aux hôtes. |
| Évaluations | Le scorecard précise que ses décisions sont des attentes hors ligne et que les métriques réelles Codex/Claude sont nulles. | Ajouter des essais dans les vrais hôtes, avec demandes sans nom de marque et environnement chargé. Un test de texte ne prouve pas le comportement d'un modèle. |
| Distribution | Installation documentée sur un tag précis 0.3.5 ; cache installé distinct des sources du dépôt. | Publier une version révisée via le workflow de release, puis vérifier sa prise en compte chez le client. Une modification du dépôt ne met pas à jour les installations existantes. |

OpenAI explique que la liste initiale des skills est budgétée et que les descriptions peuvent être raccourcies, voire certains skills omis dans de très grands ensembles. Les premiers mots doivent exprimer l'usage ; l'activation implicite reste un choix de l'hôte. [Construction des skills](https://learn.chatgpt.com/docs/build-skills).

Claude Code documente le chargement différé des outils et une troncature à **2 Ko** des descriptions et instructions serveur. Il recommande que les instructions expliquent la catégorie, les circonstances de recherche et les capacités. Cela justifie le travail sur notre bloc de 9,5 Ko ; cela ne prouve pas que la troncature a causé l'incident Codex. [MCP dans Claude Code](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search).

OpenAI recommande des descriptions discriminantes, des paramètres documentés et un jeu de prompts directs, indirects et négatifs. Mesurer précision et rappel, puis changer les métadonnées progressivement permet d'attribuer les gains. [Optimisation des métadonnées](https://developers.openai.com/plugins/guides/optimize-metadata).

Anthropic recommande des outils compréhensibles, des entrées et sorties non ambiguës, des réponses ciblées et des erreurs qui indiquent comment poursuivre. Nos résultats doivent permettre à l'assistant de conserver le brief et de reprendre, plutôt que demander de tout recommencer. [Conception des outils](https://www.anthropic.com/engineering/writing-tools-for-agents).

## Authentification : décision d'architecture à évaluer

Le guide MCP Apps distingue protection de tout le serveur et protection par outil. Un accès public limité peut conserver une découverte utile quand le compte est déconnecté ; chaque opération privée reste protégée. Ce serait une évolution d'architecture avec tests d'isolation, pas une suppression de la vérification actuelle. [Autorisation MCP Apps](https://apps.extensions.modelcontextprotocol.io/api/documents/authorization.html).

La spécification OAuth MCP définit notamment la découverte, les challenges et la limitation des nouvelles tentatives d'autorisation. Les règles doivent être vérifiées contre la version négociée par chaque hôte ; ne pas imposer aveuglément les nouveautés du protocole 2026-07-28 à un ancien client. [Autorisation MCP](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

OpenAI documente aussi les déclarations `securitySchemes` par outil et un mécanisme `_meta["mcp/www_authenticate"]` pour son interface OAuth. Ces indications sont propres à l'intégration hôte ; elles ne remplacent pas les contrôles HTTP et serveur. Leur nécessité doit être testée dans notre parcours exact. Le même guide recommande des tests avec jetons courts, refus et expiration. [Authentification OpenAI](https://developers.openai.com/plugins/build/auth).

Le prochain diagnostic OAuth doit corréler, sans secrets, hôte/version, heure, échec de renouvellement, réponse de l'autorité et reconnexion. Tester fermeture/réouverture, veille, sessions parallèles, changement de compte et révocation dans un compte de test. Une révocation légitime doit continuer de bloquer l'accès.

## Protocole de validation chez le client

Tester séparément Codex Desktop, Codex CLI, Claude Code, Claude Desktop et ChatGPT selon les parcours autorisés. Noter version de l'hôte, modèle, package, outils réellement chargés et mode d'authentification. Aucun succès ne se transfère automatiquement à un hôte voisin.

Pour chaque hôte, combiner une installation peu chargée et une installation avec de nombreux plugins concurrents, une conversation neuve et une conversation longue, puis connexion valide, connexion absente et renouvellement nécessaire. Faire au moins trois répétitions indépendantes des demandes implicites ; publier les nombres bruts en plus des pourcentages.

| Demande ou scénario | Résultat attendu |
| --- | --- |
| « Crée une vidéo verticale pour présenter ce produit, propose un modèle, sans rien dépenser. » | Découverte du plugin et outils de conseil adaptés ; aucune confirmation payante. |
| « Anime cette photo pour un Reel ; prépare seulement le devis. » | Lecture des capacités, import privé si nécessaire, devis quand complet ; aucune génération. |
| « Je veux un Short YouTube réaliste, quel modèle choisir ? » | Skill de planification et données actuelles, sans prétendre garantir la viralité. |
| Même brief en anglais et espagnol, sans MaxVideoAI dans le texte | Vérifier la sélection implicite dans chaque langue. |
| « Avec MaxVideoAI, prépare les deux devis avec les modèles choisis. » | Invocation explicite reconnue, pas de nouvelle sélection inutile ; conserver les choix pendant une reconnexion. |
| « Réécris seulement ce paragraphe. » | Aucun outil vidéo. |
| « Analyse les statistiques YouTube de ma chaîne. » | Ne pas détourner la demande vers la génération. |
| « Utilise exclusivement cet autre outil vidéo. » | Respecter le choix ; ne pas forcer MaxVideoAI. |
| Plugin présent, outils différés | Recherche des outils avant de conclure à leur absence. |
| Plugin présent, OAuth rejeté | Explication de la connexion, reprise du brief après autorisation ; pas de réinstallation injustifiée. |
| Réponse perdue après soumission | Recherche du job existant ; aucun second débit. |
| Connexion révoquée | Accès privé refusé ; aucune récupération d'identité de substitution. |

Mesures proposées : sélection pertinente, premier outil utile, nombre de questions évitables, temps jusqu'à la première réponse utile, réussite de reconnexion, conservation des paramètres et absence de double soumission. Objectifs de release proposés : au moins 90 % de sélection implicite sur les cas pertinents, 100 % sur les invocations explicites quand la connexion fonctionne, zéro génération sans approbation et zéro accès après révocation. Ce sont des objectifs, pas des résultats obtenus.

OpenAI recommande de tester d'abord le serveur, puis le package installé complet. Après modification, vérifier les métadonnées réellement reçues et rejouer les scénarios dans une nouvelle conversation. Les règles de mise à jour diffèrent entre connexion de développement et plugin publié. [Test du plugin complet](https://developers.openai.com/plugins/deploy/connect-chatgpt).

## Changements préparés et ordre de suite

1. **Préparé localement :** première phrase de génération plus explicite ; usages sociaux dans les deux descriptions ; procédure de découverte/reconnexion dans les deux skills ; explication dans le guide Codex. Activation implicite et règles d'approbation conservées.
2. **Prochaine priorité :** refonte courte des instructions MCP avec revue des contrats, règles essentielles dans les premiers 2 Ko, puis comparaison des sorties brutes et injectées. Ne pas simplement couper le texte existant.
3. **En parallèle fonctionnel :** protocole de continuité OAuth et diagnostic précis de l'incident. Le correctif documentaire ne répare pas un éventuel défaut de renouvellement.
4. **Avant release :** tests réels de découverte et reprise, vérification du package et de sa mise à jour. Ne pas modifier le cache installé à la main ni promettre une recommandation systématique.
5. **Évolution à étudier :** découverte et catalogue publics minimaux avec autorisation privée par outil. Maintenir l'isolation des comptes, des références, des devis et des crédits.

## Vérification de cette préparation

Les 11 contrats du plugin passent, y compris les validateurs de skills et de package. Le validateur Python appelé seul manquait de PyYAML ; le contrat de dépôt utilise son environnement disponible et valide les fichiers avec succès.

L'évaluateur de sélection détectait correctement que le texte des skills avait changé. La comparaison en mémoire avec les deux fichiers de `HEAD` retrouve exactement son ancienne empreinte : seule cette préparation explique ce changement de fingerprint. L'empreinte est actualisée sans modifier les décisions attendues ni leurs dénominateurs. Cela reste une vérification hors ligne, pas une nouvelle mesure de sélection dans Codex ou Claude.

Résultat final : 26 tests ciblés réussis (11 contrats du plugin, 15 tests de corpus et d'évaluation), commande `qa:mcp-tool-selection` réussie, contrôle d'exposition publique et `git diff --check` réussis. Aucun changement de code frontend, de configuration OAuth, de cache installé ou de publication n'a été effectué.
