# Recette du support de revue V1

9 septembre 2026. Périmètre : `docs/redesign/review/` uniquement. Base de conception sur `codex/site-redesign`. Aucun composant applicatif, tag analytics, tarif, route publique ou média source modifié.

## Contrôles réalisés

| Contrôle | Résultat / portée |
|---|---|
| `node --check docs/redesign/review/review.js` | Syntaxe valide |
| `git diff --check` | Aucun défaut d'espacement signalé |
| Résolution des `src` / `href` locaux du HTML | Fichiers présents, y compris vidéo, posters et SVG |
| Chargement dans Chrome | Page, sept moments, six références et contrats de détail présents dans le DOM |
| Ouverture de la vidéo | Fenêtre ouverte, focus sur Fermer, vidéo en pause, preload none |
| Fermeture Échap | Fenêtre fermée, retour au bouton d'ouverture, vidéo en pause |
| Étape MCP « choix & devis » | Titre et explication mis à jour, choix signalé |
| Curseur de décomposition | Clavier End → 100 %, Home → début, PageUp → progression ; libellés cohérents |
| Bouton d'étude | Attente avec bouton désactivé, erreur, nouvel essai et succès observés ; aucune action produit |
| Composition desktop | Screenshot examiné ; médias lisibles et composition ouverte |
| Aperçu à 390 px | Screenshot de l'iframe examiné ; espacement initial du hero corrigé après observation |

## Limites de cette recette

- L'aperçu de largeur mobile est une iframe dans Chrome desktop. Pas de test iPhone/Android physique, Safari ou réseau limité.
- La préférence de mouvement réduit possède un repli CSS, mais son activation système n'a pas été testée dans ce cycle.
- Le lecteur affiche le média existant. L'essai a porté sur ouverture, fermeture, focus et état en pause ; la séquence vidéo elle-même garde sa preuve historique du 6 septembre.
- Les six références ont des niveaux différents : source/documentation, rendu desktop, interaction essayée, ou démo bloquée. La planche les distingue explicitement. Ce n'est pas une validation de leur accessibilité ou de leur coût.
- Pas de build applicatif, de test de parcours authentifié ni de comparaison Core Web Vitals pour ce lot documentaire. Les 13 tests du cadrage initial ne sont pas revendiqués comme une nouvelle recette d'application.
- Les liens Markdown sont des documents de travail servis par le serveur local ; leur présentation dépend du lecteur utilisé.

Screenshots locaux, hors versionnement : `output/redesign-review-2026-09-09/` dans le checkout principal. La revue versionnée et ses médias référencés restent la source disponible dans le worktree.
