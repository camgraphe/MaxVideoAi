# Character Studio — audit SEO, marketing et médias avant production

Audit du **6 novembre 2026, Europe/Madrid**, en lecture seule, sur `codex/character-studio-v2`, commit **`c1bc6d0623ab34ad1868b6a71718b0d04adecf30`**. Contrôles HTTP actualisés autour de **00:49–00:57 CET** ; aucune publication, migration, génération, modification produit ou écriture en production.

Preview exacte : <https://maxvideoai-etzqid8op-camgraphes-projects.vercel.app>. L’API Vercel a confirmé `dpl_FQunBhAQ3FpNSEumY2mpCEVbHch3`, `READY`, source Git, SHA exact, environnement personnalisé `character-studio-test`, `target: null`. L’alias stable ne sert pas de preuve immuable. Le bypass autorisé existant a été utilisé uniquement en mémoire, sans impression ni conservation de sa valeur. Les requêtes aux médias publics n’ont reçu aucun bypass.

## Verdict et conditions de sortie

**Aucune régression bloquante d’URL, de canonical, d’hreflang, de sitemap ou de JSON-LD n’a été reproduite dans le périmètre vérifié.** Les 21 pages publiques ciblées répondent 200. Les 76 tests ciblés exécutés passent, ainsi que les gardes SEO et de renditions publiques.

La preview démontre un parcours marketing cohérent. Elle ne démontre pas la disponibilité des films dans le catalogue de production. La livraison modifie aussi les snippets des blogs : il serait incorrect de la résumer comme une conservation de toutes les métadonnées.

| Priorité | Constat et conséquence | Action de sortie | Confiance |
| --- | --- | --- | --- |
| Prérequis bloquant **pour livrer les deux films en production à parité avec la preview** | Le lecteur filtre deux identités précises issues de la preview ; l’outil de publication existant travaille dans sa propre base. Le code seul ne transporte ni catalogue, ni playlist, ni objets médias entre environnements. | Qualifier un chemin explicite et borné de publication des seules copies marketing retenues, leur identité de catalogue et leur adhésion directe à `character-studio-recast`, puis vérifier les lecteurs de production. À défaut, annoncer une livraison avec images de secours et absence de films dans Explorer. Ne pas copier la base, les jobs clients ou le portefeuille test. | Élevée sur le couplage source et le défaut de preuve ; **absence des lignes production non vérifiée par cet audit**. |
| Suivi SEO nécessaire | Les trois titres des guides de fiche et les six descriptions des blogs ont changé. Le guide de cohérence EN appartient au suivi `SEO-EXP-002` mentionné par Outreach. | Consigner le SHA et la date réelle d’exposition comme changement de contenu/snippets/maillage, préserver l’historique expérimental, puis mesurer le recrawl et des fenêtres comparables. | Élevée, diff source et HTML actuels. |
| Validation média avant exposition | Les contrats de chargement et les accès HTTP passent ; cet audit n’a pas effectué de nouvelle mesure comparative de LCP/CLS/INP ni de lecture navigateur. | Rattacher à la revue principale les vérifications navigateur ordinateur/mobile, premier Play, seeking/audio et mesures comparables requises par le guide média. Aucun gain de performance n’est établi ici. | Élevée sur la limite de preuve. |

## HTTP actuel : routes, langues et indexation

Les 15 routes suivantes ont été relues sur la preview exacte, en plus des six blogs. Chaque page possède un seul H1, un seul canonical, un `html[lang]` conforme et une famille réciproque `en`, `fr`, `es`, `x-default`. Le canonical et les alternates emploient l’origine exacte de preview, selon `frontend/lib/siteOrigin.ts`. En production Vercel, ce helper impose `https://maxvideoai.com`.

