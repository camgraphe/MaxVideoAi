# Pages modèles — lisibilité, SEO et GEO (D81)

Revue du 14 septembre 2026, sur `codex/site-redesign`, sans déploiement. Aperçu : [MiniMax H3](http://localhost:3008/models/minimax-h3), [GPT Image 2 FR](http://localhost:3008/fr/modeles/gpt-image-2), [LTX 2.5 Pro ES](http://localhost:3008/es/modelos/ltx-2-5-pro).

## Ce qui change

Le gabarit décision partagé conserve sa composition cinéma. À la demande d’Adrien, **la vidéo et son poster remplissent le cadre**, avec recadrage central : 2,15:1 sur desktop, 16:9 sur mobile. Le lien vers le rendu complet reste disponible. Les images seules gardent leur composition entière dans un cadre 16:9. Aucun changement de source, de préchargement, de qualité vidéo ou de politique de lecture.

Les conseils et comparaisons perdent leurs gros encadrements et leurs hauteurs minimales. Les comparaisons utilisent les marques du composant `EngineIcon`, et les destinations automatiques sont limitées aux paires publiées ; sinon le lien conduit à la fiche du modèle. La promesse générique selon laquelle chaque comparatif contient des rendus réels est retirée.

Les références complémentaires et les règles de sécurité se déplient. Les règles propres au modèle et leurs précisions sont maintenant effectivement rendues, au lieu d’être remplacées par quatre règles génériques. La FAQ est fermée au départ sur desktop comme sur mobile, avec ses réponses présentes dans le HTML serveur et son JSON-LD conservé. Aucun appel réseau n’est nécessaire pour ouvrir une réponse. Les fiches techniques sont plus compactes ; leur lien vers elles-mêmes est supprimé et les sections détaillées ne sont plus limitées arbitrairement aux deux premières.

Le sommaire mobile reste sur une ligne défilable. Le contrôle visuel a aussi révélé une erreur du précédent CSS : il attendait `.dark`, alors que l’application utilise `data-theme="dark"`. Correction appliquée au gabarit modèles, puis FAQ ouverte contrôlée dans les deux thèmes.

## Contenu repris

Neuf introductions réécrites en EN/FR/ES : MiniMax H3, H3 Max, Veo 3.1, GPT Image 2, Wan 3, Wan 3 Prime, LTX 2.5 Fast, Seedream 5.0 Pro et Nano Banana Lite. L’accroche devient courte ; le paragraphe définit le modèle, ses entrées et ses usages sans répéter toutes les caractéristiques.

Six ensembles de textes tarifaires repris dans les trois langues : Wan 3, Wan 3 Prime, LTX 2.5 Fast/Pro, Grok Imagine Video 1.5 et FLUX 3. Les mentions de « devis canoniques », de manifeste et de texte éditorial sans total deviennent des explications du prix selon les réglages. Les montants et leur calcul restent inchangés. La durée de l’audio source reste explicitée pour LTX.

Cela représente **12 modèles distincts, dans les trois langues**. La FAQ GPT Image 2 explique désormais les réglages avec des mots utilisateur plutôt que `image_size`, `num_images` ou `mask_url`. Sa vignette réelle étant une présentation du modèle, sa légende n’affirme plus qu’il s’agit d’un packshot généré. Les libellés génériques du Prompt Lab et plusieurs caractéristiques issues des données techniques sont traduits sans modifier les limites numériques. Les valeurs inconnues restent intactes plutôt que de leur attribuer une traduction approximative.

Ces modifications complètent D80 (introductions Seedance 2.5, Kling 3 Pro et LTX 2.5 Pro). Le bénéfice de présentation s’applique au gabarit partagé ; ce n’est pas une certification éditoriale exhaustive de toutes les fiches historiques ou des préannonces.

## Ce que GSC montre réellement

Consultation en lecture seule dans Chrome, propriété `sc-domain:maxvideoai.com`, recherche Web, trois mois du **13 juin au 12 septembre 2026**. Filtre de pages :

```text
^https://maxvideoai\.com/(models|fr/modeles|es/modelos)/[^/?]+/?$
```

Total affiché : **736 clics, 108 328 impressions, CTR 0,7 %, position moyenne 15,8**. GSC prévient que les tableaux filtrés peuvent être partiels ; les requêtes visibles sont limitées à 1 000 lignes. Ce n’est pas un inventaire exhaustif de la demande.

| Page (suffixe de l’URL) | Clics | Impressions |
| --- | ---: | ---: |
| `/models/veo-3-1` | 138 | 19 375 |
| `/models/sora-2` | 73 | 6 828 |
| `/models/gpt-image-2` | 54 | 4 112 |
| `/models/luma-ray-3-2` | 47 | 4 808 |
| `/models/minimax-h3` | 36 | 1 460 |
| `/models/seedance-2-5` | 36 | 1 191 |
| `/models/happy-horse-1-1` | 33 | 2 756 |
| `/models/sora-2-pro` | 30 | 5 556 |
| `/models/seedream` | 17 | 3 588 |
| `/models/ltx-2` | 15 | 9 989 |

Exemples de requêtes observées : `veo 3.1` (62 clics / 13 598 impressions), `seedance 2.5` (27 / 380), `gpt image 2` (24 / 527), `minimax h3` (10 / 212). Elles soutiennent une stratégie centrée sur **le nom précis du modèle**, ses usages, ses exemples et ses tarifs. Les anciennes générations reçoivent encore du trafic : ne pas les supprimer ni les rediriger en masse pour la seule raison qu’une version plus récente existe. Leur promotion peut évoluer sans casser leur URL.

## Ahrefs : utile, mais avec une limite

Le tableau de bord accessible confirme **DR 36**, 527 domaines référents, 446 visites organiques estimées et 41 mots-clés organiques dans sa couverture affichée. Les variations affichées portent sur 30 jours. Le rapport Top pages est accessible et contient aussi des pages historiques Sora/LTX et des pages localisées.

En revanche, Site Audit affiche **« Crawl failed — No crawl credits available »**. Aucun nouveau crawl, achat ou changement de configuration lancé. Ces chiffres ne constituent pas un audit technique récent. Le trafic estimé Ahrefs et les clics GSC n’ont ni la même mesure ni la même période : ne pas calculer un gain ou une perte en les soustrayant.

## Comparaison de la production avec la branche

Lecture HTTP de six pages représentatives, sur la production publique et sur le serveur local :

- MiniMax H3 EN ; Seedance 2.5 FR ; LTX 2.5 Pro ES ; Veo 3.1 EN ; GPT Image 2 FR ; Kling 3 Pro ES.
- **12 réponses HTTP 200.** Sur chaque paire : même H1 unique, même titre SEO, même meta description, même canonical de production, mêmes hreflang EN/FR/ES/x-default, `index, follow`.
- JSON-LD parsable : WebPage, Product, BreadcrumbList, Organization, WebSite et FAQPage lorsque la fiche possède une FAQ.
- Aucun lien vers une fiche modèle présent en production n’est perdu dans cet échantillon. Les différences de comparatifs promus viennent notamment du footer renouvelé en D79. Les différences de liens vidéo reflètent la copie publique locale, qui ne reproduit pas l’ordre des playlists de production.
- **49 chemins de comparaison distincts contrôlés : tous répondent 200** sur le serveur local.

Traces de revue locales : `docs/redesign/qa/model-seo-d81-http.json` et `model-seo-d81-link-check.json` (artefacts ignorés). Les tests de sitemap et de hreflang passent ; aucune politique de route ou de sitemap n’est modifiée.

## Gain attendu et risque

Le gain attendu est une meilleure compréhension et une navigation plus directe, pas une hausse de classement démontrée. Le modèle reste nommé dans le H1, les capacités précises sont consultables, les prix restent calculés et les réponses importantes sont dans le document. Les définitions plus directes facilitent aussi la lecture et la réutilisation correcte de l’information par des assistants.

Google ne demande ni balisage spécial « GEO » ni fichier dédié aux fonctionnalités IA : une page indexable, du contenu utile et accessible, des liens internes et des données structurées cohérentes restent les bases. Aucune promesse de citation dans un assistant ou de résultat enrichi FAQ n’est faite. [Documentation officielle Google](https://developers.google.com/search/docs/appearance/ai-features).

Les risques restants concernent surtout le chargement des médias et la justesse éditoriale fiche par fiche. Cette revue en développement ne mesure pas les Core Web Vitals d’un build production comparable. Le raccord local contient une sélection publique différente de la production. Avant publication, comparer les builds avec les mêmes sources, vérifier LCP/CLS/INP mobile et les liens vers les rendus réels ; ne pas déduire une amélioration de performance de la seule réduction visuelle des cartes.

Les prochaines revues éditoriales doivent prioriser Veo, GPT Image 2, Luma, MiniMax et Seedance d’après GSC, puis les pages historiques qui reçoivent encore des impressions. Vérifier les capacités selon chaque mode, les exemples exacts et les éventuelles phrases techniques restantes, sans réécrire les métadonnées en masse.

## Vérification de la passe

79 tests ciblés passent : contrats de contenu et d’architecture, SEO modèles, préannonces, sitemap, hreflang, exemples, Prompt Lab et nouveau contrôle du rendu serveur des disclosures. TypeScript, lint ciblé, contrôle d’exposition publique et `git diff --check` passent. Revue navigateur desktop/mobile à 390 px, MiniMax FR, LTX ES, GPT Image 2 FR, FAQ ouverte claire/sombre et vidéo panoramique. Aucun débordement horizontal observé sur les vues mobiles contrôlées.

Aucune publication, modification du catalogue de modèles, écriture en base ou opération de génération payante.
