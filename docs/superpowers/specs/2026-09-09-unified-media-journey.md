# Parcours média unifié — proposition de mise en œuvre

Statut : première tranche implémentée le 9 septembre. Le reste de ce document conserve la cible de conception, et non une déclaration de livraison intégrale.

## Livré et limites de cette tranche

- Fenêtre commune pour Media, actions de galerie/Activity et résultats `MediaLightbox`. Un seul lecteur actif, actions visibles pendant la lecture, détails repliés, fermeture/focus et sélection de sortie partagés. Les états en attente/échec restent gérés par leur propriétaire existant.
- Source originale transmise vers Image, Vidéo, Upscale, Angle, suppression de fond et les quatre outils de finition vidéo. Confirmation « Use this source » avant remplacement dans les outils ; aucune génération automatique.
- Extension : mode et modèle compatibles transmis avec le clip. Veo réservé aux sources Veo identifiées ; source inconnue dirigée vers un modèle acceptant les clips génériques. Le choix du rôle/source reste explicite dans le compositeur.
- Références : même présentation média, rôles et budgets existants conservés. Les actions de transformation ne sont pas ajoutées au sélecteur de rôle pour garder ce choix concentré sur l'insertion.
- Share : partage natif ou copie de l’URL originale, avec indication d’expiration possible. La page stable et les jetons révocables ci-dessous restent à réaliser.
- Compare : cartes de prix, ajout par le sélecteur de familles vidéo, retrait, six alternatives maximum. Ajouter ne modifie pas le compositeur. Un candidat incomplet reste visible sans faux prix ; Choisir ouvre seulement ensuite la validation. Les réglages sauvegardés sont un accès secondaire « Previous settings ».
- Restent hors de cette tranche : retour automatique d’un résultat d’outil vers l’emplacement exact d’une référence, migration des lecteurs spécialisés Audio/Studio/outils, partage public révocable. Sur les menus de groupes, les callbacks historiques de sauvegarde/reprise portent uniquement sur la sortie principale : ils sont masqués sur les autres sorties, dont le téléchargement, partage et transfert ciblent bien l’original sélectionné.

Contrats actuels : `docs/engineering/media-inspector.md`.

## Objectif

À partir d’un résultat ou d’un média importé, permettre de le regarder, choisir la suite utile et arriver dans la bonne destination avec l’original déjà chargé. Une transformation crée un nouveau résultat lié à sa source. L’utilisateur garde son original, son brouillon et un chemin de retour.

## Audit de l’existant

- `MediaActionPanel.client.tsx` sert déjà les menus de galerie et de bibliothèque, ainsi que certains choix de références. Les captures 2 et 3 représentent donc une même base avec des actions injectées différentes. Le passage en aperçu masque actuellement les actions.
- `MediaLightbox.tsx` et `MediaLightboxEntryCard.tsx` servent les résultats, notamment via `GroupViewerModal.tsx`. Ils affichent lecture, détails et téléchargement, mais ne partagent pas la composition du panneau d’actions. Les identifiants techniques prennent trop de place dans la vue principale.
- `GalleryMediaActionPanel.client.tsx` contient un deuxième sélecteur de sortie et des callbacks portant parfois sur le résultat principal : les futures actions doivent toujours cibler la sortie effectivement affichée.
- `MediaDestinationActions.client.tsx` et `media-handoff.ts` transfèrent une source vers Image ou Vidéo. Ils ne couvrent pas encore un parcours commun vers les outils ou une intention explicite d’extension.
- `frontend/src/lib/toolbox/catalogue.ts` décrit les entrées compatibles des outils. `ToolAssetRef` dans `contract.ts` distingue un asset d’une sortie de job avec ses identifiants exacts. Réutiliser ce contrat plutôt qu’inventer un autre identifiant.
- Le choix de référence vidéo possède déjà les validations de rôle, format, durée, compte et remplacement. Voir `docs/engineering/recent-reference-media.md` : conserver ces propriétaires.
- Le partage actuel du lecteur copie l’URL du fichier. Les préférences de visibilité/indexation ne constituent pas à elles seules un partage privé révocable.
- Le contrat Studio existe : voir `docs/engineering/studio-media-integration-contract.md`. Son récepteur qualifié ajoute au projet choisi ; ne pas annoncer un placement automatique sur une piste. Studio reste soumis à l’accès admin demandé pour le lancement.

