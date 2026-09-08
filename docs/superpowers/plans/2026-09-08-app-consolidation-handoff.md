# Consolidation app et Studio — 8 septembre 2026

L’utilisateur demande de fermer les tâches terminées ou transférables pour recentrer le chantier sur une ou deux tâches. La principale et Studio restent actives. Les quatre autres ont remis une passation, arrêté leurs previews et tests, puis été archivées par le coordinateur. Leurs HEAD et l’absence de changements suivis/non suivis ont été vérifiés avant archivage. L’archivage a retiré les worktrees associés ; les branches et commits indiqués ci-dessous préservent le code et les passations. Les travaux inachevés sont repris ici : archiver leur tâche n’est pas les valider ni les abandonner.

## Responsabilités actuelles

| Tâche | Responsabilité |
| --- | --- |
| Principale `01a07920-6fc3-7131-911d-321ce840ffdd` | Création, médias, activité, audio, toolbox, billing, cohérence visuelle, intégration et validation combinée |
| Studio `01a07e2a-7f4d-7c83-b24d-11b6008f00d9` | Refonte du canevas/éditeur, médias du projet et timeline MCP vidéo minimale, revue et raccord avec la principale |

Studio a confirmé ne plus solliciter les tâches archivées. Les contrats partagés et intégrations passent par la principale. Les agents internes exécutent et relisent des incréments bornés dans cette tâche ; aucune nouvelle tâche de barre latérale n’est ouverte.

## Checkpoints archivés et vérifiés

| Périmètre / tâche | Branche | Worktree | HEAD préservé |
| --- | --- | --- | --- |
| Audio `01a07e47-84df-7543-996d-74d39d496c67` | `codex/audio-creative-workspace` | `/Users/adrienmillot/.codex/worktrees/1d03/MaxVideoAi V2` | `e274b0871e61e00dc7046ef85f86e3016044da21` |
| Toolbox `01a07e3c-37a3-7691-a1c1-497e34094416` | `codex/connected-toolbox` | `/Users/adrienmillot/.codex/worktrees/8710/MaxVideoAi V2` | `2d55db286acccf1efed5a331d80e343c55800e20` |
| Billing `01a07e2c-1d46-7ef2-bdc5-abc017ee2332` | `codex/billing-wallet-refonte` | `/Users/adrienmillot/.codex/worktrees/6820/MaxVideoAi V2` | `4e62dd9b395091bb8ca16e5763ef0dc4886ed599` |
| Activity `01a07e2c-ba9d-73d2-8a87-07f7efc04d14` | `codex/activity-first-load-latency` | `/Users/adrienmillot/.codex/worktrees/0b3f/MaxVideoAi V2` | `8e0867b95abc7e34ffb6871b993d8ad7b6fa1a21` |

Les fichiers de passation restent accessibles dans les commits indiqués, même sans leur worktree. Les autres tâches utilisateur et le prétravail « Étudier une toolbox d’outils » ne sont pas modifiés.

## Audio

Le socle des cinq intentions (voix off, instrumental, chanson, SFX, ambiances), les correctifs de sécurité/isolation et la navigation immédiate sont déjà intégrés dans la principale. La tarification demandée directement par l’utilisateur — coût fournisseur ×3, arrondi supérieur final à 0,05 USD — est intégrée via `0fa32ca40` et `f23f4b0f7` (sources `6a8470c01`, `974ea3046`). La revue indépendante du correctif de parité admin/débit est PASS. Aucun changement de règle en production n’a été exécuté.

