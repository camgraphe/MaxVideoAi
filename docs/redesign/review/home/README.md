# Revue locale de l’accueil — master anglais 05

[English master](../home-en.html?v=5) est la référence. [EN 04](../home-en-v4.html), [EN 03](../home-en-v3.html), [FR 03](../home.html) et [ES LATAM 03](../home-es.html) sont conservés. [Angle](../angle-en.html) reste une étude distincte.

Ces pages sont locales et noindex. Elles ne génèrent ni média, ni facturation, ni événements analytics.

## Construire

Depuis la racine du worktree :

```bash
node docs/redesign/review/home/build.mjs
```

Le générateur écrit home-en.html et angle-en.html. Il ne retraduit pas FR/ES. Réutiliser le serveur existant sur 127.0.0.1:8775 ; sinon lancer `python3 -m http.server 8775 --bind 127.0.0.1` depuis cette racine.

Après une modification de connect-scene.mjs, reconstruire le moteur avec les dépendances déjà installées dans un checkout du projet :

```bash
node docs/redesign/review/home/build-connect.mjs '/chemin/du/checkout'
```

Le checkout doit fournir esbuild et frontend/node_modules/three. Construction de cette version : Three.js 0.183.2 et esbuild 0.25.11 du checkout principal. Le bundle local connect-runtime.js est versionné pour une revue autonome ; aucune dépendance CDN. Licence MIT dans [THREE-LICENSE.txt](THREE-LICENSE.txt).

## Propriétaires

| Fichier | Responsabilité |
|---|---|
| build.mjs / master.mjs | Composition EN, données nécessaires et étude Angle séparée |
| rebuild.mjs | Base 03 rendue sans écriture automatique ; contrats médias, prix indicatifs, FAQ et liens |
| master-data.mjs | Catalogue actuel et publication des duos ; notes et capacités publiées |
| master-sections.mjs | Catalogue, familles et comparatif rendus dans le HTML |
| connect-section.mjs | Texte, liens, contrôles, scène de secours et capture Claude |
| rebuild.css + finish.css | Base commune et finition complète du master 05 |
| master.client.mjs | Lecteur, modales natives, préférences et outil de revue mobile |
| master-interactions.mjs | Catalogue, familles et comparatif ; délégation de Connect |
| connect-controller.mjs | Préparation, scroll, sélection, animation à la demande, visibilité, préférences et nettoyage |
| connect-scene.mjs | Géométrie, textures de démonstration, éclairage, caméra, poses et ressources WebGL |
| build-connect.mjs / connect-runtime.js | Construction / projection navigateur de la scène |
| playback.mjs | Lecteur vidéo unique, intention, pause, visibilité et fallback original |
| angle.client.mjs | Quatre cadrages de l’étude séparée |
| v4/ | Styles et interactions archivés avec home-en-v4.html |

master.css est l’ancien support 04, conservé comme historique. Le master 05 ne le charge pas. Les anciens render/editorial/rebuild.client restent liés aux archives ; ne pas utiliser leurs générateurs pour écraser le master courant.

## Scène et chargement

Un IntersectionObserver prépare la scène à 700 px de son entrée, sans activation obligatoire. La géométrie est procédurale ; aucun GLB ni HDR distant. Le contexte, le plan et le brief sont dessinés sur des textures canvas. Seuls le logo MaxVideoAI, deux marques de modèles et la capture Claude existante sont utilisés comme images de la scène.

Le rendu est programmé pour une progression ou un déplacement de souris, puis s’arrête une fois stabilisé. Il est suspendu hors champ, dans un onglet masqué ou derrière une fenêtre. Sur petite largeur, la résolution est plafonnée à 1,15× et les ombres sont désactivées à la création ; plafond desktop 1,5×. Le scroll épinglé est désactivé jusqu’à 900 px, en fenêtre de faible hauteur et avec mouvement réduit. Save-Data conserve la scène HTML sans WebGL.

Le contrôleur maintient une seule légende accessible ; les autres sont hidden/inert. La scène est décorative pour les technologies d’assistance, le parcours est expliqué dans le HTML. La perte de contexte WebGL conserve l’illustration et les commandes. Les ressources de rendu sont libérées à la sortie, avec conservation lors du retour via le cache de navigation.

## Provenance

- Identité/publication : frontend/config/model-registry.json ; présentation : engine-catalog.json en lecture seule.
- Notes : data/benchmarks/engine-scores.v1.json ; capacités : engine-key-specs.v1.json ; méthode liée à /benchmarks.
- Films, ordre, durées et coûts indicatifs : frontend/components/marketing/home/home-redesign-visuals.ts.
- Posters et lectures préparées : home-posters.generated.json et public-video-renditions.generated.json, sans changement.
- Huit questions initiales : frontend/messages/en.json, home.redesign.faq ; une question assistant ajoutée en 04.
- Preuve Claude : frontend/public/media/mcp/claude-inline-video-proof.jpg, conservée dans son contexte réel.
- Disco Motel, marques et police : assets existants. FLUX conserve un repère typographique.

Les notes restent éditoriales. Aucun nouveau calcul de prix. Aucune source média ou projection de production n’est modifiée. La capture Claude n’est pas le résultat du projet illustratif.

## Vérification

```bash
node docs/redesign/review/home/build.mjs
node --check docs/redesign/review/home/master.client.mjs
node --check docs/redesign/review/home/master-interactions.mjs
node --check docs/redesign/review/home/connect-controller.mjs
node --check docs/redesign/review/home/connect-scene.mjs
node --test docs/redesign/review/home/playback.test.mjs
npm run lint:exposure
git diff --check
```

L’outil de revue propose 320, 390 et 768 px un accès direct au menu et un sélecteur d’étape Connect. Il ne fait pas partie du produit. Il ne remplace pas un téléphone réel, Safari, un lecteur d’écran ou un réseau lent.

Ces scripts sont un support de revue ; l’intégration utilisera les propriétaires React existants et fera l’objet de mesures comparables avant/après.

[Présentation](../../home-composition.md) · [Contrôles](../../home-composition-05-validation.md) · [Destinations](../../home-replacement-links.json)
