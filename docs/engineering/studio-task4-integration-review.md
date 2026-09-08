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

La chaîne minimale finale, le commit MCP partagé isolé et ses symboles exacts, les résultats HTTP/CAS/browser et la confirmation du gate `studioMontageCreation:false` seront ajoutés après qualification. Ne pas intégrer une chaîne partielle sur la seule foi des tests unitaires serveur.

