# Bibliothèque média — contrat de non-régression

9 novembre 2026. La direction visuelle du prototype a été retenue par l’utilisateur : bibliothèque commune compacte, collections facultatives, formats entiers et sélection multiple. Sa demande supplémentaire est explicite : conserver les options actuelles de l’app et améliorer les parcours. Ce dossier prépare ce raccord ; il ne prétend pas que le prototype est déjà intégré.

## Ce qui est vérifié

Le code a été comparé sur `5135e4e2b`, basé sur `main` à `6e12d08ca`. Un `git fetch origin main` n’a trouvé aucun commit de production plus récent au moment de l’audit. Ce constat ne vérifie pas le déploiement en ligne.

- **84 tests existants de composants, contrats et parcours client passent.** Ils exercent notamment les accès privés, les changements de compte, les sélecteurs, les téléchargements, les références et les destinations.
- **16 contrôles PostgreSQL passent**, sans omission, sur bases jetables : pagination, isolation, routes de lecture et propriété des aperçus. Aucune base client n’a été modifiée.
- Une reproduction supplémentaire sur les composants réels confirme **trois écarts non couverts** par ces tests. Les deux contrôles positifs associés passent. Les résultats ne sont donc pas résumés comme « tout fonctionne ».
- Les 26 contrôles navigateur du prototype restent un essai distinct, décrit dans [sa vérification](../prototype/VERIFICATION.md). Ils ne prouvent ni la persistance des nouvelles fonctions ni la vitesse du produit connecté.

[Résultats des tests de base](baseline-tests.json) · [Résultats des reproductions](known-gaps-results.json) · [Script reproductible](probe-known-gaps.ts)

## Options à conserver dans l’interface adaptée

| Domaine | Engagement de parité |
| --- | --- |
| Médias et navigation | Images, vidéos et audio ; distinction médias enregistrés/sorties récentes ; sources importées et sources outils ; liens directs existants avec filtres et génération ciblée. |
| Recherche et chargement | Recherche serveur, pages de 30 et curseurs stables, états vide/erreur/chargement, ajout d’une page sans perte de position ou de sélection. Un total ou un tri global doit provenir du serveur. |
| Consultation et téléchargement | Ratio entier, durée et dimensions mesurées, aperçu progressif, original exact et téléchargement autorisé. Garder le partage et les réglages réellement disponibles sur la source. |
| Générations | Bon output d’un job à plusieurs sorties, sauvegarde explicite, réglages/recette, destinations conditionnelles, Modify/Extend et Seedance Draft→Final là où ces actions existent. Activity reste propriétaire de l’historique et des paramètres de génération. |
| Sélecteurs | Champ et rôle ciblés, ordre, ajout/remplacement, types et limites du modèle actif, éligibilité et explication du refus ; maintien du brouillon et retour correct après aperçu/import/annulation. |
| Outils | Les 14 destinations du handoff actuel, Studio séparé et les chemins spécialisés Character Studio, Recast, Storyboard et Audio. Les 7 exemples du prototype ne deviennent pas la liste du produit. |
| Studio et personnages | Références de conversation, ajout/remplacement dans la timeline et personnages/looks conservent leurs identités, limites et propriétaires distincts. Les plafonds de démonstration 4/12 ne s’appliquent pas au produit. |
| Import et langues | Transports actuels image/audio/vidéo, multipart vidéo, annulation et changement de compte ; file et réussites partielles ; textes et actions EN/FR/ES. |

Les preuves détaillées et les scénarios associés figurent dans [l’inventaire bibliothèque](library-parity.md), [l’inventaire outils](tool-parity.md) et [les contrats de livraison](delivery-contracts.md).

## Trois écarts maintenant reproduits

