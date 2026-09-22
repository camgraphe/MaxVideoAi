# Reprise — refonte admin MaxVideoAI

> Historical pause record. Work resumed at Adrien’s request. See [current validation and scope](2026-09-22-admin-redesign-validation.md) for the latest status; the open issues below describe the saved checkpoint, not the current implementation.

**Pause demandée par Adrien le 22 septembre 2026 pour changement possible de compte. Travail en cours, NON prêt à déployer.** Aucun nouveau développement après la demande de pause. Aucun push, déploiement ou changement de données de production effectué.

## Retrouver le travail

- Worktree : `/Users/adrienmillot/.codex/worktrees/admin-redesign/MaxVideoAi V2`
- Branche : `codex/admin-redesign`
- Base : `772eb4d8a4744e2bd829324ce929c0fab2cf7875` (origin/main au début).
- Le commit WIP de sauvegarde inclut code, tests, brief, ce document et captures locales. Utiliser cette branche, pas le checkout Desktop qui contient beaucoup de changements étrangers à cette tâche.
- Lire AGENTS.md, docs/engineering/llm-working-guide.md, admin-routes.md et les contrats applicables avant de reprendre.
- Brief : `2026-09-22-admin-redesign-brief.md`. Séquence : `2026-09-22-admin-redesign-implementation.md`.
- Maquettes V2 et captures réelles locales : `output/admin-redesign-2026-09-22/`. Données des maquettes et du preview fictives.

## Décisions utilisateur

Admin professionnel pour transmettre MaxVideoAI. Interface anglaise, claire, dense, SaaS, sans empilements de cartes. Cinq sections : Overview, Users, Transactions, Generations, Content ; Settings en bas. Aujourd’hui depuis minuit Europe/Madrid par défaut, dernières 24 h distinctes. Inscriptions et transactions prioritaires. Modération/articles conservés, insights regroupés, Search Console via lien externe. Theme tokens, membership et édition des prix des engines retirés de la navigation courante. La modification des prix reste gérée dans le code, mais les overrides DB actuels doivent impérativement conserver leur effet.

Playlists : ordre manuel et drag and drop indispensables. Direction future : destinations avec Featured + Automatic ou Manual, exclusions durables par destination, seulement médias explicitement publiés et éligibles. Ne pas exposer de médias privés. Cette automatisation N’EST PAS implémentée dans ce lot.

## Implémentation sauvegardée

- Shell compact et palette limitée à .admin-workspace ; navigation/contextes, Settings et liens externes.
- Overview serveur avec fenêtres Madrid/DST, inscriptions réelles ou indisponibilité explicite, activité wallet et incidents ; pas de faux KPI.
- Transactions : filtres/recherche dans les 100 lignes chargées, inspecteur latéral, distinction entre anomalie et simple possibilité de remboursement. Confirmation de remboursement existante préservée.
- Route /admin/pricing autorisée puis redirigée vers Settings. Engines devient lecture seule. Services, APIs, cache et précédence des prix conservés.
- Placements : recherche de destinations, lignes compactes, déplacement clavier en complément du drag existant, annulation d’ordre, confirmation de suppression, sauvegarde explicite.
- Reorder backend atomique via transaction PostgreSQL ; test réel de rollback ajouté (rouge avant, vert après).
- Guides/contrats/tests ciblés mis à jour. Traduction anglaise de certains écrans, pas encore exhaustive.

## Prix : invariant critique

Aucune écriture de production, aucun reset d’override, aucune migration de prix. Les 48 fichiers de propriétaires du pricing du manifeste `admin-redesign-handoff/pricing-reference.json` sont identiques à la référence avant modifications (recontrôlés au moment de la pause). Ce manifeste compare la base MAIN, **pas les prix effectifs actuellement en production**. Aucun export live des overrides n’a été fait. Retirer l’éditeur ne doit jamais faire tomber la précédence DB ni réintroduire des valeurs de fallback. Après réconciliation avec production, vérifier les valeurs effectives avant/après, les overrides persistés, les caches et les devis représentatifs avant intégration. Ne pas remplacer les overrides DB par la politique JSON sans inventaire et preuve de parité.

