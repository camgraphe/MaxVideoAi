# Qualification dédiée et P1 — 12 novembre 2026

Le candidat `e75f95e7b5073b7aea672498d80fb3101e3afa3b` a été livré au seul
environnement OpenAI Review. P1 a été exécuté dans ChatGPT avec le plugin privé.
Aucune soumission OpenAI, génération payante ou modification de production.

## Livraison et isolation

- Branche poussée : `codex/openai-directory-20261111`, sans merge vers `main`.
- Projet Vercel : `maxvideoai-openai-review-20261111`,
  `prj_UCIR8ODoPEK3bLF30ID94gvyDs5C`.
- Déploiement READY : `dpl_2ok7Aq9vppq6Kp4x2BZ7qH5PH2Ba` ; les deux alias
  `openai-review.maxvideoai.com` et `openai-mcp.maxvideoai.com` le désignent.
- Les **19 crons** du projet restent désactivés, y compris le cron Ads ajouté.
  `OPENAI_ADS_CONVERSIONS_DISABLED=1` est enregistré sur ce seul projet.
- Les nouveaux interrupteurs Builder, Audio étendu et worker Audio restent
  explicitement fermés, conformément à l'état précédent non qualifié.
  Ils ne constituent pas un retrait des fonctionnalités habituelles.

Le connecteur Vercel ne donnait pas accès au projet ; le CLI officiel, avec la
session existante et les identifiants explicites du projet et de l'équipe, a
permis l'opération. Le contrôle local des variables distantes n'a pas pu relire
`DATABASE_URL`, marquée sensitive par Vercel. Les autres identités dédiées ont
été vérifiées ; le garde-fou complet du prébuild hébergé a ensuite passé avec
les vraies variables. Aucun garde-fou n'a été affaibli pour masquer cette limite.

## Base dédiée

Neon `lingering-glade-93540258`, branche `br-lively-wave-b2obg47p`, endpoint
`ep-orange-lake-b2yfb7ss`, Francfort. La connexion a été contrôlée sur son hôte,
sa base et son rôle avant toute écriture. Les trois migrations suivantes ont
été appliquées dans une seule transaction, avec empreintes vérifiées :

1. `99_openai_conversion_outbox.sql`
2. `100_audio_generation_dispatch.sql`
3. `101_character_builder_quotes.sql`

Compteurs avant et après migrations, puis après P1 : **6 jobs, 7 reçus,
10 devis de génération**. Les trois nouvelles tables restent vides.
Le compte fictif conserve **0 centime disponible et 0 centime en attente**.
L'import privé de la référence du laptop est la mutation attendue du scénario.
Ni génération, ni nouveau devis, ni débit n'ont été créés.

La base a été refermée le **12 novembre à 18:22:39 Europe/Madrid** :
`disabled=true`, puis `current_state=idle` vérifié. Elle devra être rouverte
pour la prochaine séance autorisée et pour la revue ; elle n'est pas actuellement
disponible pour un reviewer. Supabase dédié reste inchangé et sain. Aucune base
normale n'a été consultée ou modifiée.

## Qualification dans le client

Les outils du plugin personnel ont été actualisés après livraison. L'hôte
utilise le compte `openai-review-20261111@example.test` et le seul endpoint
`https://openai-mcp.maxvideoai.com/mcp`.

- La liste courante renvoie **31 modèles vidéo**, sans Pika.
- Une recherche explicite de l'ancien identifiant Pika peut encore renvoyer sa
  fiche historique : `deep_legacy`, `generationEnabled=false`, non recommandé.
  Cette récupération n'en fait pas une offre de création actuelle.
- Audio est actuellement `voice_only` ; musique et SFX attendent le worker dédié.
- Les outils créatifs distinguent les opérations MCP des passages vers le site.
  L'annonce d'un passage web ne certifie pas l'exécution fournisseur.

La version personnelle affichée par ChatGPT (1.0.0) est distincte du ZIP local
directory 0.3.21. Le ZIP n'a pas été réimporté dans le portail.

