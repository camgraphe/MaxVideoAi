# Revue du prototype global — 7 septembre 2026

Statut : proposition interactive prête à examiner ; direction visuelle non encore validée par l’utilisateur. Cette revue ne valide pas une intégration de production.

## Démontré dans le navigateur

- Navigation Création image/vidéo/audio, Médias et Compte ; chaque activité conserve son brouillon local.
- Ajouter plusieurs références, remplacement confirmé et annulation du remplacement, retrait puis restauration sans suppression du média de bibliothèque.
- Création d’une référence audio et d’une référence image avec retour au texte et aux références du brouillon vidéo d’origine ; détour vidéo annulé sans perte du texte d’origine.
- Changement vers un profil sans références : médias conservés, incompatibilités signalées, simulation empêchée. Réattribution d’une image au rôle Première image et reprise possible.
- Réutilisation d’un média audio depuis la bibliothèque ; proposition explicite d’un profil vocal compatible, puis insertion. Vidéo → Sonoriser : source vidéo conservée et résultat illustratif vidéo, pas un changement implicite en fichier audio.
- Import d’un fichier audio existant du dépôt : référence ajoutée via URL blob, aucun envoi à une API.
- Bibliothèque de 50 médias de test : 50 cartes, zéro lecteur monté. Recherche « station » : 8 résultats, toujours zéro lecteur. Ouverture de l’aperçu audio puis lecture/pause natives vérifiées.
- Sélection de six images dans un profil limité à six images : la septième reste non sélectionnée et la limite est annoncée.
- Thème clair/sombre et réduction des mouvements effectifs ; annulation et enregistrement du nom dans la maquette seulement.
- Panneaux au clavier : boucle Tab/Maj-Tab, Échap, retour du focus à Réglages ; format 9:16 conservé après fermeture.

## Vérification visuelle et responsive

- Inspection des écrans desktop et mobile. À 1440 × 960, le créateur tient dans une page de 960 px de haut ; la commande principale se termine à 942 px.
- À 320 × 740 : document de 320 px, six références résumées dans une ligne de 64 px, aucune cible de bouton mesurée sous 44 px après correction. Génération visible au-dessus de la navigation ; saisie ciblée et commandes ne se chevauchent pas dans le parcours d’édition essayé.
- Bibliothèque et paramètres à 320 px : aucun débordement horizontal. Ajout de références et préférences inspectés à 390 px ; tableau de bord de création/bibliothèque/compte inspecté à 1440 px.
- Correction du focus qui pouvait sortir du panneau en Maj-Tab, des valeurs tactiles trop étroites et du nom accessible du bouton Assistants sur mobile.
- Typographie locale, pictos SVG originaux, commandes différenciées et densité bornée ; rôle attribuable et menus explicites. Recentrage des miniatures de portrait pour conserver le visage.

Captures de travail : `.superpowers/sdd/global-app-concept/captures/`. Les captures ne remplacent pas les essais d’interaction ci-dessus. Les essais responsive utilisent le navigateur local ; clavier virtuel, appareils physiques et lecteurs d’écran complets restent à qualifier lors de l’intégration.

## Non démontré / lot suivant

- Catalogue de modèles et devis réels : les profils du prototype et leurs plafonds sont des fixtures, jamais des promesses sur un moteur.
- Tous les contrôles avancés image/vidéo/audio, contraintes de métadonnées et erreurs détaillées par fichier ; sauvegarde/restauration inter-session et résolution de conflits entre onglets.
- Outils, connexions effectives, compte/facturation et Studio : accès de périmètre présentés, aucune simulation d’un succès serveur. Pas de timeline persistée ni génération audio MCP autonome ajoutées ici.
- Performance de production : galerie sans lecteurs au repos et interface bornée constatées, mais pas de gain Core Web Vitals revendiqué. Les assets de démonstration sont des copies locales ; le raccordement devra conserver les renditions et lectures réelles existantes et produire des mesures comparables.

Séquence suivante : retour sur cette composition globale et ses interactions → intégration des surfaces retenues dans les orchestrateurs existants → extension aux outils et au compte → Studio et montage MCP borné.

Vérifications de source : préparation reproductible avec `preview.py --prepare-only`, analyse syntaxique Node des deux modules, `git diff --cached --check`. Aucun message de console de niveau erreur dans le dernier parcours. Aucun fichier de production frontend modifié par ce prototype.
