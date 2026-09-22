# Refonte de l’administration MaxVideoAI — dossier de préparation

Date : 22 septembre 2026. Statut : direction V2 approuvée ; implémentation autorisée le 22 septembre 2026.

## Objectif et décisions prises

Créer un admin professionnel, compréhensible par un repreneur de MaxVideoAI. Il ne s’agit pas de développer un produit d’administration commercialisé séparément.

Usages prioritaires confirmés par Adrien : inscriptions du jour, contrôle des transactions, modération, publication des articles et consultation des tendances.

Décisions confirmées pendant cette préparation :

- « Aujourd’hui » par défaut, depuis minuit dans le fuseau Europe/Madrid ; « Dernières 24 h » reste un choix distinct.
- Revoir l’organisation des liens : le problème signalé concerne le menu et sa cohérence avec le site, pas un bug de redirection identifié.
- Retirer la liste des pages publiques du menu principal de l’admin.
- Consulter les analyses SEO dans Google Search Console, avec un lien externe depuis l’admin. Ne plus maintenir un second outil Search Console dans l’administration pour cet usage.
- Conserver ici la gestion des contenus, les contrôles utiles à leur publication et les actions propres à MaxVideoAI.
- Préparation initialement sans code ; passage à l’implémentation explicitement autorisé après revue des maquettes V2.
- Direction visuelle confirmée : claire et minimale.
- Langue d’interface confirmée : anglais. Le dossier de travail reste rédigé en français.
- Retirer Theme tokens, Membership et les contrôles d’édition des tarifs des moteurs de l’interface proposée ; ces réglages ne correspondent plus aux usages d’Adrien. Ne pas confondre cette décision avec la suppression des données historiques ou du moteur de tarification.
- Repenser profondément les playlists : leur quantité et leur réglage rendent la gestion difficile.
- Retour sur la première série visuelle : trop épurée, trop proche de l’existant. La cible devient un **espace de travail SaaS plus dense et structuré**, toujours clair, sans encadrés imbriqués.
- Exigence explicite : conserver le changement d’ordre par drag-and-drop. L’automatisation ne doit jamais écraser un ordre éditorial choisi.

## Périmètre et niveau de preuve

Inspection en lecture seule de onze vues de production, via la session Chrome existante, et lecture du code local de navigation, du dashboard, des transactions, des utilisateurs, des playlists et des composants visuels communs. Aucune publication, modification de prix, opération de paiement, synchronisation manuelle GSC ou modification de données n’a été exécutée.

Les captures sont conservées localement dans `output/admin-redesign-2026-09-22/`. Elles peuvent contenir des données privées de l’administration et ne constituent pas des supports publics de présentation.

La navigation locale contient 23 entrées admin et 12 liens publics ; celle observée en production en contient 24 et 12, avec « Blog drafts » en plus. Le répertoire éditorial n’est pas présent dans la branche locale inspectée (`codex/sora-sunset-20260921`). La production et ce checkout ne doivent donc pas être considérés comme identiques. Avant toute implémentation, identifier la branche intégrant les évolutions éditoriales et conserver les nombreux changements locaux existants.

Ce document est un audit ciblé et un cadrage de refonte, pas une certification exhaustive de tous les outils. Les pages de configuration, toutes les sous-pages SEO, les états d’erreur et les parcours mobiles n’ont pas été parcourus intégralement. Aucun lien public n’est déclaré obsolète uniquement parce qu’il semble ancien : plusieurs routes existent encore dans le code.

## Diagnostic

### 1. Le menu reflète l’empilement des outils

Les réglages de thème et d’annonce de service précèdent les usages courants. Dix entrées se trouvent dans « Operations ». Les liens publics prolongent le menu et nécessitent un défilement indépendant. Blog, modération, catalogue, finance et diagnostics ne disposent pas d’une hiérarchie alignée sur les tâches quotidiennes.

**Décision proposée : cinq destinations de travail et une entrée Configuration en bas.** Une seule action « Voir le site » remplace les douze liens publics. Une commande secondaire « Outils externes » rassemble uniquement les services effectivement nécessaires et vérifiés.

### 2. Les encadrés repoussent le travail utile

Dans Users, Jobs et Transactions, on traverse un titre, une description, un encadré de métriques, un second encadré, puis parfois un encadré de filtres avant les premières lignes. Dans la capture Transactions, la table commence presque au bas du viewport. La capture Jobs montre surtout les résumés et filtres, presque aucune donnée exploitable.

Le code explique cette accumulation : `AdminSection` ajoute bordure, arrondi, ombre et en-tête ; `AdminFilterBar` et `AdminDataTable` ajoutent leur propre cadre ; certains champs sont encore entourés d’un contenant supplémentaire.

