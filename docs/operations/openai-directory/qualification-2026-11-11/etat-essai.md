# Essai OpenAI — journal du 11 novembre 2026

**État courant à 17 h 30 Madrid : premier hébergement et connexion applicative réussis ; OAuth OpenAI encore incomplet.**

- Déploiement Git dédié `dpl_83goM2ssi7ZwKTqCf4uJup52jFXY`, READY en 8,79 minutes, source `5312a21fa05ed6bd0f85f08bca4970b6e5be1f8d`.
- Deux CNAME exacts, DNS-only, vers la cible recommandée par Vercel. HTTPS répond ; challenge texte exact, découverte OAuth 200, MCP sans jeton 401 avec sa bonne URL de métadonnées. Domaine OpenAI vérifié.
- Compte reviewer connecté dans Chrome puis déconnecté. Documents acceptés après accord explicite : 1 profil, 4 consentements, 0 job et 0 reçu dans la seule base dédiée. Aucun crédit ajouté.
- Client OAuth `324a5cbd-2929-4ba1-82a6-58083f5ccb33` créé dans l'Auth dédié, secret conservé uniquement en local privé. Callback de diagnostic local `http://127.0.0.1:8766/callback` ; aucun callback OpenAI supposé. PKCE S256 → 302 vers `/oauth/consent` du site dédié ; callback non enregistré → 400 sans redirection. Aucun jeton OAuth émis par ce test.
- ZIP 0.3.14 importé, client public déclaré. Le portail affiche cette déclaration mais Connect renvoie encore « OAuth client ID missing from plugin ZIP ». Constat après actualisation ; origine exacte non établie. Ne pas prétendre que le secret ou la connexion sont configurés. Le hook de jetons reste désactivé et sa liste de clients vide.
- 18 crons du seul projet suspendus et base dédiée remise `disabled: true`, `idle` à 16:30 UTC. Réactiver seulement cette base pour le prochain essai applicatif.
- Filtre de build autonome enregistré au niveau du projet : build uniquement pour `codex/openai-directory-20261111`, skip pour toute autre branche. Confirmation réelle sur le main #646 : tentative `dpl_BqQ7E43D5P4MSKVbX7GuxVJ7yPhx` annulée. Coordination avec le chat Business Hub autorisée par le propriétaire.
- Coût indicatif du build : 0,0616 USD ; fenêtre Neon réactivée de 16:06:30 à 16:30 UTC, borne à 0,25 CU fixe d'environ 0,0104 USD. Ce calcul ne remplace pas la facture et exclut stockage/requêtes/fonctions. Budget de l'essai 1 €, budget global 20 € ; aucune génération payante.
- Validation locale du paquet : 4 tests réussis ; MCP : 214 réussis, 1 ignoré, 70 scénarios de sélection réussis ; contrôle d'exposition et diff conformes.

Les preuves privées sont sous `.local/openai-directory-20261111/evidence/`, notamment `first-hosted-http.json`, `main-build-skipped.json`, `oauth-authorize-probe.json`, `hosted-login-database-check.json` et les captures. Le [relevé du portail](depot-portail.md) décrit le blocage exact et la reprise. Les rubriques ci-dessous sont **l'historique des étapes précédentes**, non l'état courant.

## Historique des actions initiales


| Ressource | Vérification / action | État |
| --- | --- | --- |
| Supabase Auth `ajwofjldwawdwtioekuc` | Offre de l'organisation vérifiée : Free. Restauration du seul projet « MaxVideoAI OpenAI Review ». Puis création explicite du compte reviewer fictif. | `ACTIVE_HEALTHY`, eu-central-1. Découverte OAuth publique répond ; PKCE S256 annoncé. Mot de passe du compte test validé et session fermée. Aucun client OAuth ni nouvelle clé API créé. |
| Neon `lingering-glade-93540258` | Schéma dédié inspecté puis mis à niveau avec 33 migrations ; exports Studio initialisés. | 138 tables, connexion poolée vérifiée, endpoint remis en pause (`disabled: true`, `idle`). Aucune base habituelle accédée. |
| Ancien Vercel `prj_p6neENhzOIYsCXIPU2EvnUCJiORp` | Le connecteur renvoyait 404 ; le CLI authentifié confirme son existence dans la bonne équipe. | Vide, aucun déploiement ni lien Git. Inchangé. Le 404 ne prouvait pas sa suppression. |
| Nouveau Vercel `prj_UCIR8ODoPEK3bLF30ID94gvyDs5C` | Projet `maxvideoai-openai-review-20261111` créé par le CLI après refus 403 du connecteur. Node réglé sur 22.x. Puis accès dédiés et secrets internes installés. | Même équipe, fonctions fra1, machine basic, aucune cible, aucun déploiement, aucun lien Git. 36 variables dont 12 secrets protégés ; aucun secret de production copié. |
| Portail OpenAI | Session Chrome existante utilisée ; organisation MaxVideoAI et projet MaxVideoAI visibles. Le propriétaire a effectué la démarche Individual. | Projet en résidence **Global**, vérifié dans les paramètres. Après actualisation, statut **« Verified »**, constaté vers 14 h 40 Europe/Madrid : identité validée. Le contrôle différé est désactivé après ce constat. ZIP 0.3.13 téléversé en brouillon ; métadonnées sans anomalie. Aucune soumission humaine ni publication. Voir [le relevé du dépôt](depot-portail.md). |

