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

## Point OAuth restant, observé dans le portail

Le ZIP 0.3.13 ne déclarait que `auth.type: oauth`. Le premier Connect a demandé un client `provided` et son `clientId`. Le client réel `324a5cbd-2929-4ba1-82a6-58083f5ccb33` a donc été créé sur Supabase `ajwofjldwawdwtioekuc`, puis déclaré dans 0.3.14 avec `tokenEndpointAuthMethod: client_secret_basic`, conformément à la documentation actuelle.

Après import et rechargement, le panneau Settings affiche bien ces trois champs et le bon identifiant. **Connect renvoie néanmoins encore « OAuth client ID missing from plugin ZIP »**. Le champ secret n'est alors pas proposé. L'origine de l'incohérence n'est pas établie ; ne pas présenter une hypothèse de cache ou d'enregistrement figé comme une cause prouvée. Aucune suppression de plugin ou recréation de brouillon effectuée pour contourner ce point.

Le secret du client est conservé uniquement dans le dossier local privé, hors Git et ZIP ; il n'a pas été transmis à OpenAI. Aucun grant OAuth accordé, aucun scan d'outils lancé. Le callback OpenAI n'a pas été révélé. Le seul callback enregistré est celui du diagnostic local `http://127.0.0.1:8766/callback` : il ne doit pas être présenté comme un callback OpenAI. Le test d'autorisation avec PKCE S256 retourne 302 vers `/oauth/consent` du site dédié ; une URI de retour non enregistrée reçoit 400 sans redirection. Ce test ne qualifie pas encore l'échange de code, l'audience, le refresh ou la révocation.

## Reprise ciblée

1. Résoudre l'enregistrement OAuth sauvegardé dans le portail en conservant les preuves du manifeste correct. Utiliser un parcours de reconfiguration officiellement disponible ; ne pas ajouter de champs non documentés, publier un secret, supprimer le plugin ou contacter un tiers sans instruction.
2. Relever le callback exact demandé par OpenAI, l'enregistrer sur le seul client dédié et retirer le callback de diagnostic quand il n'est plus utile. Transmettre le secret uniquement au champ sécurisé du brouillon, après accord pour cette transmission précise.
3. Réactiver la base de test et ajouter ce client à la liste du hook d'audience dédié ; activer/qualifier le hook, puis tester connexion, audience de ressource, refresh, révocation et reconnexion. Le hook est encore désactivé et sa liste vide.
4. Lancer la découverte des outils/widgets, puis raccorder les fournisseurs/workers nécessaires aux scénarios, avec devis et crédits de test autorisés.
5. Rejouer les cinq cas positifs et trois négatifs, enregistrer la vidéo et renseigner les accès reviewer avant toute soumission humaine. Aucune soumission n'est autorisée par le premier essai hébergé.

Preuves locales privées : `evidence/openai-package-0.3.14-state.txt`, `openai-package-0.3.14.jpg`, `openai-domain-verified.jpg`, `first-hosted-http.json`, `oauth-authorize-probe.json`, `reviewer-hosted-login-passed.jpg`. Les tests du paquet refusent les secrets dans le client et les UUID privés ailleurs ; seul le champ public `clientId` a une exception ciblée.

Sources officielles relues : [dépôt et OAuth](https://developers.openai.com/plugins/deploy/submission), [client préenregistré](https://developers.openai.com/plugins/build/plugins#use-a-registered-oauth-client), [callback exact](https://developers.openai.com/plugins/build/auth#redirect-url).
