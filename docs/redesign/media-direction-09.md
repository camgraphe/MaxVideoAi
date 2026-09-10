# Direction 09 — références réelles et films existants

10 septembre 2026. Support de choix avant la prochaine maquette anglaise. La direction finale, les scènes et leur animation restent à valider.

**[Ouvrir la revue](http://127.0.0.1:8775/docs/redesign/review/reference-film-09/index.html)** · [Aller au Short du sac](http://127.0.0.1:8775/docs/redesign/review/reference-film-09/index.html#youtube)

## Conseil de composition

Retenir la précision et la profondeur d’Arrakis, la démonstration par tâches de LocalCan et la place des créations chez Pryzm. Donner à MaxVideoAI une ouverture cinéma avec un contrepoint produit ; expliquer les références et Connect avec une production existante ; réintroduire Compare comme moment de décision. Les surfaces olive/ivoire et le bronze de la revue sont une piste de continuité avec l’app, pas une palette approuvée.

Les captures des sites sont conservées dans `review/reference-film-09/references/`. Leurs liens vivants et fiches Godly sont dans la revue. Les sites ont été examinés sur desktop à différentes positions et états ; aucune bibliothèque d’animation précise n’a été identifiée dans leur code. Ces captures restent des documents de recherche internes, pas des assets à publier sur MaxVideoAI.

## Périmètre de la sélection

100 vidéos repérées : 80 générations terminées du compte connecté, identifié comme Camgraph Admin dans l’administration, et 20 créations publiques récentes d’autres utilisateurs. C’est une sélection bornée, pas toute la bibliothèque. Les métadonnées de génération ont été récupérées en lecture seule. Les posters ont servi au repérage ; neuf originaux retenus ont été lancés dans un lecteur et examinés à plusieurs états. Cela ne constitue pas une lecture critique continue avec validation audio et image par image.

| Film | Modèle réel | Source mesurée | Rôle proposé / réserve |
|---|---|---|---|
| Prism run | MiniMax H3 Max | 1344 × 768 · 8 s | Ouverture cinéma. Prévoir entrée/sortie et boucle ; garder le texte hors de sa fin très claire. |
| Light, in motion | MiniMax H3 Max | 1344 × 768 · 7,296 s | Contrepoint produit : lampe qui se déploie et éclaire. Pas de promesse de fidélité exacte à un produit. |
| From reference to scene | MiniMax H3 | 2544 × 1456 · 5,167 s | Deux références originales retrouvées, puis scène du sac. Matériau C08 à prolonger par les plans existants. |
| A study in movement | MiniMax H3 Max | 1344 × 768 · 8 s | Alternative sobre : danse et cercles projetés. Choisir un poster où le sujet est bien présent. |
| Everyday, elevated | MiniMax H3 Max | 1344 × 768 · 8 s | Bouilloire rouge dans une cuisine, caméra et vapeur : réserve produit. |
| The last bus | Seedance 2.5 | 854 × 480 · 10,042 s | Action narrative. Résolution insuffisante pour un grand hero ; contrôle fin de la cascade requis. |
| Small object, big story | MiniMax H3 | 2544 × 1456 · 12,25 s | Jouet turquoise, mécanisme et texture. Références d’origine pas encore établies. |
| Beyond the frame | Gemini Omni Flash 1.1 | 1920 × 1080 · 8 s | Paysage minéral, brume et oiseaux : diversité du catalogue. |
| A little character | Kling 3 Pro | 1440 × 1440 · 5,042 s | Lapin animé et bouquet, création communautaire. Carré, pas 9:16 ; tonalité très douce, réserve. |

Huit de ces neuf vidéos viennent de Camgraph Admin. Leurs prompts différents ne permettent pas d’en faire un benchmark. La vidéo étiquetée « atomiseur » a été écartée de la sélection produit après visionnage : l’objet ressemble à un pichet. Les originaux ont une piste audio, sans validation auditive dans cette passe.

`selection.json` contient les identifiants et notes, ainsi que les URLs des seuls médias publics. `media-probes.json` contient les dimensions/durées mesurées avec ffprobe. `media.local.json`, ignoré par Git, contient les URLs privées autorisées et les deux références ; la revue les charge uniquement localement. Aucun statut public/privé n’a été changé, aucune écriture en base ni publication effectuée.

## Le sac : retrouver la production, pas recommencer

À la demande d’Adrien, la tâche **« Préparer vidéo YouTube sur MCP »**, identifiant `01a073b7-7e21-7bf3-9936-4e4183a4909a`, a été retrouvée dans le projet YouTube. Son dossier est `/Users/adrienmillot/Documents/youtube`.

La source courante est `maxvideoai-youtube-studio/production-planning/concept-08/launch-v6/finish-v1/rework-v2/`. `ACTIVE-REVISION.json`, `FINAL-REVIEW.md` et les derniers messages de la tâche confirment la V2. `SCRIPT.md` et `exports/DELIVERY.json` conservent certains statuts de préproduction : ne pas les prendre pour l’état courant de livraison/publication.

- Short final : `exports/C08_SHORT_EXPLAINER_EN_V2.mp4`, 1080 × 1920, **21,875 s**. Une seule version explicative remplace les trois anciens fragments rejetés.
- Montage long : `exports/C08_LONG_EN_V2.mp4`, 1920 × 1080, **67,208 s**.
- Versions `-clean.mp4`, sous-titres SRT/VTT/ASS, plans séparés dans `edit/`, plan de montage, projet Premiere et planches `board/` disponibles.
- Les trois planches utiles sont référence, action et dialogue. Elles sont reprises telles quelles dans la revue, sans retouche ni nouvelle génération.

Le job source `2b7d8e08-fd0f-4232-acc3-4157b2142152` relie réellement les références `ma_ec53b5e78fc54035910f2eed5df902f7` (voyageur/gare) et `ma_fa55a0a16cc64533948c8f814b1c910f` (sac produit) à la scène montrée. La consultation des références originales et leur lien de génération ont été vérifiés. Le voyageur tient déjà le sac sur sa référence : ne pas raconter un transfert d’objet totalement absent de l’image initiale.

Pour la homepage : privilégier le geste, l’objet et la relation source/résultat. Proposer le Short complet comme exemple explicatif volontaire. La série de présentateur ne devient pas le visage dominant de la marque. Les variations d’accessoires et les approximations des écrans générés figurent déjà dans le bilan C08 ; conserver cette distinction entre mise en scène et véritable interface.

## Connect : une seconde production déjà disponible

`maxvideoai-mcp-youtube/production/` contient un film anglais de 132 s et trois Shorts, des captures OBS du site de démonstration, une présentation et une vue ordinateur/téléphone. `EDITING-NOTES.md` distingue les exports Premiere des livrables finis dans `exports/`.

La revue permet de lire les captures existantes `captures/site-before.mp4`, `site-after.mp4` et `desktop-phone.mp4`. Elles montrent le résultat d’une intégration web. **Aucune conversation complète avec Codex n’a été enregistrée** dans cette production, d’après les notes : les éléments de configuration sont des références documentaires. Ne pas reconstruire une conversation fictive en la présentant comme une capture.

Cette ancienne démo utilise une montre. Elle sert à étudier la continuité fixe → animé dans un site ; elle ne rétablit pas la montre comme sujet imposé à la nouvelle homepage. Le sac démontre les références, ce second projet démontre la destination web : ne pas fusionner leurs provenances.

`youtube-assets.json` conserve les chemins exacts et les mesures locales. Les liens symboliques de `local-assets/` pointent vers six fichiers précis, sans recopier les vidéos ni exposer le dossier YouTube entier. Ils sont ignorés par Git. Le dossier YouTube et ses projets Premiere restent intacts. Les images de planche et posters déjà existants sont les seules copies de cette production dans la revue.

## Mouvement et mobile à développer

| Section | Au repos | Progression proposée | Mobile / mouvement réduit |
|---|---|---|---|
| Ouverture | Poster lisible, actions avant la preuve sur mobile | Un cadre cinéma prend la place principale ; produit/social restent accessibles | Cadre stable, sélection tactile ; pas de mosaïque débordante ni défilement forcé |
| Modèles | Marques et sélection lisibles | Les modèles se placent, un choix volontaire actualise le rendu associé | Liste tactile ; noms stables, pas de logos qui échappent au doigt |
| Références | Sources et résultat déjà présents | Plans légèrement détachés, perspective commune, résultat mis au premier plan | Même ordre de lecture avec une faible translation ; état complet sans animation |
| Connect | Projet et destination identifiables | Contexte → proposition → devis accepté → résultat intégré | Étapes sélectionnables, sans bloquer le scroll et sans génération déclenchée par la démo |
| Compare | Deux noms et notes finales lisibles | Alignement des modèles puis révélation de trois critères ; scores finaux fixes | Deux colonnes lisibles ensemble ; accès aux 11 critères |
| PAYG | Promesse de paiement à l’usage et explication courte | Sélection explicite d’un scénario et estimation issue des vrais tarifs | Contrôles tactiles, montant stable et devis distinct |

Les mouvements décrits restent des intentions, pas des effets validés ou déjà fabriqués dans cette revue. Les images annotées de la prochaine composition montreront leurs états d’entrée, intermédiaire et final. Les origines de chaque média seront conservées.

## Compare, contenu et continuité

Capture fraîche du [comparatif Kling 3 Pro / Seedance 2.5](https://maxvideoai.com/ai-video-engines/kling-3-pro-vs-seedance-2-5), avec ses 11 critères. La proposition reprend Prompt Adherence, Visual Quality, Motion Realism pour une lecture progressive, puis renvoie au détail. Ne pas fabriquer des scores mouvants ou une nouvelle méthode.

Point relevé à vérifier dans le lot Compare : le bloc « comparable score tier » associe 1080p à 720p alors que les deux modèles proposent 1080p. La comparaison de prix demande une explication du niveau réellement choisi avant d’en faire une promesse sur la homepage. Aucun correctif de production dans ce lot.

PAYG, Compare, exemples, modèles, références et Connect restent centraux. Continuité des intentions et liens utiles, amélioration des répétitions et défauts ; aucune conservation mot à mot imposée. Anglais master puis FR et ES LATAM. Mesures GSC/GA4/Clarity et intégrations/consentement/Zoho restent dans la recette existante ; aucune nouvelle analyse d’audience ni conclusion de conversion dans cette curation.

## Utilisation locale et vérification

Servir la racine du worktree avec `python3 -m http.server 8775 --bind 127.0.0.1`. La revue est un document local `noindex,nofollow`, pas une route de l’application. Ne pas publier le dossier avec ses fichiers locaux privés.

Un seul lecteur est monté après action explicite ; il est retiré à la fermeture, la lecture est muette au départ, avec contrôles natifs. Les posters sont visibles avant lecture. Les médias sous la ligne de flottaison ne se lancent pas automatiquement. Les agrandissements de capture partagent la modale, fermable au clavier avec retour de focus. Les transitions et le scroll doux sont désactivés avec `prefers-reduced-motion`.

Les vérifications de cette passe sont détaillées dans `review/reference-film-09/validation.json`. Elles portent sur le support de revue, pas sur les Core Web Vitals de la future homepage. Les images, clips et scènes restent à sélectionner avant préparation de dérivés et intégration dans les propriétaires médias de l’application.

Prochain jalon : choisir ce vocabulaire visuel et les scènes d’ouverture, références/Connect et Compare ; composer ensuite le master anglais desktop/mobile avec les vrais contenus et états de mouvement. Ni V2 ni V3 ne sont validés automatiquement par cette collecte.
