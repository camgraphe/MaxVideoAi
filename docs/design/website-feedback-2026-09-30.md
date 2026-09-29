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
| Generate : réception du clic plus claire | Proposition à valider : spinner dans le bouton pendant l’envoi |
| Image : progression affichée après la fin | Proposition à valider : ligne compacte, fondée sur les jobs non terminés |
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
