# MaxVideoAI MCP Acquisition, SEO/GEO, and Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the working universal MCP into a measurable acquisition channel with authoritative landing/integration/docs pages, real workflow evidence, accurate public claims, SEO/GEO discoverability, operational dashboards, support materials, and distribution gates.

**Architecture:** Four pages own four distinct intents: product/install at `/mcp`, Codex setup at `/integrations/codex`, Claude setup at `/integrations/claude`, and protocol/security reference at `/docs/mcp`. Server-side MCP events are the authoritative conversion ledger; GA4 and GSC measure public acquisition. Public pages use the existing localized marketing architecture and only expose claims verified by live feature flags and compatibility evidence.

**Tech Stack:** Next.js 15 Server Components, next-intl, Markdown docs, existing SEO metadata/JSON-LD/sitemap helpers, GA4 Measurement Protocol, GSC admin data, Neon MCP audit events, Playwright, Node test runner.

## Global Constraints

- Do not publish or index acquisition pages until OAuth, paid generation, trial, and reference workflows meet their respective completion gates.
- English is the primary research and evidence language. FR/ES pages may be indexed only when fully translated and technically equivalent; fallback English pages remain noindex under the existing localized-fallback contract.
- No page may claim REST API keys, SDKs, customer webhooks, teams, shared wallets, invoices, one-click install, directory approval, model support, or trial availability unless that capability is live and verified.
- Use real MaxVideoAI screenshots/videos, exact settings, result dates, and prices. Do not use synthetic testimonials, ratings, install counts, or fabricated benchmarks.
- Keep `api.maxvideoai.com/mcp`, OAuth consent, uploads, account, and MCP resources out of all sitemaps and indexation.
- Prompts and private reference URLs never enter analytics, GA4, GSC annotations, screenshots without consent, or admin exports.
- Avoid programmatic pages for query variants. Add new intent owners only from measured GSC/referral/conversion evidence.

---

## Task 1: Freeze a public claims matrix and remove credibility contradictions

**Files:**

- Create: `docs/marketing/mcp-public-claims-matrix.md`
- Modify: `frontend/content/feature-flags.ts`
- Modify: `content/docs/get-started.mdx`
- Modify: `content/fr/docs/get-started.mdx`
- Modify: `content/es/docs/get-started.mdx`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Create: `tests/public-product-claims.test.ts`

- [ ] Write a failing content contract that searches indexable docs/messages for unsupported assertions around public API credentials, webhook callbacks, SDK examples, shared wallets, team roles, invoice/wire funding, white-label docs, and live integrations.

- [ ] Create a claims matrix with columns: claim, source of truth, live flag, evidence URL/test, allowed wording, prohibited wording, and owner. Populate every MCP, OAuth, trial, model, pricing, reference, privacy, and client-compatibility claim.

- [ ] Set `FEATURES.docs.apiPublicRefs` to `false` until a real public REST API exists. MCP is a protocol integration, not proof of general REST/webhook availability.

- [ ] Rewrite `get-started.mdx` in EN/FR/ES to describe the product that exists: individual account, wallet top-up methods actually exposed, price-before-generation, jobs/library, refunds, and MCP only when enabled. Remove requests for nonexistent credentials.

- [ ] Correct docs index titles/descriptions/sections currently advertising API webhooks. Keep upcoming team features clearly labelled non-live or remove them from indexable acquisition copy.

- [ ] Run i18n, content, SEO, and claims tests; commit this credibility cleanup independently:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/public-product-claims.test.ts
npm --prefix frontend run i18n:check
npm --prefix frontend run seo:check
git diff --check
```

## Task 2: Create verified end-to-end demonstration assets

**Files:**

- Create: `frontend/public/mcp/mcp-brief.webp`
- Create: `frontend/public/mcp/mcp-reference.webp`
- Create: `frontend/public/mcp/mcp-quote.webp`
- Create: `frontend/public/mcp/mcp-result-poster.webp`
- Create: `frontend/public/mcp/mcp-result.mp4`
- Create: `docs/marketing/mcp-demo-evidence.md`
- Create: `tests/mcp-demo-assets.test.ts`

- [ ] Run the controlled MCP flow in a non-production/approved account: creative brief → host-authored prompt → generated reference image → stable asset ID → model recommendation → exact quote → explicit confirmation → completed video.

- [ ] Capture only consented, sanitized screens. Remove account identifiers, tokens, internal URLs, fraud signals, and unrelated conversation text.

- [ ] Record in the evidence file: host and version, MCP server version, public model IDs, prompt approved for publication, reference asset provenance, settings, quote price/currency, job result, test date, and links to internal audit IDs.

- [ ] Optimize images and produce a short muted MP4 plus poster. Validate dimensions, byte budgets, stable paths, and absence of EXIF/private metadata in `tests/mcp-demo-assets.test.ts`.

- [ ] Do not substitute mockups for the result. If the verified flow changes, regenerate evidence before updating claims. Commit assets and evidence together.

## Task 3: Add dedicated localized route architecture for MCP and integrations

**Files:**

- Modify: `frontend/config/localized-slugs.json`
- Create: `frontend/app/(localized)/[locale]/(marketing)/mcp/page.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-jsonld.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/mcp/_components/`
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/codex/page.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/claude/page.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/_components/`
- Create: `tests/mcp-marketing-route-architecture.test.ts`

