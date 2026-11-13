# Revue Seedream avant production

**État au 13 novembre 2026 : branche locale `codex/seedream-55-flash`. Aucune publication GitHub, PR ou mise en production. Cinq images réelles ont été obtenues avec les autorisations de dépense distinctes ; leur bilan figure ci-dessous.**

## Ce qui est intégré

- Seedream 5.5 et Seedream 5.0 Flash, par BytePlus pour ByteDance, dans l’app image, MCP et Studio.
- Création et retouche d’images, une sortie par requête, dix images sources maximum, résolutions 1K, 1.5K et 2K. Le réglage par défaut est 2K.
- Fond transparent natif en PNG pour 5.5. Les fonctions de séparation en calques et d’OCR ne sont pas exposées.
- Devis communs, comptage des références, comptabilité fournisseur, affichage des prix et 39 cellules de tarifs pour les nouveaux modèles.
- Six nouvelles pages marketing EN/FR/ES, enrichissement des six fiches Lite/Pro existantes, liens entre versions et exemples de prompts.
- Cinq images réelles avec des personnes et des scènes cinématographiques : deux 5.5, deux Flash et une Pro. Titres visibles, prompts anglais exacts, originaux consultables et lien vers une génération vidéo distincte.

## Tarifs client proposés à valider

Montants en **USD par image**, avec les règles actuelles de marge et d’arrondi. Les prix existants de Lite et Pro sont conservés.

| Scénario | 1K | 1.5K | 2K par défaut |
| --- | ---: | ---: | ---: |
| 5.5 sans image source | 0,03 $ | 0,03 $ | 0,06 $ |
| 5.5 avec 1 image source | 0,04 $ | 0,04 $ | 0,06 $ |
| 5.5 avec 10 images sources | 0,13 $ | 0,13 $ | 0,16 $ |
| Flash avec 0 à 10 images sources | 0,03 $ | 0,03 $ | 0,03 $ |

Le nombre de sources comprend l’image principale de retouche. La grille complète pour 1 à 10 sources figure dans [le détail des tarifs](seedream-55-flash-pricing-2026-11-13.md).

**Arrondi à examiner :** pour 5.5 en 2K sans référence, BytePlus coûte 0,035 $. La marge de référence de 30 % est arrondie au cent supérieur, puis le total au cent le plus proche : le prix proposé devient 0,06 $. Les 39 prix sont ensuite enregistrés comme montants fixes.

Le [tarif officiel BytePlus](https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing.md) indique 0,020 $ ou 0,035 $ par sortie 5.5 selon la résolution, **plus 0,008 $ pour chaque source**, y compris la première. Flash coûte 0,018 $ par sortie et ses sources sont gratuites. Aucune remise fournisseur Lite/Pro n’est appliquée aux nouveaux modèles.

## Points à reviewer

- [ ] Valider les prix proposés et leur arrondi, notamment les 0,06 $ de 5.5 en 2K.
- [ ] Vérifier dans l’app, MCP et Studio la sélection des modèles, les réglages, les références et le devis avant confirmation.
- [ ] Relire les douze fiches marketing, leurs liens et les formulations françaises, anglaises et espagnoles ; examiner les cinq images ci-dessous.
- [x] Vérifier l’accès fournisseur : deux sorties réelles Flash et deux sorties 5.5 obtenues après activation de 5.5 par le propriétaire du compte.
- [ ] Vérifier le parcours complet des nouveaux modèles depuis l’app, MCP et Studio dans l’environnement de livraison autorisé. Les quatre rendus 5.5/Flash ont utilisé directement BytePlus, car leur intégration locale n’est pas publiée.
- [ ] Contrôler les performances de chargement sur la préversion autorisée, notamment Flash, avec des mesures comparables. Les poids d’images ci-dessous ne certifient pas les Core Web Vitals.
- [ ] Autoriser séparément la publication GitHub et la PR si la revue est satisfaisante. Exiger ensuite Quality CI et les contrôles de déploiement avant production.

## Images à examiner

Toutes sont des générations **texte vers image**, une sortie demandée en 2K, 16:9, JPEG. Elles ne constituent pas une démonstration de retouche ou de cohérence entre références. Les deux sorties 5.5 et les deux sorties Flash font 2816 × 1584 px ; la sortie Pro fait 2848 × 1600 px. Les dimensions retournées sont conservées telles quelles.

