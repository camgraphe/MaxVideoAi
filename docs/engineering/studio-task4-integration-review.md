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

## Vérification élargie des projections MCP

La racine a aussi exécuté les contrats modifiés de publication/support. Après correction du `NODE_PATH` du runner, le nouveau tool passe2/2 mais11 assertions existantes restent RED : dix dans le preflight Vercel simulé (le script attend encore neuf flags exacts) et une dans le support (ligne `studioMontageCreation:false` absente). `scripts/run-mcp-launch-fixture.mjs` omet également le nouveau flag dans sa liste stricte. L’implémenteur corrige ces seuls points dans un nouveau commit partagé isolé ; aucun preflight Vercel réel, déploiement ou activation n’a été lancé.

## Re-revue des références vivantes et du legacy

La revue indépendante a trouvé deux autres régressions : retirer du bin tout en conservant un clip rendait son renouvellement inaccessible, et l’opacification transformait deux conflits legacy explicites en500. La racine a reproduit le premier défaut par HTTP : CAS réussi, clip encore présent en SQL, accès404 au lieu de200 (13,42s).

Le correctif Studio `de02e5825` autorise les références exactes du bin et des seules séquences vivantes du propriétaire/projet sous verrou parent ; le reçu initial ne sert pas d’autorisation. Il restaure aussi les codes409 `STUDIO_PROJECT_CONFLICT` et `STUDIO_SEQUENCE_CONFLICT`. Suite HTTP renforcée : **3/3 réussis (24,26s)**, comprenant montage2/2 et routes historiques1/1. Retrait du bin→signature valide, retrait de la dernière occurrence→404, owner étranger→404 ; collisions d’ID projet et séquence via POST/PUT/PATCH→409 exact et contenu/propriété SQL inchangés.

Le sous-lot client `6fd412782` est figé séparément (22 chemins), avec42 tests ciblés et TypeScript rapportés verts. La preuve navigateur reste en cours : les lecteurs privés atteignent readyState avec206, mais deux premiers essais ont rencontré des erreurs d’instrumentation de test racine (helper tsx absent dans le contexte page, puis expression fonction non invoquée). Ces erreurs sont corrigées sans changement produit ni suppression des assertions de frames ; elles ne permettent pas de conclure à une régression de lecture.

## Chaîne corrective MCP partagée

L’ordre exact est `1c41f3d16` → `cdb716027` → `c774f6a6e`. Ce dernier ne touche que quatre chemins : `scripts/preflight-mcp-production-vercel.sh`, `scripts/run-mcp-launch-fixture.mjs`, `docs/operations/mcp-support-runbook.md`, `docs/marketing/mcp-directory-submissions.md`. Les lecteurs stricts acceptent désormais la dixième clé àfalse dans les profils dark et release ; aucun nouvel outil n’est publié par défaut. Les symboles de transport/registre sont ceux de `1c41f3d16`, sans ajout dans ce correctif.

La racine a rejoué neuf suites MCP modifiées, avec Node22, NODE_PATH frontend et exécution sérielle : **81/81 réussis (13,06s)**. Les11 échecs précédents de preflight/support sont résolus. Le preflight ne contacte que son stub local, pas Vercel. Cette chaîne reste à composer avec le propriétaire MCP Audio ; aucune intégration automatique.

## Navigateur connecté : défaut d’autosave confirmé

Après correction du harness, le navigateur réel a passé les assertions de frames320×180, AAC décodé activé, Pause, expiration privée injectée403 suivie d’un vrai renouvellement serveur200 et d’une nouvelle URL signée206, position conservée et nouvelle frame après seek du second clip. Il échoue ensuite sur un comportement produit : l’ouverture seule du deuxième onglet produit des autosaves, rendant l’édition du premier conflictuelle avant toute vraie édition concurrente. La capture montre son brouillon conservé et l’alerte409, mais SQL reste sur le titre précédent. L’implémenteur corrige la comparaison de snapshot hydraté/autosave ; aucune qualification finale client n’est annoncée.

