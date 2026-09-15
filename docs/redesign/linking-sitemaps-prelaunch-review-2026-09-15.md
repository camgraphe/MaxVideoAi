# D88 — Maillage, sitemaps et langues avant publication

15 septembre 2026. Travail dans `codex/site-redesign`, aucun merge ni déploiement. Comparaison avec `origin/main` fraîchement récupéré (`faa71e098`) et les réponses publiques de `https://maxvideoai.com`. La production n’a pas été modifiée.

## Décision

Alléger le footer en conservant les destinations stratégiques et celles qui apportent déjà des visites. Renforcer les liens dans le contenu des pages, conserver les URL et leurs règles d’indexation, corriger les incohérences de sitemap et les formulations repérées dans les langues. Cette passe améliore des éléments vérifiables ; elle ne garantit ni hausse de positions, ni citations par les assistants, ni absence de fluctuation après publication.

Google ne fixe pas de nombre idéal de liens. Il recommande des liens explorables, des ancres descriptives et des destinations utiles dans leur contexte. Le nombre choisi ici est une décision éditoriale, pas un seuil SEO. [Google : bonnes pratiques des liens](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

## Footer : avant et après

Mesure des ancres `<a>` dans le footer, sur les trois accueils, hors menu et contenu principal :

| Surface | Liens | Destinations uniques |
| --- | ---: | ---: |
| Production | 52 | 52 |
| Refonte avant D88 | 62 | 56 |
| Refonte après D88 | 43 | 43 |

La refonte avait ajouté un bloc assistants puis répété les mêmes destinations dans une colonne. La correction enlève ces doublons et réduit le nombre total d’environ 31 % par rapport à la refonte précédente. Ce pourcentage mesure la simplification, pas un gain de référencement.

Le footer conserve :

- Huit modèles prioritaires : MiniMax H3, Seedance 2.5, Kling 3 Pro, Veo 3.1, LTX 2.5 Pro, Wan 3, Wan 3 Prime et Happy Horse 1.1 ; accès à tous les modèles.
- Quatre comparatifs : deux récents (MiniMax H3 / Seedance 2.5, Kling 3 Pro / Seedance 2.5), deux entrées existantes à protéger (Seedance 2.0 / Fast, Gemini Omni Flash / Veo 3.1) ; accès au hub complet et aux guides par usage.
- Sept familles d’exemples, avec LTX en premier, puis Kling, Seedance, Wan, Veo, MiniMax et Happy Horse ; accès à toute la galerie.
- Un bloc MCP avec Claude, ChatGPT, Codex, OpenClaw, n8n, hub et documentation. OpenClaw et n8n ont des libellés d’accessibilité descriptifs ; les marques restent visibles.
- Tarifs, paiement à l’usage, Angle, Character Builder, hub Outils ; Blog, Premiers pas, Contact, Entreprise et État du service ; accès légaux et cookies conservés.

Les variantes H3 Max, Kling Turbo, LTX Fast restent dans le menu Modèles et les hubs. Sora, Pika, Luma, Grok et FLUX restent accessibles via le menu Exemples et la galerie complète. Les quatre usages détaillés restent dans les menus et leur hub. Aucun `nofollow`, masquage de liens destiné aux robots, suppression de page ou redirection liée à ce tri.

Le footer n’est plus le catalogue exhaustif. Les projections de navigation vérifient la publication, puis `frontend/config/marketing-footer.ts` sélectionne les priorités. Il ne crée aucune identité modèle indépendante du registre.

## Maillage contextuel et acquisition existante

La revue D85 contient le relevé GSC du 15 septembre : tableaux partiels, pas un export exhaustif. Cette passe réutilise explicitement ce relevé ; elle ne prétend pas avoir extrait de nouvelles données GSC. [Relevé et limites D85](navigation-gsc-review-2026-09-15.md).

LTX est la principale famille d’exemples observée (1 139 clics sur trois mois dans le relevé). Seedance 2.0 vs Fast recevait 146 clics ; Gemini Omni Flash vs Veo 3.1, 44 clics et 17 319 impressions. Ces pages ne sont pas abandonnées parce que des versions plus récentes existent. MiniMax H3 et Seedance 2.5 sont promus pour leur actualité produit et leur signal récent observé, sans prédiction de volume.

Corrections :

- Les ancres MCP parlent de création, comparaison et automatisation selon leur contexte. Elles ne répètent plus systématiquement « budget/film » et les mêmes trois marques.
- Certaines fiches modèles n’avaient aucun accès MCP dans le corps principal lorsque leur bloc d’outils de préparation était absent. Un lien compact et localisé apparaît désormais dans ce cas, avec la précision « modèles compatibles ». Il ne promet pas que tous les modes de chaque modèle fonctionnent dans tous les assistants ; le gate de publication est conservé.
- MiniMax H3 EN/FR/ES pointe directement vers sa famille canonique `hailuo` pour les exemples, au lieu de passer par l’alias `minimax-h3`. Les alias continuent de rediriger.
- Les anciens modèles indiqués sous les vidéos de la home restent les vrais modèles utilisés. Remplacer leur nom par une version actuelle sans remplacer le média falsifierait la preuve.

La vérification des hubs et des menus maintient les chemins de découverte des pages sorties du footer. Cela ne prouve pas l’absence de toute page orpheline dans les milliers de liens du corpus ; une analyse exhaustive du graphe après intégration du build reste distincte.

## Sitemaps : couverture et exclusions

Les propriétaires sitemap, robots, registre, roster et indexation des comparatifs étaient identiques à `origin/main` avant les deux corrections de cette passe.

| Sitemap de production | URL `loc` |
| --- | ---: |
| `sitemap-en.xml` | 385 |
| `sitemap-fr.xml` | 299 |
| `sitemap-es.xml` | 325 |
| `sitemap-models.xml` | 156 = 52 modèles × 3 langues |
| `sitemap-video-pages.xml` | 46 |
| `sitemap-video.xml` | 46 |

Index et six fichiers : HTTP 200 en production. Aucun doublon à l’intérieur d’un fichier. Les 46 pages watch présentes dans les deux fichiers vidéo constituent le recouvrement attendu entre index web et métadonnées vidéo, pas 92 pages différentes. Les fiches modèles ne sont pas répétées dans les fichiers de langues.

La projection complète des sources locales donne exactement les mêmes ensembles d’URL que la production pour EN, FR, ES et modèles : **aucun ajout ou retrait involontaire**. Les modèles prioritaires, leurs variantes publiées, le hub MCP, ses cinq intégrations et les docs sont déjà présents. Les pages MCP représentent 21 URL sur trois langues ; la refonte renouvelle leur présentation, elle ne crée pas leurs adresses.

Les outils publics incluent le hub, Angle, Character Builder, Upscale et Background Removal. Les autres raccourcis d’outils de l’app ne deviennent pas artificiellement des pages marketing indexables. Les intégrations MCP cachées restent exclues par le registre.

Aucune route app, admin, API, authentification ou OAuth dans l’ensemble public inspecté. Les variantes locales exclues des comparatifs restent exclues selon les règles existantes. Les volumes FR/ES inférieurs à EN ne sont donc pas à combler automatiquement. Aucun hreflang XML ne pointe vers une URL absente du jeu de sitemaps ; codes `en`, `fr`, `es`, `x-default`.

Deux défauts corrigés :

1. En développement, le manifeste Next ne contenait que les routes déjà compilées. Les sitemaps de langues tombaient à huit URL et répondaient 503. La découverte utilise maintenant les routes source en développement ; la production conserve le manifeste du build. Les trois fichiers locaux répondent ensuite 200 avec 385/299/325 URL.
2. Les dates manuelles de l’index (3/4 septembre) pouvaient masquer des dates d’enfants plus récentes (11/13 septembre). L’index prend maintenant la date la plus récente entre la valeur manuelle et celle des enfants. Aucune remise arbitraire de toutes les URL à la date du jour.

Un sitemap indique les URL canoniques souhaitées dans la recherche ; il ne garantit pas leur indexation. Google ignore `priority` et `changefreq` et attend des `lastmod` fiables. Au moment de publier les contenus remaniés, utiliser leurs dates de modification réelles. [Google : construire et soumettre un sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?authuser=77).

## Qualité des langues

Les URL françaises et espagnoles localisées sont conservées. Le ciblage utilise `hreflang="es"` pour la langue espagnole générale ; la rédaction reste LATAM. `es-419` est utilisable comme indication linguistique BCP 47 dans d’autres contextes, mais pas comme code régional hreflang pris en charge par Google. Il ne faut pas remplacer `es` par `es-419` dans les alternates. [Google : versions localisées](https://developers.google.com/search/docs/specialty/international/localized-versions).

La passe corrige notamment :

- « vídeo/vídeos » en « video/videos » dans MiniMax H3 ES et les textes MCP/Claude ciblés. Les deux variantes sont grammaticalement correctes ; c’est une cohérence LATAM, pas la correction d’un blocage d’indexation.
- Footer : « Comparer les modèles », « Changer l’angle de vue », « État du service », « Recursos », « Modelos de video con IA », libellé de remboursement ES et accès n8n.
- Tarifs partagés : « Premier essai », « Usage courant », « Prévisualisation du storyboard » et remplacement de calques comme « Still 4K », « Check I2V », « Prix live » en FR/ES. Montants, durée, audio et algorithmes intacts.
- Prompts de démonstration exacts et noms propres des produits conservés.

La page historique `/return-policy` reste une page légale partagée en anglais, avec une ancre traduite. Ce n’est pas une version FR/ES de la politique. Le parcours de l’app reste partagé. Ces exceptions ne sont pas présentées comme des traductions complètes.

Relecture éditoriale ciblée sur les nouvelles surfaces et un échantillon de fiches, pas certification de chaque phrase du blog et de toutes les comparaisons. Le corpus restant doit être repris par priorité de trafic, puis par priorité produit.

## Passage vers la production

La branche est encore à 22 commits propres contre 64 commits côté `main` depuis leur ancêtre commun. Il existe 45 chemins communs entre modifications de main et état de travail au relevé ; ce sont des **zones à réconcilier**, pas 45 conflits Git prouvés. Certaines fondations publiques MCP ont déjà été reprises sélectivement dans D86. Les changements serveur OAuth de main n’ont pas été fusionnés par cette refonte.

Ordre recommandé :

1. Figer la version de refonte retenue et son état de référence : captures, URL, GSC daté, canonicals et ensembles de sitemaps. Enregistrer le travail avant toute intégration Git.
2. Intégrer le main courant en conservant les derniers correctifs serveur/OAuth, politiques de publication et données modèles. Revoir les conflits par propriétaire, particulièrement MCP, acquisition, i18n et schémas.
3. Construire un aperçu de préproduction isolé, non indexable comme domaine de preview, avec la configuration de contenu et d’authentification appropriée. Valider les six sitemaps, les redirections et l’index sur ce build, pas uniquement le serveur de développement.
4. Contrôler mobile, clavier, médias, connexion/déconnexion, devis et paiement dans les environnements de test appropriés. Mesurer LCP/INP/CLS avant/après dans des conditions comparables ; aucun gain CWV n’est revendiqué ici.
5. Publier seulement après cette recette, en conservant une révision de retour arrière. Vérifier immédiatement robots, canonical de production, langues, sitemaps, pages prioritaires et absence de `noindex` de preview sur les pages publiques.
6. Annoter la date de publication. Suivre séparément Modèles, Exemples, Comparatifs, Outils, Blog, MCP et chaque langue : erreurs dès le lancement, puis clics/impressions/CTR et conversions sur fenêtres comparables de 7/28 jours. Une variation globale de position ne suffit pas à attribuer un effet au design.

L’index et les deux sitemaps vidéo de cet aperçu local répondent encore 503 sans base de données. La production répond 200 ; leur validation après intégration en préproduction reste requise. Aucun faux sitemap vide n’est renvoyé pour masquer cette absence.

## Prochaines optimisations de croissance

Prioriser les pages d’exemples déjà visitées : accès directs au modèle correspondant, réglages/prix, comparaison utile et CTA de création. Pour MiniMax H3, Seedance 2.5, LTX 2.5 et Wan 3, associer des preuves réellement produites par ces versions à leurs guides. Pour MCP, compléter les preuves et instructions propres à chaque client à partir d’un parcours réellement testé, puis distribuer les guides via les canaux autorisés. Pas de création massive de pages par pays, de couples de comparaison sans valeur propre ni de promesse de citation IA.

Les opportunités de CTR GSC et de nouveau contenu devront être traitées sur requêtes/pages exactes. Le maillage prépare leur découverte ; il ne remplace ni les preuves, ni la qualité des pages, ni la distribution.


## Recette finale de cette passe

- **127 destinations distinctes du footer**, trois langues réunies : HTTP 200, un H1, canonical attendu, aucune page noindex parmi ces destinations. Les ancres FR/ES pointent vers les destinations localisées, avec l’exception explicite de la politique légale partagée.
- Une réponse 500 transitoire du hub best-for ES pendant la compilation simultanée Next a été reprise séquentiellement : 200 avec la bonne canonical. L’incident et la reprise restent dans les preuves ; ce contrôle de développement n’est pas une mesure de disponibilité de production.
- **106 tests ciblés passent** : navigation/publication, maillage des modèles, sitemap/date/manifest, langues/hreflang, rendu contextuel et SEO MCP. Deux anciens tests MCP ont été mis en cohérence avec les titres et composants réellement approuvés en D86 ; les contrats de canonical, langue, contenu SSR, preuves et disponibilité restent vérifiés.
- TypeScript sans erreur ; lint frontend et lint ciblé des derniers changements ; contrôle d’exposition publique et `git diff --check` réussis. Aucun `next typegen` lancé pendant l’aperçu.
- Revue navigateur du footer FR desktop et ES mobile à 390 px : 43 liens uniques, logos chargés, aucun débordement horizontal.
- Les détails de couverture sitemap et les huit pages de relecture éditoriale sont conservés avec les résultats HTTP.

Preuves : `docs/redesign/qa/linking-d88/`. Ce n’est ni une recette complète d’authentification/paiement, ni un audit CWV en build de production, ni une relecture de toutes les pages du corpus.