1. **La page Media perd une identité et la durée.** Avec une réponse API contenant un `id` interne, un `assetId` public, sa `ref` et une durée audio, le mapping de page conserve l’ID interne mais perd les trois autres champs. Le modèle commun doit être sans perte ; identifiant de mutation, référence publique, origine et liens temporaires restent distincts.
2. **Le sélecteur Creator désactive un média pourtant valide.** Un asset possédant une référence publique correcte est refusé lorsque son ID interne ne commence pas par `ma_`. Le même composant accepte le contrôle positif dont l’ID est déjà public. L’éligibilité doit consulter la vraie référence détenue et conserver les contrôles de type/propriété.
3. **Une insertion refusée ferme quand même le panneau Recent.** Le callback d’insertion est appelé une fois, renvoie un message de refus, puis le panneau se ferme. En cas de refus, il doit rester ouvert avec la source et la possibilité de corriger le choix ; le contrôle de réussite doit continuer à fermer le panneau.

Ces reproductions tournent en JSDOM sur les propriétaires client réels, avec auth/réseau contrôlés. Elles ne prétendent pas reproduire une session client en production. La reproduction Creator vérifie l’activation de la carte, pas une sélection complète ; celle de Recent mesure l’appel de fermeture, sans monter le parent qui retire le panneau. Une relecture indépendante a confirmé la validité de ces constats et ces limites. Le script termine avec **le code 2 tant que les écarts subsistent**, et avec 1 en cas d’erreur de fixture. Il reste volontairement hors de la découverte normale des tests.

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json experiments/media-library/integration-audit/probe-known-gaps.ts
```

## Règles nécessaires avant de brancher les nouveautés

- **Corbeille réellement restaurable.** Le DELETE actuel peut libérer des objets pour nettoyage ; il ne fournit pas le contrat de restauration affiché par le prototype. Définir conservation, restauration idempotente et protections des usages avant d’afficher cette promesse. Ne pas confondre retrait d’une collection, masquage d’Activity et suppression du média.
- **Collections, favoris et lots persistants.** Leurs états du prototype sont en mémoire. Ils demandent des contrats serveur détenus, migrations Neon et tests d’isolation, de concurrence et de réussite partielle. Aucune purge automatique ou modification de conservation n’est décidée ici.
- **Sélection à portée explicite.** « Sélectionner les éléments chargés » est distinct de « sélectionner tous les résultats ». Cette seconde action exige un ensemble serveur figé, un total exact et des exclusions. Les médias arrivant ensuite ne rejoignent pas silencieusement le lot.
- **Suppression cohérente entre lecteurs.** Répercuter les mutations dans les filtres/pages SWR et les sélecteurs, ignorer une réponse ancienne, conserver l’isolation des comptes et empêcher la réapparition d’un média retiré. Qualifier aussi le cas des anciennes lignes `user_assets` sans ligne canonique.
- **Accès privé récupérable.** Les liens signés durent actuellement 300 secondes et certains handoffs 10 minutes. Renouveler l’accès au même média avec une reprise bornée, conserver son identité et éviter les boucles ou les réponses d’un ancien compte. Le bouton de reprise actuel ne suffit pas à renouveler une signature.
- **Performances mesurées sur les vrais lecteurs.** Comparer chargement initial, défilement paginé, ouverture image, premier Play, changement/fermeture et reprise après expiration, sur données et conditions comparables. La virtualisation ne borne ni toutes les métadonnées ni les octets transférés. Le transfert historique d’environ 13 Mo et l’impression de 20 secondes ne sont pas des mesures reproduites lors de cet audit.

## Ordre de raccord recommandé

1. Modèle média sans perte, identités, renouvellement d’accès et invalidation partagés, avec les trois reproductions transformées en régressions corrigées.
2. Grille et lecteur compacts sur les données paginées réelles, en réutilisant les actions existantes et leurs règles. Conserver les routes et les propriétaires métier, ainsi que SWR.
3. Contrats persistants de collections/corbeille/lots et parcours de sélection complet, puis migration des familles de sélecteurs avec leurs modes particuliers.
4. Vérification complète des options et des liens de chaque surface sur ordinateur et mobile, mesures comparables avant/après et revue d’intégration avant livraison.

Ce découpage organise la migration vers le même système partagé. Il ne réduit pas la refonte à un changement de présentation. Aucun email, génération payante, changement de média client ou déploiement n’a été effectué dans cet audit.
