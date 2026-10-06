# Lot utilité des pages — revue du 6 octobre 2026

Ce lot couvre six comparaisons et les galeries LTX/Seedance, dans les trois langues. Il corrige un défaut tarifaire observé sur le site public et rend les choix de versions et l’accès aux prompts plus directs. Il conserve la présentation éditoriale actuelle.

## Constats et décisions

| Surface | Constat vérifié | Changement |
| --- | --- | --- |
| Veo 3.1 Fast / Lite | Le site affiche « Data pending ». Le devis public de 5 s est indisponible ; 4 s est admis. | Scénario commun texte vers vidéo, 4 s, 16:9, audio activé ; résolution, prix par seconde et total par vidéo visibles. Résumé Lite pour le budget, Fast pour la 4K et les références multiples. FAQ alignée sur l’audio optionnel de Lite. |
| Gemini Omni Flash / Veo 3.1 | La référence de 5 s fonctionne pour Omni mais pas pour Veo. | Même scénario de 4 s des deux côtés. Résumé centré sur les références et l’édition Omni, les plans texte/image Veo. |
| LTX 2.3 / 2.5 Fast et Pro | Les versions exactes existent déjà, mais la décision est dans un accordéon. | Une réponse courte visible nomme le tier concerné. Retakes attribués à 2.3 Pro ; multi-plan et audio en entrée à 2.5. |
| LTX 2.3 Fast / Seedance 2.0 | La comparaison concerne un tier Fast précis. | Résumé visible distinguant texte/image LTX des références, édition et extension Seedance. |
| LTX / Wan | La page répond à une comparaison légitime. | Page conservée ; liens directs Fast/Pro vers les comparaisons LTX 2.3 / 2.5 dans l’ouverture, localisés sans détour. |
| Galeries LTX / Seedance | Vidéos, prompts complets, lecteur et copie existent déjà. | Deux extraits courts provenant des vidéos de la page courante, avec version exacte, durée, ratio et audio, après les quatre vidéos d’ouverture. Liens vers le lecteur existant. |

Les prix proviennent de `computeCurrentPublicSnapshot`, avec mode et réglages explicites. Les durées viennent des capacités du mode ; une durée commune à la paire est privilégiée. Une lecture impossible affiche « Prix actuel indisponible » avec une explication, sans substituer un tarif de catalogue. Aucun montant observé ci-dessous n’est une constante du produit.

Les encadrés utilisent le vrai prompt public, dans sa langue d’origine, y compris dans les galeries françaises/espagnoles. Ils ne reprennent pas la légende localisée comme s’il s’agissait d’un prompt. Les vidéos restent des exemples indépendants avec des réglages différents ; ce lot ne les transforme pas en benchmark contrôlé.

Les liens PAYG « How credits work » et les titres déjà déployés restent en place. Aucun changement à la homepage, au PAYG, à Studio, au MCP, aux tarifs commerciaux, aux sources média ou aux règles de publication des modèles. Aucune génération payante, diffusion externe, automatisation, fusion ou mise en production.

## Preuve tarifaire publique et locale

Observation du 6 octobre, endpoint public `/api/pricing/quote`, texte vers vidéo, 4 s, 720p, 16:9, audio activé :

| Modèle | Total observé | Prix par seconde dérivé |
| --- | ---: | ---: |
| Veo 3.1 Lite | 0,26 USD | 0,065 USD/s |
| Veo 3.1 Fast | 0,52 USD | 0,13 USD/s |
| Gemini Omni Flash | 0,54 USD | 0,135 USD/s |
| Veo 3.1 | 2,08 USD | 0,52 USD/s |

Les [réponses publiques datées](page-utility-review-2026-10-06/public-quotes.observed.json) couvrent aussi les résolutions supérieures. Le test PostgreSQL reproduit le défaut de 5 s avec une grille active, vérifie la parité du devis canonique à 4 s et l’absence de repli si une cellule manque. Les captures tarifaires « après » utilisent une base locale jetable alimentée par ces observations, pas la base de production. Les valeurs pourront changer avec les prochaines révisions tarifaires.

## Captures

Captures Chrome, viewport demandé 1440 × 1000 sur ordinateur et 390 × 844 sur mobile. Le « avant » ci-dessous est le site public actuel ; les « après » montrent le candidat local. Les captures de galeries et les premières captures tarifaires utilisent Next dev. La capture Veo mobile et Omni ordinateur utilisent le build local via `next start`, avec la même base tarifaire jetable. Aucun environnement de production distant n’est modifié.

