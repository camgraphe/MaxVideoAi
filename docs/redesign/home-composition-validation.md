# Recette — accueil, composition 01

9 septembre 2026. Périmètre : les trois aperçus HTML sous `docs/redesign/review`, leurs styles, interactions et documentation. Aucun fichier de production modifié.

## Contrôles exécutés

| Contrôle | Résultat |
|---|---|
| Génération `node docs/redesign/review/home/build.mjs` | Trois pages produites depuis le même propriétaire de contenu |
| `node --check` sur les trois modules `.mjs` | Réussi |
| Analyse HTML ponctuelle des trois pages | Un H1, huit FAQ, IDs uniques, ancres résolues, images avec alt/dimensions, fichiers locaux images/styles/scripts/police présents |
| Modèles et liens | Slugs reliés au registre publié, familles et destinations localisées vérifiées depuis le code. Correction de la galerie MiniMax vers `hailuo` |
| `npm run lint:exposure` | Réussi |
| `git diff --check` | Réussi |
| Chrome, desktop 1700 px | Ouverture FR/EN/es LATAM examinée ; workflow et galerie FR examinés ; largeur DOM et largeur défilable identiques sur les ouvertures contrôlées |
| Sélecteur de modèles | Passage à Seedance puis Kling : image, texte, mode/durée et destinations changent. Liens Kling relus dans le DOM |
| FAQ | Ouverture de la réponse sur le coût ; contenu visible et un `details[open]` constaté |
| Annotations | Cinq notes visibles après activation, état `aria-pressed` mis à jour, retour au mode sans notes |
| Langues | Navigation FR → es → EN → FR via le sélecteur ; `lang="es-419"` constaté |
| Aperçu mobile | Ouverture/fermeture, largeur 320/390, raccourcis de sections. Ouvertures FR/EN/es examinées à 320 px ; FR à 390 px. Workflow es à 320 px et FR à 390 px ; prix FR à 390 px |

Corrections issues de l'examen visuel : position du plan envisagé pour dégager le prix à valider dans la fenêtre assistant ; composition mobile plus haute pour séparer les étapes ; taille du titre réduite sur les plus petits écrans afin de garder les titres anglais/espagnol sur deux lignes ; signes de modèles remplacés par leurs marques compactes existantes ; description alternative du poster Seedance précisée après examen.

## Captures locales

Captures de contrôle conservées hors versionnement dans le checkout principal, sous `output/redesign-review-2026-09-09/` :

- `home-desktop-hero.png`
- `home-desktop-workflow.png`
- `home-desktop-images.png`
- `home-mobile-390.png`
- `home-mobile-workflow-390.png`
- `home-es-mobile-320.png`

Ces fichiers sont des preuves locales de la composition ; ils ne sont pas livrés automatiquement avec le worktree ou la branche.

## Limites de cette recette

L'iframe est une vérification de mise en page, pas une émulation matérielle. Menu tactile, Safari iOS, appareils physiques, lecteurs d'écran, réseau contraint et performance terrain restent à recetter lors de l'intégration. La largeur 768 px est proposée par l'outil de revue mais n'a pas fait l'objet d'une recette complète. L'absence de débordement sur mobile a été examinée visuellement, pas mesurée dans chaque document enfant.

Le script d'interaction fait environ 3 Ko et les styles 28 Ko avant compression ; ces tailles de fichiers ne sont pas une mesure de chargement de page. Les images, la police et le réseau contribuent aussi au coût. Aucun test Core Web Vitals, gain SEO ou conversion n'est revendiqué. La page ne contient ni vidéo ni canvas ; la performance du futur effet n'est donc pas validée.

Les destinations ont été rapprochées du code et des slugs connus ; aucun crawl HTTP exhaustif des liens externes. Le contenu éditorial et le choix des médias restent proposés. Les règles canonical/hreflang/JSON-LD, les vrais lecteurs, les prix calculés et les événements analytiques seront vérifiés dans le lot d'intégration. Aucun build Next.js ni test d'authentification exécuté pour ce support documentaire autonome.
