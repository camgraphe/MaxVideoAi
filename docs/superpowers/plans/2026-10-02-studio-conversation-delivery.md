# Studio conversationnel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un client débutant de créer un film court à partir d'une conversation naturelle, de corriger son montage et de récupérer un rendu, avec prix explicites et reprise durable.

**Architecture:** Sol choisit la direction, écrit les prompts et appelle des actions serveur bornées. Studio et MCP utilisent les mêmes propriétaires de catalogue, devis, réservation, génération, médias, montage et export ; chaque adaptateur conserve son identité et ses permissions. Les médias et la séquence canonique appartiennent au compte/projet ; le modèle ne possède ni l'autorité de paiement ni le navigateur.

**Tech Stack:** Next.js, React, TypeScript, OpenAI Responses (`gpt-6.1-sol`), PostgreSQL 17, services MaxVideoAI et worker de rendu existant.

**Spec:** `docs/engineering/studio-conversation-integration.md`, `experiments/studio-conversation/design/interaction-notes.md` et demandes utilisateur de cette conversation. Ce document fixe l'ordre de livraison ; le film promo est le test final du parcours.

## Avancement au 2 octobre 2026

Le directeur réel reste **GPT-6.1 Sol**. Les actions, mémoire/reprise, vidéo/Audio, timeline canonique et UI d’export sont raccordées localement. Les tests utilisent PostgreSQL jetable et des fichiers mesurés ; un rendu MP4 local de 3 s vérifie les coupes et le son. Le [dossier de pilote](../../engineering/studio-conversation-pilot-readiness.md) distingue chaque preuve locale de la qualification externe restante.

Task 2 est complète. Tasks 1/3 attendent les sorties providers dans la route native ; Task 4 attend le worker distant et la récupération de son original ; Task 5 attend le parcours naturel de 25 s et son coût complet. Les migrations/gates production et la politique commerciale des tokens restent des étapes explicites. La seule revue de branche a été réalisée ; ses cas de reprise sont corrigés par une passe ciblée, sans nouvelle salve généraliste.

## Global Constraints

- Continuer dans la branche `codex/studio-conversation-exploration-20261001`, jamais sur main.
- Le périmètre V1 est : conversation, références bibliothèque/import, image, animation vidéo, voix, musique, ordre/coupe, lecture et export.
- Sur desktop, les visuels utiles se recomposent autour du chat ; sur mobile, ils restent dans le chat.
- Moniteur repliable au-dessus de la timeline ; lecture pilotée par la timeline, sans panneau de commandes redondant.
- Charbon en dark et Olive en light, intégrés au chrome de l'app.
- Anglais comme langue principale des parcours/tests ; français conservé pour les régressions.
- Aucun sélecteur obligatoire « complet/par étapes » ni catalogue de modèles imposé au client.
- Les messages client ne fournissent pas les prompts techniques : Sol les écrit.
- Une dépense reste liée à un devis exact confirmé par le client ; aucun remplacement payé automatique.
- Les migrations sont explicites ; aucune application de schéma ou déploiement production dans cette planification.
- Conserver projets/médias existants. Le remplacement de l'ancien Studio est une étape de bascule après qualification.
- Réutiliser les services actuels. Ne pas créer un second moteur de prix, wallet, provider ou rendu.
- Étendre le + aux types image/vidéo/audio réellement acceptés et vérifiés ; ne pas annoncer une analyse sonore ou vidéo que le modèle ne reçoit pas.
- Mesurer tous les appels texte, y compris les étapes d'outils et réponses incomplètes ; conserver les coûts inconnus.
- Fixer la politique commerciale des tokens avant ouverture client ; la mesure QA n'est pas une facturation.

## État réel au moment du plan

| Élément | État | Ce que cela prouve |
|---|---|---|
| Direction visuelle, chat, visuels, moniteur, timeline simple | Prototype local abouti, variantes desktop/mobile travaillées | UX testable, pas encore tout raccordé à la route native |
| Sol réel dans l'app | Directeur image, historique persistant, usage mesuré | Compréhension et rédaction d'un prompt image |
| Devis/confirmation image session | Implémentés et testés localement | Contrats et protections ; exécution provider depuis le chat natif encore à qualifier |
| Production média réelle | Une image et une animation 5 s obtenues via MCP | Exécution séparée ; pas une chaîne native complète |
| Références image i2i | Deux confirmations MCP refusées comme devis non courant, sans débit | Incident à reproduire/diagnostiquer ; pas de nouvel essai payé automatique |
| Vidéo, voix, musique dans le chat natif | À raccorder | Le directeur natif actuel ne les exécute pas |
| Montage/export du nouveau parcours | Fonctionnent dans le prototype ; propriétaires canoniques existants | Adaptation au même projet natif à réaliser |
| Tests | Couverture locale importante ; salve English déjà réalisée | Inutile de multiplier les salves avant le prochain raccord |

