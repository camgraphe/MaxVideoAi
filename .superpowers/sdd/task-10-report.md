# Task 10 report: MCP support, legal, and distribution readiness

## Status

DONE for the factual support runbook, disclosure inventory, owner-review legal patch plan, source-backed distribution
packages, and deterministic readiness contract. The MCP is still **not ready for public promotion, submission, or
distribution**: every checked-in publication flag remains false, prerequisite migrations and operational evidence are
missing, no host-selection evidence bundle exists, and no external listing was attempted.

No binding legal page, public status component, or changelog entry changed. Task 10 made no deployment, database,
directory, account, feature-flag, or other external-state mutation.

## Deliverables

- `docs/operations/mcp-support-runbook.md` is the factual owner for current support intake, live versus reserved error
  vocabulary, future-gated decision trees, minimized operational data, disclosures, escalations, status/changelog
  evidence boundaries, and the Legal-owner patch plan.
- `docs/marketing/mcp-directory-submissions.md` keeps five distribution paths separate: direct Codex configuration,
  an OpenAI MCP-backed plugin, direct Claude custom connector configuration, Anthropic Connectors Directory, and the
  official neutral MCP Registry.
- `tests/mcp-legal-support-readiness.test.ts` locks the fail-closed publication state, support coverage, three-locale
  legal-review plan, private-data exclusions, no premature status/changelog claims, exact listing fields, official
  source domains, evidence dates, host-compatibility boundaries, and current infrastructure blockers.

## Current product truth preserved

- The public registry contains only `get_account_status`, `list_models`, and `recommend_models`.
- All eight publication gates remain false: `publicMarketing`, `publicIndexing`, `transport`, `oauth`, `discovery`,
  `paidGeneration`, `trial`, and `referenceUploads`.
- Migrations 30–32 remain absent. Migration 33 remains unapplied and cannot run before those prerequisites exist.
- Task 8 exposes only coarse audit evidence; funnel, receipt, provider-cost, polling, upload, and restoration producers
  are not available.
- Task 9 has no real Codex, Claude, or other-host selection decision bundle.
- The default Codex authorization path's extra `phone` scope remains a blocker. The explicit
  `openid,email,profile` controlled path is not generalized into a public-default claim.
- Claude Desktop token-expiry refresh remains pending.

## Support and disclosure readiness

The runbook contains explicit decision trees for:

1. OAuth connection, consent, denial, revocation, and reconnect;
2. email verification;
3. quote expiry;
4. insufficient funds;
5. spending limits;
6. upload handoff and reference validation;
7. provider rejection or terminal job failure;
8. wallet refund reconciliation;
9. trial restoration;
10. a revoked connection.

The runbook now separates handler/protocol envelopes (`-32001`, `-32600`, `-32700`, `-32601`, and `-32603`), SDK
tool-argument validation returned as `isError: true`, and application/tool failures. The handler-owned envelopes and
representative SDK paths are executed in the readiness test. Unexpected live-tool operations may return
`INTERNAL_ERROR`; generation application codes such as `QUOTE_EXPIRED`, `INSUFFICIENT_FUNDS`,
`SPENDING_LIMIT_EXCEEDED`, `REFERENCE_INVALID`, `PROVIDER_REJECTED`, and `JOB_FAILED` remain explicitly reserved and
future-gated. The runbook does not claim an exhaustive private SDK error catalogue.

The disclosure inventory separates normal service processing of prompts, inputs, outputs, and uploads from minimized
MCP audit/funnel ledgers. Support intake forbids requesting or copying access/refresh tokens, credentials, full payment
details, private reference URLs, provider bodies, or complete prompts. It records permissions, stored data categories,
media/reference retention decisions, trial-abuse controls, spending confirmation, provider processing, incident
handling, and escalation owners without claiming that unavailable ledgers or flows are live.

## Legal, status, and changelog boundary

