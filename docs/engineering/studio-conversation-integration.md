# Studio conversationnel : raccord aux services MaxVideoAI

État au 1 octobre 2026 : premier lot image implémenté et qualifié en local derrière un gate fermé, **pas une connexion production livrée**. Le prototype isolé dispose de Sol réel, actions communes avec son MCP local, médias locaux, montage et rendu. L’évaluation est dans `experiments/studio-conversation/design/sol-evaluation-2026-10-01.md`.

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

## Identité et périmètre des devis

Les adaptateurs publics image/vidéo exigent toujours `AgentPrincipal.authMethod = oauth`. Audio exige en plus un client OAuth non nul. Un client d’app possède une session, pas une identité OAuth implicite. Les adaptateurs MCP gardent leurs contrôles et formats publics.

Le cœur partagé de préparation/confirmation reçoit un acteur authentifié construit exclusivement par le serveur. Les adaptateurs vérifient séparément session Studio et OAuth MCP, puis appellent le même cœur de prix, réservation, provider et récupération. Le scope du devis doit distinguer ces origines et conserver le compte/client pour les anciens devis ; aucune confusion entre session, OAuth sans client et Audio. Le champ OAuth nullable actuel ne suffit pas à prouver une identité session.

Cette évolution du dépôt de devis et ses contraintes immuables ont été qualifiées sur PostgreSQL 17 local jetable. Préserver le comportement des confirmations existantes et des anciens receipts. Les exceptions trial ne deviennent pas accessibles à Studio par ce raccord.

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

## Premier lot image livré sur la branche d’exploration

Le nouveau parcours est `/app/studio/conversation/[projectId]`, séparé de l’éditeur existant. `STUDIO_IMAGE_CONVERSATION_ENABLED=true` active page et API ; sa valeur par défaut est désactivée. L’accès Studio reste administrateur, déterminé par `studio/access.ts`, et le projet doit appartenir au compte. Les requêtes mutantes refusent une origine étrangère ; la confirmation exige la révision de politique de prix existante. Le compte, projet, modèle et prix ne viennent jamais d’arguments du client ou de Sol.

Les migrations **49** (origine/projet immuables des devis) et **50** (tours de conversation) sont explicites, après initialisation du schéma Studio. Aucun DDL à la lecture ou au submit. Appliquer les migrations et mettre à jour toutes les instances vers le reader de devis qui filtre l’origine **avant** d’activer le pilote. Un ancien reader qui n’utilise que le client OAuth nullable ne doit pas cohabiter avec des devis session. Ne pas retirer 49/50 après création de devis ; la fermeture du gate est le rollback fonctionnel.

Le directeur appelle Responses avec **gpt-6.1-sol**, raisonnement medium, JSON strict, timeout 65 s, sans retries SDK. Il propose une seule image ou une réponse/question sans image. La sélection privilégie GPT Image 2.5 Flare et ne conserve GPT Image 2 que si son tuple certifié est réellement disponible. Les formats sont carré, paysage ou portrait ; la sortie est une image PNG haute qualité. Les capacités, prix, réservation wallet et exécution viennent des propriétaires MCP existants. Les essais inclus ne sont pas accessibles à la session. La qualification ici porte sur les contrats et paramètres ; la qualité créative réelle du provider reste à vérifier par une tentative bornée approuvée.

Chaque message a un UUID et une entrée immuable liée au compte/projet. Une lease de trois minutes exclut un second tour actif du même compte ; le pilote limite à vingt nouveaux tours/heure et deux appels modèle par message. Les trente derniers tours constituent la vue et les huit derniers échanges textuels le contexte Sol. Un draft sauvegardé reprend sans second appel modèle. Son empreinte des références, enregistrée avec le draft et immuable, lie les médias vus par Sol à ceux résolus avant le devis. La confirmation reverrouille les médias et vérifie à nouveau le snapshot. Une référence modifiée, supprimée ou masquée ne déclenche aucun débit et invalide l’approbation inutilisable.

Une nouvelle demande **ou une reprise explicitement réclamée** expire les autres devis préparés du projet. Un replay d’un tour déjà prêt ne modifie rien. La préparation et l’attachement du devis au tour partagent la même transaction. Après confirmation, un rechargement retrouve le même job et son résultat ; un timeout n’autorise aucune seconde dépense. Le navigateur garde seulement la demande en attente dans sessionStorage, séparée par compte/projet, et propose Reprendre/Modifier même si le POST initial n’a jamais atteint le serveur.

Le « + » utilise les lecteurs Assets et Recent et l’import image existants. Choisir une création récente la sauvegarde avec son job/output via le propriétaire de bibliothèque, puis relit son identité publique `ma_` ; aucun UUID interne n’est converti. Les références sont des images possédées, huit au maximum. Audio, vidéo, coupe/timeline et rendu restent dans le prototype/éditeur existants jusqu’aux lots suivants. Le journal public ne retourne ni clé API ni snapshot de coût privé. Les limites Sol par compte sont des garde-fous du pilote, pas encore une politique commerciale ouverte aux clients.

Validation : 85 tests ciblés passent ; les 11 tests d’intégration Studio isolés passent. La suite générale compte 5 688 succès, un skip et un échec indépendant dû aux dates de revue des captures GitHub devenues trop anciennes. TypeScript et lint passent (six avertissements image natifs). La revue indépendante a reproduit puis revérifié les problèmes de drift, devis supersédés, reprise navigateur et bibliothèque. Un échange Sol réel a répondu dans le navigateur et survécu au rechargement. Les transactions image ont été qualifiées sur DB jetable avec provider mocké ; aucune migration production ni génération média payante n’a été effectuée.

Le contrôle visuel a porté sur 1440×900, 390×844 et 390×568, Charbon/Olive, devis, paramètres, bibliothèque et champ de chat au-dessus de la navigation mobile, fermeture Escape et restitution du focus. Le compte QA utilise seulement le bypass administrateur loopback existant : wallet et bibliothèque généraux exigent toujours une vraie session Supabase et restent donc indisponibles dans ce compte isolé. Le devis illustré en QA utilise la politique locale de test, pas le solde/prix production. La qualification finale avec session client réelle et provider doit suivre le devis approuvé, avant déploiement du pilote.