- [ ] Add slug mappings for `mcp` and `integrations`; keep `mcp`, `codex`, and `claude` brand/protocol terms unchanged while localizing the `integrations` segment only if the resulting URL is stable and maintainable.

- [ ] Write failing architecture tests requiring server-rendered page orchestrators, route-local copy/data/schema builders, named sections, metadata via `buildSeoMetadata`, canonical/hreflang, and no client-only hero/content shell.

- [ ] Keep page files below 250 lines and compose sections:

```text
MCP: promise, supported hosts, real demo, trial, model choice, quote/confirm,
     references, tools, permissions/privacy, spending/revocation, setup, FAQ/support
Integration: host-specific connection, OAuth flow, example workflow,
             file/reference behavior, troubleshooting, disconnect
```

- [ ] Write complete EN/FR/ES copy in dedicated typed modules. Do not index a locale until native copy, screenshots/captions, setup steps, and metadata pass editorial review.

- [ ] Use `SoftwareApplication`/`WebApplication` JSON-LD only for visible live facts, without `AggregateRating`, fabricated `Offer`, or unsupported operating systems. Add `BreadcrumbList`; do not depend on FAQ/HowTo rich results.

- [ ] Add visible “Last verified” dates sourced from the compatibility evidence, not hard-coded marketing claims.

- [ ] Run route architecture, locale, metadata, schema, and no-JS render tests; commit.

## Task 4: Publish the technical MCP documentation

**Files:**

- Create: `content/docs/mcp.mdx`
- Create: `content/fr/docs/mcp.mdx`
- Create: `content/es/docs/mcp.mdx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-index-data.ts`
- Modify: relevant docs index copy in `frontend/messages/*.json`
- Create: `tests/mcp-docs-content.test.ts`

- [ ] Write failing content tests for exact endpoint, OAuth requirement, supported clients, tool list, tool annotations, quote/confirmation, trial preset, references, status polling, spending limits, revocation, privacy, errors, troubleshooting, and non-goals.

- [ ] Document the universal fallback as a copyable endpoint:

```text
https://api.maxvideoai.com/mcp
```

- [ ] Publish client-specific steps only from the verified compatibility matrix. Do not say “one click” unless an actual deep link has been tested in the named client/version.

- [ ] Add a complete tool table with “Use this when”, side effects, confirmation behavior, required auth, and negative cases. Include stable error codes and recovery actions without provider internals.

- [ ] Describe prompt creation correctly: Codex/Claude clarifies and writes the prompt; MaxVideoAI supplies catalog facts, exact pricing, execution, media persistence, and result recovery. Explain that a host may create a reference with its own image tool or MaxVideoAI image models, then pass a MaxVideoAI asset ID.

- [ ] Keep the docs `TechArticle` schema aligned with visible dates/authorship and complete translations. Run docs content/SEO tests and commit.

## Task 5: Add conversion-safe connect CTAs and attribution

**Files:**

- Create: `frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpConnectActions.client.tsx`
- Create: `frontend/lib/mcp-acquisition.ts`
- Create: `frontend/app/api/mcp/acquisition/route.ts`
- Modify: `frontend/src/server/mcp/oauth-adapter.ts`
- Create: `tests/mcp-acquisition-attribution.test.ts`

- [ ] Write failing tests for allowlisted source/medium/campaign/client values, signed acquisition IDs, expiry, cookie privacy, direct endpoint connections, and event redaction.

- [ ] On a connect/copy action, create a short-lived signed acquisition ID and a first-party `SameSite=Lax` cookie containing only coarse campaign fields. Never place user ID, prompt, email, or access token in it.

- [ ] Carry the acquisition ID through the OAuth consent flow when the browser cookie is present and bind it to `mcp_connection_completed`. Connections initiated directly from a host remain `source: 'direct_mcp'`.

- [ ] Track landing CTA clicks in consented client analytics and the server-side connection event in the MCP audit ledger. Do not count endpoint copies as successful connections.

- [ ] Render verified deep links only behind client-specific flags; always provide endpoint-copy instructions as fallback. Commit.

