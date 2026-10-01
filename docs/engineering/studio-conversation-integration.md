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

Le directeur appelle Responses avec **gpt-6.1-sol**, raisonnement medium, JSON strict, timeout 65 s, sans retries SDK. Il propose une seule image ou une réponse/question sans image. La sélection privilégie GPT Image 2.5 Flare et ne conserve GPT Image 2 que si son tuple certifié est réellement disponible. Les formats sont carré, paysage ou portrait ; la sortie est une image PNG haute qualité. Les capacités, prix, réservation wallet et exécution viennent des propriétaires MCP existants. Les essais inclus ne sont pas accessibles à la session. Les contrats et paramètres sont qualifiés en local. Une tentative texte-vers-image Flare approuvée a aussi réussi via le MCP existant ; la retouche avec références et le parcours session complet restent à qualifier avant ouverture du pilote.

Chaque message a un UUID et une entrée immuable liée au compte/projet. Une lease de trois minutes exclut un second tour actif du même compte ; le pilote limite à vingt nouveaux tours/heure et deux appels modèle par message. Les trente derniers tours constituent la vue et les huit derniers échanges textuels le contexte Sol. Un draft sauvegardé reprend sans second appel modèle. Son empreinte des références, enregistrée avec le draft et immuable, lie les médias vus par Sol à ceux résolus avant le devis. La confirmation reverrouille les médias et vérifie à nouveau le snapshot. Une référence modifiée, supprimée ou masquée ne déclenche aucun débit et invalide l’approbation inutilisable.

Une nouvelle demande **ou une reprise explicitement réclamée** expire les autres devis préparés du projet. Un replay d’un tour déjà prêt ne modifie rien. La préparation et l’attachement du devis au tour partagent la même transaction. Après confirmation, un rechargement retrouve le même job et son résultat ; un timeout n’autorise aucune seconde dépense. Le navigateur garde seulement la demande en attente dans sessionStorage, séparée par compte/projet, et propose Reprendre/Modifier même si le POST initial n’a jamais atteint le serveur.

Le « + » utilise les lecteurs Assets et Recent et l’import image existants. Choisir une création récente la sauvegarde avec son job/output via le propriétaire de bibliothèque, puis relit son identité publique `ma_` ; aucun UUID interne n’est converti. Les références sont des images possédées, huit au maximum. Audio, vidéo, coupe/timeline et rendu restent dans le prototype/éditeur existants jusqu’aux lots suivants. Le journal public ne retourne ni clé API ni snapshot de coût privé. Les limites Sol par compte sont des garde-fous du pilote, pas encore une politique commerciale ouverte aux clients.

Validation : 85 tests ciblés passent ; les 11 tests d’intégration Studio isolés passent. La suite générale compte 5 688 succès, un skip et un échec indépendant dû aux dates de revue des captures GitHub devenues trop anciennes. TypeScript et lint passent (six avertissements image natifs). La revue indépendante a reproduit puis revérifié les problèmes de drift, devis supersédés, reprise navigateur et bibliothèque. Un échange Sol réel a répondu dans le navigateur et survécu au rechargement. Les transactions session image ont été qualifiées sur DB jetable avec provider mocké ; aucune migration production n’a été effectuée. Après approbation explicite du devis, une génération média réelle via le MCP a été exécutée une seule fois pour 0,06 USD et récupérée terminée.

Le contrôle visuel a porté sur 1440×900, 390×844 et 390×568, Charbon/Olive, devis, paramètres, bibliothèque et champ de chat au-dessus de la navigation mobile, fermeture Escape et restitution du focus. Le compte QA utilise seulement le bypass administrateur loopback existant : wallet et bibliothèque généraux exigent toujours une vraie session Supabase et restent donc indisponibles dans ce compte isolé. Le devis illustré en QA utilise la politique locale de test, pas le solde/prix production. La qualification du parcours complet avec session client réelle doit précéder le déploiement du pilote ; le test provider MCP ci-dessous ne prouve pas à lui seul ce parcours.

## Qualification provider approuvée — 1 octobre 2026

Le client a approuvé explicitement le devis de **0,06 USD** pour une seule image GPT Image 2.5 Flare, texte-vers-image, PNG haute qualité, format demandé 16:9, résolution `landscape_16_9`, sans référence. Le sujet reprend le flacon cobalt sur pierre claire au bord de la Méditerranée, voilage de lin et lumière de fin de journée.

