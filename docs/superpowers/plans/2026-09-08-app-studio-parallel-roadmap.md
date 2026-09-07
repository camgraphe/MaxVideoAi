# Suite app et Studio en parallèle — 8 septembre 2026

## Point de départ

L'app est qualifiée à `0eb139aa5` sur `codex/app-catalogue-validation` (source `45c45a812`, 4469 tests, build861pages). Le premier chargement d'Activité reste mesuré à17–18s; aucune amélioration de latence n'est revendiquée.

Studio existe sur `codex/maxvideoai-editor`, commit `6165afc34`, dans `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/maxvideoai-editor-run`. Cette copie contient des changements suivis et deux nouveaux fichiers non commités, notamment certification des modèles et faits de génération partagés entre devis et soumission. Il faut préserver cet état sans écrire dans cette copie. La tâche historique est `EDITOR V1 bis` (`019eb877-1d5d-7a53-ba8c-a544be6eb66e`).

## Fil principal : app

1. Isoler et corriger le délai d'Activité avec des mesures comparables par phase (auth, accès aux données, enrichissement, réponse et affichage). Préserver recherche/filtres, pagination, isolation et sources. Une baisse du nombre de requêtes n'est pas un résultat de latence.
2. Compléter la continuité du brouillon : comparer les devis des modèles dans des conditions équivalentes; présenter les adaptations avant changement; créer une référence dans une autre activité et revenir au rôle/emplacement initial sans perte. Vérifier ce qui est déjà réel avant toute réimplémentation.
3. Qualifier ces parcours, wallet/prix, états réels et mobile, puis intégrer les raccords Studio après revue des contrats communs.

## Fil parallèle : Studio et canevas

Créer une nouvelle tâche et une nouvelle worktree. Partir des sources actuelles de l'éditeur et de l'app qualifiée après inventaire des divergences. Les branches sources et leurs fichiers non commités restent intacts. Les changements locaux récupérés doivent être explicitement listés et tracés dans la nouvelle branche.

Séquence confiée :

1. Inventaire des actions et de la persistance existantes, capacités certifiées, prix, références typées et audio. Plan d'implémentation versionné avant modifications importantes.
2. Refonte réelle des blocs, menus, inspecteur, insertion, connexions et canevas. Conserver la direction sobre MaxVideoAI; emprunter aux jeux vidéo la lisibilité de la sélection, les retours immédiats et les petites animations utiles. Typographie/pictogrammes cohérents, moins de texte et de panneaux imbriqués. Les actions tactiles/au clavier remplacent toujours un geste de dépôt possible. Respecter réduction des animations et performances.
3. Relier la bibliothèque/récents image-vidéo-audio au projet et aux destinations réellement prises en charge (canevas/timeline). Réutiliser IDs et originaux, isoler les comptes, annuler/retirer/remplacer sans perdre les médias ni le projet.
4. Première tranche MCP : ordre explicite des clips vidéo vers une nouvelle timeline persistée. Partager les commandes métier avec l'UI; propriété, idempotence, sauvegarde et coexistence autosave doivent être démontrées. Le `prepare_montage` actuel est un plan non persisté, désactivé par défaut : ne pas le présenter comme un montage enregistré. Audio visible et conservé; pas d'édition audio avancée implicite.
5. Vérification visuelle dans le navigateur (desktop/mobile, clair/sombre), tests pertinents et livrable exécutable dans sa prévisualisation propre, puis revue avant intégration.

## Frontières pour éviter les conflits

- Le fil principal possède les créateurs hors Studio, Activity, les propriétaires de bibliothèque/réutilisation existants et la feuille de style globale de l'app.
- La tâche Studio possède les routes/composants/styles locaux Studio, son adaptateur de médias et la tranche de montage MCP. Elle documente et isole dans un commit distinct tout changement indispensable d'un contrat partagé; pas de remplacement global des composants app ni de copie divergente du registre modèle/devis.
- Le fil Studio utilise un port libre autre que3026 et conserve les branches sources. L'intégration finale est réalisée seulement après revue des deux côtés.
- Pas de push, fusion dans main, déploiement, génération payante ou écriture en production. Essais de persistance sur environnement jetable explicitement identifié; aucune migration automatique contre une URL distante héritée.
- La copie Neon de qualification app expire le10septembre2026 à16:43:50UTC; elle n'est pas une autorisation générale d'écriture pour Studio. Aucun secret ne doit être transféré dans un prompt ou une documentation.

