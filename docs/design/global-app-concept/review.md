# Revue du prototype global — 7 septembre 2026

Statut : direction visuelle retenue par l’utilisateur. Les lots interactifs ajoutent le choix du modèle, le prix avant génération, les récents, le wallet et le menu du site ; la conservation des fonctions importantes est exigée dans `integration-contract.md`. Cette revue ne valide pas une intégration de production.

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

## Lot récents, wallet et navigation — vérifications supplémentaires

- Dépôt natif d’une image depuis la colonne vers les références : insertion dans le bon rôle, montant texte-seul retiré. Ajout explicite de vidéo et d’audio : trois références typées, aucun changement implicite de modèle ou de profil.
- Profil Début → fin : choix Première/Dernière image lorsque les deux rôles sont disponibles ; second ajout dans le dernier rôle disponible ; troisième refusé avec limite expliquée. Audio refusé dans ce profil, références existantes conservées.
- Dépôt sur la première image à capacité atteinte : confirmation de remplacement, annulation conserve La cartographe ; remplacement par Étude de produit conserve le rôle ; Annuler restaure La cartographe et laisse la dernière image en place.
- Récents à 390 et 320 px : panneau nommé, filtre Audio, ajout par Entrée et annulation ; estimation texte-seul restaurée quand le brouillon retrouve zéro référence. Boucle Maj-Tab vers Tous les médias, Tab vers Fermer, Échap et focus rendu à Récents.
- Simulation audio explicitement locale : média existant remonté en tête, sans doublon, sans date ni job inventés. Le code d’import promeut les IDs issus de l’import existant ; le sélecteur de fichiers n’a pas été rejoué dans ce lot. L’import audio avait été vérifié au lot précédent.
- Colonne et panneau utilisent les mêmes cartes avec action de destination paramétrable. Aucun lecteur audio/vidéo monté dans la colonne au repos ; aucun succès d’insertion Studio inventé. Le raccordement au flux réel et aux projets est décrit dans `integration-contract.md`.
- Menu : sept destinations vérifiées contre le propriétaire de navigation du dépôt ; ancres en `_blank` avec `noopener noreferrer`. Wallet montre explicitement — USD/non connecté et le lien `/billing`. Fermeture des panneaux conserve texte, deux références et rôles. Les parcours du site après ouverture et la session/facturation réelles ne sont pas validés par ce test.
- Comparatifs détaillés également accessibles depuis la liste des modèles. Wallet et menu nommés dans l’en-tête desktop/mobile ; leur contenu reste à raccorder au compte réel.

Mesures finales du créateur dans le navigateur local :

| Format | Document | Fin du contenu défilant / début du pied | Fin du pied / début navigation mobile |
|---|---|---|---|
| 1440 × 960 | 1440 × 960 | 876 / 884 px | 942 px / navigation latérale |
| 900 × 700 | 900 × 700 | 560 / 568 px | 682 px / navigation latérale |
| 390 × 844 | 390 × 844 | 657 / 663 px | 767 / 775 px |
| 320 × 740 | 320 × 740 | 553 / 559 px | 663 / 671 px |
| 844 × 390 | 844 × 390 | 324 / 328 px | 382 px / navigation latérale |

Ces mesures remplacent le positionnement sticky des lots précédents. Correction du parent mobile non borné qui laissait le pied passer sous la navigation. Le contenu est découpé par sa propre zone de défilement, sans recouvrir le pied ; après défilement à 320 px, l’instruction finit à 538,5 px avant la limite à 553 px. À 390 px, saisie ciblée finissant à 642,5 px avant le pied à 663 px. Aucun bouton visible mesuré sous 44 × 44 px à 320 px. En paysage court, les cinq entrées sont visibles, hautes de 52 px ; Compte finit à 382 px.

Le lecteur audio conservait trop peu de hauteur à 900 px et débordait latéralement à 390 px : correction de sa hauteur naturelle et de la largeur minimale du conteneur. Vérification à 390 px : lecteur de x=35 à 352 px, compris dans son aperçu de x=16 à 371 px ; commandes lisibles. Lecture native effective constatée (piste locale de 15 s, temps avançant), puis pause. Aucune mesure de gain de performance de production n’est revendiquée. Clavier virtuel, appareils physiques et lecteurs d’écran complets restent à qualifier.

Sources de la décision de navigation : [Adobe — crédits génératifs](https://helpx.adobe.com/creative-cloud/apps/generative-ai/generative-credits-faq.html), [Runway — gestion de l’abonnement depuis le dashboard](https://help.runwayml.com/hc/en-us/articles/50205612565779-Managing-your-subscription). Ces documents étayent la présence du solde/de la facturation dans l’app ; le menu public séparé est notre recommandation pour conserver le contexte de création. Aucun effet sur la conversion n’a été mesuré.

État vide inspecté à 390 px : titre, ajout et saisie accessibles. Les messages avec Annuler sont désormais positionnés au-dessus du pied d’action et suivent son déplacement au redimensionnement ; le bouton principal reste dégagé. Aucun avertissement ni erreur de console dans le dernier parcours.

Vérification de source : préparation reproductible, syntaxe des quatre modules JavaScript et du script Python, `git diff --check`. Captures locales : `recents-wallet-1440.png`, `recents-wallet-390.png`, `recents-wallet-landscape.png`, `recents-audio-390.png`. Aucun fichier frontend de production modifié dans ce lot.

## Lisibilité du prompt, des références et de la marque

Retour utilisateur appliqué : picto original de médias superposés devant Références, picto et label Prompt/Script, fond et bordure du champ visibles au repos, focus dessiné à l’intérieur et espace réservé au défilement. Boutons de réglages délimités, Options accentué ; les cinq réglages restent sur une ligne à 320 px, chacun au moins 44 px de large. Le monogramme provisoire est remplacé par le logo officiel du dépôt, copié sans modification ; variante compacte visible dans l’en-tête mobile. Vérification navigateur en clair à 1280 et 320 px ; aucun débordement horizontal, pied à 663 px avant la navigation à 671 px sur le format 320 × 740.