## Task 6: Integrate sitemap, robots, `llms.txt`, and internal links

**Files:**

- Modify: `frontend/next-sitemap.config.js`
- Modify: `frontend/public/robots.txt`
- Modify: `frontend/public/llms.txt`
- Modify: selected relevant marketing/docs/footer components
- Create: `tests/mcp-seo-signals.test.ts`
- Modify: `tests/schema-sitemap-architecture.test.ts`

- [ ] Write failing tests requiring public locale URLs in sitemaps only when their copy is complete, self-canonical/hreflang signals, and explicit exclusion of API/consent/upload/account URLs.

- [ ] Add `/mcp`, `/integrations/codex`, `/integrations/claude`, and `/docs/mcp` to `MARKETING_CORE_PATHS`/content collection with appropriate priority. Do not add `api.maxvideoai.com/mcp`.

- [ ] Add the four authoritative pages to `llms.txt` only after the public-promotion feature flag is enabled. State their distinct intent and keep the technical endpoint out of source-page lists.

- [ ] Keep named AI search/answer crawlers allowed on public MCP/docs routes while `/api`, `/oauth`, `/account`, and upload paths remain blocked/noindex.

- [ ] Add contextual links from pay-as-you-go, models, relevant examples, docs, and footer surfaces. Use natural labels and avoid repeating exact-match “MCP AI video generator” sitewide.

- [ ] Run `seo:check`, sitemap/schema tests, a generated sitemap inspection, and canonical host QA; commit.

## Task 7: Build the authoritative MCP funnel ledger

**Files:**

- Modify: `frontend/src/server/agent-api/audit-events.ts`
- Create: `frontend/src/server/agent-api/mcp-funnel.ts`
- Modify: Stripe webhook/top-up attribution through a focused helper
- Create: `tests/mcp-funnel.test.ts`
- Create: `tests/mcp-topup-attribution.test.ts`

- [ ] Define allowlisted events:

```text
landing_cta_clicked (GA4 only unless signed acquisition exists)
oauth_connection_started / completed / revoked
trial_quote_prepared / accepted / completed / released / blocked
topup_handoff_created / wallet_funded
paid_quote_prepared / paid_generation_accepted / completed / failed
tool_called / tool_failed
```

- [ ] Implement deterministic cohort attribution from signed acquisition ID, OAuth client ID, quote ID, job ID, user ID, and top-up receipt. The Stripe webhook emits `wallet_funded` only after confirmed payment and never stores payment details in MCP events.

- [ ] Define the primary KPI exactly:

```text
distinct users with wallet_funded after trial_completed
--------------------------------------------------------
distinct users with trial_completed
```

- [ ] Add attribution windows as query configuration, not event mutation. Preserve immutable raw events and calculate cohorts in server queries.

- [ ] Add redaction tests that fail on prompt, token, raw URL, email, Stripe client secret, provider body, or payment method keys. Commit.

## Task 8: Add admin MCP acquisition and operations dashboard

**Files:**

- Create: `frontend/server/admin-mcp-metrics.ts`
- Create: `frontend/app/(core)/admin/mcp/page.tsx`
- Create: `frontend/app/(core)/admin/mcp/_components/AdminMcpView.tsx`
- Create: `frontend/app/(core)/admin/mcp/_lib/admin-mcp-helpers.ts`
- Modify: `frontend/lib/admin/navigation.ts`
- Create: `tests/admin-mcp-architecture.test.ts`
- Create: `tests/admin-mcp-metrics.test.ts`

- [ ] Write failing metric tests for each funnel step, trial→top-up KPI, Codex/Claude/other split, quote→confirm, recommendation→quote, first paid/repeat generation, revenue, internal provider cost, refund/release rate, error codes, polling load, and revocation rate.

- [ ] Query aggregated, privacy-safe metrics by range and client. Exclude prompts and private media. Separate trial provider cost from user revenue.

- [ ] Build server-rendered KPI cards, funnel, cohort conversion, client split, error table, cost guardrails, and flag status. Keep page orchestration under 200 lines and add architecture contracts.

- [ ] Add alerts through existing operations channels for abnormal trial volume, provider cost, quote confirmation rate, auth errors, polling rate, upload failures, and refund/restoration failures. Thresholds remain configurable server-side.

- [ ] Run admin auth/navigation/architecture tests and commit.

## Task 9: Create the GEO/tool-selection evaluation suite

**Files:**

- Create: `tests/fixtures/mcp-tool-selection-prompts.json`
- Create: `frontend/scripts/qa/mcp-tool-selection-eval.ts`
- Create: `docs/marketing/mcp-tool-selection-scorecard.md`
- Modify: `frontend/package.json`