## Blocage intégration connu

Autre tâche : « Corriger la détection du plugin Max », thread `01a0c5a5-80a0-7a60-8200-056314ffceb8`. Elle réconciliait production et main via https://github.com/camgraphe/MaxVideoAi/pull/331 . Au dernier échange, production était `436a10063baac14bb80f3fd22423113360715df9`, déploiement `dpl_5ucWc1py4Lt3bTnVhqJwNjKwbAiF`, environ 120 fichiers devant main, y compris corrections pricing/Wan/MiniMax. Statut à revérifier à la reprise ; ne pas supposer PR331 fusionnée. Ne pas pousser/fusionner/déployer cette refonte avant réconciliation confirmée puis rebase et validation. Aucun PR admin créé.

## Mise à jour reçue après la pause

La tâche de réconciliation signale que PR331 est fusionnée et que main vaut désormais `6e3f7fd57d2d515ed8acae809f781f303a6d5d53`. Elle rapporte Quality CI verte (5906 tests réussis, 4 ignorés, 7 tests navigateur Studio et 18 admin) et preview Vercel READY. Ce sont les résultats de la réconciliation, **pas de cette refonte admin** ; non revérifiés dans cette tâche en pause.

À la reprise seulement : lire le nouveau paragraphe Production delivery d’AGENTS.md et docs/deployment/github-vercel.md, intégrer ce main dans le worktree isolé en préservant le checkpoint, puis recalculer la référence tarifaire. La confirmation du déploiement automatique sur les deux domaines était encore attendue au dernier message ; conserver l’attente avant toute fusion admin ou déploiement. Aucun rebase/merge ni nouveau développement effectué à réception de cette information.

## Confirmation finale de réconciliation reçue pendant la pause

La tâche propriétaire confirme que l’attente liée à PR331 est levée : `pnpm deployment:check` passe et GitHub main, maxvideoai.com et api.maxvideoai.com servent `6e3f7fd57d2d515ed8acae809f781f303a6d5d53`, déploiement READY `dpl_7JBytTrbYC2KeTd8KLQCrLwyGgUh`, source Git. Elle rapporte accueil/catalogue/4 pages Wan-MiniMax HTTP 200, MCP 401 attendu sans authentification, aucun événement error dans la fenêtre de logs vérifiée. La CI automatique après merge tournait encore sur le même arbre déjà vérifié. Informations rapportées par la tâche propriétaire, non revérifiées ici.

Cette confirmation remplace l’attente de réconciliation mentionnée plus haut, **pas la pause demandée par Adrien**. À la reprise : intégrer/rebaser sur ce main en préservant les changements, recalculer la référence tarifaire et passer par PR + Quality CI. Depuis un candidat committé/propre, exécuter `git fetch origin main` puis `pnpm deployment:check` immédiatement avant fusion ; contrôler les deux domaines après déploiement. Aucun upload CLI du checkout Desktop, promotion ou réaffectation manuelle des domaines hors exception explicitement autorisée. Aucun développement, rebase ou déploiement effectué pendant cette pause.

## Corrections prioritaires NON faites — revue indépendante