La re-revue corrective indépendante de `de02e5825` et `c774f6a6e` est **Approved**, les trois Important fermés, sans nouveau bloquant. Minor conservé : les diagnostics historiques du script preflight comptent encore neuf/huit flags alors que les objets stricts en vérifient dix ; la gate effective reste correcte. Cet Approved ne couvre pas le client.

Le correctif client est une chaîne additive : `704c9d974` stabilise le timestamp de séquence et ajoute le fingerprint canonique ; `909e37f60` branche son consommateur, omis du premier commit puis ajouté sans réécriture. Un passage sur704 atteint déjà zéro-write de simple ouverture, vraie édition du premier onglet persistée,409 attendu du second et brouillon local conservé. Il révèle ensuite le bouton Recharger non cliquable : le statut réutilise un toast `pointer-events:none`. Le correctif de ce statut interactif et la protection du baseline contre un ACK tardif d’un ancien contexte sont demandés ; le parcours final reste ouvert.

`4a72b3d04` déplace l’effet consommateur `onSaved` derrière le guard de queue disposed ; `139bf2e01` rend le seul statut de conflit interactif, bouton44px et focus visible, sans changer les toasts ordinaires. Navigateur réel complet **1/1 GREEN,36,31s**, snapshot `db6560345` : toute la chaîne de lecture privée, absence d’autosave de simple ouverture, édition ACK, conflit/brouillon/rechargement, réouverture neuve et refus d’un autre compte passe. Capture inspectée. Ce sous-lot client attend sa revue indépendante ; l’entrée UI de nouvelle création reste distincte et non encore qualifiée.

## Revue client : quatre chemins supplémentaires à corriger

La revue indépendante Sol high du sous-lot client figé à `139bf2e01` conclut **Needs changes**, sans remettre en cause l’Approved serveur/MCP. Elle demande :

1. Découvrir les références privées du bin **et** de la timeline active et de toutes les séquences vivantes ; le serveur accepte déjà ces références mais le client ne les demande pas toutes.
2. Attendre le résultat réel de sauvegarde avant d’annoncer un succès et de quitter. Conflit, session expirée ou panne doivent conserver l’éditeur et rendre l’état local/non enregistré visible, y compris après autosave.
3. Lire et proposer la récupération du brouillon connecté partitionné par compte/projet, au lieu de le réécrire à partir du serveur dès la réouverture. Ne pas rebaser silencieusement un ancien brouillon sur une nouvelle révision.
4. Purger immédiatement le contenu et les URL privées déjà hydratés lors d’un changement de compte sans démontage ; disposer les seules requêtes tardives ne retire pas l’ancien contenu affiché.

La racine a reproduit le premier cas dans un navigateur vierge sur `7caa7cea2` : retrait de B du bin par vrai PUT CAS, maintien des deux clips, fermeture/réouverture ; le clip B reste en DOM mais aucun élément vidéo ne monte (**RED, 44,84s**). Capture `retained-clip-failure.png` inspectée. Les assertions de création UI ajoutées n’étaient pas atteintes dans ce passage ; elles ont maintenant leur sous-test séparé.

Le builder UI est figé dans `89af69248`, dix chemins Studio/tests uniquement. Ses quatre tests purs, l’ensemble ciblé43/43 et TypeScript sont rapportés verts par le writer ; revue UI indépendante et preuve mobile vers vrai reçu SQL en cours. Il utilise la même commande serveur que MCP, n’affiche pas son déclencheur quand la gate est false, et ne change pas la publication MCP. La chaîne finale d’intégration reste suspendue à ces correctifs et vérifications.

## Création mobile et réponse perdue

La revue UI a demandé de figer toute l’intention pendant le POST, pas seulement le bouton final. `fa48e19b4` ajoute le fieldset désactivé et l’état busy. La racine a passé le sous-test UI réel sur ce snapshot (**5,69s**) : focus initial/Escape/retour, ajout A/B/A puis retrait, ordre par boutons et Enter, trims exacts en frames, géométrie390×844, première commande réellement enregistrée puis réponse volontairement perdue. Tous les contrôles sont désactivés pendant l’attente ; l’erreur permet un second POST au payload et à la clé identiques, qui retrouve le même projet et un seul reçu. Le Studio ouvre ensuite les deux clips. La capture a été inspectée ; les scrolls imbriqués restent réservés au polish.

