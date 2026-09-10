# Master anglais 04 — contrôles du 10 septembre 2026

Périmètre : prototype local dans docs/redesign, branche codex/site-redesign. Aucune modification de frontend, de registre, de prix, de média ou de route de production. La revue est noindex.

## Résultats vérifiés

| Contrôle | Résultat observé |
|---|---|
| Données de catalogue | 40 modèles actuels publiés, 32 vidéo / 8 image, 12 familles vidéo ; nombres calculés depuis le registre |
| Comparaisons | Les trois duos sont publiés dans la politique de comparaison du registre |
| Notes | 36 valeurs projetées (6 critères × 2 modèles × 3 duos) égales aux fichiers de scorecards |
| Capacités | 24 valeurs projetées égales aux spécifications publiées |
| HTML | Anglais, un H1, aucun identifiant dupliqué, données initiales présentes et sources locales existantes |
| Angle dans le master | Aucun runway ni source de cadrage Angle ; un lien outil seulement |
| Scorecard | MiniMax/Seedance, Kling/Seedance et LTX Fast/Pro testés ; notes, noms, capacités, dates et URL cohérents |
| Catalogue | Filtre image : 8 ; recherche nano : 3 ; recherche absente : état vide ; fermeture native et retour du focus |
| Connect desktop | Le scroll passe de 0 à 2 puis revient à 0 ; le trait suit la progression ; les trois étapes sont aussi sélectionnables |
| Connect sans mouvement | Position relative, runway de 626 px égal au contenu observé ; boutons utilisables et vidéo d’ambiance en pause |
| Preuve Claude | Ouverture en fenêtre puis fermeture ; seule l’étape visible reste accessible, deux autres panneaux inert |
| Mobile | Composition observée en iframe à 320, 390 et 768 px ; étapes Connect à hauteur naturelle |
| Images et largeur desktop | Pas d’image chargée cassée ni débordement horizontal détecté pendant la revue |
| Étude Angle | Sélection High angle : image correspondante chargée et libellé mis à jour |
| Liens de départ | 40/40 accessibles : 30 dans main, 6 dans footer, 4 dans le catalogue modal ; 47 destinations HTTPS uniques dans main |
| Lecteur | Les cinq tests playback.test.mjs passent |
| Syntaxe / exposition | Modules vérifiés ; npm run lint:exposure passe |

Les tableaux de notes et capacités ont des rôles de tableau, ligne et en-tête, avec les noms des modèles synchronisés. Cela ne remplace pas une recette complète avec un lecteur d’écran.

La commande npm --prefix frontend run lint a été tentée : eslint est absent des dépendances du worktree. Aucun fichier frontend n’est modifié. Aucun build Next.js complet n’est revendiqué ; le runtime disponible est Node 23.9, le projet cible Node 22.

## Poids du support de revue

Mesures de fichiers, pas mesures Core Web Vitals :

- HTML EN 03 : 44 109 octets, environ 9 930 octets avec gzip.
- HTML EN 04 : 73 047 octets, environ 13 838 octets avec gzip.
- CSS supplémentaire du master : environ 22,3 Ko bruts / 5,3 Ko gzip.
- Scripts du master : environ 14,4 Ko bruts, auxquels s’ajoutent les 4,2 Ko du lecteur commun.
- Les noms du catalogue sont rendus dans le HTML ; le navigateur ne reçoit pas une seconde copie JSON du catalogue complet.
- Le poster prioritaire, la police, les cinq vidéos sources et les dérivés utilisés sont inchangés. Les images Angle sont sorties de la page d’accueil.

Le serveur Python local ne constitue pas une configuration CDN de production ; les valeurs gzip sont des estimations de compression des fichiers, pas des transferts réseau observés. Aucun nouveau framework d’animation ni moteur 3D ajouté.

## Point de contenu à corriger lors de l’intégration

La page publique [MiniMax H3 Max / Seedance 2.5](https://maxvideoai.com/ai-video-engines/minimax-h3-max-vs-seedance-2-5), consultée pendant cette itération, présente un instantané de prix avec MiniMax en 480p et Seedance en 720p, sous une formulation de niveau comparable. La différence de résolution doit être rendue explicite avant de comparer le prix par seconde. Le master ne reprend pas ce classement de prix.

La [méthode des benchmarks](https://maxvideoai.com/benchmarks) distingue notes éditoriales, capacités sourcées et latences observées. Le master conserve cette distinction et ne fabrique pas de note globale ou de vainqueur.

## Ce qui reste à valider

- Le choix du libellé Connect, la place des chapitres et leur finition par Adrien.
- La sélection des duos à confronter aux données GSC, GA4 et Clarity, sans prétendre avoir effectué une nouvelle extraction pendant cette itération.
- Le maillage définitif : quatre destinations initiales sont dans un dialogue et six dans le footer. La présence HTML ne prouve pas la conservation de leur poids SEO.
- L’intégration Next.js et ses contrats : metadata, canonical, hreflang, schémas cohérents avec le contenu visible, sitemaps, consentement, événements, Zoho.
- Des essais sur téléphones réels, clavier/lecteur d’écran, Safari, réseau lent et comparaison avant/après des Core Web Vitals.
- La localisation FR puis ES LATAM après validation EN.

Captures conservées dans le dossier ignoré du checkout principal : output/redesign-composition-04-2026-09-10/. Il contient l’accueil et le comparateur desktop, le scroll Connect, les états plan/résultat à 320 px, le contexte à 390 px et le résultat à 768 px.

[Voir le master](review/home-en.html?v=4) · [Présentation](home-composition.md) · [Sources](review/home/README.md)
