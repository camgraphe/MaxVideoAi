# Recast — preview réelle et tarif distinct

Décisions du 4 novembre 2026 : conserver la branche `codex/character-studio-v2`,
qualifier la génération en environnement de test avant production, puis réutiliser
les vidéos retenues pour Explorer et le marketing. La marge Recast doit dépasser
celle de Wan 3 Prime utilisé directement. Son montant reste à choisir.

## Premier essai approuvé : échec réseau, remboursement confirmé

La démo UGC Marcel « Walk. Show. Go. » a été approuvée à 2,92 USD :
8 secondes générées, source vidéo découpée de 1 à 9 secondes, vertical 720p,
portrait original Nano Banana 2.1, montre bleue séparée, dialogue anglais natif.
Une seule confirmation a été envoyée. Le job a échoué avant obtention d'un
identifiant fournisseur ; `provider_attempts` enregistre
`ALIBABA_MODEL_STUDIO_NETWORK_ERROR`. Le wallet de test contient une charge
et un remboursement de 292 centimes. Aucune vidéo finale n'a été créée.

La cause constatée est le hostname public régional configuré, qui ne résout pas
(`ENOTFOUND` côté DNS local). Le point d'entrée Singapour documenté est
`https://dashscope-intl.aliyuncs.com` ; il résout et répond HTTP 401 à une lecture
sans authentification, sans lancer de rendu. Cela vérifie DNS/TLS/HTTP, pas la
validité du secret ni l'acceptation d'un futur rendu.

Le correctif de branche remplace le défaut dans `env.ts` et le client, accepte
l'adresse officielle tout en conservant les hôtes workspace Singapour et les
restrictions HTTPS/région. L'override Vercel a été corrigé uniquement dans
`character-studio-test` ; aucune variable Production n'a changé. Un nouveau
build est nécessaire. Validation locale du correctif : 52 tests ciblés passent
(client, soumission, polling, transport privé, coût et architecture), TypeScript
et contrôle d’exposition passent ; lint sans erreur, 7 avertissements préexistants.
Le test d’architecture a été exécuté sur une copie des sources suivies après
arrêt du premier parcours récursif qui parcourait aussi les artefacts locaux. L'approbation du premier essai est consommée : tout
nouvel essai nécessite un devis frais et une nouvelle validation.

Le dossier local `output/character-studio-v2/ugc-watch-demo/` contient les
références, la fiche et le statut réel. Les fichiers privés sous
`.local/character-preview/ugc-v2-*` conservent la requête, la réponse de
confirmation et les preuves de remboursement, sans valeur de clé fournisseur.

## Ce qui est possible et ce qui est vérifié