La suite globale demeure RED sur la référence privée hors bin ; ce passage UI ne vaut pas Approved du client. La revue UI poursuit la validation sans motif visible et l’arrondi séparé start/durée lors d’un changement de fps (12+12 frames à24fps devient13+13 à25fps sur un média1s). Un premier timeout du sélecteur FPS était une erreur de test : Chromium expose bien le nom accessible exact au rôle combobox ; le test racine le sélectionne maintenant par ce rôle. Aucun label produit n’a été assoupli pour contourner le test.

Le contre-test de changement d’identité est aussi **RED causal** sur `fa48e19b4` : une notification peer-tab conforme au SDK installé, après remplacement des cookies du seul contexte possédé, affiche bien le compte B et son refus d’accès, mais garde les deux clips et l’image privée A. Même document, pas de navigation artificielle ; capture `auth-switch-failure.png` inspectée. Le consommateur SDK/React, les routes et la validation propriétaire sont réels ; l’émission Auth est injectée et ne constitue pas un parcours complet de connexion. Le cas SIGNED_OUT suivant n’était pas atteint. La suite conserve la création UI verte et les deux sous-tests de références/identité rouges (55,83s global).

La revue UI finale confirme trois Important sur89af (intention pending, validation muette, bornes FPS) et un Minor de noms accessibles contextuels. La racine ajoute aussi les critères de récupération réelle du brouillon409 après reload sans écriture implicite, sortie bloquée sur conflit, panne PUT503 contrôlée visible et reprise après réouverture/sauvegarde200. Ces nouveaux critères attendent le correctif client figé ; ils ne sont pas déclarés verts par les preuves antérieures.

## Correctifs client/UI et preuve renforcée

`bccd76266` corrige les quatre chemins client et passe le navigateur5/5. Une vérification racine supplémentaire découvre cependant que la récupération stale réétiquette le brouillon avec la révision serveur : draft0 face à serveur1 devient localement1. RED réel35,04s, avant toute écriture dommageable. `77d05b569` conserve explicitement `baseRevision` ; deux réouvertures successives restent en conflit, dirty0, sans PUT implicite. Le choix Recharger supprime explicitement le seul brouillon compte/projet avant lecture serveur.

`adfe2f29c` corrige les derniers points UI : conversion des bornes start/end, motif de validation toujours visible, noms accessibles contextualisés, requête bornée20s avec clé de rejeu conservée. La racine vérifie aussi dans le vrai navigateur un trim de fin de source24→25fps, son refus explicite quand il dépasse d’une frame, puis sa correction et l’enregistrement commun UI/MCP.

La revue des preuves QA root a demandé deux renforcements : relire SQL après retrait du bin et identifier exactement B dans le lecteur privé ; attendre le refus du nouveau propriétaire puis une purge stable, pas seulement une frame DOM vide. Tous passent maintenant sur le snapshot `adfe2f29c` : **5/5,61,36s**. Le test exige B absent du bin SQL mais `[B,A]` conservés dans la séquence, `pattern-b.mp4` réellement téléchargé206 après réouverture ; changement compte→GET404, déconnexion→route sans cookie401, purge stable au-delà1200ms et aucune nouvelle lecture privée réussie. Le teardown local de `openFresh` est également renforcé si l’ouverture échoue, sans attendre le nettoyage global.

Cette preuve complète couvre désormais lecture native privée/renouvellement/seek, absence de PUT de simple ouverture, CAS/deux réouvertures du conflit/sortie honnête, récupération503 et vrai retry200, transition Auth, retrait du bin et création mobile avec réponse perdue. Les fixtures et limites précédemment décrites restent valables. La re-revue corrective client/UI/QA est requise avant de déclarer Task4 Approved ; Task5 et le build final restent distincts.

