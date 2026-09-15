# D84 — Parcours Outils, personnage humain et captures actuelles

Travail dans `codex/site-redesign`, le 15 septembre 2026. Revue locale : http://localhost:3008/fr/outils. Aucun déploiement, aucune écriture en base ou publication de médias en production.

## Direction retenue

La dernière demande d’Adrien prime : le grand fond noir du hub Outils est remplacé par un fond ivoire et une composition de trois visuels. La planche personnage domine, accompagnée d’un changement d’angle et d’un agrandissement. Les ateliers principaux précèdent les outils de finition plus compacts ; les espaces Image et Audio restent accessibles pour créer son point de départ.

La navigation entre Character Builder, Angle, Upscale et Détourage vidéo est commune, localisée et suivie d’un accès à l’app. Sur mobile, elle défile horizontalement sans faire déborder la page. Les titres et introductions sont raccourcis. Les démonstrations Angle existantes restent interactives ; le héros Character Builder permet de passer de la planche au portrait. Les mouvements décoratifs respectent la préférence de réduction des animations.

## Personnage et provenance des visuels

Le crocodile des deux cartes de choix Character Builder est remplacé dans l’app par une femme fictive : portrait de référence et planche à huit vues. La planche montre quatre vues en pied (face, profil, trois quarts, dos) et les quatre portraits correspondants. Le cadrage conserve les corps entiers. Le visuel partagé du catalogue et de l’accueil reprend aussi cette planche.

Deux images créées avec l’outil intégré ImageGen : création du portrait, puis création de la planche en référence au portrait. Ce sont des **illustrations**, identifiées comme telles sur la page marketing ; elles ne constituent pas la preuve d’une génération effectuée dans Character Builder.

Brief de génération conservé pour reproduction (synthèse des instructions, pas transcription verbatim) :

- Portrait photographique éditorial d’une femme adulte fictive, teint olive, cheveux bruns au carré, blazer anthracite sur haut ivoire, petites boucles dorées, lumière de studio douce et fond beige chaud ; élégance sobre, aucun texte ni logo.
- Conserver exactement cette personne, sa tenue et sa coiffure. Planche 3:2 de huit vues : quatre colonnes, rangée supérieure occupant deux tiers de la hauteur avec les corps entiers face/profil/trois quarts/dos ; rangée inférieure de gros plans correspondants. Fond et lumière cohérents, séparations discrètes, aucun texte.

Livrables optimisés dans `frontend/public/assets/tools/redesign/` :

| Asset | Dimensions | Poids |
| --- | --- | --- |
| `character-portrait-v1.webp` | 900 × 1125 | 95 530 octets |
| `character-sheet-v1.webp` | 1536 × 1024 | 133 068 octets |

Les PNG sources restent dans le dossier local de génération `~/.codex/generated_images/01a09f67-ef53-75a2-9ab1-cedc966edc30/`, fichiers `exec-2090ccd9-a325-4e87-9e86-8dc418f45493.png` et `exec-554fed71-aef1-48fe-ae90-2f0d7769965c.png`.

## Captures de l’app

Quatre nouvelles captures prises dans l’app locale après mise à jour des illustrations : Character Builder, Angle, Upscale et Détourage vidéo. Interface anglaise, thème clair, mode visiteur, explicitement indiqué sur les pages EN/FR/ES. Pas de résultat, de prix ou de réglage inventé dans une fausse interface. Recadrage des pixels pour retirer la navigation extérieure et le badge de développement ; panneau de l’outil conservé.

Les captures font 1316 × 820, entre 52 et 71 ko. Le registre `tool-workspace-assets.ts` possède les chemins versionnés. Le composant partagé `ToolWorkspacePreview` expose les captures en taille complète ; Angle conserve sa composition propre avec la capture remplacée. Les anciennes images d’interface de Character Builder et Upscale ne sont plus les médias des héros ni les images sociales de ces pages.

`ToolboxScene` reprend les illustrations du catalogue pour les états vides de l’app, toujours identifiés « Illustration ». Les traitements, contrôles, devis, authentification et lecteurs manuels ne changent pas. Les démonstrations réelles de Character Builder et les vues interactives Angle restent distinctes des nouvelles illustrations.

## Contenu et SEO

- Revue EN/FR/ES des cinq pages marketing : hub et quatre outils. H1 plus courts, termes métier conservés sur les pages spécialisées.
- Titres SEO, descriptions, URL canoniques, hreflang et robots conservés par rapport à l’état local avant D84 : [contrôle de quinze routes](review/tools-d84/seo-check.json).
- Routes françaises et espagnoles correctes après redirection des anciens chemins `/fr/tools` et `/es/tools` ; aucun changement de sitemap ou de politique de redirection.
- Fils d’Ariane structurés et URL Service/HowTo de Character Builder, Angle et Détourage vidéo corrigés pour suivre la locale. Les contenus restent rendus côté serveur.
- FAQ Upscale réécrite autour des médias acceptés, de la taille, du prix, des limites de reconstruction et de la réutilisation. Les réponses visibles et FAQPage partagent la même source. Suppression des promesses de fonctionnalités futures et du discours d’implémentation.
- Détourage vidéo : formulations françaises et labels des visuels traduits, tout en conservant les informations WebM VP9, MP4/MOV, transparence et fond vert.
- [54 liens publics et médias](review/tools-d84/links-check.json) répondent en HTTP 200. Les liens vers les outils authentifiés sont vérifiés dans la navigation et les captures visiteur ; aucune génération payante lancée.

Ce contrôle établit la conservation des signaux techniques vérifiés, pas un gain de classement. Aucun nouveau relevé GSC/Ahrefs n’a été réalisé pour ce lot.

## Vérification et limites

38 tests ciblés valides : contrats de pages, contenu Upscale/Détourage, locale des schémas, captures versionnées et contrats Angle (assets, mouvements, géométrie, préchargement responsive). TypeScript, lint frontend, lint d’exposition publique et diff check valides. Un garde-fou fournisseur trop large correspondait au mot espagnol « faltan » ; il utilise désormais des limites de mot tout en conservant la détection du nom du fournisseur.

Contrôles navigateur à 390 px et sur desktop : chargement des visuels, absence de débordement horizontal, choix portrait/planche, changement de vue Angle, capture Character Builder/Angle, FAQ exclusive et contraste clair/sombre. Captures de revue : [hub desktop](review/tools-d84/hub-desktop.jpg), [hub ES mobile](review/tools-d84/hub-mobile-es.jpg), [app dans la page](review/tools-d84/character-workspace-marketing.jpg), [Angle mobile](review/tools-d84/angle-mobile.jpg), [FAQ mobile](review/tools-d84/faq-mobile.jpg), [FAQ sombre](review/tools-d84/faq-dark.jpg).

Les nouveaux WebP sont bornés en taille, avec géométrie fixe et chargement différé hors héros. Ils sont servis directement pour éviter le problème de décodage des images lazy avec srcset observé dans le navigateur de revue ; le préchargement responsive propre à AngleOrbit est préservé. Pas de nouvelle politique vidéo.

Avant publication : comparer les performances sur des builds de production équivalents, en particulier le nouveau média du hub et les états vides raster de l’app, puis contrôler Safari/iOS. Cette mesure comparative n’a pas été faite sur le serveur de développement et aucun gain de Core Web Vitals n’est annoncé. Les captures anglaises en mode visiteur sont un choix transparent de cette version ; elles ne montrent pas une session authentifiée ni une génération terminée.