- Le helper d’upload `746a0cf49` est intégré en `9c9bc9ea4`, après le contrat `8a74ab753` → `1830bf652` et le runtime `4c986b84e` → `f55401ad7`. Revue indépendante PASS. Références canoniques et faits mesurés sont disponibles sans importer le canevas Studio.
- `e274b0871` : **WIP non validé**, factory de repository de devis et extraction de réservation/exécution Audio. Aucun outil MCP Audio, recovery ni presenter Audio n’est encore implémenté. Les précédents tests MCP quote/trial avaient 15 PASS et 9 échecs sur deux symboles, corrigés ensuite mais non retestés. Le typecheck global de ce checkpoint n’est pas qualifié. Ne pas importer comme fonctionnalité achevée.
- Reprendre découverte/préparation/confirmation Audio avec les propriétaires de devis et de génération existants, réservations wallet/job/claim atomiques, limites cumulatives et reprise idempotente. Pas de worker durable existant : ne pas promettre la récupération après crash du processus.
- High quality reste indisponible tant que les routes et résultats ne sont pas qualifiés. Le transfert Studio attend son destinataire réel.

Passation complète dans le commit `e274b0871` : `docs/engineering/audio-handoff-2026-09-08.md`. Les preuves annoncées par la source sont 4 531 tests pour le lot prix, 27 + 50 ciblés pour sa correction et 9 pour la navigation ; elles ne remplacent pas la validation de la composition root. Previews 3042/3044 arrêtées.

## Toolbox

Le catalogue et les ateliers existants sont intégrés jusqu’au source `0daf78d1a` (root `dd70c1e33`). Le P0 `b6ea6b36a` et sa passation `2d55db286` sont importés en `9352538a7` et `54a0770c1`, avec activation toujours bloquée.

Il couvre Restore Video, Denoise, Fix Blur et Smooth Motion, leurs formulaires et chaîne devis/job/résultat. Standard/Pro sont prévus sauf Fix Blur sans Pro. **Les sept profils restent non qualifiés**, registre vide et exécution bloquée avant débit ; les cartes indiquent « En validation ». La revue a trouvé trois défauts à corriger : mauvais propriétaire dans le polling générique Fal, course entre remboursement et finalisation, contrôle de résolution Restore trop permissif. Le plan `2026-09-08-toolbox-p0-integration-fixes.md` reprend ces corrections. La qualification de qualité/fidélité/coût et le raccord Studio/MCP restent à terminer. Le budget Topaz ne constitue pas une formule de facture démontrée.

Migration `42_toolbox_finishing_pricing.sql` : règle dédiée ×2,5, préparée et testée seulement sur PostgreSQL jetable. Vérifier le numéro avant intégration ; aucune migration distante implicite. Cette politique est distincte de celle de l’Audio. Sans règle explicite, le serveur refuse le fallback DB générique.

La finalisation/remboursement dépend encore du prochain status read. Le correctif prévu fait déléguer ces jobs par le cron existant, de façon bornée, pour ne pas dépendre d’une nouvelle visite de l’utilisateur. Il ne crée pas de scheduler ni de resoumission. Smart Reframe, Subtitles, Clean Audio, Remove Object et Extend Clip restent des sujets ultérieurs.

Passations source : `docs/plans/2026-09-08-toolbox-handoff.md`, `2026-09-08-toolbox-validation.md` et `2026-09-08-toolbox-finishing-tools.md`. Source : 4 503 tests, 43 ciblés dont PostgreSQL jetable, types/lint/exposure/diff et build isolé 864 pages PASS. Preview 3036 arrêtée. Aucune génération payante ni qualification fournisseur réalisée.

## Billing / Wallet

Lot intégré depuis les commits `6881912f3`, `efab64415`, `2a2e3e5f7`, `fa716e8a0`, `ba69fc421`, `adad5cc78`, puis le checkpoint de reproductions `4e62dd9b3`. La fusion de composition historique est écartée. `adad5cc78` remplace `56359a902` et ne change que la documentation.

La première revue avait demandé trois corrections :

1. Le premier rendu du compte B peut afficher le solde et les reçus privés de A avant nettoyage par effet. Il faut masquer synchroniquement par propriétaire confirmé.
2. Un retour `?status=success` avant hydratation auth est consommé sans lancer ensuite la réconciliation. Différer la consommation jusqu’à l’auth résolue et au compte présent.
3. Le premier rendu après USD→EUR peut encore afficher l’ancien devis avec `loading=false`. Taguer et masquer synchroniquement par identité complète du devis, en conservant les gardes contre callbacks périmés/ABA.

