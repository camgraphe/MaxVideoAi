# MCP — du projet à sa vidéo produit

État au 6 septembre 2026 : bloc EN/FR/ES intégré, vidéo Wan 3 Prime acceptée par le propriétaire, puis lecture pilotée par le défilement à sa demande. Vérifications locales terminées.

## Direction approuvée

« Votre projet est déjà là. Ajoutez sa vidéo. » Le propriétaire a retenu une montre titanium, bracelet cobalt et cadran acidulé : photo à gauche, conversation Codex ou Claude au centre, produit animé dans le site à droite. Il a demandé de retirer le badge « Démonstration simulée ».

Le bloc illustre le parcours en HTML avec des médias séparés. Le titre et le nom de l’assistant indiquent « Codex ou Claude » (traduits en EN/FR/ES) et le sous-titre parle de « votre assistant ». Il ne constitue pas une capture d’hôte. Les preuves historiques et `getMcpProof()` conservent leur contrat.

## Intégration

- URLs : `/mcp#project-demo`, `/fr/mcp#project-demo`, `/es/mcp#project-demo`.
- Composant : `mcp/_components/McpProjectDemo.tsx` dans les routes marketing.
- Interaction cliente : `mcp/_components/McpScrollVideo.client.tsx`.
- Textes : `mcp/_lib/mcp-project-demo-copy.ts`, complets pour les trois langues.
- La demande du chat central décrit explicitement l’animation pilotée par le défilement : avance en descendant, retour arrière en remontant. `getMcpProjectDemoPrompt()` reprend cette demande et ajoute bouton lecture discret, comparaison des modèles et accord sur le devis exact pour le bouton de copie du hub MCP. Les autres pages d’intégration conservent leur première demande générale.
- Médias : `mcp/_lib/mcp-project-demo-media.ts`.
- Une vidéo sans voix ni texte est partagée entre les trois langues.
- CTA vers `#first-video`, demande traduite et copiable.
- En descendant, la vidéo avance ; en remontant, elle recule. À l’arrêt, l’image reste fixe. Indication traduite dans les trois langues.
- Un bouton lecture discret en bas à droite lance aussi une lecture classique depuis le début, avec contrôles natifs. Un bouton en haut à droite permet de revenir au défilement. Le défilement ne déplace pas la vidéo pendant la lecture classique. Libellés accessibles EN/FR/ES, activation clavier et affichage mobile vérifiés.
- Chargement à l’approche du bloc (200 px), écoute passive du défilement, calcul par animation frame, attente de fin du seek courant. Aucun défilement forcé.
- En préférence de réduction des animations et avant hydratation, contrôles natifs avec playsInline, muted, loop, preload none.

## Images et provenance

Maquette approuvée : `exec-7ddd3d8e-4bb9-4eef-82f7-cdd8e6685560.png`, générée dans cette conversation.

Les assets ont été générés avec ImageGen à partir de cette maquette, sans interface ni texte. Les PNG sont les originaux ; le site ne référence que les WebP optimisés :

- `frontend/public/media/mcp/project-demo/watch-static.png` et `.webp` : photo de départ, montre immobile sur socle graphite.
- `frontend/public/media/mcp/project-demo/watch-motion-poster.png` et `.webp` : poster dynamique provisoire.

Prompt photo : reproduire la montre du panneau gauche, cadran analogique noir/acidulé, bracelet cobalt, boîtier titanium argent, sur socle graphite, fond cobalt/noir. Format 16:9, montre entière, marge à gauche, sans marque ni interface.

Prompt poster : même montre et direction que le panneau droit, flottant à un angle dynamique, traînées lumineuses bleues/acidulées, cadran net, sans marque, texte ou contrôles. Format 16:9.

## Séquence sélectionnée

Le propriétaire a choisi FLUX 3 après comparaison de deux estimations connectées. Une tentative de 6 secondes, 1080p, 16:9, sans audio. L’image de départ a été importée dans sa bibliothèque privée avec le helper du plugin.

Prompt du premier essai FLUX 3 :

