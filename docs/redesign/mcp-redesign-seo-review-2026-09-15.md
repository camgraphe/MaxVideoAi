# D86 — MCP : refonte du parcours et analyse SEO/GEO

15 septembre 2026. Travail local dans `codex/site-redesign`. Aucun push, merge ni déploiement.

## Ce qui est refait

Le hub `/mcp` et les cinq guides Claude, ChatGPT, Codex, OpenClaw et n8n ont une nouvelle présentation commune en anglais, français et espagnol : héros courts illustrés, étapes interactives, cartes avec les logos, preuve réelle, connexion guidée, autorisation expliquée et questions dépliables. Les trois documents `/docs/mcp` sont actualisés. Menu, footer et texte de découverte `llms.txt` pointent vers les cinq intégrations.

Le parcours distingue la création dans un assistant et l’automatisation : n8n a une illustration en nœuds et une configuration manuelle. Les instructions à copier ne déclenchent pas une installation ni une autorisation. Le bouton de copie de l’adresse est directement visible et annonce son résultat après résolution du presse-papiers.

L’illustration du héros est explicitement nommée « Parcours illustré ». Elle ne représente ni une nouvelle capture de Claude ni une vidéo effectivement générée par l’intégration. Les photographies sont des illustrations existantes du site. La capture de Claude Desktop est séparée, complète et accompagnée de sa légende : son prix de 0,95 $ est historique, pas un devis actuel. Elle n’est pas recyclée comme preuve ChatGPT, Codex, OpenClaw ou n8n.

Les onglets Décrire / Choisir / Créer sont utilisables au clavier ; l’animation est limitée et désactivée avec la préférence de mouvement réduit. Aucun lecteur vidéo ni téléchargement vidéo automatique n’est ajouté. Les images secondaires sont chargées à la demande. Le hub abandonne le classement tarifaire qui remontait Pika ainsi que la lecture de preuve dynamique devenue inutilisée ; les liens mènent aux exemples, aux comparatifs et aux tarifs actuels.

## Alignement avec les derniers changements de main

Référence examinée : `origin/main` à `faa71e09899f80ee20cf9b2013c23d77a49d0600`.