Le contrôle automatique a refusé la demande de modification
`sourceFilesOutsideRootDirectory: true` car elle élargirait l'accès aux fichiers du
projet. Cette demande n'a pas été appliquée. **Correction après relecture : ce
réglage était déjà `true` par défaut dès la création du projet**, comme l'établissent
la réponse de création conservée et la lecture actuelle. Il n'y a donc rien à
activer ni à contourner. Node 22 a été réglé séparément. Le projet daté reste vide.

### Contrôles complémentaires

- Portail : `generate` et `plan` affichent tous deux **Checks passed** ; métadonnées
  **No findings**. Les éléments incomplets sont le raccordement MCP et les pièces
  reviewer/vidéo, pas un rejet des skills.
- Auth dédié, lecture dans Chrome : serveur OAuth actif, Site URL
  `https://openai-review.maxvideoai.com`, consentement `/oauth/consent`, inscription
  dynamique désactivée, aucun client OAuth et aucune URL de redirection enregistrés.
- Le hook `maxvideoai_review_auth.custom_access_token_hook` existe mais est
  **désactivé**. Lecture SQL ciblée sur le seul projet dédié : liste des clients MCP
  vide ; droit EXECUTE accordé à `supabase_auth_admin`, refusé à `anon` et
  `authenticated`. Le code ajoute l'audience du domaine OpenAI uniquement aux
  clients explicitement listés et au bon issuer ; aucune entrée ni activation
  effectuée. Il reste à enregistrer le vrai client puis qualifier ses jetons.
- Le CLI Supabase a refusé la lecture de configuration avec sa session actuelle ;
  la session Chrome existante a permis les contrôles ci-dessus. Aucun secret extrait.
- Livraison dédiée préparée localement : registre exact des ressources, garde Git
  et configuration, branche ignorée sur les autres projets Vercel et route de
  challenge limitée au domaine/projet dédiés. Voir le guide de déploiement.
- Vérification : 19 tests ciblés réussis, build complet (1 034 pages statiques),
  quatre contrôles HTTP locaux réussis pour la nouvelle route. Le serveur local
  sans clés Auth a signalé leur absence pour une autre route ; cet essai valide
  uniquement le challenge, pas une session authentifiée.

Ces lectures ne modifient ni les réglages Auth ni une base habituelle. Les gardes
de build vérifient des bindings ; ils ne certifient pas les permissions IAM, les
workers ou les coûts. À ce stade initial, aucun push, déploiement ou rattachement de domaine n'avait été effectué. La branche a depuis été poussée, comme relevé ci-dessous.

### Accès dédiés raccordés, après accord explicite

Le propriétaire a autorisé la récupération des accès Supabase/Neon/S3 dédiés,
leur conservation locale privée et leur enregistrement dans le seul projet
Vercel `maxvideoai-openai-review-20261111`, sans déploiement ni activation payante.