| Surface | EN | FR | ES | HTTP / films Recast |
| --- | --- | --- | --- | --- |
| Accueil | `/` | `/fr` | `/es` | 200 / 2 par page |
| Tools | `/tools` | `/fr/outils` | `/es/herramientas` | 200 / aucun lecteur attendu |
| Character Studio | `/tools/character-builder` | `/fr/outils/character-builder` | `/es/herramientas/character-builder` | 200 / 2 par page |
| Examples | `/examples` | `/fr/galerie` | `/es/galeria` | 200 / 2 par page |
| Pricing | `/pricing` | `/fr/tarifs` | `/es/precios` | 200 / aucun lecteur attendu |

Les 21 réponses publiques de preview portent **`X-Robots-Tag: noindex, nofollow`**, sans balise meta robots additionnelle observée : protection attendue d’une preview, pas un défaut à supprimer. L’entrée `/app/tools/character-builder` répond 200 avec **`X-Robots-Tag: noindex, follow`**, conforme à la séparation public/application. L’audit ne certifie pas une indexation Google ni l’état futur des en-têtes de production.

Les redirections historiques ont été vérifiées sans les suivre automatiquement :

- `/fr/tools/character-builder` → **307** vers `/fr/outils/character-builder`.
- `/es/tools/character-builder` → **307** vers `/es/herramientas/character-builder`.
- `/tools/character-studio` et `/tools/recast` → **404** : aucune nouvelle landing concurrente n’est introduite.

`/sitemap.xml`, `/sitemap-en.xml`, `/sitemap-fr.xml` et `/sitemap-es.xml` répondent 200. Les trois sitemaps locaux contiennent respectivement **405 / 318 / 344 URL**, les cinq pages de surface de leur langue et les deux blogs concernés. Les six blogs ont `lastmod=2026-11-05`. Les URL `loc` sont toutes à l’origine de preview. La racine est sérialisée sans slash final dans le XML et avec slash dans le canonical HTML ; après normalisation URL, c’est la même identité. Une première assertion de chaîne brute a été corrigée dans le contrôle en mémoire, sans changement produit.

`robots.txt` répond 200, conserve le blocage de `/app` et des surfaces privées et référence les sitemaps de production. Ce comportement préexistant est distinct du `noindex` de la preview. Aucun changement des propriétaires robots/sitemap n’est présent dans le lot Character Studio inspecté.

## Métadonnées, contenu et données structurées

Les titres et descriptions HTML des **trois landings et trois hubs Tools** correspondent exactement au relevé préalable du 5 novembre conservé dans `docs/redesign/2026-11-05-character-studio-marketing/seo-before.json`. Le nom visible et les schémas de service présentent désormais Character Studio, tandis que les H1 et les snippets gardent l’intention « personnages cohérents / références réutilisables ». C’est une continuité d’intention, pas une nouvelle URL à faire indexer.

La lecture du diff contre le `origin/main` local (`f868a026bd56fc2bd75d355512e3f03417ec0853`) confirme ces changements réels dans les blogs :

| Groupe | Titres | Descriptions | Identité et dates |
| --- | --- | --- | --- |
| Fiche personnage EN/FR/ES | 3 modifiés, de la construction d’une référence 8 panneaux vers le passage référence/design → vidéo | 3 modifiées, Character Studio, quatre angles/huit panneaux, looks et Recast | Slugs/canonical/canonicalSlug conservés ; publication `2026-03-20` ; modification `2026-11-05` |
| Cohérence personnage EN/FR/ES | 3 conservés | 3 modifiées, identité sauvegardée, looks et Recast | Slugs/canonical/canonicalSlug conservés ; publication `2026-03-22` ; modification `2026-11-05` |

Exemple EN fiche : `AI Character Sheet Generator: How to Build an 8-Panel Character Reference` devient `AI Character Sheet Generator: From Reference to Video`. Le guide conserve les critères d’une fiche utile, les quatre angles, l’option huit panneaux, le choix portrait/fiche et les limites de réutilisation ; l’ajout vidéo ne supprime donc pas son intention initiale. Cette évolution reste un risque de changement de snippet et de pertinence à suivre, notamment sur la fiche ES déjà cliquée, sans préjuger de son effet.

Les six routes relues et validées par le script courant :

