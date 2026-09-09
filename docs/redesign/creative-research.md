# Recherche créative et workflow média

9 septembre 2026. Recherche élargie après retour d'Adrien : répertoires, dépôts, composants précis et discussions communautaires. Deux références Magic UI ouvertes dans Chrome ; autres niveaux de qualification explicités ci-dessous. Aucun benchmark mobile des démos. Les adaptations MaxVideoAI sont nos propositions, pas des choix déjà approuvés.

## Recherche élargie : du répertoire au composant

La première liste de six sites était un point de départ. Pour chaque sélection finale, conserver la référence précise, le code source s'il existe, la raison de son intérêt, les adaptations et les essais manquants. Un lien vers un répertoire seul n'est pas une qualification.

| Ressource consultée | Nature / accès au code | Intérêt pour MaxVideoAI | Réserve / niveau atteint |
|---|---|---|---|
| [React Bits](https://github.com/DavidHDev/react-bits) | Dépôt et composants React à reprendre individuellement | Recomposition d'images, typographie ponctuelle, explorations de matière | README et licence consultés ; MIT + Commons Clause, pas MIT seul ; composants précis à mesurer |
| [Motion Primitives](https://github.com/ibelick/motion-primitives) | Dépôt MIT, Motion/Tailwind, présenté en bêta | Continuité d'un média vers son détail, transitions d'interface | Dépôt et source Morphing Dialog consultés ; démo bloquée par contrôle navigateur |
| [Magic UI](https://github.com/magicuidesign/magicui) | Dépôt MIT de composants ; offre Pro distincte | Liaison visuelle du MCP, lecteur agrandi | Dépôt, documentation et exemples de code consultés ; deux vues examinées dans Chrome |
| [Aceternity UI](https://ui.aceternity.com/components) | Catalogue de composants React/Next | Étudier révélations, masques et images au scroll | Catalogue consulté ; vérifier source et conditions du composant précis, sans recopier ses mises en page |
| [Uiverse](https://uiverse.io/) / [Galaxy](https://github.com/uiverse-io/galaxy) | Contributions communautaires CSS/Tailwind ; site indique MIT pour les éléments UI | États boutons, loaders et contrôles compacts | Site et dépôt consultés ; qualité et accessibilité variables selon contribution |
| [21st.dev](https://21st.dev/) | Répertoire de composants, blocs et thèmes React | Trouver des variantes de menus, médias et interactions | Catalogue consulté ; auteur, source, dépendances et licence à vérifier par entrée |
| [Codrops ScrollAnimationsGrid](https://github.com/codrops/ScrollAnimationsGrid) | Dépôt d'une exploration précise de grilles au scroll | Création unique qui se décompose puis rejoint les exemples | README consulté ; démo expérimentale à adapter, pas composant produit certifié |
| [Anime.js](https://github.com/juliangarnier/anime) | Moteur d'animation JavaScript | Séquence DOM/SVG personnalisée | Dépôt consulté ; alternative technique, pas moteur supplémentaire décidé |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | Rendu Three.js dans React | Option de scène en profondeur réellement utile | README consulté ; v8 associé à React 18, v9 à React 19 : compatibilité à respecter |
| [React Spring](https://github.com/pmndrs/react-spring) | Animation physique React | Réponses gestuelles si elles servent l'usage | Dépôt consulté ; pas d'ajout conjoint automatique à Motion/GSAP |
| [Theatre.js](https://github.com/theatre-js/theatre) | Éditeur de motion pour le web | Mise au point artistique d'une scène complexe | Dépôt consulté ; intérêt à justifier face à une timeline plus simple |
| [Vaul](https://github.com/emilkowalski/vaul) | Drawer React | Référence de feuille mobile | Dépôt repéré ; maintenance et compatibilité non qualifiées, pas adoption proposée |
| [Landing Love](https://www.landing.love/) | Enregistrements de sites entiers, catégories AI/film/3D | Évaluer rythme, transitions et composition au-delà du premier écran | Répertoire consulté ; ne donne pas automatiquement le code ni ses droits |
| [Unicorn Studio](https://www.unicorn.studio/) | Outil de graphismes interactifs | Piste pour explorer une matière ou un effet visuel | Découvert dans la communauté ; page publique peu extractible, capacités/export/coût à qualifier |

Ces ressources complètent Codrops Hub, GSAP Showcase, Awwwards, Hoverstat.es, Osmo et SiteInspire ci-dessous. Le nombre de liens ne valide pas la direction : la prochaine sélection sera plus courte et accompagnée d'états concrets.

## Ce que les forums ont ajouté

Deux discussions ont été lues : [planifier un site animé](https://www.reddit.com/r/webdev/comments/1mx20t1/how_do_you_plan_animated_websites/) et [ressources pour les animations](https://www.reddit.com/r/webdev/comments/1s1dzx7/learning_resources_for_stunning_page_animations/). Elles ont élargi la découverte à Landing Love et à des outils de prototypage. Les retours sont des témoignages, pas des benchmarks ni une preuve de compatibilité.

La méthode retenue est notre recommandation : écrire l'intention, dessiner les états, puis éprouver les moments essentiels dans le navigateur. Les choix techniques reposent sur les documentations/dépôts des auteurs et les essais locaux, pas sur une affirmation de forum. Une vidéo courte peut révéler une idée ; remonter à sa démo et à son auteur avant de la sélectionner. Aucun Short particulier fourni par Adrien n'a encore été identifié.

## Six pistes sélectionnées pour une qualification approfondie

| Piste | Ce qu'on reprendrait | Adaptation nécessaire | Décision actuelle |
|---|---|---|---|
| Grille qui se recompose, Codrops | Passage d'une création à plusieurs résultats | Même sujet au départ, ordre lisible, images réelles et version mobile en flux | À storyboarder pour la signature |
| [Animated Beam](https://magicui.design/docs/components/animated-beam) | Un trajet qui relie des étapes | Site → assistant → MaxVideoAI → résultat ; un seul trajet, noms explicites, pas de réseau abstrait | Documentation/code et composition desktop vus ; adaptation proposée |
| [Morphing Dialog — source](https://github.com/ibelick/motion-primitives/blob/main/components/core/morphing-dialog.tsx) | Continuité entre vignette et détail | Préserver les lecteurs et le focus existants, éviter déplacement massif sur mobile | Source consultée ; rendu non testé |
| [Hero Video Dialog](https://magicui.design/docs/components/hero-video-dialog) | Média centré, fond atténué, fermeture visible | Poster pendant attente, lecteur MaxVideoAI, fermeture clavier certaine | Ouverture essayée ; adoption directe non retenue sans recette |
| Micro-interactions CSS, Uiverse | Réponse nette d'un contrôle | Une famille commune, états focus/disabled/error, aucun chargement inventé | Sélection d'éléments individuels à faire |
| Matière/profondeur, React Bits ou Three.js | Relief et lumière localisés | Effet attaché à notre création, arrêt hors écran, repli statique | Option artistique à comparer à DOM/CSS |

## Qualification avant reprise de code

Consigner le commit/version retenu, auteur et licence exacte, imports, dépendances ajoutées, compatibilité React/Next/Tailwind, rendu serveur, démontage/nettoyage, interaction clavier/tactile et préférence de mouvement. Puis tester avec nos médias et mesurer le coût ajouté au gabarit. Aucune bibliothèque n'a été installée, aucun code tiers exécuté localement ou copié dans le produit durant cette recherche.

L'application inspectée utilise React 18.3.1 / Next 15.5.18 et possède déjà Three.js, Lucide et des contrôles de modales/médias. Une démo construite pour React 19 n'est donc pas automatiquement compatible. Le choix doit partir de ces contraintes réelles et rester local à la séquence concernée.

Pour passer à la direction artistique : une planche avec 6 références précises, leur usage proposé et ce qu'on écarte ; états desktop/mobile de la scène ; planche des détails décrite dans [interaction-details.md](interaction-details.md). Le choix repose sur la cohérence de cette composition, pas sur un effet isolé.

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