1. **TypeScript bloquant** : `frontend/components/admin/PlaylistsManager.tsx:194`, TS2328. Le callback explicite busy/startTransition accepte `() => void | Promise<void>` mais un hook attend React.TransitionStartFunction/VoidOrUndefinedOnly. Harmoniser le contrat avec le suivi asynchrone réel, sans perdre le verrou pendant la requête. Dernier tsc en échec ; ne pas annoncer build vert.
2. **Changement de playlist** : handleSelectPlaylist fait setSelectedId avant refreshPlaylistItems. Si GET échoue, les anciens items peuvent rester sous le nouvel identifiant et être sauvegardés au mauvais endroit. Ne valider sélection/items/snapshot qu’après succès ; tester échec et clics rapides. Un busyref a été ajouté, mais ne résout pas ce cas à lui seul.
3. **Overview** : fetchAdminOverview charge les inscriptions puis la finance en série. listUsers peut effectuer 100 pages sans délai limite. Lancer les sources indépendamment, imposer un délai borne avec arrêt des pages suivantes, préserver disponibilité partielle et tester panne/lenteur. Aucune lecture ne doit écrire de schéma.
4. Finir mise en forme du JSX (plusieurs lignes très longues), vérifier limite architecture du manager (500 lignes), terminer QA clavier/mobile/focus/Escape.
5. Pas de verrou optimiste entre deux admins pour l’ordre ; la transaction protège contre l’échec partiel, pas les modifications concurrentes. À traiter avant migration automatique plus large.

## Vérifications réellement faites

- Baseline : 49 tests ciblés passaient.
- Dernier lot élargi : 140/141 passaient ; seule assertion ancienne sidebar/infra-costs ensuite corrigée, **lot non relancé après correction**.
- Tests Madrid/DST, navigation, qualification des transactions et mouvement d’ordre passent dans les exécutions ciblées.
- Test PostgreSQL reorder/rollback : échec reproduit avant correction, succès après ; autre playlist intacte.
- ESLint frontend et lint:exposure : derniers logs sans erreurs / exposure passed. Changements finaux à revérifier.
- git diff --check : deux espaces de fin de ligne restent dans frontend/server/playlists/mutations.ts (lignes 110 et 118 au checkpoint).
- TypeScript : ÉCHEC actuel décrit ci-dessus. Aucun build complet vert ni E2E complet revendiqué.
- Browser local desktop 1440x900 : Overview + indisponibilité Auth explicite ; transactions 14 lignes, recherche, filtres et inspecteur ; placements Move up, Cancel, Save puis reload conserve l’ordre.
- Drag natif, mobile, Cmd+K, redirection pricing et accès non autorisé restent à tester. Les captures placements ont des vignettes manquantes à cause d’URLs de fixtures 404 ; pas une validation visuelle finale.

## Preview / outils de reprise

Dépendances installées avec `pnpm install --frozen-lockfile --offline`. Scratch ignoré `.local/admin-redesign/` : logs, manifeste original et `dev-db.ts`, script de preview avec PostgreSQL jetable, 14 jobs/receipts/items fictifs et bypass admin UNIQUEMENT local. Il ne faut jamais lui passer une DB production. Ce scratch n’est pas un livrable committé et peut manquer sur une autre machine. Le viewport navigateur a été restauré. Le serveur de preview est arrêté pour la pause ; aucun service de production arrêté.

Pour refaire les contrôles, consulter les scripts package.json et les tests ajoutés, notamment admin-reporting-window, admin-navigation, admin-transaction-review, admin-playlist-order et admin-playlist-order-postgres. Relancer les contrats admin, pricing-policy, `pnpm --dir frontend exec tsc --noEmit`, `npm --prefix frontend run lint`, `npm run lint:exposure`, `git diff --check`, puis smoke tests en environnement local isolé.

## Suite fonctionnelle

Finaliser et valider ce premier lot avant les modes automatiques/exclusions/migration des galeries. Restent notamment publication éditoriale, regroupement complet des insights/contenus, anglais exhaustif, recherche/pagination/périodes serveur des transactions. Garder les lecteurs publics, URLs, auth, sources médias et comportements de facturation inchangés sans tests dédiés. La refonte globale n’est pas terminée.

## Message à donner au prochain compte

« Reprends la refonte admin MaxVideoAI dans la branche codex/admin-redesign, worktree /Users/adrienmillot/.codex/worktrees/admin-redesign/MaxVideoAi V2. Commence par docs/plans/2026-09-22-admin-redesign-handoff.md. Le travail est en pause, pas prêt à déployer. Corrige les trois points bloquants et conserve absolument les prix effectifs et overrides DB. Vérifie la réconciliation production/main avant toute intégration. »
