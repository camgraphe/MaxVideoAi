# Retrouver un média sans lui donner un nom

## Constat vérifié

L’inspection en lecture seule du 9 novembre a confirmé le problème soulevé par
l’utilisateur : dans la vue des générations enregistrées, les 21 cartes visibles
portaient toutes le libellé « Média ». C’est un échantillon, pas un audit de tout
le compte. Les imports peuvent avoir un nom utile ; les noms techniques et les
libellés absents ne permettent pas d’organiser une bibliothèque de générations.
Les captures du compte restent privées, hors du dépôt.

Sur le main `86b598f8`, `private-asset-name.ts` lit `label`, `fileName`, `filename`
ou `originalName`. `asset-response.ts` n’expose pas de modèle ni de prompt
générique. `browse-sql.ts` recherche le prompt des candidats `job-output`, mais
le périmètre `saved` exclut ces candidats avant l’agrégation et les candidats
enregistrés ont `job_prompt=NULL`. Ce décalage est un constat du code ; il ne
constitue pas une reproduction live avec un prompt connu.

## Présentation proposée et simulée

- Le visuel entier reste le premier repère, avec une mosaïque aux proportions
  connues. La grille régulière et une liste de 52 px restent disponibles.
- Sous le visuel : modèle connu, sinon provenance/type, puis date et heure
  d’ajout. Il s’agit de faits, jamais d’un titre inventé à partir de l’image.
- La fiche donne le prompt disponible, le contexte, les dimensions et l’accès
  au nom technique. Une donnée absente reste absente.
- La recherche porte sur les mots du prompt, le modèle, le nom et un repère
  personnel facultatif. Le champ n’annonce pas une recherche visuelle ou
  sémantique. Aucun appel à un LLM ni renommage automatique n’est nécessaire.
- Un repère personnel sert aux scènes qu’on souhaite retrouver souvent. Il ne
  change ni l’identité, ni le fichier original, ni les références déjà choisies.
- Favoris et collections restent facultatifs. Leur recherche et les actions
  groupées affichent d’abord 30 collections, puis proposent de charger la suite.
- Les filtres et la sélection de gestion restent distincts du panier de
  références. Le panier conserve son ordre à travers filtres et dispositions.

## Contrats à préparer pour le produit

| Besoin | Propriétaire et limites |
| --- | --- |
| Contexte modèle | Projection serveur facultative depuis un job appartenant au compte, avec correspondance prouvée avec l’asset/output. Modèle issu du registre, pas déduit du nom du fichier ou de l’image. Enrichissement de la page bornée, sans requête par carte. |
| Prompt de la fiche | Lecture authentifiée à la demande, liée à la sélection courante. Ne pas sérialiser tous les prompts dans chaque page de grille ; le guide `media-library.md` interdit cette exposition globale. Annuler/ignorer les réponses d’une ancienne sélection ou d’un ancien compte. |
| Recherche des générations enregistrées | Définir la recherche sur les sources liées à l’identité prouvée sans rendre visibles les sorties exclues. Garder l’isolement propriétaire, les filtres d’affichage, la déduplication et le total exact. Couvrir `all`, `saved`, `review`, imports, alias et sources manquantes par les tests PostgreSQL. |
| Filtres modèle/période | Ajouter explicitement les champs au schéma serveur et au scope signé des curseurs/snapshots. Identifiant de modèle normalisé ; bornes temporelles et fuseau explicites. Ne pas envoyer les libellés mock directement à l’API actuelle. |
| Repère personnel | Définir un propriétaire canonique pour le libellé de l’organisation du média, avec validation de longueur et révision. Ne pas écrire successivement dans tous les alias ni renommer les fichiers, jobs et URLs. Une suppression du repère rétablit les faits disponibles. |
| Recherche de collections | GET actuel : `limit` et `cursor`, pas `q`. Prévoir une recherche serveur paginée, ou annoncer une recherche limitée aux pages chargées. La recherche sur les 1 000 fixtures locales n’est pas une capacité serveur actuelle. |
| Actions et destinations | Réutiliser les propriétaires actuels de téléchargement, favori, corbeille, partage, source, outils et actions vidéo. Sous-titres a aussi sa bibliothèque documentaire. La démo illustre les passages de relais, sans certifier les capacités des modèles. |

## Intégration et validation

La PR 638 est fusionnée et cette branche inclut le main `86b598f8`. Les modules
applicatifs n’ont pas été modifiés par la proposition. Une intégration doit
réutiliser les composants et hooks partagés actuels, leurs identités canoniques,
les accès signés et les contrats de références directes/par lot livrés par 638.

La correction de mosaïque étend le layout React Aria existant avec les dimensions
connues des médias : les hauteurs de toutes les cartes sont établies avant un
saut de défilement. Le chargement d’une image ne peut plus agrandir le contenu
estimé en bas de la liste. Les dimensions inconnues ont un cadre carré stable.
Le texte de légende reste sur une ligne fixe ; les contrôles de sélection ont
une cible de 44 px malgré leur case visible plus petite.

La QA du prototype porte sur l’ergonomie, la géométrie, les identités, les états
et le rendu de données synthétiques. Elle ne mesure pas la latence SQL, les
Core Web Vitals de production, les comptes réels ni les erreurs réseau. Une
intégration nécessite les validations authentifiées desktop/mobile, EN/FR/ES,
accès privés, pagination et parcours outils, puis la voie normale PR/Quality
CI/main/Vercel décrite dans le dépôt.

Référence de l’API de rendu existante :
[React Aria Virtualizer](https://react-aria.adobe.com/Virtualizer).