**Décision proposée : une surface principale par page, des séparateurs fins et des tableaux directement dans la page.** Réserver les cartes aux objets visuels réellement autonomes, notamment les médias.

### 3. Deux synthèses concurrentes, et des répétitions internes

Hub & Health et Insights reprennent inscriptions, utilisateurs actifs, recharges et fiabilité. Dans Insights, un même indicateur apparaît dans le résumé, la tendance, le scorecard, le commentaire et le tableau financier. Les raccourcis répètent souvent la navigation.

**Décision proposée : une seule Vue d’ensemble**, avec « Aujourd’hui », « Tendances » et « Canaux ». Les analyses MCP sont accessibles sous Canaux et conservent leurs définitions propres.

### 4. La confiance dans les indicateurs doit être restaurée

Constats dans le code local, cohérents avec certains éléments visibles en production :

- `admin-dashboard-helpers.ts` contient des pourcentages de disponibilité prédéfinis, des mini-courbes fixes et un message « System backup completed successfully » sans événement de sauvegarde passé à cette fonction.
- La jauge « Average utilization » est un score calculé à partir du mix des moteurs, plafonné à 95 ; ce n’est pas une mesure de capacité utilisée.
- Des données fictives de remplacement existent lorsque certaines séries sont vides. Leur déclenchement en production n’a pas été testé.
- Le KPI « Success rate » est construit à partir d’une mesure de défaillances opérationnelles ; il faut vérifier et nommer précisément son dénominateur, notamment le traitement des échecs remboursés.
- Dans Transactions, `needsReview` inclut `row.canRefund`. Être remboursable n’est pas une anomalie. La production affiche 65 « Needs review » et 65 opérations remboursables lors de la capture, à côté d’un autre compteur de surveillance.
- Le cockpit SEO affiche de nombreux zéros alors qu’il indique l’absence de snapshot GSC. Donnée absente et valeur nulle sont deux états différents.

**Décision proposée : aucun indicateur sans source, définition, période et état de fraîcheur.** Afficher « Indisponible » lorsque la mesure manque. Distinguer réussite technique, échec remboursé et incident encore à traiter.

### 5. Les libellés et les destinations ne correspondent pas toujours

Le dashboard propose « Export report », mais le lien conduit à Insights. « View all systems » conduit à une page dont le propriétaire local est l’édition de l’annonce de service. Les descriptions de page contiennent des commentaires sur la construction de l’interface (« URL-driven », « dense instead of card-heavy »), sans aider l’opérateur à accomplir sa tâche.

La liste des articles affiche « Draft » ; la fiche d’un article consulté affiche simultanément « Private draft » et « Article publié et pages vérifiées ». La version de travail et l’état de publication doivent être distingués explicitement.

**Décision proposée : chaque lien annonce sa destination ou son action réelle ; une seule langue d’interface ; les détails techniques passent dans les détails secondaires.**

## Navigation proposée

| Destination principale | Contenu | Ouverture par défaut |
|---|---|---|
| Vue d’ensemble | Aujourd’hui · Tendances · Canaux | Aujourd’hui |
| Utilisateurs | Annuaire et fiche utilisateur | Dernières inscriptions ; filtre de période visible |
| Transactions | Paiements reçus · Mouvements de crédits · À vérifier | Paiements reçus aujourd’hui |
| Générations | Toutes · À traiter · En cours ; filtres média, modèle et canal | Liste récente, incidents clairement identifiables |
| Contenus | Modération · Articles · Collections · Accueil | Modération, avec accès Articles immédiatement visible |
| Configuration, en bas | Exploitation · Historique · Conformité ; produits seulement si un usage est confirmé | Index compact des réglages réellement utilisés |

Un sous-menu n’apparaît que pour la destination active. La barre latérale principale doit rester visible sans défilement sur un écran de travail courant. Les badges signalent un travail réel en attente ; ils ne recompteront pas partout les éléments déjà traités.

Les noms français ci-dessus facilitent la discussion. Les libellés d’interface retenus pour les maquettes sont **Overview, Users, Transactions, Generations, Content**, puis **Settings** en bas. Sous Overview : **Today, Trends, Channels**. Sous Content : **Moderation, Articles, Site placements**. Site placements réunit les destinations de collections et l’accueil, sans les mélanger aux réglages de prix.

## Sort de chaque outil existant

