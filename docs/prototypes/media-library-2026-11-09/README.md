# Bibliothèque et références — proposition interactive

> **Itération V2 en cours.** Lire [REPRISE.md](REPRISE.md) avant de continuer. Les résultats complets sur `70463ad1` décrivent la V1, pas les derniers ajouts de mosaïque, liste et identification sans noms fiables.

Prototype jetable, sans modification applicative. Branche `codex/media-library-design`, basée sur le `main` vérifié le 9 novembre 2026 (`b08af8a3f`). La PR 638 reste sous la responsabilité du chat de livraison. Aucun déploiement ni fusion n’est prévu ici.

## Ouvrir

Depuis la racine du checkout isolé :

```sh
pnpm install --frozen-lockfile
node docs/prototypes/media-library-2026-11-09/server.mjs
```

Ouvrir <http://127.0.0.1:4176/>. Le serveur écoute exclusivement sur l’interface locale. Il accepte seulement GET/HEAD et ne connaît aucune API de production. Les données, imports, collections et actions groupées sont fictifs et remis à zéro au rechargement. Les médias de démonstration viennent des ressources publiques existantes du dépôt. La lecture audio/vidéo est manuelle ; les téléchargements et passages aux outils sont explicitement simulés.

Le menu **Scénarios** permet de tester les états normal, vide, chargement, erreur, échec partiel et 10 000 médias. Le parcours **Créer → Choisir une référence → Choisir depuis les médias** ouvre le sélecteur. Le même accès est proposé dans Scénarios sur mobile, puisque le shell mobile complet n’appartient pas à cette exploration.

Liens de test : `/?picker=1`, `/?state=error`, `/?count=10000&loaded=all&collections=1000`. Le gros volume est un jeu de données en mémoire pour éprouver le rendu virtualisé ; il ne mesure pas les requêtes SQL, la pagination réseau, les accès signés ni les performances de production.

## Diagnostic du code actuel

Le navigateur actuel (`CompactLibraryBrowser.client.tsx`) utilise déjà React Aria et une grille virtualisée. Il ne faut pas remplacer cette infrastructure. Les principaux problèmes sont la hiérarchie et la présentation :

1. `CompactLibraryCollections` réunit navigation, création, renommage et suppression dans le même panneau permanent sur desktop. Sur mobile, ce panneau passe devant les médias lorsqu’il est ouvert.
2. Les contrôles de sélection et les opérations groupées sont rendus même sans sélection sur desktop. Les commandes inactives ajoutent une bande entière et consomment l’attention.
3. Les types sont dans l’en-tête, les filtres dans une autre zone, les collections dans un panneau et les outils à un autre niveau. Les chevrons de contrôle sont hétérogènes.
4. La taille de certaines commandes provient des minimums 30/36/40 px ; les cases visibles font 18 px. Leur confort tactile doit être vérifié sur les zones réellement activables, pas déduit du seul dessin.
5. La capture fournie `01-create-picker-before.jpg` montre aussi le coût du panier vertical et de ses récapitulatifs répétés. Cette image précède la PR 638 ; elle ne prouve pas son état final.

La référence visuelle générée par `baseline.ts` monte les vrais composants du main avec des frontières d’accès et de données fictives. Elle permet une comparaison de présentation, pas un audit d’un compte de production. Le cadre de page est un harnais minimal : comparer les dimensions du navigateur interne, pas prétendre mesurer un gain de Core Web Vitals ou de shell.

## Direction retenue

- Conserver les couleurs crème/vert sombre/bronze des tokens actuels et une typographie calme.
- Donner toute la largeur aux médias par défaut. Un seul déclencheur indique l’emplacement courant et ouvre Tous les médias, Favoris, Corbeille et collections recherchables.
- Distinguer le choix d’une collection de sa gestion. Le menu « Gérer » ouvre une fiche dédiée ; supprimer une collection conserve ses médias.
- Garder la recherche visible. Provenance et état d’enregistrement restent dans Filtres, avec des puces visibles quand ils sont actifs. Trier et Affichage ont chacun un contrôle nommé.
- Faire apparaître les actions groupées après sélection. Les commandes sélectionner les médias chargés / tous les résultats restent accessibles dans Plus d’options.
- Sur desktop, réunir emplacement, types et import sur une même ligne. Conserver les onglets sur leur propre ligne lorsque la largeur manque. Densité initiale 128 px sur desktop, 136 px sur mobile ; le curseur garde toute la plage actuelle 88–184 px par pas de 8.
- Afficher les médias entiers avec `object-fit: contain`, une géométrie fixe, des miniatures paresseuses et aucun lecteur vidéo dans la grille. Le prototype contient de vrais posters publics 16:9 et 9:16.
- Dans le sélecteur : vignette = ajout direct, aperçu = bouton distinct, cases = panier ordonné à confirmer. Le panier compact devient détaillé à la demande. Le remplacement reste limité à l’emplacement occupé.
- Préserver les références sélectionnées au changement de filtre dans le sélecteur ; conserver l’effacement annoncé de la sélection de gestion lorsque son périmètre change.

