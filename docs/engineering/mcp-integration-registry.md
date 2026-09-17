# MCP integration registry

## Purpose and source-of-truth boundary

`frontend/config/mcp-integrations.json` is the authored source for MCP integration identity, display order, English route, publication state, acquisition eligibility, installation availability, external-store state, host membership, and the current public evidence projection. `frontend/lib/mcp-integration-registry.ts` validates that document and exposes browser-safe accessors.

The registry does not own model lists, prices, OAuth scopes, billing behavior, tool schemas, screenshots, or editorial copy. Model identity stays in the model registry, protocol behavior stays with the MCP implementation, detailed evidence stays in the operations matrix, and localized prose stays in the integration content modules.

## Fields and independent state dimensions

Each integration has a stable key, label, category, display order, English path, host list, and four independent state dimensions:

- `site.publication` controls whether the marketing concept is `live`, `preview_noindex`, or `hidden`; `site.indexable` is permitted only for `live` entries.
- `acquisition.enabled` explicitly allows the key through the signed MCP landing attribution boundary. The acquisition key must equal the registry key.
- `installation` records direct-MCP, package, and verified deep-link availability. A deep link is usable only when enabled and set to an absolute HTTPS URL.
- `store` records a directory target and its factual submission state. External store state cannot disable the direct MCP endpoint.

Host records separately identify their integration, display label, evidence status, checkpoint date, and evidence source. These dimensions must not be collapsed into a single “available” flag: a direct MCP connection can work while a store submission is blocked or absent.

## Existing-public-surface non-regression floor

The current floor contains `/mcp`, `/docs/mcp`, and the Claude, ChatGPT, and Codex integration pages in English, French, and Spanish: fifteen localized public owners in total. Their canonical URLs, reciprocal hreflang, JSON-LD, sitemap inclusion, public-path recognition, installation actions, and localized copy must remain intact while the global publication gate is open.

Claude Desktop and Codex CLI currently retain `verified`; Claude Code and ChatGPT web retain `not-run`. All three current deep links remain disabled. Existing `verified` evidence cannot be weakened without a newer recorded checkpoint.

The immutable semantic fixture is `tests/fixtures/mcp-integration-public-baseline.json`. Update it only for a separately reviewed public behavior change, never as a shortcut to make a migration pass.

## Add a hidden host for evidence work

1. Add an integration record with `site.publication: "hidden"`, `site.indexable: false`, and `acquisition.enabled: false`, or reuse an existing integration that owns the host.
2. Add the host record under `hosts` with `status: "not-run"`, a current checkpoint date, and `source: "docs/operations/mcp-host-compatibility-matrix.md"`.
3. Reference that host exactly once from its owning integration. The parser rejects missing, cross-owned, duplicate, and orphan hosts.
4. Record the intended test protocol in `docs/operations/mcp-host-compatibility-matrix.md` before changing the evidence status.

A hidden evidence record does not create a route, hub action, sitemap entry, localized copy requirement, or acquisition permission.

## Enable acquisition explicitly

Acquisition remains deny-by-default. Set `acquisition.enabled` to `true` only after the integration has an approved public landing flow and the signed attribution contract has been reviewed. The registry key and acquisition key must match. Run the acquisition attribution suite and confirm unknown strings, objects, and arrays still fail closed.

Publication and acquisition are separate decisions. Making an entry visible or indexable must never silently authorize it as an attribution client.

## Publication behavior

- `live` with `indexable: true` joins the public integration path projection, source-path recognition, route discovery, analytics landing allowlist, and sitemap.
- `live` with `indexable: false` can be rendered when its explicit route exists but does not join the indexable path projection.
- `preview_noindex` is visible only through an explicitly implemented preview route and is excluded from public sitemap paths.
- `hidden` is excluded from public hub and path projections. It is suitable for evidence preparation before marketing work is complete.

Adding a registry entry alone never authors a Next.js route or localized content. Keep explicit route owners and do not create a generic catch-all integration page.

## Evidence update procedure

`docs/operations/mcp-host-compatibility-matrix.md` owns detailed tested-host evidence: exact host version, environment, actions exercised, limits, failures, and evidence references. After completing a newer checkpoint:

1. update the matrix with the observed facts and explicit non-claims;
2. update the matching registry host’s status and `lastChecked` date;
3. retain `verified` unless the newer checkpoint supplies evidence for a different status;
4. run registry, host-proof, copy, route, and baseline contracts;
5. review rendered wording so it does not imply validation for an untested sibling host.

## Published tested-with-limits scopes