| Aujourd’hui | Proposition | Traitement |
|---|---|---|
| Hub & Health + Insights | Vue d’ensemble | Fusionner l’expérience, supprimer les répétitions |
| Users + détail utilisateur | Utilisateurs | Conserver ; remonter inscription, paiement, activité utile |
| Transactions | Transactions | Conserver ; distinguer paiements et consommation wallet |
| Checkout guard | Transactions → À vérifier | Conserver les diagnostics précis et les actions protégées |
| Jobs | Générations | Renommer ; détails fournisseur à la demande |
| Moderation | Contenus → Modération | Conserver et donner la priorité aux médias |
| Blog drafts, en production | Contenus → Articles | Conserver ; clarifier version et publication |
| Playlists | Contenus → Site placements | Reconcevoir autour des destinations du site, avec contenu hérité et mises en avant explicites |
| Homepage programming | Contenus → Accueil | Conserver ; destinations réelles du site visibles |
| Video SEO | Contenus → Publication vidéo, secondaire | Conserver les contrôles propres à la publication/indexabilité ; distinguer de GSC |
| MCP acquisition | Vue d’ensemble → Canaux → MCP | Conserver les résultats fiables, détails techniques secondaires |
| SEO cockpit + huit sous-outils visibles | Outils externes → Search Console | Retirer de la navigation normale ; préparer le retrait technique séparément |
| Engines | Informations modèle dans Générations ; diagnostic technique secondaire si nécessaire | Ne pas supprimer l’observabilité ; retirer l’édition de prix du parcours opérateur |
| Pricing policy | Aucun éditeur de tarifs dans l’interface cible | Modifications par le workflow code ; vérifier auparavant la priorité des overrides DB |
| Billing products | Configuration → Produits | Conserver distinct des tarifs des modèles |
| Membership | Retirer l’écran du produit admin courant | Préserver l’historique associé aux transactions et aux journaux sans maintenir une rubrique Membership |
| Infra costs | Configuration → Exploitation → Coûts | Accès secondaire ; synthèse éventuelle dans Tendances seulement si fiable |
| Audit log | Configuration → Historique | Conserver ; liens contextuels depuis les actions concernées |
| Service notice | Configuration → Exploitation → Annonce de service | Conserver ; accès contextuel depuis un incident |
| Theme tokens | Retirer l’éditeur de l’interface | Design maintenu dans le code ; aucune rubrique Apparence avancée à conserver par défaut |
| Legal + Marketing opt-ins + Consent exports | Configuration → Conformité | Regrouper ; les exports deviennent des actions identifiées |
| Douze liens publics | Voir le site | Retirer le faux plan du site du menu admin |

Ce regroupement est une organisation de l’interface. Il ne fusionne pas les services, les autorisations, les journaux ou les contrats commerciaux existants. Point à traiter avant tout retrait technique des éditeurs de prix : le guide de tarification donne actuellement priorité aux overrides DB sur les règles versionnées. Retirer l’éditeur ne suffit donc pas à rendre le code seul autoritaire. Inventorier les overrides effectifs et prévoir une transition explicite, avec comparaison des devis, si ce changement de gouvernance est retenu. Cette refonte visuelle ne doit modifier aucun prix par effet de bord.

Pour GSC : retirer l’entrée du menu ne suffit pas à supprimer les appels API. Lors d’une phase ultérieure, inventorier routes, tâches planifiées, appels et consommateurs ; arrêter uniquement ceux devenus inutiles ; conserver les fonctions de publication vidéo et le SEO public. Ne supprimer aucune donnée historique pendant le simple chantier de navigation.

## Écrans à concevoir

### Vue d’ensemble / Aujourd’hui

Le premier écran doit répondre rapidement à trois questions : combien d’inscrits aujourd’hui, combien de paiements reçus, quelque chose demande-t-il une intervention ?

- Titre et période visibles, fuseau explicite. Comparaison à hier à heure équivalente si la source le permet ; sinon période de comparaison clairement annoncée.
- Une ligne de trois mesures : inscriptions, paiements reçus (montant et nombre), incidents à traiter. Pas de carte autour de chaque chiffre.
- Les derniers inscrits et les derniers paiements sous forme de deux listes compactes. Chaque liste a une destination précise.
- Une zone « À traiter » seulement si un problème opérationnel réel existe ; ne pas créer une alerte parce qu’une action de remboursement est disponible.
- Un accès discret aux articles en attente et à la modération, avec des compteurs uniquement lorsque la file représente réellement du travail.
- Les courbes longues et les mesures avancées vivent dans Tendances.

### Transactions

Séparer ce que l’utilisateur paie réellement, ce qu’il consomme dans son solde et ce qui lui est recrédité. Ne pas présenter une recharge wallet, un débit de génération et un remboursement de crédits comme trois paiements bancaires équivalents.

Liste proposée : date/heure, utilisateur, type, montant/devise, état, référence. Clic sur une ligne : volet de détail avec paiement, mouvement wallet et génération liés lorsqu’ils existent. Les identifiants complets restent copiables dans ce volet.