## Une fenêtre, deux intentions

### Consulter et poursuivre

Un clic sur le média depuis Activity, Media ou la galerie ouvre la même fenêtre. Un lecteur immédiatement utilisable occupe la majorité de l’espace. Le titre est un nom utile ou le modèle ; date, durée, dimensions et coût connus restent secondaires. Les faits inconnus restent absents, notamment l’audio : inconnu ne devient pas « Off ».

À côté : deux ou trois suites pertinentes, puis « Tous les outils compatibles ». Télécharger et Partager sont stables. Les actions restent accessibles pendant la lecture. Prompt et paramètres se développent à la demande ; les IDs techniques vont dans des détails secondaires. Pas de flèches décoratives ni de badge « Ready » permanent pour un résultat terminé.

Plusieurs sorties : petites vignettes ou navigation précédente/suivante, un seul original lu à la fois. Le nom, les détails, le téléchargement, le partage et la suite choisie concernent tous la sortie active.

Sur mobile : lecteur, actions principales, puis détails repliés. Une seule zone de défilement, fermeture accessible, aucun panneau imbriqué. Conserver le focus, Escape, le thème et EN/FR/ES.

### Choisir une référence pour un travail en cours

Réutiliser la même présentation du média, mais mettre l’intention locale au premier plan : « Ajouter comme image de début », « Ajouter comme référence » ou « Remplacer… ».

Si le bouton d’origine désigne déjà un rôle, ne pas le redemander. Si plusieurs rôles sont possibles, les proposer explicitement. Un emplacement occupé demande un choix Ajouter/Remplacer. Un média incompatible explique brièvement la contrainte ; il ne change pas automatiquement le modèle ou le brouillon pour la contourner.

Les outils secondaires restent accessibles sans détourner ce parcours. Si l’utilisateur améliore une référence, transporter aussi la destination de retour et proposer d’appliquer le nouveau résultat au rôle initial après génération. Ne jamais remplacer la référence avant l’acceptation par son propriétaire actuel.

## Actions selon le média et le contexte

| Situation | Suites prioritaires | Suites secondaires |
| --- | --- | --- |
| Image consultée dans Media | Animer ; Utiliser comme référence | Upscale ; Modifier ; Angle ; ateliers Character/Storyboard si leurs entrées conviennent |
| Image venant d’être générée | Reprendre le prompt et les paramètres ; Animer | Référence ; Upscale ; outils compatibles |
| Vidéo terminée | Réutiliser les paramètres si disponibles ; Prolonger si un modèle/mode compatible existe | Upscale ; restaurer ; débruiter ; fluidifier ; retirer le fond selon les contrats réels |
| Vidéo importée | Utiliser comme source/référence ; outils compatibles | Extension si compatible ; sonorisation si le récepteur accepte cette source |
| Audio | Écouter ; réutiliser les paramètres connus ; utiliser comme référence audio compatible | Ajouter au projet Studio pour les comptes autorisés ; autres outils audio uniquement après raccord réel |
| Média sélectionné depuis un champ | Appliquer au rôle visé | Améliorer puis revenir ; autres rôles compatibles |

L’ordre dépend de l’origine de l’ouverture, des faits du média, des capacités du modèle et des destinations raccordées. Ne pas prétendre détecter un bruit, un flou ou un sujet sans analyse réelle. « Débruiter » est un outil disponible, pas un diagnostic du fichier. Le catalogue actuel de suppression de fond accepte des vidéos : ne pas l’offrir aux images par simple analogie.

Une impossibilité importante comme une extension non prise en charge peut être expliquée près de l’action recherchée. Les outils sans rapport ne remplissent pas l’écran de boutons désactivés.