Le prototype réutilise une copie isolée de la grille du candidat 638 (`449014a5`) afin de montrer ses interactions sans réimplémenter ni modifier son correctif dans le produit. Après la fusion de 638, une éventuelle intégration doit revenir à la grille partagée du dernier main.

La recherche de collections parmi 1 000 entrées est locale dans la démo. Le GET actuel `/api/media-library/collections` prend `limit` et `cursor`, sans recherche globale. L’intégration devra définir une recherche serveur paginée, ou annoncer clairement une recherche limitée aux collections déjà chargées ; ne pas charger arbitrairement toutes les collections du compte pour reproduire le prototype.

## Parité et responsabilités pour une intégration

| Option | Présentation proposée | Contrat à conserver |
| --- | --- | --- |
| Tout / images / vidéos / audio | Onglets visibles | `LibraryBrowseScope.kind`, audio en liste |
| Imports / générations / Storyboard / Character / Angle / Upscale | Filtre Provenance | Taxonomie et recherche serveur existantes |
| Enregistrés / rendus récents | Filtre État d’enregistrement | Sources et curseurs existants |
| Recherche / tri / densité | Barre principale et Affichage | Recherche serveur, curseurs, persistance utilisateur |
| Tous / favoris / corbeille / collections | Menu d’emplacement | Comptes isolés, collections paginées |
| Créer / renommer / supprimer une collection | Fiche de gestion | API existante, longueur 120 caractères, aucun média supprimé |
| Favori / retirer favori / ajouter / retirer collection / corbeille / restaurer | Barre contextuelle | Canonical refs, source revision, confirmations partielles, reprise |
| Sélection chargée / tous les résultats | Plus d’options | Snapshot serveur borné à 10 000, expiration et exclusions |
| Aperçu / suivant / précédent | Visionneuse | Original exact, access signé, lecture progressive et focus existants |
| Télécharger / ouvrir la source / continuer vers les outils | Visionneuse | Destination exacte et média original, aucun lien dérivé substitué |
| Clic direct / cases / aperçu / lot ordonné | Sélecteur commun | Validation propriétaire et capacités livrées par 638 |
| Character Studio | Accès visible dans le sélecteur + outils | Ne pas confondre personnages structurés et médias Character |
| Erreur / chargement / vide / échec partiel | Scénarios interactifs | Conserver sélection et résultats confirmés réels |

## Vérifications

Les parcours navigateur sont dans `verify.browser.ts` et le workflow manuel/PR **Media design prototype**. Ils s’exécutent seulement en CI hébergée. Aucun navigateur Playwright local ne doit être lancé pour cette tâche. Les vérifications interactives locales passent par le navigateur interne Codex.

Le script produit des captures ordonnées, un comparatif avec le composant actuel, les dimensions de grille, le nombre de cartes dans le DOM, le débordement horizontal et les petites cibles visibles. Il parcourt desktop 1440 px, mobile 390/320 px, collections, filtres, sélection groupée, aperçu, panier, changement d’ordre et remplacement ciblé. Il éprouve aussi les états dégradés et 10 000 médias/1 000 collections.

Les statuts réels et les limites de vérification doivent être consignés dans le rapport d’évidence avant toute affirmation de réussite. Ce prototype français ne certifie ni la parité EN/ES, ni l’authentification, ni les erreurs réseau réelles, ni le lecteur de production, ni les performances de terrain. Ces contrôles restent nécessaires à l’intégration.

## Dépendances et licences

Aucune nouvelle dépendance. React Aria Components 1.22.1 (Apache-2.0) et Lucide React 0.553.0 (ISC) sont déjà verrouillés dans le projet. Les fichiers de licence installés sont conservés. La séparation des actions et de la sélection suit les capacités documentées de [GridList](https://react-aria.adobe.com/GridList), et la virtualisation reste celle de [Virtualizer](https://react-aria.adobe.com/Virtualizer). [Licence Lucide](https://github.com/lucide-icons/lucide/blob/main/LICENSE).
