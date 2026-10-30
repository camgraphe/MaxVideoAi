# État et contrôles — 28 octobre 2026

La section ci-dessous décrit la première livraison. Les modifications et contrôles de la version actuelle sont consignés dans [REFINEMENT-2.md](REFINEMENT-2.md).

## Branche et périmètre

- `main` local actualisé par fast-forward sur le `main` distant `04e7c53190dc7791eda8012861e9de6c226d654b`.
- Worktree isolé : `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/prompt-director-composer`.
- Branche : `codex/prompt-director-composer`.
- Le checkout Desktop, sa branche antérieure et ses fichiers non suivis ont été préservés.
- Livrables de cette étape : conception, guidelines sourcées, prototype HTML/CSS/JS autonome, cadre de revue responsive et captures.
- Aucun fichier de production modifié, aucune dépendance installée, aucun appel LLM ou génération payante, aucune migration appliquée, aucun push/fusion/déploiement.

## Relecture

La relecture indépendante du document de conception, demandée par la méthode de conception utilisée, n'a relevé aucune question importante empêchant de préparer un plan. Elle ne vaut ni validation utilisateur de l'interface ni audit de l'implémentation, qui n'existe pas encore.

## Contrôles de la maquette

Effectués dans le navigateur Codex sur un serveur local lié à `127.0.0.1` :

| Cas | Observation |
| --- | --- |
| Prompt → Avec Milo | Onglets et champs distincts ; le brouillon manuel est conservé. |
| Suggestion de démarrage → Envoyer | Le message apparaît, suivi d'une réponse prédéfinie et d'une proposition éditable. Avertissement de simulation visible. |
| Changement de format après réponse | Proposition marquée périmée et bouton Appliquer désactivé. |
| Nouveau message après changement | Nouvelle proposition applicable au contexte courant de la maquette. Le contenu demeure un exemple fixe, pas une réponse intelligente. |
| Appliquer puis Annuler | Passage au prompt manuel ; texte précédent restauré par Annuler. Aucune génération lancée. |
| Modifier une vidéo sans source | Source requise visible et bouton de génération désactivé. |
| Ajout d'une source d'exemple | Rôle et nom affichés ; contrôle de génération débloqué dans la simulation. |
| Menu + et Échap | Rôles visibles ; menu fermé par Échap et focus rendu au bouton. |
| Audio | Proposition étiquetée Script ; voix et réglages annoncés comme conservés. |
| Image | Champ et modèle illustratifs spécifiques, réglages distincts de la vidéo. |
| 390 et 320 px | Inspection visuelle du champ, des onglets, du menu + et des actions ; retour à la ligne des réglages à 320 px. |
| Thème sombre | Inspection visuelle de la conversation, de la proposition, des pièces jointes et de la barre d'envoi. |

Syntaxe des scripts intégrés contrôlée avec `node --check` après extraction temporaire. Les captures illustrent des états de revue ; elles ne sont pas des tests de non-régression pixel à pixel. Les contrôles finaux ne prétendent pas couvrir zoom 200 %, lecteur d'écran, toutes les langues, tous les rôles de référence ou tout le catalogue.

## Limites à garder visibles

- Le prototype ne branche ni le vrai Composer, ni les hooks, ni les capacités réelles, ni les devis, ni le ledger Milo.
- Les exemples sont fixes ; les références sont des objets de démonstration. Rien n'est importé, écouté, analysé ou envoyé.
- Le changement de surface charge un autre exemple ; ce comportement de démonstration ne décide pas de la persistance produit.
- Les scénarios de timeout, double envoi, conflit serveur, changement de compte, devis et règlement de crédits restent à implémenter et à tester.
- Le mode Prolonger n'est pas montré pour l'exemple Kling : l'intégration réelle devra conserver les extensions des modèles qui les prennent effectivement en charge.
- Aucun test de production n'a été lancé pour cette livraison documentaire. Ils seraient sans valeur comme preuve d'une fonctionnalité qui n'est pas encore intégrée.

## Suite

Relire la [conception](../../superpowers/specs/2026-10-28-prompt-director-design.md) avec le [prototype](review.html), puis préparer le plan d'intégration et ses tests à partir de la direction retenue. Conserver l'intégralité du périmètre vidéo/image/audio et l'usage des crédits Milo existants. L'esthétique seule ne marque pas l'assistant comme terminé.