Références : `docs/design/global-app-concept/visual-rules.md`, `integration-contract.md`, `experience-map.md`, `docs/engineering/app-experience.md`, `mcp-montage-preparation.md`, instructions et contrats propres à Studio dans sa branche.

## Extension demandée et tâches lancées

L’utilisateur a ensuite demandé une tâche Billing/Wallet, autorisé d’autres chantiers parallèles pertinents et exigé Astra pour toutes les tâches déléguées. Trois tâches sont lancées, chacune dans sa worktree, avec le modèle explicitement réglé sur `gpt-6-astra` :

| Périmètre | Tâche | Worktree |
|---|---|---|
| Studio, canevas, médias et montage MCP minimal | `01a07e2a-7f4d-7c83-b24d-11b6008f00d9` | `/Users/adrienmillot/.codex/worktrees/dce6/MaxVideoAi V2` |
| Billing/Wallet, recharge, transactions et factures | `01a07e2c-1d46-7ef2-bdc5-abc017ee2332` | `/Users/adrienmillot/.codex/worktrees/6820/MaxVideoAi V2` |
| Cause et correction de la latence Activity | `01a07e2c-ba9d-73d2-8a87-07f7efc04d14` | `/Users/adrienmillot/.codex/worktrees/0b3f/MaxVideoAi V2` |

La priorité1 du fil principal (latence Activity) est donc confiée à la troisième tâche, qui possède le chemin de chargement et les adaptations ciblées nécessaires des helpers et tests, sans refonte visuelle supplémentaire. Billing possède ses composants/hooks/styles locaux et prépare séparément tout contrat nécessaire au wallet d’en-tête; politique tarifaire, configuration Stripe live et paiements réels sont hors scope. Les tâches partent du projet par défaut et doivent composer le socle app qualifié dans leur copie : elles ne sont pas présumées avoir hérité automatiquement de cette branche.

Le fil principal conserve comparaison des devis, adaptation des modèles, continuité des références/brouillons, cohérence visuelle et intégration finale. Chaque tâche fournit commits, prévisualisation sur port distinct et preuves de validation. Rien n’est automatiquement fusionné ou déployé.

## Quatrième tâche : Toolbox visuelle et parcours outils

À la demande explicite de l’utilisateur, la tâche `01a07e3c-37a3-7691-a1c1-497e34094416` est lancée en `gpt-6-astra`, dans `/Users/adrienmillot/.codex/worktrees/8710/MaxVideoAi V2`. Elle reprend le prétravail de « Étudier une toolbox d’outils » (`01a07dd1-19cc-7430-bf1b-8f09f70cdf00`) et le brief actualisé le 8 septembre : `/Users/adrienmillot/Desktop/MaxVideoAi V2/docs/plans/2026-09-07-maxvideoai-toolbox-discovery-brief.md`. Elle compose le socle app `cf5acc60f` dans sa propre branche après audit des divergences ; les sources restent intactes.

Le mandat couvre la conception et l’implémentation d’une vraie boîte à outils : petites tuiles par résultat attendu, ateliers créatifs plus développés, menus et surfaces de travail refondus, médias d’entrée, devis exact, exécution, progression et réutilisation des résultats. Le catalogue et les fonctions existants doivent rester exécutables. Les nouveaux candidats du brief sont sélectionnés selon qualité, fiabilité et rapport qualité/prix ; une recherche fournisseur ne vaut pas qualification ni autorisation d’un benchmark payant. Les tarifs existants ne changent pas comme effet de bord visuel.

