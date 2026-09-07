# Studio connecté — qualification en cours

Branche de revue `codex/studio-connected-editor`, worktree `dce6`. Ce document distingue les contrôles effectivement exécutés des travaux encore ouverts. Aucune qualification de déploiement n'est annoncée.

## Socle

Le socle composé au commit `e101e2840` conserve l'app qualifiée et le main récent, puis importe le Studio committé et ses travaux locaux avec les manifestes `studio-import/`. Les sources n'ont pas été modifiées.

- Node 22 : 413 tests ciblés réussis.
- QA Studio : 388 tests, TypeScript et lint réussis ; deux warnings hérités documentés dans le rapport de socle.
- Revue indépendante des adaptations : approuvée, 83 tests supplémentaires ciblés réussis. Le guide export a été corrigé pour refléter le plafond réel de 512 MiB.
- La concurrence financière entre export et autres créateurs, le worker distant et les services de production ne sont pas qualifiés par ces tests.

## Prévisualisation sûre

`pnpm dlx node@22 scripts/studio-local-preview.mjs` lance le Studio sur `http://127.0.0.1:3032/app/studio/projects`, avec un service d'authentification **anonyme et factice** sur 3033. Le port 3026 est exclu, y compris pour le service adjacent. Le lanceur refuse les fichiers d'environnement et ne transmet qu'une liste explicite de variables non sensibles. Il ne possède pas de connexion DB, fournisseur, stockage ou paiement. Les brouillons sont locaux ; cette prévisualisation seule ne prouve pas la persistance serveur.

`tests/studio-local-preview-contract.test.ts` vérifie les ports et l'absence d'héritage des configurations sensibles : 2/2 réussis.

## PostgreSQL jetable

Le test `tests/connected-montage-disposable-postgres.test.ts` utilise le helper local existant : nouveau répertoire unique, cluster PostgreSQL 17, socket Unix seulement, aucune adresse réseau d'écoute, écriture et lecture d'une ligne, arrêt et nettoyage dans `finally`. Il ne lit pas une URL de base héritée. Le préfixe court `stpg` respecte la limite de chemin de socket sur macOS.

Commande vérifiée, 1/1 réussi :

```sh
PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" pnpm dlx node@22 frontend/node_modules/tsx/dist/cli.mjs --tsconfig frontend/tsconfig.json --test tests/connected-montage-disposable-postgres.test.ts
```

Ce test démontre la disponibilité de l'environnement, pas encore la commande de montage ni sa concurrence.

## Référence visuelle et mesures avant refonte

Le contrôle réel desktop 1440×900 et mobile 390×844, clair et sombre, constate des blocs trop miniaturisés, des actions non nommées et un débordement mobile. Les captures de référence sont des artefacts locaux de travail ; elles ne constituent pas une mesure de performance.

Le test de stress hérité utilisait un média absent. La fixture a été corrigée vers le média local existant `watch-wan-3-prime-scroll.mp4` (6 secondes, 1920×1080 vérifiés par ffprobe) et le WAV local. Les API compte/persistance et consentement, étrangères à la mesure de rendu, sont simulées. Les lecteurs, interactions et requêtes de médias restent réels.

La mesure BEFORE a été exécutée sur une copie temporaire **figée du commit `332bf4abf`**, distincte de la worktree en refonte, sur le port 3034. Contexte navigateur neuf, viewport 1280×720, Next en développement, 80 blocs et 150 éléments de timeline. Un passage réussi :

| Mesure | Avant |
| --- | ---: |
| Requêtes média avant première lecture | 150 |
| Requêtes média sur tout le parcours | 203 |
| Première commande Play jusqu'à progression du playhead | 353 ms |
| Scrub jusqu'à position attendue | 85 ms |
| Déplacement d'un clip avec geste automatisé | 1 646 ms |
| Deux incréments de zoom timeline | 157 ms |
| Pan du canevas avec geste automatisé | 540 ms |

Ces temps comprennent les gestes et assertions du navigateur, ne sont ni des Core Web Vitals ni un benchmark de production. Le chargement initial élevé provient notamment de toutes les couches timeline montées avec préchargement automatique ; il reste à comparer après le lot. Aucune amélioration de performance n'est encore revendiquée.

## Contrôles restant ouverts

Refonte et interactions complètes, parcours bibliothèque/récents avec identités canoniques, commande UI/MCP persistée, sauvegarde concurrente, réouverture sans cache local, matrice responsive et build final restent à exécuter. `prepare_montage` demeure un plan non persisté et ne satisfait pas ces critères.
