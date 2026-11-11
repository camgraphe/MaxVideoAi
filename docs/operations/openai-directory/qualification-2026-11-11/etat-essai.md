# Essai OpenAI — journal du 11 novembre 2026

## Actions effectuées

| Ressource | Vérification / action | État |
| --- | --- | --- |
| Supabase Auth `ajwofjldwawdwtioekuc` | Offre de l'organisation vérifiée : Free. Restauration du seul projet « MaxVideoAI OpenAI Review ». | `ACTIVE_HEALTHY`, eu-central-1. Découverte OAuth publique répond ; PKCE S256 annoncé. Aucun compte, client OAuth ou secret créé. |
| Neon `lingering-glade-93540258` | Inventaire et consommation lus. | Endpoint `ep-orange-lake-b2yfb7ss` désactivé, région eu-central-1. Aucune requête SQL ni activation. |
| Ancien Vercel `prj_p6neENhzOIYsCXIPU2EvnUCJiORp` | Le connecteur renvoyait 404 ; le CLI authentifié confirme son existence dans la bonne équipe. | Vide, aucun déploiement ni lien Git. Inchangé. Le 404 ne prouvait pas sa suppression. |
| Nouveau Vercel `prj_UCIR8ODoPEK3bLF30ID94gvyDs5C` | Projet `maxvideoai-openai-review-20261111` créé par le CLI après refus 403 du connecteur. Node réglé sur 22.x. | Même équipe, fonctions fra1, machine basic, aucune cible, aucun déploiement, aucun lien Git. Aucun secret copié. |
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
workers ou les coûts. Aucun push, déploiement ou rattachement de domaine effectué.

## Budget cumulé : 20 € maximum

La consommation Neon retournée pour octobre est de 420 CU-secondes et
28 583 517 bytes-month de stockage racine. Ce relevé n'est pas une facture finale,
ne couvre pas les autres services et n'établit pas un solde en euros.

Le premier endpoint Vercel ne restituait pas un relevé exploitable. Le relevé CLI
`vercel usage --group-by project --from 2026-10-08 --to 2026-11-11 --json` a ensuite
abouti : aucun groupe facturé au nom des deux projets `openai-review` n'est présent.
Sa période effective est du 8 octobre 07:00 UTC au 12 novembre 08:00 UTC, selon les
bornes renvoyées par le CLI. Les frais non attribués et les autres services ne
permettent toujours pas de conclure à un total historique nul. Les projets de test
sont vides et n'ont pas lancé de build distant.

Aucune génération, recharge, export Fargate ou activation Neon n'a été lancée.
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
3. Raccorder seulement les secrets, Auth, base, stockage et workers dédiés ;
   actualiser le registre des capacités sur les routes effectivement disponibles.
   L'ancien fichier de préparation contient encore des clés fournisseur vides,
   aucun service-role et des bindings de workers incomplets. Ce n'est pas un
   environnement prêt à générer.
4. Réconcilier les coûts avant activation payante, puis qualifier HTTPS, client
   OAuth, audience/resource, PKCE, refresh, révocation et reconnexion en réel.
5. Créer le compte reviewer dédié et ses données, exécuter les cas 5+3 avec devis
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