Une preview Vercel peut appeler les vrais fournisseurs. Les environnements
permettent de configurer les paramètres de cette branche séparément
([environnements Vercel](https://vercel.com/docs/deployments/environments),
[variables d'environnement](https://vercel.com/docs/environment-variables)).

Raccordement du 4 novembre : la branche est publiée sur GitHub. Le projet Vercel
`maxvideoai` possède désormais l'environnement personnalisé `character-studio-test`
(`env_buN6rStm7yMP1Botls0V1mWYyW2N`, type Preview), limité par correspondance exacte
à `codex/character-studio-v2`. Aucun domaine de production n'est réaffecté.

La base Neon `character-studio-v2-test` (`br-square-king-aenyqhsq`, projet
`shy-flower-71253790`) a été créée avec `--schema-only` : aucun client de production
n'a été copié. Les migrations 93, 94 et 95 sont appliquées. Le compte test existant,
12 personnages, 7 looks et leur historique local ont été importés. La grille active
(17 103 cellules, 2 versions historiques), les règles, les produits et les paramètres
des moteurs ont été copiés par une connexion PostgreSQL forcée en lecture seule
sur la source. Le portefeuille comporte des crédits de test explicitement étiquetés,
sans lien de paiement Stripe ; les clés Stripe et d'envoi d'e-mails sont neutralisées
dans cet environnement.

Le bucket S3 `maxvideoai-character-studio-test-20261104` est distinct du bucket
principal. 39 médias locaux ont été transférés avec un manifeste SHA-256 privé.
Les origines S3 globale et régionale ont été vérifiées : accès anonyme 403 aux
passages privés, accès signé/Range 206 ; médias publics/Range 206. Les données
et les services locaux PostgreSQL/MinIO sur 3016 restent intacts.

Sur demande explicite de réutilisation sécurisée, la variable sensible Alibaba
existante a été affectée au seul environnement personnalisé via `customEnvironmentIds`.
Sa valeur n'a été ni déchiffrée, ni exportée ; sa cible Production et son type Secret
sont conservés. La configuration GCS des images est également affectée sans lecture
de sa valeur ; les références Nano Banana 2.1 sont limitées à 7 Mo et envoyées inline.
Les portraits et résultats durables utilisent le nouveau S3. Les identifiants
fournisseur et Supabase Auth sont partagés ; les bases applicatives, médias S3 et
soldes sont séparés. Les variables importées qui nécessitaient une valeur propre
ont été détachées avant création des valeurs de test, pour préserver les autres
environnements. Les 39 valeurs propres ont été comparées après résolution Vercel.

Le déploiement qualifié est `dpl_8QXukPgX8XbSiz8T9zpYEL2rfrdy`, état READY,
source GitHub `173da033881576c41d3e89a3e9cc9c6dfecd517c`. Le build précédent
(`dpl_FoCYXRiHUAm57G287A7TeKX2EBXZ`) a échoué sur un OOM ; la relance du même SHA
a abouti. L'option de machine passée à la relance n'est pas une preuve de capacité :
les journaux annoncent toujours Standard, 4 cœurs / 8 Go. Aucun réglage global de
build du projet n'a été changé.

- [Outil de test, URL stable](https://maxvideoai-env-character-studio-test-camgraphes-projects.vercel.app/app/tools/character-builder)
- [Déploiement qualifié](https://maxvideoai-1r0rh36mj-camgraphes-projects.vercel.app/app/tools/character-builder)

La protection Vercel reste active. Le jeton OIDC local Development ne couvre pas
ce Custom Environment (`TRUSTED_SOURCES_ENVIRONMENT_MISMATCH`) ; les contrôles HTTP
ont utilisé `vercel curl` avec l'authentification Vercel existante, sur l'origine
exacte. Aucune règle Trusted Sources n'a été élargie. La connexion applicative a
été vérifiée sur le propriétaire existant sans envoi d'e-mail.
Lors de cette qualification initiale, aucune confirmation de devis ni génération fournisseur n'avait été effectuée. Le premier essai approuvé ultérieur est documenté ci-dessus.

Contrôles HTTP authentifiés sur le premier déploiement : bibliothèque 12 personnages /
7 looks avec URLs S3 de test ; Stripe `disabled` ; estimation v2v 8 s + source
7,5 s : 137 / 283 / 565 centimes (480p / 720p / 1080p). Les workers déployés ont
réellement découpé la vidéo de 2 à 9,5 s (7,5 s mesurées) et l'audio de 3 à 8,25 s
(5,25 s mesurées). Les deux passages sont stockés dans les chemins privés et leur
lecture signée renvoie HTTP 206. Les identifiants historiques qui contiennent une
ancienne URL locale restent des identifiants opaques ; les URL de lecture ont été
remplacées. La base conserve 19 jobs et 14 reçus après préparation, sans charge créée.

La qualification finale de l'environnement dédié a également vérifié :

- disponibilité Recast `i2v`, `ref2v` et `v2v` : HTTP 200 ;
- nouvelle sauvegarde du personnage et d'un look existants : idempotentes, toujours
  12 personnages et 7 looks ;
- 9 devis exacts v2v pour 4 / 8 / 12 s en 480p / 720p / 1080p : tous égaux à
  l'estimation, avec source vidéo mesurée à 7,5 s ; les trois cas 8 s incluent
  le passage audio mesuré à 5,25 s ;
- devis i2v et ref2v sans vidéo : 146 centimes chacun pour 8 s / 720p ; ref2v
  conserve le passage audio de 5,25 s ;
- estimation d'un nouveau look Nano Banana 2.1 i2i / 1K : 7 centimes ;
- Stripe désactivé sur la version qualifiée et sur l'alias stable ;
- après ces 11 devis non confirmés : toujours 19 jobs, 14 reçus et un solde de
  test de 9 903 centimes, identique à celui précédant les contrôles.

| Sortie | 480p | 720p | 1080p |
| --- | ---: | ---: | ---: |
| 4 s + vidéo 7,5 s | 102 ¢ | 210 ¢ | 419 ¢ |
| 8 s + vidéo 7,5 s | 137 ¢ | 283 ¢ | 565 ¢ |
| 12 s + vidéo 7,5 s | 173 ¢ | 355 ¢ | 710 ¢ |

Ces montants USD qualifient la configuration actuelle ; ce ne sont pas des devis
encore valides à confirmer. Aucun de ces essais ne remplace l'approbation créative
et le devis frais requis avant le premier rendu. Le débit fournisseur, le résultat
visuel et la clôture réelle du reçu restent à qualifier lors de ce rendu approuvé.

## Contrôles du raccordement

1. Publier le candidat de cette branche par le chemin Git/preview ; conserver
   une authentification pour les testeurs. Une preview reste accessible aux
   personnes autorisées, avec ses médias privés accessibles au fournisseur via
   les URLs de lecture prévues par le stockage.
2. Raccorder une base de test migrée, avec les propriétaires communs de paiement,
   la grille tarifaire relue et les migrations Character Studio 93, 94 et 95.
   Ne pas hériter silencieusement du `DATABASE_URL` de production.
3. Raccorder un espace de stockage de test HTTPS. Importer une copie des portraits,
   produits et références utiles sous le compte test, en conservant les originaux
   locaux. Vérifier l'encodage FFmpeg des deux passages et leurs URLs fournisseur.
4. Configurer le fournisseur et les accès de ce compte pour les modes utilisés,
   puis qualifier `recastReadiness`. Le nom public demeure MaxVideoAI Recast.
5. Le suivi interactif existe déjà : `/api/jobs/[jobId]` autorise le propriétaire,
   puis `refreshDirectGeneration` appelle le poller Alibaba limité à ce job actif.
   Les Recasts utilisent la surface `video` et participent à ce suivi depuis le
   workspace. Les crons Vercel automatiques ne tournent pas en Preview ; si la page
   est fermée, reprendre le suivi en ouvrant le rendu ou invoquer le poller existant
   `/api/cron/alibaba-model-studio-poll` sur l'origine de test avec son secret propre.
   Le poller ne soumet pas de nouvelle génération. La copie et le reçu terminaux
   seront qualifiés lors du premier rendu expressément approuvé.
6. Activer le rendu Recast uniquement sur cet environnement qualifié, puis
   présenter une scène concrète et son devis exact avant chaque rendu réel.
   Le solde de test ne rend pas gratuite la facturation fournisseur.

## Proposition commerciale, non activée

Lecture du tarif public le 4 novembre 2026 : sortie 8 s, passage vidéo 7,5 s,
cadrage 9:16. Les coûts ci-dessous viennent du barème fournisseur configuré dans
`wan-3-prime.ts` et `alibaba-model-studio/cost.ts`, pas d'une facture fournisseur
fraîchement vérifiée. Les options sont des simulations, pas des devis payables.

| Résolution | Coût fournisseur configuré | Wan 3 Prime direct, tarif public lu | Recast : direct +20 % | Recast : fournisseur ×2 |
| --- | ---: | ---: | ---: | ---: |
| 480p | 1,054 $US | 1,37 $US | 1,65 $US | 2,11 $US |
| 720p | 2,17 $US | 2,83 $US | 3,40 $US | 4,34 $US |
| 1080p | 4,34 $US | 5,65 $US | 6,78 $US | 8,68 $US |

Simulations arrondies au centime supérieur. ×2 signifie un supplément de 100 %
sur le coût, soit 50 % du prix avant les autres frais. Ici, cela augmente le prix
client d'environ 53 % par rapport au modèle direct ; ce n'est pas un petit +20 %.
Les outils créateur existants ont une autre règle distincte, fournisseur ×2,2.
Elle n'est pas appliquée automatiquement à Recast.

Pour Recast, créer une politique commerciale propre dans le propriétaire serveur
des tarifs, avec un identifiant/version et une portée Recast. L'estimation,
la préparation, la confirmation et le reçu doivent la partager. Ne pas simplement
multiplier le montant affiché dans le navigateur ni modifier le tarif global du
modèle. Le coût porte sur sortie + **passage vidéo mesuré** ; l'audio de référence
n'ajoute pas de secondes vidéo. Modifier cette règle retire les devis précédents,
sans réécrire les reçus historiques. Aucune de ces options n'est activée ici.

## Du test aux pages publiques

Chaque démo part d'un portrait produit par Character Builder. Conserver le
personnage/look, le brief, les médias source et leurs passages, le devis, le reçu,
le job et l'original rendu. Après revue créative (identité, mouvement, produit,
dialogue), sélectionner les clips puis préparer leur publication par les
propriétaires existants d'Explorer et du registre média marketing. Préparer les
affiches et dérivés, vérifier lecture/Range puis activer les seuls médias retenus.
Ne pas copier la base ou le portefeuille de test en production.

Basil reste le pilote déjà conservé. Les autres concepts nécessitent encore les
prises de mouvement adaptées et leur validation avant devis. Les scénarios de
danse, UGC et produit restent des concepts jusqu'à qualification du rendu réel.
