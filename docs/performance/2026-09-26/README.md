# Référence Google — 26 septembre 2026

Les fichiers [JSON](crux-history.json) et [CSV](crux-history.csv) conservent les 12 dernières fenêtres parmi les 40 consultées dans [CrUX Vis](https://cruxvis.withgoogle.com/). Extraction des libellés accessibles des graphiques, avec la précision affichée par Google ; ce ne sont pas des réponses JSON brutes de l'API. Chaque point couvre 28 jours, avec un décalage d'une semaine. Les fenêtres se recouvrent.

## Dernière fenêtre historique : 23 août – 19 septembre

| Périmètre | Appareil | LCP p75 | INP p75 | CLS p75 | TTFB p75 |
|---|---|---:|---:|---:|---:|
| Domaine | Mobile | 3 001 ms | 227 ms | 0,06 | 868 ms |
| Domaine | Desktop | 2 488 ms | 75 ms | 0,03 | 759 ms |
| Accueil seulement | Mobile | 2 880 ms | 260 ms | 0,06 | 742 ms |
| Accueil seulement | Desktop | 1 921 ms | 86 ms | 0,03 | 389 ms |

La période quotidienne PSI consultée le même jour est plus récente : ses valeurs ne doivent pas remplacer ou contredire artificiellement cette série historique. Un desktop global à 2 488 ms est juste sous le seuil LCP de 2 500 ms dans cette fenêtre ; ce n'est pas une marge confortable, ni la preuve que la période quotidienne suivante passe.

Le LCP desktop du domaine passe de 2 051 ms (fin 29 août) à 2 488 ms (fin 19 septembre), tandis que celui de l'accueil reste autour de 1 950 ms. Cela justifie un diagnostic sur plusieurs familles de pages. Cette comparaison de p75 ne permet pas de calculer le LCP des pages hors accueil par soustraction.

## Phases du LCP image

Sur la dernière fenêtre desktop du domaine, les p75 image sont : TTFB 883 ms, attente avant chargement 1 489 ms, transfert 312 ms et délai de rendu 231 ms. Sur mobile : 880 / 1 380 / 324 / 559 ms. Ce sont des p75 indépendants d'un sous-ensemble de visites : ne pas les additionner, ni les assimiler au LCP global.

La part LCP « image » du domaine est de 74,7 % sur desktop et 48,2 % sur mobile. Le reste est classé texte par CrUX. Les données orientent donc aussi vers le serveur, la découverte des ressources, le CSS et le rendu du texte ; elles ne justifient pas de ne travailler que sur la compression des images.

Les sous-parties image n'utilisent pas exactement la même population que le type de ressource LCP, qui peut inclure les premières images vidéo. Les valeurs manquantes sont conservées comme null/vides, jamais remplacées par zéro.

## Couverture

[La matrice](../../../scripts/performance/site-matrix.json) définit 33 URL publiques dans onze familles, EN/FR/ES. [Le contrôle HTTP](http-matrix.json) confirme leur statut 200 et leur canonical au moment de la lecture. Trois URL d'index d'intégrations testées renvoyaient 404 : elles ont été écartées de la matrice de performance active, sans conclusion sur une régression.

Un GET par page et ses temps réseau locaux ne sont ni une mesure navigateur, ni des Core Web Vitals, ni un p75. Ce contrôle sert seulement à éviter d'auditer une mauvaise URL.

CrUX Vis a proposé uniquement l'origine après la recherche URL de `/docs/mcp`. PSI montrait également un repli origine pour la documentation, le comparatif et l'outil Character testés. Aucun chiffre individuel n'est inventé pour ces pages. La couverture URL exhaustive n'a pas été extraite par API : aucune clé CrUX n'était configurée dans l'environnement de cette session ; la découverte du connecteur Windsor a aussi échoué.

## Reproduction

Voir [le protocole CWV](../../engineering/core-web-vitals.md). L'exporteur API conserve séparément les requêtes d'origine et d'URL, les fenêtres quotidiennes/historiques, l'appareil et les absences de données. Il garde les réponses Google brutes lorsqu'un accès API est configuré.

Sources de méthode : [API CrUX](https://developer.chrome.com/docs/crux/api), [API historique](https://developer.chrome.com/docs/crux/history-api), [critères CrUX](https://developer.chrome.com/docs/crux/methodology).

