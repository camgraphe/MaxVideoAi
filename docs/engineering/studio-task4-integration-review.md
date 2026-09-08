# Studio Task4 — provenance d’intégration en cours

Ce document n’annonce pas la qualification finale. Aucun push, fusion ou intégration dans la branche app n’est autorisé par ce rapport.

## Commit composé 20a181c35

Un chevauchement d’index entre le writer produit Sol high et la racine QA a inclus les deux lots dans ce commit. Le contenu est conservé sans réécriture ; son titre ne décrit que la partie QA. Les 29 chemins exacts sont listés ci-dessous. Aucun fichier MCP partagé de registre/transport/publication n’est inclus.

| Chemin | Provenance |
| --- | --- |
| `docs/engineering/studio-connected-editor-verification.md` | Racine QA |
| `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/app/api/studio/_lib/studio-connected-route-utils.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/app/api/studio/montages/route.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/app/api/studio/projects/[projectId]/media-access/route.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/app/api/studio/projects/[projectId]/route.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/app/api/studio/projects/[projectId]/sequences/[sequenceId]/route.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/app/api/studio/projects/[projectId]/sequences/route.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/app/api/studio/projects/[projectId]/workspace/route.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/app/api/studio/projects/route.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/lib/studio/montage-contract.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/src/server/agent-api/montage-plan.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/src/server/studio/connected-schema.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/src/server/studio/contracts.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/src/server/studio/feature-access.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/src/server/studio/media-access.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/src/server/studio/media-resolver.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/src/server/studio/montage-command.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/src/server/studio/repository.ts` | Writer Studio — serveur, contrat ou test associé |
| `frontend/src/server/studio/workspace-command.ts` | Writer Studio — serveur, contrat ou test associé |
| `neon/migrations/42_studio_connected_montages.sql` | Writer Studio — serveur, contrat ou test associé |
| `tests/connected-studio-montage-http-integration.test.ts` | Racine QA |
| `tests/helpers/studio-connected-fixture-data.ts` | Racine QA |
| `tests/helpers/studio-integration-runtime.ts` | Racine QA |
| `tests/studio-media-access.test.ts` | Writer Studio — serveur, contrat ou test associé |
| `tests/studio-montage-command.test.ts` | Writer Studio — serveur, contrat ou test associé |
| `tests/studio-montage-feature-access.test.ts` | Writer Studio — serveur, contrat ou test associé |
| `tests/studio-montage-postgres.test.ts` | Writer Studio — serveur, contrat ou test associé |
| `tests/studio-workspace-revision-postgres.test.ts` | Writer Studio — serveur, contrat ou test associé |

Le lot writer contient la commande commune, le builder timeline existant réutilisé, la migration additive42, les reçus idempotents, le writer CAS, les refus legacy, l’accès média privé et leurs tests. L’implémenteur avait vérifié17/17 tests Node22/PG17 et TypeScript avant commit. Le test HTTP racine était RED attendu contre le snapshot précédent : tool persistant encore absent.

## Commit 87919e9d7

Malgré son titre fonctionnel, ce commit ne fait que supprimer deux lignes blanches finales : une dans `frontend/lib/studio/montage-contract.ts`, une dans `frontend/src/server/studio/connected-schema.ts`. Il ne contient pas une deuxième implémentation du serveur. Il suit20a181c35.

## Discipline et critères restants

Tous les writers utilisent désormais `git commit --only -- <chemins explicites>`, avec contrôle d’index avant/après. Les sources app et ancien éditeur restent en lecture seule.

La chaîne minimale finale et les résultats HTTP/CAS/browser complets seront ajoutés après qualification. Ne pas intégrer une chaîne partielle sur la seule foi des tests unitaires serveur.

## MCP partagé isolé : 1c41f3d16

Ce commit est distinct des propriétaires Studio et QA. Il conserve `studioMontageCreation:false` dans la publication ; l’override de qualification demande un environnement non production et un Host/config loopback cohérents.

Symboles ajoutés : `MaxVideoAiMcpServices.createStudioMontage`, `MaxVideoAiMcpServerOptions.studioMontageCreation`, `registerCreateStudioMontageTool`, `createStudioMontageToolInputSchema`, `MCP_TOOL_INPUT_SCHEMAS.create_studio_montage`, capacité d’instructions `studioMontageCreation`, nom d’audit `create_studio_montage`. Le transport dérive la gate avec `isStudioMontageCreationEnabled` et la transmet au serveur. `prepare_montage` reste distinct, désactivé par défaut et non persisté.

Chemins produit partagés :

- `frontend/config/mcp-publication.json`
- `frontend/src/server/mcp/http-handler.ts`
- `frontend/src/server/mcp/instructions.ts`
- `frontend/src/server/mcp/server.ts`
- `frontend/src/server/mcp/tool-input-schemas.ts`
- `frontend/src/server/mcp/tools/create-studio-montage.ts`