- `/blog/ai-character-sheet-generator`
- `/fr/blog/generateur-de-fiche-personnage-ia`
- `/es/blog/generador-de-fichas-de-personaje-con-ia`
- `/blog/how-to-create-consistent-ai-characters`
- `/fr/blog/comment-creer-des-personnages-ia-coherents-dans-les-images-et-la-video`
- `/es/blog/como-crear-personajes-de-ia-coherentes-en-imagenes-y-video`

Pour chacune : titre/H1 et description concordent avec le contenu commité ; description sociale Open Graph/Twitter cohérente avec le normaliseur actuel ; `Article` et `BreadcrumbList` rendus côté serveur et JSON valides ; `headline`, `mainEntityOfPage`, dates d’origine et de mise à jour conformes ; un bloc de preuve, deux films publics, images de parcours avec alt attendus, lien vers le guide associé dans la bonne langue, lien de création et lien Recast présents.

Sur les landings, les types `Service`, `HowTo`, `FAQPage` et `BreadcrumbList` subsistent ; les étapes et réponses sont alimentées par le même contenu que les éléments visibles. Les `Organization` et `WebSite` communs sont présents. Home conserve ses types `WebApplication`, `FAQPage`, `ItemList`. Pricing conserve `Service`, `FAQPage`, fil d’Ariane. Aucun prix ou avis fictif ajouté n’a été constaté dans ce périmètre.

Les URL absolues des schémas de landing restent historiquement ancrées sur la production, tandis que la balise canonical de preview utilise la preview. C’est un écart d’environnement existant dans `CharacterBuilderLandingView.tsx`, pas une nouvelle migration de canonical ; ces identités convergent en production.

