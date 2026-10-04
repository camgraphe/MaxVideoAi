# Audit éditorial des galeries d’exemples — 29 septembre 2026

## Périmètre et données

L’audit compare les pages publiques actuelles, la branche `codex/video-discovery` et l’export GSC du projet OUTREACH (`sources/2026-09-24/wave3/gsc-web-pages.csv`, du 26 août au 22 septembre 2026). Cette fenêtre précède la refonte locale : elle sert de référence, pas de mesure de son effet. L’export de requêtes et pages est un échantillon ; il ne permet pas d’attribuer une requête précise à `/examples/wan`. Les impressions du rapport AI sont un sous-ensemble du rapport Web et ne doivent pas y être additionnées.

| Page | Clics Web | Impressions Web | Conséquence éditoriale |
| --- | ---: | ---: | --- |
| `/examples/ltx` | 211 | 5 742 | Conserver le titre, la famille et les URL qui fonctionnent déjà. |
| `/examples/seedance` | 41 | 1 895 | Garder Seedance 2.5 en tête, sans attribuer les anciens clips à 2.5. |
| `/examples/wan` | 32 | 768 | Nommer Wan 3 et Wan 3 Prime dans les éléments visibles ; mesurer après publication. |
| `/examples/kling` | 29 | 1 168 | Préserver la couverture Kling 3 et Omni. |
| `/examples/hailuo` | 22 | 1 269 | Montrer MiniMax H3 et H3 Max tout en conservant les anciens Hailuo. |
| `/examples/happy-horse` | 20 | 342 | Distinguer 1.1 et 1.0. |

## Constat sémantique

Sur `/examples/wan`, « Wan video examples with prompts… » était un paragraphe sous le H1 « Wan Examples », et non un H2. Le H1 manquait de précision sur les versions présentées ; le premier H2 visible, « More videos », ne nommait pas la famille. Le surtitre « The video library » répétait le rôle de la page et consommait de la hauteur avant les vidéos. Des H1 génériques existaient aussi sur MiniMax, Happy Horse, Luma, Grok, FLUX et Pika.

La galerie montre des versions mélangées. Les titres éditoriaux décrivent donc la famille et ses versions actuelles, tandis que l’étiquette de chaque vidéo conserve son modèle réel. Le texte distingue le coût historique enregistré du devis actuel dans l’application. Une page de galerie ne promet pas que toutes ses vidéos proviennent de la version la plus récente.

## Décisions appliquées sur la branche

- Suppression du surtitre décoratif et de sa marge ; conservation du H1 et de la courte introduction au même emplacement.
- H1 explicites pour Wan 3 / Wan 3 Prime et les familles aux titres génériques, dans les trois langues. Les titres de LTX, Seedance, Veo et Kling restent en place.
- Métadonnées Wan explicites et H2 du guide Wan consacrés aux versions, à l’évaluation des résultats et à la différence entre coût enregistré et devis. Le titre Grok anglais cesse de répéter « Video ».
- Révision du texte Pika dans les trois langues : les exemples inspirent un nouveau rendu, sans promettre un mouvement identique ni un coût stable.
- H2 de reprise de galerie contextualisé par famille (« More Wan videos »), sans ajouter de bloc visuel.
- Aucun changement d’URL, de canonical, de hreflang, de pagination, de schéma vidéo, de vidéo source ou de fiche watch.

## Suivi après une éventuelle mise en production

Comparer par page les clics, impressions, CTR et position GSC sur des fenêtres équivalentes, puis examiner les requêtes réellement associées à chaque URL. Vérifier aussi l’indexation des watch pages et le nombre de vidéos vues après ouverture de galerie. Une variation GSC seule n’établit pas la causalité de cette révision ; saisonnalité, nouveaux modèles et changements de galerie peuvent jouer simultanément.
