# Studio conversationnel : raccord aux services MaxVideoAI

État au 1 octobre 2026 : préparation du raccord, **pas une connexion production livrée**. Le prototype isolé dispose de Sol réel, actions communes avec son MCP local, médias locaux, montage et rendu. L’évaluation est dans `experiments/studio-conversation/design/sol-evaluation-2026-10-01.md`.

## Parcours client retenu

Le client connecté ouvre Studio, joint ses références depuis le + et décrit sa création. Sol propose une direction et choisit des possibilités réellement disponibles. Une création complète ou par étapes se décide dans la conversation. Aucun sélecteur technique de modèle n’est imposé.

Avant une génération payante, une carte du chat présente le résultat demandé, le modèle média choisi, les références, paramètres utiles et le devis exact. Le bouton de confirmation transmet l’identité du devis ; il ne confie jamais à Sol l’autorité de confirmer sa propre dépense. Un changement de demande, de référence ou de prix produit un nouveau devis. Les réglages avancés restent accessibles à la demande.

Après confirmation, les résultats arrivent dans le chat et le canevas. Le réalisateur reprend les étapes demandées sur les médias prêts ; des jobs lents persistent indépendamment de la connexion du navigateur. La timeline conserve coupe, ordre, positions/volumes audio et petit moniteur repliable. Une correction manuelle interrompant la préparation reste prioritaire. Le rendu utilise un snapshot immuable et le worker existant.

## Propriétaires constatés dans le code

| Besoin | Propriétaire à réutiliser | Adaptation nécessaire |
| --- | --- | --- |
| Session et accès Studio | `frontend/src/server/studio/access.ts` | Compte dérivé côté serveur ; jamais envoyé par le modèle |
| Projets/séquences et révision | `studio/repository.ts`, `workspace-command.ts`, `montage-command.ts` | Mapper le petit montage au projet canonique ; receipts de commandes pour chat/UI/MCP |
| Référence durable et original | `studio/media-resolver.ts`, `lib/toolbox/contract.ts` | `ToolAssetRef`, original et faits sondés ; aucun UUID local converti en `ma_` |
| Catalogue et contrat exact | `agent-api/model-catalog.ts`, `model-details.ts`, `generation-capability-validation.ts` | Projection live ; sélection limitée aux tuples Studio qualifiés |
| Prix image/vidéo | `agent-api/generation-pricing.ts` → `server/pricing/quote-billing.ts` | Même montant canonique ; aucune formule ni prix codé dans le prompt |
| Devis et exécution image/vidéo | `agent-api/prepare-generation.ts`, `confirm-generation.ts`, `paid-generation-execution.ts`, `quote-repository.ts` | Rendre le cœur accessible à la session sans fabriquer un principal OAuth |
| Audio | `agent-api/prepare-audio-generation.ts`, `confirm-audio-generation.ts`, propriétaires Audio run | Adapter l’identité session et qualifier les variantes ; aucune seconde réservation |
| Export | `src/server/timeline-exports/*` et routes `api/studio/timeline-exports` | Réutiliser estimation, réservation, manifeste, stockage, worker et récupération |
| Dialogue | Directeur Responses du prototype | Journal de tours durable lié au compte/projet ; budget/observabilité par compte |

`api/studio/_lib/studio-chat-handler.ts` retourne actuellement `STUDIO_CHAT_LIVE_UNAVAILABLE` même après accès autorisé, précisément parce qu’il manque un contrat de devis/réservation. L’ancien `studio/chat.ts` est un appel texte Chat Completions, sans boucle d’actions : il ne remplace pas le nouveau réalisateur Responses.

## Identité : travail indispensable avant le raccord

Les services image/vidéo actuels exigent `AgentPrincipal.authMethod = oauth`. Audio exige en plus un client OAuth non nul. Un client d’app possède une session, pas une identité OAuth implicite. Les adaptateurs MCP gardent leurs contrôles et formats publics.

Extraire un cœur de préparation/confirmation recevant un acteur authentifié construit exclusivement par le serveur. Deux adaptateurs vérifient séparément session Studio et OAuth MCP, puis appellent le même cœur de prix, réservation, provider et récupération. Le scope du devis doit distinguer ces origines et conserver le compte/client pour les anciens devis ; aucune confusion entre session, OAuth sans client et Audio. Le champ OAuth nullable actuel ne suffit pas à prouver une identité session.

Qualifier cette évolution du dépôt de devis et de ses contraintes immuables sur PostgreSQL local jetable avant tout writer connecté. Préserver le comportement des confirmations existantes et des anciens receipts. Les exceptions trial ne deviennent pas accessibles à Studio par ce raccord.

## Capabilities et publication

Le catalogue MCP connecté retourne actuellement des modèles image et image-vers-vidéo exécutables, dont GPT Image 2.5 Flare/Sunburst et Seedance 2.5. Ce constat de découverte ne qualifie ni leur résultat créatif ni leur disponibilité dans Studio. Le pilote choisit des tuples à certifier par le registre et les contrats existants ; ne pas recopier un catalogue local ni modifier les projections générées.

Le dépôt garde `audioGeneration`, `montagePreparation` et `studioMontageCreation` à false dans `mcp-publication.json`. Le nouvel editing local ne publie aucune capacité sur le MCP distant. La qualification Audio et l’editing connecté précèdent leurs gates respectifs. Le chat Studio aura son propre accès ; la disponibilité du MCP public ne sert pas de permission session.

## Ordre concret de réalisation

1. **Identité, devis et première image.** Cœur commun session/OAuth, références possédées, catalogue qualifié, carte de devis exacte, confirmation client et récupération d’un seul job. Le test d’intégration prouve aucune charge avant confirmation et le refus compte/origine/prix/référence erronés.
2. **Vidéo et son.** Animation réelle d’une image possédée et voix réelle via les propriétaires existants. Une sortie est récupérée par son ID canonique, sondée, puis ajoutée au projet. La synthèse macOS et les images fixes restent explicitement réservées à l’essai local.
3. **Orchestration durable.** Le journal sauvegarde demandes, étapes dépendantes, jobs, sorties, révisions et receipts. Reprise par événements/worker, sans polling du modèle ni réexécution provider après crash. Une expiration de devis attend une nouvelle confirmation ; un remboursement n’autorise aucun nouveau retry créatif.
4. **Édition et rendu connectés.** Commandes de coupe/ordre/audio appliquées au projet canonique avec révision/receipt, exposées aux deux adaptateurs. Export via le worker existant. Élargir ensuite à la transcription horodatée et au montage sémantique, puis aux autres modèles qualifiés.

La conversation consomme elle aussi l’API Sol. Le journal local mesure tokens et latence du tour courant ; le produit doit ajouter agrégation, plafonds par compte et une politique commerciale explicite avant ouverture client. Ne pas déduire un débit wallet d’un compteur de tokens ni inventer un prix conversationnel dans le navigateur.

## Validation du prochain lot

Conserver les contrats `mcp-prepare-generation`, `mcp-confirm-generation`, leurs tests de concurrence, références, état prix et reprise ; ajouter les variantes session et le refus des devis inter-origines. Audio garde ses tests de scope surface/client et refund exact. Persistance : contrats connected Studio, conflits de révision, reprise après commit avant ACK, source inchangée et undo borné. Rendu : manifeste immuable, média original possédé, durée/fps exacts et récupération de l’artifact.

Tests sur données/DB locales jetables, puis qualification provider bornée après devis confirmé. Le remplacement de Studio reste derrière un accès pilote jusqu’à preuve du parcours connecté complet, en conservant les projets existants et sans migration graphique automatique.
