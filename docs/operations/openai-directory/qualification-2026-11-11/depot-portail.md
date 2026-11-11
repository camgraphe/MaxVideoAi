# Brouillon OpenAI — 11 novembre 2026

## Dépôt effectué

- Organisation et projet : MaxVideoAI ; identité Individual vérifiée ; résidence Global.
- Plugin : `plugin_asdk_app_6af4711f72f08191bf141a80553b9c9d`.
- App MCP associée : `asdk_app_6af4711f72f08191bf141a80553b9c9d`.
- Version de brouillon : `appsub_6af4711f73788191b4b0e16925c30444`, paquet **0.3.13**.
- [Ouvrir le brouillon](https://platform.openai.com/plugins/manage/plugin_asdk_app_6af4711f72f08191bf141a80553b9c9d?tab=details&version=appsub_6af4711f73788191b4b0e16925c30444).
- SHA-256 du ZIP envoyé : `4e7469d566f5e4890d07cee72526506004a2deb82cc7e6b0925697137516e4d8`.
- Statuts observés : **Draft**, **Not submitted**, **Not published**.
- Métadonnées : **No findings**. À 14 h 50 Europe/Madrid, les skills `generate`
  et `plan` restent **Checking**, « 0 of 2 skills checked ». Ce statut ne signifie
  ni validation ni rejet. Aucun scan d'outils MCP n'a été effectué.
- Formulaire de revue : cinq scénarios positifs et trois négatifs reconnus comme
  complets, traductions FR/ES et notes de version importées. « Complets » décrit
  les champs du formulaire ; ces scénarios restent à exécuter sur le compte dédié.
- Pièces encore signalées manquantes : **Reviewer credentials** et
  **Supporting content** (URL de vidéo de démonstration).

Le ZIP contient uniquement les fichiers publics prévus, sans clés ni accès reviewer.
L'import ne vaut ni revue humaine, ni publication, ni preuve de fonctionnement MCP.
La capture et le relevé DOM sont conservés sous
`.local/openai-directory-20261111/portal/draft-created.jpg` et `draft-snapshot.txt`.

## Raccordement demandé par le portail

Le serveur déclaré est `https://openai-mcp.maxvideoai.com/mcp`, avec OAuth.
Le panneau affiche **Domain not verified** et indique qu'il ne peut pas découvrir
les métadonnées OAuth de cette URL. Aucun serveur n'a été authentifié ; aucun
outil ni widget n'a encore été scanné.

Le challenge exact a été conservé, sans retour à la ligne, dans
`.local/openai-directory-20261111/portal/openai-apps-challenge.txt`.
Il devra être servi en texte brut à
`https://openai-mcp.maxvideoai.com/.well-known/openai-apps-challenge` sur le seul
hébergement dédié. Aucun challenge du domaine principal ou d'une autre app ne
doit être remplacé. Aucun changement DNS ou publication HTTP n'a été effectué.

La documentation actuelle ne permet pas de changer librement l'URL du serveur
dans le flux de mise à jour : le brouillon a donc bien conservé le domaine final,
et non le domaine temporaire `openai-review.maxvideoai.com`. Pour qualifier ce
brouillon, le domaine final devra aboutir à l'environnement isolé ; cela ne
nécessite aucune modification des domaines habituels ni des bases normales.

Avant connexion :

1. Rendre l'hébergement dédié opérationnel et vérifier son isolation, ses coûts,
   son HTTPS et sa découverte OAuth.
2. Utiliser les paramètres du vrai client OAuth dédié. Si le client est
   préenregistré, déclarer son identifiant et sa méthode d'authentification dans
   `mcp.json`, puis téléverser une nouvelle version. Ne jamais y mettre son secret.
3. Relever le callback réel dans le flux OpenAI, le déclarer chez le fournisseur
   Auth, puis saisir le secret éventuel uniquement dans le formulaire sécurisé.
   Aucun callback ni identifiant client n'est inventé dans ce dossier.
4. Vérifier le challenge puis connecter le compte de test et examiner les scans
   des outils et widgets.
5. Exécuter les cinq scénarios positifs et trois négatifs, compléter le compte
   reviewer et la vidéo avant toute soumission humaine.

Sources officielles consultées le 11 novembre :
[dépôt et OAuth](https://developers.openai.com/plugins/deploy/submission),
[authentification du manifeste](https://developers.openai.com/plugins/build/plugins#configure-mcp-authentication).