La recherche et les périodes doivent porter sur tout le périmètre demandé, avec pagination serveur ; la recherche actuelle se limite aux cent écritures chargées. Un total sur un lot affiché ne doit pas être présenté comme le total journalier.

Rembourser est une action de détail avec montant, bénéficiaire, destination du remboursement et confirmation explicites. Conserver les protections serveur existantes et l’historique.

### Utilisateurs

Mettre l’identité lisible et la date d’inscription en premier. Éviter la colonne d’UUID complet au centre du tableau. Les informations de rôle, d’authentification et de sécurité restent disponibles dans la fiche ; remonter les exceptions utiles.

Prévoir un aperçu latéral pour les vérifications rapides, avec un lien vers la fiche complète. Préserver les filtres et le contexte de liste. Ces comportements sont des propositions, pas des fonctions déjà validées sur l’existant.

### Générations

Mettre en avant résultat et intervention nécessaire, puis utilisateur, modèle, date et coût. Déplier les états fournisseur et les journaux seulement lorsqu’on enquête. Utiliser « Fournisseur » plutôt que « Fal » pour les sources qui ne sont pas Fal.

Les compteurs de résultat, de paiement et d’intégrité doivent avoir des définitions distinctes ; un job terminé et remboursé ne doit pas devenir une urgence uniquement du fait de son historique.

### Contenus / Modération

Le média doit être visible immédiatement. Conserver une grille pour le tri visuel et un aperçu de l’élément sélectionné ; compacter les filtres et supprimer les répétitions de compteurs. Le prompt intégral passe dans le détail.

Clarifier le rôle de cette file : sélection éditoriale pour publication et éventuelles questions de conformité ne sont pas automatiquement la même tâche. « Non publié » ne signifie pas que chaque média privé doit être publié. Ne proposer comme attente éditoriale que les candidats répondant aux règles de sélection et de visibilité existantes.

Lors d’une publication, montrer les destinations exactes : galerie, collection, page modèle ou accueil selon les capacités réelles. Préserver la confidentialité et les contrôles existants ; aucun regroupement visuel ne doit rendre publics des médias privés par défaut.

### Contenus / Articles

Une liste claire : titre, langue(s), dernière modification, état éditorial et état de publication. États proposés à confronter au producteur réel : À relire, Corrections demandées, Prêt, Publié, Échec de publication.

Dans la fiche : contenu de l’article au centre, barre d’action stable et panneau secondaire de publication. Distinguer « Version de travail » et « Version publiée ». Les hashes, sources techniques et résultats détaillés des vérifications sont accessibles dans un volet, pas en tête de lecture.

Conserver la validation humaine et les contrôles de publication existants. Une maquette ne doit pas promettre programmation ou édition complète si ces fonctions ne sont pas prises en charge.

### Contenus / Site placements — proposition détaillée pour les playlists

**Constat live : 64 collections**, dont 64 signalées comme verrouillées, avec quatre surfaces runtime, douze entrées famille et de nombreuses entrées modèle. Les champs Name, Slug et Description de la collection initiale sont désactivés, mais occupent le premier écran avant les médias. Les commandes Sync/Seed/Create missing sont exposées au même niveau que l’édition. Les familles et modèles sont dépliés par défaut dans le code local.

Le verrouillage concerne notamment les métadonnées pilotées par le code, pas l’interdiction d’ordonner les médias. L’interface doit le dire sans donner l’impression que tout est bloqué.

**Un mécanisme automatique existe déjà**, mais ce n’est pas encore le produit proposé : `frontend/server/videos.ts`, dans `loadExampleFamilyFeed`, combine la playlist de famille, celles de ses modèles puis le hub filtré par les aliases de cette famille ; `mergeUniqueGalleryVideos` retire les doublons. Les lecteurs de playlists filtrent les contenus publics. Il ne faut donc pas présenter l’automatisation comme une fonction à inventer entièrement, ni prétendre que publier un média suffit déjà à l’inscrire dans chaque emplacement aujourd’hui.

L’interface cible commence par **la destination réelle** : Examples gallery, une galerie de famille, une page modèle, Homepage ou Starter samples. Sélecteur recherchable, liste compacte des destinations actives et lien Preview page. Les pages archivées et collections techniques inutilisées quittent la liste par défaut, après vérification de leurs consommateurs ; leur suppression physique n’est pas nécessaire à cette simplification.

#### Exemple du fonctionnement proposé