| Modèle | Scène et original | Points à regarder |
| --- | --- | --- |
| 5.5 | [MAKE YOUR MOVE — sortie de métro](../../frontend/public/assets/model-examples/seedream-5-5/2535f7148cd673f38f2aabd776127690bdcca5fee1631e701eb6b550bf5dca70.jpg) | Expression, manteau en mouvement, pluie, affiche lisible. |
| 5.5 | [Le dernier train — deux personnages](../../frontend/public/assets/model-examples/seedream-5-5/9c2ccca85c7306afc4bba3bbe4e1a80a58812188277592719b5e2327ef47e0ef.jpg) | Interaction, mains, regards, lumière et profondeur. |
| Flash | [KEEP GOING — skate en ville](../../frontend/public/assets/model-examples/seedream-5-0-flash/7db3122dfba32e5cd448ce56329a6d9e349ec7278d651a8023bd998f61676716.jpg) | Pose, planche, personnages secondaires, texte dans le décor. |
| Flash | [NEXT STOP ANYWHERE — danse en gare](../../frontend/public/assets/model-examples/seedream-5-0-flash/e4c0a1183a44b16c4589cf3683f933be7a612b2907234af528e18b68c07d7cc5.jpg) | Geste, anatomie, architecture, lumière et panneau. |
| Pro | [STAY CURIOUS — devant une boulangerie](../../frontend/public/assets/model-examples/seedream-5-0-pro/40dafa9179cd44de9d56a41d2b9b8b97cc1985163b7fb73777f16c8bbb1b61b8.jpg) | Expressions des deux adultes, peau, lumière mixte et enseigne. |

Le [manifeste des médias](../../frontend/config/seedream-editorial-images.json) contient les prompts exacts, réglages, dimensions, hashes et liens vers les copies d’affichage. Les originaux sont inchangés ; les copies WebP font 1600 px de large. Les réponses fournisseur et le reçu MCP restent dans le dossier privé local, sans identifiant de compte ni URL signée dans le contenu public. Pour Pro, le moteur et le résultat sont attestés par le reçu MCP ; aucun identifiant de modèle brut retourné par BytePlus n’est inventé.

## Dépenses de génération autorisées

| Opération | État | Montant retenu |
| --- | --- | ---: |
| Deux images 5.5 à 0,035 $ | Résultats récupérés ; estimation au tarif fournisseur public | 0,070 $ |
| Deux images Flash à 0,018 $ | Résultats récupérés ; estimation au tarif fournisseur public | 0,036 $ |
| Première tentative Pro directe | Connexion interrompue, sans résultat récupérable ; charge fournisseur inconnue | Réserve prudente de 0,090 $ |
| Une nouvelle génération Pro via MCP | Devis approuvé, résultat terminé et débit wallet vérifié | 0,160 $ |
| **Total prudent** | **Sous le plafond cumulé autorisé de 0,360 $** | **0,356 $** |

Ce total n’est pas une facture BytePlus rapprochée. Il additionne les estimations des quatre générations directes, la réserve de la tentative ambiguë et le débit wallet Pro effectivement constaté. Le coût fournisseur sous-jacent à ce dernier débit n’est pas ajouté une seconde fois. Le Pro facturé 0,16 $ correspond au devis live de cette demande ; ses tarifs client existants n’ont pas été modifiés par ce chantier. Aucune autre génération n’a été lancée.

## Ce qui a été repris des pages constructeur

