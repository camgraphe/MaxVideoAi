> **D94 — Recette production et CWV :** une génération réelle MiniMax H3 Max réussie, devis/débit de **0,98 $** sous le plafond autorisé de 1 $. Résultat, lecture et historique vérifiés ; Stripe ouvert sans achat. 24 mesures Lighthouse à navigateur neuf sur six gabarits : majorité solide, Character Builder mobile variable (LCP médian 2,62 s, maximum 4,51 s). PageSpeed accueil : 94/100 mobile, LCP 2,3 s ; **CWV terrain mobile encore non validés** sur les 28 jours historiques (LCP 2,9 s, INP 252 ms). Deux libellés anglais dans le menu FR connecté à corriger. Lire [le bilan D94](production-tests-cwv-2026-09-15.md). Aucun correctif produit ni nouveau déploiement. Safari/iPhone, paiement final et nouveaux raccordements MCP externes non validés.

> **D93 — EN PRODUCTION :** Adrien autorise explicitement la publication et la vérification en production. La [PR #298](https://github.com/camgraphe/MaxVideoAi/pull/298) est fusionnée ; le commit `f60aa0c97` est publié sur [maxvideoai.com](https://maxvideoai.com/fr), déploiement `dpl_8j6ryLom1qXxJ7bWpW2QNqpNBvGk`. CI préfusion verte, build Production réussi, 18 contrôles HTTP/SEO et six sitemaps vérifiés : aucune URL perdue. Lecture vidéo et visuels représentatifs contrôlés en production. Lire [le bilan de publication](production-release-2026-09-15.md). Cette décision remplace les anciens prérequis de staging ; Safari/iOS, transactions authentifiées et clients MCP externes restent des limites de recette, pas des validations acquises. Worktree `codex/site-redesign` conservé pour les prochaines corrections.

> **D92 :** [PR #298](https://github.com/camgraphe/MaxVideoAi/pull/298) ouverte en brouillon, branche poussée pour revue après accord. Main reste `faa71e098`, déjà intégré. Aperçu Vercel de la branche lancé ; production non promue. La configuration Preview existante partage la base, Supabase et le stockage de production, et Stripe est en mode réel : revue publique/visuelle uniquement, pas une préproduction transactionnelle isolée. La CI a relevé 14 images décoratives à marquer explicitement ; correction `aria-hidden` sans changement de rendu, contrôle des textes alternatifs désormais vert. Consulter les checks de la PR pour le résultat hébergé actuel.

> **D91 :** blocage Studio/MCP de D90 corrigé dans le runtime de test ; 11 scénarios d’intégration passent. Recette avec base jetable et 297 exemples publics : 81 routes SEO, index et sitemaps vidéo valides, exclusions privé/noindex vérifiées. Fond flouté des exemples verticaux optimisé sans changer la composition : LCP mobile médian du cas testé 5,03 → 3,77 s, score 80 → 88. Lire [le bilan de validation et performance](prelaunch-validation-review-2026-09-15.md). Préproduction réelle, connexions MCP externes, Safari/iOS et CWV terrain restent à valider ; aucun push ni déploiement.

> **D90 :** `origin/main` (PR 297, `faa71e098`) intégré localement dans `codex/site-redesign`, design approuvé conservé. Sauvegarde D89 : `b7383a7d0` et `codex/site-redesign-backup-d89` ; merge : `5ae762017`. Build isolé validé, suite principale 5 531 réussites, 69 routes SEO et quatre sitemaps stables. **Pas encore de feu vert publication** : cinq cas Studio/MCP bloqués par une dépendance dans le serveur de test (reproduit sur main seul), recette authentifiée, données/sitemaps vidéo et CWV réels encore nécessaires. Lire [le bilan de fusion et ses limites](main-integration-review-2026-09-15.md). Aucun push ni déploiement.

> **D89 :** galeries prioritaires EN/FR/ES simplifiées, vidéos remontées de 270–283 px sur mobile, deux CTA utiles, comparatifs actuels et textes plus naturels. Parcours de réutilisation audité, erreur de chargement explicite et contrôle d’accès vidéo privé corrigé. 21 routes SEO et 90 destinations vérifiées, 115 tests. Lire [le bilan acquisition et prépublication](acquisition-prelaunch-review-2026-09-15.md). Build isolé vérifié ; main, connexion réelle, sitemaps vidéo et mesures CWV comparables restent des gates de publication. Dernière consigne : alléger et améliorer le visuel, ne pas empiler. Aucun déploiement.

> **D88 :** maillage et audit avant publication : footer 62 → 43 liens uniques, accès MCP contextuels sur les modèles, corrections FR/ES LATAM. Couverture sitemap identique à main/production ; corrections découverte dev et dates d’index. 127 destinations footer et 106 tests validés. Lire [le bilan et le plan de mise en ligne](linking-sitemaps-prelaunch-review-2026-09-15.md). Main reste à intégrer ; build de préproduction et sitemaps vidéo à valider avant publication. Aucun déploiement.

> **D87 :** panneaux de connexion MCP mieux espacés : fond ivoire propre au composant, 32 px de marge intérieure sur desktop et 20 px sur mobile. Retours ChatGPT/OpenClaw ; débordements des commandes et du visuel OpenClaw corrigés. Vérification des panneaux dépliés à 320 px et sur desktop. La précision d’Adrien porte surtout sur les marges, pas sur une modification du fonctionnement de connexion.

> **D86 :** refonte complète du hub MCP et des cinq guides Claude, ChatGPT, Codex, OpenClaw et n8n. Visuels, parcours de connexion, FAQ, menus et documentation EN/FR/ES repris ; fondation publique alignée sur les PR 295–297. Recherche SEO/GEO qualitative, 21 routes et 24 destinations internes vérifiées. Lire [le bilan MCP et SEO](mcp-redesign-seo-review-2026-09-15.md). Revue : http://localhost:3008/fr/mcp. Aucun déploiement ; le serveur OAuth et les migrations récentes de main restent à intégrer avant publication.

> **D85 :** navigation et footer refaits, logos/pictos, Assistants MCP dédié, ancres contextualisées, Blog accessible dans Outils → Guides et ressources. Marketing à palette fixe ; app sombre par défaut avec choix mémorisé. GSC 3 mois / 28 jours consulté ; 89 tests et 51 contrôles HTTP. Lire [le bilan navigation et GSC](navigation-gsc-review-2026-09-15.md). Aucun déploiement.

> **D84 :** parcours Outils repris : héros ivoire composé, humain en huit vues à la place du crocodile dans Character Builder, quatre captures actuelles de l’app, navigation commune, FAQ et contenu localisés. 15 routes SEO, 54 liens, 38 tests ciblés. Lire [le bilan Outils](tools-journey-review-2026-09-15.md). Revue : http://localhost:3008/fr/outils. Aucun déploiement.

> **D83 :** détails des comparatifs mieux annoncés (nombre de critères et caractéristiques, aperçu concret), boutons de génération renforcés, cartes tarifaires, FAQ orientée choix et accordéon exclusif. Contrôle mobile et thème sombre ; 48 tests ciblés, métadonnées inchangées sur trois routes EN/FR/ES. Lire [le bilan détails et FAQ](compare-details-review-2026-09-15.md). Revue : http://localhost:3008/fr/comparatif/minimax-h3-vs-minimax-h3-max#scores. Aucun déploiement.

> **D82 :** refonte des pages comparatives : héros court, notes globales puis galeries indépendantes (jusqu’à trois vidéos par modèle), lecteur sur place, grille sombre et détails dépliables. Dernier choix d’Adrien : vidéos juste sous les notes. SEO comparé sur six routes, 80 liens vérifiés, 52 tests ciblés. Lire [le bilan comparatifs](compare-pages-review-2026-09-15.md). Revue : http://localhost:3008/ai-video-engines/minimax-h3-vs-seedance-2-5. Aucun déploiement.

> **D81 :** seconde passe modèles : vidéos plein cadre (recadrage cinéma accepté), FAQ/références dépliables, conseils et caractéristiques compactés, vrais logos, contraste sombre corrigé. Contenu repris sur 12 modèles EN/FR/ES. GSC/Ahrefs consultés ; six pages comparées à la production avec signaux SEO conservés, 49 comparatifs vérifiés. Lire [le bilan SEO et design modèles](model-pages-seo-review-2026-09-14.md). Revue : http://localhost:3008/models/minimax-h3. Aucun déploiement.

> **D80 :** H1 accueil FR « La vidéo IA. Sans abonnement. », ES « Video con IA. Sin suscripción. ». Première passe du gabarit modèles : titre éditorial, scène vidéo panoramique, tarifs et navigation compacts, Prompt Lab désencadré. Revue : http://localhost:3008/fr/modeles/seedance-2-5. Les médias des modèles sont disponibles via la copie publique locale, sans base de production. Lire [le bilan modèles](model-pages-first-pass-2026-09-14.md).

> **D79 :** passe SEO accueil EN/FR/ES terminée : GSC, comparaison main/production, FAQ et maillage repris, orientation utile à la place du bloc « Bases », schémas serveur. Lire [le rapport SEO](home-seo-review-2026-09-14.md). Performance mobile en build production à valider avant publication.

> **D78 :** démonstration tarifaire compactée : environ 210 px de hauteur retirés sur desktop (1185 px), titre et marges réduits, prix et étapes conservés.

> **D77 :** démonstration tarifaire Wan 3 avec les composants réels du composeur : 5 s / 720p → 15 s / 720p → 15 s / 1080p. Le configurateur multi-modèles rejeté est remplacé. Revue : http://localhost:3008/fr#your-price.

> **D76 :** trois grandes vignettes outils rétablies : WebP locaux directs, cadre stable, chargement lazy conservé.

> **D75 :** enchaînement du héros sans passage visible par la vignette : dernière image conservée jusqu’à la première image de la vidéo suivante, sans préchargement supplémentaire.

> **D74 :** outils allégés : trois cartes principales, six petits raccourcis dessous. Sur mobile, cartes défilables et raccourcis sur deux colonnes.

> **D73 :** bloc comparatif resserré (environ 290 px de hauteur retirés à 1240 px), explication du calcul dépliable. Les notes et trois critères restent visibles.

> **D72 :** accueil aligné sur les pages comparatives de la branche : PairedScores partagé, rond/losange sur une échelle commune et critères dépliables. Les barres séparées de D71 sont retirées.

> **D71 :** comparatif sombre avec VS, notes globales, aperçu de 3 critères sur 11 et rotation Seedance/Veo/LTX face à Kling. Pause et sélection manuelle disponibles ; calcul global identique au comparateur.

> **D70 :** galerie asymétrique fusionnée avec les quatre usages ; modèles en pied compact. La deuxième grille d’usages est retirée. Voir http://localhost:3008/#creations.

> **D69 :** les vidéos du héros s’enchaînent à leur fin naturelle, puis reviennent au premier modèle. Pause et sélection manuelle conservées ; démarrage mobile manuel.

> **D68 :** héros compacté, lien assistants redondant retiré, comparatif et garanties regroupés, logos sur une rangée à défilement manuel.

> **D67 — Dernier ordre :** héros → bloc app noir avec bande assistants → créations → choix des modèles → outils → tarifs → questions. La section assistants autonome a été retirée de l’accueil. Aperçu : http://localhost:3008/fr#create.

> **État actuel — D66 / passe 13 :** reprise de composition de l’accueil. Usages, comparaison et modèles réunis dans un chapitre illustré ; outils avec les vignettes du catalogue ; copie et hiérarchie revues. Lire [implementation-13.md](implementation-13.md) avant les propositions historiques. Aperçu local : http://localhost:3008/#choose.

> **D65 — Galerie fusionnée :** inspiration et exemples réunis dans la composition asymétrique, avec accès par modèle sous les vidéos. Dernier état : http://localhost:3008/#creations.

> **Dernière correction — D63–D64 :** héros ivoire, accueil regroupé par sujets, bloc outils reconstruit et tarifs clairs. Voir les dernières décisions avant les directions historiques. Aperçu : http://localhost:3008/fr.

> **Galeries raccordées pour la revue locale :** copie de 297 exemples publics, sans base de production. Aperçu en mode développement sur le port 3008. Voir [le fonctionnement et la commande de reprise](../engineering/local-public-examples-preview.md).

> **Reprise active — D58–D59 : reconstruction approfondie, fonds verts rejetés.** La passe 11 est jugée trop proche du site d’origine. Adrien demande quasiment un nouveau site marketing et une tâche longue. Direction actuelle : charbon neutre, blanc cassé, cuivre discret ; couleurs portées par les créations. Passe 12 intégrée et compilée dans le même worktree, prête pour revue locale : lire [le bilan actuel](implementation-12.md), puis ouvrir [le vrai accueil](http://localhost:3008/fr). Aucun déploiement.

> **Historique — D57 : première passe intégrée au vrai site, jugée insuffisante depuis.** Adrien autorise une refonte marketing étendue, puis une revue de correction. Lire [le bilan de la passe réelle 11](implementation-11.md) avant les maquettes historiques. Aperçu compilé local : [accueil FR](http://localhost:3008/fr), [ES](http://localhost:3008/es). Aucun déploiement. D57 prime sur les attentes de validation des planches D51–D56.

> **Historique — D56 :** bloc app de `home-app-connect.png` rejeté (captures tassées, mauvaise composition). Nouvelle proposition isolée : [ordinateur et téléphone superposé](review/direction-10/index.html#app-devices). Non validée ; typographie à harmoniser, mobile à composer.

# Point de reprise — refonte MaxVideoAI

## Reprise active — 14 septembre 2026

Adrien a explicitement demandé la reprise dans le worktree existant, puis donné « ok go » pour le lot visuel. La pause historique ci-dessous est levée.

- Travail toujours dans `codex/site-redesign` ; aucun merge de `main`, push ni déploiement.
- Derniers retours **D53–D55** : références dans l’app et Connect séparés ; OpenClaw/n8n supposés disponibles au lancement ; vraies vues app desktop/mobile demandées. Version active : `review/direction-10/home-app-connect.png`. Captures originales en mode visiteur dans `local-assets/`, visibles dans la revue ; leur état marketing connecté reste à préparer.
- Retour précédent **D52** : accueil trop produit. Version précédente `review/direction-10/home-diversity.png` : cinéma, danse, animation, récit et paysage ; images à gauche pour Références et Website Move ; galerie avec titre au-dessus. `home.png` est désormais la version précédente.
- Lire désormais **D51–D55**, [direction-10.md](direction-10.md) et la [revue 10](review/direction-10/index.html), puis les sources 09 ci-dessous.
- Lot 10 : accueil anglais desktop/mobile, système Compare synthèse/détail et storyboard Website Move autour d’un casque fictif. Ces choix restent proposés, pas validés.
- Les planches sont des compositions ImageGen, pas des captures de nouvelle application ni des animations. Les valeurs Compare ont une source exacte ; les points du raster ne sont pas une géométrie quantitative de référence.
- Le premier accueil 10 a été écarté de la revue active pour confusion entre référence du sac et résultat. Une correction ciblée est conservée avec son prompt. Les originaux 09 restent propriétaires de la preuve média.
- La planche Website Move comporte un timecode illustratif `01:14` à écarter ; ni durée finale ni vidéo produite. Le marquage MaxVideoAI du casque est une approximation de concept, pas un produit commercial.
- Prochaine décision : retour sur ce lot visuel, correction de la cible retenue, puis fabrication/mesure des effets aux emplacements retenus. Pas de nouvelle génération vidéo sans devis accepté.

## Sauvegarde historique — 10 septembre 2026

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
