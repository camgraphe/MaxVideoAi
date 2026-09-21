# MaxVideoAI MCP — audit élargi et corrections

Date : **22 septembre 2026**. Responsable : ingénierie MaxVideoAI.
Périmètre : découverte, dialogue, reprise, transport HTTP, MCP App et distribution.
Statut : **corrigé et vérifié dans le dépôt** ; aucune publication ni modification
du plugin installé. Aucun appel payant ou média généré pendant ces évaluations.

## Résultat concret

L'élargissement a produit quatre corrections de comportement, au-delà de la
réécriture des instructions. Les agents proposent des pistes ; la revue du code,
les spécifications et les reproductions déterminent les corrections retenues.

| Défaut confirmé | Correction | Preuve |
| --- | --- | --- |
| Le transport lisait tout le corps HTTP avant de vérifier les 128 Kio, lorsque Content-Length manquait ou mentait | Lecture progressive, annulation dès dépassement, libération du lecteur | Le test reçoit deux morceaux dépassant la limite et interdit la lecture du troisième ; l'ancienne lecture consomme les trois. UTF-8 coupé dans un caractère et erreur de lecture couverts |
| L'importeur MCP App réutilisait une destination consommée après l'échec d'un fichier du lot | Nouvelle destination pour chaque fichier réessayé ; protection contre deux uploads simultanés | Exécution JSDOM de start/part/complete : premier fichier réussi, deuxième échoué, reprise du seul deuxième avec une nouvelle destination |
| Après la reprise, le contexte envoyé à l'assistant ne contenait plus que les nouveaux fichiers | Conserver et retransmettre les identifiants de tous les imports réussis dans cette vue | Test en échec avant correction : le premier identifiant manque dans la dernière mise à jour. Après correction, les deux identifiants y figurent |
| Une réponse de génération d'image avec `ok: true` et un marqueur de remboursement pouvait être classée terminée | Examiner le remboursement avant d'accepter l'image ; conserver l'état ambigu si son règlement reste incertain | Test d'une enveloppe remboursée et du cas où la confirmation du remboursement échoue |

