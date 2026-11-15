# Candidat final OpenAI — 11 novembre 2026

**Candidat préparé, pas encore soumis.** L'environnement de qualification reste
séparé de la production. Les deux derniers essais payants et l'accès Fal du
worker attendent les validations précises présentées à l'utilisateur.

## Identité et artefact

- Affichage : **MaxVideoAI** ; identifiant du paquet : `maxvideoai-media`.
- Version : **0.3.19** ; archive locale ignorée par Git :
  `.local/openai-directory-20261111/package-0.3.19/maxvideoai-openai-directory-0.3.19.zip`.
- SHA-256 : `751b15e04bb64b944d2f84e0be5d163d59d707c79d64060526bc2a376d969825`.
- Brouillon final : `plugin_asdk_app_6af4d3ca73448191b5c6d85d5c2c4e8b` ;
  version portail : `appsub_6af4d3ca73848191b06d5ff87baaffcf`.
- Serveur inchangé : `https://openai-mcp.maxvideoai.com/mcp` ; clé MCP `maxvideoai`.
- Code hébergé : `ae2aa125ea55d5f891460af20269e03d3b84eba2`, issu du main `c501acf9`.
- Les 42 outils et les deux skills sont conservés. Le paquet générique reste en
  0.3.9 ; aucun cache installé, plugin habituel ou endpoint normal n'est modifié.

Les anciens brouillons sont conservés. Le paquet 0.3.18 a été accepté dans le
vieux brouillon `maxvideoai`, mais sa connexion n'a pas progressé : aucun appel
OAuth observé après Connect. La configuration enregistrée précédemment était
incomplète. Le nouveau paquet utilise une identité technique durable distincte,
car le portail interdit de renommer l'identifiant d'un paquet existant. Le nom
public reste MaxVideoAI. La version 0.3.17 rejetée contenait par erreur
`publication.releaseNotes` ; le champ correct est `publication.release_notes`.
Le builder refuse maintenant ce format erroné avant de créer une archive.

## État du nouveau brouillon

Le client OAuth dédié a été réutilisé sans changer ses portées ni son callback.
La connexion est **Authorized**, le domaine vérifié et le MCP **Configured**.
Métadonnées sans findings ; skills `plan` et `generate` : **Checks passed**.
Les mêmes identifiants du compte fictif et le même lien privé de démonstration
ont été enregistrés dans ce brouillon final : POST HTTP 200, avec les trois
valeurs attendues vérifiées sans les écrire dans le journal. Le formulaire ne
présente plus de pièce manquante après rechargement. Ni soumission humaine ni publication.

Scan du 11 novembre à 20:49:14 UTC : 42 outils découverts. Quatre findings
non bloquants sur `list_audio_capabilities`, `prepare_audio_generation`,
`confirm_audio_generation` et `prepare_generation` demandent une revue
complémentaire avant publication, sans défaut spécifique indiqué. Le filtre
**Blocking** ne contient aucun item. Aucun outil retiré pour faire disparaître
ces findings.

Réconciliation après cette préparation : toujours trois débits totalisant
36 cents USD, un crédit synthétique de 36 cents, aucun reçu lié à Stripe,
solde nul. Aucun essai payant supplémentaire. Liste des tâches RUNNING du
cluster dédié vide. La base dédiée est remise en pause en attente des accords.

## Matrice des preuves

| Scénario | Preuve actuelle | Reste concret |
| --- | --- | --- |
| 1. Planifier, comparer, budgéter | MCP réel : recommandations, capacités, comparaison et budget validés après découverte des schémas. ChatGPT : deux plans de 5 s, Pika 0,48 USD / Wan 3 Prime 1,68 USD, estimations clairement distinguées des devis. | Compléter la capture finale avec cette séquence. |
| 2. Référence privée et une génération approuvée | Helper du paquet exécuté sur le logo local ; nouvel asset privé `ma_5a98b0a40d854a5ca0a5a16bf5ac914d`. Devis Pika i2v, 5 s, 720p, 1:1 : 24 cents USD. | Une confirmation payante après accord, récupération et présentation du même résultat. |
| 3. Récupération et présentation | Image, vidéo et audio terminés ; cartes natives, lectures audio/vidéo et liens privés vérifiés. OAuth PKCE, renouvellement, révocation locale et conservation du grant OpenAI validés. | Aucun nouveau média nécessaire. |
| 4. Montage Studio | Timeline à révision 2 ; export unique de 7 s terminé ; MP4 H.264/AAC vérifié et retrouvé dans ChatGPT sans nouveau rendu. | Aucun nouveau rendu Studio nécessaire. |
| 5. Audio et sous-titres | Voix déjà générée et lue. Inventaire Audio/creator réel. Transcription du montage devisée à 1 cent USD ; incrustation incluse à 0 USD côté application. | Raccorder Fal au worker, une transcription, corriger une légende, VTT puis un rendu incrusté après approbation. |
| N1. Réécriture textuelle | ChatGPT répond sans appeler MaxVideoAI. | Rien. |
| N2. Achat et média d'un autre compte | Requête bloquée par la protection de l'hôte ; aucune action applicative. | Ce résultat ne prouve pas à lui seul l'isolation applicative, couverte séparément par les contrats. |
| N3. Relance plus chère et écrasement d'édition | Requête bloquée par la protection de l'hôte ; aucune action applicative. | Même réserve ; conserver cette preuve sans contourner le filtre de l'hôte. |

