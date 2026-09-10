# Accueil — master anglais 05

[Ouvrir la proposition](review/home-en.html?v=5). Le [master 04](review/home-en-v4.html) est conservé pour comparer les choix. FR et ES LATAM restent historiques ; la référence de conception est l’anglais.

Le retour à traiter porte sur toute la page : trop lourde, pas assez dense, trop simple et insuffisamment finie. Cette passe travaille la hiérarchie, les proportions et les interactions du même accueil.

## Ce qui a été repris

- **Composition générale.** Titres moins envahissants, espaces resserrés, suppression des espacements cumulés entre les sections de même fond. Les médias gardent une place importante.
- **Détails.** Navigation, boutons et états de survol/focus/pression ; arrondis et bordures cohérents ; textes secondaires plus lisibles. Les ombres restent localisées aux éléments qui ont un relief. Suppression de séparations répétitives.
- **Compare.** Une composition claire avec deux modèles, six critères éditoriaux et un onglet de capacités distinct. Les barres se déploient et changent avec le duo. Noms, valeurs, limites, dates, méthode et liens restent issus des mêmes sources que le master 04.
- **Connect.** « Keep the idea moving. » Les mêmes objets parcourent une scène en 3D : contexte du projet, plan à approuver, puis exemple de résultat dans Claude. Cadres avec épaisseur, éclairage, ombres douces et déplacement en profondeur ; le scroll fait avancer et reculer le récit. Une réaction légère à la souris accompagne le mouvement.
- **Fenêtres.** Entrée courte, fond atténué, bouton de fermeture identifiable, recherche et filtres du catalogue. La capture Claude peut toujours être agrandie.
- **Mobile.** Étapes Connect directes, hauteur naturelle, commandes tactiles agrandies, disposition adaptée des scores, alignement des textes corrigé. Le CTA et les exemples précèdent toujours le poster principal.

## Lire la scène Connect

Les fenêtres du projet et du plan sont des illustrations du parcours. La dernière fenêtre est la capture réelle existante de l’intégration Claude : elle n’a pas été générée depuis le projet fictif montré avant. Cette distinction est indiquée dans la page. Aucune vidéo n’a été générée pendant cette passe.

Les trois boutons permettent de sélectionner un moment. « Play the story » parcourt la scène à la demande. Sur grand écran, « Follow scroll again » reprend le suivi du défilement après une sélection manuelle. Le défilement du navigateur reste natif.

La scène se prépare automatiquement à l’approche de la section. Une illustration HTML est visible dès le départ, y compris sans WebGL. Le moteur ne tourne pas en continu lorsque la scène est immobile ; il se suspend hors champ, derrière une fenêtre ou dans un onglet masqué. Cela décrit l’implémentation, pas une preuve de performance en production.

## Contenu et continuité

Les cinq films de l’accueil, le catalogue actuel, les comparaisons, les guides par intention, les outils, le parcours de prix et les neuf questions sont conservés. Angle reste un outil secondaire et possède son [étude séparée](review/angle-en.html).

L’inventaire retrouve les 40 destinations de départ : 30 dans le contenu principal, 6 dans le footer et 4 dans le catalogue. Cette présence ne prouve pas une parité SEO. D40 reste la règle : préserver les intentions utiles et les accès importants, améliorer ce qui fonctionne mal, puis mesurer proportionnellement aux changements. Les comptes GSC/GA4/Clarity n’ont pas fait l’objet d’une nouvelle extraction dans cette passe.

## Décision suivante

Examiner la finition de la page complète, son rythme et l’utilité de Connect avant intégration. Le master est encore une proposition locale. L’intégration Next.js devra reprendre les propriétaires média et SEO existants, les mesures de performance comparables, l’instrumentation, le consentement et Zoho. FR puis ES LATAM viennent après la validation EN.

[Contrôles et limites](home-composition-05-validation.md) · [Sources et construction](review/home/README.md) · [Décisions](decisions.md)