1. Une vidéo Kling 3 Pro est validée pour publication. Une génération privée seule ne suffit jamais.
2. Le système sait à quel modèle et à quelle famille elle appartient grâce aux données canoniques ; il vérifie aussi type de média, état, visibilité et éligibilité de la destination.
3. Elle devient candidate au complément automatique de la galerie générale, de la galerie Kling et de la page Kling 3 Pro si ces destinations sont actives et ont ce mode activé.
4. L’opérateur peut la mettre en avant, l’exclure localement ou ne rien faire. L’accueil et les exemples de démarrage restent manuels par défaut.
5. Si elle devient privée, est retirée ou n’est plus éligible, elle disparaît des destinations publiques même si elle était mise en avant.

Ce fonctionnement automatise le classement, pas le jugement de qualité. Pas de classement « meilleur contenu » opaque. Première règle proposée : contenus publics éligibles triés par date de publication décroissante, avec un départage stable ; vérifier l’existence et la fiabilité de la date de publication avant de la choisir plutôt que la date de création.

#### Deux modes d’ordre, par destination

| Mode | Contrôle de l’opérateur | Arrivée d’un nouveau média |
|---|---|---|
| Featured + Automatic | Glisser-déposer les vidéos mises en avant ; glisser un résultat automatique dans Featured pour l’épingler ; retirer une mise en avant le rend au complément automatique s’il reste éligible | Ajout dans le complément automatique selon la règle affichée ; aucune modification de l’ordre Featured |
| Manual order | Sélection et ordre entièrement manuels, drag-and-drop sur toute la liste | Aucun ajout automatique ; les nouveaux candidats sont proposés à part |

**Le drag-and-drop est une exigence, pas une option à supprimer.** Si l’opérateur souhaite contrôler toute la page, le mode Manual order le permet. Ne pas afficher une poignée suggérant un ordre manuel persistant dans une zone qui se retrierait automatiquement après sauvegarde. Dans Automatic, la poignée doit avoir une destination et un effet explicites — ajout à Featured — ou l’action doit proposer le passage à Manual order.

Le changement de mode présente son effet avant application. Passer à Manual order peut reprendre l’ordre visible comme point de départ ; repasser en mode hybride demande de choisir les éléments Featured et montre l’aperçu résultant. Aucune synchronisation ou publication ne réinitialise silencieusement ces choix.

Actions proposées : **Save changes**, **Cancel**, **Preview page** ; poignées de déplacement, positions visibles, déplacement vers une position précise et alternative clavier. Un réordonnancement reste un brouillon jusqu’à sauvegarde. Gérer les modifications concurrentes et les médias devenus privés avant enregistrement. À préciser lors de l’implémentation, ces mécanismes ne sont pas tous présents actuellement.

#### Exclusions et visibilité

- **Unfeature** : enlève la priorité, sans exclure le média de la galerie automatique.
- **Exclude from this page** : masque ici uniquement ; l’exclusion s’applique aussi aux sources de complément et empêche une réapparition par héritage.
- **Unpublish** : retire des surfaces publiques selon les règles de visibilité ; action distincte et explicite.
- **Delete media** : hors du parcours courant de curation ; ne pas confondre avec les trois actions précédentes.

La résolution proposée, lorsque le mode hybride est actif : vérifier l’éligibilité publique → appliquer les exclusions de la destination → afficher Featured dans l’ordre éditorial → compléter automatiquement sans doublons → appliquer la limite et la pagination. Chaque résultat expose « Why is this here? » avec une explication courte comme Featured ou Model family. La suppression locale d’une association dans une ancienne playlist ne doit pas être assimilée sans preuve à une exclusion durable.

#### Migration conservatrice à prévoir

Inventorier chaque destination et son lecteur réel, puis comparer son ordre affiché avant/après. Conserver les sélections existantes comme ordre manuel initial, ou comme Featured uniquement après revue de leur taille et de leur sens éditorial. Ne pas transformer aveuglément 177 éléments de hub en 177 mises en avant. Ne pas vider ou supprimer les 64 collections en masse. Un écran regroupé peut lire les structures existantes avant toute migration de données.

Critères supplémentaires : déplacer un élément fonctionne au clavier et à la souris ; l’ordre reste après sauvegarde et actualisation ; une nouvelle publication ne déplace pas Featured ; une exclusion reste effective malgré les sources héritées ; un média privé n’apparaît jamais ; la même vidéo n’apparaît qu’une fois ; les URLs et le chargement des médias publics conservent les contrats existants.

## Direction visuelle recommandée

Base révisée : administration SaaS claire, compacte et structurée, avec identité MaxVideoAI conservée. Une première série de trois maquettes a été jugée trop épurée par Adrien ; elle n’est pas approuvée. Une deuxième série doit montrer davantage le travail réel : filtres, tableaux, sélection et détails contextuels.