## P1 : résultat réel et réserve éditoriale

La référence originale du laptop a été importée depuis le fichier approuvé,
pas depuis une capture contenant l'interface et le solde du compte habituel.
Son SHA-256 est
`c943860df135556bd89929d23331b21177ed765060cc73ac2eda5dcb30d44183`.

Prompt validé :

> Plan a five-second product ad for this graphite laptop. Compare two compatible
> current models, explain their creative differences, and show the cost. Do not generate.

Le client a proposé Kling 3.0 Omni Pro et Wan 3 Prime, pour cinq secondes,
1080p et sans audio, avec des estimations de **0,68 $ et 1,68 $**. Il distingue
ces estimations d'un devis réservé et confirme l'absence de lancement. Ces
montants décrivent la prise du 12 novembre ; un futur essai exige son propre devis.

La première réponse avait ajouté une illustration stock différente du laptop.
Une demande explicite de correction a obtenu l'affichage de la vraie image et
conservé les deux options. Ce détour est conservé dans les preuves et annoncé
dans le montage ; ne pas présenter la réponse corrigée comme le résultat direct
et sans intervention du premier prompt. Il reste à rendre ce parcours plus net
pour la prise finale, sans modifier artificiellement l'interface.

Conversation privée de preuve :
`https://chatgpt.com/c/6af5f415-161c-83eb-b9f9-c2f8a7237708`.
Ce lien n'est pas un lien public destiné au reviewer.

La capture macOS a bloqué. Le remplacement par le screencast Chrome a conservé
304 images réelles, dont la saisie et l'autorisation d'import. La capture des
événements s'est interrompue après une éviction de tampon ; la fin et la
correction sont documentées par des captures fixes réelles et le texte de
l'interface. **Pas de curseur natif ni d'enregistrement continu complet.**
Les suggestions privées du menu initial sont exclues de l'extrait ; la sélection
du plugin est visible dans le champ, mais son clic devra être mieux filmé.

L'extrait `P1-ChatGPT-rehearsal.mp4` est une répétition de montage, pas le
walkthrough final. Il reprend le kit graphique validé, conserve l'application
entière, raccourcit les attentes, et tient la réponse pour la lecture. Les écrans
finaux fixes sont indiqués comme tels. La timeline FCP7 XML sépare le fond et les
captures pour Premiere ; son import applicatif n'est pas encore vérifié. Les
sources graphiques modifiables et les médias originaux sont conservés.

## Coût et preuves

Un build Basic dédié, environ 8 min 18 s jusqu'à READY, soit environ **0,058 $**
au tarif de 0,007 $/minute ; l'intervalle jusqu'à la fin du conteneur est d'environ
9 min 25 s, soit **0,066 $**. Ce calcul n'est pas une facture.
La fenêtre Neon ouverte pendant environ 33 minutes à 0,25 CU représente au plus
environ **0,015 $** de calcul au tarif Launch de 0,106 $/CU-heure, avant les
suspensions automatiques, franchises et autres postes. Pas de recharge ou de
nouvelle ressource permanente. Le coût exact reste celui des relevés fournisseurs.
Sources de tarif vérifiées pendant l'essai :
[Vercel](https://vercel.com/docs/builds/managing-builds) et
[Neon](https://neon.com/pricing.md).

Reçus locaux privés sous
`.local/openai-directory-20261111/requalification-20261112/` :
`integrated-hosted-state.json`, `integrated-deployment-details.json`,
`dedicated-migrations-applied.json`, `hosted-readonly-tools.json`,
`p1-reference-receipt.json`, `p1-postflight.json`, `neon-closed-verified.json`.
Captures et montage sous
`.local/openai-directory-20261111/presentation-review/review-walkthrough-v2/`,
dans `captures/p1-aligned-20261112/` et `exports/p1-rehearsal-v1/`.

Restent : validation du montage et des sept autres cas, qualification séparée
des capacités nouvelles, devis/accords des opérations payantes, prises finales,
synchronisation du manifeste, vérification des accès reviewer et approbation
du propriétaire avant soumission.
