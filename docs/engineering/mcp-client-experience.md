# MaxVideoAI : découverte, fluidité et continuité MCP

Créé le **21 septembre 2026**, revu le **22 septembre 2026**. Responsable : ingénierie MaxVideoAI.
Statut : changements préparés et vérifiés dans le dépôt ; publication du plugin,
déploiement du serveur et validation dans chaque hôte restent des étapes distinctes.

## Objectif et limite

Un utilisateur qui veut produire une vidéo, animer une image, comparer des modèles
ou chiffrer un projet doit pouvoir découvrir MaxVideoAI, comprendre la prochaine
étape et reprendre son travail après une interruption. Une simple réécriture de
texte ou une question générale sur YouTube ne nécessite pas d'appel MCP.

Le client décide quels outils et skills charger et utiliser. L'activation implicite
autorise la sélection, elle ne la garantit pas. Améliorer la pertinence des
métadonnées et mesurer la sélection réelle ; ne jamais modifier les instructions
globales du client, désactiver ses autres plugins ou prétendre être prioritaire.
[Contrat MCP des outils](https://modelcontextprotocol.io/specification/2026-07-28/server/tools).

L'[audit du 21 septembre](mcp-client-discovery-audit-2026-09-21.md) documente
l'incident initial : le skill était chargé, mais la connexion demandait une nouvelle
authentification. La raison précise du rejet des identifiants n'a pas été établie.
Ne pas transformer ce constat en preuve d'un défaut de sélection implicite.

La [recherche complémentaire du 21 septembre](mcp-efficiency-research-2026-09-21.md)
consigne les retours récents GitHub/Reddit, les réponses compactes sans perte,
la consigne de délai de suivi et la vérification du registre officiel. Elle
sépare les mesures locales des hypothèses à vérifier dans chaque hôte.

## Propriétaires des instructions

| Surface | Responsabilité | Limite ou contrat |
| --- | --- | --- |
| `plugins/maxvideoai/skills/*/SKILL.md` | Reconnaître une intention et guider le parcours `plan` ou `generate` | Action et média dès les premiers mots ; détails dans les références ; aucune liste de prix ou classement figé |
| `skills/*/agents/openai.yaml` | Invocation implicite et dépendance au serveur | Préserver `allow_implicit_invocation: true` et la dépendance MaxVideoAI |
| `frontend/src/server/mcp/instructions.ts` | Expliquer le produit et orienter vers les bons outils | Maximum **2 000 octets UTF-8**, pour toutes les combinaisons de capacités ; devis, approbation et tentative unique dans les 1 000 premiers octets lorsque la génération est active |
| `frontend/src/server/mcp/tools/*.ts` | Prérequis, effet, suite et récupération de chaque opération | Maximum **2 000 octets UTF-8 par description** ; ne pas recopier le manuel global |
| Schémas et résultats structurés | Contraintes vérifiables et faits vivants | Disponibilité, prix, références et statut issus des services ; annotations de risque cohérentes avec l'effet réel |
| `frontend/src/server/mcp/http-handler.ts` | Réponse HTTP d'authentification compréhensible par l'hôte | 401, découverte OAuth, confidentialité et challenge précis ; aucun secret dans les erreurs |
| `frontend/config/mcp-integrations.json` et son guide | Identité, installation, publication et preuves par hôte | Suivre [le guide du registre](mcp-integration-registry.md), sans déclarer une validation non observée |

La limite de 2 000 octets est notre marge conservatrice : Claude documente une
troncature à 2 Ko des descriptions et instructions avec la recherche d'outils.
Ce n'est pas une taille maximale universelle imposée par MCP.
[Documentation Claude](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search).
Codex peut également raccourcir les descriptions des skills dans son catalogue
initial : les premiers mots doivent rester compréhensibles seuls.
[Documentation des skills](https://learn.chatgpt.com/docs/build-skills).

Ne pas réduire une description en supprimant une contrainte métier. Déplacer la
règle vers l'outil qui en est propriétaire et déplacer son assertion de test avec
elle. Garder le nom et le schéma d'un outil stables sauf changement contractuel
délibéré. Une suggestion de modèle vient des faits actuels et du besoin exprimé.

## Parcours attendu

1. **Comprendre.** Garder le brief, le modèle choisi, les contraintes et les médias
   déjà fournis. Poser uniquement les questions qui changent le résultat ou le coût.
2. **Découvrir.** Une demande de choix utilise les recommandations ; un modèle
   explicitement choisi mène à ses détails. Un budget reste une estimation sans
   réservation. Ne pas remplacer silencieusement le modèle de l'utilisateur.
3. **Préparer.** Résoudre les références privées, conserver leur ordre et réutiliser
   les identifiants retournés. Un import direct réussi ne nécessite pas de relister
   toute la bibliothèque. Préparer un devis seulement lorsque la demande est complète.
4. **Faire approuver.** Montrer le prix exact et attendre l'accord explicite pour ce
   devis. Une réponse ambiguë, une reconnexion, un paiement ou un remboursement ne
   valent pas approbation d'une génération.
5. **Suivre.** Soumettre une seule tentative. Après un résultat de soumission ambigu,
   récupérer le job connu, ou rechercher les jobs récents si son identifiant manque.
   Ne pas relancer pour rendre la conversation plus fluide.
6. **Livrer.** Montrer le résultat terminé avec le lecteur natif lorsqu'il est pris
   en charge ; utiliser sinon les ressources ou destinations réellement retournées.
   Distinguer en cours, terminé, échec et remboursement. Le média reste lié au compte.

L'assistant doit raconter le résultat et la prochaine action utile dans la langue
de l'utilisateur, sans recopier le JSON ou afficher des détails internes inutiles.
Le serveur fournit des faits exploitables, sans prendre en charge la rédaction
créative de toute la conversation. Conserver des outils spécialisés et des erreurs
actionnables suit les [recommandations Anthropic sur les outils](https://www.anthropic.com/engineering/writing-tools-for-agents).

## Plugin installé mais outils indisponibles

Diagnostiquer les états dans cet ordre, sans effacer le travail en cours :

| État observé | Action |
| --- | --- |
| Skill ou package connu, outils absents de la première liste | Rechercher les outils différés du serveur ; une liste de ressources vide ne prouve pas leur absence |
| Connexion déclarée en attente d'authentification | Utiliser la reconnexion de l'hôte et terminer l'identification dans le navigateur |
| Aucun identifiant envoyé au serveur | Conserver le challenge 401 de découverte de la ressource protégée |
| Identifiant bearer envoyé mais refusé | Retourner le même 401 avec `error="invalid_token"` et une description de reconnexion ; ne pas révéler le jeton ni deviner expiration ou révocation |
| Retour après reconnexion | Vérifier la disponibilité des outils et reprendre le brief ; si un job était soumis, le récupérer avant toute nouvelle tentative |
| CLI différent de celui de l'application | Vérifier le chemin et la version réelle ; privilégier le flux de connexion pris en charge par l'hôte |

Le challenge rend l'erreur interprétable ; il ne renouvelle pas lui-même les
identifiants et ne corrige pas une cause inconnue de renouvellement. Les contrôles
de révocation, liaison au client OAuth et propriété restent dans le serveur.
[Spécification d'autorisation MCP](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).
Vérifier la version négociée par les clients avant toute évolution de protocole.

Un catalogue anonyme peut faire l'objet d'une étude séparée. Il faudrait définir
une liste strictement publique, son isolation et ses preuves de compatibilité.
Ce chantier n'autorise pas à rendre publics compte, références, devis ou génération.

## Vérification reproductible

Depuis la racine du dépôt :

```bash
pnpm mcp:client:check
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

`mcp:client:check` vérifie les métadonnées réelles obtenues par `initialize` et
`tools/list`, les 32 combinaisons de capacités, les budgets d'octets, les frontières
de confirmation, les réponses OAuth, les skills et les scénarios conversationnels.
Il contrôle aussi la conservation des données et des liens dans les réponses
JSON compactes, ainsi que les consignes de délai de suivi des jobs.
Il ne lance aucune génération et ne dépense aucun crédit. Ajouter les tests métier
concernés si les services ou opérations changent. La publication du plugin exécute
aussi cette commande avant de fabriquer le paquet.

Les décisions de `tests/fixtures/mcp-tool-selection-curated-policy.json` sont des
attentes **hors ligne**, pas des observations d'un modèle. Après une modification
des instructions, examiner ces attentes puis actualiser l'empreinte de politique.
Ne pas changer les décisions attendues pour contourner une régression.

## Essais dans les vrais clients

Suivre séparément Codex, Claude et ChatGPT. Pour chaque essai, enregistrer date,
version exacte, version du package, environnement serveur, état OAuth, outils
concurrents, prompt, premier outil/skill sélectionné et résultat. Ne conserver ni
identifiant secret, ni URL signée, ni information de compte dans une preuve publique.

| Famille | Exemple | Comportement attendu |
| --- | --- | --- |
| Explicite | « Utilise MaxVideoAI pour comparer des modèles pour cette publicité. » | Skill/outil pertinent et faits actuels |
| Implicite | « Anime cette image pour un Reel vertical de huit secondes. » | Découverte pertinente, détails du mode, références puis devis ; aucun lancement sans accord |
| Implicite de planification | « Quel budget pour cinq Shorts et deux variantes par plan ? » | Hypothèses explicites, options comparables, estimation sans confirmation |
| Modèle imposé | « Utilise ce modèle, j'ai déjà mon prompt. » | Vérifier ce modèle, sans détour par un classement |
| Négatif | « Réécris ce titre YouTube » / « Analyse les vues de cette vidéo » | Pas d'invocation MaxVideoAI inutile |
| Autre produit choisi | « Utilise l'outil vidéo X installé » | Respecter le choix ; ne pas imposer MaxVideoAI |
| Reconnexion | Skill visible, connexion déclarée indisponible | Expliquer la connexion à renouveler, conserver le brief, reprendre après succès |
| Reprise | Réponse interrompue après soumission | Récupérer le job, sans nouvelle dépense |

Tester le serveur brut puis le package complet, dans des tâches neuves et dans
un environnement avec plusieurs plugins. Répéter les prompts dans plusieurs
langues, dont français et anglais, et garder des prompts de validation hors du
jeu utilisé pour rédiger les descriptions. Mesurer rappel sur les demandes
pertinentes, précision des invocations et absence de doubles soumissions.
[Optimisation des métadonnées OpenAI](https://developers.openai.com/plugins/guides/optimize-metadata),
[connexion et essais du package](https://developers.openai.com/plugins/deploy/connect-chatgpt).

Les tests hors ligne ne permettent pas de publier ces taux. Une vraie génération
de validation nécessite son devis et son approbation ; les essais de découverte
et de reconnexion peuvent être réalisés sans dépense.

La [campagne de six agents Luna du 21 septembre](mcp-agent-simulations-2026-09-21.md)
ajoute 48 réponses simulées et neuf contre-essais aux contrôles déterministes.
Elle conserve les sorties brutes et distingue validité des arguments, qualité
du dialogue et limites du contexte simulé. Elle ne remplace pas les preuves par
hôte ; un écart sur l'interprétation de la qualité créative reste documenté.

L'[audit consolidé du 22 septembre](mcp-audit-consolidated-2026-09-22.md) ajoute
deux vagues comparables, des contrôles ciblés des paramètres et trois audits de
code. Il distingue les défauts corrigés, les alertes écartées et les limites des
simulations. Les priorités artistiques ne deviennent pas une exigence de résolution ;
une simple demande d'estimation ne devient pas une préférence pour le moins cher.

Les requêtes HTTP sont bornées pendant leur lecture. Dans l'importeur intégré,
une nouvelle tentative utilise de nouvelles destinations et conserve les actifs
déjà importés dans le contexte transmis à l'hôte. Les réponses d'image portant un
remboursement restent des rejets remboursés ou des états ambigus à vérifier.

## Livraison et maintenance

- **Serveur :** déployer ses instructions et challenges par le flux habituel,
  puis contrôler les métadonnées et réponses HTTP réellement servies.
- **Plugin :** fabriquer et examiner le paquet avec le builder existant, publier
  une nouvelle version immuable par le workflow prévu. Ne pas réécrire le tag
  `v0.3.5` ni le cache installé. Les consignes de maintenance `AGENTS.md` sont
  volontairement exclues du paquet client par la liste de fichiers autorisés.
- **Hôtes :** actualiser les métadonnées par leur mécanisme pris en charge, puis
  vérifier une tâche neuve. Une modification du dépôt ne met pas à jour les
  installations déjà présentes.
- **Preuves :** renseigner le registre uniquement pour les hôtes réellement
  testés. Séparer changement local, publication, déploiement et observation.

Relire ce guide lors d'un changement de protocole, de description, de parcours
OAuth, de format de skills ou de comportement de découverte d'un hôte. Dater le
changement et la source ; garder les consignes courtes dans les deux `AGENTS.md`
locaux et les explications détaillées ici.

## Historique du 21 septembre 2026

- Descriptions des deux skills recentrées sur l'action, le média et les usages
  sociaux ; diagnostic d'absence d'outils et reprise ajoutés.
- Instructions vidéo/image avec références : **9 539 → 1 364 octets UTF-8**
  (environ **86 %** de réduction). Maximum mesuré sur les 32 combinaisons :
  **1 705 octets**. Ce sont les chaînes serveur, pas la taille finale du contexte
  construit par chaque hôte. Ces mesures décrivent la première révision ; la
  revue de conservation ci-dessous donne les valeurs après renforcement.
- Règles détaillées déplacées dans leurs outils, notamment contraintes de mode,
  références privées, recommandations, devis, recharge, récupération et livraison.
- Refus d'un bearer explicité avec `invalid_token`, sans modifier l'autorisation
  métier ni attribuer une cause non prouvée au rejet.
- Contrats de métadonnées et de transport renforcés ; commande de vérification
  et consignes de maintenance ajoutées. Aucun taux de sélection réelle n'est
  revendiqué pour cette révision avant les essais par hôte.

### Compte rendu de validation

| Contrôle local | Résultat du 21 septembre 2026 |
| --- | --- |
| `pnpm mcp:client:check` | 133 tests réussis et évaluation des 70 scénarios hors ligne réussie |
| Ensemble `tests/mcp*.test.ts`, contenu GitHub et miroir du plugin | 1 065 tests réussis, aucun ignoré |
| Contrats de fabrication et miroir du paquet | 87 tests réussis |
| Lint frontend, TypeScript, exposition publique, `git diff --check` | Réussis |
| Fabrication locale du paquet | Réussie ; 59 fichiers contrôlés, skills identiques aux sources, aucun `AGENTS.md` de maintenance exporté |
| Suite générale, PostgreSQL 17 | 5 722 tests réussis sur 5 723 ; un échec hors périmètre MCP sur le lien de connexion marketing |
| Intégrations Studio isolées | 5 essais arrêtés par le garde-fou interdisant les fichiers d'environnement dans le dossier source |
| Nouvelle sélection implicite dans chaque hôte | Non mesurée pour cette révision ; aucun score client revendiqué |

La validation générale a été relancée avec les binaires PostgreSQL 17 déjà
installés : le shell choisissait d'abord PostgreSQL 14, alors que les contrats
Studio qualifient la version 17. Aucun test de version n'a été affaibli.
L'échec marketing concerne `tests/examples-pages-performance.test.ts`, qui attend
une forme précise du lien de connexion dans `MarketingNav.tsx`, modifié par un
autre chantier du dossier partagé. Ces fichiers n'ont pas été corrigés ici.
Les intégrations Studio doivent être rejouées dans leur environnement isolé sans
fichiers `.env` ; leur protection n'a pas été contournée.

Le paquet fabriqué est uniquement un contrôle local à partir de la version source
0.3.5. Il ne remplace pas la version publiée 0.3.5 : prévoir une nouvelle version
immuable pour livrer cette révision. Aucun tag, déploiement, cache installé ou
registre de certification des hôtes n'a été modifié.

### Revue de conservation des consignes — 21 septembre 2026

Une réduction du seul bloc général n'est pas une mesure de la quantité totale
de consignes conservées. Ne pas optimiser un pourcentage de compression : les
règles transversales doivent être visibles avant la sélection des outils, et les
descriptions doivent rendre leurs prérequis et cas d'échec explicites.

Comparaison avec la version Git précédant ce chantier, pour les mêmes 14 outils
vidéo/image visibles par le modèle, avec génération et références activées :

| Texte serveur, octets UTF-8 | Avant | Après revue |
| --- | ---: | ---: |
| Instructions générales | 9 539 | 1 528 |
| Descriptions des 14 outils | 4 771 | 10 788 |
| Total des deux surfaces | 14 310 | 12 316 |

Le total baisse donc d'environ **14 %**, tandis que le bloc général baisse de
84 %. Ce total exclut les schémas, résultats, skills et ajouts propres aux hôtes ;
ce n'est pas une mesure des tokens effectivement injectés dans une conversation.
Les 32 combinaisons d'instructions générales restent sous 2 000 octets, avec un
maximum de **1 869**. La description de `get_model_details` mesure **1 767** octets.

| Famille de règles de l'ancien bloc | Propriétaire actuel et vérification |
| --- | --- |
| Création des scripts, prompts, plans et références | Instructions générales ; liste explicite des responsabilités créatives rétablie |
| Modèle imposé, indisponibilité et alternatives | Instructions générales et `recommend_models` ; explication et accord avant alternatives rétablis explicitement |
| Qualité, diversité pertinente, alternatives et budgets comparables | `recommend_models` et `calculate_project_budget` ; contrats de choix et d'estimation |
| Faits vivants, champs facultatifs et questions utiles | Instructions générales, descriptions et schémas ; aucune valeur inventée |
| Modes, rôles, durées, formats, audio et contraintes propres au modèle | `get_model_details`, schémas et `prepare_generation` ; cas de référence privés conservés |
| Édition d'image et masque | `get_model_details` ; rôle `mask` rétabli explicitement, dimensions personnalisées conservées |
| Guides officiels de prompt | `get_model_details` ; signaler l'absence de source revue et partager son URL quand utile, sans inventer de guide |
| Compte, crédits, bibliothèque et destinations | `get_account_status`, instructions générales et outils de récupération ; URLs retournées uniquement |
| Imports et chemins de repli | `import_reference_files`, `create_reference_upload_link`, `list_media` ; ordre, succès partiels, helper et import navigateur conservés |
| Devis, approbation, expiration et financement | `prepare_generation`, `confirm_generation`, `create_topup_link` et bloc général ; contrats de tentative unique conservés |
| Échec, remboursement, interruption et présentation | Outils de statut, historique et présentation ; aucune resoumission automatique |
| Audio | Outils Audio et descriptions de récupération ; téléchargement réservé à l'app par ses métadonnées existantes |
| Plan de montage | `prepare_montage` ; vidéos prêtes et absence d'URL Studio rétablies explicitement |
| Projet Studio persistant | `create_studio_montage` ; ordre, destination exacte et nouvelle clé pour une demande modifiée rétablis explicitement |

Changements de politique intentionnels à distinguer d'un simple déplacement : la
préférence nommant Seedance 2.5 dans le texte général a été retirée ; le classement
doit venir des faits actuels et des priorités de l'utilisateur. La route Standard
reste identifiée, mais une affirmation « moins chère » doit utiliser les prix
vivants. Les consignes Audio ne sont annoncées que si la génération payante est
également active, conformément aux outils réellement exposés.

Les assertions ajoutées ont d'abord détecté quatre cas insuffisamment explicites,
puis les 13 tests de métadonnées et de montage concernés ont réussi après
correction. Cela prouve la présence des consignes, pas l'équivalence du comportement
des assistants. Le protocole d'essais dans les vrais hôtes reste nécessaire.
Après ce renforcement, les 133 tests du contrôle client et son évaluation hors
ligne, les 1 065 tests MCP/packaging, le lint et le contrôle d'exposition réussissent.

### Revue complémentaire d'efficacité — 21 septembre 2026

Le [rapport complémentaire](mcp-efficiency-research-2026-09-21.md) donne les mesures
et contrôles après ajout du JSON compact sans perte et des consignes de délai de
suivi. Le total instructions et descriptions des quatorze outils atteint alors
**12 497 octets** ; le contrôle client compte **135 tests et 70 scénarios hors ligne**.
La preuve publique du registre a aussi été actualisée à 0.3.5. Les chiffres des
sections précédentes restent ceux de leurs révisions respectives.