> Premium technology product animation using the supplied image as the exact starting frame. One single titanium chronograph watch with a cobalt-blue silicone strap and lime-green dial details on a graphite pedestal. Preserve the same watch geometry, dial layout, case, strap and colors throughout. During the first second hold the product clearly. Then the watch gently levitates just above the pedestal and turns through a controlled 35-degree three-quarter rotation. Elegant cobalt-blue and acid-lime light trails arc behind it, catching crisp metallic reflections without covering the dial. Ease the watch back toward its starting pose by the end. Fixed studio camera, no cuts, no zoom, no hands or people, no duplicate watch, no morphing, no lettering, no interface, no voice or music. Dark graphite and electric-cobalt background, polished pop-tech product campaign, readable sharp product.

Le premier devis de 2,16 $ a été approuvé (« je valide ») et confirmé une seule fois. La réponse de confirmation a été perdue, puis le job accepté a été retrouvé sans nouvel envoi payant. Le job `06a67f5c-dade-4105-acd7-bc9719731907` est terminé et enregistré dans la bibliothèque connectée.

Le premier encodage web et son poster sont archivés dans `.reports/mcp-watch-demo/flux-web.mp4` et `flux-web-poster.webp` (ignorés par Git). SHA-256 vidéo : `5c6f6e82207515890413ef6c8d89fb647b0fc43ac7383280b36fa3a9a0141d7a`.

Le propriétaire a refusé la qualité du mouvement après lecture. Le remplacement utilise Wan 3 Prime, 6 secondes, 1080p, 16:9, sans audio, avec la même photo en première et dernière image. Direction : orientation fixe, élévation verticale limitée à un centimètre puis retour doux, balayage lumineux cobalt/acidulé derrière la montre, caméra et socle immobiles.

Le devis exact de 2,08 $ a été approuvé (« ok »), puis confirmé une seule fois. Le job `157e5575-43e4-4211-9275-f2ad95877238` a été retrouvé terminé après une réponse de confirmation perdue. Le propriétaire a ensuite accepté le rendu (« ok pour moi »). Les deux tentatives autorisées totalisent 4,24 $. Aucun troisième essai.

Résultat original : https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/0df5ede1-5a37-4b32-b4bf-2a8c67b69448.mp4 ; enregistré dans la même bibliothèque connectée.

Vidéo finale : `frontend/public/media/mcp/project-demo/watch-wan-3-prime-scroll.mp4`, H.264, 1920 × 1080, 30 fps, 6 secondes, sans audio, 4 221 289 octets, faststart, une image-clé toutes les 0,2 secondes pour faciliter le seek. SHA-256 : `474ff57fb18dbb02bd6e3e3a3eb4bfa61fe093bf98722b4b5c6fd017f3438eba`. Poster : `watch-wan-3-prime-poster.webp`, extrait à 2,5 secondes. Original, encodage classique et suivi détaillé conservés dans `.reports/mcp-watch-demo/`.

## Validation

Textes, chemins, canoniques, hreflang, JSON-LD, liens et affichages EN/FR/ES vérifiés. Après intégration de la PR média #268 (`c085f5fde`), build de production réussi (860 pages), 141 tests ciblés accueil/MCP, lecture partagée, comparatifs et SEO réussis. TypeScript, lint, couverture des renditions critiques de l’accueil, SEO, exposition publique et traductions passent. Avance, retour arrière, arrêt et absence de débordement vérifiés dans le navigateur aux tailles ordinateur et mobile ; détails et limites dans `design-qa.md`. L’aperçu local utilise le build de production. Aucun déploiement effectué ; ces contrôles fonctionnels ne constituent pas une mesure de gain Core Web Vitals.

Ordre de publication coordonné avec la tâche d’audit : PR #269 (projections des miniatures) puis PR marketing, après reprise du nouveau `main`. La branche marketing conserve également le commit SEO antérieur `55c0b9fcd`, dont le périmètre est documenté dans `docs/seo/2026-09-05-audit-followup.md` et doit être décrit dans la PR complète.