- [ ] Create a labelled prompt set with at least:

  - direct requests naming MaxVideoAI/MCP;
  - indirect video/image creative requests where model recommendation or generation is useful;
  - prompt-writing-only requests where no MaxVideoAI tool is needed;
  - unsupported source-video/audio/document tasks;
  - pricing questions where list/recommend is insufficient and prepare is appropriate;
  - ambiguous spending cases where confirmation must not run;
  - negative cases for unrelated coding, research, or local image editing.

- [ ] Add expected tool sequence, allowed alternatives, prohibited tools, and rationale to each fixture. Do not include private customer prompts.

- [ ] Implement a QA runner that validates server/tool descriptions and can import recorded decisions from Codex and Claude test runs. Calculate selection precision, recall, forbidden-confirm rate, and correct quote-before-confirm rate by host.

- [ ] Add `qa:mcp-tool-selection` to `frontend/package.json`. Set release thresholds in the scorecard: zero forbidden confirmation, zero unsupported capability claims, and manually approved precision/recall targets based on the labelled set.

- [ ] Update tool descriptions/resources when errors cluster; do not create thin SEO pages to compensate for poor tool metadata. Commit.

## Task 10: Prepare support, privacy, terms, status, and distribution materials

**Files:**

- Create: `docs/operations/mcp-support-runbook.md`
- Create: `docs/marketing/mcp-directory-submissions.md`
- Modify: relevant privacy, acceptable-use, terms, changelog, and status content
- Create: `tests/mcp-legal-support-readiness.test.ts`

- [ ] Document user-facing permissions, OAuth revocation, data categories, media retention, trial abuse prevention, spending controls, provider processing, incident handling, and support escalation in visible legal/help copy.

- [ ] Build support decision trees for OAuth, email verification, quote expiry, insufficient funds, spending limit, upload, reference validation, provider failure, wallet refund, trial restoration, and revoked connection.

- [ ] Prepare directory listing assets: exact product name, verified endpoint, domain ownership, concise description, permissions, privacy URL, support URL, screenshots, demo, tool list, negative cases, and changelog. Do not mark any directory as approved before external confirmation.

- [ ] Record each directory's submission terms, ownership verification, review state, and canonical landing link. Evaluate OpenAI, Claude-compatible, and reputable neutral directories separately.

- [ ] Add a public status component for MCP/auth/upload/generation incidents only if backed by live operational data. Commit.

## Task 11: Verify indexation, performance, host UX, and conversion measurement

**Files:**

- Create: `tests/e2e/mcp-acquisition.spec.ts`
- Create: `docs/marketing/mcp-launch-evidence.md`
- Modify: `docs/operations/mcp-host-compatibility-matrix.md`

- [ ] Test EN/FR/ES public pages with JavaScript disabled: visible H1/promise/setup, self-canonical, correct hreflang, JSON-LD, indexable 200, internal links, and no auth wall.

- [ ] Test that API endpoint, OAuth, upload, account, and resource routes are private/no-store/noindex and absent from all sitemap variants.

- [ ] Run Lighthouse on `/mcp` and both integration pages. Keep demo media lazy, poster-backed, captioned, and within existing Core Web Vitals budgets.

- [ ] In Codex and Claude-compatible hosts, follow only the published instructions from a clean account. Verify OAuth, trial, reference, quote/confirmation, result, top-up, paid generation, revocation, and recovery.

- [ ] Verify the full event chain in the admin dashboard and raw privacy-safe ledger. Reconcile wallet funding and provider cost with existing receipts.

- [ ] Run the final technical gate:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-*.test.ts \
  tests/admin-mcp-*.test.ts \
  tests/public-product-claims.test.ts \
  tests/schema-sitemap-architecture.test.ts
npm --prefix frontend run i18n:check
npm --prefix frontend run seo:check
npm --prefix frontend run qa:mcp-tool-selection
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
npm --prefix frontend run build
```

- [ ] Inspect GSC after deployment for indexation, canonical selection, queries, countries, CTR, and intent cannibalization among the four pages. Preserve the initial baseline in launch evidence and adjust titles/internal links only from observed data.

- [ ] Enable public promotion only when all claims, legal/support, host compatibility, analytics, cost, abuse, refund/trial restoration, and SEO/GEO gates are green.

## Completion Criteria

- Four distinct, accurate, server-rendered intent owners explain and prove the live MCP workflow.
- Public docs no longer contradict product reality; translations and structured data match visible capabilities.
- Search and answer engines can crawl authoritative public pages while all protocol/private surfaces remain excluded.
- The full landing→OAuth→trial→top-up→paid funnel is measurable without prompts or private media.
- Admin cost/error/client dashboards, support/legal materials, tool-selection evaluation, host evidence, and kill switches are ready before directory submissions or broad promotion.
