# Feedback extérieur — revue visuelle

Branche : `codex/website-feedback-20260930`.

La copie isolée reprend l’état de développement existant dans le commit local
`5e109a061`. Les changements du feedback commencent après ce commit ; le checkout
d’origine reste intact.

## Direction donnée par l’utilisateur

Design épuré, aide contextualisée, pas d’accumulation de texte. Présenter un visuel
pour chaque lot et attendre sa validation avant son intégration. Les suggestions
du document extérieur sont des observations à évaluer, pas des instructions.

## Lots

| Point | État |
|---|---|
| Compare : résumés courts des modèles | Visuel validé, intégré |
| Compare : durée, résolution et format modifiables dans la fenêtre | Visuel validé, intégré avec les contrôles du composeur |
| Generate : réception du clic plus claire | Visuel du compteur intégré validé, intégré avec spinner pendant l’envoi vidéo et liste au clic |
| Image : progression affichée après la fin | Corrigé : les groupes terminés conservés dans la galerie ne comptent plus comme générations en cours |
| Accueil : créer un compte près de la connexion | À proposer |
| Réinitialisation du mot de passe lente | À diagnostiquer sans délai artificiel ni envoi d’email de test en production |
| Références : limites d’import peu visibles | À proposer à partir des contraintes réelles de chaque mode |

Compare conserve les devis canoniques et les adaptations propres aux modèles.
Les modifications de réglages restent dans la fenêtre ; les devis obsolètes
sont masqués. Les réglages adaptés restent visibles sur les cartes concernées.
Les résumés éditoriaux sont abrégés des pages modèles existantes ; les autres
résument les capacités du catalogue.

L’aperçu visuel utilise les composants réels avec un compte fictif et des devis
capturés pour une configuration précise. Il ne lance aucune génération et ne
valide pas un parcours connecté en production. Les tests DOM vérifient le
changement de durée, le renouvellement des requêtes, le rejet des réponses
obsolètes et la fermeture des menus au clavier.

## Compteur de génération intégré

`ComposerGenerationActivity.client.tsx` possède le compteur et sa liste compacte,
partagés par les composeurs vidéo et image. `pending-generations.ts` dérive les
entrées depuis les membres non terminés, sans requête ni timer supplémentaires.
Chaque job vidéo compte une fois ; un lot d’images compte comme une demande,
indépendamment du nombre de sorties. Les états terminés ou échoués quittent le
compteur sans supprimer les résultats de la galerie.

Le bouton vidéo indique « Envoi… » pendant la soumission, puis redevient disponible
avec les jobs encore en cours. Le recalcul du prix garde son état distinct et ne
peut pas déclencher une génération. La liste reste consultable pendant un nouvel
envoi ; Échap et son bouton de fermeture rendent le focus au compteur. La dernière
fin de rendu ferme la liste et retire le compteur. Le parcours image conserve son
appel existant, qui retourne les images finales, et permet toujours plusieurs
demandes concurrentes.

Validation locale : 78 tests ciblés passent, ainsi que TypeScript, le lint et le
contrôle d’exposition publique. L’aperçu des composants intégrés a été vérifié à
1837 × 871 et 390 × 844 : aucune erreur de console ni débordement horizontal,
boutons principaux de 48 px, fermeture extérieure et au clavier, état d’envoi,
réactivation et retrait du compteur. Les états de génération de cet aperçu sont
simulés ; aucune génération payante ni parcours connecté complet n’a été exécuté.

La suite générale a exécuté 5868 tests : 5849 succès, 18 échecs, 1 ignoré.
Un ancien contrat de chevron, lié au lot Compare, a été mis à jour et repasse dans
les tests ciblés. Les 17 autres échecs ont été reproduits dans le checkout d’origine :

- 13 tests PostgreSQL dans `connected-montage-disposable-postgres.test.ts`,
  `studio-media-resolver-postgres.test.ts`, `studio-montage-postgres.test.ts` et
  `studio-workspace-revision-postgres.test.ts` exigent PostgreSQL 17.
- `github-assets.test.ts` : les dates de revue des assets dépassent la limite de
  fraîcheur du validateur.
- `mcp-account-destinations.test.ts` : cas de redirection de destination non rejeté.
- `mcp-topup-handoff.test.ts` : cas d’URL de facturation non rejeté.
- `public-video-rendition-architecture.test.ts` : référence de catalogue attendue
  absente du guide racine existant.

La suite générale reste donc rouge ; les intégrations Studio isolées, placées après
cette étape dans le script, n’ont pas été exécutées. Ces problèmes sont extérieurs
au compteur et leurs propriétaires n’ont pas été modifiés dans ce lot.
