# Vérification du prototype — 9 novembre 2026

Le prototype est prêt à être relu localement. Il reste isolé de l’application MaxVideoAI et de ses données : les outils et le transfert cloud sont simulés. Les contrôles finaux ont été effectués dans le navigateur interne de Codex ; la connexion de débogage à Chrome a été annulée à la demande de l’utilisateur.

## Contrôles automatisés

- `npm run build` : TypeScript et compilation Vite réussis.
- `npm test` : 4 tests réussis sur les identités synthétiques, les fixtures mesurées, la séparation identité/URL et les rôles des outils.
- `npm audit --json` : 0 vulnérabilité signalée pour ce verrouillage au moment du contrôle.
- `npm run lint:exposure` à la racine : contrôle d’exposition publique réussi.
- La production n’a pas été compilée ou modifiée dans le cadre de cet essai.

Le dernier build charge environ 115 Ko gzip de JavaScript principal, puis les modules lecteur (19 Ko gzip) et import (20 Ko gzip) à leur ouverture. Il s’agit de tailles de fichiers de ce build, pas d’une mesure de délai réseau.

## Parcours navigateur

26 contrôles validés sont consignés dans `verification-results.json`. Les premières observations insuffisantes ou remplacées restent dans `exploratoryHistory` pour ne pas effacer les tâtonnements du diagnostic.

- Grilles de 1 000 et 10 000 fiches, filtrage par type, recherche et tri.
- Sélection distincte par cases, plage avec Maj, maintien au tri et remise à zéro au changement de filtre.
- Mise à la corbeille de deux médias, recherche sans résultat de l’élément retiré, restauration avec les mêmes identités.
- Sélection des 10 000 fiches, corbeille du lot entier puis annulation : retour aux 10 000 fiches.
- Portrait entier, zoom, favori sans changer de média ; fermeture du lecteur et retour du focus/défilement.
- Lecture vidéo native vérifiée avec des images décodées ; lecture audio native avec un seul lecteur actif. Aucun lecteur audio/vidéo ne subsiste après fermeture.
- Sélecteur commun : panier de références ordonné conservé lors d’une recherche et d’un aller-retour dans l’aperçu, plafond explicite, réordonnancement et préparation du rôle attendu.
- Lip Sync : source visuelle et audio affectés à des rôles séparés, avec références synthétiques canoniques.
- Import : pause à la fermeture, reprise, deux réussites conservées malgré un troisième échec volontaire, ajout partiel puis nouvelle tentative du seul fichier échoué, sans doublon.
- Sélection multiple réelle de deux fichiers publics locaux : dimensions mesurées dans le navigateur et ajout à la bibliothèque locale.
- Mobile émulé à 390 × 844 : sélection et actions groupées accessibles, portrait et fermeture dans le cadre, liste audio contenue dans la largeur.
- Vue Audio : 500 résultats, 16 lignes montées sur ordinateur et 14 sur mobile, sans lecteur chargé dans la liste.
- Suppression depuis l’aperçu d’une référence déjà choisie : la place est libérée, les références masquées par la recherche restent présentes et une nouvelle référence peut la remplacer.
- Une préparation enregistrée abandonne ses références mises à la corbeille et son manifeste ne contient que des sources disponibles.
- Un nouveau message d’ajout à une collection ne conserve pas le bouton d’annulation d’une suppression précédente.

## Rendu et charge locale

Une comparaison dans le navigateur interne à 1 440 × 900 donne les observations suivantes. Le témoin « DOM complet » est un mode de diagnostic de ce prototype (`?render=plain`), pas l’ancienne galerie de production.

| Mode | Fiches | Cartes montées | Lecteurs audio/vidéo au repos |
| --- | ---: | ---: | ---: |
| Grille virtualisée | 1 000 | 48 | 0 |
| Grille virtualisée | 10 000 | 48 | 0 |
| Témoin DOM complet | 1 000 | 1 000 | 0 |
| Témoin DOM complet | 10 000 | 10 000 | 0 |

Le dernier build retrouve 48 cartes montées pour 10 000 fiches. Dans une observation initiale distincte, les seules requêtes de médias de la grille étaient des vignettes locales : aucun original, aperçu vidéo complet ou fichier audio n’était demandé. Les temps bruts sont conservés dans le JSON, avec leur contexte. Une capture d’accessibilité du témoin à 10 000 cartes a dépassé la capacité de l’outil d’inspection ; elle ne constitue pas un benchmark d’interaction utilisateur.

Ces observations valident la limitation du travail de rendu à la zone utile. Elles ne prouvent aucun gain de latence en production : toutes les métadonnées sont déjà en mémoire et les 10 000 fiches réutilisent seulement 20 fichiers physiques. Il n’y a ni API, ni pagination, ni contrôle d’accès privé, ni 10 000 téléchargements indépendants. L’indicateur de rendu à deux images peut aussi être retardé quand le navigateur est en arrière-plan.

## Défauts du prototype trouvés et corrigés

- Espacement de la grille virtualisée : le padding externe coupait la dernière colonne ; il appartient désormais au conteneur.
- Cache des rendus React Aria : les événements lisaient d’anciens filtres ou une ancienne sélection ; les actions consultent le contexte courant.
- Propagation des clics dans le sélecteur : un bouton natif et la pression du parent pouvaient inverser deux fois la sélection ; les boutons utilisent maintenant les événements React Aria.
- Lecteur mobile : une colonne implicite débordait malgré un dialogue à la bonne largeur ; la colonne et la bande de voisins sont contraintes.
- Restauration de 10 000 médias : les recherches répétées dans un tableau ont été remplacées par un ensemble d’identités.
- File d’import : un ancien rendu React pouvait écraser l’état courant de la file alors que Uppy avait déjà terminé. Un seul propriétaire publie maintenant l’état. La reproduction concurrente échouait avant la correction et réussit après ; le parcours pause/réussite partielle/nouvelle tentative a été rejoué dans le navigateur interne.
- Panier et préparations : des identités supprimées occupaient encore une place et pouvaient rester dans le manifeste. La réconciliation utilise maintenant les médias actifs, sans retirer les choix simplement masqués par une recherche.
- Notifications : le message et son éventuelle action d’annulation sont désormais remplacés ensemble.
- Accessibilité du sélecteur : le bouton principal annonce « Sélectionner » et le bouton d’aperçu reste distinct.

Les messages console Uppy liés à la pause et à l’échec volontaire sont attendus dans cet essai.

Une revue indépendante du code a signalé les trois derniers points. Ils ont été corrigés, vérifiés dans le navigateur puis relus. Verdict : prêt à être relu localement par l’utilisateur ; aucune évaluation d’intégration en production n’est impliquée.

## Limites avant intégration

Ce travail n’a pas corrigé les défauts de production relevés dans l’audit précédent. Il reste à raccorder et vérifier l’API paginée, les identités réelles, les droits d’accès, le renouvellement des liens privés, l’invalidation des caches après suppression, les dérivés image/vidéo et les contrats exacts des outils. Les collections, corbeille, préparations et imports du prototype ne sont conservés que pendant la session.

Les captures et traces brutes se trouvent dans le dossier d’investigation local `2026-11-09-media-library-prototype`. Les tests mobiles restent une émulation de navigateur ; un appareil réel et Safari/iOS restent à vérifier lors de l’intégration.
