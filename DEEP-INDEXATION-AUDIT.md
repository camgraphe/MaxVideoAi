# MaxVideoAI — Audit approfondi de l’indexation

**Date de l’audit :** 11 juillet 2026

**Source principale :** exports complets des rapports d’indexation Google Search Console

**Périmètre :** propriété `https://maxvideoai.com/`, sitemaps live, routes Next.js et mécanismes de soumission

## Conclusion opérationnelle

L’intuition sur les CSS était juste, avec une nuance importante : Google ne les a pas indexés. Il les a explorés puis rangés dans « Explorée, actuellement non indexée ».

Sur les **866 URL** de ce rapport :

| Type | URL | Part |
|---|---:|---:|
| CSS Next.js versionnés | 531 | 61,3 % |
| Images `/_next/image` | 6 | 0,7 % |
| Pages HTML | 329 | 38,0 % |
| JavaScript | 0 | 0 % |

Les 531 CSS sont surtout du bruit de crawl lié aux déploiements Vercel. Ils ne doivent pas masquer le problème central : le site donne à Google beaucoup trop d’URL HTML générées ou faiblement différenciées, notamment des comparatifs, des pages de rendu privées et des variantes avec paramètres.

La priorité n’est donc pas de bloquer les CSS. Elle est de contrôler strictement quelles pages HTML peuvent être découvertes, soumises, liées et indexées.

## 1. Ce qui est réellement indexé

Google Search Console recense exactement **905 pages indexées**. L’extraction complète ne contient :

- aucun fichier `.css` ;
- aucun fichier `.js` ;
- aucune ressource `/_next/` ;
- seulement trois URL avec paramètres.

### Répartition principale des 905 pages

| Famille | URL indexées |
|---|---:|
| Comparatifs détaillés | 641 |
| Pages `/video/` | 53 |
| Modèles | 99 |
| Exemples | 25 |
| Blog | 23 |
| Outils | 10 |
| Autres pages marketing, légales, docs et application | 54 |

Les comparatifs détaillés représentent **70,8 % de tout l’index Google du domaine**.

### Comparatifs indexés par langue

| Langue | Comparatifs déclarés | Comparatifs indexés | Taux d’indexation |
|---|---:|---:|---:|
| Anglais | 292 | 261 | 89,4 % |
| Français | 292 | 174 | 59,6 % |
| Espagnol | 292 | 206 | 70,5 % |
| **Total** | **876** | **641** | **73,2 %** |

Ce résultat change le diagnostic : Google n’ignore pas massivement la matrice de comparatifs. Il en a déjà indexé près des trois quarts, alors que seule une minorité dispose d’un contenu éditorial ou de tests réellement spécifiques.

Les trois URL paramétrées indexées sont :

- `/es/galeria?engine=hailuo` ;
- `/app?from=job_…` ;
- `/app?engine=seedance-2-0-fast&ar=9:16&mode=t2v`.

Les deux URL `/app` correspondent vraisemblablement aux deux cas « Indexée malgré le blocage par robots.txt ». Un blocage robots n’est pas une méthode fiable de désindexation : il empêche Google de lire une directive `noindex`.

## 2. Les 866 URL explorées mais non indexées

L’extraction a couvert les quatre pages du rapport GSC : 250 + 250 + 250 + 116 URL, sans doublon.

### Les 531 URL CSS

Elles correspondent à :

- 85 chemins de fichiers CSS uniques ;
- 254 identifiants de déploiement Vercel `dpl_*` ;
- 531 variantes possédant toutes un paramètre `?dpl=`.

Principaux fichiers concernés :

| Fichier CSS | Variantes explorées |
|---|---:|
| `9395511f6d488668.css` | 107 |
| `59b57aafdfb7f36c.css` | 66 |
| `ed10512024e2b318.css` | 47 |
| `82f024a52000045c.css` | 31 |
| `5016c9854110d15b.css` | 30 |

Ce phénomène provient de ressources hachées et de paramètres de déploiement découverts au fil des versions. Les réponses actuelles ont le bon type MIME et un cache long `immutable`. Les anciens bundles finissent naturellement en 404 lorsqu’ils ne sont plus déployés.

