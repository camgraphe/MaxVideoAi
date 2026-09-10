# Point de reprise — refonte MaxVideoAI

Pause demandée par Adrien le 10 septembre 2026 pour préserver les tokens. Reprise prévue la semaine suivante, à son retour. Ne pas relancer de recherche, génération ou implémentation pendant la pause.

## Lire en premier

Ce point de reprise, puis `decisions.md` (D47 à D50), `media-direction-09.md`, `references-tech-cinema.md` et le README du dossier. Les décisions les plus récentes priment sur les propositions historiques. Les anciennes versions ne sont pas des directions validées.

## Où se trouve le travail

- Worktree : `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/site-redesign`.
- Branche : `codex/site-redesign`. Dernier commit de modification avant cette sauvegarde : `820172a91`.
- Revue active : `docs/redesign/review/reference-film-09/index.html`.
- Documents et revue versionnés dans Git local. Aucun push, déploiement ni changement applicatif réalisé dans ces derniers lots.
- Ne pas supprimer le worktree : `media.local.json`, `local-assets/` et `qa/` sont volontairement ignorés par Git. Les sources privées et liens locaux existent sur cette machine, pas dans un clone distant.
- Vérifié au moment de la pause : revue, sélection, compagnon privé, catalogue des productions et manifeste YouTube présents.

Pour rouvrir la revue si le serveur s’est arrêté, exécuter depuis la racine du worktree :

```sh
python3 -m http.server 8775 --bind 127.0.0.1
```

Adresse : `http://127.0.0.1:8775/docs/redesign/review/reference-film-09/index.html`. Ancres utiles : `#product`, `#youtube` (images/plans sources uniquement), `#website-move`, `#compare`.

## Décisions à ne pas perdre

- Refonte de toutes les familles de pages, pas seulement l’accueil. Plus graphique, fine, cinématographique et technologique, avec usages publicité, social et produit. Éviter les boîtes imbriquées, répétitions, vides et effets gratuits.
- Anglais master, puis français, puis espagnol LATAM. Continuité avec l’app. SEO/GEO au centre, sans figer une mauvaise interface ni préserver chaque phrase : les changements utiles à faible impact peuvent avancer ; documenter les changements de fond.
- Piliers : paiement à l’usage, modèles, Compare, exemples, références et création avec son assistant. Présenter le bénéfice de Connect avant le jargon MCP. Angle reste secondaire sur l’accueil ; Studio bêta à positionner selon sa disponibilité réelle.
- Références appréciées : Arrakis, LocalCan, Pryzm. Leur rôle proposé est mise en scène/profondeur, compréhension des tâches, place des créations. Aucune nouvelle maquette finale validée.
- Mobile et performance prioritaires. Animation utile au scroll, contenu immédiatement compréhensible, posters, alternative sans mouvement. Clarity, GSC, GA4, consentement et Zoho restent dans la recette ; ne pas inventer des résultats d’audit ou de conversion.
- **Compare sera refondu aussi.** Concevoir ensemble le module d’accueil et la future page détaillée. Ancien scoreboard retiré de la projection, conservé uniquement pour audit. Critères et regroupements peuvent évoluer avec justification ; notes exactes et traçables.
- **Website Move est entièrement à réinventer.** Montre et réalisation précédente écartées, même comme image d’attente. Objectif conservé : montrer l’apport de la vidéo à un site. Nouveau produit, univers, composition, storyboard et mécanisme ouverts ; un bon effet peut guider une autre approche. Ni avant/après ni cadre de navigateur imposés.
- **Aucun Short YouTube complet ni présentateur parlant sur le site, même au clic.** Utiliser seulement les références, images et plans utiles. La revue a retiré lecteur du Short, lien clean, poster présentateur et planche dialogue. Garder produit, geste et résultat ; créer une mise en scène propre au site.

## Médias retrouvés

Sélection actuelle : **12 films, dont 11 Camgraph Admin**. Premier repérage de 100 candidats, puis recherche ciblée chaussures. Originaux examinés à plusieurs états, pas de validation complète image par image/audio. URLs privées dans le compagnon local, aucune visibilité modifiée.

Sneakers du 21 juin : trois films d’assemblage ivoire/cobalt/orange. Kling 3.0 Omni Pro en 1920×1080 proposé comme candidat produit prioritaire ; Happy Horse 1.0 en 1280×720 ; Seedance 2.0 en 864×496, réserve. Lampe en alternative sobre, bouilloire en réserve calme. Préférence proposée, pas validation finale d’Adrien. Même prompt mais références inversées pour Seedance : pas un benchmark contrôlé. Ces films sont distincts de l’ancien essai de chaussure 3D de la refonte.

Sources du sac retrouvées dans la tâche **« Préparer vidéo YouTube sur MCP »**, id `01a073b7-7e21-7bf3-9936-4e4183a4909a`, projet `/Users/adrienmillot/Documents/youtube`.

Source C08 actuelle : `maxvideoai-youtube-studio/production-planning/concept-08/launch-v6/finish-v1/rework-v2/`. Plans, références et versions propres disponibles ; les montages complets restent des archives. Les trois anciens Shorts abandonnés ne sont pas la source courante. Deux références du sac sont reliées au job dans les données ; le présentateur et ses écrans générés ne sont pas des preuves d’interface.

Autre dossier : `maxvideoai-mcp-youtube/production/`. Captures de montre archivées/rejetées pour la refonte. Aucune conversation assistant complète enregistrée dans cette production. Ne pas la reconstruire en prétendant montrer une capture réelle.

## Reprendre dans cet ordre

1. Relire les derniers retours et rouvrir la revue à jour ; vérifier branche/worktree et les sources locales sans refaire l’inventaire.
2. Développer une proposition visuelle cohérente à partir des sites choisis et des vrais plans : accueil anglais desktop/mobile, avec les états de mouvement utiles.
3. Concevoir en parallèle dans le même lot graphique l’aperçu Compare et un extrait de sa future page détaillée ; ne pas réinsérer l’ancien scoreboard.
4. Repenser Website Move comme une nouvelle scène, sujet et effet compris. Les sneakers ne sont pas automatiquement son nouveau sujet. Présenter la proposition avant production dédiée.
5. Faire valider les choix importants, puis fabriquer les effets aux emplacements retenus. Continuer par gabarits sur tout le site, avec contrôle SEO/GEO, mobile, performance et conversion.

Les images/plans existants évitent de régénérer inutilement. ImageGen intégré et MaxVideoAI restent les outils créatifs disponibles ; aucune dépense nouvelle autorisée par ce point de reprise. Aucune automation de reprise ou de rappel créée.