Le dernier test débutant, dans `qa-studio-newcomer-film`, a laissé Sol choisir seul concept, scène, format et prompt à partir de quatre messages simples. Il s'arrête à la préparation du devis : le runtime QA n'a pas de provider image exécutable. Ce n'est pas un film réalisé de bout en bout.

## Review Focus

1. Réouverture/crash après acceptation d'un job : retrouver le même job sans nouveau débit.
2. Devis devenu non courant : conserver l'intention, expliquer la reprise et demander une nouvelle confirmation.
3. Client vague et sans référence : proposer une direction et prendre des décisions utiles sans exiger un prompt.
4. Coupe manuelle pendant une action IA : préserver la révision utilisateur et signaler le conflit.
5. Compte/projet/référence étrangers : refuser avant lecture privée, réservation ou génération.

---

## Task 1 — Fermer le parcours image natif (prochain lot)

**Livrable :** demande naturelle → proposition/prompt par Sol → devis réel dans le chat → confirmation → image dans le même projet → réouverture sans nouvelle génération.

**Files:**
- Modify: `frontend/src/server/studio/image-generation-service.ts`, `image-conversation-service.ts` et `image-conversation-repository.ts` uniquement si le diagnostic établit un défaut.
- Inspect: `frontend/src/server/agent-api/generation-pricing.ts`, `prepare-generation.ts`, `confirm-generation.ts` et `quote-repository.ts`.
- UI: `frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useImageConversation.ts`, `_components/ImageQuoteCard.client.tsx`.
- Tests: `tests/studio-image-generation-postgres.test.ts`, `studio-image-conversation-postgres.test.ts`, `studio-image-wallet-postgres.test.ts`.

**Interfaces:** conserver `createImageConversationService(actor: StudioGenerationActor, dependencies)`, `createStudioImageGenerationService` et les requêtes canoniques existantes. Le projet, le prix et les références restent vérifiés côté serveur.

- [x] Reproduire sans provider payant les différences préparation/confirmation t2i et i2i ; comparer snapshot de prix, référence, catalogue et origine avant tout correctif.
- [x] Ajouter la régression minimale sur la cause identifiée : confirmation d'un devis inchangé acceptée une seule fois ; changement de prix/référence ou compte étranger refusé sans réservation.
- [x] Corriger seulement le propriétaire établi ; conserver le contrôle de snapshot plutôt que l'affaiblir.
- [ ] Configurer un runtime pilote raccordé aux services réels sous l'accès existant, sans mélanger le wallet QA local et le compte réel.
- [ ] Vérifier une seule image réelle dans le chat natif après devis confirmé ; relire le même projet et le même job après rechargement.
- [x] Vérifier qu'un devis à renouveler réutilise le draft sauvegardé, sans nouvel appel Sol pour la même intention.

**Vérification :** tests image/PostgreSQL ciblés, puis un contrôle navigateur naturel. PASS signifie une sortie réelle visible dans le projet, un unique job/débit et une reprise correcte. Une image produite séparément par Codex/MCP ne valide pas ce lot.

**Commit :** un correctif prix isolé si nécessaire, puis un raccord/qualification natif documenté.

## Task 2 — Donner au réalisateur les actions et la mémoire du projet

**Livrable :** le bot peut choisir et préparer la prochaine action disponible, expliquer son état, et reprendre un projet durable.

**Files:**
- Create: `frontend/lib/studio/conversation-action-contract.ts` pour les actions structurées et leurs résultats.
- Create: `frontend/src/server/studio/conversation-director.ts`, `conversation-actions.ts`, `conversation-run-repository.ts`.
- Modify: service de conversation natif, route/hook de conversation et propriétaire de métrologie existant.
- Create: migration explicite du journal de runs et `tests/studio-conversation-actions.test.ts`, `tests/studio-conversation-runs-postgres.test.ts`.

**Interfaces à définir dans ce lot :**
- `StudioActionRequest` : union strictement validée de lecture du projet/catalogue, préparation d'un devis, lecture d'un job, et commandes de montage/export ajoutées dans les lots suivants.
- `executeStudioAction(actor: StudioGenerationActor, request: StudioActionRequest): Promise<StudioActionResult>` : adaptateur serveur sans shell ni confirmation de paiement par le modèle.
- `StudioActionResult` : résultat discriminé par action, avec données canoniques ou erreur explicite ; un devis préparé n'est pas un média créé.
- Journal : compte/projet, requestId, étapes, identités devis/jobs, sorties et révision observée. La reprise utilise ces identités avant de décider une nouvelle action.

