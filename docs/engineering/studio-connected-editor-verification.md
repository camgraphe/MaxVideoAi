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

Le test `tests/connected-montage-disposable-postgres.test.ts` utilise le helper local existant : nouveau répertoire unique, version majeure PostgreSQL 17 explicitement contrôlée avant écriture, répertoires data/socket correspondant à cette instance, socket Unix seulement, aucune adresse réseau d'écoute, écriture et lecture d'une ligne, arrêt et nettoyage dans `finally`. Il ne lit pas une URL de base héritée. Le préfixe court `stpg` respecte la limite de chemin de socket sur macOS.

Commande vérifiée, 1/1 réussi :

```sh
PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" pnpm dlx node@22 frontend/node_modules/tsx/dist/cli.mjs --tsconfig frontend/tsconfig.json --test tests/connected-montage-disposable-postgres.test.ts
```

Ce test démontre la disponibilité de l'environnement, pas encore la commande de montage ni sa concurrence.

## Authentification et routes réelles de test

Le helper `tests/helpers/studio-auth-fixture.ts` crée deux identités de test connues, signe réellement les sessions en ES256 et publie les seules clés publiques via JWKS. `/auth/v1/user` contrôle aussi signature, issuer, audience, expiration et session active. Le SDK Supabase installé, son transport de cookies SSR et l'adaptateur OAuth MCP réel sont exercés. Faux jetons et appel MCP sans Bearer sont refusés ; le cookie renouvelé est relu par un nouveau client SSR puis authentifié. Trois tests passent. Revue statique indépendante : aucun défaut bloquant ; le fixture de refresh invalide l'ancien identifiant de session immédiatement, comportement volontairement plus strict qui ne doit pas servir à conclure sur la concurrence du vrai service Auth.

Les mécanismes ont été vérifiés contre la documentation officielle de [getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims) et du [transport SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide), ainsi que le code du SDK installé. Aucun changement d'authentification production ni login/PKCE complet n'est couvert par cette fixture.

`tests/helpers/studio-integration-runtime.ts` ajoute un snapshot Git committé et exporté dans un nouveau répertoire temporaire, son propre build Next, un port loopback libre, Auth local et PostgreSQL 17 jetable vérifié avant toute migration. La liste de variables du processus est explicite ; aucun fichier d'environnement ni URL DB héritée. La readiness attend le démarrage du processus possédé, pas seulement une réponse HTTP d'un serveur préexistant. L'arrêt du processus précède le nettoyage Auth/DB et du snapshot unique. Les prévisualisations 3032 et 3034 restent intactes.

`tests/connected-studio-route-integration.test.ts` utilise les vraies routes et le vrai repository : création sous A même si le payload affirme B, relecture par cookie de A, refus de lecture par B, liste B vide, assertion SQL de la propriété et redirection de page sans session avec accès visiteur désactivé. Aucun mock des routes Studio ni de l'authentification de l'app. Suite routes + Auth : **4/4 réussis**.

Depuis `07b1e3c42`, le même test HTTP couvre aussi le refus réel du Chat :401 anonyme,503 avec cookie ou Bearer signé, y compris si le payload prétend Mock ou un prix nul. Le correctif `eb791a266` ferme Live faute de contrat canonique de devis/autorisation, tandis que Mock s'exécute uniquement dans le navigateur avec un libellé de simulation. La suite HTTP augmentée passe1/1 dans un nouveau runtime local jetable.

```sh
PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" pnpm dlx node@22 frontend/node_modules/tsx/dist/cli.mjs --tsconfig frontend/tsconfig.json --test tests/connected-studio-route-integration.test.ts tests/studio-disposable-auth.test.ts
```

Cette preuve concerne le socle de test et les routes historiques, **pas encore la commande de montage, le navigateur authentifié, l'idempotence, la concurrence autosave ni la lecture privée S3**. Elle prépare leur qualification sans accès distant.

Le même parcours HTTP couvre désormais le résolveur médias Task3 au produit `bd7aeb3cb` : cookie et Bearer signés, références asset et job/output exactes, original signé conservé sans réécriture, durée mesurée et `hasAudio:false`, refus anonyme/intercompte/ID interne/mauvais job et job devenu caché. Les tables média sont des fixtures minimales créées seulement après vérification du nouveau cluster local ; ce n'est pas une migration complète de la bibliothèque. La suite augmentée passe1/1 (6,54s pour ce passage). Les URL médias ne sont pas téléchargées : cette preuve concerne l'autorisation HTTP et SQL, pas leur lecture.