Le scénario privé choisit la branche image importée, sans retirer Character
Studio/Recast du produit. Le compte fictif n'a aucun personnage enregistré ;
aucun Recast réel n'est revendiqué. Le plugin personnel de ChatGPT contient le
MCP ; la sélection implicite des skills du ZIP dans un hôte réel n'est pas encore
prouvée. Les scans de skills et les fixtures locales sont des preuves distinctes.

## Deux validations en attente

1. **25 cents USD** de devis : une animation de référence à 24 cents et une
   transcription à 1 cent ; deux tâches AWS (transcription et incrustation),
   plafond global de ce lot **1 EUR** dans les **20 EUR** convenus. Crédit
   synthétique de 25 cents uniquement sur le compte fictif ; aucun Stripe ni
   recharge Fal. Aucun essai répété après échec. Un devis expiré ne peut être
   renouvelé qu'avec les mêmes paramètres et le même prix.
2. Transférer la **clé Fal de la ressource de test** dans un quatrième paramètre
   SSM chiffré `/maxvideoai/openai-review-20261111/export/FAL_KEY`, accessible au
   seul rôle d'exécution existant. La proposition locale
   `advanced-worker.template.json` conserve réseau, rôles, image et absence de
   service permanent. Le droit temporaire d'écriture sera retiré immédiatement.
   Raccorder la révision résultante au seul projet Vercel de test.

Correction de la note précédente : les sous-titres utilisent bien le même
lanceur générique et la même image de worker que Studio. L'image contient déjà
`SUBTITLE_OPERATION_TARGET_ID` et l'adaptateur Scribe via Fal. Aucun compte direct
ElevenLabs, nouveau VPC ou service permanent n'est requis.

## Pièces et clôture avant envoi

Le ZIP contient les skills autonomes, références, helper d'import, logo,
configuration publique OAuth et cinq cas positifs / trois négatifs. Les accès
reviewer et le lien signé de démonstration restent hors ZIP et hors Git, dans le
formulaire sécurisé du portail. Le lien actuel expire le 18 novembre à
20:12:40 UTC ; il devra être remplacé si la revue le dépasse.

Après les derniers essais : réconcilier les reçus et tâches AWS, compléter la
vidéo réelle, vérifier sa lecture et les accès du **brouillon final**, puis fixer
une fenêtre de disponibilité et une petite provision reviewer. La base de test
ne peut pas être suspendue pendant cette fenêtre. Présenter le paquet et les
résultats à l'utilisateur avant **Submit for review** ; ne pas déclencher la
publication après acceptation sans demande distincte.

## Validation locale

- Suite MCP : 214 tests passés, un test optionnel ignoré ; 70 décisions de
  sélection vérifiées. Ces fixtures ne constituent pas une mesure d'hôte réel.
- Paquet 0.3.19 : cinq tests passés, dont reproductibilité, inventaire,
  confidentialité et rejet du champ de publication invalide.
- Contrôle d'exposition publique et `git diff --check` réussis avant clôture.
- Aucun changement de code d'exécution ni nouveau déploiement Vercel dans ce lot.

Preuves privées supplémentaires : `review-advanced-planning-corrected-*.json`,
`review-private-import.json`, `review-advanced-quotes-*.json`,
`chatgpt-advanced-planning.txt` et `.png`, `package-0.3.19-tests.txt`.

Références officielles consultées le 11 novembre 2026 :
[Soumission](https://developers.openai.com/plugins/deploy/submission),
[Erreurs d'import](https://developers.openai.com/plugins/deploy/submission-errors#zip-upload-errors-and-warnings).