There is no repository evidence of document-owner approval for a new binding privacy, terms, or acceptable-use
promise. The runbook therefore prepares Privacy and Terms owner matrices for English, French, and Spanish, plus the AUP
owner. It identifies connected-agent authority and responsibility, agent actions, quote versus confirmation, wallet
spending, revocation effects, third-party host terms, controller/processor roles, purposes and lawful bases,
category-specific retention/deletion, provider/subprocessor flows, trial-risk signals, support/incident data, and
directory terms as owner decisions. Legal may instead approve current-language sufficiency, but must record that
rationale.

No legal application file changed. No MCP status component was added because there is no live MCP-specific health
source, monitored component mapping, incident owner, or update cadence. No changelog entry was added because there is
no public capability or permission change to announce.

## Distribution findings

### OpenAI and Codex

Official documentation checked on 2026-07-14 supports a direct Streamable HTTP/OAuth configuration path for documented
Codex clients. That path is not a directory listing and does not establish automatic tool selection or “available in
the Codex library.”

OpenAI currently packages MCP-backed public apps as plugins. Its App Guidelines also currently restrict app commerce
to physical goods and prohibit directly or indirectly selling digital products/services, including digital content,
tokens, or credits. The package records a **DO NOT SUBMIT** blocker: MaxVideoAI infers that wallet-funded media
generation and top-ups materially connect the intended plugin to those categories. This is a qualified MaxVideoAI
eligibility inference, not a written OpenAI eligibility decision. Submission requires written OpenAI clarification for
the exact scope or a policy change followed by re-review. Direct Codex MCP configuration remains a separate path, and a
future ChatGPT plugin approval would not prove Codex host behavior.

### Anthropic and Claude

Official documentation checked on 2026-07-14 supports direct remote custom connectors for Claude users/workspaces.
That route remains separate from directory eligibility and still requires a public endpoint, OAuth, refresh,
revocation, and exact-client evidence.

The current official Anthropic Software Directory Policy says software using AI models to generate images, video, or
audio is not accepted except for limited design-focused visual aids. MaxVideoAI's intended core media-generation
workflow therefore has a current **DO NOT SUBMIT** decision for the Anthropic Connectors Directory. This policy blocker
does not prohibit documenting a direct custom-connector path after the product gates pass.

### Official MCP Registry

The official registry is a preview metadata repository for downstream aggregators, not a curated endorsement or a
guaranteed route into Codex, Claude, or ChatGPT. Publication requires public remote-server metadata and namespace/domain
authentication. Its current terms dedicate submitted metadata to CC0/public use, and its FAQ says unpublish/delete is
not currently available. Legal, Growth, and an authorized owner must explicitly accept those implications before any
publication.

## TDD evidence

The readiness contract was created before either readiness document.