Le test `connected-studio-mcp-route-integration.test.ts` exerce désormais le vrai `/mcp` avec transport SSE et Bearer signé : refus anonyme, cookie seul et signature altérée ; initialisation et découverte réelles ; `prepare_montage` et `create_studio_montage` absents par défaut ; deux événements d'audit effectivement lus dans la base locale. Il passe1/1 (9,41s pour ce passage), sans appel de génération ni création de projet. L'acquisition/funnel complet n'est pas initialisé ou qualifié ; seul l'audit existant est migré avec29/41 dans le cluster vérifié.

L'option de runtime `mcp` fixe elle-même host/resource et les seules gates locales autorisées. Next15 normalise les URL loopback de rewrite vers `localhost` ; le helper HTTP envoie cette autorité mais se connecte directement au port IPv4 du processus possédé. Il ne réutilise ni DNS, ni un autre serveur, ni une injection de principal ou de service. Le contrôle initial a échoué avant cette correction du harness. Aucun changement de middleware produit ou de publication MCP n'a été nécessaire.

La revue indépendante Sol high de `4d40827cd` est Approved, sans finding Critical/Important. Le seul Minor a conduit à muter de façon garantie le premier caractère de la signature de test, au lieu d'un suffixe aléatoire pouvant exceptionnellement rester identique. Nouveau passage réussi :1/1 (9,33s). Ce contrôle reste un test d'authentification, pas une mesure de performance.

## Référence visuelle et mesures comparables

Le contrôle réel desktop 1440×900 et mobile 390×844, clair et sombre, constate des blocs trop miniaturisés, des actions non nommées et un débordement mobile. Les captures de référence sont des artefacts locaux de travail ; elles ne constituent pas une mesure de performance.

Le test de stress hérité utilisait un média absent. La fixture a été corrigée vers le média local existant `watch-wan-3-prime-scroll.mp4` (6 secondes, 1920×1080 vérifiés par ffprobe) et le WAV local. Les API compte/persistance et consentement, étrangères à la mesure de rendu, sont simulées. Les lecteurs, interactions et requêtes de médias restent réels.

La mesure BEFORE a été exécutée sur une copie temporaire **figée du commit `332bf4abf`**, distincte de la worktree en refonte, sur le port 3034. La mesure AFTER utilise le lot visuel Task 2 sur 3032. Même fixture, contexte navigateur neuf, viewport 1280×720, Next en développement, 80 blocs et 150 éléments de timeline. Un passage réussi par version :

| Mesure | Avant | Après Task 2 |
| --- | ---: | ---: |
| Requêtes média avant première lecture | 150 | 150 |
| Requêtes média sur tout le parcours | 203 | 178 |
| Première commande Play jusqu'à progression du playhead | 353 ms | 291 ms |
| Scrub jusqu'à position attendue | 85 ms | 49 ms |
| Déplacement d'un clip avec geste automatisé | 1 646 ms | 326 ms |
| Deux incréments de zoom timeline | 157 ms | 98 ms |
| Pan du canevas avec geste automatisé | 540 ms | 161 ms |

Ces temps comprennent les gestes et assertions du navigateur, ne sont ni des Core Web Vitals ni un benchmark de production. Un passage ne permet pas d'attribuer causalement les différences à la refonte. Le chargement initial élevé demeure : toutes les couches timeline sont encore montées avec préchargement automatique. Aucune amélioration de charge initiale n'est revendiquée. Rapports bruts locaux : `.superpowers/studio-visuals/before-performance.json` et `after-performance.json`.

## Interactions Task 2

Au commit `603f45a4b`, 397 tests Studio et TypeScript passent ; lint sans erreur, avec deux avertissements hérités. Quatre parcours Playwright passent : création unique au clavier, inspecteur explicite et retour de focus, actions de piste sans clic droit, inspecteur mobile immédiat et connexions annulables. Les générations de test restent explicitement simulées ; les erreurs Live ne deviennent plus des succès Mock.

La revue indépendante a demandé un parcours supplémentaire : après sélection timeline, la gestion des connexions doit rendre à Annuler la portée canevas. Elle a également demandé le transfert du focus après activation d'un lecteur natif. Ces correctifs, plus Copy réel/refus explicite, sont livrés dans `957c593b6`, revue approuvée :12/12E2E et397/397tests. La matrice parent `8cf596d54` passe8/8 (desktop,portraitmobile,320px,paysage;clair/sombre). Revue de composition `eb791a266` également approuvée :93tests ciblés et1E2E; prix1440p hérité et export distant restent réservés. Les six échecs du run global412/418 pendant le chantier médias ne sont pas masqués ni déclarés résolus.

