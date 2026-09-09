# Proposition de mouvement — « La scène se construit »

> **Réorientation après la revue V1 :** le découpage d'image en plans rectangulaires ne répond pas à l'ambition exprimée. Il est écarté comme effet signature. Les tableaux ci-dessous conservent l'historique ; la direction actuelle demande des objets aux contours indépendants, assemblage spatial et caméra/rotation. Voir [direction-reorientation.md](direction-reorientation.md) et [la planche en quatre états](review/direction.html).

Statut : proposition à examiner avec V1/V2. Exigence utilisateur du 9 septembre : inclure au moins une direction ambitieuse dans laquelle des éléments se construisent et se déconstruisent à mesure que l'on avance ou remonte dans la page. Cette exigence ne vaut pas approbation du scénario détaillé ci-dessous.

## Effet signature proposé pour MaxVideoAI

Après un hero immédiatement lisible, une scène occupe un grand espace ouvert. Le scroll assemble les éléments d'une intention créative, révèle le résultat, puis déploie plusieurs possibilités. Le mouvement décrit le produit : une référence, des décisions de cadrage, une animation, un choix de modèle.

| Progression dans la séquence | État visible | Message / fonction |
|---|---|---|
| 0–20 % | Un visuel de référence s'ouvre en plusieurs plans décalés, avec une profondeur douce. Le sujet reste identifiable. | « Tout commence par une image. » |
| 20–45 % | Les plans se rapprochent ; deux ou trois vues du même sujet se rangent autour de la vue choisie. Une vue devient dominante. | « Trouvez le bon angle. » ; lien outil Angle |
| 45–70 % | Les éléments s'assemblent en une image continue. Le cadre devient un lecteur vidéo ; un mouvement réel du sujet prend le relais, avec lecture volontaire si nécessaire. | « Donnez-lui du mouvement. » ; lien vers le modèle réellement employé |
| 70–100 % | Le rendu recule et se déploie dans une galerie de possibilités ; chaque résultat reste un objet lisible et ouvrable. | « Explorez ce que vous pouvez créer. » ; lien exemples/catalogue |

La remontée reconstruit les mêmes positions de façon déterministe. La vidéo, elle, ne prétend pas jouer à l'envers : elle repasse au poster lorsque l'on quitte son étape. La transition n'affirme pas représenter le calcul interne du modèle ni le temps réel de génération.

Le découpage en plans est une mise en scène éditoriale. Ne pas faire croire qu'un détourage, une reconstruction 3D ou un contrôle de caméra existent dans un modèle s'ils ne sont pas pris en charge. La chaîne démontrée et chaque commande devront être vérifiées avec les fonctionnalités présentes.

## Trois niveaux à comparer dans l'essai

1. **Composition DOM/CSS et orchestration du scroll (base recommandée).** Quelques médias plans, transformations, masques et profondeur simulée. Les textes/liens restent du HTML. Permet déjà construction, dispersion, assemblage et changement d'échelle ; ne nécessite pas une scène 3D complète.
2. **Couche WebGL localisée (variante ambitieuse).** Ajouter une déformation ou fragmentation de la seule image, si elle apporte une différence perceptible. Tester compatibilité, poids, temps de frame et retour au poster si le contexte GPU échoue. Chargement différé hors chemin critique.
3. **Séquence pré-rendue (alternative artistique).** Effet produit hors navigateur puis vidéo pilotée ou déclenchée. Qualité visuelle prévisible, mais seek et transfert peuvent être plus coûteux ; comparer sur appareils réels avant sélection.

Ne pas imposer les trois à la production. Retenir la solution la plus légère qui réalise l'ambition visuelle approuvée. Le nombre d'éléments animés et les durées de scroll restent à déterminer par l'essai.

## Références consultées le 9 septembre 2026

Recherche documentaire et pages de démonstration repérées, pas encore qualifiées visuellement dans le navigateur de ce chantier. Ces liens sont des inspirations de mécanismes, pas une revendication de tendance majoritaire ni une promesse de les reproduire à l'identique.

| Référence | Mécanisme utile | Adaptation proposée |
|---|---|---|
| [Codrops — Sticky Grid Scroll](https://tympanus.net/Tutorials/StickyGridScroll/) | Grille et progression dans une composition sticky | Le rendu final se déploie en galerie |
| [Codrops — ScrollAnimationsGrid, source](https://github.com/codrops/ScrollAnimationsGrid) | Variations d'apparition/transformation d'images au scroll | Comparer plusieurs chorégraphies de construction |
| [Codrops — Shaders on Scroll](https://tympanus.net/Tutorials/ShadersOnScroll/) | Transformations WebGL liées au défilement | Variante de fragmentation localisée, non imposée |
| [Codrops — WebGL transitions on scroll](https://tympanus.net/Tutorials/scroll-transitions-webgl/) | Transitions de médias | Passages entre référence et résultat |
| [GSAP — ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) | Pin, scrub et orchestration | Chronologie réversible de la scène, scroll natif |
| [Three.js — instancing performance](https://threejs.org/examples/webgl_instancing_performance.html) | Démonstration technique de répétition d'objets | À considérer seulement si de nombreux fragments sont justifiés |

Les licences et assets de ces démos doivent être contrôlés avant toute réutilisation. S'inspirer d'une mécanique n'autorise pas à reprendre les médias ou l'identité d'un autre site.

## Mobile, confort et SEO

Le [contrat mobile et performance](mobile-performance.md) fait partie du prototype. La version tactile doit garder une transformation perceptible et la même idée créative ; l'absence de pin ou de 3D n'est pas une raison pour présenter une simple pile des anciennes cartes.

- Mobile : assemblage bref ou étapes successives ; garder le sens même sans profondeur ni pin prolongé.
- Réduction du mouvement : posters/étapes fixes, tous les liens et textes restent accessibles.
- Accès direct : navigation et actions n'attendent jamais la fin de la séquence.
- Chargement : poster initial servi en HTML ; effet chargé à proximité de sa section ; jamais toutes les vidéos de la galerie préchargées.
- SEO : le canvas, s'il existe, ne possède aucun contenu essentiel exclusif. Les légendes, noms des modèles et liens restent sémantiques.
- Vérification : captures des états début/milieu/fin, aller-retour de scroll, redimensionnement, clavier, images/vidéos en échec, absence de GPU, reduced motion et appareils mobiles.

## Ce qu'il faut montrer pour valider

V2 : une planche des quatre états avec de vrais assets et la même scène. V3 : un essai interactif des solutions 1 et éventuellement 2, avec mesures comparables et comportement mobile. Le prototype doit montrer un vrai changement d'expérience ; des fades sur les anciennes cartes ne satisfont pas ce brief.