### Initial RED

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-legal-support-readiness.test.ts
```

After correcting a test syntax error, the real contract run executed 10 tests and failed 10/10 because both required
documents were absent.

### Listing-completeness RED

After the first implementation, six assertions exposed newline-sensitive test patterns rather than missing facts.
Those patterns were made whitespace-tolerant without weakening their semantics. Terms and acceptable-use URLs were
then added to the contract before the listing payload; the run remained red until both three-locale fields existed.

### GREEN

The initial focused readiness contract passed 10/10. It verifies all required decision trees and disclosures, the eight
false gates, three locales, exact current tools, negative cases, legal-owner boundaries, no false status/changelog or
approval claim, private-data exclusions, official OpenAI/Anthropic domains, neutral registry evidence, and current host
and migration blockers.

### Review-remediation RED/GREEN

The review contract was strengthened before documentation changes. The first run executed 13 tests: 9 passed and 4
failed on the incomplete error vocabulary, omitted localized Terms owners/agent authority decisions, missing OpenAI
commerce blocker, and unsupported registry moderation-retention statement. The handler assertions in that RED run
already executed successfully and established the real safe envelopes before the prose changed.

The corrected 13/13 contract now:

- executes malformed JSON, unsupported HTTP, authentication exception, unknown JSON-RPC method, and invalid live-tool
  argument paths through `handleMcpHttpRequest`;
- lists the real MCP server through a linked in-memory SDK client and compares the runbook/package tool rows to that
  observed registry rather than a duplicated expected array;
- derives EN/FR/ES listing URLs from the application's localized route owner and compares exact package rows;
- locks separate OpenAI commerce and Anthropic media-generation **DO NOT SUBMIT** states while preserving direct Codex
  and Claude connector paths;
- requires Privacy and Terms owner files and the connected-agent legal decision set; and
- replaces the unsourced registry moderation-retention shorthand with the official moderation-policy URL and its exact
  distinction between publisher unpublish, registry removal status, and metadata accessibility.

## Verification

1. Focused legal, support, claims, discovery, status, marketing, and SEO regression:

   ```bash
   ./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
     tests/mcp-legal-support-readiness.test.ts \
     tests/legal-documents-architecture.test.ts \
     tests/customer-facing-legal-contact.test.ts \
     tests/public-product-claims.test.ts \
     tests/status-page-trust.test.ts \
     tests/mcp-config.test.ts \
     tests/mcp-publication.test.ts \
     tests/mcp-docs-content.test.ts \
     tests/mcp-oauth-discovery.test.ts \
     tests/mcp-transport-contract.test.ts \
     tests/mcp-seo-signals.test.ts \
     tests/mcp-seo-review-remediation.test.ts \
     tests/mcp-marketing-copy.test.ts \
     tests/mcp-marketing-route-architecture.test.ts
   ```

   Result after review remediation: exit 0; 103 passed, 0 failed.

2. Complete MCP regression:

   ```bash
   ./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-*.test.ts
   ```

   Result after review remediation: exit 0; 215 passed, 0 failed.

3. Static, localization, SEO, and exposure validation:

   ```bash
   pnpm --prefix frontend exec tsc --noEmit --pretty false
   npm --prefix frontend run lint
   npm --prefix frontend run i18n:check
   npm --prefix frontend run seo:check
   npm run lint:exposure
   git diff --check
   ```

   Result: every command exited 0. French and Spanish key parity, canonical/LLM/internal-link/media guards, and public
   exposure checks passed.

4. Architecture audit:

   ```bash
   npm run architecture:audit -- --min-lines 500
   ```

   Result: exit 0. No Task 10 application owner was added or expanded; the audit reported only pre-existing large
   source files.

5. Production build:

   ```bash
   npm --prefix frontend run build
   ```

   Result: exit 0 after model registry/catalog checks, Next.js compilation and type validation, 729 static pages, and
   sitemap generation.

## External and owner blockers

1. Legal must approve any MCP-specific privacy/terms/AUP changes in all three locales and separately accept each
   directory's current terms.
2. Security and Auth must close the default Codex scope issue and record refresh, denial, revocation, reconnect, and
   incident-handling evidence against the exact public deployment.
3. Engineering must supply production transport/OAuth/discovery, migration prerequisites, monitoring, and the intended
   generation/trial/reference capabilities before claims or submissions can expand beyond the read-only foundation.
4. QA must produce sanitized real-host decision bundles and owned end-to-end proof media. Current provider examples or
   synthetic assets are not substitutes.
5. An authorized owner must verify domain/organization identity and perform any future portal or registry action.
6. Anthropic Connectors Directory submission remains prohibited by the current media-generation policy unless the
   policy or MaxVideoAI's eligible submitted scope materially changes and is re-reviewed.
7. OpenAI plugin submission remains blocked by the current digital commerce rule unless written OpenAI clarification
   covers the exact MaxVideoAI scope or the policy changes and the package is re-reviewed.

## External-state audit

- No public page, legal page, status page, changelog page, publication flag, environment variable, migration, or
  database changed.
- No account or directory record was created; nothing was submitted, listed, messaged, deployed, or published.
- No GSC, analytics, payment, provider, OpenAI, Anthropic, Claude, Codex, registry, or production API mutation occurred.
- No push, pull request, merge, or branch integration occurred.
