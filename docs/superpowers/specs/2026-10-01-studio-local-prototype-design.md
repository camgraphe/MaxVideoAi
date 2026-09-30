# Studio conversationnel — prototype local complet

## Intention et autorisation

Adrien demande de transformer l'étude interactive en prototype local abouti, de bout en bout, avec un bot simulé, les paramètres nécessaires, des médias interactifs, un montage limité au placement et à la coupe, et une réflexion sur le remplacement futur de Studio. Il demande également un tronc commun entre ce bot et le MCP, comprenant l'editing. L'exécution complète est explicitement demandée dans cette conversation ; cette étude reste isolée, sans modifier les routes ni activer le Studio de production.

Référence visuelle : `experiments/studio-conversation/design/studio-premiers-echanges.png` et `design/studio-recomposition.html`. Le prototype prolonge le charbon, les accents or, le petit H1 Studio, la sidebar nommée et le chat central. Le passage aux médias et exports réels justifie les contrôles d'import, de projet, de paramètres, de tâches et d'export qui manquaient à l'étude.

## Produit visible

- App locale React, avec le cadre MaxVideoAI. Entrées Créer, Médias, Outils, Studio, Activité et Compte ; chacune ouvre une fonction locale explicite.
- Projets vierges ou démonstration parfum. Titre, conversation, médias, séquence, paramètres, tâches et exports sont sauvegardés sur disque.
- Un chat central dont la saisie reste stable. Historique conservé, nouvelle réponse signalée sans interrompre la relecture. Messages du bot associés aux résultats et aux actions possibles.
- Sur desktop, un aperçu principal et trois médias secondaires maximum. Composition déterministe dans les zones latérales, sans empiéter sur le chat ; ratios natifs respectés. Anciennes créations accessibles dans la bibliothèque. Sélection, épinglage, agrandissement, référence pour le chat, variation et animation possibles ; les vidéos prêtes peuvent être insérées ou remplacer un plan.
- Sur mobile, un chat avec les médias dans les réponses. Bibliothèque et paramètres restent disponibles. Montage ouvrable en bas, timeline horizontale et coupe dans des contrôles larges.
- Montage vidéo à une piste : insertion, ordre par poignée/flèches, coupe début/fin, suppression d'un plan, annulation/rétablissement, zoom, curseur et lecture de la séquence. Pas d'effets ni de pistes multiples. Les gestes sont des brouillons locaux et se valident à la fin.
- Aperçu vidéo réel, avec les mêmes sources, points de coupe et ordre que l'export. Une image sans animation ne possède pas de faux bouton Play.
- Paramètres : titre, format 16:9 / 9:16 / 1:1, sortie 720p / 1080p, fps 24 / 30, ajustement recadrer / contenir, conservation du son des rushes, durée cible 10–120 s. Les contrôles de génération locale choisissent un mouvement doux, un panoramique ou un plan fixe et une durée bornée par les sources/contrats.
- Import d'images et vidéos locales jusqu'à 100 MiB ; métadonnées mesurées par ffprobe, original conservé et aperçu compatible. Images SVG et références réseau exclues.
- Export MP4 véritable avec FFmpeg dans une tâche serveur locale. Progression issue du rendu ; téléchargement seulement après disponibilité de l'artefact. Export JSON du projet pour inspecter ou conserver une copie.

## Assistant et tronc commun

Le directeur simulé reconnaît les principales intentions françaises/anglaises et utilise le contexte réel : brief, paramètres, références, médias prêts, sélection et montage. Il sait proposer/créer des visuels de démonstration, animer, assembler, couper, déplacer, modifier le format et exporter. Une intention non reconnue donne une aide contextualisée, sans fabriquer une opération réussie. L'app indique « Local · Démonstration ». Aucune clé, génération payante ou connexion à la base de production.

`CommandService.execute(projectId, request)` est le propriétaire unique des actions et validations. Le chat, l'API utilisée par les gestes et l'adaptateur MCP local l'appellent. Les améliorations de validation, idempotence, reprise, coupe et export sont donc communes. Le dialogue et la présentation restent propres à leur client.

Les commandes couvrent les paramètres, la génération locale, l'animation, l'assemblage, l'insertion/remplacement, la coupe, le déplacement, la suppression, l'historique et les tâches/export. Le MCP local expose découverte, lecture du projet/médias et outils d'édition via JSON-RPC sur `/mcp`, avec la même version de séquence et les mêmes request IDs. Ce transport de démonstration n'altère pas le MCP publié.

## État et fiabilité

Entités séparées : Project, Asset, Sequence/Clip, Message, Job, Export. Le montage utilise des frames entières au fps de séquence, via les helpers `timeline-frames.ts` de Studio. Coupe minimale 1 s, aucune extension au-delà de la source et aucune superposition sur la piste. L'export utilise un snapshot immuable de la séquence.

Le stockage JSON local écrit atomiquement. Les mutations d'un projet sont sérialisées. Les request IDs ont une empreinte de payload ; une répétition identique rejoue le résultat et un payload différent est refusé. Les éditions requièrent la révision de séquence ; un conflit ne remplace pas silencieusement le travail de l'utilisateur. Une tâche d'assemblage ne remplace pas un montage modifié pendant son exécution.

Les tâches sont persistées, reprenables après redémarrage, annulables et réessayables après échec. Les sorties terminées sont reconnues par leur identité stable. Fermer/recharger le navigateur ne relance aucune génération. La sélection/épinglage et la présentation restent des préférences du client, distinctes des décisions du projet.

Le serveur écoute uniquement sur 127.0.0.1. Validation Host/Origin, chemins appartenant au projet, UUID et noms internes contrôlés, limites de corps et commandes FFmpeg en arguments sans shell. Pas de téléchargement réseau de médias.

## Organisation et réutilisation

Le prototype vit dans `experiments/studio-conversation/prototype/`, avec son propre package et runtime. React/Vite permet le boot sans auth/base de production ; les responsabilités et contrats sont transférables à Next.js ultérieurement. Aucun module serveur production n'entre dans le client.

- `shared/` : types, montage, commandes et helpers navigateur sûrs.
- `server/` : stockage, service commun, directeur simulé, jobs/rendu, MCP et serveur HTTP.
- `client/` : coque, chat, composition latérale, bibliothèque/aperçu, timeline/lecture, dialogues et état API.
- `tests/` : montage, persistance/idempotence/conflits, parité chat/API/MCP, reprise et rendu réel.

Réutilisation immédiate : conversion/snapping de frames Studio. Conservation conceptuelle de ses frontières projets/assets/séquences/jobs, du contrat source/aperçu et des règles d'export. Les gros composants React Flow, auth, portefeuille et orchestration provider restent dans le produit actuel ; les importer bloquerait l'étude locale et recréerait la complexité rejetée. La promotion devra ajouter un adaptateur au service de projet canonique, aux devis et au worker réel, avant toute substitution de route.

## Critères de livraison

Parcours complet : créer un projet → discuter → préparer des médias → animer → assembler → modifier par UI et MCP → relire → sauvegarder/recharger → exporter → lire/télécharger le MP4. Import réel, conflit d'édition, échec/reprise et répétition de commande éprouvés. Vérification desktop à la taille de référence 1672×941, petite fenêtre, mobile 390 et 320 px, chargement et première lecture, absence de contenu principal coupé, comparaison visuelle documentée et aucun changement de main.
