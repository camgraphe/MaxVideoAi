# Recherche créative et workflow média

9 septembre 2026. Sources web consultées ; sélection documentaire, sans benchmark mobile des démos ni validation de licence pour réemploi. Les adaptations MaxVideoAI ci-dessous sont nos propositions.

## Références à explorer

| Référence | Pourquoi l'utiliser | Application proposée |
|---|---|---|
| [Codrops Creative Hub](https://tympanus.net/codrops/hub/) | Expériences de galeries, scroll et WebGL ; notamment Atmospheric Depth Gallery (mars 2026), Relighting Images (août 2026), grilles 3D au scroll (2024) | Étudier profondeur et recomposition pour notre scène signature |
| [GSAP Showcase](https://gsap.com/showcase/) | Sites utilisant l'animation dans une expérience complète | Juger la relation entre rythme, navigation et contenu |
| [Awwwards — Animation](https://www.awwwards.com/websites/animation/) | Répertoire de sites animés, filtres par techniques et usages | Constituer un petit moodboard de compositions et transitions |
| [Hoverstat.es](https://www.hoverstat.es/) | Sélection de design web alternatif | Explorer des compositions moins convenues |
| [Osmo](https://www.osmo.supply/) | Bibliothèque de ressources et effets de développement | Accélérer certains essais après examen de licence et dépendances |
| [SiteInspire](https://www.siteinspire.com/) | Répertoire de sites et directions visuelles | Travailler l'espace, le cadrage et la typographie autant que les effets |

Les dates de Codrops attestent de publications, pas d'une domination statistique des tendances. Une récompense ou une démo spectaculaire ne prouve pas qu'un effet convertit ou fonctionne bien sur nos mobiles.

## Proposition de langage visuel

**Le studio vivant.** Les créations sont le matériau du site : images de grande taille, cadrages précis, quelques légendes utiles, outils qui apparaissent au moment où ils expliquent une transformation. La technologie se voit dans ce que l'on peut faire. Palette et typographie restent à valider avec l'identité réelle de l'app.

| Moment | Mise en scène proposée | Version mobile / sans mouvement |
|---|---|---|
| Accueil — signature | Une image s'ouvre en plans, révèle ses angles, se recompose puis devient vidéo ; le scroll inverse reconstruit les états | Étapes courtes en flux vertical, même preuve visible ; états fixes avec commandes explicites si nécessaire |
| Transition vers exemples | La création terminée rejoint une galerie de résultats ; passage du singulier à la variété | Grille de grandes vignettes, pas de rail horizontal obligatoire |
| Catalogue | Résultats d'abord, sélection nette ; transition courte lors d'un filtre | Tactile, nombres et résultats immédiatement compréhensibles ; aucun effet au survol indispensable |
| Comparaison | Même scène côte à côte et lecture volontaire pour constater une différence | Lecteurs adaptés à la largeur, libellés visibles et commandes indépendantes |
| Outils | Petit schéma qui répond à l'action : angle, cadrage, référence | SVG lisible à l'arrêt et réponse au toucher |

Préférer deux moments distinctifs bien produits à dix effets concurrents. Écarter du premier prototype curseur décoratif, défilement imposé, tunnel 3D obligatoire et pluie de particules sans fonction. Ce choix laisse une vraie place à l'ambition dans la scène signature.

## Choix techniques à éprouver

- **CSS + DOM/SVG :** base des compositions, masques et transformations. Les animations natives liées au scroll sont une option avec détection de support et repli. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations).
- **GSAP ScrollTrigger :** candidat pour une séquence précise à plusieurs étapes, liée au scroll avec pin/scrub. Le défilement natif peut être conservé. [Documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/).
- **Motion pour React :** autre candidat pour transitions d'interface et animations liées au scroll. Choisir selon les dépendances déjà présentes et le prototype ; ne pas empiler plusieurs moteurs pour le même besoin. [Documentation](https://motion.dev/docs/react-scroll-animations).
- **Three.js/WebGL :** option localisée pour une profondeur impossible à rendre suffisamment bien en DOM ; charger à la demande et comparer visuellement et techniquement au prototype léger. Ce n'est pas une dépendance décidée.
- **Vidéo préproduite :** bonne candidate pour une scène visuellement complexe ; poster et lecture maîtrisée. Le déplacement de la page ne doit pas imposer un seek vidéo permanent. Le scrub sera un essai séparé si son résultat le justifie.

Il s'agit de JavaScript/TypeScript et CSS pour le navigateur. Une mise à jour de stack n'est pas nécessaire par principe pour obtenir cette direction.

## Workflow ImageGen, MaxVideoAI et pictogrammes

1. **Classer les médias existants.** Relever usage, source, modèle réel, droits, qualité, dimensions, recadrage mobile et disponibilité des dérivés. Réutiliser les bonnes preuves déjà produites.
2. **Écrire le brief de collection.** Sujet suivi, lumière, matière, cadrages, espace pour les textes, variantes mobiles et rôle de chaque asset. Éviter une série de belles images sans continuité.
3. **ImageGen pour explorer.** Créer les images clés et maquettes de direction ; conserver les textes d'interface en HTML à l'implémentation. Une maquette raster ne valide ni responsive ni interaction. Produire ensuite les assets approuvés, sans confondre illustration de marque et sortie démontrée d'un modèle.
4. **MaxVideoAI pour animer.** À partir du brief et des références approuvées, consulter les modèles disponibles et leurs contrats via le plugin, établir la proposition et son budget avec hypothèses de tentatives, puis présenter la production concrète avant dépense. Aucun modèle, prix ni durée technique n'est choisi de mémoire.
5. **Pictogrammes vectoriels.** Réutiliser les conventions familières pour les commandes ; créer une petite famille propre pour les concepts distinctifs comme référence, angle et transformation. Grille et épaisseur constantes, corrections optiques, revue aux tailles d'usage. Les petits pictos d'interface ne seront pas des images raster générées.
6. **Contrôler puis préparer.** Revue image par image et vidéo en mouvement : cohérence du sujet, artefacts, boucle, cadrage, lisibilité mobile. Garder les masters et provenance ; préparer posters et dérivés via les contrats média existants.
7. **Intégrer et mesurer.** Respecter `docs/engineering/media-delivery.md`, les registres et profils publics existants. Vérifier poster serveur, géométrie, lecture à la demande et transferts réels. Revoir le résultat sur le site, pas uniquement dans un dossier d'assets.

## Premier lot créatif proposé

Un sujet original suivi de bout en bout : une image de départ, trois états de transformation, une vidéo finale et leurs recadrages mobile. Une seconde série de preuves de modèles, issue de sorties vérifiables, sert au catalogue et à la comparaison. Un petit échantillon de pictos suffit à fixer la grammaire avant extension.

Chaque asset aura une fiche : identifiant, rôle, provenance, outil/modèle réel, références, version, coût constaté si produit, droits, master, dérivés et pages consommatrices. Les logos officiels des moteurs restent leurs marques ; ne pas les réinventer en pictos approximatifs.

## Prochain résultat à présenter

Au jalon V1, juger le récit et l'utilité des effets. Après cet accord, produire une direction complète avec les vrais textes, états clés desktop/mobile, un storyboard du mouvement et un plan d'assets. Puis un prototype navigable permettra de valider ce qu'une image seule ne peut montrer : fluidité, lecture, toucher et vitesse.
