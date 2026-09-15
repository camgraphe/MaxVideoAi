# Recette de l'essai de mouvement

9 septembre 2026. Périmètre : `review/motion.html` et sa scène autonome. Chrome local, desktop 1700 × 1078 et iframe 390 px. Aucun changement de page applicative.

## Contrôles réalisés

- Ouverture de l'aperçu, activation et chargement du GLB ; scène rendue sans erreur bloquante observée.
- Examen visuel de la composition finale sur desktop ; correction du cadrage pour laisser les commandes lisibles.
- Examen de l'émergence et de la composition finale à 390 px ; commandes et légendes visibles. Retour de l'orbite à l'émergence depuis les commandes de l'aperçu mobile.
- Parcours par actes dans les deux sens, lecture automatique activée puis pause observée à 60 %. Navigation au clavier PageDown : progression et changement d'acte observés.
- Mouvement réduit activé : pose Assemblage à 65 %, lecture automatique désactivée, libellé « poses fixes » et état pressé corrects.
- Fermeture du dialogue mobile par Échap.
- Largeur desktop du document 1700 px et scrollWidth 1700 px : pas de débordement horizontal dans cet état.
- Les quatre tests du timeline passent : entrées invalides/bornes, aller-retour reproductible, rotation complète, maintien du récit mobile. Le GLB a un seul matériau et trois images ; bornes des sept bufferViews et empreinte SHA-256 contrôlées.
- Bundle recompilé à partir des sources et de Three.js 0.183.2 installé ; `git diff --check` exécuté.

## Relevé local indicatif

Dernier échantillon après recompilation et parcours au clavier : activation 392 ms ; canvas 2550 × 1617, DPR 1,5 ; 194 rendus enregistrés ; 17 appels de dessin et 28 958 triangles dans l'état lu ; soumission CPU p95 2,7 ms, intervalle RAF entre frames actives p95 9,3 ms. Les pauses entre sessions de rendu ne sont pas des frames ; les intervalles d'une session ne sont pas filtrés selon leur durée. Ces valeurs dépendent du poste et de son état local. Aucun gain sur le site public n'est établi.

GLB : 5 375 032 octets, runtime environ 610 Ko, planche 2 220 224 octets. Le runtime et le modèle ne sont demandés qu'après activation (ou ouverture volontaire de la vue mobile). Ce sont des poids de prototype, pas un budget accepté pour une page publique.

## Limites explicites

- La vue étroite est une iframe, pas un test Safari/iPhone/Android physique ni un réseau mobile froid. Gestes tactiles et gestion du GPU sur appareils restent à recetter si la section est retenue.
- L'arrêt au repos, l'onglet masqué, la fermeture de l'iframe et la libération sont prévus dans le code. Cette session n'est pas une capture de profiler ni une mesure de consommation GPU.
- Le parcours textuel existe sans activation de la scène. Les branches d'échec de chargement et de perte WebGL sont implémentées ; aucune panne GPU forcée n'a été injectée dans cette recette.
- L'objet a une vraie géométrie et révèle ses faces ; les décors et l'éclairage gardent la finition d'un essai. Ce rendu ne remplace pas une direction artistique finale et ne prétend pas égaler la planche ImageGen.
- Aucun audit SEO, build Next.js complet, script Analytics/Clarity ou lecteur de production modifié dans ce lot. Le choix d'intégration reste ouvert.

Captures locales de contrôle, non versionnées : `output/redesign-review-2026-09-09/motion-desktop-final.png`, `motion-mobile-final.png` et `motion-mobile-emergence.png` dans le checkout principal.

## Suite retenue

Construire la première page complète avec contenu produit et images d'attente pertinentes, puis choisir les emplacements d'effets à produire. Voir [page-first-workflow.md](page-first-workflow.md). L'essai animé est terminé comme référence de mouvement ; ni la chaussure, ni la palette, ni son emplacement ne sont validés pour le site.