Le troisième défaut est spécifique au contrat MCP Apps : les mises à jour de
contexte remplacent le contexte précédent de la vue, et l'hôte peut ne transmettre
que la dernière. Cela exige un état cumulatif des références réussies, même si
chaque lot est traité séparément.
[Spécification MCP Apps](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx#uiupdate-model-context---update-the-model-context).

Propriétaires : `frontend/src/server/mcp/http-handler.ts`,
`frontend/src/server/mcp/reference-upload-app.ts` et
`frontend/src/server/agent-api/paid-generation-execution.ts`. Les tests correspondants
sont `mcp-transport-contract`, `mcp-reference-upload-app` et `mcp-confirm-generation`.
L'importeur exécutable fait désormais partie de `pnpm mcp:client:check`.

## Deux vagues supplémentaires, puis vérification ciblée

Après la [première campagne](mcp-agent-simulations-2026-09-21.md), six nouveaux agents
**gpt-5.6-luna / medium**, en contextes distincts, ont traité les mêmes 24 situations
sous deux versions des consignes : **48 réponses supplémentaires**. Trois agents
ont ensuite audité le code. Deux autres ont réalisé douze exercices ciblés de
construction des paramètres. Maximum : trois sous-agents simultanés.

Le total est donc **105 réponses de conversation simulées**, en comptant les
57 précédentes, **plus 12 exercices de paramètres**. Chaque agent partage un
contexte entre ses cas ; ce ne sont pas 117 sessions indépendantes de clients.
Le modèle utilisé est économique, mais aucun coût facturé ou nombre de tokens
mesuré n'est déduit de ces nombres.

Constats sur les deux nouvelles vagues :

- Les **28 appels proposés** ont des arguments conformes aux schémas. Les seules
  confirmations correspondent au devis explicitement approuvé. Les imports partiels,
  la présentation d'un résultat terminé et l'attente restante de 28 secondes sont
  respectés dans les cas dédiés.
- Les cas de choix de modèle s'arrêtent presque tous à `list_models` : ils ne
  prouvent donc pas que le nouveau texte de `recommend_models.priorities` améliore
  son utilisation. Un cas candidat propose aussi le devis avant d'avoir reçu le
  résultat du contrôle de compte ; c'est une anticipation à corriger dans un vrai
  dialogue séquentiel, sans confirmation payante observée.
- Quatre réponses candidates changent de langue : F01, F08, B02 et B08. Cela reste
  un écart de dialogue. Ce petit échantillon en lots ne permet pas d'attribuer la
  cause à la modification des consignes.
- Deux progrès qualitatifs apparaissent : F05 ne redemande plus la confirmation
  des deux tentatives déjà précisées ; B04 respecte mieux le refus d'alternatives.
  Ils ne constituent pas un taux de réussite généralisable.

Les douze exercices complémentaires fixent volontairement l'outil à
`recommend_models` pour examiner ses paramètres. **Les six exercices réussissent
dans chacune des deux versions** : esthétique → priorité non renseignée, 4K →
résolution, estimation seule → pas de préférence pour le moins cher, rapidité puis
coût → ordre préservé. Cela confirme la cohérence de la clarification, **sans
démontrer une supériorité statistique**. La version initiale produit trois changements
de langue dans ces exercices, la candidate aucun : une autre raison de séparer
paramètres, langue et découverte réelle dans l'évaluation.

## Clarifications et répétitions fusionnées

- Le schéma et le skill `plan` donnent un exemple positif de `priorities: null`
  pour l'esthétique, les mouvements de caméra et l'estimation sans préférence de coût.
  Les capacités, prix et modèles restent issus du serveur ; aucun classement figé ajouté.
- Les skills distinguent le catalogue d'un serveur de l'inventaire complet de
  l'hôte et demandent de récupérer le schéma avant de construire des arguments.
- Dans `generate`, la reprise est regroupée : statut si le job est connu, historique
  si son identifiant manque. Les répétitions internes sur reconnexion, remboursement
  et import manuel sont retirées lorsque leur propriétaire est déjà explicite.
- Les deux skills restent autonomes. Leurs références obligatoires ne sont pas
  fusionnées dans un dossier frère. Les contrats de paiement présents à la fois
  côté serveur et côté skill sont utiles lorsque l'une de ces surfaces est absente.

Les instructions globales restent à **1 528 octets UTF-8**, avec un maximum de
**1 869** sur les 32 combinaisons de capacités. Les descriptions des 14 outils du
profil vidéo/image totalisent **10 969 octets**, inchangés dans cette passe.
Le total des deux corps de skills passe de **14 634 à 14 920 octets** : les exemples
ajoutés dépassent légèrement les répétitions retirées. Ce n'est pas une nouvelle
réduction globale, ni une mesure de tokens ou de latence.

Deux attentes manuelles de l'évaluateur ont été revues avec la politique : une
limite de 40 dollars reste un plafond, sans être une préférence pour le moins cher ;
un autre scénario sans plafond numérique ne doit plus inventer 2 500 cents. Les
prompts, outils attendus et interdictions de dépense restent inchangés. L'empreinte
a été actualisée après cette revue ; ces 70 attentes restent des exemples hors ligne.

## Alertes écartées ou requalifiées

| Signal de l'audit | Décision après revue |
| --- | --- |
| Répondre 406 à un POST n'acceptant que JSON serait un défaut | Écarté : Streamable HTTP exige que le client annonce JSON **et** SSE. Un test protège ce comportement conforme ; aucun assouplissement arbitraire |
| `docs/distribution.md` absent de l'archive serait un oubli | Écarté : document de maintenance avec liens internes, exclu par le builder et son inventaire indépendant. Frontière maintenant explicitée |
| Les scénarios d'évaluation seraient livrés au client | Nom de test trompeur corrigé : ils sont dans les sources. Ils restent exclus de l'archive |
| Le helper n'est pas exécutable directement après extraction | Invocation avec Node.js documentée dans le guide Codex ; démarrage du helper du paquet vérifié sans upload |
| Tous les médias devraient être mélangés dans un lot de l'importeur | Pas de nouvelle fonction : les destinations sont propres à un type de média et les contrôles serveur restent applicables |

La négociation JSON/SSE est documentée dans les versions
[2025-11-25](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/basic/transports.mdx)
et [2026-07-28](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/transports/streamable-http.mdx).

Une limite reste documentée pour le **fallback navigateur** : si l'actif est stocké
puis que la finalisation de sa session échoue, le jeton reste consommé et la réponse
ne rend pas l'identifiant. L'actif peut être retrouvé dans la bibliothèque privée.
L'alerte « irrécupérable » était donc trop large. Libérer aveuglément ce jeton
réautoriserait un import ; aucune telle modification n'a été faite. Une reprise
automatique sûre demande une corrélation persistée entre session et actif, à traiter
séparément si ce cas apparaît en exploitation.

## Vérification et livraison

- `pnpm mcp:client:check` : **142 tests réussis**, puis **70 scénarios hors ligne**.
- Suite `tests/mcp-*.test.ts` et miroir du plugin : **1 053 tests réussis**. Les 142
  tests précédents en sont largement un sous-ensemble ; ne pas additionner ces nombres.
- ESLint frontend, TypeScript sans émission, lint d'exposition et `git diff --check` : réussis.
- Builder local : **59 fichiers de produit et un fichier de sommes de contrôle**.
  Les deux skills et le guide Codex extraits sont identiques aux sources. Les guides
  de maintenance et évaluations internes sont absents, comme prévu.
- Un premier passage a détecté l'ancienne date attendue du guide Codex ; le contrat
  a été actualisé au 22 septembre et les vérifications relancées avec succès.

L'archive technique conserve le numéro source 0.3.5 ; **elle n'est pas une nouvelle
publication de 0.3.5 et ne doit pas écraser le tag existant**. Une livraison exige
une nouvelle version immuable, le déploiement du serveur et les vérifications par
hôte. Le cache installé et le registre de compatibilité n'ont pas été modifiés.

Les suites générales sans rapport avec MCP n'ont pas été relancées dans cette passe.
Ces résultats ne certifient ni une installation cliente, ni une génération réelle,
ni une amélioration des performances réseau mesurée chez les utilisateurs.

## Preuves et prochaine étape utile

Le [dossier de cette passe](../../output/audits/mcp-followup-2026-09-22/) conserve les
entrées, sorties originales, critères déclarés avant tests, contrôles et audits bruts.
Les titres « defect » des audits bruts ne prévalent pas sur la revue ci-dessus.

Empreinte initiale : `788024dfeed7eafa1c405a8e119c9e9592929ba86811bd342c94c263dbc68adb`.
Empreinte candidate : `02490dfe98c1c4b2eb3a6f381501bee93aff04ed89f76250c6cccb367dd08a26`.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json output/audits/mcp-followup-2026-09-22/check-waves.ts
pnpm exec tsx --tsconfig frontend/tsconfig.json output/audits/mcp-followup-2026-09-22/check-mapping.ts
```

Ces commandes revérifient les réponses enregistrées contre les schémas du checkout,
sans rappeler les modèles. Une troisième vague généraliste apporterait moins que
des essais après livraison dans de vraies tâches Codex, Claude et ChatGPT : sélection
implicite, schémas différés, reconnexion, reprise d'import et conservation des références.
Enregistrer version, outils concurrents, langue et résultats un tour à la fois selon
le [protocole client](mcp-client-experience.md#essais-dans-les-vrais-clients).
