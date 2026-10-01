# Studio Local Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un prototype local utilisable du Studio conversationnel, depuis le brief jusqu'au MP4, avec un tronc commun d'editing pour UI, chat et MCP.

**Architecture:** Package React/Vite et serveur Node locaux dans `experiments/studio-conversation/prototype`. Un service de commandes possède l'état métier ; directeur simulé, API et MCP sont ses adaptateurs. Stockage atomique et tâches FFmpeg persistantes.

**Tech Stack:** TypeScript, React 19, Vite 8, lucide-react, Node 22, FFmpeg/ffprobe installés, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-01-studio-local-prototype-design.md`

## Global Constraints

- Worktree `codex/studio-conversation-exploration-20261001` ; aucune mutation des routes ou services de production.
- Charbon #191c1a, surface #242725, texte #f0f0ec, secondaire #b4b8b3, bord #343833, or #e0bc77. Typographie système Inter/Apple/Segoe, pictogrammes Lucide cohérents.
- H1 Studio discret, chat central stable, maximum quatre médias latéraux ; médias dans les messages sur mobile.
- Une piste vidéo, une voix et une ambiance, frames entières, coupe minimale 1 s et limitée à la source, export conforme au snapshot.
- Formats 16:9 / 9:16 / 1:1 ; 720p / 1080p ; fps 24 / 30 ; corps import ≤100 MiB ; serveur 127.0.0.1 seulement.
- Aucun provider payant, aucune clé, aucune base production ; simulation déclarée et MP4/MP3 rendus réellement, audio et rendus lisibles dans le chat, moniteur compact à la sélection.

## Review Focus

- Modifier le montage pendant une génération : les nouveaux médias arrivent sans écraser la coupe ou l'ordre.
- Réessayer après redémarrage : identité de job/sortie préservée, aucun doublon de commande ou média.
- Import vidéo avec audio et fps différents : mesure réelle, coupe/export valides et son conservé selon le réglage.
- Relire un ancien message pendant une réponse : historique stable, résultat toujours accessible.
- Export puis changer format/fps : l'export fini reste lié à son snapshot, le projet courant conserve sa nouvelle révision.

---

### Task 1: Domain and Durable Commands

**Files:** `prototype/package.json`, `tsconfig.json`, `shared/types.ts`, `shared/timeline.ts`, `shared/commands.ts`, `server/store.ts`, `server/commands.ts`, `tests/domain.test.ts`, `tests/commands.test.ts`.

**Interfaces:**
- Produces `Project`, `Asset`, `Clip`, `Job`, `CommandRequest`, `CommandResult`.
- Produces `sequenceDuration(project): number`, `editSequence(project, command): Project`, `ProjectStore.create/get/update/list` and `CommandService.execute(projectId, request): Promise<CommandResult>`.

- [ ] Écrire les contrats de coupe bornée, ordre et changement de fps, undo/redo et refus des entrées invalides ; constater leur échec avant implémentation.
- [ ] Implémenter les règles avec les conversions de frames de Studio et verrouiller 1 s minimum, 24/30 fps, sources mesurées.
- [ ] Tester persistance, mutation concurrente, request ID rejoué et payload changé, révision stale ; implémenter stockage atomique et commandes communes.
- [ ] Exécuter `npm test -- tests/domain.test.ts tests/commands.test.ts` : tous les cas passent ; commit sur la branche isolée.

### Task 2: Real Media and Resumable Jobs

**Files:** `server/media.ts`, `server/render.ts`, `server/jobs.ts`, `server/http.ts`, `server/index.ts`, `vite.config.ts`, `tests/jobs.test.ts`, `tests/render.test.ts`.

**Interfaces:**
- Consumes `ProjectStore` et `CommandService`.
- Produces `probeMedia(path)`, `renderAnimation(input, output, options, signal, progress)`, `renderSequence(snapshot, output, signal, progress)` et `JobRunner.start/stop`.
- HTTP produit `/api/projects`, `/api/projects/:id`, `/commands`, `/import`, `/media` et `/health` ; aucun chemin arbitraire ou média distant.

- [ ] Tester reprise d'une tâche, annulation et identité des sorties ; implémenter queue persistante et merge protégé par révision.
- [ ] Tester MP4 réel de deux sources avec coupe : durée à une frame près, dimensions et audio mixé attendus, plus un rendu audio seul ; implémenter FFmpeg asynchrone et progression mesurée.
- [ ] Implémenter import avec métadonnées réelles, original et aperçu ; livrer les médias avec Range et les erreurs explicites.
- [ ] Exécuter `npm test -- tests/jobs.test.ts tests/render.test.ts` : tous les cas passent ; commit.

### Task 3: Director and MCP Editing

**Files:** `server/director.ts`, `server/mcp.ts`, `tests/director.test.ts`, `tests/mcp.test.ts`.

**Interfaces:**
- Consumes `CommandService.execute` ; aucune logique d'édition alternative dans les adaptateurs.
- Produces `respond(projectId, text, context): Promise<CommandResult>` et `handleMcp(request): Promise<JSONRPCResponse>` sur `/mcp`.

- [ ] Tester demandes en français, contexte sélectionné, intention inconnue et absence de succès inventé ; implémenter le directeur simulé.
- [ ] Tester découverte, lecture, coupe et déplacement par MCP ; comparer leur état à la même commande UI/chat, notamment stale revision et request ID répété.
- [ ] Exécuter `npm test -- tests/director.test.ts tests/mcp.test.ts` : tous les cas passent ; commit.

### Task 4: Usable Conversation, Media and Timeline

**Files:** `client/App.client.tsx`, `client/components/{Shell,Chat,MediaCanvas,MediaLibrary,Timeline,ProgramPreview,Dialogs}.client.tsx`, `client/hooks/{useStudio,usePlayback}.ts`, `client/styles/*`, `client/main.tsx`, `index.html`.

**Interfaces:**
- Consumes HTTP Project snapshots et commandes typées.
- Produces UI sauvegardée/reprise, références/pins locaux, brouillons de geste suivis d'une commande versionnée, lecture réelle cohérente avec les clips.

- [ ] Construire les surfaces depuis les références et tokens : empty, conversation, génération, prêt, reprise, erreur, bibliothèque, paramètres, export.
- [ ] Relier chaque contrôle à une fonction locale concrète ; supporter import image/vidéo/audio, voix/ambiance locale et lecteurs dans le chat, moniteur compact, référence/variation/animation, insertion/remplacement, ordre/coupe, undo/redo, paramètres et export.
- [ ] Vérifier dans le navigateur la fin des gestes, la lecture aux coupes, l'historique et le champ stable, les états pending/failed et les contrôles accessibles sur mobile.
- [ ] Exécuter `npm run build` et `npm test` : TS/build et tous les contrats passent ; commit.

### Task 5: End-to-End Handoff and Review

**Files:** `tests/e2e.test.ts`, `README.md`, `docs/engineering/studio-conversation-prototype.md`, `design/fidelity-ledger.md` et progression du plan.

**Interfaces:** Consumes l'app complète ; produit commandes de lancement, preuve de MP4/persistance/parité MCP et limites précises de promotion vers Studio.

- [ ] Tester le parcours HTTP complet, export/probe, restart/reprise, import invalide, édition pendant génération et export immuable.
- [ ] Inspecter desktop 1672×941 et mobile 390/320 ; comparer la référence et la capture courante avec view_image, consigner ≥5 points de fidélité et les écarts intentionnels.
- [ ] Exécuter `npm test`, `npm run build`, `npm run lint:exposure` depuis la racine et `git diff --check` ; résultats attendus verts, sinon réparer/report explicite.
- [ ] Faire une revue indépendante du prototype selon le spec, les tests et Review Focus, traiter ses problèmes matériels puis relancer les vérifications concernées.
- [ ] Ouvrir le prototype local dans Codex, laisser le serveur prêt pour l'utilisateur et fournir l'URL, les limites du bot simulé et les fichiers utiles. Aucune fusion/push/déploiement.
