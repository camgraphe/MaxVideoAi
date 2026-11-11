# Base dédiée et premier hébergement

État vérifié le 11 novembre 2026 à 15 h 58 Europe/Madrid. Le candidat applicatif
est `37dc4156a` sur `codex/openai-directory-20261111` ; les changements suivants
de ce lot sont documentaires. Aucun déploiement à ce stade.

## Travail exécuté

- Seul Neon `lingering-glade-93540258` activé à 0,25 CU fixe pour la mise à niveau.
  L'inventaire initial trouve 104 tables, sans ligne applicative ; seuls les
  produits, tarifs, documents légaux et playlists initiaux contiennent des lignes.
- Trois tests de bootstrap/migrations réussis sur PostgreSQL 17 jetable. Le bac à
  sable bloque sa mémoire partagée ; le test a été exécuté hors bac à sable avec
  le `tsconfig` frontend, sans modifier le code pour le faire passer.
- 33 migrations appliquées, avec manifeste SHA-256 et journal par fichier : les
  quatre fichiers nouveaux 67/68/69/70 absents du candidat d'octobre, puis les
  fichiers 71 à 99 présents aujourd'hui. Les numéros seuls ne suffisent pas.
- Les 1 301 colonnes d'une installation neuve sont présentes sans écart de type,
  nullabilité ou valeur par défaut. Les tables supplémentaires de l'ancien test
  sont conservées. Ce contrôle ne compare pas toutes les fonctions/contraintes.
- `app_timeline_exports` créée avec son propriétaire de code existant, puis
  migration 98 rejouée pour installer le garde de purge. Aucun export lancé.
- Connexion poolée prévue pour Vercel vérifiée : **138 tables**, PostgreSQL
  **18.6**, jobs/reçus/profils/consentements **0**. Versions terms/privacy
  `2026-11-11`. Aucun consentement d'âge fabriqué pour le reviewer.
