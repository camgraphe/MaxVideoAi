# MaxVideoAI : découverte, fluidité et continuité MCP

## Luma source timing — 22 October 2026 source candidate

Ray 3.2 Modify requires a verified owned 5s/10s source matching the selected
class before estimates and transactional repricing. Reframe accepts sources up
to 10s and publishes a requested 5s/10s output duration. Discovery distinguishes
these timing policies and keeps the official Agents generation/edit/reframe
sources separate from legacy Ray 2 guidance. Guide images retain their existing
reference behavior. Global instructions and tool descriptor schemas are unchanged.
No production activation, plugin release or real-host qualification is inferred.


## Keyframe project budgets — 21 October 2026 source candidate

`calculate_project_budget.settings.keyframeIndexes` now carries the optional
canonical keyframe control already exposed by model details and preparation.
It accepts a comma-separated string of at most 128 characters; null and omission
retain the existing optional-field normalization. For FLUX 3 Max reference mode,
each declared image requires one unique position from 0 through duration × 24
inclusive. Input order stays paired with reference order, without automatic
sorting or invented positions. Missing or invalid positions return the public
`keyframeIndexes` field in the existing line-edit action before pricing.

Canonical mode validation and pricing are unchanged. Local regressions cover
the four Max modes, 720p/1080p at 5/10 seconds, exact position preservation,
invalid positions and unsupported model/mode combinations. In-memory MCP tests
cover nullable compatibility and explicit transport. These are nonspending
checks; a budget still requires a fresh exact quote and explicit approval before
generation.

Measured metadata: the budget descriptor remains 1,046 UTF-8 bytes, its serialized
input schema is 4,100 bytes, and the collector's global instruction string remains
1,551 bytes. The additive schema changes the reviewed policy fingerprint to
`85856e4ca6626277e799d69532eb3175a9d613df13ede09ae147b1b3f8fb97a3`;
the 70 curated decisions and fixture fingerprint are unchanged. Delivery and
host-catalog refresh remain separate; no installed-plugin or real-host
qualification is inferred from these local checks.

Validation: the four added budget regressions failed before the correction;
the focused budget/Max suites then passed 39/39. `mcp:client:check` passed
173 tests with one skip and all 70 curated scenarios. TypeScript, exposure lint
and diff checks passed; frontend lint reported zero errors and six existing
warnings. An independent read-only review reran the budget/SDK subset (23/23)
without a blocking finding. No provider submission or database write occurred.

## FLUX 3 Max keyframe continuity — 20 October 2026 source candidate

Live model-setting results now retain authored public field descriptions, so
Studio and MCP discovery can explain the required keyframe index format,
reference order and inclusive duration × 24 bound. The shared generation handler
preserves repeated images at distinct Max keyframe positions without counting
the mirrored direct-URL/attachment projection twice. Other reference modes keep
their existing deduplication. Studio distinguishes positions inside the generated
clip from project-timeline edits; no exact-cut guarantee is introduced.

Local verification includes the repeated-reference handler regression and 4,096
nonspending control combinations through canonical validation and Fal payload
construction. `mcp:client:check` passes (173 tests, one skip, zero failures) with
the deterministic selection evaluation. Existing global-instruction and tool-
description byte-budget tests pass; no MCP descriptor wording or global
instruction changed in this correction. These checks do not establish a live
host qualification, plugin release, deployment or media publication.

## Generation recovery correction — 19 October 2026

Preparation and confirmation now apply the submission asset-host allowlist to
HTTPS references before quoting or reserving credits. Confirmation rechecks old
prepared quotes; it never imports media or starts another generation implicitly.
Unsupported links return a fixed public REFERENCE_INVALID explanation and an
import_reference_files next action, without echoing the URL. Owned asset
references retain their existing exact-owner verification.

Direct-only Luma Modify/Reframe modes become unavailable when direct routing is
disabled or inaccessible; they cannot use the Fal fallback. Public model
readiness and the Web/trusted paid route context consume the same routing result.

Tool-call audit events retain only allowlisted public error codes, registered
model IDs and the video/image surface. Schema/unknown tool failures use a coarse
MCP_TOOL_ERROR fallback. Prompts, references, error messages, tokens and provider
bodies remain excluded. A successful status-tool call is still a technical
success even when the existing generation has failed; generation outcomes keep
their separate owner.

Agent status confirms wallet recredit for every persisted refunded_wallet
failure, and retains the fresh-quote/explicit-approval boundary. Known historical
submission failures, Web messages and receipt reasons share fixed EN/FR/ES copy.
Receipt projections do not rewrite ledger entries. Tool descriptors, schemas and
global instructions are unchanged, so this correction does not change their
byte budgets or establish a new installed-plugin or real-host qualification.