### Ce qu’il ne faut pas faire avec ces CSS

- Ne pas bloquer `/_next/static` dans `robots.txt` : Google a besoin du CSS et du JavaScript pour rendre les pages.
- Ne pas rediriger les anciens bundles vers les nouveaux : leur contenu n’est pas interchangeable.
- Ne pas essayer de leur ajouter une canonical HTML.
- Ne pas considérer la baisse de ces 531 URL comme un KPI SEO prioritaire.

Le bon indicateur est le nombre de **pages HTML utiles** indexées ou exclues, pas le nombre brut de ressources explorées.

### Les 329 pages HTML réellement actionnables

| Famille | URL |
|---|---:|
| Comparatifs propres | 183 |
| Pages `/video/job_*` | 36 |
| Pages modèles | 28 |
| Exemples avec paramètres | 17 |
| Autres URL avec paramètres | 14 |
| Application, connexion ou workspace | 9 |
| Pages légales | 7 |
| Exemples propres | 5 |
| Comparatifs `?order=` | 5 |
| Docs | 2 |
| Outils | 2 |
| Blog | 1 |
| Autres pages propres | 20 |

La majorité des comparatifs propres non indexés est en français ou en espagnol. Cela confirme une combinaison de faible différenciation, dilution du maillage et demande locale insuffisante — pas une incapacité technique générale de Google à explorer le site.

## 3. Les autres catégories d’exclusion

### Exclues par `noindex` : 733 URL

| Famille principale | URL |
|---|---:|
| Vidéos de rendu EN `/video/job_*` | 470 |
| Vidéos de rendu localisées | 9 |
| Variantes de comparatifs `?order=` | 158 |
| Comparatifs propres non publiés/inversés | 74 |
| Autres paramètres, application, login et tracking | 22 |

La directive `noindex` fonctionne, mais elle révèle une surface de découverte inutilement grande. Une URL privée ou sans valeur éditoriale ne devrait idéalement pas être liée publiquement ni soumise aux moteurs avant de devoir être désindexée.

### Bloquées par `robots.txt` : 383 URL

Le rapport est presque entièrement constitué d’URL `/app...`, avec au moins une URL `/generate`. Ce ne sont pas des CSS/JS.

Pour les routes privées, choisir une stratégie explicite :

- réponse `401/403` si la ressource est réellement privée ;
- réponse `404/410` si elle ne doit plus exister publiquement ;
- ou page accessible au crawler avec `noindex` si une page de connexion publique doit rester disponible.

Éviter de combiner `Disallow` et `noindex` pour tenter une désindexation.

**État au 11 juillet 2026 :** les règles locales `Disallow: /app`, `/fr/app` et `/es/app` ont été retirées uniquement de la section générale afin que Google puisse lire le `noindex`. Elles restent présentes pour les crawlers IA nommés. Les routes `/app` conservent leur metadata `noindex` et leur en-tête middleware `X-Robots-Tag`, y compris avec paramètres. Les API, l’admin et les autres zones sensibles restent bloqués. Après déploiement, les deux URL déjà indexées devront également être demandées en suppression temporaire dans GSC pour accélérer leur disparition.

### Autres motifs GSC

| Motif | URL |
|---|---:|
| Redirections | 156 |
| 404 | 72 |
| Page alternative avec canonical correcte | 25 |
| Détectée, actuellement non indexée | 116 |
| Doublon, Google a choisi une autre canonical | 1 |
| Indexée malgré blocage robots | 2 |

## 4. Causes racines dans l’application

### 4.1 IndexNow soumet des comparatifs non publiés

Le script `scripts/indexnow-submit-changed.mjs` génère toutes les combinaisons entre un modèle modifié et les modèles live/early-access, au lieu d’utiliser la liste officielle `publishedPairs`.

- 36 modèles peuvent créer 630 paires théoriques.
- Seulement 292 paires sont officiellement publiées.
- Jusqu’à 338 paires anglaises non publiées, soit 1 014 URL EN/FR/ES, peuvent être soumises au fil du temps.
- Les URL non publiées répondent souvent `200` avec `noindex, follow` et une canonical propre : elles sont donc explorables et consomment inutilement du crawl.
- Le script soumet aussi les mauvais hubs localisés `/fr/ai-video-engines` et `/es/ai-video-engines`, qui redirigent vers `/fr/comparatif` et `/es/comparativa`.

