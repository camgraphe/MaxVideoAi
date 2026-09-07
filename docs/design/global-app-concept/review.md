# Revue du prototype global — 7 septembre 2026

Statut : direction visuelle retenue par l’utilisateur. Le lot suivant ajoute le choix du modèle et le prix avant génération ; la conservation des fonctions importantes est exigée dans `integration-contract.md`. Cette revue ne valide pas une intégration de production.

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

- Catalogue complet et devis personnalisés / avec références / image / audio : non raccordés. Le nouveau sélecteur démontre six modèles réels et leurs estimations publiques texte-vers-vidéo ; les profils de références et leurs plafonds restent des fixtures indépendantes, jamais des promesses sur un moteur.
- Tous les contrôles avancés image/vidéo/audio, contraintes de métadonnées et erreurs détaillées par fichier ; sauvegarde/restauration inter-session et résolution de conflits entre onglets.
- Outils, connexions effectives, compte/facturation et Studio : accès de périmètre présentés, aucune simulation d’un succès serveur. Pas de timeline persistée ni génération audio MCP autonome ajoutées ici.
- Performance de production : galerie sans lecteurs au repos et interface bornée constatées, mais pas de gain Core Web Vitals revendiqué. Les assets de démonstration sont des copies locales ; le raccordement devra conserver les renditions et lectures réelles existantes et produire des mesures comparables.

Séquence suivante : intégrer les surfaces retenues et leurs fonctions dans les orchestrateurs existants en appliquant le contrat de conservation → extension aux outils et au compte → Studio et montage MCP borné.

Vérifications de source : préparation reproductible avec `preview.py --prepare-only`, analyse syntaxique Node des deux modules, `git diff --cached --check`. Aucun message de console de niveau erreur dans le dernier parcours. Aucun fichier de production frontend modifié par ce prototype.

## Lot modèle et prix — vérifications supplémentaires

- Projection reproductible de six modèles disponibles et 152 scénarios depuis les mêmes propriétaires de catalogue, d’options et de tarification que l’estimateur public. Tarif Member/USD versionné, sans règles DB ni session réelle. Aucun coût fournisseur ni règle de marge exposés dans le module navigateur.
- Vérification des 152 lignes : sélection d’un scénario exact ; absence de montant si durée/résolution/format non pris en charge, référence présente ou source obligatoire manquante. Un modèle avec son inclus ne satisfait pas silencieusement une demande sans son. La préparation d’un candidat ne modifie pas le brouillon.
- Comparaison au réglage courant ; Sora proposé avec résolution adaptée, Wan avec durée adaptée, sans prix trompeur à côté d’un réglage incompatible. Le panneau candidat affiche les changements et l’estimation de ses propres valeurs avant application.
- Sora préparé à 12 secondes puis annulé avec Échap : Veo, 8 secondes, 1080p et son conservés ; focus rendu à Comparer. Application de Kling, changement de durée et du son : montant mis à jour ; fermeture des réglages avec retour au bouton Son.
- Ajout d’une référence image : le montant texte seul disparaît. Changement vers Kling puis création d’une référence audio et retour : texte, modèle, 8 secondes, 1080p, 16:9, absence de son et deux références retrouvés.
- Application de Sora à 12 secondes et 9:16 sur mobile : valeurs et estimation conservées. Thème clair/sombre inspecté ; aucune erreur de console dans le dernier parcours.
- À 1440 × 960 : hauteur de page 960 px, commande principale terminant à 942 px. À 320 × 740 : largeur de document 320 px ; Ajouter finit à 542 px, avant le pied d’action à 553 px ; Générer/Simuler reste au-dessus de la navigation à 671 px. Ligne de références de 64 px ; aucun bouton visible sous 44 × 44 px.
- Panneaux de modèle à 320 et 390 px : aucune largeur débordante ; boutons/sélecteurs tactiles de 44 px minimum. Boucle Tab/Maj-Tab et Échap vérifiés. Champ d’instruction ciblé : entièrement au-dessus du pied d’action dans le parcours testé. Clavier virtuel et appareils physiques restent non qualifiés.
- Contrats `pricing-public-authority.test.ts` et `pricing-architecture.test.ts` : 11 tests réussis. Analyse syntaxique des trois modules et `git diff --check` réussis. Le build Next et les contrôles de production ne sont pas revendiqués pour ce lot documentaire.

Captures supplémentaires locales : `model-price-320.png`, `model-compare-390.png`, `model-price-1440.png`, `model-compare-1440.png`. Les montants correspondent au catalogue préparé pour cette revue, pas à un engagement de prix d’un compte connecté.
