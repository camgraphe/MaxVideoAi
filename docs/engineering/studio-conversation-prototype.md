# Studio conversationnel local

## Périmètre

Expérience isolée sur `codex/studio-conversation-exploration-20261001`, dans `experiments/studio-conversation/prototype/`. La route Studio et le MCP de production ne sont pas modifiés. Le package démarre sans auth, base, clé LLM ni provider et porte son stockage `.data/` ignoré par Git. Le spec et le plan se trouvent dans `docs/superpowers/{specs,plans}/2026-10-01-studio-local-prototype*`.

## Propriétaires

- `shared/types.ts` définit Project, Asset, Clip, Settings, Message, Job et Snapshot. Clips et positions utilisent des frames entières, `outFrame` exclusif.
- `shared/timeline.ts` valide et applique les éditions immuables, pistes, ordre, source, format/fps et historique. Les conversions `shared/frames.ts` reprennent les helpers Studio ; `tests/frames.test.ts` vérifie leur parité contre le module canonique. L’import direct amenait les types React Flow/pricing du workspace dans le build autonome ; aucune responsabilité production n’a été déplacée.
- `server/store.ts` écrit un projet JSON par UUID avec remplacement atomique et sérialisation des mutations. Un seul runtime doit posséder un dossier de données.
- `server/commands.ts` est l’unique entrée métier pour UI, chat et MCP : validation, révision, request ID et jobs. Les réponses rejouées relisent le projet actuel, sans dupliquer le job.
- `server/director.ts` conserve la conversation et traduit des intentions explicitement supportées. Il ne fabrique pas de résultat et indique les limites du jeu de démonstration.
- `server/jobs.ts` possède la queue persistante, reprise des jobs `running`, états, progression, annulation et fusion des résultats. La construction automatique refuse d’écraser une révision modifiée pendant son travail.
- `server/local-work.ts` exécute les tâches, conserve des IDs stables, reconnaît les fichiers terminés et publie les médias prêts au fur et à mesure. Les fichiers partiels ne sont pas annoncés prêts. Une annulation conserve les médias déjà terminés, sans insérer un montage incomplet.
- `server/media.ts` mesure les références et conserve original/aperçu ; `server/render.ts` normalise la vidéo et assemble le son directement depuis les sources coupées. La concaténation vidéo reste sans audio pour éviter le décalage des amorces AAC. Un son dépassant le dernier plan prolonge sa dernière image. Chaque plan est normalisé à son nombre de frames demandé, y compris une source sauvegardée dont la vidéo finit avant la durée déclarée. La durée d’import d’une vidéo suit son flux vidéo, son aperçu audio étant borné à cette durée ; l’original reste intact. L’export reçoit un snapshot immuable.
- `server/http.ts` possède corps limités, routes, imports et livraison Range. `server/index.ts` écoute en loopback et refuse Host/Origin étrangers ou malformés. Les programmes se lancent en tableaux d’arguments, sans shell.
- `server/mcp.ts` ne possède aucune autre implémentation de montage. Il expose une projection HTTP JSON-RPC des mêmes commandes.
- `client/mediaPlayback.ts` synchronise les pistes audio/vidéo avec le temps, la coupe et l’état de buffering ; les pistes restent en pause lorsque l’horloge attend. Une vidéo en pause suit les changements d’une seule frame ; la tolérance de synchronisation plus large s’applique uniquement pendant la lecture.
- `client/App.client.tsx` compose le shell, le chat, le canevas et la zone de montage. `PreviewTray.client.tsx` replie le moniteur directement au-dessus de la timeline, sans remplacer les quatre visuels desktop ni recouvrir le chat mobile. Le contenu reste monté pour conserver la position de lecture, devient inerte et interrompt ses lecteurs au repli. Une sélection, une coupe ou un clic sur la règle ouvre l’aperçu ; la saisie dans le chat le replie. Les lecteurs de sortie restent dans les messages. Sélection, références en attente et pins sont des préférences de présentation ; le projet serveur reste canonique.
- `Timeline.client.tsx` conserve l’aperçu d’une coupe pendant sa sauvegarde, puis rend la main au projet canonique. La poignée ou le curseur choisit le bord visualisé, y compris au clavier ; la dernière frame conservée est `outFrame - 1`.
- Le moniteur du montage affiche uniquement l’image et son bouton de repli. La timeline possède la commande de lecture/pause, la règle et la tête de lecture ; `ProgramPreview.client.tsx` synchronise les médias sans dupliquer ces contrôles. Les aperçus de médias individuels conservent leurs lecteurs natifs et leurs actions référence/animation/insertion.
- Les champs natifs de position et de volume audio se resynchronisent lorsque leur valeur canonique change, y compris après undo/redo, tout en conservant leur brouillon pendant le geste.
- `PalettePicker.client.tsx` possède le choix local de palette, validé et mémorisé dans le navigateur. `client/styles/palettes.css` définit les couleurs sémantiques utilisées par le shell, le chat, les dialogues et le montage. Les labels sur les photos conservent leur encre claire indépendante. Aucun paramètre de rendu ni média n’est recoloré ; les deux modes sont vérifiés par `tests/palettes.test.ts`.

## Projection vers le produit

Le tronc commun pertinent est le service d’actions sur les projets, médias, séquences et tâches. Le bot intégré et un client MCP appellent ces actions avec les mêmes contrats. Il faut récupérer les propriétaires déjà présents dans Studio : projet canonique et assets possédés, helpers de frames/coupe, lecture/export, tâches et bibliothèque. Le graphe React Flow et ses nombreux panneaux ne sont pas nécessaires à cette interaction.

