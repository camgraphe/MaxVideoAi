# Recette — composition 02

10 septembre 2026. Branche `codex/site-redesign`. Revue locale, aucune route de production modifiée.

## Vérifications effectuées

- Chrome desktop, fenêtre de 1314 px : rendu de l’ouverture FR/EN, galerie, sélection par projet, étapes du parcours, lecteur vidéo, agrandissement d’image. Aucun débordement horizontal dans les états lus.
- Lecture réelle du hero : Kling 3 Pro puis Seedance 2.5, `readyState=4` et temps de lecture qui avance. Une seule vidéo d’ambiance montée. Source préparée publique correspondant à chaque original.
- Pause explicite, pause hors écran et suspension derrière une modale. Dans le lecteur agrandi, vidéo originale avec commandes natives ; lecture Kling observée jusqu’à la fin. Fermeture avec Échap : vidéo retirée et focus restitué au bouton d’ouverture.
- Parcours : proposition, validation et création atteignables avec les boutons ; retour au contexte rétablit l’angle du couvercle et l’étape initiale. L’animation est pilotée par la position de défilement, dans les deux sens. Calcul du parcours fondé sur la hauteur effective de la scène collante.
- Aperçu mobile : EN à 390 px ; FR à 320 px, y compris validation du prix ; es-419 à 320 px et parcours à 768 px. Les fenêtres ont été resserrées après constat de coupures latérales. Langue LATAM et sélecteur complet corrigés. Les actions et le poster précèdent les liens secondaires sur mobile.
- Mouvement limité : aucune lecture automatique active, quatre explications et fenêtres accessibles dans un déroulé statique. Également prévu pour une fenêtre très basse. Pas de dépendance à une animation pour afficher le premier poster ou les textes principaux.
- Les quatre tests du lecteur local passent : intention/visibilité, respect de la pause explicite, suspension, unique repli sur l’original, erreurs d’un ancien lecteur ignorées, chargement explicite mobile.
- Syntaxe des modules, génération des trois HTML, `git diff --check` et `npm run lint:exposure` passent.
- Vérification HTML des trois locales : un H1, huit FAQ, identifiants uniques, ancres valides, images locales existantes et noindex conservé.
- Inventaire des liens : 48 destinations distinctes dans le contenu principal. Les 40 destinations du relevé de production sont présentes ; Startup Fame est déplacé au pied de page, les 39 autres restent dans le principal. Les quatre guides sont des liens HTML, indépendants de la sélection JS. Trois comparatifs secondaires sont dans un accordéon natif.

## Charge et limites

La scène n’importe ni Three.js, ni GSAP, ni GLB. Les deux modules navigateur représentent environ 15 Ko non compressés / 5 Ko gzip ; le CSS environ 42 Ko / 10 Ko gzip. Ce sont des tailles de fichiers, pas des transferts mesurés ni des gains Core Web Vitals. Le serveur Python local ne représente pas les en-têtes de cache et de compression de production.

Poster initial en HTML, une seule vidéo d’ambiance chargée à la fois, pas de lecture automatique sur largeur mobile/tablette, Save-Data ou mouvement réduit. Les renditions viennent de la projection publique existante ; le lecteur d’ambiance reste propre à la revue. Une intégration Next.js devra réutiliser les propriétaires média de production, ses posters responsifs, son cycle de lecture et ses mesures.

L’iframe vérifie la composition responsive, pas un téléphone physique. Safari/iOS, conditions réseau froid/chaud, console réseau détaillée, INP et mesures comparables LCP/CLS restent à faire sur le candidat intégré. Les scénarios d’erreur sont testés avec des événements simulés ; aucune panne réelle n’a été provoquée sur le CDN. Le menu mobile n’a pas été exercé sur appareil physique.

Pas d’audit supplémentaire GSC/GA4/Clarity dans cette itération, ni de preuve de conversion ou de performance SEO. La présence des liens n’établit pas une équivalence des contenus. Canonical, hreflang, JSON-LD, analytics, consentement et intégrations restent ceux de l’application actuelle et devront être vérifiés lors de l’intégration.

## Captures locales

Fichiers ignorés du checkout principal : `output/redesign-composition-02-2026-09-10/`.

- `fr-hero-desktop.png`
- `fr-workflow-desktop.png`
- `images-desktop.png`
- `fr-mobile-320.png`
- `fr-workflow-320.png`
- `es-latam-mobile-320.png`
- `es-workflow-768.png`

Certaines captures précèdent les dernières corrections de labels/largeur du sélecteur ; la page générée est la référence actuelle. La recette fonctionnelle ne vaut pas validation artistique par Adrien ni autorisation de publication.