- **28 variables installées** : quatre secrets (`DATABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) et
  24 paramètres de configuration. La cible Vercel `production` est celle du
  projet de test, pas celle de `maxvideoai`.
- Relecture : les 24 valeurs de configuration correspondent au canevas préparé ;
  les quatre secrets ont le type API `sensitive` et ne sont pas retournés. Le type
  CLI `config` correspond à `encrypted` dans l'API ; ce n'est pas une divergence
  de valeur. Aucune valeur secrète relue depuis Vercel.
- Le challenge de domaine est configuré ; le canal OpenAI reste désactivé jusqu'à
  sa qualification. Le projet n'a toujours ni lien Git ni cible de déploiement.
- La connexion Neon préparée cible uniquement l'endpoint dédié. Sa relecture
  après configuration confirme `disabled: true`, état `idle`, 0,25 CU fixe,
  suspension automatique à 300 secondes. Aucune connexion SQL effectuée.
- Clé Supabase serveur existante conservée en fichier privé 0600, hors Git ;
  clé publishable utilisée pour le navigateur. La révélation de la clé moderne
  n'a pas renvoyé sa valeur dans cette session ; la clé `service_role` existante
  a été récupérée pour la compatibilité du candidat. Aucune clé créée ou tournée.
  Le portail annonce la retraite des clés legacy début 2027 : préparer la
  migration vers la clé serveur moderne avant une exploitation durable.
- Validation sans données utilisateur : `/auth/v1/settings` répond 200 avec la
  clé autorisée et 401 avec une clé invalide. Le JWKS public expose ES256. Cela
  valide l'acceptation par la passerelle, pas une session OAuth ni tous les droits
  administratifs. Le test initial sur la liste des utilisateurs a été refusé
  avant exécution ; il a été remplacé par cette vérification publique.
- Cluster AWS dédié `maxvideoai-openai-review-export` : **0 tâche active,
  0 tâche en attente, 0 service** à la lecture actuelle. Aucun lancement effectué.

Preuves sans secrets : `evidence/vercel-env-installation.json`,
`evidence/vercel-env-verification.json`, `evidence/supabase-key-read-check.json`,
`evidence/neon-endpoint-after-env.json`, `evidence/aws-review-cluster-current.json`
sous `.local/openai-directory-20261111/`. Les secrets restent dans son sous-dossier
privé `secrets/`, permissions 0700/0600, et ne figurent ni dans ce dossier public
de suivi ni dans le ZIP.

La création de `openai-review-20261111@example.test` (identité fictive, sans email,
avec mot de passe aléatoire local) a d'abord été refusée avant exécution par le
contrôle automatique, faute d'accord assez explicite pour ce compte persistant.
Après l'accord ciblé du propriétaire, **le compte a été créé et sa connexion par
mot de passe a réussi**. La session de vérification a ensuite été fermée. Aucun
compte existant consulté, aucun email, crédit ou paiement créé. Le compte Auth est
prêt ; le compte applicatif, les données et les scénarios MCP restent à qualifier.
Ses accès sont conservés uniquement dans `secrets/reviewer-credentials.json`
(0600) ; preuve sans mot de passe : `evidence/reviewer-auth-created.json`.
Ils ne sont pas encore saisis dans le portail OpenAI, car le site dédié n'est pas
hébergé et le reviewer ne pourrait pas encore exécuter les scénarios.

## Budget cumulé : 20 € maximum

La consommation Neon retournée pour octobre est de 420 CU-secondes et
28 634 926 bytes-month de stockage racine, plus 483 774 bytes-month de restauration
et 113 598 octets de transfert public. Novembre ajoute à ce stade 13 057 937
bytes-month de stockage racine. Les [tarifs publics Launch](https://neon.com/pricing.md)
consultés le 11 novembre donnent un ordre de grandeur de **0,027 USD** pour ces
métriques (420 / 3 600 × 0,106 USD/CU-h, stockage × 0,35 USD/GB-mois,
restauration × 0,20 USD/GB-mois ; transfert sous le quota inclus). Ce calcul
indicatif n'est pas la facture de l'intégration Vercel et ne couvre pas AWS ni
les autres services. Il n'établit pas un solde global en euros.

Le premier endpoint Vercel ne restituait pas un relevé exploitable. Le relevé CLI
`vercel usage --group-by project --from 2026-10-08 --to 2026-11-11 --json` a ensuite
abouti : aucun groupe facturé au nom des deux projets `openai-review` n'est présent.
Sa période effective est du 8 octobre 07:00 UTC au 12 novembre 08:00 UTC, selon les
bornes renvoyées par le CLI. Les frais non attribués et les autres services ne
permettent toujours pas de conclure à un total historique nul. Les projets de test
sont vides et n'ont pas lancé de build distant.

Aucune génération, recharge ou export Fargate n'a été lancé. La courte activation Neon pour les migrations est relevée dans le document de mise à niveau lié en tête.
L'offre gratuite de l'Auth a été vérifiée avant restauration. L'inventaire du
stockage dédié a été vérifié le 11 novembre à 15 h 17 Europe/Madrid : **0 objet,
0 octet**, résultat non tronqué. Cet état actuel ne constitue pas une facture
historique. Conserver la réserve historique de 5 € infrastructure, 10 € démos et
5 € aléas **dans** le plafond de 20 €, jamais en plus.

La tentative de lecture `ListObjectsV2` du seul bucket dédié, avec ses anciennes
clés de test locales, a été refusée avant exécution par le contrôle automatique :
autorisation jugée insuffisamment explicite pour cette source de credentials.
Après autorisation explicite du propriétaire, cette même lecture a abouti avec
les clés du seul utilisateur `maxvideoai-openai-review-web-20261008`, le propriétaire
AWS attendu et l'endpoint S3 de Francfort. Aucun contenu de média lu, aucun objet
écrit, aucun autre bucket consulté. Le relevé sans secrets est conservé dans
`.local/openai-directory-20261111/evidence/s3-dedicated-current.json`. Cela vérifie
l'accès en lecture d'inventaire ; les écritures, les accès worker et les permissions
sur d'autres ressources n'ont pas été testés.

## Raccordement encore nécessaire

1. Raccorder le domaine et OAuth du brouillon 0.3.13. Identité, métadonnées et skills
   sont validés. Le portail ne découvre pas encore
   les métadonnées OAuth et le domaine est non vérifié. Relever le callback exact
   au raccordement ; ne pas l'inventer ni transmettre les secrets dans le ZIP.
2. Livrer le candidat par Git au seul projet dédié, après préparation de ses
   bindings. Les gardes sont préparés et testés localement ; le projet daté reste
   vide. La politique de livraison de l'application de production reste inchangée.
3. Compléter les accès fournisseurs et workers dédiés ;
   actualiser le registre des capacités sur les routes effectivement disponibles.
   Les accès Auth, base et stockage sont maintenant configurés sur le nouveau
   projet. Les secrets internes sont maintenant installés ; les clés fournisseur et bindings workers restent
   incomplets. Ce n'est pas encore un environnement prêt à générer.
4. Réconcilier les coûts avant activation payante, puis qualifier HTTPS, client
   OAuth, audience/resource, PKCE, refresh, révocation et reconnexion en réel.
5. Préparer les données et droits applicatifs du compte reviewer Auth déjà créé,
   exécuter les cas 5+3 avec devis
   avant dépense et conserver les résultats. Enregistrer la vidéo réelle.
6. Reconstruire le ZIP avec la vidéo accessible, résoudre les scans, puis déposer
   pour revue. La publication après acceptation reste une action distincte.

Les capacités ne sont pas retirées pour contourner ces étapes. Le paquet local
reste `readyToSubmit: false` jusqu'aux preuves de l'essai réel.

## Confidentialité et effacement

Le handler courant `/api/account/delete` enregistre une demande authentifiée et
révoque l'opt-in marketing ; il ne purge pas le compte. La notice explique cette
distinction. Il faut exécuter une demande de bout en bout sur le compte de test,
avec un relevé séparant suppression, anonymisation et conservation justifiée.
La [fiche d'effacement](../fiche-effacement-reviewer.md) prépare ce traitement
manuel ; elle ne certifie aucune suppression accomplie.

## Lien Git de l'hébergement : accord ciblé demandé

Le commit `dc768b7dc` est poussé sur la seule branche
`codex/openai-directory-20261111`. Aucun merge ou PR de production créé. Le lien
Git du seul Vercel dédié a été refusé **avant exécution** par le contrôle
automatique : il accorderait un accès persistant au dépôt et pourrait déclencher
des déploiements automatiques. Aucun contournement ni changement DNS effectué.

Une confirmation explicite est demandée pour ce lien, le déploiement dédié et
les deux sous-domaines réservés, avec 1 € au maximum pour le premier essai HTTPS/
OAuth **inclus dans** les 20 €. Aucune génération ni soumission OpenAI incluse.
La base est en pause, les fournisseurs non activés et le projet dédié non livré
en attendant cet accord. Voir le plan concret dans `base-et-premier-hebergement.md`.

Vérification GitHub du commit poussé : statut Vercel `success`, description
**Canceled by Ignored Build Step** sur le projet habituel. Sa tentative a donc
été annulée par la garde avant livraison ; ce n'est pas un build de qualification
dédié réussi. Aucun runtime de production remplacé.