Le maintien d’un `FAQPage` décrit les réponses visibles, sans promesse de résultat enrichi : Google a retiré les résultats FAQ depuis le 7 mai 2026 ([changelog officiel, relu pendant cet audit](https://developers.google.com/search/updates)). Les vidéos illustrant un outil ou un article ne transforment pas ces pages en pages de lecture dédiées ([documentation vidéo Google](https://developers.google.com/search/docs/appearance/video)). Aucun schéma spécial ou fichier `llms.txt` n’est requis pour apparaître dans les fonctions IA de Google ([documentation officielle](https://developers.google.com/search/docs/appearance/ai-features)).

## Maillage, noms et vérité produit

Les headers, footers, cartes Home/Tools et tables Pricing inspectés utilisent Character Studio. Après exclusion des scripts/styles du texte HTML, la seule occurrence de **Character Builder** sur les 15 pages ciblées est la FAQ de transition des trois landings (« précédemment / anciennement / antes »), ce qui est intentionnel. Les slugs, noms internes et identifiants analytics `character_builder` restent stables et ne constituent pas un ancien nom public à remplacer.

Les liens publics pointent vers la landing locale conservée. Home pointe vers les exemples locaux avec `#character-studio` ; les CTA applicatifs conservent `/app/tools/character-builder` et `?mode=recast`. Les deux guides se relient entre eux et à la landing. Les anciens détours FR/ES sont corrigés dans les contenus touchés, avec leurs 307 conservées.

L’ajout Examples se trouve **après la galerie SSR et la pagination**, seulement en première page non filtrée au tri playlist. Les URL vidéo déjà présentes dans la galerie sont exclues du bloc additionnel. Les propriétaires de l’ouverture à quatre vidéos et de la priorité du premier poster restent inchangés.

La présentation distingue identité, nouveau look, fiche et Recast, explique que les résultats peuvent varier et demande une vérification des détails/personnages/produits. Aucun résultat parfaitement identique, substitution garantie ou gain financier non vérifié n’est promis dans les textes examinés. Le nom Nano Banana 2.1 des guides correspond au propriétaire image actuel ; les références génériques Nano Banana restantes dans la FAQ décrivent un usage externe de préparation d’image.

La table Recast relue dans les trois langues affiche les scénarios actuels :

| Scénario affiché | 720p | 1080p |
| --- | ---: | ---: |
| 6 s générées, sans vidéo source | 1,68 USD | 3,36 USD |
| 15 s générées + 15 s de passage source | 8,40 USD | 16,80 USD |

Les libellés précisent les secondes d’entrée/sortie et renvoient au devis exact. `current-other-pricing.ts` appelle `readRecastPublicPrice` et les tests de page vérifient le même propriétaire tarifaire, y compris l’indisponibilité. Ces montants sont ceux de la preview observée, pas une certification du tarif de production. **L’ancien script `phase2-discovery-http.cjs` interdit 8,40 USD : cette assertion est périmée face au tarif scoped actuel**, où cette somme correspond légitimement à un scénario 15 + 15 s. Il ne faut pas utiliser cette ancienne assertion comme preuve d’une régression de prix.

## Médias et frontière entre bases

Les deux vidéos actuellement servies proviennent du bucket isolé **`maxvideoai-character-studio-test-20261104.s3.amazonaws.com`**, sous `/marketing-media/`. Elles sont disponibles anonymement : HEAD **200**, `video/mp4`, tailles **17 803 414** et **34 131 085 octets** ; Range du premier et du dernier octet **206**, avec un octet réellement reçu à chaque fois. Les contrôles de début de fichier vérifient aussi `Content-Range`. Elles ne portent pas de grant, signature, token ou référence de job personnel dans leur URL publique. Ces tailles justifient de conserver la lecture manuelle sans préchargement ; elles ne mesurent pas le transfert initial du navigateur.

Sur Home, landing, Examples et blogs, les deux lecteurs de chaque page ont `controls`, `preload="none"`, sans `autoplay` ni `muted`. Home et les blogs utilisent une frontière de streaming pour la preuve facultative ; le catalogue est borné à 1,5 seconde et les images de secours sont honnêtement étiquetées. Les nouveaux portraits sont des fichiers statiques distincts ; les références originales ne sont pas remplacées par leurs dérivés. La source de landing garde un seul `Image priority`, les autres visuels différés et la planche entière sans recadrage. Les tests confirment ces contrats ; ce n’est pas une observation de priorité réseau effective. Les posters des deux lecteurs sont différés dans le HTML initial vérifié.

**Le point de promotion à résoudre est précis :**

1. `frontend/server/character-studio/marketing-demos.ts:7` n’admet que les ID `5833eee1-6c61-451c-a455-a5b08716cffc` (Dixie) et `b95c603e-2339-440e-b50e-7b7b2757da3c` (Vesper), retournés par la playlist directe `character-studio-recast` dans la base active.
2. Le README marketing établit que ces copies ont été publiées dans la **base de test uniquement**. Le présent HTTP confirme leur stockage test ; il ne lit pas la base de production.
3. `frontend/server/marketing-media/store.ts:41` lit la source dans `app_jobs` de la base courante. `copy.ts:40` échoue si cette source n’y existe pas. La publication conserve le `video_id` d’origine et crée un autre UUID pour le namespace de copie ; elle n’est pas un outil de transfert entre bases.
4. Les guides interdisent de recopier la base ou d’ensemencer les lignes publiques de production depuis celle de test. Aucun chemin de promotion inter-environnements qualifié n’a été trouvé dans les fichiers concernés inspectés.
5. Si ces deux identités et leur publication ne sont pas établies dans la base de production, le déploiement ne peut pas les afficher automatiquement : Home/landing/blogs rendent leurs images de secours ; le bloc Examples/Explorer sans `showStills` disparaît. C’est un repli sûr, mais pas une livraison des films annoncés à parité avec la preview.

La correction ne consiste pas à ajouter une URL privée ou le bucket test en fallback dans le client. Il faut une décision de publication limitée aux médias marketing retenus, la conservation de la provenance et des droits vérifiés, des objets indépendants dans le stockage cible, des identités de catalogue/playlist autorisées puis une qualification HTTP et navigateur dans cet environnement. Cet audit ne l’exécute pas.

## Données GSC / Outreach : portée exacte

Source relue : `/Users/adrienmillot/Documents/ChatGPT/OUTREACH/sources/2026-11-05/character-studio-marketing-seo/README.md` et son relevé public référencé, complétés par le baseline versionné dans le dépôt. Il s’agit d’une **synthèse du 5 novembre**, fondée notamment sur l’export GSC du **1er novembre**, propriété `sc-domain:maxvideoai.com`, recherche **Web**, tous pays/appareils, lignes d’URL exactes, périodes **05/09–02/10 → 03–30/10/2026**. Ce n’est pas une extraction GSC en direct du 6 novembre ; le fuseau du rapport et la finalisation de chaque journée ne sont pas certifiés par les CSV.

| Page | Clics avant → après | Impressions avant → après |
| --- | ---: | ---: |
| Outil EN | 1 → 5 | 84 → 210 |
| Guide cohérence EN | 0 → 1 | 217 → 1 682 |
| Guide fiche ES | 16 → 12 | 528 → 644 |

Ces lignes motivent la préservation des URL et de la fonction éditoriale des guides, spécialement ES. Elles ne démontrent ni gain durable, ni transfert outil/guide, ni cannibalisation, ni demande absente pour Recast/AI influencer. Les fenêtres 7/28/92 jours se chevauchent et ne s’additionnent pas. Les anciennes captures SERP ne donnent pas un classement actuel.

Avant exposition, conserver le dernier baseline finalisé disponible. Après exposition, dater séparément SHA livré, HTML servi et recrawl Google ; vérifier l’accès et le maillage à J+7 puis comparer 28 jours complets à périmètre identique. La refonte effective des six blogs doit être enregistrée dans l’historique, particulièrement le guide EN `SEO-EXP-002`, sans remettre son expérience à zéro par présomption. Aucun registre Outreach n’a été modifié.

## Vérifications exécutées et limites

- **59/59 tests** : `character-studio-blog`, `character-studio-blog-proof`, `character-studio-marketing`, `home-character-studio`, `blog-post-route-architecture`, `blog-language-switch`, `examples-pagination-seo`, `hreflang-variants`, `sitemap-preview-index`, `marketing-seo-utility`, `home-seo-signals`, `marketing-critical-image-delivery` via `pnpm exec tsx --tsconfig frontend/tsconfig.json --test …`.
- **17/17 tests supplémentaires** : `recast-pricing-page`, `pricing-marketing-mode`, `character-studio-recast-commercial-pricing`, `examples-lcp-performance`, `blog-prose-styles`.
- `pnpm --prefix frontend run seo:check` : **PASS** (`seo-guard`, `llms-guard`, `internal-link-guard`, `public-media-origin-guard`, 2 559 fichiers examinés par ce dernier).
- `pnpm --prefix frontend run media:public-renditions:check` : **PASS**, couverture des cinq héros existants. Ce résultat ne constitue pas une qualification de lecture des nouveaux clips Character Studio.
- `blog-seo-http-qa.cjs --origin https://maxvideoai-etzqid8op-camgraphes-projects.vercel.app --deployment dpl_FQunBhAQ3FpNSEumY2mpCEVbHch3 --sha c1bc6d0623ab34ad1868b6a71718b0d04adecf30 --require-films` : **PASS**, six pages et deux médias Range anonymes.
- Contrôles HTTP Node/JSDOM en mémoire : **PASS** pour les 15 autres pages, leurs métadonnées et lecteurs, les trois sitemaps, les redirections et la séparation d’indexation app/preview. Scripts phase2 utilisés comme référence de périmètre, pas exécutés tels quels contre leur ancien déploiement.

Pas de nouveau navigateur piloté dans ce sous-audit, pas de Rich Results Test externe, pas de Search Console en direct, pas de mesure de classement ou de Core Web Vitals, pas d’écriture production ni de certification de sa base. La revue visuelle et l’alignement de livraison restent des preuves séparées dans l’audit principal.
