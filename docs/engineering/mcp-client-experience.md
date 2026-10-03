# MCP client experience and release checks

Reviewed: **2026-10-03**. Scope: this Studio branch. Local verification is separate
from server deployment, plugin publication, installation and real-host evidence.
See the [dated audit](../operations/studio-mcp-release-audit-2026-10-03.md).

## Instruction ownership

`frontend/src/server/mcp/instructions.ts` is the discovery entrypoint. Keep every
combination of its seven capability gates within **2,000 UTF-8 bytes**, with the
exact-quote, explicit-approval and one-attempt boundary in the first 1,000 bytes
when generation is active. This is a conservative repository budget, not a
universal MCP protocol limit or a guarantee about a client's context window.

Each tool descriptor owns its prerequisites, effects, next action and recovery
rules, also within 2,000 UTF-8 bytes. Moving a rule must move its runtime metadata
assertion; shortening text is not permission to drop a business constraint.
Structured schemas/results own executable constraints, current facts and exact
prices. Only advertise tools behind open gates. Audio requires its generation
gate; Studio edit/export gates remain independent, as in the server.

The plugin's `plan` and `generate` skills remain small, distinct entrypoints.
Preserve implicit invocation and the MCP dependency, without claiming that a host
will select them. A missing initial tool list or empty resource list does not
prove tools are absent: inspect deferred tools and connection state. Reconnect
through the host's supported flow, preserve the brief and recover an already
submitted job. Reconnection and refunds never approve another paid attempt.

## Model and conversation truth

Model identities and publication belong to the [model registry](model-registry.md).
Recommendations and Studio use the same exact-ID editorial policy. Its dated
reference/alternative/on_request levels are editorial preferences, not measured
quality, execution certification or family-wide endorsement. A version without
its own current review inherits no ranking. Respect a compatible explicit choice;
compare current budgets before claiming a cheaper option. Mode support and
reference limits come from live details; do not copy sibling-model settings.

The host owns creative discussion and prompts. An idea or one asset can complete a
request. MaxVideoAI observes requests addressed to its tools and their responses,
not every host message, hidden reasoning or complete conversations. The
[learning strategy](../superpowers/specs/2026-10-03-studio-mcp-learning-strategy.md)
is proposed instrumentation, not enabled collection or measured quality evidence.

## Reproduce the offline gate

From the repository root:

```bash
pnpm mcp:client:check
pnpm model:registry:check
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

The client check inspects actual `initialize` and `tools/list` metadata over an
in-memory MCP connection across **128 gate combinations**, descriptor limits,
quote/approval/recovery rules, transport and plugin contracts, Studio timeline
schema/export delivery and the 70 curated offline scenarios. It does not contact a
paid model or prove client selection. Tests fail on stale policy fingerprints.

After reviewing a metadata/skill change, recompute only `policyFingerprintSha256`
using `collectPolicyFingerprintInput` and `computePolicyFingerprintSha256` in
`frontend/scripts/qa/mcp-tool-selection-eval.ts`. Preserve reviewed decisions and
fixture contracts unless the actual policy intentionally changes; never edit
expected decisions just to make an evaluation pass. Run the affected business
suites as well when schemas, services, persistence or authorization change.

## Update and publish separately

1. Identify the changed owner: server metadata, plugin instructions, authored
   catalog, public prose, integration evidence or an external store. Follow the
   relevant registry/engineering guide; generated catalogs are never hand-edited.
2. Run the offline gate, relevant business checks, and locale/SEO checks. Inspect
   the immutable plugin archive made by the existing release builder when shipping
   plugin changes. Maintenance `AGENTS.md` files stay out of the archive.
3. Record a new immutable plugin version only for an authorized release. Source
   edits do not update installed caches. Do not overwrite released tags or edit
   the installed cache. Server deployment and plugin publication are independent.
4. After separately authorized deployment/publication, inspect actual served
   metadata, refresh/reconnect through each host's supported mechanism, and use a
   fresh chat. Record exact source revision, plugin/host versions and environment.
5. Update only the host actually exercised in the
   [compatibility matrix](../operations/mcp-host-compatibility-matrix.md) and
   [integration registry](mcp-integration-registry.md). Installation availability,
   store state, OAuth success and end-to-end generation are different claims.

For each claimed host, test explicit/implicit generation intent, planning,
compatible named-model preference, negative text-only requests, reconnect and
interrupted-job recovery with competing tools installed. Retain sanitized prompt,
first tool, outcome and limitations. Discovery checks need no paid generation;
paid checks require a concrete exact quote and explicit approval. Never count
curated decisions as observed host precision/recall.
