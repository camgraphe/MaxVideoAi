# MaxVideoAI — candidature OpenAI, état au 11 novembre 2026

**On peut avancer avec les conditions standard des services. Il n'y a pas six contrats sur mesure à faire signer avant de préparer le plugin.** Fal est acquis via Vercel, selon la confirmation du propriétaire. Les clauses particulières qui s'appliquent réellement restent à respecter.

## Où on en est

- Branche isolée `codex/openai-directory-20261111`, maintenant poussée sur GitHub, créée sur le main distant vérifié `86db1bd37b683fb7c90aec15d1c4ea57cb9b4b06` (#645).
- Reprise ciblée des adaptations marketplace : OAuth et domaine dédiés, résultats structurés, présentation des médias, imports privés, compte existant sans achat dans ChatGPT, paquet de dépôt.
- Les nouveautés du main sont conservées : registre de 54 modèles publiés dans l'app, prix et règles d'exécution actuels, Studio, audio, outils créatifs, personnages et Recast. Ce nombre n'est pas une promesse de 54 modèles exécutables sur chaque hôte : les capacités et routes conservent leurs conditions habituelles.
- Avec toutes ses capacités activées dans le test local, le serveur du canal OpenAI expose 42 outils, dont les huit de Character Studio/Recast. Le paquet ne déverrouille aucun modèle.
- Candidat OpenAI **0.3.14** téléversé en **brouillon** : métadonnées **No findings**, skills `plan` et `generate` **Checks passed**. Source générique 0.3.9 non publiée.
- Premier hébergement Git réussi sur le seul projet `maxvideoai-openai-review-20261111`, commit `5312a21fa05ed6bd0f85f08bca4970b6e5be1f8d`. HTTPS validé sur `openai-review.maxvideoai.com` et `openai-mcp.maxvideoai.com` ; domaine vérifié par OpenAI et découverte OAuth disponible.
- Connexion navigateur du reviewer réussie ; CGU/confidentialité/cookies et majorité acceptés après accord explicite. Profil créé, quatre consentements enregistrés, solde affiché 0 $, aucun job ni reçu. Session fermée après le test.
- **OAuth fonctionne maintenant** dans le brouillon de diagnostic **MaxVideoAI OAuth Test 0.3.15** : **Authorized**, domaine vérifié et **42 outils découverts** (41 publics, téléchargement privé pour l'interface). Après accord explicite, le hook d'audience existant a été activé avec le seul client dédié et le reviewer fictif a approuvé les scopes d'identité/renouvellement. Les huit contrôles du hook passent ; le runtime accepte la connexion réelle. Renouvellement réel, audience du jeton renouvelé et révocation de la seule session de diagnostic sont maintenant vérifiés ; les deux sessions OpenAI existantes sont préservées. L'ancien brouillon 0.3.14 est conservé ; l'identité de diagnostic doit être réconciliée avant dépôt final.
- **Correction de formulation validée par le scan final** : `get_model_details` ne présente plus de remarque. Le runtime dédié est à `95be72898`, avec les 42 outils conservés. Le scan terminé à 17:29 UTC demande désormais un examen supplémentaire pour cinq outils : comparaison des prix, préparation de génération et les trois audio, sans motif précis. Le portail affiche encore **Configuration incomplete**, malgré **Authorized / Domain verified** et la découverte complète. Le filtre MCP Blocking reste vide ; ce contraste ne permet pas de déclarer le dossier prêt. Voir [les preuves et explications préparées](qualification-2026-11-11/scan-et-suite.md).
- **Essais sans dépense** : sept outils de lecture répondent ; le catalogue contient les modèles, mais aucun mode ne peut générer sans ses clés fournisseurs. Un défaut de schéma masquait le refus de comparaison de prix ; correction locale validée sur les 42 outils OpenAI, livraison dédiée en cours. Voir [le relevé précis](qualification-2026-11-11/oauth-et-essais-sans-depense.md).
- Base de test mise à niveau (138 tables), puis remise en pause à la fin de l'essai. Les 18 crons du projet dédié sont désactivés via Vercel, sans supprimer leurs fonctionnalités. Fournisseurs, workers, crédits et médias de démonstration restent à raccorder.
- Isolation Git renforcée au niveau du projet, indépendante du contenu de main. Le déploiement déclenché par main `c501acf9ed4e139914a7502c8b3498ce758d59c8` (#646, autre chantier) a été **CANCELED** sur ce projet. Notre candidat hébergé est à `95be72898` ; il faudra intégrer le nouveau main avant une livraison finale.
- Le registre des prestataires EN/FR/ES ajoute OpenAI à la génération de médias, conformément à la nouvelle route image 2.6 du code.
- Les schémas de sortie ajoutés sont limités au canal OpenAI. Les tests du MCP habituel et ses scénarios de sélection passent. Les prix sont lus dans les devis actuels, sans reprendre les anciennes promesses d'exports inclus.
- La page de prix informative reste accessible. Seules les actions de vente/recharge sont absentes du canal OpenAI, comme l'exigent les règles de ce canal.

## Le chemin restant : trois étapes

1. **Finir les éléments précis du dossier.** L'âge minimum est maintenant 18 ans sur la branche : CGU/confidentialité EN/FR/ES, inscription, nouveau consentement des comptes existants et approbation OAuth. La migration de versions est appliquée à la seule base dédiée ; aucune base habituelle n'a été modifiée. Vérifier l'application des clauses des routes directes BytePlus/Luma/Alibaba aux conditions réellement acceptées ; utiliser les contrats standard et les pièces de compte existantes. Raccorder la notice de confidentialité, les modalités d'effacement, l'identité de l'éditeur et son support. Voir [les points exacts](droits-et-regles-2026-11-11.md) et [les textes préparés](pieces-a-finaliser.md).
2. **Essayer le candidat dans ChatGPT, sur l'environnement dédié.** OAuth est qualifié sur le client dédié ; préparer le compte de revue avec médias/solde de test et les ressources nécessaires. Rejouer les cinq scénarios positifs et trois négatifs puis enregistrer une démonstration. Le premier essai HTTPS/OAuth est autorisé dans 1 € sur les 20 € totaux. Les générations payantes et la soumission restent séparées. Le plafond historique de 20 € ne constitue pas un relevé du budget restant.
3. **Compléter le brouillon et le soumettre, puis publier après acceptation.** Vérifier l'organisation/projet OpenAI, le domaine, les accès du reviewer et la vidéo ; reconstruire le ZIP avec l'URL réelle de démonstration ; déposer pour examen. La publication reste une action séparée, après approbation.

Le projet OpenAI MaxVideoAI a été vérifié dans Chrome : résidence **Global**. Le propriétaire a terminé la démarche d'identité **Individual** ; le portail affiche maintenant **« Verified »**, constaté dans Chrome le 11 novembre vers 14 h 40 Europe/Madrid. L'identité est validée. Le ZIP est maintenant téléversé en brouillon ; l'essai hébergé reste à terminer. Voir [le relevé du portail](qualification-2026-11-11/depot-portail.md). Cela ne demande pas de déplacer la base Neon de Francfort, ni les bases habituelles.

## Ce qui est prêt à examiner

- [Éléments à finaliser et déroulé de démonstration](pieces-a-finaliser.md).
- [Conditions et fournisseurs : conclusions simplifiées et sources](droits-et-regles-2026-11-11.md).
- [Vérification locale et limites de cette qualification](qualification-2026-11-11/verification.json).
- [Canevas de raccordement sans secrets](qualification-2026-11-11/environment.template).
- ZIP sur disque : `.local/openai-directory-20261111/package-0.3.14/maxvideoai-openai-directory-0.3.14.zip`.
- Le JSON `.local/openai-directory-20261111/package-0.3.14/openai-directory-readiness.json` garde `readyToSubmit: false` jusqu'à la qualification réelle et la démonstration.

## Continuité de l'ancien travail

La branche du 23 octobre, `codex/openai-marketplace-main-20261023` à `5c700f2e5`, reste intacte. Sa fusion complète aurait également repris un chantier distinct d'effacement/admissions/uploads et 23 fichiers en conflit. Cette tentative a été annulée dans le nouveau worktree ; seuls les adaptateurs pertinents ont été réintégrés.

L'effacement actuel reste celui de main. Les anciennes preuves de purge ne certifient pas ce candidat. La vérification du parcours d'effacement réel et la cohérence de la notice restent nécessaires avant diffusion ; on n'impose pas par défaut toute la refonte historique pour compiler un paquet.

Le ZIP reste en brouillon OpenAI. L'hébergement dédié est opérationnel pour HTTPS et découverte ; sa base est en pause entre essais. Aucun merge vers main, déploiement de l'application habituelle, email fournisseur, génération payante ou accès aux bases normales effectué par ce chantier. Voir le [journal de qualification](qualification-2026-11-11/etat-essai.md).