- Fond blanc ou très légèrement teinté ; texte principal graphite ; une seule couleur d’accent pour les éléments actifs.
- Barre latérale de 208–224 px ; en-tête compact de 56–64 px ; contenu aligné sur une grille simple.
- Typographie principale de 14–16 px ; titres de 24–28 px ; chiffres alignés ; texte secondaire suffisamment contrasté.
- Espacements de 8, 12, 16, 24 et 32 px ; contrôles d’environ 32–36 px sur desktop ; lignes de table d’environ 44–52 px selon le contenu. Réduire les hauteurs d’en-tête inutiles, pas la lisibilité.
- Arrondis modestes de 6–8 px pour les contrôles. Pas de grands rectangles arrondis autour de chaque section.
- Hiérarchie par la taille, l’alignement et l’espace. Séparateurs avant bordures ; ombre réservée aux menus, dialogues et panneaux superposés.
- Rouge pour une erreur demandant réellement une intervention, orange pour une attente ou un avertissement, vert pour un état confirmé. Ne pas colorer chaque KPI pour remplir l’écran.
- Enlever les titres doublés entre barre supérieure et page, les explications sur l’architecture interne et les phrases qui vantent la densité de l’interface.
- Recherche globale comme un seul point d’accès ; filtres locaux explicitement limités à la liste courante.

La série visuelle V2 utilise des données fictives et montre trois écrans complémentaires : Transactions avec détail latéral, Overview avec listes opérationnelles, et Site placements avec sélection éditoriale et complément automatique. Modération et Articles devront ensuite vérifier la cohérence avec les médias et la lecture. Ces maquettes sont des images de principe, pas un prototype fonctionnel ni une preuve de disponibilité des données.

La V2 conserve des points à préciser : ne pas appeler un usage MCP une source d’inscription prouvée ; choisir des états financiers exacts et ne pas colorer « Pending » comme une erreur systématique ; rendre les totaux fictifs cohérents avant prototype ; ne pas laisser les poignées d’Automatic promettre un ordre manuel que ce mode ne conserverait pas. La règle de drag-and-drop détaillée ci-dessus est prioritaire sur ces approximations graphiques.

## Critères d’acceptation de la future refonte

1. Depuis l’accueil admin, inscriptions du jour et paiements reçus sont visibles sans défilement.
2. Les cinq destinations principales et Configuration tiennent dans le menu sans défilement à une hauteur de travail de 900 px.
3. Sur les listes, plusieurs lignes exploitables sont visibles dans le premier viewport à 1440 × 900 ; viser au moins huit lignes pour Transactions sans réduire excessivement la lisibilité.
4. Chaque métrique possède définition, période, fuseau, exclusion éventuelle des comptes internes et état de fraîcheur.
5. Une valeur absente n’est jamais remplacée par une donnée fictive ou un zéro rassurant.
6. Un compteur d’incidents ne compte que des cas correspondant à une action définie.
7. Retour, filtres et liens directs fonctionnent de manière cohérente ; les liens vers le site et les services externes sont identifiés comme tels.
8. Les filtres Aujourd’hui et 24 h sont distincts et testés autour de minuit et des changements d’heure.
9. Un article publié ne porte pas un état global « brouillon » sans explication de version.
10. Les permissions admin, confirmations commerciales, journaux immuables et règles de visibilité restent conservés.
11. Vérifier clavier, focus, lecteurs d’écran, contraste mesuré et affichage à 200 % ; les captures seules ne prouvent aucune conformité d’accessibilité.
12. Un futur opérateur retrouve sans aide les inscriptions, un paiement, une génération liée et un article à relire lors d’un essai guidé.

## Découpage futur, après validation du cadrage et des maquettes

1. **Définitions et inventaire final** : source déployée, outils effectivement utilisés, définitions des KPIs, inventaire des dépendances GSC, périmètres de date.
2. **Navigation et système visuel** : composants partagés sobres, anciens liens préservés ou redirigés explicitement, vocabulaire cohérent.
3. **Parcours quotidien** : Aujourd’hui, Utilisateurs, Transactions, détails et filtres.
4. **Production de contenus** : Modération, Articles, Site placements ; priorité forte à la simplification des playlists et à la préservation du drag-and-drop.
5. **Analyses et configuration** : fusion des synthèses, MCP en profondeur, rangement des réglages, retrait des consommateurs GSC inutiles après vérification.
6. **Recette et transmission** : scénarios opérateur, contrôles d’accès, états indisponibles, responsive, guide d’exploitation court.

Réutiliser les services et les contrats pertinents. Ne pas profiter de la refonte pour réécrire la facturation, réintroduire des mutations Membership ou changer de bibliothèque de données. Le guide `docs/engineering/admin-routes.md` impose de conserver les propriétaires commerciaux et le protocole aperçu → confirmation → application.

