# Character Studio — marketing et continuité SEO

Refonte sur `codex/character-studio-v2`, à relire dans la preview avant toute exposition en production.

## Direction appliquée

Le premier écran montre trois vrais personnages, avec un CTA de création et un accès au parcours. Les sections montrent ensuite l’identité de Dixie et son nouveau look, un portrait et la planche huit vues entière, puis Recast. La création est expliquée en trois étapes, pas dans des panneaux de fonctionnalités. Les exemples sont des résultats existants ; aucune nouvelle génération payante n’a été lancée.

Le nom Character Studio est cohérent dans la navigation, le footer, les liens d’accueil et Tools. La FAQ explique la transition depuis Character Builder et distingue Character Studio de l’espace Studio. Les grands ateliers arrivent avant les outils rapides et les opérations spécialisées, dans le hub public et le catalogue applicatif. Character Studio reste le premier atelier. Les destinations, les filtres et les autres outils sont conservés.

Les phrases expliquent ce qui entre, ce qui sort, et ce qui doit être vérifié. Recast est une génération vidéo guidée par des références, sans promesse de remplacement parfaitement fidèle. Le prix est celui du devis actuel de l’application : aucun ancien montant débité ni la future marge ×2 ne sert de tarif marketing.

## État SEO établi avec Outreach

À la demande d’Adrien, le chat Outreach « Prioriser les pages à retravailler » a réalisé le cadrage en lecture seule. Dossier de référence local : `/Users/adrienmillot/Documents/ChatGPT/OUTREACH/sources/2026-11-05/character-studio-marketing-seo/README.md`. Les fichiers `public-html.json`, `evidence.json`, `sitemaps.json` et `verification.json` dans ce dossier documentent les preuves et leur collecte.

Extraits utiles des fenêtres GSC Web comparables de 28 jours **05/09–02/10 → 03–30/10/2026**, tous pays et appareils, sur URL exacte :

| Page | Clics avant → après | Impressions avant → après |
| --- | ---: | ---: |
| Outil EN | 1 → 5 | 84 → 210 |
| Guide de cohérence EN | 0 → 1 | 217 → 1 682 |
| Guide de fiche personnage ES | 16 → 12 | 528 → 644 |

Ce sont des lignes de pages, pas un total du site. Les volumes sont faibles ; les fenêtres de 7 et 92 jours dans le dossier se chevauchent et ne s’additionnent pas. Une absence de ligne sur « AI influencer » ou « Recast » ne prouve pas une absence de demande. Les guides de méthode, particulièrement ES, sont conservés avec leurs liens vers l’outil.

Garde-fous appliqués :

- Mêmes URL EN, FR et ES, mêmes titres et descriptions SEO, mêmes canoniques et alternates. Le relevé public avant changement est conservé dans [seo-before.json](seo-before.json).
- H1 et introduction gardent la promesse de personnages IA cohérents. Nom visible actualisé, pas de nouvelle landing concurrente « character-studio » ou « recast ».
- Guides de cohérence et de fiche personnage toujours liés en HTML. Huit liens de guides FR/ES pointent maintenant directement vers `/fr/outils/character-builder` et `/es/herramientas/character-builder`, sans détour 307. Les redirections existantes ne changent pas.
- FAQ et étapes visibles restent la source des données structurées. Aucune offre, note, économie ou garantie d’identité inventée.
- `llms.txt` renvoie aux pages publiques outil, hub et guides. Aucun changement des règles robots, des routes privées, de l’indexation applicative ou des sitemaps.

Les recommandations [Google pour les fonctions IA](https://developers.google.com/search/docs/appearance/ai-features), relues le 05/11/2026, restent celles du SEO : contenu utile accessible en texte, maillage et données structurées fidèles. `llms.txt` est un complément documentaire, pas une garantie de citation. Les [recommandations vidéo](https://developers.google.com/search/docs/appearance/video) distinguent une page outil illustrée d’une page de lecture dédiée ; aucune promesse de résultat vidéo enrichi n’est faite ici.

## Médias et activation des vidéos

[images.json](images.json) relie les six copies WebP aux fichiers source et à leurs empreintes. Les nouveaux visuels totalisent environ 275 Ko avant optimisation responsive. La planche publique historique huit vues reste affichée entière (`object-fit: contain`), sans la confondre avec le prototype de mise en page Vesper, qui n’est pas un export automatique.

Le lecteur est raccordé à la playlist publique **`character-studio-recast`**, avec les deux identités de résultats relues côté serveur. Cette playlist doit utiliser l’adhésion directe `playlist_items` ; le moteur de curation automatique n’a pas de groupe d’alias pour ce slug. Les copies doivent être préparées et rendues publiques dans la bibliothèque marketing, conformément à `docs/engineering/marketing-media.md`. L’adhésion assure également le contrôle de suppression. Ne jamais remplacer ce chemin par un lien de job personnel.

La publication a été débloquée le 05/11 après autorisation explicite d’Adrien de donner le rôle administrateur au compte Camgraphe **dans la base de test uniquement**. Les copies indépendantes de Dixie et Vesper sont publiques dans la playlist de la preview. Vesper utilise la livraison avec musique et sans voix off ; les médias personnels et la production restent séparés. Les deux lecteurs ont été vérifiés en lecture, recherche temporelle et audio, sur ordinateur et mobile. Les cartes conservent une image de secours si le catalogue facultatif est indisponible.

Le CTA Recast rejoint directement l’onglet correspondant dans l’application, avec le brouillon personnage conservé et sans génération automatique. L’extension à l’accueil, à Explorer et la seconde revue de parcours sont documentées dans [phase-2-audit.md](phase-2-audit.md).

## Vérification et limites

Tests de comportement EN/FR/ES : un H1, mêmes intentions/canoniques/alternates, étapes liées au HowTo, FAQ affichée conforme, guides et CTA présents, une seule image prioritaire, planche non recadrée, images explicitement désignées tant que les films ne sont pas publics. Test du catalogue : Character Studio avant les outils rapides, filtres conservés. Test du lecteur de données : pas de DB → aucune requête ; privé, non relu ou URL personnelle → aucune vidéo ; erreur ou délai catalogue → images de secours. Le délai facultatif est borné à 1,5 seconde sans neutraliser le timeout DB existant.

Les contrôles HTTP locaux des six routes complètent ces tests. La disponibilité des médias et les métadonnées ne prouvent pas la qualité visuelle ou les Core Web Vitals. L’accès navigateur a été rétabli et la première publication a été contrôlée sur ordinateur et mobile : lecture, seeking, audio, absence de requête vidéo avant Play. Ces vérifications fonctionnelles ne constituent pas une mesure de Core Web Vitals. Aucun gain de performance ou de classement n’est revendiqué.

Après exposition réelle : dater le SHA et le HTML servi, puis le recrawl Google ; contrôler les accès à J+7 et comparer 28 jours complets finalisés, à périmètre identique, avec les guides séparés. Ne pas réinitialiser l’expérience existante sur le guide EN ni additionner Web et Google IA.
