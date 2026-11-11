# Brouillon OpenAI — 11 novembre 2026

## État actuel

- Organisation/projet MaxVideoAI, résidence Global, identité Individual vérifiée.
- [Brouillon de diagnostic actif](https://platform.openai.com/plugins/manage/plugin_asdk_app_6af49bb426f08191a95f4331a3cb3739?tab=mcp&version=appsub_6af49bb42730819199847f39ad7a8dd0&mcp=server%3Amaxvideoai), paquet `maxvideoai-oauth-test` **0.3.15**. **Authorized / Domain verified** ; le badge général est **Configuration incomplete** après reconnexion, sans explication détaillée.
- **42 outils reconnus** : 41 publics et `get_generation_download` privé. Inspection `SCANNED_OK`. Quatre remarques au premier scan. Après correction et redécouverte, le scan final termine les 42 contrôles : `get_model_details` passe, cinq définitions nécessitent un examen supplémentaire. Suivi dans [scan-et-suite.md](scan-et-suite.md).
- **Draft**, **Not submitted**, **Not published**. Métadonnées **No findings**, skills `plan` et `generate` **Checks passed**.
- Cinq cas positifs et trois négatifs importés ; les cinq onglets positifs sont marqués complete. Le formulaire demande encore **Reviewer credentials** et **Supporting content**. Les scénarios fonctionnels réels et la démonstration restent à faire. Les champs du ZIP sont en lecture seule ; le champ officiel `prompt` reste correct, même si l'affichage du portail montre surtout scénario/outils/résultat.
- [Ancien brouillon 0.3.14 conservé](https://platform.openai.com/plugins/manage/plugin_asdk_app_6af4711f72f08191bf141a80553b9c9d). SHA-256 du paquet original : `46a86cf4251273772e1a699483cb1055139aed7e2f2bda0196bdd47b34e15ade`. Réconcilier l'identité du brouillon de diagnostic avant dépôt final.

## Hébergement et domaine validés

Le serveur déclaré reste `https://openai-mcp.maxvideoai.com/mcp`. Les deux sous-domaines aboutissent uniquement à l'hébergement dédié ; aucun domaine normal n'a été réaffecté. HTTPS, challenge texte exact et découverte OAuth répondent. Le portail affiche **Domain verified**, y compris après actualisation.

Le compte de démonstration fonctionne sur `https://openai-review.maxvideoai.com/login?mode=signin` : connexion navigateur, création du profil, acceptation autorisée des documents puis déconnexion. Solde 0 $, aucun job ni reçu. La base dédiée est remise en pause entre essais : la réactiver avant de reprendre une session applicative. Les 18 crons dédiés restent suspendus.

## Diagnostic et résolution OAuth

Le ZIP 0.3.13 ne déclarait que `auth.type: oauth`. Le premier Connect a demandé un client `provided` et son `clientId`. Le client réel `324a5cbd-2929-4ba1-82a6-58083f5ccb33` a donc été créé sur Supabase `ajwofjldwawdwtioekuc`, puis déclaré dans 0.3.14 avec `tokenEndpointAuthMethod: client_secret_basic`, conformément à la documentation actuelle.

Dans l'ancien brouillon, le panneau Settings affiche ces trois champs, mais **Connect renvoie « OAuth client ID missing from plugin ZIP »**, sans champ secret. Le diagnostic du 11 novembre établit maintenant la différence : les 13 fichiers du ZIP téléchargé depuis OpenAI sont identiques au paquet local, tandis que la version interne de connexion `asdk_app_v_c6eeb467eba48191bcd2123ed09301c5` n'a pas de `client_id` dans sa configuration OAuth. Le rechargement ne la resynchronise pas. La découverte des endpoints Supabase et de PKCE S256 fonctionne.

Un essai de remplacement de la clé MCP dans le brouillon a été refusé par le portail : **Create a new plugin to change MCP servers**. Cette importation n'a pas remplacé la version 0.3.14. Aucun serveur applicatif ni fonctionnalité n'a été modifié.

Un **brouillon de diagnostic indépendant** a ensuite été créé par l'interface officielle : [MaxVideoAI OAuth Test](https://platform.openai.com/plugins/manage/plugin_asdk_app_6af49bb426f08191a95f4331a3cb3739), paquet `maxvideoai-oauth-test` 0.3.15, version de soumission `appsub_6af49bb42730819199847f39ad7a8dd0`. Seuls le nom du paquet, le nom affiché, la version et les checksums diffèrent de 0.3.14 ; **le manifeste MCP et les skills sont identiques**. SHA-256 : `9f44db9f5c7d287050a7a10701cfaff763768ce17fbc6704bcff552428907906`.

Ce nouveau brouillon initialise bien `client_id` et `client_secret_basic` dans sa connexion `asdk_app_v_aefb818cb90481918c10797f85c72963`. Le champ **OAuth Client Secret apparaît** ; domaine vérifié, métadonnées sans anomalie, deux skills validés. Cela isole l'échec à la reprise de l'ancienne configuration et fournit un chemin de connexion utilisable. À ce stade du diagnostic, l'autorisation restait à exécuter ; elle a ensuite réussi selon le relevé ci-dessous. L'ancien brouillon est conservé ; aucun des deux n'est soumis ou publié. Ne pas utiliser le nom de diagnostic comme identité finale sans réconciliation des brouillons.

Après accord explicite du propriétaire, **le secret de ce seul client a été enregistré dans OpenAI**. Le portail confirme sa conservation et lance le parcours OAuth. Aucune clé serveur Supabase, Neon ou AWS n'a été transmise ; le secret reste absent du Git et des ZIP.

OpenAI a fourni le callback exact **`https://chatgpt.com/connector/oauth/jx_aF3Nv59jf`**, maintenant enregistré et relu sur le client Supabase dédié, sans rotation de secret. Le callback local `http://127.0.0.1:8766/callback` est conservé temporairement pour le diagnostic. L'URI non enregistrée avait reçu 400 ; après raccordement, la même demande atteint le login puis le consentement du reviewer. Les paramètres observés sont PKCE S256, ressource `https://openai-mcp.maxvideoai.com/mcp` et scopes `openid email offline_access profile`.

Après **accord explicite à l'action**, le seul client dédié a été ajouté à la table d'audience, le hook existant a été activé et le reviewer a coché sa majorité puis approuvé la connexion. OpenAI affiche **Authorized**, puis **Configured** et découvre les 42 outils. Cette observation établit l'émission et l'acceptation initiale du jeton par le MCP ; les jetons n'ont pas été extraits et leurs claims n'ont pas été affichés.

**Huit contrôles SQL du hook réussissent** avec rollback : audience exacte, autres claims préservés, client inconnu et issuer étranger inchangés, session ordinaire inchangée, idempotence, audience étrangère inchangée et métadonnées utilisateur sans pouvoir d'autorisation. Après activation, la liste persistante contient exactement le client dédié. Le `SET ROLE supabase_auth_admin` avait été refusé par le connecteur : ces tests fonctionnels utilisent son rôle courant, les privilèges Auth sont vérifiés séparément et le parcours réel complète désormais la preuve.

## Suite ciblée

1. Les 42 contrôles du nouveau scan sont terminés et la correction `get_model_details` est validée. Compléter les preuves des cinq définitions à examiner, toutes conservées ; ne pas assimiler le badge Configuration incomplete à un échec OAuth ni à une autorisation de publier.
2. Qualifier le renouvellement, la révocation et la reconnexion. Retirer le callback local de diagnostic quand les essais n'en ont plus besoin. Conserver exactement le callback ChatGPT observé.
3. Raccorder les fournisseurs/workers nécessaires aux scénarios, avec devis et crédits de test autorisés. La découverte des outils ne prouve pas une exécution fournisseur ni un export.
4. Rejouer les cinq cas positifs et trois négatifs, enregistrer la vidéo et renseigner les accès reviewer. Réconcilier le nom/paquet de diagnostic avant la soumission humaine. Cette dernière n'est pas autorisée par l'essai hébergé.

Preuves locales privées : `evidence/openai-package-0.3.14-state.txt`, `openai-package-0.3.14.jpg`, `openai-domain-verified.jpg`, `first-hosted-http.json`, `oauth-authorize-probe.json`, `reviewer-hosted-login-passed.jpg`. Les tests du paquet refusent les secrets dans le client et les UUID privés ailleurs ; seul le champ public `clientId` a une exception ciblée.

Diagnostic supplémentaire : `evidence/oauth-downloaded-package-comparison.json`, `oauth-recovery-diagnosis.json`, `openai-server-key-change-rejected.jpg`, `openai-fresh-draft-secret-field.jpg`. Les archives expérimentales et le script de reproduction sont dans `.local/openai-directory-20261111/oauth-recovery/`, hors Git. Aucun push, build distant, changement DNS, réactivation Neon, écriture SQL persistante ou changement de réglage Auth n'a été nécessaire à ce diagnostic.

Raccordement autorisé suivant : `evidence/openai-callback-registered.json`, `oauth-audience-hook-checks.json`, `reviewer-oauth-approval-ready.jpg`, `review-auth-hook-activation-ready.jpg`. Le client dédié a reçu son callback OpenAI ; Neon a été brièvement réactivé pour le login. Les détails de la suspension en fin de fenêtre sont relevés dans le journal d'essai. Le grant, l'activation du hook et le scan ont ensuite réussi après accord explicite ; preuves `openai-mcp-inspection.json`, `openai-mcp-findings.json`, `review-auth-hook-enabled.jpg` et `post-oauth-database-counts.json`. Aucun crédit ni génération.

Sources officielles relues : [dépôt et OAuth](https://developers.openai.com/plugins/deploy/submission), [client préenregistré](https://developers.openai.com/plugins/build/plugins#use-a-registered-oauth-client), [callback exact](https://developers.openai.com/plugins/build/auth#redirect-url).

Reconnexion sur le runtime `95be72898` : le champ secret vide annonçait conserver le secret, mais le formulaire renvoyait 400 `mcp_validation`. La réutilisation du **même secret déjà autorisé**, au même destinataire et sans changement de client/scopes, a permis la redécouverte des 42 outils. Le nouveau texte est réellement présent dans l'inspection et le scan `get_model_details` est **complete**, sans findings. Le scan global termine à 17:29:04 UTC ; aucune erreur runtime n'est retournée. Il ne qualifie pas encore l'expiration/refresh ou la révocation. Preuves : `openai-mcp-inspection-after-description.json`, `openai-final-scan-state.json`, `openai-mcp-findings-after-description.json`, `openai-authorized-final-scan.jpg` et `oauth-final-neon-pause.json`.