| Vérification | Capture |
| --- | --- |
| Veo avant, site public | [Ordinateur](page-utility-review-2026-10-06/veo-public-before-desktop.jpg) |
| Veo après, devis local | [Ordinateur](page-utility-review-2026-10-06/veo-local-after-desktop.jpg), [mobile](page-utility-review-2026-10-06/veo-local-after-mobile.jpg) |
| Omni après, devis local | [Ordinateur](page-utility-review-2026-10-06/omni-local-after-desktop.jpg), [mobile FR](page-utility-review-2026-10-06/omni-local-after-mobile-fr.jpg) |
| Prompts LTX | [Ordinateur](page-utility-review-2026-10-06/ltx-local-prompts-desktop.jpg), [mobile FR](page-utility-review-2026-10-06/ltx-local-prompts-mobile-fr.jpg) |
| Prompts Seedance | [Ordinateur ES](page-utility-review-2026-10-06/seedance-local-prompts-desktop-es.jpg), [mobile ES](page-utility-review-2026-10-06/seedance-local-prompts-mobile-es.jpg) |
| Liens LTX Fast/Pro en contexte | [Mobile FR](page-utility-review-2026-10-06/ltx-wan-local-links-mobile-fr.jpg) |

Les galeries utilisent le snapshot public prévu par le dépôt, sans accès aux données privées. Le lecteur LTX 2.3 Pro et sa copie de prompt ont été ouverts et vérifiés sur mobile. Les captures de galeries n’attestent pas d’un devis actuel pour chaque ancien rendu.

## Validation et limites

- 125 tests ciblés de comparaisons, contenus, architecture, SEO, galeries et navigation passent sur le candidat qui inclut le `main` courant ; le test PostgreSQL canonique passe aussi dans une commande séparée.
- TypeScript passe. Lint : zéro erreur, quatre avertissements `<img>` préexistants dans Studio. Contrôle d’exposition et `git diff --check` passent.
- Les [24 routes localisées](page-utility-review-2026-10-06/localized-route-smoke.json) répondent 200 avec un seul H1, canonical exact, hreflang en/fr/es/x-default et JSON-LD parseable. Pagination, tri et redirection d’alias vérifiés. Titres, URL canoniques, périmètre des sitemaps et politique d’indexation conservés.
- HTML initial : 24 affiches, quatre cartes d’ouverture, une seule priorité haute, aucun `<video>` ajouté. Aucun débordement horizontal observé sur les surfaces contrôlées à 390 px. Les tests verrouillent l’ordre des extraits après l’ouverture.
- Build complet : succès, prébuild modèle/SEO/média inclus et 932 pages statiques générées. Avertissement Supabase Edge préexistant, en plus des quatre avertissements Studio.
- La revue indépendante a fait corriger l’attribution des retakes, les vrais extraits FR/ES et une initialisation coûteuse de la couverture tarifaire complète. Le chemin de lecture des prix garde le propriétaire canonique existant.

Mesures comparables locales sur `/examples/ltx`, même snapshot, Next dev sans base de données, Lighthouse 13.5.0 et navigation Chromium neuve :

| Profil | LCP avant / après | CLS avant / après | Transfert avant / après |
| --- | --- | --- | --- |
| Ordinateur | 671 / 715 ms | 0 / 0 | 3 910 362 / 3 913 856 octets |
| Mobile simulé | 21 064 / 3 466 ms | 0,000225 / 0,000225 | 3 832 130 / 3 793 479 octets |

Les [mesures datées](page-utility-review-2026-10-06/performance-summary.json) sont une paire de mesures en développement : compilation, cache et réseau expliquent une variance importante. Elles n’établissent aucun gain ni résultat Core Web Vitals en production. Les géométries d’ouverture sont identiques avant/après : 655,70 × 368,83 px pour la vidéo principale sur ordinateur ; 350 × 196,88 px sur mobile. Sources, tailles responsive et priorité des affiches restent inchangées. Safari/iOS réel et données terrain ne sont pas couverts.

## État de livraison et suivi

Le candidat est préparé sur `codex/seo-page-utility-20261006`, initialement à partir de `606cabe0e`, puis rebasé sans conflit sur `1eb575217` (menu des assistants). Les tests ciblés, PostgreSQL et le build complet ont été relancés après ce rebase. La PR et ses contrôles CI servent à la revue ; aucune publication n’est effectuée dans ce lot. Le sélecteur CI demande les trois lanes integration, tariffs et browser. Leur succès et l’inclusion du `main` courant restent nécessaires avant une éventuelle fusion.

Après une éventuelle publication : vérifier les pages publiques et les devis le jour même, puis le recrawl/indexation. Examiner les événements existants d’ouverture/recréation sur une fenêtre suffisante ; comparer GSC sur des fenêtres égales de 28 jours après recrawl, par URL et requêtes réellement associées. Garder une lecture distincte des modifications locales, de la PR, de la publication et de l’observation Google ; une variation de CTR/clics seule ne prouve pas l’effet de ce lot. Ce suivi est une proposition, pas une automatisation créée.
