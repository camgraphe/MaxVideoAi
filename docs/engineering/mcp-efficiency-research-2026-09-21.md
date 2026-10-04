# MaxVideoAI MCP : améliorations à fort bénéfice, complexité limitée

Recherche et revue : **21 septembre 2026**. Responsable : ingénierie MaxVideoAI.
Périmètre : découverte, poids des réponses, continuité et distribution.
Statut : changements locaux ; publication et essais comparatifs par hôte séparés.
Le [guide client](mcp-client-experience.md) reste la référence opérationnelle.

## Décisions retenues

| Priorité | Décision | Bénéfice et limite |
| --- | --- | --- |
| Maintenant | Sérialiser le texte JSON sans indentation | Moins d'octets, mêmes valeurs ; le gain en tokens dépend du lecteur utilisé par l'hôte |
| Maintenant | Expliciter le délai de suivi déjà renvoyé par le serveur | Éviter les vérifications trop rapprochées ; consigne testée, respect réel à mesurer |
| Maintenant | Actualiser la preuve du registre officiel | Identité et version cohérentes ; une inscription ne garantit aucune recommandation automatique |
| Prochaine validation | Comparer des tâches neuves dans les vrais clients | Mesurer la découverte et les détours réels avant d'ajouter des mécanismes |
| Sur besoin démontré | Schémas de sortie supplémentaires, optimisation des gros résultats | Cibler un outil et un problème observés ; conserver ses champs métier et ses erreurs |

Aucun outil, service, cache, runtime d'exécution ou dépendance n'est ajouté.
Les générations restent des jobs identifiables et récupérables ; aucune génération
payante n'a été utilisée pour ces mesures.

## Réponses plus légères, contenu conservé

`frontend/src/server/mcp/tool-result.ts` produisait une copie JSON indentée dans
le bloc texte, en plus de `structuredContent`. Seule l'indentation est retirée.
Les valeurs, messages, espaces du prompt et liens médias restent inchangés.
La limite existante de vingt liens par résultat n'est pas modifiée.

