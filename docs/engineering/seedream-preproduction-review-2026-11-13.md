# Revue Seedream avant production

**État au 13 novembre 2026 : branche locale `codex/seedream-55-flash`. Aucune publication, PR, mise en production ou génération payante.**

## Ce qui est intégré

- Seedream 5.5 et Seedream 5.0 Flash, par BytePlus pour ByteDance, dans l’app image, MCP et Studio.
- Création et retouche d’images, une sortie par requête, dix images sources maximum, résolutions 1K, 1.5K et 2K. Le réglage par défaut est 2K.
- Fond transparent natif en PNG pour 5.5. Les fonctions de séparation en calques et d’OCR ne sont pas exposées.
- Devis communs, comptage des références, comptabilité fournisseur, affichage des prix et 39 cellules de tarifs pour les nouveaux modèles.
- Six pages marketing EN/FR/ES, liens entre versions, exemples de prompts et illustrations clairement identifiées.

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
- [ ] Relire les six pages marketing, leurs liens et les formulations françaises, anglaises et espagnoles.
- [ ] Vérifier l’activation des deux modèles sur le compte BytePlus, puis un rendu réel par modèle après approbation de son devis.
- [ ] Autoriser séparément la publication GitHub et la PR si la revue est satisfaisante. Exiger ensuite Quality CI et les contrôles de déploiement avant production.

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