Nouveau test : `tests/mcp-studio-montage-tools-contract.test.ts`. Projections de publication mises à jour : `tests/admin-mcp-architecture.test.ts`, `tests/fixtures/mcp-launch-publication-states.json`, `tests/mcp-config.test.ts`, `tests/mcp-launch-readiness.test.ts`, `tests/mcp-legal-support-readiness.test.ts`, `tests/mcp-paid-e2e-proof-contract.test.ts`, `tests/mcp-production-vercel-preflight.test.ts`, `tests/mcp-tool-selection-eval.test.ts`, `tests/mcp-trial-reconciliation.test.ts`.

L’implémenteur rapporte12/12 tests MCP/prepare/config et TypeScript réussis. La racine a ensuite passé le vrai HTTP1/1 (12,04s) : création MCP, SQL ordre/trims/propriété/reçu, accès privé signé300s, sauvegarde CAS0→1, refus stale/anciens writers, rejeu UI cookie et MCP préservant l’édition. Ce passage ne qualifie pas encore le navigateur. La revue a demandé trois renforcements : lecture projet/séquences atomique, verrouillage transactionnel des sources et anciens writers, erreurs métier MCP actionnables au lieu de `INTERNAL_ERROR`. Le test HTTP renforcé doit passer après leurs corrections.

## Correctifs serveur et MCP

- `cdb716027` : adaptation d’erreurs métier uniquement dans le nouveau tool MCP et son test. Conflit exact de clé→`PARAMETER_INVALID`, média absent/projet de rejeu supprimé→`REFERENCE_NOT_FOUND`, schéma indisponible→`RATE_LIMITED` retryable. Pas de changement du contrat global d’erreurs. Il suit le commit partagé `1c41f3d16` et doit rester identifiable à l’intégration.
- `1c9eafa92` : GET workspace retourne `{ok:true,project,sequences}` sous verrou parent partagé ; writer CAS exclusif ; verrouillage/revalidation des sources et des anciens writers dans leur transaction. Tests PG concurrents, vérification data_directory exacte et nettoyage si initialisation échoue.

Le test HTTP racine renforcé passe1/1 sur `1c9eafa92` (12,99s), avec lecture atomique, accès privé, tous les chemins séquences et erreurs attendues non génériques. Cela ne remplace pas la revue serveur ou le client connecté. Le premier navigateur réel sans localStorage ouvre bien les deux clips enregistrés, mais reste RED sur leur lecture privée avant le branchement client ; la capture a été inspectée. Les fixtures compte/consentement et l’indisponibilité de génération sont explicitement séparées de Studio/Auth/SQL réels.

## Revue indépendante intermédiaire

La revue Sol high du serveur/MCP figé demande trois corrections Important, aucun Critical :

1. Refuser les éléments structurellement invalides dans nodes/edges/timelineItems avant sauvegarde. `[null]` est actuellement accepté mais fait échouer les normalizers à la réouverture. Ce finding ne demande pas d’interdire les chevauchements/multitracks ou de transformer les métadonnées de snapshot en faits canoniques ; ces derniers sont toujours revalidés dans la bibliothèque serveur.
2. Conserver explicitement les trims d’entrée en frames et leur fps/ordre, au lieu de ne garder que les conversions en secondes et un hash irréversible.
3. Rendre les erreurs DB/signature inattendues opaques avec500, au lieu d’exposer `Error.message` en400. Les erreurs métier validées gardent leurs statuts propres.

La racine a confirmé le premier défaut via HTTP réel : le snapshot contenant `sequence.timelineItems:[null]` reçoit200 au lieu de400 (11,47s). Le test est donc de nouveau RED sur ce contrat renforcé. Il ajoute aussi une contrainte PostgreSQL uniquement dans sa base jetable pour exiger rollback complet et erreur opaque lors d’un échec du dernier write ; cette assertion n’est pas encore atteinte. Correctifs et re-revue en attente, sans qualification finale Task4.

## Correctifs de revue : 7cf6a5b57

Ce commit ajoute la validation structurelle avant normalisation/transaction, le payload initial dans le reçu et la provenance `montageSource` de chaque occurrence (ordre, asset canonique, trims en frames et fps). Le writer CAS conserve la provenance initiale et ne valide pas une provenance inventée par le client. Les erreurs techniques inattendues deviennent des500 opaques ; les erreurs métier gardent leurs codes validés.

La racine a relancé le test HTTP réel renforcé sur ce snapshot : **2/2 réussis, 22,91s**. Le snapshot `[null]` est refusé en400 sans incrément ; une contrainte SQL ajoutée uniquement dans la base jetable provoque500 `STUDIO_WORKSPACE_SAVE_FAILED` et le rollback de la séquence déjà écrite. Le reçu `request_payload` et les `montageSource` restent identiques après CAS et rejeu UI/MCP. Les assertions MCP exigent maintenant les codes et `retryable` exacts, dont `REFERENCE_INVALID` pour l’absence de faits mesurés (contrat canonique existant), plutôt que seulement l’absence d’`INTERNAL_ERROR`.

Une re-revue indépendante du serveur complet est en cours. Le client connecté et son parcours navigateur neuf ne sont pas encore qualifiés ; ces résultats HTTP ne les remplacent pas.
