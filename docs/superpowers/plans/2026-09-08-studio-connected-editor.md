# Studio connecté — plan d'implémentation du 8 septembre 2026

## Contrat et provenance

Spécification : `docs/superpowers/plans/2026-09-08-app-studio-parallel-roadmap.md`, source `ef3393c0d22418ce471b9a4cea9d098eded32801` dans la worktree coordinatrice `3f9b`. Tâche coordinatrice : `01a07920-6fc3-7131-911d-321ce840ffdd`.

Travail exclusivement dans `/Users/adrienmillot/.codex/worktrees/dce6/MaxVideoAi V2`, branche `codex/studio-connected-editor`, créée depuis `ab2cb9fbd552e2eab7b07b8c519aff0f219e1d07`. Worktree liée vérifiée, état initial propre.

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

Décisions issues du contrôle réel du socle :

- Création nommée Texte / Image / Vidéo / Audio : activation au clavier, clic ou toucher crée exactement un bloc au centre visible ; dépôt conserve le placement précis. Pas d'action armée qui ne peut se terminer qu'à la souris.
- Sélection indépendante de l'inspecteur : bande d'actions à taille écran, Réglages explicites, fermeture sans perdre la sélection. Connexions par sélection d'une source compatible et retrait annullable, avec la même validation que les poignées.
- Un titre de projet, surfaces Canevas / Viewer, panneau lisible, menus peu profonds. Le contenu des sources et sorties domine ; prix et état de devis demeurent exacts. Contrôles avancés restent disponibles dans l'inspecteur canonique.
- Actions clips/pistes accessibles sans clic droit. Audio visible et préservé ; pas de faux bouton Play sur une image ou un média indisponible.
- Grille de qualification :1440×900,390×844,320px et844×390 ; clair/sombre, clavier/toucher et réduction des mouvements. L'interface importée déborde sur mobile et miniaturise trop les blocs : ces défauts sont à corriger, pas à reprendre.
- Terminologie coordonnée : Image de début / Image de fin / Références (Start frame / End frame / References ; Imagen inicial / Imagen final / Referencias). Garder les rôles particuliers et tous les IDs/slots/budgets.

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
- Socle app/main composé en `3bb6188e0`, Studio committé et local importés séparément (`2975d7e3a`, `11dc9213b`) avec manifestes ; adaptations partagées isolées, socle final `e101e2840`.
- Task1 :413 tests Node22 réussis, TypeScript et lint réussis (deux warnings hérités) ; revue indépendante approuvée. Voir `docs/engineering/studio-import/` pour provenance, interfaces et exclusions explicites. Les34 fichiers de la copie source ont été revérifiés par SHA-256 le8septembre : aucun changement depuis le manifeste, HEAD source toujours6165afc34.
- Prévisualisation séparée :3032, auth anonyme locale3033 ; lanceur `scripts/studio-local-preview.mjs` refuse les fichiers d'environnement et ne transmet aucune configuration DB/génération/paiement/stockage.
- Raccord Toolbox : contrat additionnel source `faf137284`, propriétaire `01a07e3c-37a3-7691-a1c1-497e34094416`. Studio consomme identités et contrôles sans créer un second catalogue. Essai d'intégration requis avant livraison ; anciens projets non migrés implicitement.
- Aucun environnement distant, génération payante, push ou déploiement utilisé.
- Task2 et correctifs de composition qualifiés : `957c593b6`, puis `eb791a266`, revues approuvées. Le polish final réduit encore la hauteur des blocs et corrige le recadrage sous les commandes flottantes, sans masquer capacités ou audio.
- Task3 qualifiée : interfaces partagées `4c986b84e` (refs/faits), `cf525e7df` (transfert compte/projet), `9d7bb92d4` (export du validateur URL existant), `00c0cfa3b` (présence audio déjà sondée) ; lot Studio `bd7aeb3cb`, puis cache upload canevas `f426be90c`. Revue indépendante et re-revue approuvées. 429 tests ciblés, 45 tests upload et 11 E2E passent ; correction ciblée : 5 tests DOM. TypeScript/exposure sans erreur, lint sans erreur avec deux avertissements hérités.
- Task4 **qualifiée et revue Approved** au produit `18bf21cad` : nouveau projet uniquement, commande UI/MCP commune, reçu idempotent, révision/CAS protégeant les writers historiques, résolution et renouvellement privés. Migration42 réservée Studio ; aucune activation par défaut. PostgreSQL17 socket-only/auth ES256 locale vérifiés, aucun recours Neon. Navigateur connecté réel6/6 (63,36s), client local/API contrôlée6/6 (43,0s), suite générale483/483 sans skip (23,01s). Les preuves et corrections intermédiaires sont tracées dans `docs/engineering/studio-task4-integration-review.md`.
- QA authentifiée : résolveur médias HTTP `7cbafa1db` et fondation MCP `4d40827cd` approuvés. Serveur montage `20a181c35` (provenance29 chemins documentée ; `87919e9d7` ne corrige que deux EOF), lecture atomique/verrous `1c9eafa92`, validation/provenance `7cf6a5b57`, références vivantes/legacy409 `de02e5825` : revus Approved, HTTP3/3. MCP partagé `1c41f3d16`→`cdb716027`→`c774f6a6e`, gates false et81 tests verts. Aucun projet enregistré n’est confondu avec `prepare_montage`, resté read-only/persisted:false.
- Le navigateur neuf vérifie désormais frames natives privées/AAC, renouvellement403→signature200→lecture206, seek, absence de PUT sur ouverture, vrai ACK SQL, conflit et brouillon conservé sur deux réouvertures, panne503/retry, purge Auth, référence hors bin et création mobile idempotente après réponse perdue. Les fixtures de signatures/octet et Chromium restent distinctes de l’infrastructure de production.
- Consigne transmise par le coordinateur : poursuivre avec Sol en raisonnement élevé. Les trois agents Astra ont terminé leurs passations et arrêté les écritures ; un nouvel implémenteur Sol high possède Task4, un second Sol high sa revue QA indépendante. Un seul agent écrit le produit ; la racine conserve les tests d'intégration et la validation navigateur.
- QA lecture réelle `51e286901` + `e1c1e1848` : trois tests d'octets et un E2E de frames/audio/seek, revue corrigée puis approuvée. Ce n'est pas une preuve de montage enregistré ni de performance de production.
- Coordination recentrée : la tâche principale reprend Audio/Toolbox/Billing et MCP Audio. Studio conserve médias et montage vidéo minimal ; ne pas solliciter les anciennes tâches archivées ni leurs anciennes worktrees. Leurs commits conservés dans Git sont intégrés uniquement après audit des interfaces.
- Task5 **en cours** : polish déjà prévu explicitement reconfirmé par le coordinateur après gateTask4. Le Sol ayant relu Task4 devient seul writer produit, l’ancien writer devient reviewer indépendant ; la racine garde matrice24, navigateur, runtime/tests d’intégration et documents de qualification. Aucun agent Astra réactivé. La matrice de recouvrement reste RED avant ce polish ; elle n’est pas présentée comme une qualification finale de l’UX.
