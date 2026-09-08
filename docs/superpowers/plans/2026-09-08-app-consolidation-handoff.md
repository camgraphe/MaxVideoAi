# Consolidation app et Studio — 8 septembre 2026

L’utilisateur demande de fermer les tâches terminées ou transférables pour recentrer le chantier sur une ou deux tâches. La principale et Studio restent actives. Les quatre autres ont remis une passation, arrêté leurs previews et tests, puis été archivées par le coordinateur. Leurs HEAD et l’absence de changements suivis/non suivis ont été vérifiés avant archivage. Aucun travail n’a été supprimé, aucun checkpoint incomplet n’a été considéré comme une livraison validée.

## Responsabilités actuelles

| Tâche | Responsabilité |
| --- | --- |
| Principale `01a07920-6fc3-7131-911d-321ce840ffdd` | Création, médias, activité, audio, toolbox, billing, cohérence visuelle, intégration et validation combinée |
| Studio `01a07e2a-7f4d-7c83-b24d-11b6008f00d9` | Refonte du canevas/éditeur, médias du projet et timeline MCP vidéo minimale, revue et raccord avec la principale |

Studio a confirmé ne plus solliciter les tâches archivées. Les contrats partagés et intégrations passent par la principale. Les reviewers internes ont terminé leurs rapports ; aucun nouveau chantier parallèle n’est lancé pour cette consolidation.

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

- `746a0cf49` : helper d’upload Audio conservant la référence canonique et les faits mesurés. Dépend du contrat/runtime Studio `4c986b84e`, à importer une fois depuis son propriétaire. Pas encore intégré.
- `e274b0871` : **WIP non validé**, factory de repository de devis et extraction de réservation/exécution Audio. Aucun outil MCP Audio, recovery ni presenter Audio n’est encore implémenté. Les précédents tests MCP quote/trial avaient 15 PASS et 9 échecs sur deux symboles, corrigés ensuite mais non retestés. Le typecheck global de ce checkpoint n’est pas qualifié. Ne pas importer comme fonctionnalité achevée.
- Reprendre découverte/préparation/confirmation Audio avec les propriétaires de devis et de génération existants, réservations wallet/job/claim atomiques, limites cumulatives et reprise idempotente. Pas de worker durable existant : ne pas promettre la récupération après crash du processus.
- High quality reste indisponible tant que les routes et résultats ne sont pas qualifiés. Le transfert Studio attend son destinataire réel.

Passation complète dans le commit `e274b0871` : `docs/engineering/audio-handoff-2026-09-08.md`. Les preuves annoncées par la source sont 4 531 tests pour le lot prix, 27 + 50 ciblés pour sa correction et 9 pour la navigation ; elles ne remplacent pas la validation de la composition root. Previews 3042/3044 arrêtées.

## Toolbox

Le catalogue et les ateliers existants sont déjà intégrés jusqu’au source `0daf78d1a` (root `dd70c1e33`). Le nouvel incrément P0 se reprend séparément : `b6ea6b36a`, puis documentation/passation `2d55db286`.

Il couvre Restore Video, Denoise, Fix Blur et Smooth Motion, leurs formulaires et chaîne devis/job/résultat. Standard/Pro sont prévus sauf Fix Blur sans Pro. **Les sept profils restent non qualifiés**, registre vide et exécution bloquée avant débit ; les cartes indiquent « En validation ». Il reste une revue d’intégration, la qualification de qualité/fidélité/coût et le raccord Studio/MCP. Le budget Topaz ne constitue pas une formule de facture démontrée.

Migration `42_toolbox_finishing_pricing.sql` : règle dédiée ×2,5, préparée et testée seulement sur PostgreSQL jetable. Vérifier le numéro avant intégration ; aucune migration distante implicite. Cette politique est distincte de celle de l’Audio. Sans règle explicite, le serveur refuse le fallback DB générique.

La finalisation/remboursement dépend du prochain status read ; aucun sweeper/webhook ni reprise historique multi-appareils n’est livré. Ces limites doivent être résolues ou assumées explicitement avant activation. Smart Reframe, Subtitles, Clean Audio, Remove Object et Extend Clip restent des sujets ultérieurs.

Passations source : `docs/plans/2026-09-08-toolbox-handoff.md`, `2026-09-08-toolbox-validation.md` et `2026-09-08-toolbox-finishing-tools.md`. Source : 4 503 tests, 43 ciblés dont PostgreSQL jetable, types/lint/exposure/diff et build isolé 864 pages PASS. Preview 3036 arrêtée. Aucune génération payante ni qualification fournisseur réalisée.

## Billing / Wallet