Créé le **21 septembre 2026**, revu le **22 septembre 2026**. Responsable : ingénierie MaxVideoAI.
Statut de distribution au **18 octobre 2026 UTC** : plugin **0.3.8 publié** et
registre officiel actif/latest, selon le
[point de contrôle de publication](../operations/mcp-distribution-publication-2026-10-18.md).
Cette livraison ne modifie aucune installation existante ni qualification d’hôte.
Les deux essais réels Codex du paquet 0.3.6 et leurs limites restent consignés au
[point de contrôle du 22 septembre](../operations/mcp-main-repository-release-v0.3.6.md). La validation de
chaque hôte reste distincte ; consulter le [parcours de mise à jour](../operations/mcp-client-updates.md).

## Eleven v4 Audio contract — 17 October 2026

The existing Audio preparation schema and live discovery include the reviewed Eleven v4 voices and exact model controls, shared with Studio and web Audio. The owner explicitly authorized production release on 17 October. The independent Audio publication gate is now enabled, with the first MCP catalog restricted to `voice_only` plus `eleven-v4`. The same projection controls discovery, preparation and confirmation. Existing conditional Audio guidance becomes visible without rewriting global instructions or tool descriptions; the 2,000-byte metadata budgets remain unchanged. Live results carry names/IDs/accents and read-only official sample links; the catalog is not copied into instructions. New preparations freeze default voice settings before exact-price approval; existing quote replay, ownership and one-attempt boundaries remain in force. The reviewed policy fingerprint now includes the three published Audio schemas; the existing curated conversation decisions remain unchanged. Measured production instructions: 1,551 UTF-8 bytes; 18 model-visible tool descriptions, maximum 1,767 bytes. The reviewed fingerprint is `edaf4dc36c6f35ccd6538b02ab985faa6f05af0c3323f62182433aa2eeae3990`; the 70 existing curated decisions and their fixture contract are unchanged. No plugin package release or real-host verification is inferred from deterministic checks. Deployment evidence is recorded separately.

## Returned video artifacts — 14 October 2026

Owned completed-video results add optional `playbackVideoUrl` for full-duration
browser playback and `lastFrameUrl` for the separately stored supplier JPEG. They
retain the original `videoUrl` and existing short preview/thumbnail roles. Result
app v6 uses the full playback URL while its primary download remains the original;
its independent frame download uses the app-only `get_generation_download`
`outputRole='last_frame'` option. Frame reuse opens that owned job's image results
in Media. Established v1-v5 resources remain readable with their existing documents.
Local executable-app and signed-descriptor tests cover these contracts; deployment,
plugin release and real-host qualification remain independent evidence.

## Customer price presentation — 5 October 2026

Image/video and Audio preparation results add an optional `price.formattedAmount`
from the same pure customer-price formatter used by Studio. Exact integer cents
and currency remain the authority; the display string performs no estimation,
conversion, repricing or authorization. Stored request hashes, pricing snapshots
and balances are unchanged. The addition is backward compatible and retained by
the complete structured result and compact JSON fallback.

Tool names, descriptors and capability gates are unchanged by this presentation
addition. Public Audio still requires its independent publication gate. A deployed
server result is distinct from a plugin package release or a verified host session;
do not claim new host qualification from deterministic client checks alone.

Canonical image/video pricing validation errors may identify a strictly
whitelisted public field such as `aspectRatio`. The existing `PARAMETER_INVALID`
code and error shape are retained; raw values, provider messages, private URLs
and unknown/internal field names remain undisclosed. This helps a host correct
its next proposal using live model details without defaulting controls or
weakening validation. Studio Audio preparation metadata distinguishes required,
optional and unsupported references; cinematic packs require an existing clip,
while image/prompt-to-video uses the video preparation tool.

## Studio integration review — 4 October 2026

The Studio branch adds independent timeline-editing and export gates. All **128
combinations of seven capability gates** must keep global instructions within
2,000 UTF-8 bytes and exact-quote, explicit-approval and one-attempt rules in the
first 1,000 bytes when generation is active. Each descriptor keeps its own
2,000-byte budget. Audio confirmation still requires paid generation. Preserve
Studio revision conflicts, account-owned media, export quote approval and
status recovery without another render. The older measurements below describe
their dated revisions, not the current seven-gate surface.

Recommendations and Studio share the same exact-ID editorial policy. Its dated
reference/alternative/on_request levels are editorial preferences, not measured
quality, execution certification or family-wide endorsement. A version without
its own current review inherits no ranking. Respect a compatible explicit choice;
compare live budgets before claiming a cheaper option. Mode support and reference
limits come from live details, including the expanded H3 Max and Wan contracts.

