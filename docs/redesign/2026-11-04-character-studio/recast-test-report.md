# Recast — reprise des tests du 4 novembre 2026

Branche `codex/character-studio-v2`. Préversion locale sur le port 3016.
Le rendu fournisseur reste désactivé. Aucun job ni débit ajouté pendant les six
répétitions locales. Aucun tarif, secret ou environnement de production modifié.

## Corrections

- Un passage 1,1–16,1 s pouvait être refusé comme dépassant 15 s, à cause de
  la soustraction en virgule flottante. Le sélecteur partagé, la validation serveur
  et Recast utilisent maintenant le même calcul de durée. Les bornes choisies
  restent intactes. Un dépassement réel de 1 microseconde reste refusé et une limite
  dérivée des images, comme 56/24 s, conserve toute sa précision.
- Le lecteur Recast applique maintenant l'arrêt dès que la position atteint la fin
  sélectionnée, en vidéo comme en audio. Relancer la lecture revient au début choisi.

## Vérification des passages

La répétition locale réutilise une vidéo de 25,6 s et un audio de 22 s déjà importés.
La sélection vidéo 18–25,5 s produit 7,5 s. La sélection audio 8,25–13,5 s produit
5,25 s. Les fichiers sont réellement découpés et mesurés avec FFmpeg.

Un test supplémentaire utilise une vidéo rouge puis bleue et un son à 440 puis
880 Hz. Les extraits tardifs contiennent bien l'image bleue et le son à 880 Hz,
avec les durées attendues. Les originaux ne changent pas.

## Prix observés

Tarifs publics vérifiés le 4 novembre 2026 en USD, cadrage 9:16, avec une référence
audio. Ce sont des lectures du tarif courant, pas des devis réservés dans le
portefeuille. Les prix pourront évoluer avec la grille publique.

| Vidéo sélectionnée | Sortie demandée | Résolution | Prix public vérifié |
| --- | --- | --- | --- |
| 7,5 s | 8 s | 480p | 1,37 $US |
| 7,5 s | 8 s | 720p | 2,83 $US |
| 7,5 s | 8 s | 1080p | 5,65 $US |
| 7,5 s | 12 s | 720p | 3,55 $US |
| 15 s | 15 s | 720p | 5,46 $US |
| Aucune | 30 s | 720p | 5,46 $US |

Les six préparations renvoient les durées mesurées et aucun identifiant de devis
confirmable. Les comptes de jobs et de débits de la base de test sont inchangés.
La route de confirmation répond toujours `409 RENDER_DEFERRED`.
La matrice HTTP couvre également des sorties de 2, 4 et 30 s, avec et sans vidéo,
et refuse une combinaison de 15 s de source avec 16 s de sortie.

## Parcours et contrôles

- Annuler le découpage conserve les passages déjà validés.
- Remplacer la vidéo invalide la revue du prix et conserve l'audio indépendant.
- Les changements de durée, résolution et cadrage sont transmis à la préparation.
- Une réponse ancienne ne restaure pas le prix après une modification du brouillon.
- Modifier la durée réutilise les originaux importés et conserve les bornes.
- Le dialogue suggère une durée à 150 mots/minute. L'audio puis la vidéo ont priorité.
  Une durée manuelle reste choisie jusqu'au retour explicite en automatique.
- Une référence audio ne devient pas une durée de vidéo d'entrée facturée.
- Quitter puis revenir dans Recast conserve le brouillon et sa revue inchangée.

Validation finale : 196 tests ciblés réussis, dont PostgreSQL jetable, vrais médias
FFmpeg, contrôles React sous JSDOM et contrats de tarification existants.
TypeScript, contrôle d'exposition et `git diff --check` passent. ESLint donne zéro
erreur et les sept avertissements préexistants hors de cette modification.

Le contrôle local du navigateur est désactivé dans les réglages du compte Codex.
Aucune nouvelle vérification visuelle dans un navigateur n'est revendiquée.
Le rendu fournisseur réel et le débit réel restent reportés sur décision utilisateur.