## Lecture native image et audio

Les fixtures `tests/fixtures/studio-media/pattern-a.mp4` et `pattern-b.mp4` (`cb4a0bf8e`) sont des motifs animés locaux avec tons440/880Hz, H264320×180@30fps et AAC48kHz,6secondes mesurées. Leurs tailles et SHA-256 sont versionnés. Aucun contenu fournisseur ou utilisateur n'est employé.

`tests/helpers/studio-media-byte-fixture.ts` (`51e286901`) fournit les octets de test avec GET/HEAD et plages simples206/416 ;3/3tests après RED module absent. Ce helper n'autorise aucun URL et ne valide aucune signature : un futur test d'accès privé doit effectuer ces contrôles avant de l'appeler. Sémantique bornée inspirée de [RFC9110, requêtes Range](https://www.rfc-editor.org/rfc/rfc9110.html#name-range-requests), pas une nouvelle route de stockage produit.

Le nouveau `editor-media-decoding.spec.ts` passe1/1 sur le Studio local : le vrai lecteur vidéo émet des callbacks de frames décodées au point d'entrée attendu, le vrai lecteur audio fournit un signal RMS non nul via Web Audio, sa lecture avance, le son embarqué lié reste coupé pour éviter un doublage, Pause arrête l'audio et le scrub présente une frame de la seconde source à1seconde. Contrairement au test de stress, ces assertions ne lisent pas seulement l'horloge Studio. Les API compte/persistance et consentement sont simulées dans ce test précis ; les sources sont servies depuis les fichiers de test avec interception locale. Cela ne qualifie ni montage serveur, S3/CDN, matériel audio physique, tous codecs/navigateurs ni performance en production.

La revue indépendante a renforcé la causalité de cette preuve : exiger un **nouveau** callback vidéo après le scrub, puis vérifier currentTime/mediaTime de B et sa visibilité ; confirmer que A est encore visible lors du contrôle de son lié. Nouveau passage réussi :4frames natives,mediaTime1.133333s,audioTime1.162943s,RMS0.071739,second source1s. Ce sont les valeurs d'un passage, pas des seuils de performance. Rapport brut local : `.superpowers/studio-visuals/native-decode-reviewed.json`.

Le helper de stockage privé `studio-private-storage-fixture.ts` (`a940929ef`, revue racine approuvée) utilise les signatures GET produites par le vrai code de stockage, avec un bucket et des identifiants explicitement factices. Aucun appel SDK `send` ni réseau AWS : seuls les deux fichiers synthétiques locaux sont servis après validation SigV4, host, clé connue, méthode, durée et ensemble exact des paramètres. URL non signée, altérée, dupliquée, expirée, clé inconnue et HEAD sont refusés. Le helper ne reçoit pas d'identité utilisateur : la route produit doit toujours autoriser owner et référence avant de signer. Quatre tests privés et trois tests d'octets passent ensemble7/7 (1,54s). Ce sous-lot ne qualifie pas AWS, la permission produit ni un navigateur connecté ; les URL avec `downloadFilename` ou override de réponse sont volontairement hors de cette fixture.

Le runtime accepte désormais `privateStorage:true`, qui transmet uniquement ces constantes de test et désactive la recherche de credentials via metadata. Son origine navigateur est `localhost` lorsque MCP est activé, cohérente avec le Host strict de la gate, le site et CORS Auth ; l'origine réseau reste le port IPv4 possédé. Aucun assouplissement du middleware produit. `studio-connected-fixture-data.ts` prépare les migrations26/29/41/42 et quatre assets canoniques de test, dont un owner étranger et un asset avec durée seulement déclarée, uniquement dans le callback suivant la vérification du cluster jetable.

Le test `connected-studio-montage-http-integration.test.ts` a d’abord échoué contre le snapshot `a940929ef` : découverte authentifiée réelle réussie, mais `create_studio_montage` absent malgré l’override local. Après le serveur composé `20a181c35` et le MCP partagé isolé `1c41f3d16`, il passe1/1 (12,04s) : SQL ordre/trims/propriétaire/reçu unique, signatures privées réelles300s, refus intercompte/non membre, sauvegarde CAS, refus stale/anciens writers et rejeu UI cookie/MCP préservant l’édition. Aucun mock des routes Studio, commande, auth, signer ou repository ; aucun appel AWS. Les autres assertions de refus vérifient aussi l’absence d’état partiel.

