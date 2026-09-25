# Audit des visuels de partage et captures publiques — 25 septembre 2026

## Périmètre

Inspection des métadonnées Open Graph et Twitter des pages publiques, de leurs images de repli, des visuels de blog/docs/modèles, et des captures de l’interface montrées sur l’accueil et les pages d’outils. Comparaison visuelle avec les pages de production et vérification des références locales dans le dépôt.

## Constat et corrections

| Surface | Constat | Correction |
| --- | --- | --- |
| Accueil, modèles, comparaison, tarifs, paiement à l’usage | Les anciennes cartes OG montraient des captures d’une interface et des offres périmées. Une première proposition de remplacement dessinait aussi un faux lecteur simplifié. | Nouvelles cartes 1200 × 630 tirées des pages de production du 25 septembre. La carte d’accueil montre le véritable lecteur en pause ; les autres montrent les sections réelles des pages concernées. |
| Repli global, blog et documentation | L’image de repli était une ancienne capture de la page tarifs. | Carte de marque actuelle ; logo de l’éditeur du schéma Article corrigé. |
| Outils Angle, Détourage, Character Builder et Upscale | Les captures `workspace-v1` montraient l’ancienne interface claire. | Captures de la production du 25 septembre, en WebP versionnés, utilisées sur les pages marketing ; dimensions OG ajustées pour Character Builder et Upscale. |
| Blog historique | Des images Sora 2, Veo 3 et comparatifs anciens accompagnent des articles explicitement consacrés à ces sujets. | Conservées comme archives éditoriales, sans les recycler comme image de repli ou vitrine générale. |
| Pages de modèles, exemples et vidéos partagées | Les pages de modèles ont des images locales ou de configuration ; les exemples et partages utilisent des miniatures de contenu public avec un repli. | Références locales vérifiées ; repli actualisé. Les miniatures générées restent dépendantes des données et médias actifs. |

Les anciennes URLs OG restent présentes dans `frontend/public/og` pour les partages déjà publiés ; le code actif utilise les nouvelles URLs versionnées. Les captures de l’accueil `app-desktop.jpg` et `app-mobile.jpg` sont conservées : elles reflètent encore la structure sombre de l’application. Une capture récente de la session connectée exposait des informations de compte ; elle n’a pas été publiée.

Les sources des cartes sont conservées dans `frontend/scripts/social-card-sources/`. Elles proviennent de `/`, `/models`, `/ai-video-engines` et `/pricing` sur `https://maxvideoai.com`, à une fenêtre de 1268 × 713 px. Le recadrage retire l’en-tête de compte et garde l’interface publique telle qu’elle apparaît ; `frontend/scripts/generate-social-cards.py` ne dessine aucun contrôle. La carte générique utilise l’en-tête réel de l’accueil ; celle de l’accueil montre le lecteur réel. Les noms de modèles et scores visibles dans les captures sont donc un état daté et devront être rafraîchis si la page change.

## Vérifications

- Les cinq nouvelles cartes font 1200 × 630 px ; les quatre captures d’outils font 1316 × 820 px et pèsent chacune moins de 150 Ko.
- Références d’images locales des modèles, articles et docs contrôlées : aucun fichier manquant dans l’inventaire.
- Test ciblé `tests/social-visual-assets.test.ts`, `npm run lint:exposure`, `node scripts/check-image-alt.mjs` et `git diff --check` : OK.
- Le lint global et les tests TypeScript via `tsx` n’ont pas pu démarrer : les binaires liés dans `frontend/node_modules` pointent vers des paquets absents dans cet environnement.
- `scripts/seo-guard.mjs` signale des liens non canoniques dans des worktrees et fichiers de test hors de ce lot ; ce contrôle global ne donne donc pas de résultat exploitable pour ces seuls visuels.

## Après déploiement

Contrôler les métadonnées rendues et l’image effectivement récupérée par les plateformes sociales sur quelques URLs EN, FR et ES. Les anciennes cartes restent visibles sur la production tant que ce lot n’est pas déployé ; certains réseaux peuvent aussi garder leur cache. Contrôler séparément les miniatures dynamiques si l’inventaire des générations publiques change. Pour rafraîchir les deux captures de l’accueil, utiliser une session de démonstration dépourvue de données privées.
