# Studio connecté — plan d'implémentation du 8 septembre 2026

## Contrat et provenance

Spécification : `docs/superpowers/plans/2026-09-08-app-studio-parallel-roadmap.md`, source `ef3393c0d22418ce471b9a4cea9d098eded32801` dans la worktree coordinatrice `3f9b`. Tâche coordinatrice : `01a07920-6fc3-7131-911d-321ce840ffdd`.

Travail exclusivement dans `/Users/adrienmillot/.codex/worktrees/dce6/MaxVideoAi V2`, branche `codex/studio-connected-editor`, créée depuis `ab2cb9fbd552e2eab7b07b8c519aff0f219e1d07`. Worktree liée vérifiée, état initial propre. Aucun serveur ni test n'a encore été lancé.

Sources à composer :

- App qualifiée : `codex/app-catalogue-validation`, source `45c45a812`, documentation `0eb139aa5`, contrat `ef3393c0d`. Importer son historique dans cette branche en conservant les correctifs plus récents de main.
- Studio historique : `codex/maxvideoai-editor`, `6165afc34bb27b8b3dc2d05074b09cdcdb44c13f`. Ancêtre commun avec main : `0ba601be45b1878cdfa1c05e0997d3b2beefad09`. Son arbre entier est obsolète pour le catalogue et les API ; importer les propriétaires Studio et leurs dépendances identifiées seulement.
- État local historique : `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/maxvideoai-editor-run`, incluant la certification et les faits partagés de génération non commités. Inventorier chaque chemin repris et son hash dans un manifeste de provenance ; relire l'état source après import.

## Contraintes globales

Possession : routes, composants et styles locaux Studio ; adaptateur médias ; commande de montage MCP. Activity, créateurs hors Studio, bibliothèque/réutilisation partagée, CSS global app et Billing/Wallet appartiennent aux tâches coordinatrices. Les dépendances partagées indispensables font l'objet d'un commit séparé avec interface documentée. Ne pas dupliquer le catalogue, le calcul de devis ou la validation des modèles.

Préserver anciens projets, tuples modèle/bloc/workflow certifiés, références exactes (départ/fin/collections), budgets propres aux modèles, prix avant génération, audio, mobile et clavier. Préserver originaux et identités canoniques ; miniatures réservées à l'affichage. Pas d'édition audio avancée supplémentaire.

Port local distinct de 3026. Aucun push, déploiement, merge dans main ou branche app source, génération payante ou écriture de production. Tests PostgreSQL uniquement sur instance jetable locale créée pour cette tâche ; ne pas utiliser d'URL distante héritée ni la copie Neon de l'app. Aucun secret ou `.env` dans les artefacts de provenance ou documentation.

## Task 1: Composer et qualifier le socle

1. Inventorier différences Git, actions, contrats, modèles certifiés, médias, persistance et dépendances Studio.
2. Composer l'app qualifiée avec le main récent dans cette branche ; résoudre les conflits en préservant les deux responsabilités.
3. Importer sélectivement Studio depuis son commit, puis les changements locaux pertinents, en deux commits traçables. Conserver API et catalogue actuels ; adapter seulement les interfaces indispensables.
4. Restaurer les commandes test/QA et dépendances nécessaires. Lancer contrats Studio, TypeScript et audit architecture ; documenter les défauts hérités avant refonte.

Livrables : manifeste de provenance, inventaire des actions, socle compilable, limites d'environnement connues.

## Task 2: Appliquer la direction visuelle et les interactions

1. Lire le prototype accepté et ses règles ; capturer le Studio importé sur la prévisualisation locale.
2. Refaire la hiérarchie des blocs et de la sélection, insertion, menus, connexions et inspecteur dans leurs propriétaires locaux. Réutiliser logos/pictogrammes/tokens adaptés ; réduire texte et bordures imbriquées.
3. Préserver contrôles modèle issus de la policy commune et retour de validation/prix. Rendre les actions de connexion/insertion accessibles au clavier et au toucher.
4. Vérifier canevas, viewer, timeline, panneaux, menus, focus, audio et réduction des animations en desktop/mobile, clair/sombre.

