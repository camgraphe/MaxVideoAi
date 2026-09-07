# Grammaire visuelle — direction retenue

Une régie de création : navigation étroite mais nommée, surface ouverte, commandes groupées par fonction, bibliothèque visuelle et préférences en lignes. Pas de grands conteneurs imbriqués. Le prototype ne réemploie pas le CSS du premier lot rejeté.

| Élément | Règle |
|---|---|
| Composition | Navigation verticale, activité en haut, média sur la surface principale, commande créative en bas ; bibliothèque en grille et compte en liste, pas trois formulaires identiques |
| Typographie | Geist locale licenciée ; hiérarchie par taille, graisse et alignement, pas par accumulation de textes. Libellés stables, aide contextualisée |
| Couleur | Charbon légèrement chaud, surfaces mates, blanc cassé ; accent safran pour action/sélection, audio identifiable par son symbole et son nom. Version claire effective |
| Pictos | Petits dessins SVG métier originaux sur grille 24 : silhouettes pleines, découpe franche, seconde masse teintée. Même poids optique ; pas d’emoji ni de combinaison de bibliothèques. Les signes universels restent simples |
| Contrôles | Navigation à silhouette + nom ; modes à languettes ; valeurs à sélecteur ; action principale pleine ; transport rond ; actions contextuelles en lignes. État actif et focus explicites |
| Références | Ligne Ajouter à vide ; vignettes avec rôle +N ensuite ; panneau Gérer pour grandes collections. Pas de croix minuscule flottante comme unique moyen de retrait |
| Modèle et prix | Modèle nommé au-dessus de la surface, Comparer explicite ; valeurs compactes et prix avant génération regroupés près de l’action. Liste de modèles avec prix à réglages identiques, adaptations prévisualisées avant application |
| Mouvement | Déplacement de focus visuel, insertion de référence, ouverture de panneau 120–180 ms ; aucun délai ni animation de chargement inventés. Réduction des mouvements effective |
| Mobile | Création/Médias/Outils/Studio/Compte accessibles par noms courts ; les deux dernières destinations de maquette annoncent leur périmètre réel. Panneaux fermables, pied d’action et safe area ; cibles 44 px, aucun outil essentiel réservé au survol |
| Performance | Une police locale, SVG inline, miniatures à géométrie stable, média natif seulement à la demande et `preload=none`. Images hors vue différées ; collections bornées et pagination lors de l’intégration réelle |

Inspiration consultée le 7 septembre 2026 : [Penpot, structure du workspace et propriétés contextuelles](https://help.penpot.app/user-guide/first-steps/the-interface/) ; [Phosphor, famille SVG duotone sous MIT](https://github.com/phosphor-icons/core). Phosphor constitue une option solide pour compléter le vocabulaire en production ; aucun de ses assets n’est copié dans cette première famille maison. [tldraw](https://github.com/tldraw/tldraw) a été comparé pour les outils contextuels, sans importer son SDK : son usage production exige une licence.

Critère : juger le résultat à l’usage, pas la seule planche. La direction visuelle est retenue par l’utilisateur ; la couverture fonctionnelle et l’intégration restent à valider. Voir `integration-contract.md` pour les fonctions à conserver.
