# Studio conversationnel — prototype local

Une app locale complète, isolée du Studio de production : chat, références image/vidéo/audio, médias autour de la conversation, petit moniteur, montage, voix/ambiance et rendus MP4/MP3.

## Lancer

Dans ce dossier (`experiments/studio-conversation/prototype`) :

```sh
npm ci
npm run dev
```

Ouvrir **http://127.0.0.1:4318** dans l’aperçu Codex ou un navigateur autorisant les pages locales. Node 22.12+ et FFmpeg/ffprobe doivent être dans PATH. La voix utilise la voix française Thomas déjà installée via `/usr/bin/say` sur macOS. Sans cette voix, sa tâche affiche un échec réessayable ; images, vidéos, imports et exports restent utilisables.

`STUDIO_LOCAL_PORT` change le port ; `STUDIO_LOCAL_DATA` change le dossier de données. Ne pas lancer deux serveurs sur le même dossier. Par défaut, `.data/` contient les projets et leurs médias, est ignoré par Git et doit être conservé pour retrouver les créations. Arrêter le serveur avec Ctrl+C.

### Connecter GPT‑6.1 Sol

Copier `.env.example` vers `.env.local`, puis renseigner `STUDIO_OPENAI_API_KEY` **côté serveur**. Le fichier est ignoré par Git ; ne jamais préfixer une clé par `VITE_`. Une clé `OPENAI_API_KEY` existante convient également. Pour utiliser un fichier déjà configuré, lancer :

```sh
STUDIO_ENV_FILE="/chemin/vers/.env.local" STUDIO_ASSISTANT=openai npm run dev
```

Studio utilise l’API Responses avec `gpt-6.1-sol`, raisonnement `medium`, schémas stricts, une action à la fois, 6 000 tokens de sortie maximum par appel et jusqu’à dix tours avec outils, puis un dernier appel sans outil. Ces appels utilisent la facturation API OpenAI du compte configuré. Le client voit le chat Studio et ne fournit aucune clé. Sans clé, le mode par défaut reste la démonstration hors ligne ; `STUDIO_ASSISTANT=demo` l’impose explicitement. En mode `openai`, une panne ou un refus de clé affiche une erreur et un bouton de reprise, sans basculer vers un dialogue simulé.

Le vrai directeur peut proposer une direction, régler le projet, rechercher/adopter les médias de la bibliothèque locale, couper/réordonner/assembler, gérer le son et lancer les tâches locales ou le rendu. Par exemple : « Cherche linen.jpg · animé dans la bibliothèque, ajoute-la au montage et garde ses dix premières secondes. » Joindre une image ou une vidéo avec le + lui transmet l’aperçu image ou le poster, avec les métadonnées du projet. Les audios sont des métadonnées : cette étape ne comprend pas de transcription ni d’analyse du flux vidéo.

Les messages, propositions avant action et résultats sont sauvegardés. Le serveur relit l’état canonique à chaque appel ; un geste manuel intervenu entre-temps provoque un conflit de révision, sans être écrasé. Un journal serveur distinct conserve les appels d’outils, résultats et consommation API du tour courant pour reprendre après interruption, sans répéter les actions. Il n’est pas livré par l’API projet ni par Vite. Un échange continue si l’onglet ferme ; après redémarrage du serveur, sa reprise se fait par bouton, sans appels API automatiques.

Une demande complète peut enchaîner création locale → attente de la sortie → insertion → rendu dans le même échange. L’attente observe le worker sans polling du modèle et reste bornée à 60 secondes par tâche. Au-delà, le bot indique le travail en cours ; une demande ultérieure peut utiliser sa sortie. Un geste manuel pendant l’attente bloque la suite automatique d’édition/rendu du tour. Les huit références acceptées sont toutes transmises, avec un plafond de 8 Mo par aperçu et 24 Mo au total.

## Essayer

1. Dans le chat, cliquer « Un film parfum, lumineux et sensoriel ». Trois images et trois animations locales arrivent, puis le montage se construit si vous ne l’avez pas modifié entre-temps.
2. Cliquer un plan pour ouvrir le petit moniteur. Régler sa coupe début/fin, le déplacer avec les flèches ou le glisser sur un autre plan. Les audios ont une position et un volume.
3. Demander `Crée une voix : « La lumière a un parfum. »` ou `Crée une ambiance sonore de 60 secondes`. Le lecteur apparaît dans le chat ; le bouton + ajoute le son au montage.
4. Ouvrir la bibliothèque avec le + de la conversation : images, vidéos et audios de tous vos projets locaux, recherche et filtres. Choisir Référence pour joindre un média au message, ou Importer pour choisir des fichiers. La bibliothèque offre aussi aperçu, animation, insertion/remplacement et téléchargement de l’original. La réutilisation conserve les médias et montages du projet d’origine ; la bibliothèque du compte MaxVideoAI reste à brancher lors de l’intégration dans l’app.
5. Exporter depuis le montage. Une tâche réelle produit le MP4, ou un MP3 pour une création sonore sans vidéo, avec son lecteur et téléchargement dans la conversation.
6. Recharger ou redémarrer : les projets, conversations, médias, montages et tâches restent sauvegardés. Une exportation déjà lancée conserve son snapshot même si les paramètres changent ensuite.