OpenClaw is `live`, indexable, and acquisition-enabled for direct MCP and the
listed ClawHub package. Its host evidence remains `tested_with_limits` because
private-reference import, channel attachments, and inline channel rendering
have not been verified.

n8n is `live`, indexable, and acquisition-enabled only for the tested
self-hosted deterministic MCP Client workflow. The MCP Client host remains
`tested_with_limits`; MCP Client Tool remains `not-run`, n8n Cloud is not
claimed. The template-library store state is `submitted` only for private
Creator Portal workflow `19591`, which is now `Pending` / `Implement changes`
after the 2026-09-17 reviewer request for explanatory Sticky Notes. A locally
revised, credential-free JSON exists but has not been uploaded or resubmitted.
The other two reviewed JSON workflows remain unsubmitted; the portal has
re-enabled the next-template action. No public listing or verification is claimed.

## Later-host promotion sequence

Cursor remains `hidden` with a `tested_with_limits` desktop checkpoint. GitHub
Copilot IDE, GitHub Copilot CLI, GitHub Copilot cloud agent, Gemini CLI,
Microsoft Copilot Studio, and Microsoft Agent 365 remain `hidden` and
`not-run`. Promote one host record at a time, only after the common
controlled-host protocol in the operations matrix has been completed and its
sanitized evidence has been reviewed. A pass on one surface must never change a
sibling host automatically.

Apply the following host-specific gates in addition to the common protocol:

- Cursor: test manual remote configuration and any proposed install action as
  separate paths; do not publish an Add to Cursor action before its exact URL
  and OAuth lifecycle are proven.
- GitHub Copilot IDE and GitHub Copilot CLI: record the precise editor or CLI
  version independently. GitHub Copilot cloud agent stays separate because
  remote OAuth is not supported on that surface for the MaxVideoAI connection.
- Gemini CLI: verify discovery, callback handling, and RFC 9207 issuer (`iss`)
  validation against the production authorization server.
- Microsoft Copilot Studio: validate Streamable HTTP, tenant policy, connector
  setup, approval, and recovery in an owned test tenant.
- Microsoft Agent 365: keep registration, admin-governance, observability, and
  reuse separate from a Copilot Studio host pass.
- Microsoft certification: keep Partner Center eligibility, package review,
  certification, and distribution independent from both host checkpoints.

After host evidence passes, move only that host from `not-run`; publication,
indexation, acquisition, deep-link availability, and store state still require
their own reviews. Complete EN/FR/ES content and route validation before moving
an owning integration from `hidden` to `preview_noindex` or `live`.

## Store update procedure

`docs/marketing/mcp-directory-submissions.md` owns submission evidence, account ownership, review status, listing URL, and operational follow-up. Change a registry `store.status` only after recording the corresponding event there. Store eligibility, preparation, submission, and listing do not prove host execution or direct-MCP health.

External submissions require an authorized owner and are never performed as a side effect of a registry edit. A rejection, delisting, or policy block changes only the store dimension; it must not disable the production MCP endpoint.

## EN/FR/ES content requirement

Every integration promoted beyond hidden evidence work requires complete English, French, and Spanish content before publication. Add the locale builders under the route-local `_content` directory, preserve localized support and MCP destinations, and provide non-empty metadata, hero, compatibility, setup, OAuth, workflow, references, troubleshooting, disconnect, and support fields. Routes consume only the `getIntegrationCopy` facade.

## Verification

Focused registry and non-regression checks:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-integration-registry.test.ts \
  tests/mcp-integration-public-baseline.test.ts \
  tests/mcp-marketing-route-architecture.test.ts \
  tests/mcp-acquisition-attribution.test.ts \
  tests/mcp-publication.test.ts \
  tests/mcp-seo-signals.test.ts
```

Before merging a public integration change, run the full MCP marketing suite, frontend lint, exposure lint, `git diff --check`, a production build, and an HTTP smoke test of every affected EN/FR/ES owner. Verify HTTP 200, canonical, robots, reciprocal alternates, one main landmark, installation actions, and evidence labels.

## Rollback

Rollback the integration-specific registry, route, content, sitemap, and acquisition changes together. Preserve `frontend/config/mcp-publication.json`, the production transport, OAuth configuration, tools, billing boundary, and the global `/mcp` endpoint. A marketing or store rollback must leave the global MCP endpoint untouched.

If a new integration must be withdrawn while evidence is investigated, set only that entry to `hidden`, `indexable: false`, and acquisition disabled; do not downgrade Claude, ChatGPT, Codex, or the global publication flags.