Ces défauts ont été reproduits puis corrigés en `c453e604b` avec un propriétaire de requêtes commun, le masquage au rendu et la réconciliation différée jusqu’à l’auth confirmée. Les 42 tests ciblés, le lint Billing et le typecheck réel frontend passent. Rapport `5ecfaecec`. La relecture indépendante du correctif et la QA visuelle de la composition restent requises avant acceptation. Le plan `2026-09-08-billing-read-latency.md` traite séparément les deux GET qui relancent encore le bootstrap global du schéma ; les observations de développement ne constituent pas une comparaison contrôlée.

Preuves antérieures et captures : `docs/superpowers/reviews/2026-09-08-billing-wallet-refonte.md`, `output/playwright/billing-wallet/` dans la branche source. Preview 3037 arrêtée.

## Activity et chemins de lecture

L’optimisation Activity initiale et ses corrections sont intégrées. Le dernier lot est également importé : `c05eac936` → `146d6a74e` (wallet/preflight/exports), `fe6b74967` → `f10e71da7` (documentation/mesures), `8e0867b95` → `2d8332e08` (parité de projection des réglages système). Les 41 tests ciblés de composition prix/lectures passent.

La revue indépendante finale de `8e0867b95` est PASS : 240 projections comparées à l’ancien seed, quatre tests ciblés passés, cas admin/canary/unknown/disabled préservés. Rapports root : `.superpowers/artifacts/2026-09-08-wallet-preflight-integration-review.md` et `2026-09-08-wallet-preflight-integration-rereview.md`. Aucun défaut connu ouvert après correction, sous réserve de composition.

La source annonce 4 486 tests, types/lints et build 861 pages PASS ; aucun test/preview restant. Ses mesures serveur ne sont pas des mesures CWV navigateur et n’ont pas été rejouées après la dernière projection pure. Guides durables : `docs/engineering/read-route-schema-bootstrap.md`, `docs/superpowers/reviews/2026-09-08-shared-read-route-latency.md`. Les schémas doivent être initialisés et migrés explicitement ; pas de DDL automatique réintroduit dans les GET.

## Reprise dans la principale et synchronisation Studio

1. Le panneau de comparaison modèle est accepté après `3cfdfbb5c` : une auth temporairement en rafraîchissement masque la mémoire, puis la restaure seulement au même compte confirmé. Rapport indépendant `task-2-rereview.md` PASS.
2. Terminer la relecture Billing, les corrections du P0 Toolbox et la latence des lectures Billing. Traiter chaque incrément avec ses dépendances, sans fusion globale des anciens worktrees.
3. La continuité du brouillon actif est en cours dans la principale. Terminer ensuite le retour vers un emplacement de référence et la passe visuelle commune (menus/modales, références, médias, mobile et barre de prix Audio). La sauvegarde au changement de modèle ne résout pas à elle seule la perte des références après navigation.
4. Studio a corrigé ses trois réserves en `eb791a266` et reçu une revue indépendante PASS. Il termine les médias/runtime et la timeline MCP vidéo. Le multiplicateur hérité d’export 1440p tombe sur 1 alors que 1080p vaut 1,5 ; la correction du renderer n’autorise pas à inventer une nouvelle politique tarifaire. À traiter avant export réel.
5. Le runtime média partagé est intégré une seule fois. Terminer les raccords Audio/Toolbox/Studio et le plan `2026-09-08-mcp-audio-completion.md`. La validation globale et les contrôles visuels de la composition sont réalisés ici ; les tests séparés des anciennes tâches ne suffisent pas.

La principale était propre à `f23f4b0f7` au moment de cette consolidation. Aucun push, déploiement, paiement ni mutation production n’est réalisé par l’archivage.
