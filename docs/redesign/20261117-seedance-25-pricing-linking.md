# Seedance 2.5 — revue du prix et du maillage avant publication

Revue du 17 novembre 2026. Le comparatif porte sur la page standard en production, la candidate locale en anglais, français et espagnol, et les parcours déjà proposés sur Kling 4.0 et Seedance 2.5 Flash.

**Avis éditorial.** La candidate explique mieux comment produire un plan, combien d’étapes seront facturées et quand changer de modèle. La publication dépend encore de l’activation 4K et de la vérification de l’offre commerciale dans l’environnement de livraison.

| Décision du visiteur | Ce que la revue a révélé | Ce que propose la candidate |
| --- | --- | --- |
| Quel sera le prix de mon plan ? | La prod donnait un exemple chiffré et un lien vers la grille. La première version cinématique pouvait afficher « 30s » comme seule valeur sous Pricing et perdre le lien tarifaire. | Le bouton ouvre Create sur le bon moteur. Le lien suivant arrive à la ligne Seedance 2.5 de la grille locale. Les montants de scénarios, l’offre et les tarifs à la seconde proviennent des lecteurs commerciaux existants. Une durée seule ne remplit plus la zone de prix. |
| Où économiser des itérations ? | L’ancien intitulé « Entry draft » désignait un devis de génération texte ordinaire en 480p, ce qui pouvait le faire confondre avec le nouveau Draft natif. | L’exemple est identifié comme texte vers vidéo. Le texte distingue le paiement du Draft et le devis de la finalisation de la prise retenue. |
| Quel autre modèle essayer ? | Dans la maquette annotée, « Create from text » et « Control the first and final frames » menaient au même éditeur. Les comparatifs Wan 3 et MiniMax H3 Max de la prod avaient disparu de la section. | Trois images issues des modèles mènent aux fiches Flash, Wan 3 et MiniMax H3 Max. Chaque fiche est accompagnée de son comparatif publié avec Seedance 2.5. Les versions Seedance 2.0 et 2.0 Fast et le comparatif avec 2.0 restent accessibles en dessous. |
| Où examiner le résultat original ? | La galerie écarte les films déjà présentés sur la page pour éviter les doublons. Cela supprimait aussi certains liens vers leurs pages de lecture. | Les légendes des démonstrations publiques donnent accès au film, notamment Hard Bounce et le canyon. L’ancienne ancre de galerie et le lien vers la méthode de benchmark fonctionnent à nouveau. |
| Que gagne-t-on pour la recherche ? | La prod associait le nom du modèle au générateur, aux 30 s, au 1080p et au son. | Le titre conserve ces termes et ajoute la 4K prévue pour la livraison. Le HTML identifie le rôle du modèle, ses entrées, Modify, Extend et le Draft. Les limites figurent dans un tableau HTML exportable et les réponses utiles sont lisibles dans la FAQ. |

## Contrôles

- Les trois routes locales répondent en HTTP 200. Chacune a un H1 Seedance 2.5, sa propre canonique et quatre alternates (EN, FR, ES, x-default). Les trois URL sont présentes dans le sitemap public des modèles.
- Les liens de contenu examinés dans les trois langues couvrent 59 chemins publics distincts sur MaxVideoAI après regroupement des variantes avec paramètres et fragments, hors application. Ils aboutissent à HTTP 200 après redirections. Les trois fragments tarifaires existent sur les pages de destination. Les fragments internes ont une cible dans le HTML.
- Les liens Create et Milo conservent le moteur Seedance 2.5. Les contrats de la page vérifient les modes et la réutilisation des preuves. Le contrôle HTTP de l’entrée Create couvre l’accès à la route. Aucune génération réelle n’a été commandée pour cet audit.
- La section d’alternatives est activée par le contenu localisé de Seedance 2.5. Les modèles proposés doivent être publiés et indexables. Les boutons de comparaison dépendent de la publication du duel. Les trois images de sélection sont chargées à la demande.
- Les descriptions, les liens de comparaison, les caractéristiques et la FAQ sont présents dans la réponse HTML. Les contrats de prix couvrent l’offre exacte, sa modification et son absence. Dans la prod observée, l’exemple en texte vers vidéo de 4 s en 480p affichait 0,83 $ US. Le tarif local de la candidate ne donnait pas de devis exact. Elle omet donc le montant et le Product avec Offer. Avant publication, vérifier ensemble le devis Create, le montant rendu en HTML et l’offre JSON-LD avec le tarif activé.

## Vérification du 17 novembre avant livraison

- La page candidate et la production répondent en anglais, français et espagnol avec les mêmes canoniques et alternates. Les trois routes Seedance et les trois routes FLUX figurent dans le sitemap public. Les 217 destinations et variantes de liens Seedance contrôlées en HTTP aboutissent, y compris les entrées Create et Milo.
- Le devis public sans génération pour 4 secondes depuis du texte avec son retourne 0,83 USD en 480p et 4,55 USD en 1080p. Le devis 4K reste indisponible en production. Les montants sont des observations datées. La page continue de lire les devis à la volée.
- Les fiches 2.0 Fast et 2.5 Flash ainsi que le comparatif MiniMax H3 Max expliquent maintenant le Draft ou la résolution du modèle standard sans attribuer la 4K aux autres variantes. Un export 1080p ou 4K du Draft est distinct du Modify ordinaire en 480p/720p.
- Livrer le moteur et son tarif ([PR #659](https://github.com/camgraphe/MaxVideoAi/pull/659)) avant la [PR des pages](https://github.com/camgraphe/MaxVideoAi/pull/657). Vérifier le devis 4K avec le moteur activé et le parcours Draft → final, puis contrôler les deux domaines après déploiement.

## Mesure

Pour l’URL anglaise, l’export GSC Web du 15 août au 14 novembre compte **152 clics, 3 473 impressions, un CTR de 4,38 % et une position moyenne de 23,65**. Les deux semaines disponibles comptaient déjà 17 puis 8 clics. Les requêtes Seedance au niveau du site ne permettent pas d’attribuer cette variation à la fiche standard. Le guide ci-dessous précise les exports et leurs filtres. [Audit Outreach du 16 novembre](./20261116-seedance-flux-outreach-audit.md)

Après publication, comparer des fenêtres de 7 puis 28 jours par URL et langue, suivre les clics vers Create, les fiches et les comparatifs, et surveiller l’indexation et les Core Web Vitals mobiles. Les démonstrations originales, les faits lisibles et leurs sources rendent le contenu plus facile à réutiliser. Le trafic et les citations resteront à mesurer. [Consignes Google pour les fonctionnalités IA](https://developers.google.com/search/docs/appearance/ai-features)