La revue a ensuite renforcé le contrat d’erreur : le test est repassé RED sur un conflit de clé transformé en `INTERNAL_ERROR` (12,34s). Le correctif MCP isolé `cdb716027` rend les refus attendus actionnables. `1c9eafa92` ajoute la lecture atomique projet/séquences et les verrous transactionnels des sources/anciens writers. La racine a augmenté puis rejoué le vrai HTTP sur ce snapshot : **1/1 réussi (12,99s)**, avec GET workspace atomique, refus intercompte, les quatre writers séquences HTTP et erreurs métier typées. Le writer rapporte10/10 tests PG de sauvegarde/courses ; revue indépendante serveur encore en cours. Le détail des commits et des chemins est dans `studio-task4-integration-review.md`.

`studio-connected-browser-fixture.ts` (`3b5bfc06b`, revue racine approuvée) crée Chromium non persistant, bloque les service workers, fixe localhost→127 et intercepte le seul host privé connu. Son test utilise un serveur local étranger effectivement bloqué avant toute requête, deux contextes sans partage de localStorage, vrais cookies, signature/Range et refus unsigned. Contre-vérification racine1/1 réussie (0,70s).

Le premier parcours `connected-studio-montage-browser-integration.test.ts` ouvre réellement l’URL MCP en session neuve : Viewer, deux clips, ordre et trims DOM corrects. Il est **RED confirmé** avant le client connecté : lecteurs privés `readyState:0`, originaux non signés refusés403, anciens autosaves correctement refusés409, aucun `pageerror`. Capture inspectée : `output/playwright/studio-connected/failure.png`. Le test ne simule ni Studio/Auth ni la base ; seuls les lecteurs compte/consentement sont des fixtures, et le preflight de génération hors périmètre est explicitement indisponible503. Lecture décodée privée, reprise après une expiration injectée uniquement dans l’horloge du validateur stockage, sauvegarde depuis l’UI et réouverture sans cache attendent encore leur passage GREEN.

La suite HTTP comprend aussi un second runtime vérifié avec seulement les migrations historiques26/29/41. Sans42, la création UI répond503 explicite, MCP retourne un refus retryable et la lecture connectée répond503 ; aucun reçu, champ revision/persistence_mode ou projet n’a été créé implicitement. Nouveau passage complet : **2/2 réussis (23,13s)**. Ce contrôle établit le refus sûr en environnement non migré, pas la migration d’un environnement distant.

Après ce passage, la revue indépendante a demandé une validation structurelle des éléments sauvegardés, la provenance explicite des trims en frames et des erreurs techniques opaques. Le nouveau contrôle HTTP `timelineItems:[null]` est **RED confirmé** (réponse200 au lieu de400,11,47s). Les assertions de rollback sur panne SQL injectée, ajoutées à sa suite, n’ont pas encore été atteintes. Voir la section de revue intermédiaire de `studio-task4-integration-review.md` ; le passage2/2 antérieur n’est pas présenté comme preuve de ces nouveaux critères.

## Contrôles restant ouverts

La matrice géométrique `editor-canvas-clarity.spec.ts` prépare la qualification finale (24 combinaisons EN/FR/ES, quatre viewports, deux thèmes). Trois passages de référence échouent actuellement pour la raison attendue : titre et réglages recouverts par le HUD après fit, sur desktop EN, portrait FR et paysage ES. Les captures ont été inspectées ; ce défaut doit être corrigé dans Task5 avant la remise, sans affaiblir les assertions. Les anciennes huit vérifications de boutons dans le viewport ne détectaient pas ce recouvrement interne du canevas.

Le lot médias `bd7aeb3cb` est figé, avec rapport `28475b388` :429tests ciblés,45tests upload et11parcours navigateur réussis, TypeScript/exposure/diff sans erreur, lint sans erreur avec2warnings hérités. Les six contrats provisoirement en échec pendant Task3 passent dans ce dernier run. Revue indépendante Approved, puis correctif du seul Minor cache upload canevas `f426be90c` avec5/5tests DOM et re-revue Approved. Les parcours navigateur prouvent l'édition et la sauvegarde locale ; le test HTTP séparé `7cbafa1db`, également revu Approved, qualifie le résolveur authentifié, sans confondre les deux environnements.

Commande UI/MCP persistée, sauvegarde concurrente, réouverture sans cache local, polish de densité des blocs, qualification responsive du lot complet et build final restent à exécuter. `prepare_montage` demeure un plan non persisté et ne satisfait pas ces critères ; les21tests MCP existants ciblés passent avant Task4, sans prétendre prouver une écriture.