Tests à reprendre au moment du code : contrats admin dashboard, users, user-detail, transactions, jobs, commercial-routes, pricing, MCP et les parcours `tests/e2e/admin-critical-flows.spec.ts`. Les tests pertinents dépendront du lot réellement implémenté. Aucun test applicatif n’a été exécuté pour ce dossier sans changement de code.

Pour Site placements, ajouter à cette liste les contrats admin-playlists et les lecteurs de galeries publiques concernés. Consulter `docs/engineering/media-delivery.md` avant de changer les lecteurs, miniatures, priorités de chargement ou sources affichées.

## Points restant à discuter

- Langue et direction validées : anglais ; clair et minimal. Choisir ensuite la composition précise sur maquettes.
- Définition exacte de la file de modération souhaitée : sélectionner les meilleurs exemples publics, revoir les demandes de publication, ou aussi enquêter sur certains contenus.
- Pour les paiements, distinguer le besoin de contrôler les encaissements et celui de contrôler les crédits facturés/remboursés ; la proposition offre les deux avec des vues distinctes.
- Automatisation des galeries : intérêt exprimé, fonctionnement encore en discussion ; aucun accord implicite sur une migration ou une publication automatique. Drag-and-drop confirmé comme indispensable.

## Sources locales de conception

- `frontend/lib/admin/navigation.ts`
- `frontend/components/admin/AdminTopbar.tsx`, `TopbarSearch.tsx`, `AdminShell.tsx`
- `frontend/components/admin-system/shell/AdminSection.tsx`, `AdminFrame.tsx`
- `frontend/components/admin-system/surfaces/AdminFilterBar.tsx`, `AdminDataTable.tsx`
- `frontend/app/(core)/admin/_components/AdminDashboardView.tsx`
- `frontend/app/(core)/admin/_lib/admin-dashboard-helpers.ts`
- `frontend/components/admin/TransactionTable.tsx`, notamment `needsReview`
- `frontend/app/(core)/admin/users/_components/AdminUsersView.tsx`
- `frontend/app/(core)/admin/system/page.tsx`
- `docs/engineering/admin-routes.md`
- `tests/admin-commercial-routes-architecture.test.ts`

## Annexe — vues inspectées et captures

La numérotation suit la collecte. Chaque capture montre le viewport observé, pas nécessairement la page entière. Les constats de contenu plus bas dans les pages proviennent également de leur structure accessible. Les contrastes faibles signalés ci-dessous sont des risques visuels, pas des mesures WCAG.

### 1. Utilisateurs — base utile, hiérarchie à alléger

Recherche et pagination présentes. UUID, rôles et sécurité occupent beaucoup de largeur ; quatre chiffres et plusieurs encadrés repoussent la liste. Risque de lisibilité sur les petites légendes et de défilement horizontal sur écran étroit. Navigation au clavier et contraste à mesurer.

![Utilisateurs](/Users/adrienmillot/Desktop/MaxVideoAi%20V2/output/admin-redesign-2026-09-22/01-users.png)

### 2. Dashboard — confiance et priorités à revoir

Les indicateurs et accès sont visibles, mais la recherche utilisateur est répétée, le contenu concurrence Insights et plusieurs indicateurs sont prédéfinis dans le code local. La courbe combine des personnes et des montants avec des échelles différentes, sans axe monétaire explicite. Des alternatives textuelles détaillées restent à vérifier.

![Dashboard](/Users/adrienmillot/Desktop/MaxVideoAi%20V2/output/admin-redesign-2026-09-22/02-dashboard.png)

### 3. Générations / Jobs — triage trop encombré

Filtres partageables et distinctions d’outcome utiles. Résumés et filtres masquent presque la table au premier écran. L’état « Action required » et le compteur « need attention » demandent une lecture différente insuffisamment explicite. Petits libellés et densité des statuts à vérifier au clavier et à fort zoom.

![Jobs](/Users/adrienmillot/Desktop/MaxVideoAi%20V2/output/admin-redesign-2026-09-22/03-jobs.png)

### 4. Insights — données utiles, répétitions excessives

Comparaisons et tendances disponibles ; même information répétée dans plusieurs formats. Panneaux et sous-panneaux concurrents. Conserver les analyses, réduire les résumés et expliciter les périmètres, notamment les mesures cumulées au milieu d’une vue périodique.

![Insights](/Users/adrienmillot/Desktop/MaxVideoAi%20V2/output/admin-redesign-2026-09-22/04-insights.png)

### 5. Transactions — outil central à prioriser

Liens utilisateur/génération et nature des mouvements présents. Recherche limitée au lot chargé ; « Needs review » inclut les lignes remboursables dans le code local. Table repoussée en bas et plusieurs zones de défilement visibles. Contraste, taille des cibles et restauration du contexte à vérifier dans la future recette.