## Parcours de transformation

1. Regarder le résultat et choisir une action.
2. Résoudre l’identité de l’original pour le compte courant, puis ouvrir la destination avec la source et l’intention.
3. Présenter les seuls réglages pertinents et un prix réel selon ces réglages. Ne pas lancer une génération payante à l’ouverture de l’outil.
4. Soumettre via les propriétaires existants, avec leurs validations de référence et de tarification.
5. Afficher la nouvelle sortie dans la même fenêtre média et conserver un lien vers l’original. Si l’action provenait d’un choix de référence, proposer « Utiliser cette version » pour revenir au champ initial.

Un changement de modèle proposé par une extension doit être visible et accepté. Ne pas appeler « Prolonger » une simple navigation vers le générateur : l’original et le mode d’extension doivent être transmis et validés.

## Partage proposé

« Partager » ouvre une petite vue dans la même fenêtre : créer/copier un lien de consultation, puis désactiver le lien. Par défaut, seul le média est partagé ; prompt, paramètres, coût et identifiants internes ne sont pas exposés. Un lien partagé n’autorise ni la modification ni la publication dans les exemples publics.

Le lien doit pointer vers une page stable, avec résolution serveur d’un jeton révocable et contrôle de l’état du média. Ne pas réutiliser une URL signée comme identité permanente ni assimiler absence d’indexation à confidentialité. Prévoir révocation, suppression du média, absence d’autorisation et expiration si cette option est proposée. Le partage natif du navigateur peut présenter ce même lien lorsqu’il est pris en charge ; aucun envoi automatique.

Ce partage est un lot backend et UI, distinct d’un simple renommage du bouton Copy link. Aucune publication ni modification des règles de visibilité pendant la conception.

## Découpage de réalisation

1. **Fenêtre média commune.** Une présentation et un lecteur actif ; adaptateurs Media/Activity/galerie/résultat ; détails progressifs ; sélection des sorties exacte. Préserver les états en cours/échec et leurs commandes de reprise.
2. **Actions contextuelles et transport.** Une politique testable d’éligibilité/ordre, fondée sur les contrats existants ; raccord effectif upscale puis autres outils ; extension avec choix du modèle compatible ; source préchargée et retour conservé.
3. **Boucle de référence.** Modes consulter/choisir dans la même présentation ; intention et rôle explicites ; amélioration puis application de la nouvelle version sans perte du brouillon.
4. **Partage contrôlé.** Page de consultation, tokens et révocation, permissions et états d’erreur ; bouton unifié sur toutes les entrées.
5. **Finition.** Cohérence des outils et de l’Audio avec la fenêtre commune ; Studio uniquement pour les accès autorisés ; suppression des anciennes fenêtres devenues inutiles après migration de tous leurs appels.

## Vérification et performance

- Aucune requête de prix, copie de fichier ou analyse média sur chaque vignette au chargement de la galerie. Résoudre les données supplémentaires à l’ouverture ou au choix d’une action, avec annulation sur changement de média/compte.
- Ne pas monter tous les lecteurs d’un groupe ni précharger tous les originaux. Conserver les miniatures, arrêter la lecture à la fermeture et au changement de sortie.
- Réutiliser le cache paginé Media et ses clés par compte ; ne pas créer une troisième bibliothèque sous prétexte d’unifier les fenêtres.
- Vérifier le parcours complet depuis Media, Activity, galerie vidéo/image et sélection de référence, avec une sortie secondaire d’un lot, un upload, un média supprimé et des métadonnées manquantes.
- Vérifier qu’un retour d’outil retrouve le brouillon et que l’annulation ne remplace rien. Vérifier les rôles et budgets de références avec les contrats existants.
- Mesurer ouverture de fenêtre, requêtes, octets transférés et premier Play avant/après sur les mêmes médias. Les tests fonctionnels ne prouvent pas un gain de chargement.
- Le partage nécessite des tests d’autorisation, révocation et absence de données privées dans la page publique. Une requête annulée ou tardive ne doit pas rouvrir un autre média.