Lot **pas encore intégré**. Reprendre les commits `6881912f3`, `efab64415`, `2a2e3e5f7`, `fa716e8a0`, `ba69fc421`, `adad5cc78`, puis le checkpoint de reproductions `4e62dd9b3`. Éviter la fusion de composition historique. `adad5cc78` remplace `56359a902` et ne change que la documentation.

La revue indépendante reste REQUEST CHANGES :

1. Le premier rendu du compte B peut afficher le solde et les reçus privés de A avant nettoyage par effet. Il faut masquer synchroniquement par propriétaire confirmé.
2. Un retour `?status=success` avant hydratation auth est consommé sans lancer ensuite la réconciliation. Différer la consommation jusqu’à l’auth résolue et au compte présent.
3. Le premier rendu après USD→EUR peut encore afficher l’ancien devis avec `loading=false`. Taguer et masquer synchroniquement par identité complète du devis, en conservant les gardes contre callbacks périmés/ABA.

`tests/billing-account-ownership-render.test.ts` reproduit le premier défaut (rouge attendu). `tests/billing-auth-and-quote-render.test.ts` a été ajouté mais non exécuté à l’arrêt ; l’API Checkout n’accepte pas encore les paramètres d’auth requis. Ce checkpoint est volontairement incomplet. Reprendre les fixes et ces tests avant qualification ; ne pas annoncer le lot prêt sur la base des anciens 4 488 tests / build / captures.

Preuves antérieures et captures : `docs/superpowers/reviews/2026-09-08-billing-wallet-refonte.md`, `output/playwright/billing-wallet/` dans la branche source. Preview 3037 arrêtée.

## Activity et chemins de lecture

L’optimisation Activity initiale et ses corrections sont intégrées. Le dernier lot à reprendre est `c05eac936` (wallet/preflight/exports), `fe6b74967` (documentation/mesures), `8e0867b95` (parité de projection des réglages système).

La revue indépendante finale de `8e0867b95` est PASS : 240 projections comparées à l’ancien seed, quatre tests ciblés passés, cas admin/canary/unknown/disabled préservés. Rapports root : `.superpowers/artifacts/2026-09-08-wallet-preflight-integration-review.md` et `2026-09-08-wallet-preflight-integration-rereview.md`. Aucun défaut connu ouvert après correction, sous réserve de composition.

La source annonce 4 486 tests, types/lints et build 861 pages PASS ; aucun test/preview restant. Ses mesures serveur ne sont pas des mesures CWV navigateur et n’ont pas été rejouées après la dernière projection pure. Guides durables : `docs/engineering/read-route-schema-bootstrap.md`, `docs/superpowers/reviews/2026-09-08-shared-read-route-latency.md`. Les schémas doivent être initialisés et migrés explicitement ; pas de DDL automatique réintroduit dans les GET.

## Reprise dans la principale et synchronisation Studio

1. Terminer la réserve ouverte du panneau de comparaison modèle : la mémoire de configurations doit survivre à une auth temporairement en rafraîchissement, rester masquée, puis redevenir accessible seulement au même compte confirmé. `479746879` est intégré mais la Task 2 reste non acceptée tant que ce cas n’est pas corrigé et revu. Rapport `.superpowers/sdd/2026-09-08-workspace-model-review/task-2-review.md`.
2. Intégrer le dernier lot de lecture Activity accepté, puis reprendre les fixes Billing et la revue du P0 Toolbox. Traiter chaque incrément avec ses dépendances, sans fusion globale des anciens worktrees.
3. Appliquer le plan de continuité du brouillon actif et terminer la passe visuelle commune (menus/modales, références, médias, mobile et barre de prix Audio). La sauvegarde au changement de modèle ne résout pas à elle seule la perte des références après navigation.
4. Studio poursuit ses trois corrections de revue (Mock Chat purement local / Live Chat refusé tant que le contrat canonique de devis n’existe pas, rendu 1440p, identité d’export par compte + clé exacte), puis médias/runtime et timeline MCP vidéo. Le multiplicateur hérité d’export 1440p tombe sur 1 alors que 1080p vaut 1,5 ; la correction du renderer n’autorise pas à inventer une nouvelle politique tarifaire. À traiter avant export réel.
5. Intégrer le runtime média partagé une seule fois, raccorder Audio/Toolbox/Studio, puis poursuivre le MCP Audio sauvegardé. La validation globale et les contrôles visuels de la composition sont réalisés ici ; les tests séparés des anciennes tâches ne suffisent pas.

La principale était propre à `f23f4b0f7` au moment de cette consolidation. Aucun push, déploiement, paiement ni mutation production n’est réalisé par l’archivage.
