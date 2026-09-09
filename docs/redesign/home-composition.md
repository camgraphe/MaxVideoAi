# Accueil — composition 01

9 septembre 2026. Première page complète après l'étude de mouvement. **Proposition à examiner**, distincte des routes de production.

**Retour du 10 septembre : à reprendre.** La proposition est trop légère et sa couverture ne suffit pas pour remplacer l'accueil actuel. La recette technique reste valable dans son périmètre ; voir [le diagnostic et le brief corrigé](home-replacement-brief.md) avant de poursuivre.

Ouvrir [l'accueil FR](review/home.html). Le sélecteur propose aussi [EN](review/home-en.html) et [espagnol LATAM](review/home-es.html). « Vue mobile » présente la même page à 320, 390 ou 768 px. « Voir les effets prévus » affiche les intentions dans leur section ; ces annotations sont masquées à l'ouverture.

## Ce que cette page propose

| Moment | Message et action | Rôle du visuel |
|---|---|---|
| Ouverture | Créer une vidéo depuis du texte ou une image, prix connu avant génération | Grand poster d'une vidéo Kling 3 Pro existante. Actions avant le média sur mobile |
| Workflow MCP | Contexte du projet → proposition et prix à valider → création dans la bibliothèque | Trois fenêtres indépendantes autour d'une même référence ; emplacement proposé pour le mouvement principal au scroll |
| Images et outils | Créer la référence, explorer un angle, préparer la vidéo | Trois images de départ réellement disponibles dans l'app ; liens vers les modèles image et les outils |
| Choix du modèle | Regarder des rendus et comparer les capacités | Sélecteur fonctionnel MiniMax / Seedance / Kling, posters et destinations propres à chaque modèle |
| Prix | Paiement à l'usage, sans abonnement, crédits rendus en cas d'échec | Typographie et trois explications courtes, sans montant estimé inventé |
| Réponses et action | Lever les huit questions principales et entrer dans l'app | FAQ native, liens d'approfondissement, pied de page |

La palette claire, l'accent vert et la combinaison typographique sont une proposition. Les frontières de sections reposent sur l'espace et la composition. Les fenêtres du MCP représentent des étapes du produit ; elles ne servent pas de conteneurs décoratifs pour tout le site.

## Ce que nous retenons du dernier retour

- L'étude chaussure/ordinateur reste une référence de mouvement. Son sujet n'est pas retenu pour l'accueil.
- Le défilement doit expliquer la progression réelle d'une création. L'ouverture d'ordinateur peut servir la section MCP si elle rend cette progression plus claire.
- Aucun bouton « charger l'expérience » sur la page destinée au visiteur. Le premier état doit être présent ; les ressources nécessaires au mouvement se préparent avant son entrée en scène. Cela ne signifie pas charger toutes les vidéos du site au premier affichage.
- L'aperçu vidéo qui accompagne la souris est proposé dans le sélecteur de modèles. Au toucher : sélection et média fixe au même emplacement, avec commandes de lecture appropriées.
- La composition doit fonctionner avec ses images avant la fabrication de l'effet. Cette version ne contient donc ni vidéo automatique ni scène 3D.

## Vérité produit et contenu

Les fenêtres MCP sont une **illustration du parcours**, pas un transcript d'assistant ni une preuve d'une vidéo déjà créée. Le même visuel Disco Motel apparaît comme contexte et plan envisagé. La légende indique que le résultat vidéo reste à produire. Aucune promesse de récupération automatique d'un site, de reconstruction 3D ou de montage Studio.

Le MCP est visible tôt dans la page et mène à sa vraie entrée publique. Le Studio reste absent de l'action principale compte tenu de son accès actuel. Les marques proviennent du dépôt ; elles identifient modèles et assistants sans revendiquer de partenariat. Sources détaillées : [guide de la composition](review/home/README.md).

Les huit thèmes de la FAQ actuelle sont conservés : création, choix du modèle, référence image, texte/image vers vidéo, exemples et prompts, coût, abonnement, limites. Les réponses ont été raccourcies et réécrites dans les trois langues. Il s'agit d'une proposition éditoriale, pas d'une amélioration SEO mesurée.

L'espagnol emploie le tutoiement, « video », « costo », « agrega » et « créditos » pour une cible LATAM. L'aperçu porte `lang="es-419"`. Les destinations produit gardent `/es/` et les slugs existants. Aucun changement de hreflang de production.

## Points à reprendre lors de l'intégration

Le [tableau des sections existantes](home-pilot.md#correspondance-avec-laccueil-existant) reste le contrat de migration. La composition ne justifie pas de supprimer silencieusement des contenus ou des liens. En particulier :

- Replacer les liens vers les guides par usage du sélecteur actuel et vérifier les comparatifs précis, prompts/réglages et fonctions moins visibles dans cette proposition.
- Comparer chaque réponse réécrite au contenu actuel et à ses données structurées avant remplacement.
- Conserver les propriétaires existants pour les URLs, métadonnées, canonical, hreflang, schémas, prix et lecteurs vidéo. La structure de cette revue statique ne devient pas l'architecture Next.js.
- Intégrer les visuels retenus par les contrats médias existants : poster prioritaire, variantes responsives, géométrie réservée, renditions et contrôle réseau. Les deux JPEG distants de cette revue ne constituent pas une stratégie de livraison mobile.
- Conserver et vérifier les événements Clarity/GA4, la mesure GSC et les intégrations, dont le statut Zoho encore à confirmer. Cette composition locale n'envoie aucun nouvel événement aux comptes.

## Prochaine décision concrète

Juger l'accueil entier : hiérarchie, place donnée au MCP, qualité des visuels et lisibilité mobile. Retenir les sections et leur message, puis ajuster leurs images. Ensuite seulement : produire la séquence au scroll dans la section retenue et éprouver ce langage sur `/models`, une fiche et une page d'exemples. Le choix des effets n'est pas déduit de leur simple présence dans les annotations.

Vérifications et limites : [recette de la composition](home-composition-validation.md).