Les pages [ByteDance Pro](https://seed.bytedance.com/en/seedream5_0_pro), [ByteDance 5.5](https://seed.bytedance.com/en/seedream5_5) et [BytePlus Seedream](https://ai.byteplus.com/en/product/Seedream), consultées le 13 novembre, mettent en scène des personnes, des matières, de la lumière et des démonstrations rattachées à un usage. L’amélioration locale suit cette direction : vrais résultats humains, légendes lisibles, corps de page moins répétitifs, conseils propres à chaque variante et continuation explicite vers l’image-vers-vidéo.

Les promesses de cohérence multi-shot et d’audio qui subsistaient dans les exemples Pro sont retirées. Les conseils et limites Pro ont maintenant leur propre texte FR/ES, sans repli anglais. Les capacités annoncées restent limitées à ce que l’intégration expose : aucune assimilation à une version « 5.5 Pro », aucun calque ni OCR, aucune promesse de classement ou de temps de génération mesuré.

L’audit coordonné « Moderniser les pages modèles » recommande ensuite une variante facultative du format commun sur deux pilotes. Cette refonte globale reste un chantier distinct. Une vraie preuve source → retouche pourra compléter ces galeries avec un budget séparé ; les images indépendantes actuelles ne sont pas présentées comme un avant/après.

## Référencement préservé

Les URL de Seedream et de Seedream 5.0 Pro restent en place dans les trois langues. Leurs titres, descriptions et CTA principaux sont conservés. Les 24 comparaisons de titre, canonical, hreflang et robots avec la production concordent. Les douze pages locales répondent en 200 avec leurs données structurées.

## Vérifications techniques

- Compilation, TypeScript, lint, registre et contrôles MCP : validés.
- Suite générale : **11 202 réussites, un test ignoré**.
- Suite Studio : **1 580 réussites, un test ignoré**.
- Intégrations HTTP Studio/MCP : **4 réussites**.
- Parité des prix app/MCP/Studio/marketing sur PostgreSQL 17 : validée.
- Revue indépendante : aucun point bloquant restant.
- Deux replays financiers exhaustifs validés, dont l’activation et le retour arrière sur 27 071 points de contrôle. Le code vérifié correspond au commit `52deb01a2`.

## Seconde revue marketing du 13 novembre

Périmètre : les douze fiches Seedream, les catalogues général et image, les tarifs et les pages publiques MCP et Studio, en anglais, français et espagnol. Cette revue concerne l’intégration Seedream ; elle ne constitue pas une relecture éditoriale de tous les articles et de tous les autres modèles du site.

Corrections supplémentaires effectuées :

- Les liens du tableau des tarifs ouvrent le modèle image choisi. Les tailles intermédiaires 1.5K et 3K ne disparaissent plus du résumé.
- Les cartes 5.5 et Flash affichent leur maximum 2K et une description propre à chaque modèle dans les trois langues.
- Les fiches détaillées présentent les trois options 1K / 1.5K / 2K. Les panneaux de conseils vides sont masqués et les badges ne se chevauchent plus sur mobile.
- Les libellés image des nouvelles pages FR/ES sont traduits. Une ancienne promesse d’audio sur Pro est remplacée par ses sorties JPEG/PNG 2K.
- Les statistiques acceptent les deux nouveaux identifiants publics, tout en conservant le filtrage des identifiants inconnus et des données privées.

Les 27 URL de ce périmètre répondent en 200 avec leurs canonical, hreflang et règles d’indexation attendus. Les prix visibles ont été contrôlés avec une base PostgreSQL 17 jetable : les exemples 2K et leurs offres JSON-LD concordent, à 0,06 $ pour 5.5 et 0,03 $ pour Flash. Sans source de prix disponible, le build compilé affiche la demande de devis et n’émet pas d’offre Product inventée. Le navigateur a aussi couvert les liens entre catalogue, fiches et tarifs, la copie d’un prompt et le rendu à 390 px. Les 24 champs SEO historiques restent identiques à la production.

Les correctifs passent **135 tests ciblés**, TypeScript, le lint et une nouvelle compilation complète, avec les **60 tests SEO** du prébuild. Les sept avertissements de lint existants restent présents. Les grandes suites et les replays financiers listés plus haut correspondent toujours au code `52deb01a2` et n’ont pas été rejoués pour ces correctifs marketing. Une seconde revue indépendante n’a trouvé aucun point bloquant.

Le contrôle global `seo:check` rencontre un faux positif existant sur l’origine `www` autorisée par une route de sécurité, hors pages marketing. Cette autorisation a été conservée. Les contrôles distincts des liens internes, de l’exposition publique et des origines de médias passent. Le mode développement signale aussi deux avertissements React existants sur les attributs de popover.

## Validation du passage avec les cinq images

- **56 tests ciblés réussis** : provenance et intégrité des médias, contenu localisé, SEO historique, galerie commune et contrats des exemples. Relectures indépendantes des quatre images directes, du résultat Pro et des derniers correctifs : aucun point bloquant identifié.
- **Nouvelle compilation complète réussie**, avec validation TypeScript, registre de 63 modèles, **60 tests SEO** de prébuild et contrôles des médias publics/home. Le contrôle des projections de lancement passe également. Le lint et le contrôle d’exposition publique passent ; les sept avertissements de lint préexistants restent présents.
- **12 routes Seedream répondent en 200**, avec canonical, quatre alternates de langue, données structurées valides et absence de noindex. Les 24 champs historiques Lite/Pro restent identiques au relevé de production effectué lors du premier passage ; titres SEO, descriptions, H1 et CTA principaux sont aussi couverts par le test de référence.
- **Navigateur** : galeries françaises sur ordinateur ; 5.5, Flash et Pro espagnol à 390 px sans débordement horizontal. Originaux, copie du prompt, fermeture, Échap et retour du focus contrôlés. Les JPEG originaux ne sont pas montés avant l’ouverture du lecteur. Le décalage de l’ancre des exemples a été corrigé : titre à 140 px, sous la navigation fixe qui termine à 126 px.
- Les serveurs de test ont été arrêtés et la base PostgreSQL 17 jetable nettoyée. Aucune base de production n’a été modifiée.

### Poids des images avant et après

Mesure des réponses WebP du **même optimiseur Next local**, qualité 80, aux largeurs observées de 640 px et 1920 px. Les anciens et nouveaux fichiers ont été servis dans le même environnement. Ko décimaux, arrondis à une décimale.

| Hero | Mobile 640 px, avant → après | Ordinateur 1920 px, avant → après |
| --- | ---: | ---: |
| 5.5 | 10,4 → 23,4 ko | 49,7 → 66,8 ko |
| Flash | 10,4 → 40,2 ko | 49,7 → 159,4 ko |
| Pro | 69,9 → 19,3 ko | 389,5 → 54,3 ko |

Les scènes 5.5/Flash remplacent l’illustration générique commune et contiennent davantage de détails. Flash augmente le plus le transfert. Le nouveau visuel Pro est nettement plus léger que son précédent hero. La géométrie, la priorité du seul hero et le chargement différé des galeries sont conservés ; les JPEG originaux restent réservés à la consultation volontaire.

Ces mesures documentent le volume transféré, **pas le LCP, l’INP ou le CLS en production**. Les temps du serveur de développement et de son cache ne sont pas une comparaison de vitesse fiable. Une mesure comparable sur la préversion de livraison reste à faire avant production ; aucune amélioration de classement Google ni de Core Web Vitals n’est revendiquée. Les grandes suites et les replays financiers historiques n’ont pas été relancés pour ce passage éditorial et média.