- [x] Écrire les tests de séquence : brief vague, lecture des possibilités, choix/prompt du bot, préparation réelle ; aucune confirmation payante disponible comme outil du modèle.
- [x] Implémenter la boucle Responses et la mémoire durable du brief/décisions, au-delà des huit derniers tours du pilote image.
- [x] Brancher les actions sur les propriétaires canoniques ; partager les fonctions métier avec MCP sans faire du MCP public l'autorité de session.
- [x] Enregistrer chaque réponse/étape avant publication ; simuler un arrêt après acceptation du job et vérifier reprise sans doublon.
- [x] Exposer des erreurs compréhensibles et une suite possible, sans inventer prix/capacités ni transformer un échec en résultat réussi.

**Vérification :** doubles de services et PostgreSQL jetable, aucun nouveau média payé. PASS signifie que les actions suivent l'état réel et que le scénario crash retrouve le job existant.

**Commit :** contrat/actions, puis persistance/reprise avec documentation de leurs propriétaires.

## Task 3 — Ajouter vidéo, voix et musique au parcours

**Livrable :** demander « Can it move? » puis « Add a voice and some music » produit des médias réels, récupérables dans le chat et le projet.

**Files:**
- Modify: `conversation-action-contract.ts`, `conversation-actions.ts` et directeur du lot 2.
- Reuse: `frontend/src/server/agent-api/prepare-generation.ts`, `confirm-generation.ts`, `generation-status.ts`.
- Adapt: `prepare-audio-generation.ts`, `confirm-audio-generation.ts`, `audio-quote-repository.ts` et `generation-actor.ts` avec scopes session explicites.
- Reuse: `frontend/src/server/studio/media-resolver.ts`.
- Tests: `tests/mcp-audio-services-postgres.test.ts`, `mcp-audio-reservation-postgres.test.ts` et nouveaux tests session Studio Audio.

**Interfaces:** étendre l'union du lot 2 avec préparation vidéo/Audio et récupération de sortie. Consommer les requêtes/devis/jobs canoniques existants ; les adaptateurs OAuth conservent leurs restrictions et les clients ne fabriquent pas d'acteur.

- [x] Écrire les tests de scopes image/vidéo/Audio et de confirmation session/OAuth ; une confirmation de mauvaise surface/origine ne réserve rien.
- [x] Raccorder d'abord une animation qualifiée et économique ; limiter les modèles de V1 aux variantes réellement vérifiées.
- [x] Raccorder une voix anglaise et une musique instrumentale via les services Audio existants ; récupérer originaux, durée et métadonnées mesurées.
- [x] Ajouter lecteurs vidéo/audio et états asynchrones dans le chat ; rattacher seulement les sorties prêtes et possédées.
- [x] Étendre bibliothèque/import aux références image/vidéo/audio compatibles avec l'action choisie, en conservant les originaux et les métadonnées vérifiées ; aucune promesse d'analyse d'un flux absent.
- [x] Vérifier avec sorties contrôlées échec/remboursement et retour dans le projet sans relance automatique.
- [ ] Qualifier une sortie réelle de chaque nouvelle capacité après devis approuvé ; conserver coût média et tokens distincts.

**Vérification :** contrats/session/PG, puis contrôles provider bornés. PASS signifie vidéo, voix et musique jouables, même compte/projet, charges exactes et récupérations uniques.

**Commit :** vidéo puis Audio en lots séparément vérifiables. Ne pas publier les outils MCP Audio/édition en modifiant simplement leurs flags.

## Task 4 — Raccorder la timeline simple et le rendu

**Livrable :** le client peut ordonner/couper des clips, placer et lire l'audio, prévisualiser et exporter le film ; le bot utilise les mêmes commandes.

**Files:**
- Reuse: `frontend/src/server/studio/montage-command.ts`, `workspace-command.ts`.
- Reuse: les helpers de timeline sous `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/`.
- Reuse: `frontend/src/server/timeline-exports/` et `frontend/app/api/studio/timeline-exports/`.
- Create: composants/hook de timeline et moniteur colocated dans la route de conversation.
- Extend: tests montage connectés et contrats export existants ; ajouter tests timeline/moniteur conversation.

**Interfaces:** une seule séquence canonique par montage actif, commandes versionnées avec receipts. Étendre les actions du lot 2 avec les commandes existantes, jamais un deuxième modèle de timeline. Export d'un manifeste immuable issu de la révision confirmée.