- Quote/job : `8119038a-7e5e-41d9-bb18-dcfa1e1dff02`.
- Une seule confirmation. Retour `completed`, progress 100, `paid_wallet`, priceCents 6. La lecture de récupération retrouve le même job terminé, sans nouveau devis ni seconde exécution.
- Résultat délivré par `present_generation`, enregistré dans la bibliothèque du même compte. [Ouvrir la création](https://maxvideoai.com/app/image?job=8119038a-7e5e-41d9-bb18-dcfa1e1dff02).
- Le navigateur charge le PNG et constate **1088×608** pixels. Le ratio demandé est nominal ; les dimensions de source mesurées doivent conserver leur autorité pour le montage. Ne pas inventer un 1920×1080 depuis le devis.
- Le visuel reçu montre le flacon cobalt, le bord de mer, la pierre et le voile, sans texte. Cela qualifie cette tentative ; pas tous les prompts, toutes les références ou tous les modèles.

Cette tentative utilise l’adaptateur OAuth MCP déjà déployé. Elle valide la capacité réelle du provider et la récupération de ce job ; elle ne déploie pas les nouveaux readers de devis session, ne migre pas la base production et ne remplace pas le contrôle navigateur avec une vraie session client.

## Qualification de la session client — connexion et dialogue vérifiés

Un second runtime local sur `localhost:3000` utilise un snapshot Git de la branche d’exploration, PostgreSQL 17 jetable sans listener réseau et les seuls paramètres publics Supabase de l’app. Le projet QA est lié au compte identifié par le connecteur ; les routes exigent ensuite une session Supabase vérifiée indépendamment. Aucun cookie ou token du connecteur n’est converti en session navigateur. Le bypass administrateur est désactivé. Le runtime ne reçoit ni service-role Supabase, ni connexion DB production, ni clé de provider média ou de paiement. Seule la clé Sol déjà autorisée est transmise pour les futurs échanges du test.

Six sondes confirment : lectures et mutations de conversation sans session = 401 ; confirmation sans session = 401 ; bibliothèque et wallet sans session = 401 ; endpoint de bypass = 404. Les réponses conversation et wallet portent `private, no-store`. La page de connexion conserve le retour vers `/app/studio/conversation/qa-client-session-local`, rend les accès Google/email et ne produit aucune erreur console. Le prototype sur 4318 continue de répondre.

**Connexion Google vérifiée** : l’utilisateur a terminé le parcours existant et le navigateur a ouvert le projet QA sur localhost. Ses identifiants n’ont pas été collectés par le runner. Le wallet et la bibliothèque du test restent ceux de la base locale vide : zéro crédit, aucun média. La génération réelle déjà créée via MCP reste dans la bibliothèque production, sans copie sous un propriétaire QA ni identité publique inventée. Conversation persistante, bibliothèque vide et accès du compte ont ensuite été vérifiés. Le parcours génération client complet reste à qualifier avant un nouveau lot média.

Le contrôle du retour Google a révélé que l’allowlist Supabase effective accepte `http://localhost:3000/login?...` et refuse `http://localhost:4330/auth/callback?...` ainsi que `http://localhost:3000/auth/callback?...`. Des flows OAuth anonymes, annulés avant toute connexion utilisateur, ont reproduit le retour production pour ces deux callbacks refusés et le retour local pour `/login`. Le runner utilise donc désormais le port 3000, réservé uniquement si libre. `buildAuthCallbackRedirect` choisit `/login?mode=signin&next=...` sur loopback ; le hook PKCE existant y échange le code. Les autres origines gardent `/auth/callback`. La configuration Supabase distante n’a pas été modifiée. Quatre tests comportementaux couvrent retour local, IPv4/IPv6, production/preview et refus d’un `next` externe, avec RED puis GREEN ; les seize tests ciblés auth/login passent. La connexion Google utilisateur a ensuite abouti sur le projet Studio local. Voir la [configuration officielle des retours Auth](https://supabase.com/docs/guides/auth/redirect-urls).

Après redémarrage du snapshot corrigé sur le port 3000, le navigateur ouvre bien le sélecteur Google avec `redirect_to=http://localhost:3000/login?mode=signin&next=...`, sans code ni vérificateur transféré vers le site production. Le formulaire local rend sans overlay ni erreur console. TypeScript et lint passent (six avertissements image déjà présents). La suite générale après correctif compte 5 692 succès, un skip et le même échec préexistant `tests/github-assets.test.ts` lié aux dates de revue des captures. L’utilisateur a ensuite terminé Google ; l’arrivée authentifiée dans Studio local et la session conservée après rechargement ont été constatées.

### Contrôle navigateur avec la vraie session

- Page projet possédée, wallet QA et journal : 200 sous session Google, bypass désactivé. La base locale contient zéro crédit ; ce n’est pas le wallet production. Le header affiche désormais **QA local** plutôt qu’un montant susceptible d’être pris pour le solde réel.
- Deux réponses **Sol réel** : proposition « Azur minéral / L’heure ambrée », puis rappel et affinage de la deuxième direction après rechargement. Les deux tours restent `ready`, avec un seul appel modèle chacun et sans devis. Le journal PostgreSQL lie les tours au propriétaire du projet.
- Assets et créations récentes : 200, état vide attendu. Recherche `cobalt` dans les deux sources, fermeture Escape et focus restitué au +. Aucun import ni copie de média production testé dans ce lot.
- Desktop 1440×900 et mobile 390×844 / 390×568 : Charbon/Olive, relecture du dernier échange, aucun débordement de document, champ chat au-dessus de la navigation fixe (bas du champ 722/446 ; haut de navigation 774/498). Affichage normal rétabli après QA.
- Lecture DB finale : deux tours possédés, zéro devis, zéro job, zéro receipt de charge média et zéro consentement. Les appels Sol consomment leur API ; cette absence de charge concerne les médias et le wallet, pas la gratuité de la conversation.

Le premier runtime avait un schéma de profil/consentements incomplet et publiait artificiellement trois anciens documents légaux via le bootstrap QA. Une carte de reconsentement a recouvert le bouton d’envoi ; un clic de test a atteint cette carte et le POST a échoué, sans enregistrer de consentement. Le schéma QA a été complété et ces trois seuls documents de fixture retirés. Aucun historique d’acceptation utilisateur n’a été inventé et aucune politique production modifiée. La QA ne publie pas de mise à jour légale. Il subsiste donc l’avertissement `Cookie policy not configured` du shell, lié à cet environnement sans politique de cookies publiée ; aucune erreur conversation/bibliothèque n’est constatée après correction. Le consentement production et l’import de fichier ne sont pas qualifiés par ce contrôle.

Le prochain contrôle reste une image effectivement préparée, confirmée et récupérée depuis ce chat avec ses services connectés. La génération Flare via MCP et les transactions locales mockées sont des preuves distinctes ; elles ne deviennent pas une preuve du parcours média session complet.

### Identité réelle et wallet local

Le menu de compte de la session locale affiche l’adresse Google attendue ; le propriétaire du projet correspond au compte connecté au MCP. La lecture du wallet réel via `get_account_status` a confirmé 4 014 cents USD le 1er octobre 2026. Ce montant est une observation datée, jamais une fixture de solde copiée dans la QA.

La présentation **QA local** est activée uniquement sur le pilote conversation, dans un runtime non-production portant explicitement `STUDIO_INTEGRATION_RUNTIME=1`. Son infobulle explique que la session Google est réelle mais que le wallet et la bibliothèque utilisent des données de test. Les liens ouvrent le wallet du site réel dans un nouvel onglet ; aucun CTA de rechargement local n’est proposé. Les autres headers conservent leur destination `/billing` et les états montant, zéro, chargement et indisponibilité. Aucun ledger, solde, média ni identité n’est modifié.

Le test comportemental reproduit l’ambiguïté avant correction puis vérifie la distinction pour une réponse wallet absente, nulle ou positive. Vingt tests ciblés header/navigation/session passent, ainsi que TypeScript, lint et contrôle d’exposition (six avertissements image préexistants). Le rendu et l’infobulle ont été vérifiés au clavier sur desktop et en 390×844 : pas de montant `$0.00` présenté comme solde du compte, pas de débordement horizontal, chat conservé après reload. Les preuves visuelles restent hors dépôt. L’avertissement cookie QA décrit ci-dessus subsiste.

La suite standard après ce changement compte 5 694 succès et un échec : `tests/github-assets.test.ts`, cinq dates de revue d’assets dépassant la fenêtre de trente jours. Les intégrations isolées ont d’abord échoué dans `connected-studio-montage-browser-integration.test.ts` : une ouverture d’onglet frais a émis un autosave inattendu. Le snapshot testé était le commit antérieur `547f647bb`, sans le correctif wallet. Le même fichier relancé sur ce même commit a passé ses sept contrôles ; les quatre autres contrôles isolés avaient passé leur premier run. Cette instabilité d’autosave reste à investiguer séparément et ne constitue pas une preuve d’absence de régression dans l’ancien éditeur. Aucun test ni timestamp d’asset n’a été assoupli pour masquer ces résultats.
