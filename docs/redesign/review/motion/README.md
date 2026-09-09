# Essai local de mouvement

Entrée : [../motion.html](../motion.html). Serveur HTTP local depuis la racine du worktree, port 8775. Activer « Explorer la scène », défiler dans les deux sens ou lancer la lecture de 15,5 secondes. Les actes permettent d'examiner les poses ; « Vue mobile » ouvre la même scène dans une iframe de 390 px.

Cet essai termine une exploration autorisée. La méthode suivante est [page-first-workflow.md](../../page-first-workflow.md) : pages complètes et images d'attente, puis choix des emplacements avant fabrication des effets.

## Sources et limites

- `scene.mjs` : ordinateur, volumes indépendants, éclairage, caméra, ressource GPU et libération.
- `timeline.mjs` : état déterministe du scroll. Tour complet de l'objet au dernier acte ; déplacement de caméra limité, ce n'est pas un tour complet de caméra.
- `main.mjs` : défilement natif, lecture volontaire, pause, poses en mouvement réduit, contrôle mobile et relevés. Aucun moteur vidéo ou MCP appelé.
- `entry.mjs` : chargement différé du runtime après activation ; l'ouverture volontaire de la vue mobile active son instance.
- `runtime.js` : bundle généré incluant Three.js **0.183.2**, licence MIT dans `assets/THREE-LICENSE.txt`. Aucune dépendance applicative modifiée.
- `assets/shoe-beach.glb` : modèle de travail **© Shopify 2021**, CC BY 4.0. Variante Beach du modèle Materials Variants Shoe ; provenance et empreintes dans `shoe-provenance.json`, licence dans `SHOE-LICENSE.md`. Deux variantes inutilisées retirées ; géométrie et textures retenues inchangées. La licence des contenus n'accorde pas de droits sur d'éventuelles marques présentes.
- Planche ImageGen de 2,22 Mo utilisée comme intention avant activation. Modèle GLB : 5 375 032 octets. Bundle : environ 610 Ko non compressés. Ces poids nécessitent une préparation média avant toute utilisation publique.

La chaussure de travail diffère de celle de la planche. Rendu WebGL de prévisualisation avec éclairage simple, distinct du niveau de finition des images d'intention. Pas de reconstruction 3D annoncée comme capacité du MCP, pas de fausse preuve de moteur vidéo. Les pages applicatives, lecteurs médias, URLs et scripts de mesure restent inchangés.

Le canvas se redessine pendant le déplacement ou la lecture et s'arrête au repos. Résolution plafonnée à DPR 1,5 desktop / 1,25 mobile. Le mouvement réduit présente des poses fixes. Le texte et le parcours restent accessibles sans activer WebGL. Les mesures du panneau sont locales : soumission CPU et intervalles RAF actifs, pas un benchmark GPU, une mesure réseau froide ni des Core Web Vitals.

## Recompilation

Depuis la racine du worktree, avec un checkout où les dépendances sont déjà installées :

```sh
node docs/redesign/review/motion/build.mjs '/Users/adrienmillot/Desktop/MaxVideoAi V2'
node --test docs/redesign/review/motion/timeline.test.mjs
git diff --check
```

Le premier argument désigne le checkout fournissant esbuild et Three.js. Le bundle de l'aperçu est versionné pour permettre sa consultation via le serveur statique sans installation dans ce worktree. Node local 23.9.0 ; cette vérification documentaire ne remplace pas la recette du produit sous Node 22.x.