Livrables : refonte effective, captures et vérifications d'interactions. Captures seules non recevables comme preuve de performance.

## Task 3: Connecter bibliothèque et récents

1. Adapter les propriétaires actuels bibliothèque/récents vers les assets Studio image/vidéo/audio, avec identité canonique et original exact.
2. Exposer ajout au projet/canevas/timeline selon compatibilité réelle, avec commandes explicites et alternatives au dépôt.
3. Qualifier remplacement, retrait, annulation et sauvegarde/rechargement ; préserver médias et état non concernés.
4. Tester sélection intercomptes interdite, métadonnées inconnues non inventées, média audio visible et conservé.

Livrables : adaptateur local et parcours réels ; tout changement partagé isolé et documenté.

## Task 4: Créer une timeline persistée via UI et MCP

1. Définir une commande métier commune recevant une liste ordonnée explicite de clips vidéo appartenant au compte, et créant un nouveau projet + séquence ouvrable dans Studio.
2. Réutiliser résolveur média/validation et insertion timeline existants. Préserver audio embarqué connu sans introduire montage audio avancé.
3. Persister atomiquement projet, assets, séquence et clé d'idempotence ; rejeter conflit de clé/payload et contenu invalide sans état partiel.
4. Protéger la coexistence autosave par révisions et conflits explicites. L'autosave historique supprimant les séquences absentes, aucun lancement n'est qualifié tant que ce risque n'est pas couvert.
5. Brancher API UI et outil MCP sur cette commande ; conserver `prepare_montage` comme plan `persisted:false` avec son gate existant.
6. Tester ordre, ownership, validation, rejeu, concurrence, atomicité, réouverture et sauvegarde avec PostgreSQL jetable local vérifié.

Livrables : commande, migration bornée, tests de persistance, lien Studio réel retourné après commit de transaction.

## Task 5: Qualification et remise pour revue

1. Exécuter contrôles ciblés puis lint, exposure, TypeScript, contrats, registre et build adaptés.
2. Vérifier les parcours au navigateur avec jeux de données locaux, états vides/erreur, desktop/mobile et clair/sombre. Fournir mesures comparables si la charge initiale est modifiée.
3. Revue indépendante des changements ; corriger les problèmes bloquants et documenter précisément les environnements non disponibles.
4. Garder branche et prévisualisation pour revue ; livrer commits, chemins d'accès, preuves et limites sans intégrer.

## Préflight : interfaces communes et décisions

| Tâches | Interface | Décision |
| --- | --- | --- |
| 1 / 2 | Contrats Studio importés et CSS locaux | Garder propriétaires et tests ; mesurer la base avant modifications visuelles. |
| 1 / 3 | Médias app actuels et assets Studio historiques | Adapter localement ; originaux/identités ne sont pas des URLs de miniature. |
| 1 / 4 | Ancienne persistance sans révision | Ajouter protection de concurrence avant qualification MCP. |
| 2 / 3 | Boutons et menus d'insertion | Une commande par intention ; toucher/clavier et dépôt partagent la règle. |
| 3 / 4 | Conversion média vers timeline | Réutiliser les mêmes règles pures, validation serveur renforcée par ownership. |
| 4 / 5 | Écriture DB et tests | Instance jetable locale uniquement ; aucune URL héritée. |
| 1, 2, 3, 4, 5 | Cohérence de chaque tâche | Tests fonctionnels aux frontières à risque ; vérification visuelle pour styles et gestes ; aucune promesse de performance sans mesure. |

Décision : importer Studio sélectivement — son arbre complet remplace des propriétaires partagés récents ; une dépendance omise se détectera en compilation/contrats et sera ajoutée explicitement.

## Progression

- Branche isolée créée ; contrat de coordination et instructions Studio lus.
- Audits en lecture seule en cours ; aucun code produit modifié, aucun environnement distant utilisé.
