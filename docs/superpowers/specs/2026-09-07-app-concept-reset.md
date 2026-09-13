# MaxVideoAI — changement de concept

## Retour qui fait autorité

**Dernier retour — direction globale retenue.** L’utilisateur apprécie le nouveau prototype et accepte cette direction visuelle. Il exige que le choix de plusieurs modèles et le prix avant génération occupent une place centrale, dans l’esprit MaxVideoAI. Il demande de continuer à apporter des idées et à améliorer le produit pendant sa construction, tout en conservant les fonctions importantes de l’ancienne version. Cette acceptation concerne la direction ; elle ne transforme pas les actions simulées en fonctions intégrées.

Le premier lot améliore des fonctions, mais garde le concept de l’ancienne interface : formulaire central, iconographie jugée cheap, types de boutons et espacements trop familiers. Il n’est pas accepté comme refonte visuelle. La prochaine proposition doit changer le modèle de travail et le langage visuel avant sa généralisation.

## Clarification de périmètre — toute l’application

La dernière planche concernait surtout le Studio/canevas. Elle ne définit pas la refonte globale demandée. L’utilisateur attend une nouvelle expérience sur la création vidéo/image/audio, la bibliothèque, les outils, les paramètres et la navigation. Le Studio doit reprendre cette identité avec ses interactions propres ; l’app générale ne devient pas un canevas.

Le plan actif est `../plans/2026-09-07-global-app-concept.md`. Son prochain livrable est un prototype interactif réunissant création, bibliothèque et paramètres, en desktop et mobile. Les trois variantes ci-dessous restent des explorations antérieures centrées sur le Studio, pas une sélection obligatoire pour l’app entière.

## Unité de travail du Studio explorée précédemment

L’utilisateur agit sur un **plan ou un média**, avec ses références, son instruction, son modèle, ses paramètres, ses versions et ses actions suivantes. La saisie d’un prompt reste nécessaire ; elle ne définit plus à elle seule toute la composition. Aucun résultat fictif ne doit être présenté comme produit par un moteur. Le démarrage sans média et la génération texte seule doivent rester directs.

## Exploration sur un même scénario

Projet de test : Tokyo sous la pluie. Sélection d’une référence, instruction courte, Seedance 2.5, durée/résolution/format/audio visibles, devis réel avant soumission, génération puis variantes. Les images sont des concepts, pas une promesse de fonctionnement ni une validation du prix.

| Direction | Organisation à éprouver | Transformation mobile |
|---|---|---|
| Régie | Grand lecteur, palette d’outils, inspecteur du plan sélectionné, prises visibles | Média et commandes principales visibles ; inspecteur en panneau nommé |
| Table de plans | Référence → plan → versions comme objets visuels ; actions attachées à la sélection | Étape active et dépendances accessibles par une vue adaptée, sans devoir naviguer un grand graphe au doigt |
| Focus | Sélection immersive de plans ; menus à forte hiérarchie et commandes sur une surface dédiée | Sélection de plan et barre d’action stables ; panneaux avec fermeture explicite |

## Critères visuels et interactifs

- Pictos aux silhouettes solides/duotones, présence optique et états sélectionnés ; noms courts sur les commandes essentielles.
- Navigation, réglage, transport et action principale ont une forme adaptée à leur fonction. Aucune répétition systématique du même bouton arrondi.
- Le média et l’objet actif structurent la densité ; pas de boîtes décoratives imbriquées ni de formulaire occupant tout le centre.
- Les mouvements rendent lisibles la sélection, l’ouverture d’un outil et le lien entre une référence et son résultat. Pas de mouvement obligatoire ou de progression inventée.
- La direction sera éprouvée dans un prototype manipulable : sélectionner, ouvrir un outil, changer un paramètre, comparer, annuler. Une image fixe ne valide pas ces interactions.
- Mobile, clavier, contraste, mouvement réduit, devis et contrôles techniques restent des critères de réalisation.

## Conservation et limites