Conserver les deux représentations suit la recommandation de compatibilité du
[contrat MCP des outils](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#structured-content).
Supprimer tout le bloc texte serait un changement de compatibilité, pas une simple
optimisation. Les résultats doivent aussi rester conformes à tout `outputSchema`
déclaré ; ce chantier ne change ni la version de protocole ni le SDK.

Mesures de `tests/mcp-result-serialization.test.ts`, sur trois objets synthétiques.
Taille UTF-8 du résultat MCP sérialisé, incluant texte, données structurées et lien
de ressource ; hors enveloppe JSON-RPC, en-têtes et compression HTTP :

| Exemple de test | Avant, octets | Après, octets | Réduction |
| --- | ---: | ---: | ---: |
| Catalogue de dix modèles fictifs | 7 085 | 5 214 | 26,4 % |
| Devis avec références et prompt multiligne | 1 072 | 953 | 11,1 % |
| Job en cours avec prochaine vérification | 649 | 582 | 10,3 % |

Ce ne sont ni des mesures de trafic de production, ni des économies de tokens,
ni des temps de réponse. Un hôte consommant uniquement `structuredContent` peut
ne gagner aucun token. Un résultat aplati peut aussi être présenté différemment
par un client affichant directement le JSON : le rendu réel reste à vérifier.

Les tests comparent toutes les valeurs après parsing, les données structurées,
les URLs exactes, Unicode, espaces, sauts de ligne, `false`, `0`, `null` et les
erreurs actionnables. Ils échouaient avant le changement et passent après.

## Suivi des générations

`frontend/src/server/agent-api/generation-status.ts` renvoie déjà l'outil, ses
arguments et un délai borné dans `retry`, ou `null` quand le suivi automatique
doit s'arrêter. Cette logique métier ne change pas.

La description de `get_generation_status`, le skill `generate` et sa référence
de sécurité explicitent maintenant : attendre au moins `retry.afterSeconds`,
utiliser l'outil et les arguments retournés, arrêter si `retry` est nul.
Une interruption se résout toujours en récupérant le job existant. Aucun rappel,
ordonnanceur ou nouvel essai payant automatique n'est créé.

Les instructions générales restent à **1 528 octets**, avec un maximum de
**1 869** sur les 32 combinaisons. Les descriptions des mêmes quatorze outils
vidéo/image passent de **10 788 à 10 969 octets** après cet ajout. Total des deux
surfaces : **12 497 octets**. Cette précision utile justifie l'augmentation ;
réduire systématiquement la longueur n'est pas l'objectif.

## Présence et découverte

L'[API publique du registre officiel](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.maxvideoai%2Fmaxvideoai&version=latest)
a été consultée en lecture seule le 21 septembre. Elle retourne un enregistrement
`com.maxvideoai/maxvideoai`, version **0.3.5**, actif et marqué comme dernière
version, publié le **16 septembre 2026 à 20:25:15.392 UTC**, avec le serveur
`https://api.maxvideoai.com/mcp`. Deux documents mentionnaient encore 0.3.3 :
la documentation de distribution du plugin et la matrice GitHub sont corrigées.
Ce contrôle n'actualise pas les preuves des autres hôtes ni leurs revues de politique.

La [documentation de l'API du registre](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/api/official-registry-api.md)
décrit une recherche par sous-chaîne du nom. Ajouter des mots-clés partout ou
changer une identité publiée n'est donc pas une stratégie démontrée de sélection
chez les clients. Le registre fournit des métadonnées ; l'hôte garde son propre
catalogue, ses autorisations et son mécanisme de sélection.

Pour la visibilité chez l'utilisateur, maintenir surtout une description claire
de l'action, des skills distincts, les informations vivantes dans les outils et
des preuves par client. Les [recommandations OpenAI sur les métadonnées](https://developers.openai.com/plugins/guides/optimize-metadata)
préconisent des jeux de demandes pertinentes, ambiguës et négatives. Les soixante-dix
scénarios actuels sont des attentes hors ligne, pas des observations d'un modèle.

## Sources récentes et niveau de preuve

Toutes les sources ci-dessous ont été consultées le 21 septembre 2026.

| Source | Nature | Conclusion applicable |
| --- | --- | --- |
| [Anthropic, Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use) | Retour d'ingénierie, 24 novembre 2025 | La recherche d'outils s'appuie sur leur identité et leurs descriptions ; son chargement différé appartient au client |
| [Anthropic, Writing effective tools](https://www.anthropic.com/engineering/writing-tools-for-agents) | Recommandations de conception et d'évaluation | Réponses pertinentes, filtres, limites et erreurs actionnables ; tester des demandes réalistes |
| [Codex #38287](https://github.com/openai/codex/issues/38287) | Signalement GitHub, août 2026, App 26.803.81509 | Un auteur observe la perte de `content` avec `structuredContent` ; contrôler les deux chemins et le rendu, sans généraliser à tous les clients |
| [Codex #31136](https://github.com/openai/codex/issues/31136) | Signalement GitHub, juillet 2026 | Le traitement et l'échappement du texte peuvent amplifier son poids ; mesurer notre format sans annoncer leur résultat comme le nôtre |
| [Codex #33717](https://github.com/openai/codex/issues/33717) | Signalement GitHub, juillet 2026 | Un problème de métadonnées lors du chargement différé motive des essais du lecteur, pas un contournement global |
| [Reddit, tool_search always fails on first try](https://www.reddit.com/r/ClaudeAI/comments/1rk3khy/tool_search_always_fails_on_first_try/) | Témoignage communautaire | Ajouter un essai de première découverte à froid ; ce message n'établit pas la cause de l'incident MaxVideoAI |
| [GitHub MCP, default toolsets](https://github.com/github/github-mcp-server/discussions/1182) | Discussion du projet fournisseur | Exposer un périmètre utile ; aucune justification pour multiplier nos outils sans besoin |
| [Cloudflare, Code Mode MCP](https://blog.cloudflare.com/code-mode-mcp/) | Retour d'ingénierie fournisseur | Réponse à une très grande API ; une passerelle d'exécution n'est pas proportionnée à notre catalogue courant |

Les tickets et Reddit servent à identifier les cas à reproduire. Ils ne prouvent
ni un défaut de la version actuelle de chaque client, ni un pourcentage universel
d'économie, ni la cause d'une perte d'authentification. Les règles de compatibilité
proviennent du protocole et les changements retenus sont vérifiés dans notre code.

## Ce qui attend une preuve de besoin

- Une passerelle `search/execute` ou un moteur de code ajouterait routage, droits
  et exploitation. Réexaminer seulement si le catalogue ou le nombre d'appels
  deviennent un problème mesuré.
- Un cache du solde ou du devis exact risque de servir un état périmé. Mesurer les
  appels et distinguer catalogue public et données privées avant tout cache.
- Les schémas de sortie peuvent aider la validation. Les ajouter progressivement
  à un contrat concret, avec ses succès et erreurs, dans un chantier identifié.
- Les évolutions du SDK et du protocole nécessitent une matrice de compatibilité.
  Leur nouveauté seule ne justifie pas une migration simultanée.

Le prochain investissement prioritaire est le protocole d'[essais dans les vrais
clients](mcp-client-experience.md#essais-dans-les-vrais-clients) : première sélection,
nombre d'appels avant résultat utile, rendu et reprise après reconnexion, avec
versions exactes et prompts de validation séparés. Les gains annoncés devront
correspondre aux mesures réellement observées.

## Reproduire les contrôles

```bash
pnpm mcp:client:check
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-result-serialization.test.ts
```

Le contrôle client inclut désormais les tests de sérialisation. L'empreinte de
politique a été actualisée après revue de la consigne de suivi ; aucune des
soixante-dix décisions attendues n'a été réécrite.

### Résultats du 21 septembre 2026

| Vérification | Résultat |
| --- | --- |
| Contrôle client | 135 tests réussis ; 70 scénarios hors ligne validés |
| Ensemble MCP, contenu GitHub et miroir du plugin | 1 066 tests réussis sur 1 067 au premier passage ; seul échec : une assertion documentaire attendait encore 0.3.3 |
| Correction de cette assertion selon la preuve publique | Les trois tests du fichier de distribution réussissent ; dates de contrôle et de publication également vérifiées |
| Lint frontend, TypeScript, exposition publique, différences Git | Réussis |
| Fabrication locale du paquet | Réussie ; aucun `AGENTS.md` de maintenance exporté |

Le paquet est un contrôle technique à partir de la version source 0.3.5, pas un
remplacement de la version déjà publiée. Livrer ces changements nécessite une
nouvelle version immuable du plugin et le déploiement du serveur. Aucun cache
client, tag, registre distant ni déploiement n'a été modifié par cette recherche.