## Re-revue : cas de sortie avant ACK encore ouverts

La re-revue ferme les deux Important QA (source B exacte et purge Auth stable). Le cleanup de préparation de contexte est renforcé à son tour, avant même le retour de `prepareFresh`. Elle découvre trois autres cas produits : `dispose()` peut résoudre une attente de sortie avec le dernier statut ready sans ACK ; le booléen connected est false avant résolution initiale du projet, exposant la sortie legacy trop tôt ; une erreur GET de bibliothèque est masquée par la validation titre/count et n’offre aucun retry.

La racine reproduit le premier sur `adfe2f29c` : clic Projects avec PUT503 contrôlé encore retenu, puis changement Auth A→B ; le navigateur quitte réellement vers Projects sans ACK (**RED, sous-test5,91s, total58,63s**). Les autres parcours restent verts. Elle ajoute la fenêtre initiale GET retenu→sortie désactivée/sans write, puis chargement réel ; le writer corrige ce lot avant nouvelle re-revue. Le passage5/5 précédent ne couvrait pas ces nouveaux critères et ne constitue toujours pas une qualification finale.

Le build intermédiaire du snapshot complet `d139cc922`, exporté dans `/private/tmp/studio-build.ZXlxH2`, utilise uniquement un environnement allowlist production, aucune DB/provider, et une URL Auth loopback factice non joignable. Prébuild intégral vert et compilation optimisée42s réussie, puis lint bloque sur un nouveau `let queue` jamais réassigné. `4a1d7499d` le remplace par une constante typée ; la reprise du build est en attente. Deux warnings hooks hérités et un avertissement Supabase Edge sont distincts. Aucun fichier `.env` réel ou secret n’est exporté ; aucun artefact live n’est effacé.

La reprise sur `9deed7a2d`, export complet dans `/private/tmp/studio-build.eLy8GT`, termine **exit 0** : prébuild, compilation optimisée43s, lint/types, **867/867 pages**, optimisation/traces puis postbuild sitemap (un index, un sitemap). Les deux warnings hooks hérités, Supabase Edge et chaînes webpack volumineuses restent non bloquants. C’est une preuve intermédiaire : elle précède les derniers correctifs et Task5, donc ne remplace pas le build final de livraison.

Le contre-test navigateur initial a aussi confirmé que Projects reste activé pendant le GET retenu (**RED sur adfe2f29c, sous-test5,75s**). Avec le cas Auth/pending, la suite enrichie compte six tests et termine en64,50s avec deux sous-tests causaux rouges (plus leur parent). Les trois autres sous-tests restent verts. La revue indépendante approuve le paquet QA `d139cc922 + 9deed7a2d`, y compris son cleanup.

`6475a3d35` puis `b2ee9f500` figent les trois corrections produit : statut de dispose non-ready, mode unresolved explicite et boutons Projects désactivés, erreur bibliothèque séparée avec retry localisé dans le même dialogue. Le writer rapporte13/13 tests client/UI,58/58 architecture/contrats, TypeScript et lint ciblé verts. La racine ajoute la preuve navigateur GET503→erreur visible→Retry sans perte du titre/settings, ainsi que l’activation du vrai thème applicatif sombre. Ces nouvelles preuves et la re-revue corrective sont en cours ; aucun Approved produit anticipé.

Le navigateur sur `b2ee9f500` ferme les deux sorties causales (initial2,46s ; pending/Auth6,89s) et conserve recovery503/référence B verts. Le vrai thème sombre et la bibliothèque503→Retry avec titre/FPS conservés passent. Un nouveau défaut clavier apparaît ensuite : le déclencheur Retry est démonté et Échap ne ferme plus le dialogue (**RED UI6,08s, total66,85s**, quatre tests verts et le sous-test UI/parent rouges). Le focus doit rester dans le dialogue ; le test racine ajoute cette assertion sans forcer artificiellement le focus. Correction locale Studio demandée, hook modal partagé inchangé.
