# Qualification des médias et de ChatGPT — 11 novembre 2026

Ce relevé complète les journaux antérieurs. Branche seule :
`codex/openai-directory-20261111`. Aucun merge main ni dépôt en revue OpenAI.

## Exécution dédiée

Les trois tentatives autorisées ont réussi : image PNG 1024² GPT Image 2.5 Flare
(7 cents USD), vidéo Pika 720p (24 cents, 5,042 s), voix Eleven v4
(5 cents, 6,922 s). Le crédit synthétique du compte fictif est de 36 cents,
les trois débits totalisent 36 cents, le solde final est nul. Aucun paiement
Stripe, recharge ou essai fournisseur supplémentaire.

Le montage assemble quatre clips sur une timeline de 7 s à 24 fps : deux extraits
vidéo, une image et la narration. L'export standard gratuit est terminé à 100 %,
avec un MP4 de 1 380 037 octets. Une réponse de confirmation ambiguë a été
récupérée par lecture du job existant, sans second export.

Le worker dédié a exécuté exactement le probe à identifiant inexistant et le
rendu réel. Les deux tâches sont arrêtées, code 0. Aucun service ECS permanent.
La politique réseau temporaire et le droit temporaire d'écriture des secrets ont
été retirés. Les trois secrets SSM restent limités au worker dédié.

## Corrections constatées pendant l'essai

- Les originaux S3 privés ont désormais des liens signés de lecture (300 s),
  réutilisant le contrôle de propriété Studio. Les trois originaux ont répondu
  HTTP 206 au contrôle borné. La configuration canonique du bucket de test ne
  change pas son caractère privé.
- Le schéma de confirmation export annonçait `ok: false` à la racine, en
  contradiction avec sa branche de succès. Le rendu réussissait, mais le client
  SDK refusait la réponse. La correction conserve les deux branches et unionne
  leurs propriétés communes. Un test après découverte des outils reproduit le
  défaut, puis passe après correction.

## ChatGPT personnel

Avec l'accord explicite de l'utilisateur, le plugin personnel **MaxVideoAI OpenAI
Review** est créé et connecté au seul compte fictif. Il réutilise le client OAuth,
les portées et le callback dédiés. Le plugin habituel est inchangé.

La découverte native, le compte et la liste des trois médias sont vérifiés.
Le lecteur audio natif a joué jusqu'au bout ; le lecteur vidéo affiche la vidéo
et démarre sa lecture. Les captures et l'enregistrement brut restent locaux.
Les liens Markdown externes peuvent afficher « Image non vérifiée » dans
ChatGPT : la qualification porte sur le véritable lecteur MCP App.

## Dossier restant

Terminer les preuves natives image/montage, finaliser une vidéo de démonstration
consultable, renseigner les accès reviewer dans le brouillon, actualiser les
métadonnées et rescanner le schéma livré. Les remarques audio génériques du scan
requièrent toujours l'examen OpenAI ; elles ne constituent pas une interdiction
établie ni une acceptation. Aucune capacité retirée par précaution.

Ne pas soumettre avant validation de l'utilisateur. Le main courant devra être
réconcilié avant toute livraison finale. Les références de déploiement et l'état
de pause de la base sont à vérifier en fin de session ; ce document ne certifie
pas un hébergement continuellement actif pour les reviewers.
