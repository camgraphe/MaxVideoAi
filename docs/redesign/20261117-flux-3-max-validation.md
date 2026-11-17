# FLUX 3 Max — validation de la fiche avant publication

Revue du 17 novembre 2026. La maquette peut être validée sur le contenu, le maillage et les trois modes de création démontrés. Pour cette migration, conserver la fiche actuelle en production jusqu’à la validation du mode à images clés minutées. C’est la seule démonstration technique de l’ancienne page qui manque à la candidate et un motif de choix du modèle.

## Le résultat Google à protéger

L’URL anglaise totalise 164 clics et 7 311 impressions dans l’export Web du 15 août au 14 novembre. La requête exacte « flux 3 max » représente 117 clics et 5 426 impressions, soit 71 % des clics et 74 % des impressions de la page. Les exports sont filtrés sur l’URL canonique anglaise, tous pays et appareils confondus. [Relevé des deux modèles et filtres GSC](./20261116-seedance-flux-outreach-audit.md)

| Mesure GSC | 1–7 novembre | 8–14 novembre |
| --- | ---: | ---: |
| Impressions de la page | 3 204 | 1 196 |
| Clics de la page | 44 | 14 |
| Impressions pour « flux 3 max » | 2 521 | 849 |
| Clics pour cette requête | 27 | 11 |
| CTR pour cette requête | 1,07 % | 1,30 % |
| Position moyenne pour cette requête | 5,23 | 5,90 |

Le recul des clics s’accompagne de moins d’impressions et d’un CTR légèrement supérieur sur la requête principale. Ces données ne permettent pas d’attribuer le recul à l’extrait. La candidate garde le titre anglais « FLUX 3 Max | AI Video, Audio & Frame Control | MaxVideoAI », les titres localisés, les H1 et les URL canoniques.

La description anglaise proposée est « Create 5–20s videos with FLUX 3 Max from text or images, with optional audio. See real prompts, first and last frames, and prices for 720p or upscaled 1080p. » Le premier paragraphe explique en langage courant le rôle de l’image d’ouverture et de l’image de fin. Le titre du modèle précède le titre du film dans le HTML. Google peut choisir un autre passage selon la requête. [Documentation Google sur les extraits](https://developers.google.com/search/docs/appearance/snippet)

## Écarts entre la production et la candidate

| Sujet | Résultat de la revue |
| --- | --- |
| Démonstrations | La candidate montre l’entrée, le résultat animé et son prompt. Les essais sur écrans de 390 et 1 240 px ont lu le bateau de 8 s à partir d’une image et le téléphérique de 10 s à partir de deux images. Les deux films se chargent au clic. |
| Parcours | La galerie FLUX, la fiche standard, le comparatif Max / standard et les tarifs détaillés restent accessibles. La carte Extend ouvre FLUX 3 et la carte Modify ouvre Seedance 2.5. Les boutons de réutilisation et Milo portent le modèle et la recette ou l’exemple requis. Le panneau du héros retrouve le lien vers le film public Uncrowned. Le lien vers les assistants compatibles est rétabli dans la section de choix. |
| Réponses citables | La définition distingue le rôle de fal et celui de Black Forest Labs. Le tableau des réglages, le prix, les réponses et les liens sont lisibles dans le HTML serveur. La FAQ structurée passe de 6 à 11 réponses. Une source primaire accompagne la mesure de vitesse du fournisseur. [Mesure publiée par fal](https://fal.ai/blog/introducing-flux-3-max-by-fal) |
| Prix | L’API publique de devis et la page en production donnent 1,11 $ US pour 5 s en 720p, 1,89 $ pour 5 s en 1080p et 2,21 $ pour 10 s en 720p, son inclus. En alimentant les composants de la candidate avec les devis publics du jour, les trois prix localisés et le Product/Offer de 1,11 $ concordent dans les trois langues. Le serveur de maquette sans politique tarifaire active omet les montants et l’offre structurée. Ces chiffres sont un constat daté. |
| Images clés minutées | La production explique la séquence minutée et montre trois repères. La candidate présente le texte, l’image de départ et les images de début et de fin. Le module minuté, ses ancres et sa promesse sont suspendus. Aucune des 40 requêtes détaillées dans l’export longue période ne nomme les keyframes. La valeur produit et la perte éditoriale restent réelles. |

## Vérifications effectuées

- Les six pages examinées, production et prévisualisation en anglais, français et espagnol, répondent en HTTP 200. Chaque langue conserve son titre, un H1, sa canonique et les quatre liens de langue réciproques avec x-default. Les trois URL sont dans le sitemap public des modèles. La variante anglaise préfixée par /en revient à l’URL canonique.
- Les 87 destinations de contenu distinctes extraites du corps des trois pages, paramètres et fragments regroupés par URL, aboutissent en HTTP 200. Les ancres locales et les fragments tarifaires et de benchmark examinés existent. Les 134 URL d’entrée dans l’application aboutissent également et conservent le moteur, le mode, la preuve ou l’assistant lorsqu’ils sont spécifiés. Ce contrôle couvre la navigation publique. Aucun achat ni rendu n’a été effectué.
- Le contrôle du HTML serveur anglais avec un user-agent Googlebot retrouve le guide de prompts, les spécifications, les prix et la définition. Cela complète la lecture du DOM avec JavaScript. Le prix affiché et le JSON-LD avec devis actif ont fait l’objet d’un essai de rendu séparé.
- Les 42 tests ciblés et la vérification TypeScript passent. Aucune mesure de Core Web Vitals de terrain de la candidate n’est disponible avant publication.

## Mesure après activation

Comparer la requête exacte « flux 3 max » et les clics de la page sur des fenêtres de 7 puis 28 jours, à pays, appareil et position comparables. Suivre séparément les requêtes sur le prix, le 720p et l’accès au modèle, les entrées dans Create et l’ouverture des films. Les deux citations Bing déjà observées pour la fiche française constituent un repère distinct du trafic Google. Les gains de classement, de CTR ou de citations restent à mesurer. [Méthode et données de citation](./20261116-seedance-flux-outreach-audit.md)
