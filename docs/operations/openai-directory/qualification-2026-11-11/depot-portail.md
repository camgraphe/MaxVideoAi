# Brouillon OpenAI — 11 novembre 2026

## État actuel

- Organisation/projet MaxVideoAI, résidence Global, identité Individual vérifiée.
- Plugin `plugin_asdk_app_6af4711f72f08191bf141a80553b9c9d`, app associée `asdk_app_6af4711f72f08191bf141a80553b9c9d`.
- [Brouillon dans OpenAI](https://platform.openai.com/plugins/manage/plugin_asdk_app_6af4711f72f08191bf141a80553b9c9d).
- Paquet **0.3.14** importé ; SHA-256 `46a86cf4251273772e1a699483cb1055139aed7e2f2bda0196bdd47b34e15ade`.
- **Draft**, **Not submitted**, **Not published**. Métadonnées **No findings**, skills `plan` et `generate` **Checks passed**, après actualisation du portail.
- Les cinq scénarios positifs et trois négatifs sont présents dans le formulaire, mais restent à exécuter. Reviewer credentials et Supporting content (vidéo) restent à renseigner.

## Hébergement et domaine validés

Le serveur déclaré reste `https://openai-mcp.maxvideoai.com/mcp`. Les deux sous-domaines aboutissent uniquement à l'hébergement dédié ; aucun domaine normal n'a été réaffecté. HTTPS, challenge texte exact et découverte OAuth répondent. Le portail affiche **Domain verified**, y compris après actualisation.

Le compte de démonstration fonctionne sur `https://openai-review.maxvideoai.com/login?mode=signin` : connexion navigateur, création du profil, acceptation autorisée des documents puis déconnexion. Solde 0 $, aucun job ni reçu. La base dédiée est remise en pause entre essais : la réactiver avant de reprendre une session applicative. Les 18 crons dédiés restent suspendus.

## Blocage OAuth isolé et reprise préparée

Le ZIP 0.3.13 ne déclarait que `auth.type: oauth`. Le premier Connect a demandé un client `provided` et son `clientId`. Le client réel `324a5cbd-2929-4ba1-82a6-58083f5ccb33` a donc été créé sur Supabase `ajwofjldwawdwtioekuc`, puis déclaré dans 0.3.14 avec `tokenEndpointAuthMethod: client_secret_basic`, conformément à la documentation actuelle.

Dans l'ancien brouillon, le panneau Settings affiche ces trois champs, mais **Connect renvoie « OAuth client ID missing from plugin ZIP »**, sans champ secret. Le diagnostic du 11 novembre établit maintenant la différence : les 13 fichiers du ZIP téléchargé depuis OpenAI sont identiques au paquet local, tandis que la version interne de connexion `asdk_app_v_c6eeb467eba48191bcd2123ed09301c5` n'a pas de `client_id` dans sa configuration OAuth. Le rechargement ne la resynchronise pas. La découverte des endpoints Supabase et de PKCE S256 fonctionne.

Un essai de remplacement de la clé MCP dans le brouillon a été refusé par le portail : **Create a new plugin to change MCP servers**. Cette importation n'a pas remplacé la version 0.3.14. Aucun serveur applicatif ni fonctionnalité n'a été modifié.

Un **brouillon de diagnostic indépendant** a ensuite été créé par l'interface officielle : [MaxVideoAI OAuth Test](https://platform.openai.com/plugins/manage/plugin_asdk_app_6af49bb426f08191a95f4331a3cb3739), paquet `maxvideoai-oauth-test` 0.3.15, version de soumission `appsub_6af49bb42730819199847f39ad7a8dd0`. Seuls le nom du paquet, le nom affiché, la version et les checksums diffèrent de 0.3.14 ; **le manifeste MCP et les skills sont identiques**. SHA-256 : `9f44db9f5c7d287050a7a10701cfaff763768ce17fbc6704bcff552428907906`.

Ce nouveau brouillon initialise bien `client_id` et `client_secret_basic` dans sa connexion `asdk_app_v_aefb818cb90481918c10797f85c72963`. Le champ **OAuth Client Secret apparaît** ; domaine vérifié, métadonnées sans anomalie, deux skills validés. Cela isole l'échec à la reprise de l'ancienne configuration et fournit un chemin de connexion utilisable. Cela ne prouve pas encore une autorisation OAuth réussie. L'ancien brouillon est conservé ; aucun des deux n'est soumis ou publié. Ne pas utiliser le nom de diagnostic comme identité finale sans réconciliation des brouillons.

Le secret du client est conservé uniquement dans le dossier local privé, hors Git et ZIP ; il n'a pas été transmis à OpenAI. Aucun grant OAuth accordé, aucun scan d'outils lancé. Le callback OpenAI n'a pas été révélé. Le seul callback enregistré est celui du diagnostic local `http://127.0.0.1:8766/callback` : il ne doit pas être présenté comme un callback OpenAI. Le test d'autorisation avec PKCE S256 retourne 302 vers `/oauth/consent` du site dédié ; une URI de retour non enregistrée reçoit 400 sans redirection. Ce test ne qualifie pas encore l'échange de code, l'audience, le refresh ou la révocation.

## Reprise ciblée

1. Accord ciblé demandé pour transmettre le secret du seul client OAuth dédié au champ sécurisé du brouillon **MaxVideoAI OAuth Test**, puis lancer Connect. Aucune clé serveur Auth/base/stockage ne doit être transmise au portail.
2. Relever le callback exact demandé par OpenAI, l'enregistrer sur le seul client dédié et retirer le callback de diagnostic quand il n'est plus utile. Aucun callback OpenAI n'est encore connu. Le consentement du reviewer reste une étape distincte.
3. Réactiver la base de test et ajouter ce client à la liste du hook d'audience dédié ; activer/qualifier le hook, puis tester connexion, audience de ressource, refresh, révocation et reconnexion. Le hook est encore désactivé et sa liste vide.
4. Lancer la découverte des outils/widgets, puis raccorder les fournisseurs/workers nécessaires aux scénarios, avec devis et crédits de test autorisés.
5. Rejouer les cinq cas positifs et trois négatifs, enregistrer la vidéo et renseigner les accès reviewer avant toute soumission humaine. Aucune soumission n'est autorisée par le premier essai hébergé.

Preuves locales privées : `evidence/openai-package-0.3.14-state.txt`, `openai-package-0.3.14.jpg`, `openai-domain-verified.jpg`, `first-hosted-http.json`, `oauth-authorize-probe.json`, `reviewer-hosted-login-passed.jpg`. Les tests du paquet refusent les secrets dans le client et les UUID privés ailleurs ; seul le champ public `clientId` a une exception ciblée.

Diagnostic supplémentaire : `evidence/oauth-downloaded-package-comparison.json`, `oauth-recovery-diagnosis.json`, `openai-server-key-change-rejected.jpg`, `openai-fresh-draft-secret-field.jpg`. Les archives expérimentales et le script de reproduction sont dans `.local/openai-directory-20261111/oauth-recovery/`, hors Git. Aucun push, build distant, changement DNS, réactivation Neon, écriture SQL persistante ou changement de réglage Auth n'a été nécessaire à ce diagnostic.

Sources officielles relues : [dépôt et OAuth](https://developers.openai.com/plugins/deploy/submission), [client préenregistré](https://developers.openai.com/plugins/build/plugins#use-a-registered-oauth-client), [callback exact](https://developers.openai.com/plugins/build/auth#redirect-url).