Le bouton apparence près des paramètres propose deux modes : **Charbon** pour le sombre (neutre/champagne, par défaut) et **Olive** pour le clair (ivoire avec accents olive). Le choix reste mémorisé dans ce navigateur. Il change les surfaces du Studio, pas les images ni les fichiers rendus.

Si un son continue après le dernier plan, la dernière image est tenue jusqu’à la fin, dans l’aperçu et dans le rendu. La durée cible guide la génération de démonstration ; ce sont les éléments du montage qui déterminent la durée finale.

## Ce qui est simulé

En mode `demo`, le directeur est un interpréteur d’intentions français/anglais. En mode `openai`, le dialogue et le choix des outils sont réellement pilotés par Sol. Dans les deux modes, la création d’images reprend les trois visuels parfum de démonstration ; le prompt et les références ne conditionnent pas une nouvelle génération. Les animations sont des mouvements de caméra FFmpeg sur les images. La voix, l’ambiance synthétique, les imports, la coupe, l’assemblage et les exports sont réels. Aucun fournisseur de génération média payante ni compte/base de production n’est connecté.

Les images, vidéos et audios acceptés par le Studio actuel sont pris en charge. SVG, HTML, PDF/documents, médias distants et sources de plus de 100 Mo sont exclus de ce prototype. Sources temporelles : 1 seconde à 10 minutes ; animation locale : 1–30 secondes ; 12 plans vidéo et 36 éléments au total.

## MCP local

Endpoint JSON-RPC **http://127.0.0.1:4318/mcp**, HTTP POST avec réponses JSON. `initialize`, `ping`, `tools/list` et `tools/call`, sans abonnement/session. Outils :

- `studio_list_projects`, `studio_create_project`, `studio_get_project`
- `studio_trim_clip`, `studio_move_clip`
- `studio_command` pour les autres commandes partagées : paramètres, insertion, remplacement, suppression, assemblage, volume, undo/redo, images, animation, voix, ambiance, export, annulation/reprise de tâche.
- `studio_project`, `studio_library`, `studio_use_media`, `studio_edit`, `studio_generate`, `studio_render`, `studio_wait`, `studio_job` exposent le même catalogue strict que Sol. Ajouter `projectId` et `requestId` aux arguments présentés par la découverte ; `studio_edit` exige aussi `expectedRevision`. `studio_wait` reçoit un `jobId` possédé et ne relance aucun traitement.

Lire le projet avant une édition. `inFrame`, `outFrame` (exclusif) et `startFrame` sont des entiers au fps du projet ; coupe minimale 1 seconde. Toute édition nécessite `expectedRevision`. `requestId` reste identique sur une reprise ; changer le contenu exige un nouvel ID. Une tâche reste asynchrone : consulter le projet jusqu’à son état `ready`, `failed` ou `cancelled`.

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"studio_trim_clip","arguments":{"projectId":"UUID","clipId":"UUID","requestId":"cut-1","expectedRevision":3,"inFrame":24,"outFrame":144}}}
```

Ce MCP est propre à l’expérience locale. Le MCP MaxVideoAI publié et les routes Studio restent inchangés.

## Vérifier

```sh
npm test
npm run build
```

Pour une évaluation **réelle et payante de Sol**, séparée des projets du serveur :

```sh
STUDIO_ENV_FILE="/chemin/vers/.env.local" npm run eval:live -- --live
```

Le runner refuse de démarrer sans `--live`. Il exécute huit scénarios, conserve les rapports/projets dans `.data/evaluations/`, et borne les appels à 45 avec arrêt avant un nouvel appel si le total observé atteint 250 000 tokens. Ce dernier seuil n’est pas un plafond monétaire strict : un appel peut le dépasser. Il n’utilise aucun fournisseur média payant ni compte/base de production. Lire `../design/sol-evaluation-2026-10-01.md` pour les résultats, limites et mesures ; le plan de raccord au produit se trouve dans `docs/engineering/studio-conversation-integration.md` à la racine.

Les tests exercent les sources/coupes, undo/redo, fps, pistes audio, persistance, conflits, idempotence, jobs, directeurs et MCP, isolation entre projets, bibliothèque globale et réutilisation, imports réels, Range, rendus FFmpeg et contraste des deux modes. Les nouveaux tests IA remplacent uniquement l’API externe par des réponses contrôlées : ils vérifient les vraies mutations, la reprise après une coupe enregistrée, les propositions publiques, un redémarrage au milieu d’une écriture, les conflits, les références possédées, les réponses incomplètes et la confidentialité des fichiers serveur. Ils ne mesurent pas la qualité créative de Sol ; elle demande des briefs réels dans le navigateur. Le guide d’architecture et le relevé de fidélité se trouvent dans `docs/engineering/studio-conversation-prototype.md` et `../design/fidelity-ledger.md` à la racine du dépôt.

Pour la vérification dans un navigateur, utiliser un projet distinct : état vide → paramètres → brief → import image/vidéo/audio → coupe et déplacement → remplacement → voix/ambiance → volume/position avec annulation → arrêt/reprise d’une tâche → export vidéo et audio seul → recharge. Vérifier aussi le repli du moniteur, le défilement du montage et les palettes au clavier et à 320/390 px. Ces gestes complètent les tests serveur ; ils ne sont pas automatisés par la commande `npm test`.