Avant de remplacer Studio : adapter les commandes au dépôt canonique de projets/assets, ajouter isolation de compte, provenance et imports actuels ; relier le vrai directeur à un LLM avec outils et conversation persistante ; passer les générations par devis/réservation/idempotence existants ; brancher un worker durable de rendu et le stockage de production ; publier l’editing via le registre MCP et ses contrats. Conserver les tests de version, répétition, reprise et export immuable. La démo locale ne prouve ni la qualité d’un réalisateur autonome ni la robustesse d’un rendu distribué.

## Validation

Les 27 tests `prototype/tests` couvrent le montage et les adaptateurs, les médias réels, le MP4/MP3, les références image/vidéo/audio, l’immuabilité de l’export, la livraison partielle, le suivi d’une coupe d’une seule frame, une séquence complète d’éditions avec persistance, le refus de médias/clips d’un autre projet et le contraste des deux modes. Les captures initiales IAB à 1672×941, 390×844 et 320×740 sont dans `experiments/studio-conversation/design/qa/` ; le relevé compare la référence acceptée à ces états de l’app. Chrome a bloqué le localhost lors de cet essai ; l’aperçu Codex a fonctionné, sans modifier cette protection.

La retouche du moniteur a été vérifiée dans IAB sur desktop et à 390×844 et 320×740 : quatre visuels desktop conservés, moniteur de hauteur nulle et lecteurs en pause une fois replié, saisie du chat accessible sans superposition, coupe par poignée tactile et par frame au clavier suivie dans une vraie vidéo. Les nouvelles preuves sont conservées hors dépôt dans les visualisations Codex.

La passe de comparaison des quatre palettes a utilisé deux projets QA distincts du film initial. Parcours vérifiés dans IAB à 1280×720, 1440×900, 390×844 et 320×740 : état vide, paramètres, brief, imports multiples et refus SVG, références, coupe, ordre par flèches/glissement, remplacement, suppression/undo/redo, génération et insertion de voix/ambiance, position/volume, lecture, arrêt/reprise de génération, export et recharge. Les trois originaux importés sont identiques à leurs sources par SHA-256. Le MP4 vertical mesuré contient 300 frames à 30 fps, 720×1280 et 10 secondes d’image/son ; le MP3 audio seul se lit également dans le chat. Préférence de palette, navigation radio au clavier et fermeture par Échap vérifiées. Défauts corrigés : contraste du texte secondaire et du moniteur audio en Porcelaine, curseur audio non rafraîchi après annulation.

Choix retenu après comparaison : Charbon pour le mode sombre, Olive pour le mode clair. Olive utilise désormais des fonds ivoire et des accents olive ; Minuit et Porcelaine sortent du sélecteur. Les préférences précédentes Minuit et Porcelaine rejoignent respectivement Charbon et Olive.

Allègement suivant : retrait du titre « Votre montage », du bouton lecture et de la barre de temps à côté du moniteur. L’aperçu est centré, avec repli dans son coin. Vérifié dans IAB à 1440×900, 390×844 et 320×740 : lecture image/son depuis la timeline, pause, clic sur la règle suivi dans la vraie vidéo, repli de hauteur nulle et médias en pause, chat accessible et aucun débordement mobile. Les quatre tests ciblés lecture/contraste et le build passent ; les preuves restent hors dépôt.

Les dimensions mobiles sont des simulations de viewport dans IAB, pas une certification Safari/iOS sur appareil. Le directeur et la génération d’images restent simulés comme indiqué dans le README. Les captures comparatives de cette passe sont conservées hors dépôt.

Sources de protocole/runtime : [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [Vite middleware](https://vite.dev/guide/ssr.html), [FFmpeg protocols](https://ffmpeg.org/ffmpeg-protocols.html).

## Revue finale et décisions conservées

Revue indépendante en contexte neuf du commit `db880d8f0`. Trois problèmes matériels reproduits puis corrigés dans une passe : changement de fps à la limite d’une source et contiguïté audio ; import vidéo dont le son dépasse l’image et longueur exacte de chaque plan ; pause du son pendant le buffering vidéo. Les régressions ont échoué avant la correction puis passé. La coupe/position audio du directeur a aussi été corrigée, et une construction réelle de film pendant des edits ainsi que le signal audio décodé ont renforcé la validation.

Décisions, dans l’ordre :

1. Reprendre localement les conversions de frames avec test de parité, car l’import direct ramène les types React Flow/pricing dans le build autonome. Coût si incorrect : dérive des conversions, détectée par le test de parité.
2. Garder LLM, fournisseurs et génération conditionnée simulés pour tester l’interaction locale. Coût : qualité créative/fournisseur non validée.
3. Garder auth, facturation et intégration canonique hors du prototype isolé demandé. Coût : adaptation documentée nécessaire avant remplacement de Studio.
4. Un runtime par dossier de données, conformément au README. Coût : risque de concurrence si deux runtimes partagent le dossier.
5. Voix Thomas macOS déjà installée, tâche réessayable si absente. Coût : fournisseur ou adaptateur nécessaire ailleurs.
6. MCP HTTP JSON-RPC local prévu, sans sessions/auth/SSE de production. Coût : transport supplémentaire pour les hôtes qui les requièrent.

Deux finitions reportées : schémas JSON spécifiques à chaque payload dans la découverte `studio_command` ; conservation d’un brouillon du dialogue Paramètres lors d’une modification externe ou d’un assemblage en arrière-plan. Le second peut réinitialiser un formulaire non enregistré ; enregistrer avant une autre édition pour cet essai local.