- [x] Écrire une régression clip réel : coupe source, durée affichée, tête de lecture et moniteur décrivent le même instant.
- [x] Raccorder ordre/coupe/audio à la persistance canonique ; une action du bot suit le même chemin qu'un geste manuel.
- [x] Adapter la présentation du prototype : moniteur repliable au-dessus de la timeline, chat accessible sur mobile, absence de lecteur vide permanent.
- [x] Vérifier conflit après coupe manuelle : la réponse IA ne remplace pas silencieusement la modification.
- [ ] Raccorder estimation/réservation/rendu existants ; le navigateur récupère le même artifact après fermeture/réouverture.
- [ ] Vérifier desktop et mobile sur vrais médias ; garder résolution du fichier source distincte de celle du rendu final.

**Vérification :** tests de commandes, conflit, manifeste/export puis navigateur. PASS signifie coupe cohérente, projet repris et fichier lisible à la durée attendue.

**Commit :** montage canonique, UI simple, puis export.

## Task 5 — Qualifier le parcours et préparer la bascule

**Livrable :** une personne débutante peut obtenir un film utilisable sans écrire de prompt ni connaître les modèles, et son coût complet est connu.

**Files:** parcours browser/fixtures English, guide d'intégration, brief promo et journal privé des coûts. Les modifications UI de langue restent dans les owners de copie existants.

**Interfaces:** utiliser uniquement la route et les actions des lots 1–4. Le client simulé réagit aux réponses observées ; aucun prompt créatif caché ni exécution manuelle par Codex ne remplace une étape manquante.

- [ ] Jouer cinq cas ciblés en anglais : débutant vague, références personnelles, budget insuffisant, réouverture pendant un job, et coupe manuelle suivie d'une demande au bot. Les cas de panne utilisent des doubles/local PG.
- [ ] Réaliser un seul petit film réel, cible 25 s et économique, à partir de quelques phrases client ; Studio choisit direction/prompts/paramètres et demande les validations utiles.
- [ ] Mesurer tous les tokens du parcours, charges/refunds média et rendu ; ne pas annoncer un total complet avec des postes inconnus.
- [ ] Vérifier conversation, bibliothèque et erreurs en anglais, desktop/mobile, puis les régressions françaises utiles.
- [ ] Fixer politique commerciale de conversation et plafonds, vérifier configuration/funding API, et préparer migration/gates/retour arrière.
- [ ] Faire une revue finale et les checks exigés par les guides avant toute bascule ; conserver les projets existants.

**Vérification :** un rendu final jouable depuis le projet, reprise, montage manuel fonctionnel, coûts complets et absence de blocage majeur dans les cinq cas. Nouvelle salve seulement si une régression ou une capacité ajoutée la justifie.

**Commit :** qualification et dossier de bascule. L'ouverture client/remplacement de Studio et la publication MCP restent des actions explicites après ce dossier.

## Politique de tests et point d'arrêt

Checkpoint du 2 octobre : qualification locale native validée sur Chromium, Firefox et WebKit, avec vraies vidéos de test, trim/déplacement/gain/reprise et formats desktop/mobile/tablette. Charbon/Olive suivent la préférence persistante de l'app. La bibliothèque et ses erreurs ciblées sont vérifiées en anglais. Les 625 régressions et les checks frontend restent verts.

L'audit demandé confirme l'infrastructure ECS existante, mais son image Docker est absente et ses secrets ciblent la production. Le projet `maxvideoai-mcp-staging` existe ; il manque les paramètres du directeur et du lanceur Studio. Le dossier `docs/engineering/studio-conversation-pilot-readiness.md` donne les résultats et la préparation du pilote isolé. Les cases providers, worker distant et film final restent ouvertes.

La couverture locale existante est le socle. Pendant les lots 1–4, exécuter les tests liés au code modifié et un smoke-test du livrable, puis avancer. Ne pas lancer une nouvelle salve généraliste à chaque message ou chaque changement visuel. Les contrôles larges reviennent à la qualification finale et avant intégration selon les guides.

Le montage sémantique d'interviews/podcasts, la transcription, les effets avancés, l'élargissement du catalogue et une nouvelle refonte graphique ne font pas partie du prochain lot. Ils se décident après preuve du film court ; aucun de ces chantiers ne doit repousser son raccord.

Le prochain jalon est le pilote natif borné décrit dans le dossier de qualification. Les cases providers, worker distant et film final restent ouvertes : le raccord local ne remplace pas ces preuves. Le projet promo actuel et ses médias sont conservés ; leur disponibilité ne prouve pas le parcours utilisateur complet.