**Correctif impératif :** toute URL envoyée à IndexNow doit être un sous-ensemble des URL canoniques, indexables et `200` du sitemap actif. Ajouter un test automatisé `IndexNow URLs ⊆ sitemap canonical URLs`.

**État au 11 juillet 2026 :** le sélecteur de comparatifs IndexNow a été aligné localement sur la même liste `publishedPairs` que le sitemap. Les mauvais hubs localisés, six pages modèle hors sitemap et la troncature silencieuse à 200 URL ont été retirés. Un test d’intégration exécute désormais le dry-run complet et contrôle les URL privées, paramétrées, redirigées ou `noindex`. Le déploiement et le contrôle post-déploiement restent à effectuer.

### 4.2 La matrice de comparatifs domine le sitemap

Le sitemap live contient 1 226 URL de pages :

| Famille | URL |
|---|---:|
| Comparatifs | 879 |
| Modèles | 129 |
| Vidéos éditoriales | 44 |
| Best-for | 39 |
| Exemples | 33 |
| Blog | 27 |
| Outils | 15 |
| Docs | 9 |
| Pages fixes | 51 |

Les comparatifs constituent **71,7 % du sitemap** et **82,5 % de chaque sitemap linguistique**.

Seulement 17 paires par langue disposent d’overrides éditoriaux dédiés. Le code ne révèle que 56 paires anglaises soutenues par au moins un signal stratégique fort (showdown, score, popularité, use case ou enrichissement). Le volume publié excède donc largement le volume réellement différencié.

### 4.3 Les rendus privés deviennent des URL crawlables

GSC expose environ 479 URL `/video/job_*` en `noindex`, auxquelles s’ajoutent 36 pages de job dans « explorée, non indexée » et 53 URL `/video/` déjà indexées. Le sitemap vidéo ne contient pourtant que 44 pages éditoriales.

Il faut séparer sans ambiguïté :

- les 44 vidéos publiques, éditoriales et indexables ;
- les rendus utilisateurs privés ou temporaires, non liés publiquement et servis via contrôle d’accès ou URL signée ;
- les anciens jobs publics devenus inutiles, à retirer des liens et à faire expirer proprement.

Les liens entre vidéos éditoriales approuvées utilisent désormais localement leur slug canonique au lieu de l’identifiant `job_*`. Les liens de galerie et les pages de partage utilisateur restent inchangés dans ce lot afin de ne pas casser une fonctionnalité produit sans validation préalable.

### 4.4 Trop de variantes d’images sont rendues dans le HTML

Sur huit pages représentatives, le HTML référençait 1 064 ressources distinctes, dont 989 variantes `/_next/image`. La page d’accueil seule exposait 478 variantes optimisées issues de 43 images.

Ce n’est pas un problème d’indexation directe, mais cela augmente le travail de rendu et le coût de crawl. Les réponses `/_next/image` observées ont aussi un cache faible (`max-age=0, must-revalidate`).

Actions : renseigner des `sizes` précis, réduire les galeries hors écran rendues côté serveur, configurer un TTL d’image de 30–60 jours et versionner les médias publics durables.

**État au 11 juillet 2026 :** `images.minimumCacheTTL` est configuré localement à 604 800 secondes, soit 7 jours. Ce compromis améliore le cache sans risquer de figer pendant un mois les médias marketing encore servis sous des noms stables. Le travail restant porte sur le versionnement des images mutables, les attributs `sizes` et la réduction des variantes rendues au SSR ; un TTL de 30–60 jours pourra ensuite être appliqué aux URL versionnées.

## 5. Politique d’indexation recommandée