- [PR 295](https://github.com/camgraphe/MaxVideoAi/pull/295) : registre d’intégrations, nouveaux hôtes et garanties du parcours OAuth.
- [PR 296](https://github.com/camgraphe/MaxVideoAi/pull/296) : publication des périmètres OpenClaw et n8n ; elle prime sur leur statut de préversion de la PR précédente.
- [PR 297](https://github.com/camgraphe/MaxVideoAi/pull/297) : fermeture du contrôle de propriété Glama et état final des soumissions.

La fondation publique utile est reprise : registre, accès typés, routes explicites et localisées, compatibilité, logos, publication, attribution, sitemap et données des guides. Les propriétaires actuels du routage et de la facturation sont conservés. Les changements serveur OAuth, les migrations et les autres travaux de main ne sont pas fusionnés dans cette branche par cette passe.

| Intégration | Présentation retenue | Limite conservée |
| --- | --- | --- |
| Claude | Connecteur MCP personnalisé | Claude Desktop vérifié ; Claude Code reste un hôte non vérifié séparément. |
| ChatGPT | App MCP personnalisée en mode développeur | MCP complet réservé aux espaces Business / Enterprise / Edu éligibles ; Pro limité à la lecture/récupération. Aucun répertoire public revendiqué. |
| Codex | Plugin MaxVideoAI 0.3.3 + MCP | Vérification Codex CLI ; aucune présence dans un store déduite de cette vérification. |
| OpenClaw | MCP direct et skill ClawHub | Testé avec limites ; références privées, pièces jointes et rendu intégré par canal non vérifiés. |
| n8n | Workflow MCP Client auto-hébergé | Version 2.38.7, configuration manuelle, approbation explicite. Ni n8n Cloud, ni appel AI Agent, ni modèle public de workflow revendiqué. |

Cursor, GitHub Copilot, Gemini CLI et Microsoft Copilot sont affichés « En préparation », sans lien vers une route inexistante. Le registre reste propriétaire des états, pas les composants graphiques. Le lien ClawHub provient du relevé de publication de main ; il n’a pas été revalidé dans un compte ClawHub pendant cette passe.

## Recherche de vocabulaire et intentions

Recherche qualitative de pages de résultats et de sources primaires. Aucun outil de volume de mots-clés ni série Google Trends exploitable n’a fourni de chiffres : les expressions ci-dessous sont des cibles d’intention, **pas des volumes ou des tendances chiffrées établis**.

Les marchés utilisent plusieurs termes pour une même famille d’accès. [Higgsfield](https://higgsfield.ai/mcp) emploie MCP et plugin pour la génération visuelle. [Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) documente les connecteurs personnalisés. [OpenAI](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) documente les apps MCP en mode développeur et leurs restrictions de plan. Ce vocabulaire motive des pages spécifiques, au lieu d’appeler chaque accès « plugin ».

| Page | Intention anglaise | Français | Espagnol LATAM |
| --- | --- | --- | --- |
| `/mcp` | AI video MCP, AI video assistant integration | vidéo IA MCP, générer des vidéos depuis un assistant | video con IA por MCP, integración de video con IA |
| Claude | Claude AI video connector, Claude video generation | connecteur vidéo IA Claude, créer une vidéo avec Claude | conector de video con IA para Claude |
| ChatGPT | ChatGPT AI video MCP app, video plugin setup | vidéo IA dans ChatGPT, app MCP ChatGPT, plugin vidéo ChatGPT | video con IA en ChatGPT, app MCP ChatGPT |
| Codex | Codex AI video plugin, video assets for a website | plugin vidéo IA Codex, créer des vidéos avec Codex | plugin de video con IA para Codex |
| OpenClaw | OpenClaw AI video skill, OpenClaw MCP | skill vidéo IA OpenClaw, MCP OpenClaw | skill de video con IA para OpenClaw |
| n8n | n8n AI video automation, approval workflow | automatisation vidéo IA n8n, workflow vidéo avec validation | automatización de video con IA en n8n |
| Documentation | MCP server setup, OAuth, exact quote approval | configurer un serveur MCP vidéo, autoriser son compte | configurar MCP, OAuth, aprobar el precio exacto |

La question « plugin ChatGPT » est traitée sans faire croire à une fiche disponible dans le répertoire. Les thèmes connexion, compte, prix, références, bibliothèque et révocation ont des réponses autonomes, lisibles dans le HTML serveur.

## Changements par rapport à la production

Sept pages de production ont été lues : hub EN/FR et les cinq guides EN. Leur état est conservé dans `qa/mcp-d86/production-baseline.json`.

| Signal | Production examinée | Refonte |
| --- | --- | --- |
| Titre du hub EN | MaxVideoAI for Claude, ChatGPT & Codex · AI Video | AI Video MCP: Claude, ChatGPT, Codex & n8n · MaxVideoAI |
| H1 du hub EN | Create AI videos from your assistant or automations. | AI video. In your assistant. |
| H1 du hub FR | Créez vos vidéos IA depuis votre assistant ou vos automatisations. | La vidéo IA. Dans votre assistant. |
| H1 Claude | Create AI video with MaxVideoAI in Claude | Create AI videos with Claude. |
| H1 Codex | Create AI video with MaxVideoAI in Codex | Create AI videos with Codex. |
| H1 OpenClaw | Produce AI video from OpenClaw with MaxVideoAI | AI video. Powered by OpenClaw. |
| H1 n8n | Design repeatable AI video workflows in n8n with MaxVideoAI | Automate AI video with n8n. |
| URL, canonical et langues | Routes publiques existantes | Conservées ; aucune migration d’URL. |
| Maillage | Cinq guides publiés, menu local encore sur trois guides + hub | Cinq accès contextualisés dans le menu, le footer, le hub et les guides. |
| Preuve | Capture réelle Claude et longues explications | Capture conservée et qualifiée, séparée de l’illustration. |

Le H1 du hub est plus court. L’intention « automatisation » reste explicite dans la section de choix, la carte n8n, le guide n8n, les métadonnées et la documentation. Il n’est pas utile de forcer tous les noms de clients dans le H1. Les noms et le type d’installation sont présents dans les titres de pages, les cartes, les ancres et le texte explicatif.

Les gains visés sont une meilleure compréhension, moins de répétitions, un accès plus direct à l’installation et une couverture plus précise des intentions par client. Un gain de positions ou de trafic ne peut pas être garanti avant indexation et mesure. Le risque principal est le changement simultané des titres, du H1 et du texte : il faudra comparer les résultats après publication, même si les routes restent stables. Le DR n’annule pas ce risque.

## GEO et données structurées

Selon [Google Search Central](https://developers.google.com/search/docs/appearance/ai-features), les fondements SEO restent applicables aux fonctionnalités IA ; aucun balisage spécial ni nouveau fichier IA n’est nécessaire. Cette passe privilégie les informations accessibles, le maillage et la correspondance entre promesse et disponibilité réelle.

Les schémas existants sont conservés : BreadcrumbList, WebApplication lorsque ses conditions sont réunies, puis Organization et WebSite du site. ChatGPT conserve son absence conditionnelle de WebApplication. Aucun faux avis, Offer, HowTo ou FAQPage commercial n’est ajouté. Le texte `llms.txt` existant est mis à jour pour sa cohérence avec les nouveaux liens, sans lui attribuer un effet de classement démontré.

## Validation

- 21 routes locales : réponses HTTP 200, un seul H1, canonical exact, alternates EN/FR/ES/x-default, robots index/follow, JSON-LD analysable.
- 24 destinations internes supplémentaires : HTTP 200. Les liens compte/connexion protégés ne sont pas utilisés comme test d’authentification.
- 73 tests ciblés : registre, socle public, routes, publication, preuves, attribution, contenu et interactions. Le test de découverte du sitemap ignore le manifeste partiel du serveur de développement et contrôle les vraies routes source.
- TypeScript avec types de routes générés hors serveur de développement ; lint frontend, exposition publique et `git diff --check`.
- Revue navigateur : desktop, mobile 390 px et 320 px ; copie d’adresse avec message de succès, onglets au clic et au clavier, FAQ exclusive ouverte avec contraste lisible, images chargées et absence de débordement. À 320 px, l’accès à la connexion passe par le menu mobile pour ne pas déborder du header.
- Un cache Next local corrompu a causé une série intermédiaire de réponses 500. L’aperçu a été remis au propre puis les contrôles HTTP repris. Ne pas lancer `next typegen` pendant que le même dossier `.next` est utilisé par `next dev`.

Les preuves de recette sont dans `docs/redesign/qa/mcp-d86/`. Les mesures de performance en build production et les Core Web Vitals comparables restent à faire avant mise en ligne : aucun gain de performance mesuré n’est revendiqué sur la base de ce serveur de développement.

## Avant publication et mesure

Intégrer les changements de main encore absents de la branche, résoudre les conflits sur les propriétaires MCP partagés, puis refaire la recette avec l’environnement de préproduction approprié. Cette passe ne teste ni un nouvel accord OAuth réel, ni un paiement, ni une génération facturée. Vérifier aussi l’état des offres ChatGPT et du catalogue n8n au moment de publier : ces données peuvent évoluer.

Dans GSC, suivre séparément les pages `/mcp`, `/integrations/*`, leurs versions localisées et `/docs/mcp`. Comparer fenêtres de 28 jours à date de publication : impressions, clics, CTR, positions, requêtes par client. Dans l’analytics existant, observer les passages hub → guide → action de configuration ; une copie ou un clic ne doit jamais être appelé « connexion réussie ». Garder une annotation de lancement pour ne pas confondre hausse de la demande du marché et effet de la refonte.


## Correction D87 — Panneaux ouverts

Retour précisé par Adrien : les marges latérales du panneau blanc étaient insuffisantes. La règle générale `details[open]` donnait une surface claire sans espace adapté. Chaque guide possède désormais son fond ivoire et ses espacements (32 px desktop, 20 px mobile) ; les accordéons imbriqués restent transparents. Débordements mobiles des commandes et du visuel OpenClaw corrigés. Recette visuelle OpenClaw à 320 px, ChatGPT et OpenClaw sur desktop ; aucune modification de route, de métadonnées ou du fonctionnement de connexion dans D87.
