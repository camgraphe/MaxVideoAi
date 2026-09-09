# Revue visuelle V1

Après retour d'Adrien, commencer par [la nouvelle intention illustrée](direction.html). La montre et le découpage rectangulaire ne sont plus la direction proposée. Le document ci-dessous décrit la première revue et ses limites historiques. La planche ImageGen, son prompt et sa provenance sont documentés dans [direction-reorientation.md](../direction-reorientation.md).

Support de décision autonome, sans connexion aux API du produit. Entrée : [index.html](index.html). Les styles et interactions sont propres à la revue ; ce n'est pas le futur composant d'accueil.

Depuis la racine du worktree, servir les fichiers localement :

```bash
python3 -m http.server 8775 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8775/docs/redesign/review/index.html`. Les médias sont référencés depuis `frontend/public` ; conserver la structure du dépôt. Le port peut être changé s'il est occupé. Ne pas publier la racine du dépôt sur un hébergement public.

## Ce qu'on peut juger

- La hiérarchie de sept moments sur l'accueil, notamment le MCP avant le catalogue.
- Une étude de décomposition/recomposition d'une image avec commande clavier/tactile. Le mouvement lié au scroll reste à prototyper dans le gabarit intégré.
- Trois états MCP : contexte, proposition/devis, résultat. Les textes ne représentent pas un transcript réel.
- Six références précises, leur adaptation, leur repli mobile et le niveau de vérification effectivement atteint.
- Un lecteur en fenêtre et une étude des états d'action. Les délais et erreurs de ce bouton sont explicitement simulés, sans requête.
- Une lecture responsive à 390 px via le bouton Vue mobile. Cette largeur ne simule ni Safari, ni un appareil physique, ni un réseau lent.

## Provenance des médias

La montre vient des fichiers publics existants `media/mcp/project-demo/watch-static.webp`, `watch-wan-3-prime-poster.webp` et `watch-wan-3-prime-scroll.mp4`. Source : [fiche du 5 septembre, mise à jour le 6](../../marketing/2026-09-05-mcp-project-demo.md). Image ImageGen ; vidéo Wan 3 Prime retenue par Adrien. Aucune nouvelle génération ni dépense. Les illustrations abstraites `reference-workflow-*` ont également été vues : elles ne sont pas des preuves photographiques de transformation et ne sont pas réutilisées comme telles.

Le nouveau sujet proposé (objet cinétique verre/métal) est un brief artistique, pas un résultat déjà produit. Aucun asset de la montre ne devient automatiquement un hero approuvé pour la refonte.

Les marques OpenAI et Claude proviennent des SVG existants. Le signe OpenAI avec libellé Codex reprend une convention du site ; une marque spécifique Codex reste à vérifier avant publication.

Les six petits schémas des références ont été dessinés en HTML/CSS pour expliquer nos adaptations. Ils ne reproduisent pas les screenshots ni le code de ces bibliothèques.

## Vérification

Le compte rendu de recette de cette revue se trouve dans [review-validation.md](../review-validation.md). Cette recette porte sur le support de conception ; elle ne mesure aucune amélioration de performance du site public.