| Famille | Décision | Conditions |
|---|---|---|
| Accueil, pricing, modèles, exemples, outils | Garder et enrichir | Contenu exact, schema fiable, intention unique |
| Hubs comparatifs | Garder | Maillage vers une sélection éditoriale limitée |
| Comparatifs avec demande ou preuve unique | Garder | GSC/backlinks/conversions ou test réel documenté |
| Comparatifs générés sans preuve | Retirer du sitemap + `noindex,follow` | Réindexer uniquement après passage du gate qualité |
| Variantes `?order=`, filtres et tracking | Canonicaliser et ne plus lier | Rediriger les paramètres purement marketing quand sûr |
| Jobs/rendus privés | Ne jamais indexer | Auth, URL signée, `401/403`, expiration ou `404/410` |
| Vidéos publiques éditoriales | Garder | Page stable, titre, description, miniature, date et contexte |
| `/app`, login, workspace | Non indexable | Ne pas compter sur `robots.txt` seul |
| Docs obsolètes et status statique | Mettre à jour ou `noindex` | Ne pas afficher de `lastmod` artificiellement récent |
| CSS/JS Next.js | Autoriser le crawl | Aucun blocage robots ni redirection de bundles |

### Taille cible de la surface

Une première coupe conservatrice peut conserver :

- 56 comparatifs anglais stratégiques ;
- 17 comparatifs français réellement enrichis ;
- 17 comparatifs espagnols réellement enrichis ;
- tous les gagnants GSC/backlinks/conversions supplémentaires, même hors de ce socle.

Sans les gagnants additionnels, cela ramènerait le sitemap d’environ **1 226 à 440 URL** et retirerait temporairement **786 comparatifs faibles**. Une variante moins agressive consiste à conserver les 56 paires stratégiques dans les trois langues, soit 168 détails et 708 retraits.

La décision finale ne doit jamais être prise uniquement à partir du code : avant chaque `noindex`, joindre les données GSC par URL, les backlinks et les conversions. Les pages qui génèrent déjà une valeur mesurable restent indexables et sont enrichies en priorité.

## 6. Ordre d’exécution

### P0 — arrêter les nouvelles fuites

1. Aligner IndexNow sur `publishedPairs` et le sitemap canonical.
2. Corriger les hubs localisés soumis.
3. Empêcher tout lien public vers les jobs privés, les paramètres de tri et les URL d’application générées.
4. Ajouter des tests de contrat sur les URL soumises, sitemapées et indexables.

### P0 — retirer les erreurs déjà indexées

1. Traiter immédiatement les deux URL `/app?...` indexées malgré robots.
2. Retirer la variante `/es/galeria?engine=hailuo` de tout maillage interne et consolider vers la galerie canonique si elle n’a pas d’intention propre.
3. Auditer les 53 pages `/video/` indexées contre les 44 pages éditoriales prévues.
4. Résoudre les 72 404 et convertir les redirections historiques 307 en 301/308.

### P1 — réduire la matrice sans perdre de trafic

1. Croiser les 876 comparatifs avec clics, impressions, position, liens et conversions.
2. Classer chaque URL en `keep`, `enrich`, `noindex` ou `redirect`.
3. Déployer par lots de 50–100 URL et surveiller les requêtes ainsi que les pages de destination pendant 28 jours.
4. Ne pas lancer une suppression globale en une seule fois.

### P1 — améliorer rendu et cache

1. Réduire les variantes d’images présentes au SSR.
2. Définir `images.minimumCacheTTL` et des `sizes` réalistes.
3. Rendre le shell marketing cacheable.
4. Corriger LCP/CLS mobile sur l’accueil, pricing, modèles et outils.

## 7. Tableau de bord mensuel à conserver

Suivre séparément :

- pages indexées présentes dans le sitemap ;
- pages indexées absentes du sitemap ;
- pages HTML explorées mais non indexées ;
- ressources CSS/image explorées mais non indexées ;
- comparatifs indexés par langue ;
- URL `/app`, `/login`, `/video/job_*` et paramètres découvertes ;
- URL IndexNow rejetées par le test de parité sitemap ;
- clics et conversions perdus/gagnés après chaque lot de consolidation.

Le KPI principal n’est pas « moins d’URL dans GSC ». C’est une proportion croissante de pages indexées qui possèdent une intention, une preuve unique et une contribution mesurable au trafic ou au revenu.