- Endpoint désactivé et état `idle` confirmé : période active observée de
  14:50:54 à 14:57:38 UTC, soit 404 secondes. Au tarif public Launch de
  0,106 USD/CU-h, calcul indicatif de **0,002974 USD** de compute. Ce n'est pas
  une facture ni un rapprochement du budget historique. [Tarifs Neon](https://neon.com/pricing.md).
- Huit secrets aléatoires neufs installés sur le seul projet Vercel dédié : cron,
  risque essai, acquisition, recharge, garde checkout, devis export, webhook et
  polling Fal. Ce ne sont pas des clés d'accès fournisseur. Métadonnées vérifiées :
  **36 variables dont 12 secrets**, aucun secret déchiffré depuis Vercel.

Preuves locales privées : `neon-upgrade-plan.json`, `neon-upgrade-receipt.json`,
`neon-schema-comparison.json`, `neon-timeline-schema.json`,
`neon-runtime-pooler.json`, `vercel-internal-secrets-verification.json` dans
`.local/openai-directory-20261111/evidence/`. Le snapshot de structure ne
contient pas de lignes applicatives ; les credentials restent hors Git et ZIP.

## Premier essai à héberger

Le premier essai qualifie HTTPS, connexion et OAuth. Les générations et exports
seront qualifiés après raccordement des fournisseurs et workers. Aucune capacité
n'est retirée du candidat ; cette première phase ne vaut pas dossier prêt à déposer.

- Source : branche dédiée et SHA exact poussé, via l'intégration Git du seul
  projet `prj_UCIR8ODoPEK3bLF30ID94gvyDs5C`. Aucun merge vers `main`.
- Machine Basic fixe, concurrence élastique désactivée. Tarif vérifié :
  **0,007 USD/minute de build**, soit **0,21 USD pour 30 minutes** ; il s'agit du
  build seul. [Tarifs des builds Vercel](https://vercel.com/docs/builds/managing-builds).
- Le dépôt définit 18 crons, dont plusieurs chaque minute. Pour la seule phase
  HTTPS/OAuth, préparer leur suspension au niveau du projet dédié, puis les
  activer pour les scénarios qui les nécessitent. Le réglage est réversible,
  persiste entre déploiements et conserve la configuration authored.
  [Gestion des crons Vercel](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs).
- Sous-domaines exacts : `openai-review.maxvideoai.com` pour le site de test,
  `openai-mcp.maxvideoai.com` pour le MCP et le challenge OpenAI. Lecture Cloudflare
  actuelle : aucun enregistrement exact pour ces deux noms, bonne zone et compte
  admin vérifiés. Ne changer ni la délégation DNS ni les enregistrements existants.
- Le projet Vercel dédié ne porte pour l'instant que son alias `.vercel.app`.
  Relever les cibles DNS effectives au rattachement ; ne pas forcer la reprise
  d'un domaine d'un autre projet.
- Le budget total reste **20 €**, avec 5 € infrastructure, 10 € démos, 5 € aléas.
  Ne lancer aucune génération sans devis ni exporter un film sans coût vérifié.

Le reviewer Auth existe déjà ; ne pas le recréer. L'applicatif est encore vide,
le client OAuth réel et son audience restent à qualifier, et la vidéo n'est pas
enregistrée. Le brouillon OpenAI demeure non soumis et non publié.

## Statut du premier hébergement

Branche poussée au commit `dc768b7dc`. Le contrôle automatique a refusé le lien
GitHub → projet Vercel dédié avant exécution, pour l'accès persistant au dépôt
et les déclenchements automatiques possibles. Accord ciblé demandé ; aucun lien,
déploiement ou enregistrement DNS créé. Le plafond proposé pour ce premier essai
est de 1 € dans les 20 € totaux. Ne pas relancer le lien sans la réponse.

## Accord reçu et préparation du build

Le propriétaire a autorisé explicitement le lien Git, le déploiement de cette
branche et les deux sous-domaines pour HTTPS/OAuth, dans 1 € inclus dans les 20 €.
Le seul projet Vercel dédié est maintenant relié à `camgraphe/MaxVideoAi` et son
suivi de branche est `codex/openai-directory-20261111`, vérifié dans le portail.
La base dédiée est réactivée à 0,25 CU fixe pour cet essai et le canal MCP dédié
est ouvert pour les métadonnées/OAuth. Les clés fournisseurs ne sont pas
raccordées ; aucune génération ni soumission OpenAI n'est autorisée dans ce lot.
Le push de ce relevé déclenche le premier build Git sur le projet dédié.

## Résultat de l'essai autorisé — 17 h 30 Madrid

Le premier build Git est READY sur `5312a21fa05ed6bd0f85f08bca4970b6e5be1f8d` ; les deux domaines sont attachés au seul projet dédié et leurs CNAME sont vérifiés. Le site, le login, le challenge et la découverte OAuth répondent en HTTPS. Le reviewer a ouvert sa session, accepté les documents après accord explicite, puis s'est déconnecté. Aucun job ni paiement.

Les crons dédiés sont maintenant désactivés au niveau du projet ; la base dédiée est remise en pause (`disabled: true`, `idle`). Le filtre de build autonome ignore main et toutes les branches autres que notre branche dédiée. Cette isolation a été constatée lors de la fusion de #646 dans l'autre chantier.

Le ZIP 0.3.14 porte le client OAuth réel, mais son ancienne connexion OpenAI ne reprend pas cette déclaration. Un brouillon indépendant **MaxVideoAI OAuth Test 0.3.15**, avec les mêmes paramètres MCP et les mêmes skills, reconnaît le client et propose le champ du secret. Aucun secret OAuth n'a encore été envoyé à OpenAI : l'accord ciblé est demandé. Voir `depot-portail.md` pour le diagnostic et la reprise. Aucun runtime, réglage Auth ou base n'a été modifié pour ce diagnostic. Les sources et relevés restent locaux ; pas de nouveau push documentaire déclenchant un build inutile.
