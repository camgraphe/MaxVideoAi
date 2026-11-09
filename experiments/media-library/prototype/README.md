# Prototype local de bibliothèque média

Prototype jetable autorisé par l’utilisateur pour éprouver une bibliothèque commune avec collections, grille dense, lecteur et sélecteurs de médias. Ce dossier reste indépendant de l’application MaxVideoAI : aucune intégration en production, aucune action payante et aucun lancement de génération.

Depuis ce dossier, installer les versions du fichier de verrouillage, construire puis ouvrir le serveur de prévisualisation local :

```sh
npm ci --workspaces=false --ignore-scripts
npm run build
npm run preview
```

Adresse : <http://127.0.0.1:5188/> ; jeu de 10 000 fiches : <http://127.0.0.1:5188/?count=10000>. Le port est fixe ; arrêter un serveur déjà présent avant de relancer. Le socle verrouillé utilise React/React DOM 18.3.1, React Aria Components 1.22.1, Yet Another React Lightbox 3.33.0, Uppy Core 6.3.1 et Uppy React 6.1.1. Vite est fixé au patch 8.3.6 retenu pour cet essai.

Les jeux de 1 000 et 10 000 fiches chargent toutes leurs métadonnées en mémoire. Ils réutilisent 20 médias physiques publics du dépôt, donc 20 ensembles d’URL répétés : ce montage permet d’explorer le rendu et les interactions mais ne mesure pas le chargement de 10 000 fichiers distincts. Les données d’identité et d’organisation sont fictives ; les dimensions, durées et tailles des fixtures sont mesurées. Le portrait vidéo de cinq secondes est explicitement une image statique encodée en vidéo. Voir `fixtures-notes.json` pour les sources, les profils de préparation et les limites.

L’import utilise une file Uppy locale avec mesure des fichiers dans le navigateur et transfert simulé ; aucun fichier n’est envoyé vers le cloud. « Fermer et garder la file » interrompt les essais en cours tout en conservant la sélection dans la session ; rouvrir « Importer » permet de reprendre la simulation. Le lot « Tester le parcours » contient un échec volontaire au premier essai pour exercer « Réessayer ». La file et les ajouts restent en mémoire et ne constituent pas un stockage durable.

Il n’y a ni pagination API, ni authentification, ni contrôle réel d’accès privé, ni renouvellement de liens signés. Les passages vers les outils sont des démonstrations locales. Les observations en émulation mobile dans Chrome puis dans le navigateur interne de Codex ne valident pas un appareil physique ni Safari/iOS, notamment les gestes, le clavier et la lecture des médias.

Les [résultats de vérification](VERIFICATION.md) décrivent les parcours exercés, les défauts du prototype corrigés et les limites des mesures. La grille conserve les formats entiers dans des cases compactes ; la vue Audio utilise une liste virtualisée de 60 px par ligne. Le lecteur et l’import sont des modules chargés à la demande.

Les composants réutilisés proviennent de [React Aria](https://github.com/adobe/react-spectrum), [Yet Another React Lightbox](https://github.com/igordanchenko/yet-another-react-lightbox) et [Uppy](https://github.com/transloadit/uppy). Leurs versions sont verrouillées dans ce dossier ; ce prototype permet d’évaluer leur assemblage avant tout raccord au produit.

Après validation de la direction visuelle, le [contrat de non-régression](../integration-audit/INTEGRATION.md) inventorie les options actuelles, les règles de raccord et les tests de base du produit. Il distingue les parcours déjà vérifiés des fonctions serveur encore nécessaires.
