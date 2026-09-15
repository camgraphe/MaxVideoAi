# Plan de l'essai animé — scène qui sort du cadre

**Objectif :** matérialiser la séquence discutée dans un aperçu 3D local, avec scroll réversible et lecture mobile. L'accord « ok » autorise cet essai, pas la livraison du site entier.

**Architecture :** document HTML autonome dans `review/motion.html`. Orchestration du mouvement isolée dans `review/motion/timeline.mjs`, construction de la scène dans `scene.mjs`, interface et cycle de rendu dans `main.mjs`. Three.js 0.183.2 déjà installé dans le checkout principal sera compilé pour l'aperçu ; aucune dépendance applicative modifiée.

**Spécification :** [direction-reorientation.md](direction-reorientation.md). Modèle 3D de travail distinct de la chaussure ImageGen, crédité Shopify / Khronos, CC BY 4.0. Géométrie et textures conservées ; une seule variante exportée pour réduire le poids. Aucun modèle 3D propriétaire prétendument généré à partir de la planche.

## Livrables et vérification

- [x] Préparer le modèle 3D et sa provenance. Prendre la variante Beach, retirer les deux variantes inutilisées sans réencoder les textures ; vérifier les buffers et leurs bornes. Préserver l'original hors du dossier livré et consigner les empreintes.
- [x] Construire ordinateur articulé, objet 3D, support et décor séparés, caméra et éclairage. `createScene(canvas, options)` retourne `load()`, `render(state)`, `resize(width,height,dpr)` et `dispose()`.
- [x] Écrire `sampleTimeline(progress, mobile)` : progression bornée, transforms reproductibles et rotation complète dans le dernier acte. Tester bornes, finitude, aller-retour déterministe et angle final sans dépendre du GPU.
- [x] Ajouter scroll natif, lecture automatique volontaire, pause, navigation par actes, contrôle de mouvement réduit, repli sans WebGL et aperçu mobile. Rendu à la demande, arrêt hors écran et onglet masqué, DPR borné.
- [x] Vérifier desktop et largeur mobile dans Chrome : poses, retour arrière, lecture, pause et mouvement réduit. Relever dimensions, poids statiques et échantillon de temps de frames. [Recette et limites](motion-validation.md) : aucune panne GPU forcée, aucun test sur téléphone physique ni gain Core Web Vitals du produit établi.
- [x] Relier la planche à l'essai et documenter les limites ; lot enregistré sur `codex/site-redesign`.

Un essai est jugé réussi si des objets réellement indépendants s'assemblent et que les autres faces de la chaussure deviennent visibles ; aucune fragmentation de photographie ne remplace cette preuve.

## Changement de méthode pendant cet essai

Adrien demande de terminer la scène puis de travailler dans les pages, avec des images correspondant aux emplacements des futurs effets. Voir [page-first-workflow.md](page-first-workflow.md). Cette priorité remplace la production d’autres essais isolés.