![Transactions](/Users/adrienmillot/Desktop/MaxVideoAi%20V2/output/admin-redesign-2026-09-22/05-transactions.png)

### 6. Modération — bonnes bases visuelles, trop d’en-tête

Grille, aperçu et distinctions par type de média déjà présents. Métriques répétées, liens Jobs/SEO dispersés et contenu utile trop bas. Préserver la confidentialité et clarifier les destinations de publication. Nom accessible des médias et contrôle clavier de la sélection à vérifier.

![Modération](/Users/adrienmillot/Desktop/MaxVideoAi%20V2/output/admin-redesign-2026-09-22/06-moderation.png)

### 7. Liste des articles — simple mais état éditorial incomplet

Titres et versions repérables ; hash technique exposé au premier plan. La liste présente comme brouillon l’article dont la fiche annonce une publication réussie. Remplacer la priorité visuelle du hash par un état de publication explicite.

![Articles](/Users/adrienmillot/Desktop/MaxVideoAi%20V2/output/admin-redesign-2026-09-22/07-editorial.png)

### 8. SEO — valeur actuelle insuffisante pour le périmètre souhaité

Message d’absence de snapshot visible, mais nombreuses valeurs à zéro et multiples sous-outils. Les liens Raw GSC et Action Queue sont répétés. Décision utilisateur : externaliser les analyses vers Google ; préserver les actions de contenu nécessaires.

![SEO](/Users/adrienmillot/Desktop/MaxVideoAi%20V2/output/admin-redesign-2026-09-22/08-seo.png)

### 9. MCP — conserver en analyse secondaire

Les définitions différencient appels d’outils, générations et utilisateurs ; elles évitent plusieurs confusions. Premier écran dense, grande table et nombreuses explications. Ne pas appeler toutes ces mesures « acquisition » : l’usage d’un client MCP ne prouve pas la source d’inscription. Table à vérifier sur petite largeur et avec lecteur d’écran.

![MCP](/Users/adrienmillot/Desktop/MaxVideoAi%20V2/output/admin-redesign-2026-09-22/09-mcp.png)

### 10. Fiche article — publication compréhensible, état global contradictoire

Langues, contrôles, liens publics et demande de correction sont présents. « Private draft » cohabite avec « Article publié et pages vérifiées ». Les métadonnées et outils précèdent fortement le contenu à relire. Clarifier version de travail/publiée et placer les actions près d’une lecture centrale. Aucun bouton d’écriture ou de publication n’a été activé.

![Fiche article](/Users/adrienmillot/Desktop/MaxVideoAi%20V2/output/admin-redesign-2026-09-22/10-article.png)

### 11. Collections — refonte fonctionnelle prioritaire

64 collections annoncées, menu de familles/modèles très long, nombreuses commandes techniques et formulaire désactivé au premier plan. Les médias à ordonner se trouvent plus bas. L’ordre est déjà modifiable par glisser-déposer avec sauvegarde ; ce contrôle doit être préservé et rendu plus direct. Une alternative clavier et la lisibilité du résultat réel des compléments sont à vérifier. Aucun déplacement ni enregistrement n’a été effectué pendant l’inspection.

![Collections](/Users/adrienmillot/Desktop/MaxVideoAi%20V2/output/admin-redesign-2026-09-22/11-collections.png)

## Maquettes de conception

Générées avec l’outil intégré ImageGen. Les prompts exacts sont dans `output/admin-redesign-2026-09-22/image-prompts.json`. Tous les noms, montants et statuts sont fictifs. Les images V1 sont conservées comme explorations rejetées ; la direction V2 a été acceptée, puis le passage au code explicitement autorisé.

Ordre d’affichage de la série V2 :

1. `output/admin-redesign-2026-09-22/concept-v2-01-transactions.png`
2. `output/admin-redesign-2026-09-22/concept-v2-02-overview.png`
3. `output/admin-redesign-2026-09-22/concept-v2-03-placements.png`

Les deux séries complètes restent disponibles dans le même dossier, sans écrasement.

## Invariant tarifaire confirmé à l’implémentation

La suppression des accès d’édition ne modifie ni les overrides DB, ni leur priorité, ni les règles versionnées, ni les arrondis, ni les caches commerciaux. Aucun seed, suppression de données ou migration de tarification dans cette refonte. La base de comparaison est le commit 772eb4d8a, avec inventaire des propriétaires tarifaires et tests existants. Toute bascule de gouvernance DB vers code est hors périmètre. La référence locale prouve l’absence de modification du moteur ; elle ne constitue pas un export des prix de production.
