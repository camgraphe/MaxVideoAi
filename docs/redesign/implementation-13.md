# Passe 13 — Composer l’accueil autour de quatre intentions

Retour d’Adrien : les corrections précédentes laissent une page déséquilibrée, redondante et trop textuelle. Explorer les modèles, choisir avec les scores et trouver un modèle par usage se concurrencent ; les outils ont perdu leurs vignettes. Cette passe reprend la composition dans le vrai site local, sur `codex/site-redesign`.

## 1. Inspirer — galerie conservée, catalogue déplacé

Les quatre créations restent dans leur disposition asymétrique. Le répertoire textuel ajouté en D65 est retiré de ce chapitre et intégré au choix des modèles. Les lecteurs, sources, posters et liens des quatre vidéos restent identiques.

## 2. Choisir — un seul chapitre illustré

« What do you want to create? » regroupe :

- Quatre usages avec leurs images existantes : cinéma, image-vers-vidéo, essais rapides, publicité produit. Liens et suggestions issus des données existantes, sans nouveaux classements inventés.
- Une comparaison compacte de Kling 3 Pro et Seedance 2.5 : tableau avec noms de colonnes et trois notes exactes sur 10, mention explicite d’évaluations éditoriales, lien vers la méthodologie et le comparatif complet. Les valeurs absentes ou invalides restent des tirets ; zéro est conservé.
- Six vignettes de familles, avec exemples et caractéristiques. Les noms de familles évitent d’attribuer un lien vers la version actuelle au nom d’une ancienne version représentée dans l’exemple.

Le titre abstrait « Choose with evidence » et le second grand titre « Find the right engine by use case » ne forment plus deux sections. Les badges et mini-logos des suggestions ont été retirés. Sur mobile, usages et familles sont des rangées défilantes avec une partie de la carte suivante visible, et des liens natifs accessibles au clavier.

Avant : [capture](review/direction-10/qa/pass-13-before-compare.png).
Après : [usages desktop](review/direction-10/qa/pass-13-choice-desktop.png), [familles desktop](review/direction-10/qa/pass-13-models-desktop.png), [comparatif mobile FR](review/direction-10/qa/pass-13-compare-mobile-fr.png).

## 3. Créer — app et vrais visuels des outils

L’app reste le seul grand chapitre sombre. Son titre précise le passage de l’idée à la vidéo ; vidéo, image et audio restent visibles.

Le bloc de huit liens génériques est remplacé par quatre cartes illustrées : Character Builder, Angle, AI Upscale, détourage. Les visuels sont réutilisés directement depuis `toolbox-art.ts`, propriétaire des vignettes du catalogue. Aucun visuel de remplacement généré ni fausse capture d’outil. Les images d’illustration sont identifiées comme telles.

[Outils desktop](review/direction-10/qa/pass-13-tools-desktop.png), [outils mobile FR](review/direction-10/qa/pass-13-tools-mobile-fr.png).

## 4. Comprendre — assistants, paiement, questions

La copie assistants est raccourcie autour d’une action concrète : transformer un projet discuté en vidéo, valider proposition/prix, retrouver le résultat. La démonstration interactive et ses étapes restent disponibles. Les références dans l’app et l’accès par assistant restent distincts.

La définition SEO et les trois modes de génération restent visibles avant la FAQ, mais dans une présentation simple, sans une nouvelle rangée de cartes et d’icônes colorées. Les tarifs restent sur fond clair.

## Cohérence visuelle

Ivoire pour l’inspiration et les outils, pierre pour le choix, charbon pour l’app. Hiérarchie des titres resserrée, petites icônes répétitives supprimées, images de résultats et vignettes réintroduites. Les dix marques du héros restent accessibles, sans Sora ; taille, espacement et traitement monochrome sont harmonisés à partir des assets existants. Ce n’est pas une recréation ni une certification de leurs identités graphiques.

## Vérifications et limites

- 35 tests ciblés passent : architecture home, contenu SEO, liens, confinement du contenu hors écran, lecteurs publics, comparaison et nouvelles responsabilités.
- TypeScript et lint ciblé passent ; `seo:check`, `i18n:check`, `lint:exposure` et `git diff --check` passent.
- Revue navigateur desktop EN et mobile 390 px FR/ES : visuels chargés, tableau sans débordement, chemins localisés.
- Les 39 destinations uniques du contenu principal relevées avant la passe restent accessibles après. Canonical et hreflang EN inchangés ; JSON-LD présent et syntaxiquement valide. Relevé dans `review/direction-10/qa/pass-13-links-seo.json`.
- Les contrôles sont locaux et ciblés. Pas de nouveau build de production ni de mesure comparable Core Web Vitals dans cette passe. Pas de conclusion sur les classements SEO, ni d’audit complet d’accessibilité.
- Les nouvelles images sont hors héros, dimensionnées et chargées paresseusement ; aucun lecteur vidéo supplémentaire. Le média critique du héros reste inchangé.
- Aucun push, merge ou déploiement. La galerie locale reste raccordée au snapshot public isolé.
