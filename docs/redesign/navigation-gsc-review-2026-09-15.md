# D85 — Navigation, thèmes et maillage

Travail dans `codex/site-redesign`. Aucun déploiement ni changement en production.

## Décisions appliquées

- En-tête plus fin, typographie légère et menus à deux colonnes avec une zone de guides. Modèles, Exemples, Comparatifs, Outils, Assistants MCP, Tarifs.
- Logos réels pour les modèles et familles, deux marques pour les comparatifs, pictogrammes cohérents pour les outils et usages. Sora conserve son lien mais sans logo ; FLUX utilise un pictogramme, faute de marque graphique autorisée dans le registre de partenaires.
- Petits badges « Nouveau / New / Nuevo » sur les cinq modèles déjà sélectionnés pour ces badges. Ils restent pilotés par les données de navigation.
- Menu mobile en tiroir, accès vidéo/image/audio, sections dépliables, focus conservé, Escape et fermeture extérieure. Liens de menu sans préchargement des routes.
- Assistants devient un menu dédié : Claude, ChatGPT, Codex, OpenClaw et autres clients MCP, hub et documentation. Bloc visuel et colonne dédiés dans le footer.
- Blog n’est plus un onglet de premier niveau : accès explicite dans **Outils → Guides et ressources**, ainsi que dans le footer. Articles et routes conservés. Ce placement reste révisable lors de la revue utilisateur.
- Palette marketing fixe, toggle retiré. L’app démarre en sombre, conserve son contrôle d’apparence et mémorise le choix de l’utilisateur.

## Ce que montre GSC

Relevé en lecture seule le 15 septembre 2026 : propriété domaine maxvideoai.com, recherche Web, tous pays et appareils. Les extractions de tableaux sont partielles (premières pages/requêtes, tri par clics), pas un export exhaustif. Les chiffres agrégés sont ceux affichés par GSC et sont arrondis.

| Période | Clics | Impressions | CTR | Position moyenne |
|---|---:|---:|---:|---:|
| 13 juin – 12 septembre | 6,23 k | 432 k | 1,4 % | 11,1 |
| 16 août – 12 septembre (28 jours) | 1,76 k | 92,9 k | 1,9 % | 13,5 |

Ces périodes se chevauchent et n’ont pas la même durée : on ne peut pas en déduire une croissance ou une baisse causée par la refonte. La refonte n’est pas publiée.

### Pages à protéger et opportunités

| Page EN | Clics sur 3 mois | Impressions sur 3 mois | Décision |
|---|---:|---:|---|
| Accueil | 2 110 | 34 990 | Préserver l’intention vidéo IA à l’usage et les signaux SEO déjà contrôlés en D79 |
| Exemples LTX | 1 139 | 50 485 | Premier accès dans Exemples ; conserver l’historique des exemples et prompts |
| Exemples Kling | 190 | 17 431 | Accès principal conservé |
| Seedance 2.0 vs 2.0 Fast | 146 | 27 737 | Gardé dans le menu Comparatifs et le footer malgré les modèles plus récents |
| Exemples Seedance | 139 | 6 017 | Mettre en valeur 2.5 sans changer l’URL de famille |
| Outil Angle | 139 | 2 736 | Accès direct dans Outils et le footer |
| Veo 3.1 | 138 | 19 375 | Promotion conservée |
| Exemples Wan | 114 | 4 600 | Accès principal, Wan 3 et Prime visibles dans Modèles |
| Sora 2 | 73 | 6 828 | Pas de suppression de page ni de redirection liée à ce changement de menu |
| Exemples Sora | 58 | 3 576 | Lien secondaire dans Exemples et lien du footer conservés |
| GPT Image 2 | 54 | 4 112 | Découverte secondaire dans Modèles |
| Gemini Omni Flash vs Veo 3.1 | 44 | 17 319 | Gardé dans Comparatifs et le footer |
| MiniMax H3 | 36 | 1 460 | Promotion principale |
| Seedance 2.5 | 36 | 1 191 | Promotion principale |
| Happy Horse 1.1 | 33 | 2 756 | Accès direct dans Modèles et Exemples |

Sur les 28 derniers jours, MiniMax H3 reçoit **34 clics / 1 207 impressions** et Seedance 2.5 **31 / 809**. Le gros de leurs clics du trimestre est donc récent. LTX reste plus important en volume : **245 clics / 5 513 impressions** pour la galerie sur 28 jours. Le comparatif Gemini Omni Flash / Veo 3.1 reçoit **24 clics / 6 734 impressions** : occasion de travailler titre, extrait et pertinence de la réponse lors de sa prochaine passe, sans promettre de gain de CTR.

