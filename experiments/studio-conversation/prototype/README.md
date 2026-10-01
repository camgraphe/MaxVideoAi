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

## Essayer

1. Dans le chat, cliquer « Un film parfum, lumineux et sensoriel ». Trois images et trois animations locales arrivent, puis le montage se construit si vous ne l’avez pas modifié entre-temps.
2. Cliquer un plan pour ouvrir le petit moniteur. Régler sa coupe début/fin, le déplacer avec les flèches ou le glisser sur un autre plan. Les audios ont une position et un volume.
3. Demander `Crée une voix : « La lumière a un parfum. »` ou `Crée une ambiance sonore de 60 secondes`. Le lecteur apparaît dans le chat ; le bouton + ajoute le son au montage.
4. Importer vos images, vidéos et audios avec +. La bibliothèque offre référence, animation, insertion/remplacement et téléchargement de l’original.
5. Exporter depuis le montage. Une tâche réelle produit le MP4, ou un MP3 pour une création sonore sans vidéo, avec son lecteur et téléchargement dans la conversation.
6. Recharger ou redémarrer : les projets, conversations, médias, montages et tâches restent sauvegardés. Une exportation déjà lancée conserve son snapshot même si les paramètres changent ensuite.

Le bouton palette près des paramètres propose **Charbon** (neutre/champagne, par défaut), **Minuit** (bleu nuit/glacier), **Porcelaine** (ivoire/terre cuite) et **Olive** (vert/or). Le choix reste mémorisé dans ce navigateur. Il change les surfaces du Studio, pas les images ni les fichiers rendus.

Si un son continue après le dernier plan, la dernière image est tenue jusqu’à la fin, dans l’aperçu et dans le rendu. La durée cible guide la génération de démonstration ; ce sont les éléments du montage qui déterminent la durée finale.

## Ce qui est simulé

Le directeur est un interpréteur d’intentions français/anglais, pas un LLM connecté. La création d’images reprend les trois visuels parfum de démonstration ; les références sont stockées et attachées au brief, mais ne conditionnent pas une génération payante. Les animations sont des mouvements de caméra FFmpeg sur ces images. La voix, l’ambiance synthétique, les imports, la coupe, l’assemblage et les exports sont réels. Aucun appel provider payant, aucune clé, aucun compte, aucune base de production.

Les images, vidéos et audios acceptés par le Studio actuel sont pris en charge. SVG, HTML, PDF/documents, médias distants et sources de plus de 100 Mo sont exclus de ce prototype. Sources temporelles : 1 seconde à 10 minutes ; animation locale : 1–30 secondes ; 12 plans vidéo et 36 éléments au total.

## MCP local

Endpoint JSON-RPC **http://127.0.0.1:4318/mcp**, HTTP POST avec réponses JSON. `initialize`, `ping`, `tools/list` et `tools/call`, sans abonnement/session. Outils :

- `studio_list_projects`, `studio_create_project`, `studio_get_project`
- `studio_trim_clip`, `studio_move_clip`
- `studio_command` pour les autres commandes partagées : paramètres, insertion, remplacement, suppression, assemblage, volume, undo/redo, images, animation, voix, ambiance, export, annulation/reprise de tâche.

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

Les 29 tests exercent les sources/coupes, undo/redo, fps, pistes audio, persistance, conflits, idempotence, jobs, directeur et MCP, isolation entre projets, imports réels, Range, rendus FFmpeg et contraste des quatre palettes. Le guide d’architecture et le relevé de fidélité se trouvent dans `docs/engineering/studio-conversation-prototype.md` et `../design/fidelity-ledger.md` à la racine du dépôt.

Pour la vérification dans un navigateur, utiliser un projet distinct : état vide → paramètres → brief → import image/vidéo/audio → coupe et déplacement → remplacement → voix/ambiance → volume/position avec annulation → arrêt/reprise d’une tâche → export vidéo et audio seul → recharge. Vérifier aussi le repli du moniteur, le défilement du montage et les palettes au clavier et à 320/390 px. Ces gestes complètent les tests serveur ; ils ne sont pas automatisés par la commande `npm test`.