Branche isolée conservée, fonctions du premier lot intactes. Aucune fusion ni publication. Le Studio existant reste dans son checkout séparé ; toute intégration de timeline enregistrée nécessite son propre contrat. Cette exploration porte sur la direction commune de l’app, pas sur une réécriture de ses moteurs.

Références fonctionnelles consultées : [Unreal, objet sélectionné et panneau de propriétés](https://dev.epicgames.com/documentation/unreal-engine/unreal-editor-interface), [Resolve Cut, surface dédiée au montage](https://www.blackmagicdesign.com/products/davinciresolve/cut). Les captures actuelles de MaxVideoAI et de Studio sont jointes aux générations comme contexte fonctionnel ; leur esthétique est explicitement rejetée.

## État de l’exploration

- Une nouvelle image affichée : **Table de plans**, fichier de prévisualisation `/Users/adrienmillot/.codex/generated_images/01a07920-6fc3-7131-911d-321ce840ffdd/exec-9e0e48fc-39d0-49c0-90e1-14bc8bacd489.png`. Elle est la première et seule image de cette nouvelle série ; ne pas la confondre avec les anciennes planches de 02 h.
- Régie : trois tentatives, toutes terminées en erreur réseau de l’outil intégré. Focus : une tentative, même échec. Aucun rendu de ces deux directions n’est disponible.
- Aucun choix visuel reçu ; aucune nouvelle présentation implémentée pendant cette exploration. Les chiffres et dimensions affichés sur la planche sont du contenu illustratif à remplacer par les valeurs réelles dans tout prototype.
- La prochaine preuve attendue est interactive : sélection d’un plan et de ses outils, modification contextuelle, comparaison et retour mobile. La sélection visuelle reste ouverte.

## Exigences confirmées — raccords, audio et références progressives

Le produit devient un logiciel de création interconnecté. Image, vidéo et audio sont des médias réutilisables entre activités, sous réserve des capacités du destinataire. Chaque emplacement propose une action courte Ajouter puis Bibliothèque / Importer / Créer. Créer une référence est un détour avec retour au même brouillon et au rôle visé, sans perte des autres entrées. Le contexte peut aussi être transmis aux outils, puis au Studio pour la finalisation.

Les références occupent une ligne compacte à vide ; les vignettes apparaissent avec le contenu. Les grandes collections ont une vue de gestion dédiée, des compteurs, une recherche et une sélection multiple. Aucun modèle ne reçoit artificiellement une capacité de 50 références. Première/dernière image et autres rôles contraints restent identifiables sans créer de grands blocs vides. Remplacer conserve l’ancienne référence jusqu’à validation ; Retirer ne supprime pas le média ; Supprimer de la bibliothèque reste une action distincte.

L’utilisateur demande des pictos stylisés et cohérents, créés pour le produit ou issus d’une bibliothèque de qualité, et autorise la recherche d’inspiration GitHub. Le prototype doit démontrer ces choix sur les commandes réelles, les états vides et remplis et le mobile, avant généralisation.

L’audio comprend écoute, import et réutilisation, mais aussi les usages existants de musique, voix et sonorisation d’une vidéo. Les outils MCP actuels savent lister/importer les trois types ; leur génération audio autonome et une piste audio de timeline ne sont pas encore des capacités établies. Le montage minimal reste borné à l’ordre des clips ; les écarts de contrat seront explicitement traités dans le lot d’intégration.

## Proposition interactive globale disponible

Le prototype `docs/design/global-app-concept/` matérialise la carte des actions et les règles visuelles avant généralisation. Création image/vidéo/audio, références progressives, détour de création avec retour, bibliothèque et préférences sont manipulables localement. La direction visuelle est désormais retenue. Sa revue distingue les comportements essayés des raccordements encore absents.

Le lot `../plans/2026-09-07-model-choice-price-concept.md` ajoute le choix d’un modèle et les estimations du catalogue public à cette composition : comparer aux mêmes réglages, prévisualiser les adaptations, appliquer sans perdre le brouillon. Aucun faux devis de référence ni prix personnalisé n’est déduit de l’estimation texte seule. `docs/design/global-app-concept/integration-contract.md` fixe les critères de conservation avant remplacement des écrans réels.