Requêtes visibles sur 28 jours : `seedance 2.5` (24 clics), `pay as you go ai video generator` (19), `minimax h3` (10), `minimax h3 max` (9), `seedance 2.5 examples` (7). Les anciennes requêtes LTX 2.3 attirent encore des clics (`ltx 2.3 prompt examples` : 13). Promouvoir 2.5 n’implique donc pas d’effacer les réponses utiles aux utilisateurs de 2.3.

Localisation : l’outil Angle ES reçoit 115 clics / 2 109 impressions sur trois mois, et l’article ES sur les fiches de personnage 67 / 1 694. Le contenu espagnol et le blog sont des entrées d’acquisition à conserver, pas de simples copies secondaires du site EN.

### MCP et ancres

Filtre GSC **URL contenant `/mcp`**, trois mois : **4 clics / 298 impressions**. Il couvre le hub et les pages de documentation localisées, pas les URL `/integrations/*`.

- `/mcp` : 2 clics / 193 impressions.
- `/docs/mcp` : 1 / 47.
- `/es/mcp` : 1 / 19.
- `/fr/mcp` : 0 / 25 ; `/es/docs/mcp` : 0 / 11 ; `/fr/docs/mcp` : 0 / 3.

MCP est ici une priorité produit avec un début de visibilité, pas encore un gros moteur de trafic. Le nouveau menu et le footer améliorent sa découverte. Aucun volume de recherche externe n’a été estimé.

Ancres selon la destination : **Connecter Claude**, **MaxVideoAI pour ChatGPT**, **Plugin MaxVideoAI pour Codex**, **OpenClaw et clients MCP**, **Documentation du serveur MCP**. Les descriptions du menu distinguent connecteur Claude, app ChatGPT et plugin Codex. La documentation actuelle d’OpenAI distingue les apps qui connectent les services des plugins qui les distribuent : ne pas remplacer automatiquement tous les termes par « plugin ». [Documentation OpenAI](https://help.openai.com/en/articles/11487775-connectors-in-chatgpt).

Pour la prochaine refonte MCP : garder le hub orienté bénéfices/création et compatibilité ; réserver installation/connexion à chaque page d’intégration ; garder authentification, outils et protocole dans les docs. Utiliser des liens descriptifs et des destinations réelles plutôt qu’une répétition de mots-clés. [Recommandations Google sur les liens](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

## Garde-fous SEO et techniques

Ce lot modifie la hiérarchie de découverte, pas les URL, canonicals, hreflang, H1, schémas de pages ou règles de publication du registre. Les modèles sortis du menu principal restent dans leurs hubs et leurs pages. Cela ne garantit pas une stabilité des positions : le poids des liens internes peut évoluer. Suivre les groupes Modèles, Exemples, Comparatifs, Blog, MCP et les locales après publication avec des périodes comparables.

Le thème utilise désormais une préférence propre à l’app, `mv-app-theme`, sombre par défaut. L’ancienne préférence partagée `mv-theme` n’est pas migrée ni supprimée. Le marketing n’écrit pas dans la préférence de l’app. Le script statique avant affichage et le hook app utilisent la même politique ; aucun cookie de requête n’est ajouté au rendu marketing. Les utilisateurs ayant un ancien choix devront le refaire une fois dans l’app.

## Vérification

- **89 tests ciblés réussis** : navigation, logos, publications P0/P1, thèmes et stockage bloqué, architecture, acquisition MCP, langues et hreflang.
- TypeScript sans erreur, lint frontend, contrôle d’exposition publique et `git diff --check` réussis.
- **51 contrôles HTTP réussis** : les trois accueils et 48 destinations de navigation, comprenant intégrations/MCP/docs, Blog et modèles/comparatifs promus en EN/FR/ES. Voir `qa/navigation-d85/routes.json`. Ce contrôle n’est pas un crawl exhaustif de toutes les pages.
- Trois accueils : une canonique, alternates EN/FR/ES/x-default, un H1 et cinq scripts JSON-LD chacun.
- Revue visuelle desktop 1280 px, petit desktop 1024 px et mobile 390 px. Menus Exemples/Comparatifs/Outils/Assistants, menu Modèles et footer contrôlés. Pas de débordement horizontal sur les surfaces contrôlées.
- Escape ferme et rend le focus au déclencheur ; Entrée et Tab ouvrent le menu puis atteignent le lien de hub. Contrôle manuel de chargement des logos visibles.
- App sombre → choix clair → marketing clair → retour app toujours clair → remise sombre → marketing toujours clair, vérifié dans le navigateur.
- Environnement local sans base de production : avertissements de données indisponibles attendus, exemples servis par la copie publique locale. Aucun rendu, achat ou modification de données de production.

Pas de nouvelle mesure CWV représentative : les compilations du serveur de développement ne mesurent pas la performance de production. Le contrôle mobile en build production demandé en D79 reste nécessaire avant publication. Aucun gain de référencement ou de performance n’est revendiqué pour ce lot.
