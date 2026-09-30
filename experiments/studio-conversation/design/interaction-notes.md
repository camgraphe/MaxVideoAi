# Studio — comportement proposé

Ces règles décrivent la proposition étudiée, pas des fonctionnalités existantes.

## Une conversation qui dure

Le centre a une largeur bornée. Les messages défilent dans cette zone ; le champ de saisie, le titre Studio, la preview et la timeline restent en place. Le texte d'accueil disparaît dès les premiers échanges.

Les nouvelles réponses suivent le bas de la conversation seulement si l'utilisateur y est déjà. S'il relit plus haut, préserver sa position et proposer une indication discrète « Nouvelle réponse ». Les anciennes réponses ne sont pas remplacées par un résumé automatique ; l'historique reste consultable.

Le choix entre déléguer une production complète ou valider des étapes appartient à un échange avec l'assistant, pas à un mode affiché dans le chrome. Les approbations de dépenses restent explicites dans la conversation selon les contrats métier.

## Des médias qui restent lisibles

Une preview principale reste ancrée. Deux ou trois médias utiles à l'échange courant apparaissent autour ; chaque nouvelle création n'ajoute pas indéfiniment une carte au canevas. Les autres restent accessibles dans une vue secondaire du projet.

L'arrivée d'un média réserve d'abord sa place, puis révèle l'image sans déplacer le champ de chat. Les résultats ne flottent pas en permanence. Une animation courte signale la création ou la modification, avec respect de prefers-reduced-motion.

Un même produit, une lumière cohérente et des cadrages complémentaires donnent une direction artistique. Les références latérales doivent correspondre à des éléments réels du projet. Avant toute création, l'écran peut montrer une composition abstraite discrète ou rester vide ; éviter d'afficher de faux résultats.

## Comprendre les actions

« Raccourcis le deuxième plan » sélectionne ce plan dans la bande de montage et actualise sa durée. La réponse explique brièvement le changement, avec une action Annuler lorsque le contrat de commande le permet.

La mise en évidence de l'élément concerné est temporaire. En lecture d'anciens messages, une sélection explicite peut rappeler l'élément ; ne pas déplacer automatiquement la preview à chaque scroll.

Les états création, attente, échec et prêt doivent rester distincts. L'assistant ne doit pas annoncer un résultat disponible avant confirmation du backend. Le détail technique peut être ouvert à la demande.

## La bande de montage

Elle apparaît lorsqu'une séquence est proposée ou assemblée. Une rangée de plans, Play, une tête de lecture et des repères de temps suffisent au premier niveau. Cette exploration limite le montage direct au placement et à la coupe des plans.

Une vraie timeline doit afficher des largeurs proportionnelles aux durées, indépendamment des cinq vignettes de taille proche dans la maquette. Un plan de quatre secondes ne peut pas occuper visuellement douze secondes. Le film doit aussi afficher sa vraie durée après une correction.

Le défilement horizontal des plans est indépendant de l'historique des messages. Cliquer un plan cible la correction suivante ; le chat reste accessible. Pas d'inspecteur ou de catalogue d'effets affiché en permanence.

Une poignée permet de déplacer le plan ; les flèches et le clavier donnent une alternative au glisser. Les bords de sélection coupent le début ou la fin sur desktop. « Couper » révèle un aperçu et les contrôles début/fin, utilisables sur mobile. Le zoom sert la précision ; l'annulation restaure aussi bien une coupe qu'un déplacement. Le passage à de vrais clips devra respecter leurs frames et leurs durées source, sans étendre un plan au-delà du média disponible.

Les modifications directes et les demandes au bot doivent passer par le même contrat de commande versionnée. Une génération en cours ne doit pas écraser une coupe ou un ordre modifié par l'utilisateur entre-temps.

## Petits écrans et validation future

Sur petit écran, conserver la conversation comme surface principale. Les visuels figurent dans les réponses, sans composition autour du chat ; un toucher ouvre leur aperçu. « Montage » ouvre le volet sous le chat, avec une timeline défilable horizontalement et une coupe dans des contrôles suffisamment larges. Le champ reste à la même place lors de l'arrivée de messages et de médias.

L'étude interactive éprouve vingt-deux échanges scénarisés, l'accumulation des créations, les coupes et déplacements locaux, les annulations, la relecture et les proportions de durée. Les interruptions, erreurs réseau, approbations et reprises d'un projet réel restent à valider avec les services métier. Une image raster ne démontre pas ces comportements.
