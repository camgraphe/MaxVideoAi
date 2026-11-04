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

## Complément — lots 1 et 2, prix et paiement

119 tests ciblés passent sur la branche, avec les fournisseurs simulés et une
base PostgreSQL 17 jetable. Ce total correspond à la sélection de cette
intervention ; il ne s'ajoute pas aux 196 précédents, qui recouvrent d'autres tests.
La matrice de 37 tests a ensuite été rejouée après ajout de l'égalité intégrale
entre snapshot tarifaire du devis et du reçu : zéro échec.

- 27 combinaisons : i2v/ref2v/v2v × 480p/720p/1080p × 2/8/15 s, avec une même
  grille de test active. Estimation = devis = débit = reçu. Le snapshot et la
  révision restent liés, sans montant commercial de novembre codé en dur.
- Six cadrages, frontière 15+15 s, rejet 15+16 s, audio seul de 5,25 s et vidéo
  de 7,5 s sélectionnée dans un original de 25,6 s. L'audio et l'original complet
  ne sont pas facturés comme secondes vidéo supplémentaires.
- Portrait et produit d'identifiants inversés lexicalement : défaut reproduit en
  ref2v, corrigé par conservation de l'ordre. Le prompt désigne désormais image 1
  comme personnage, image 2 comme produit. Le payload réellement soumis au
  fournisseur simulé est vérifié dans les deux modes.
- Nano Banana 2.1 : six cas création/look × 1K/2K/4K. Une image, même montant et
  révision entre estimation, réservation et reçu ; seconde réservation idempotente.
  Les tests des produits Character Builder historiques passent toujours.
- Propriétaire/montant/devise/consentement altérés, expiration, changement de
  révision tarifaire et solde vidé après revue : aucun débit/job sur refus.
- Double clic, réponse perdue et reprise après expiration : un job, un appel
  fournisseur, un débit. Rejet terminal : un remboursement du montant exact.
  Acceptation inconnue : pas de remboursement ni de nouvelle soumission aveugle.
- Échec de copie du résultat puis récupération : même job fournisseur, deux
  tentatives de stockage, une publication du résultat et un débit conservé.
- Interface : récupération du même devis après réponse perdue, verrouillage du
  brouillon incertain, expiration des devis non confirmés, lien de recharge
  disponible même si le solde a baissé après la préparation, reprise après recharge
  et lien vers le job échoué plutôt qu'un second achat.

TypeScript et contrôle d'exposition réussis. ESLint : zéro erreur, sept
avertissements préexistants hors modification. `git diff --check` réussit.
Pas de nouvelle recette visuelle navigateur ; pas de qualification fournisseur.
La conservation d'une confirmation après rechargement complet reste au lot 3.

L'utilisateur a depuis précisé qu'une **preview doit permettre des rendus réels
avant production**, pour créer les futurs contenus Explorer/marketing. Cette
possibilité et ses raccordements sont documentés dans
[preview-and-pricing.md](preview-and-pricing.md). La branche n'est pas encore
déployée et le mode réel n'est pas activé. La marge Recast supérieure au modèle
direct est demandée, mais son montant exact n'est pas choisi : aucune nouvelle
politique commerciale ni modification du tarif direct dans cette intervention.
