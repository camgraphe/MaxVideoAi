# Master anglais 05 — contrôles du 10 septembre 2026

Périmètre : prototype local docs/redesign, branche codex/site-redesign. Aucun fichier frontend ni service de production modifié. La finition fait l’objet de cette proposition ; elle n’est pas considérée comme validée par Adrien.

## Vérifications réalisées

| Contrôle | Résultat |
|---|---|
| Construction HTML | Générateur exécuté ; un H1, aucun identifiant dupliqué, anglais et noindex |
| Fichiers locaux référencés | Aucun fichier HTML img/script/stylesheet manquant détecté |
| Continuité des accès | 40/40 destinations de départ : 30 main, 6 footer, 4 catalogue ; 47 destinations HTTPS uniques dans main |
| Données | master-data inchangé ; le générateur conserve les contrôles de publication et de notes |
| Catalogue | Filtre Image : 8 modèles ; recherche nano : 3 |
| Comparateur | Changement Kling/Seedance et onglet Capabilities : noms, limites publiées et URL du duo synchronisés |
| Connect desktop | Rendu WebGL observé dans Chrome ; défilement vers l’état 2 puis retour à 0 ; différentes poses photographiées |
| Lecture à la demande | Play the story parcourt la scène et atteint l’état 2 / progression 1, puis rend le bouton de lecture |
| Scène | Géométrie et relief visibles ; ombres initialement trop dures corrigées après examen des captures |
| Mouvement réduit | Activation manuelle : position relative, runway et contenu de même hauteur (717 px observés), lecture animée désactivée ; sélection du résultat fonctionnelle |
| Légendes | Une seule des trois légendes visible selon l’étape ; les autres portent hidden/inert dans l’implémentation |
| Fenêtre Claude | Capture réelle affichée ; Échap ferme ; focus rendu à mcp-proof |
| Mobile | Aperçus iframe à 320, 390 et 768 px ; résultats, comparatif et états Connect inspectés. Alignement du texte et tailles de commandes repris |
| Menu mobile | Fenêtre à 390 px inspectée ; six accès, fermeture et focus visibles |
| Page complète | En-tête, résultats, comparatif, scène, outils, prix/FAQ et catalogue examinés dans Chrome |
| Largeur desktop | Aucun débordement horizontal observé à 1314 px |
| Archives | Scripts et CSS 04 égaux au commit précédent, sauf chemin relatif du lecteur ; FR/ES, EN03 et étude Angle inchangés |
| Syntaxe et lecteur | Modules vérifiés ; cinq tests playback passent |
| Exposition | npm run lint:exposure passe |

Les captures ont conduit à ajuster les contrastes, adoucir les ombres, déplacer un logo qui masquait le titre du plan, raccourcir les labels mobiles et supprimer les espacements cumulés entre sections. Certaines captures intermédiaires conservent les labels précédant ces corrections ; le HTML courant fait référence.

## Poids et limites de performance

Mesures de fichiers locaux, pas mesures Core Web Vitals :

| Support | Octets bruts | Estimation gzip |
|---|---:|---:|
| HTML EN 05 | 73 144 | 13 747 |
| CSS finish.css | 37 663 | 8 534 |
| Bundle Connect, Three.js inclus | 533 247 | 134 444 |
| Contrôleur Connect | 6 562 | 2 332 |
| Client général | 7 595 | 2 544 |
| Interactions catalogue/comparateur | 4 403 | 1 691 |

Le CSS de base et le lecteur commun s’ajoutent. La version 04 n’utilisait pas de moteur 3D ; la hausse de poids est explicite. Le serveur Python ne simule pas un CDN compressé. Ces estimations ne décrivent pas les transferts observés sur téléphone.

La scène est importée à l’approche de la section (700 px), les objets sont procéduraux et les images réutilisent des assets existants. Une illustration est présente avant WebGL. Le moteur s’arrête une fois la pose stabilisée, hors champ, en onglet masqué et derrière une modale. Plafond de résolution 1,5× desktop / 1,15× petite largeur ; ombres désactivées pour une scène créée en petit format. Ce sont des choix d’implémentation vérifiables dans les sources, pas des gains terrain mesurés.

Le poster principal, les films, leurs renditions et les règles de lecture de production restent inchangés. L’ordre mobile création/exemples → poster → découvertes secondaires est conservé.

## Avant intégration

- Validation visuelle d’Adrien sur la page complète, le niveau de détail et l’utilité du récit Connect.
- Essais sur téléphones physiques, Safari, réseau lent, perte de WebGL, économie de données et technologies d’assistance. Les fallbacks sont implémentés ; aucune injection de panne ou émulation Save-Data n’est revendiquée ici.
- Mesures comparables avant/après sur le runtime Next.js : LCP, INP, CLS et transferts. Bloquer une régression reproductible.
- Continuité SEO : canonical, hreflang, indexabilité, schémas, contenus, liens et sitemap selon D40. La présence de 40 liens n’établit pas la parité du référencement.
- Intégration de Clarity, GSC, GA4, consentement et Zoho ; aucune nouvelle extraction analytics ni conclusion de conversion pendant cette passe.
- Localisations FR puis ES LATAM après le master EN.

Pas de build Next.js complet : seuls des documents et supports de revue changent. Le lint frontend n’est pas présenté comme passé ; les dépendances ESLint étaient absentes du worktree lors de la recette 04. Node local 23.9, cible projet Node 22.

Captures : dossier ignoré du checkout principal `output/redesign-composition-05-2026-09-10/`.

[Proposition actuelle](review/home-en.html?v=5) · [Présentation](home-composition.md) · [Sources](review/home/README.md) · [Archive 04](review/home-en-v4.html)