L’utilisateur insiste sur une esthétique forte, y compris figurative. Chaque famille doit disposer d’un langage visuel soigné : illustrations explicatives, compositions avant/après adaptées, pictogrammes cohérents et retours de sélection/mouvement utiles. Cette exigence concerne autant les panneaux ouverts que les vignettes. Distinguer illustration et véritable résultat ; respecter mobile, clavier, réduction des animations et coût de rendu. La simple grille de cartes génériques ne suffit pas.

Frontières acceptées par Studio ; le contrat détaillé reste à finaliser entre les deux tâches :

- Toolbox possède les identités produit stables, le catalogue, l’éligibilité média, les schémas de réglages, les parcours standalone et la surface réutilisable des outils.
- Studio possède leur présentation dans ses menus, blocs et inspecteur, les adaptateurs canevas/timeline et la persistance du projet. Son raccord SFX historique et son montage MCP minimal restent dans son périmètre.
- Partager `toolId`/version, IDs de médias, contraintes, devis serveur, cycle de job, sorties et filiation ; ne pas dupliquer l’exécution ni stocker les endpoints fournisseurs dans les projets. Les changements partagés indispensables sont isolés et documentés.
- Synchronisation envoyée aux deux tâches : premier point sur le contrat avant de figer les blocs, second point sur un parcours Outils → Studio effectivement essayé avant livraison. Toolbox a confirmé son démarrage ; Studio a confirmé les frontières et partagé ses adaptateurs existants, avec un contrat additif et une migration progressive des blocs.

Le fil principal conserve le style global et la revue d’intégration. La prévisualisation Toolbox utilise un port libre différent de 3026 et 3032. Les limites d’exécution, de données et de publication des autres tâches s’appliquent également.

## Cinquième tâche : Audio, voix, musique, SFX et ambiances

La tâche `01a07e47-84df-7543-996d-74d39d496c67` est lancée en `gpt-6-astra`, dans `/Users/adrienmillot/.codex/worktrees/1d03/MaxVideoAi V2`. L’utilisateur demande une refonte complète et insiste sur les effets sonores et les ambiances. Cinq intentions guident l’interface : voix off, musique instrumentale, musique avec chant, SFX ponctuels et ambiances continues. Le workflow utile de sonorisation d’une vidéo reste disponible ; narration sur musique et paroles chantées doivent être distinguées.

La piste historique de voix off est vérifiée dans les requêtes YouTube `production/audio/VO02/request.json`, `SHORT01/request.json` et le ledger Astra : `fal-ai/minimax/speech-02-hd`, voix `English_FriendlyPerson`, vitesse 1.06. Cela documente une utilisation passée, sans prouver une disponibilité, un prix ou une supériorité actuels. La tâche vérifie les chemins d’exécution/devis réels et les sources officielles avant de choisir les modèles adaptés.

Audio possède les parcours de création audio autonome et leurs surfaces réutilisables. Studio conserve l’insertion, la timeline, le canevas et la persistance des pistes/projets, y compris son adaptateur SFX historique. Toolbox conserve les outils de transformation ; les trois tâches se coordonnent sur les identités, sources, durées, devis, jobs, résultats et actifs originaux. Le contrat Toolbox initial `faf137284` et sa direction figurative `cb57905b8` ont été transmis pour éviter des interfaces divergentes. Les nouveaux SFX et ambiances ne créent pas implicitement un périmètre de montage MCP audio avancé.

Livrables : inventaire concret, plan, direction visuelle exécutable tôt, intégration des fonctions et prix réels, lecteur et états adaptés, qualification desktop/mobile, clair/sombre, EN/FR/ES. Les modèles et résultats non qualifiés ne sont pas présentés comme acquis. La tâche compose le socle app `a0faf2d49` dans sa propre branche après inspection des divergences ; elle ne modifie pas le shell global ni les hooks vidéo du fil principal. Les limites de données, appels payants et publication ci-dessus restent applicables. Démarrage et coordination confirmés.
