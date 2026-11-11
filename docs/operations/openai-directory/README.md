# MaxVideoAI — candidature OpenAI, état au 11 novembre 2026

**On peut avancer avec les conditions standard des services. Il n'y a pas six contrats sur mesure à faire signer avant de préparer le plugin.** Fal est acquis via Vercel, selon la confirmation du propriétaire. Les clauses particulières qui s'appliquent réellement restent à respecter.

## Où on en est

- Nouvelle branche locale `codex/openai-directory-20261111`, créée sur le main distant vérifié `86db1bd37b683fb7c90aec15d1c4ea57cb9b4b06` (#645).
- Reprise ciblée des adaptations marketplace : OAuth et domaine dédiés, résultats structurés, présentation des médias, imports privés, compte existant sans achat dans ChatGPT, paquet de dépôt.
- Les nouveautés du main sont conservées : registre de 54 modèles publiés dans l'app, prix et règles d'exécution actuels, Studio, audio, outils créatifs, personnages et Recast. Ce nombre n'est pas une promesse de 54 modèles exécutables sur chaque hôte : les capacités et routes conservent leurs conditions habituelles.
- Avec toutes ses capacités activées dans le test local, le serveur du canal OpenAI expose 42 outils, dont les huit de Character Studio/Recast. Le paquet ne déverrouille aucun modèle.
- Candidat OpenAI **0.3.13** construit localement, textes EN/FR/ES et cinq scénarios positifs / trois négatifs. Source du plugin générique **0.3.9 non publiée** ; aucune version installée ni aucun registre distant modifié.
- Le registre des prestataires EN/FR/ES ajoute OpenAI à la génération de médias, conformément à la nouvelle route image 2.6 du code.
- Les schémas de sortie ajoutés sont limités au canal OpenAI. Les tests du MCP habituel et ses scénarios de sélection passent. Les prix sont lus dans les devis actuels, sans reprendre les anciennes promesses d'exports inclus.
- La page de prix informative reste accessible. Seules les actions de vente/recharge sont absentes du canal OpenAI, comme l'exigent les règles de ce canal.

## Le chemin restant : trois étapes

1. **Finir les éléments précis du dossier.** Aligner l'âge d'accès sur les exigences explicites de Fal/Google (les CGU locales indiquent encore 15 ans). Vérifier l'application des clauses des routes directes BytePlus/Luma/Alibaba aux conditions réellement acceptées ; utiliser les contrats standard et les pièces de compte existantes. Raccorder la notice de confidentialité, les modalités d'effacement, l'identité de l'éditeur et son support. Voir [les points exacts](droits-et-regles-2026-11-11.md) et [les textes préparés](pieces-a-finaliser.md).
2. **Essayer le candidat dans ChatGPT, sur l'environnement dédié.** Raccorder l'HTTPS, OAuth, un compte de revue avec médias/solde de test et les ressources de test. Rejouer les cinq scénarios positifs et trois négatifs puis enregistrer une démonstration. Cette étape sort du local ; elle demande un chiffrage actualisé et le contrôle des ressources dédiées avant toute activation. Le plafond historique de 20 € ne constitue pas un relevé du budget restant.
3. **Déposer le ZIP, puis publier après acceptation.** Vérifier l'organisation/projet OpenAI, le domaine, les accès du reviewer et la vidéo ; reconstruire le ZIP avec l'URL réelle de démonstration ; déposer pour examen. La publication reste une action séparée, après approbation.

Le projet OpenAI de dépôt doit actuellement avoir une résidence **globale**. Cela ne demande pas de déplacer la base Neon de Francfort, ni les bases habituelles.

## Ce qui est prêt à examiner

- [Éléments à finaliser et déroulé de démonstration](pieces-a-finaliser.md).
- [Conditions et fournisseurs : conclusions simplifiées et sources](droits-et-regles-2026-11-11.md).
- [Vérification locale et limites de cette qualification](qualification-2026-11-11/verification.json).
- [Canevas de raccordement sans secrets](qualification-2026-11-11/environment.template).
- ZIP sur disque : `.local/openai-directory-20261111/package/maxvideoai-openai-directory-0.3.13.zip`.
- Le JSON `.local/openai-directory-20261111/package/openai-directory-readiness.json` garde `readyToSubmit: false` jusqu'à la qualification réelle et la démonstration.

## Continuité de l'ancien travail

La branche du 23 octobre, `codex/openai-marketplace-main-20261023` à `5c700f2e5`, reste intacte. Sa fusion complète aurait également repris un chantier distinct d'effacement/admissions/uploads et 23 fichiers en conflit. Cette tentative a été annulée dans le nouveau worktree ; seuls les adaptateurs pertinents ont été réintégrés.

L'effacement actuel reste celui de main. Les anciennes preuves de purge ne certifient pas ce candidat. La vérification du parcours d'effacement réel et la cohérence de la notice restent nécessaires avant diffusion ; on n'impose pas par défaut toute la refonte historique pour compiler un paquet.

Aucun déploiement, push, dépôt OpenAI, email, appel de génération ni accès aux bases normales n'a été effectué pour cette reprise.
