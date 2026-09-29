# Revue des six générations pour les galeries

Lot approuvé le 29 septembre 2026 : six générations uniques en 1080p, **13,37 $ au total**. Les six tâches MaxVideoAI sont terminées et enregistrées dans la bibliothèque du compte connecté. Les dimensions et durées ci-dessous proviennent des propriétés des vidéos dans le lecteur du navigateur ; l'évaluation narrative provient d'une lecture visuelle de leurs images de début, milieu et fin. Aucun média n'a encore été publié comme exemple, ajouté à une playlist ou transmis à Studio RS pour programmation.

| Scène | Modèle | Format mesuré | Durée mesurée | Revue | Décision |
| --- | --- | --- | --- | --- | --- |
| [Le nuage du fleuriste](https://maxvideoai.com/app?job=9722a844-c14a-4420-80d8-b9d300ed4298) | Happy Horse 1.1 | 1080 × 1920 | 10,12 s | Nuage et tournesol nets, scène lisible en portrait ; nuage plus large et transformation de la fleur moins marquée que demandé. | **Candidat** pour le héros Happy Horse 9:16 ; revoir la lecture intégrale avant publication. |
| [La boîte aux lettres boréale](https://maxvideoai.com/app?job=c5260c45-fe93-4527-b838-05a391240b29) | Grok Imagine Video 1.5 | 1088 × 1920 | 6,04 s | Le vélo, la boîte et la lumière verte/violette restent clairement dans le cadre. | **Candidat fort** pour le héros Grok 9:16. |
| [Le film qui déborde](https://maxvideoai.com/app?job=cf38a49a-e3fe-4f41-981c-cea5f8408d61) | Grok Imagine Video 1.5 | 1920 × 1088 | 6,04 s | L'image de vague et son débordement dans l'herbe sont visibles ; le cadre de cinéma est moins explicite que dans le prompt. | **Candidat** pour la troisième place horizontale Grok ; évaluer sa vignette au format carte. |
| [La baleine de l'atlas](https://maxvideoai.com/app?job=e0bafcbd-d30a-44de-81f2-bfe3fad61498) | FLUX 3 | 1088 × 1920 | 8,04 s | Baleine en relief bien centrée au-dessus de son dessin sur l'atlas ; idée compréhensible sans texte. | **Candidat fort** pour le héros FLUX 9:16. |
| [La couture du ciel](https://maxvideoai.com/app?job=928c02a2-2cd0-489b-a3de-8dbf85c16c8b) | LTX 2.5 Pro | 1080 × 1920 | 8,04 s | Couture réaliste, mais l'effet de constellation demandé n'apparaît pas. | **Ne pas substituer** aux verticales LTX 2.3 existantes. Conserver en bibliothèque ; aucun nouvel essai sans devis et accord. |
| [Le microsillon de course](https://maxvideoai.com/app?job=f53be709-8572-49fa-b04a-b03e66d42f51) | Happy Horse 1.1 | 1920 × 1080 | 10,12 s | Voiture miniature et tourne-disque immédiatement identifiables ; déplacement visible, saut moins net que demandé. | **Candidat** pour une place horizontale Happy Horse 1.1. |

Les sorties 1088 × 1920 et 1920 × 1088 sont des variantes encodées proches du ratio demandé ; elles doivent suivre la même tolérance sur dimensions **mesurées** que les exemples FLUX déjà audités. Ne pas les classer uniquement d'après le réglage envoyé au modèle.

## Prévisualisation isolée de la sélection

Une copie locale et ignorée des exemples publics permet de revoir l'ordre proposé sur `http://127.0.0.1:3212/examples`, sans écrire dans la base ni modifier les galeries en production. Elle ajoute les cinq candidats retenus et conserve **La couture du ciel** hors de la galerie. L'ordre des quatre premières cartes est :

| Galerie | Paysage principal | Portrait | Deux paysages secondaires |
| --- | --- | --- | --- |
| Happy Horse | `f53be709-8572-49fa-b04a-b03e66d42f51` | `9722a844-c14a-4420-80d8-b9d300ed4298` | `job_e8b067d4-377c-4c08-a653-202bbed60c43`, `job_e3d56938-07ef-42df-ac1b-d4cdbbca2e84` |
| Grok | `cf38a49a-e3fe-4f41-981c-cea5f8408d61` | `c5260c45-fe93-4527-b838-05a391240b29` | `2b74b648-63f2-4b19-b555-9dad0554ed40`, `4467d48a-8d6a-490c-96ba-09468aea313e` |
| FLUX | `b7014d70-b6a7-4e64-b41f-36f836756f76` | `e0bafcbd-d30a-44de-81f2-bfe3fad61498` | `34605e6e-0a3a-4b23-ac71-9985b486bd01`, `08ac14de-f53b-46c7-b6db-ae56c0095d7a` |
| LTX | `a30e1f55-27ca-4cd5-9c6b-1cb990a5ca91` | `job_cfcdb24a-b404-47b1-8e43-1eb45ee4daf9` (existant, LTX 2.3) | `5d47efd3-c75c-42c0-91fc-e0e1d8b50357`, `7b52c7eb-24fa-45a8-baa9-c675b7f50174` |

Le placement suit le rendu réel : le composant de galerie extrait d'abord un paysage puis un portrait, indépendamment de l'ordre brut de la liste. Contrôle local effectué sur ordinateur et à 390 px de large ; les posters chargent et le lecteur de Grok montre la durée entière, le format `16:9`, le coût historique de 1,95 $ et trois scénarios tarifés. Les deux premières pages LTX (20 cartes chacune), la troisième (1 carte) et les trois premières pages générales (20 cartes chacune) n'ont aucun doublon. La watch page locale est `noindex, follow` et possède l'URL canonique vidéo.

Avant une publication, il reste à valider chaque vidéo en lecture intégrale, à attribuer un titre éditorial court dans Video SEO, puis à publier et ordonner les entrées dans l'atelier admin. Le titre automatique du lecteur local n'est pas encore un titre éditorial publiable. Cette prévisualisation ne remplace pas les écritures de publication et de playlist.

## Mise en galerie à faire dans l'atelier

1. Relire chaque candidat en entier avec son son, choisir sa vignette et vérifier le coût et les réglages enregistrés. Les contrôles visuels ci-dessus ne certifient pas le montage, l'audio ni les droits de publication sociale.
2. Rendre publics seulement les exemples retenus avec leur modèle exact ; garder la fiche vidéo et l'URL de watch page cohérentes avec la galerie.
3. Placer les quatre nouveaux candidats requis dans les ouvertures Happy Horse, Grok et FLUX ; éventuellement utiliser le second Happy Horse horizontal. Pour LTX, choisir une verticale 2.3 existante.
4. Contrôler l'absence de doublon dans les pages suivantes, les formats sur mobile et le lecteur de chaque fiche. La production n'a pas été modifiée par ce lot.
5. Faire confirmer par Studio RS l'absence de brouillon privé similaire avant toute programmation sociale. Les scènes déjà publiées ou montées ne sont pas reprises ici.