The host owns creative discussion, scripts, shot plans, prompts and reference
media. An idea or a single asset can complete a request. MaxVideoAI observes only
requests addressed to its tools and their responses, not every host message,
hidden reasoning or complete conversations. The
[learning strategy](../superpowers/specs/2026-10-03-studio-mcp-learning-strategy.md)
is proposed instrumentation, not enabled collection or measured quality evidence.

Run `pnpm mcp:client:check` and `pnpm model:registry:check`. The client gate must
include Studio timeline schema parity and export delivery as well as current
OAuth, transport, reference retry and generation-recovery checks. After reviewing
metadata or skill changes, recompute only `policyFingerprintSha256` with
`collectPolicyFingerprintInput` and `computePolicyFingerprintSha256` in
`frontend/scripts/qa/mcp-tool-selection-eval.ts`; preserve curated decisions unless
the policy intentionally changes. Never edit expected decisions merely to pass.

The [Studio audit](../operations/studio-mcp-release-audit-2026-10-03.md) and
[distribution checkpoint](../operations/studio-mcp-distribution-rollout-2026-10-04.md)
separate local verification from deployment, immutable plugin publication,
installation and real-host evidence. Preserve the brief and known job IDs through
reconnection; recover submitted jobs before another request. Neither reconnection
nor a refund authorizes a new paid attempt.

## Objectif et limite

### Compatible price comparisons — 2026-10-08

Studio and MCP now share the read-only generation comparison owner described in
[pricing-engine.md](pricing-engine.md). `compare_generation_prices` supplies up
to three compatible current prices for a simple image/video brief; a chosen model
still proceeds through details, exact preparation and explicit approval. Required
reference combinations and explicit settings remain strict. Baseline settings
support fresh savings for changed resolution/duration. Packaged plan/generate
guidance and quote copy invite financial comparisons with brief explanations.

Offline metadata evidence: the maximum over all 128 global capability combinations
is 1,930 UTF-8 bytes; the comparison descriptor is 1,082 bytes and preparation is
1,329 bytes. Recomputed `policyFingerprintSha256` using the documented collector;
the existing 70 curated decisions and fixture fingerprint are unchanged. New
comparison service/schema tests are included in `mcp:client:check`. These checks
do not establish deployment, installed-plugin release or real-host routing.

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

Le 5 octobre 2026, les détails de modes partagés par MCP et Studio ajoutent les
noms canoniques des contrôles de base dans `settings` : `durationSec`, `resolution`,
`aspectRatio`, `fps` et `audio` lorsque ce mode propose un interrupteur. `audio`
est un booléen ; les alias fournisseur comme `generate_audio` ou `generateAudio`
restent refusés. Les durées issues d'une source et le son toujours généré ne
deviennent pas des contrôles facultatifs. Les valeurs et limites viennent des
capacités actuelles ; les valeurs par défaut de cette projection restent nulles
pour conserver leur propriétaire dans les adaptateurs. Ce changement de résultat
ne modifie pas les instructions MCP ni leurs budgets d'octets. Les tests de
découverte et de préparation sont hors ligne ; aucune nouvelle sélection dans un
hôte réel ni génération payante n'est revendiquée.

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

La déconnexion ordinaire du site doit préserver les sessions OAuth indépendantes
des connecteurs. Suivre [la politique de portée des déconnexions](auth-signout-scope.md)
pour les appels Supabase et la vérification du renouvellement après expiration.

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

## Native Seedance Draft — 18 October 2026 source candidate

