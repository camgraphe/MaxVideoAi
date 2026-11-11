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

## Clôture vérifiée à 20:08 UTC

- Source livrée : `ae2aa125ea55d5f891460af20269e03d3b84eba2`, Vercel dédié
  `dpl_36gA6dR6m4cLuQa4NUmyky9dDqVc` READY. Les deux alias de test pointent sur ce
  build. Le build intermédiaire `621a12f40` avait échoué au typage ; aucune
  affectation des alias n'avait remplacé la version de test précédente.
- TypeScript complet passe ; 18 contrats directory passent, 214 tests MCP et
  70 scénarios de sélection passent (un test MCP ignoré). Lint : zéro erreur,
  sept avertissements préexistants. Aucun changement d'instructions/capacités.
- Le projet habituel a annulé le build de cette branche
  (`dpl_CmqBFuUuznRW84KiKJA3o3KfcEN8`). Main distant est toujours
  `c501acf9ed4e139914a7502c8b3498ce758d59c8`, déjà inclus dans le candidat.
- OAuth, refresh, révocation locale et conservation du grant OpenAI sont
  revérifiés sur le nouveau runtime. Le SDK lit bien `ok: true | false`.
  Les 42 définitions restent présentes. Aucun nouvel export confirmé.
- Le fichier exporté est un H.264 1280 × 720 de **7,000 s**, avec piste AAC.
  Le conteneur dure **7,061333 s** en raison de la piste audio. Taille exacte :
  1 380 037 octets. Le téléchargement dédié répond HTTP 200.
- ChatGPT présente l'image et lit audio/vidéo jusqu'au bout. Il récupère le
  montage terminé puis calcule honnêtement ses 7 s depuis la timeline ; ce
  calcul a ensuite été confirmé séparément sur le fichier encodé.
- Scan OpenAI terminé à **20:05:55 UTC**. Après rechargement du portail, la
  définition copiée de `confirm_studio_export` contient effectivement les deux
  valeurs de `ok`. Configured, Authorized, Domain verified ; trois remarques
  audio génériques. Not submitted / Not published.
- Le plugin personnel a conservé uniquement le compte fictif et le même OAuth.
  Actualisation explicite de ses outils effectuée. Il s'agit d'un plugin MCP
  personnel, pas d'une preuve d'installation/sélection des deux skills du ZIP.
- Test natif de reformulation : réponse texte seule. Les deux prompts négatifs
  d'accès à des médias étrangers et de relance/écrasement ont été bloqués par
  ChatGPT avec son avis cybersécurité. Ce sont des refus de l'hôte, pas des
  preuves de contrôle applicatif. Aucun contournement tenté.
- Comptabilité finale relue : 3 charges = 36 cents USD, crédit synthétique =
  36 cents, aucun reçu lié à Stripe. AWS : zéro tâche active ; 18 crons Vercel
  désactivés. La base dédiée est désactivée à la fermeture de la session.

## Pièces locales prêtes et étapes encore ouvertes

Sous `.local/openai-directory-20261111/` (ignoré par Git) :

- `evidence/chatgpt-private-walkthrough.mp4` : 79,9 s de capture réelle muette,
  attentes condensées ; présentation des médias et récupération du montage.
- `evidence/review-montage-7s.mp4` et `review-montage-ffprobe.json` : original
  dédié et mesure technique. Pas d'autre rendu.
- `package-0.3.16/maxvideoai-openai-directory-0.3.16.zip` : candidat local
  construit avec les notes de version actualisées ; aucune URL vidéo inventée,
  aucun secret. SHA-256 :
  `00b4ae5aa85df3a711abb9aaf5d90be13d7a74c997aa12dae3baca8f211de2cd`.
  Ce paquet garde l'identité MaxVideoAI ; il n'a pas remplacé le brouillon de
  diagnostic `maxvideoai-oauth-test` 0.3.15. Réconcilier l'identité avant dépôt.
- `evidence/reviewer-handoff-draft.md` : accès préparés, étapes et réserves
  factuelles. Le mot de passe reste uniquement dans le fichier secret privé.

Le portail demande encore les identifiants reviewer et une URL de démonstration.
Les fournir accorderait l'accès direct à l'équipe de revue ; ce n'est pas la
connexion personnelle qui vient d'être autorisée. Préparer aussi une fenêtre
active et un solde de démonstration borné avant soumission : le compte est à zéro
et la base est suspendue entre essais. Aucun accès reviewer envoyé aujourd'hui.

La matrice étendue n'est pas certifiée entièrement : import privé/Recast,
transcription/correction de sous-titres/burn-in et sélection des skills restent à
qualifier selon les scénarios revendiqués. La transcription utilise Fal mais
exige son propre lanceur de worker, distinct de l'export Studio préparé ici.
Aucune nouvelle génération ou tâche payante n'est autorisée implicitement par
la connexion personnelle. Ne pas présenter le bouton « complete » des champs de
scénarios du portail comme la réussite de ces scénarios.

La capture actuelle couvre le parcours réel de restitution ; elle ne prétend
pas montrer tous les scénarios avancés. Hébergement de cette vidéo, accès
reviewer, budget et disponibilité de revue, puis soumission sont les prochaines
validations concrètes. La publication reste distincte.