The additive `seedanceWorkflow` preparation field exposes the existing native
Draft/final business owners. Model details own live availability, constraints
and the useful direct 1080p versus Draft-then-final choice. The assistant offers
that choice before the selected quote, respects an explicit direct choice and
never calls ordinary 480p a finalizable Draft. Each paid step requires its own
exact quote and explicit approval. Status/history retain account-owned lineage;
full status reports eligibility, actual expiry and existing final recovery.
See [mode coverage](mcp-mode-coverage.md#native-seedance-draft-workflow--2026-10-18-source-candidate).

Tool descriptors retain prerequisites/recovery within their individual 2,000-byte
budgets; global instructions and capability gates are unchanged. New deterministic
schema/discovery tests join `mcp:client:check`; a disposable PostgreSQL test checks
separate tariffs, real native request payloads, owner/expiry rejection, concurrent
reservation and same-attempt recovery with substituted provider HTTP. No paid
provider call is authorized or performed. These fixtures do not prove real-host
selection or production activation.

Plugin source candidate 0.3.8 needs the immutable release builder/publication flow.
The observed public website pin remains 0.3.7. Server deployment, plugin release,
host catalog refresh and real-host verification are distinct. After authorized
server delivery, refresh the host by its supported flow and verify a fresh task's
`get_model_details` and `prepare_generation` schemas contain `seedanceWorkflow`.
Keep the brief and known Draft/final job IDs through reconnect; recover them first.
An old schema is not permission to emulate Draft with ordinary 480p. Test explicit
Draft, unchosen 1080p, explicit direct 1080p, ordinary 480p, unavailable workflow,
expired/foreign Draft and interrupted final in each named host/version before
claiming compatibility. Offer the returned web URL only when live web availability
is true. No production deployment, public release or host qualification is claimed
by this source candidate.


Local metadata measurements for this candidate: `get_model_details` 1,927 UTF-8
bytes, `prepare_generation` 1,639, `get_generation_status` 1,098 and
`list_recent_generations` 649. All 128 global gate combinations remain under
2,000 bytes. The policy fingerprint was refreshed through the documented
collector to `ace13aa36761736648b4b33f8cb750a22176078abf732e3b6a29bb594a1d725a`;
the 70 curated decisions and their fixture fingerprint were preserved.

## Creator tools — 19 October 2026 source candidate

Eight additive tools expose the same shared operations as the web workspaces:
`list_creator_tools`, `prepare_creator_tool`, `confirm_creator_tool`,
`get_creator_tool_operation`, `get_subtitle_document`, `edit_subtitle_document`,
`prepare_subtitle_export` and `export_subtitle_text`. The ninth,
`prepare_studio_subtitles`, additionally requires timeline editing access. It
quotes the saved sequence's actual audio mix independently of the Studio MP4
export gate. See [creator tools](creator-tools.md) for ownership and release gates.

Paid preparation and confirmation require paid generation, owned reference
access, `CREATOR_TOOLS_ENABLED=1` and `MCP_CREATOR_TOOLS_ENABLED=1`. Five
non-spending discovery/recovery/document tools remain registered whenever the
service exists, including after these execution gates close. An OAuth attempt
cannot be recovered through a different browser-session scope. Specialist video lip
sync and Kling Motion Control have separate execution gates. Discovery returns
current profile constraints and effective availability; a profile's presence is
not evidence of activation or measured quality. Marketing publication remains a
separate, closed projection until real qualification is recorded.

Each attempt requires its exact quote and explicit approval. Preparation pins
source fingerprints, selected segments, profile, audio policy and price. Status
is scoped to the account and OAuth client; documents belong to the account.
Interrupted or ambiguous requests must recover the existing operation before
another attempt is considered. Text/style edits and sidecar exports do not
retranscribe. Fresh signed presentation links do not replace stored originals.
A removed output or temporary signing failure keeps the operation's financial
completion state and reports unavailable artifact delivery.

The general instructions add only the discovery pointer and retain the shared
approval rule. All **256** instruction gate combinations stay within the
2,000-byte host budget (maximum **1,998 UTF-8 bytes**); each added descriptor is
also bounded at 2,000 bytes. In-memory SDK tests verify gated discovery, strict
confirmation, principal scope, complete compact JSON fallback, explicit segment
transport and independent Studio mix/export gates. They join `mcp:client:check`.

No paid provider canary or real-host compatibility is claimed by these local
checks. After authorized release, verify discovery and one quoted attempt in
each named host/version, including denied/expired quotes, disconnect recovery,
subtitle editing, and result presentation. Reconnect through the host's supported
flow when its catalog is stale; preserve operation/document IDs and recover them
first. Plugin publication and host refresh remain distinct from server delivery.

### 2026-10-19 — Creator Lip Sync settings and included subtitle exports

The existing creator settings schema accepts optional Lip Sync resolution, shared
with the web workspace: 480p by default, 720p or 1080p on selection. Wan 3 photo
and video profiles publish measured audio limits and their explicit output timing
policy through discovery. The separate LatentSync gate remains unchanged.
Creator quotes apply provider cost × 2.20; subtitle MP4 exports and sequence mix
preparation are included. Zero-price exports still require exact revision-bound
preparation and confirmation, but do not charge the wallet. These changes reuse
existing tools and approval instructions; no plugin release, production gate
activation or host compatibility is inferred from local validation.

### 2026-10-22 — Whole-source timeline assembly candidate

The existing timeline edit tool accepts omitted or null `startFrame` and
`durationFrames` for `assemble` clips. The canonical server appends visuals in
supplied order using measured whole source frames; audio begins at zero. Explicit
excerpt frames and single-clip insert requirements retain their existing meaning.
The strict Studio director schema requires both nullable properties; HTTP/MCP
may omit them. Schema parity and the client-experience gate cover both forms.
No tool/descriptor or permanent MCP instruction is added. This local candidate
does not establish deployment, plugin publication or refreshed host discovery.
The local client gate passes 173 tests (one real-host case skipped) and 70
curated selection fixtures; all 256 instruction combinations retain their
1,998-byte maximum. Real-host discovery measurements remain unrecorded.
