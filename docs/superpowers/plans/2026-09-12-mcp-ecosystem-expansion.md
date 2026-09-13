# MCP Ecosystem Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare MaxVideoAI for OpenClaw, ClawHub, n8n, Cursor, GitHub Copilot, Gemini CLI, and Microsoft MCP discovery without regressing the live Claude, ChatGPT, and Codex surfaces or overstating unrecorded host evidence.

**Architecture:** Extend the existing factual registry first, then derive per-integration preview behavior, localized first-wave pages, hub discovery, and auditable distribution artifacts from it. OpenClaw and n8n receive explicit EN/FR/ES `preview_noindex` routes and local draft artifacts; later hosts remain hidden evidence records until the launch gates in the approved design are satisfied.

**Tech Stack:** Next.js App Router, TypeScript, React Server Components, Node test runner, JSON registry and workflow artifacts, localized EN/FR/ES content.

**Spec:** `docs/superpowers/specs/2026-09-12-mcp-integration-ecosystem-design.md`

## Global Constraints

- Preserve all fifteen existing localized owners for `/mcp`, `/docs/mcp`, Claude, ChatGPT, and Codex.
- Claude, ChatGPT, and Codex remain `live`, indexable, acquisition-enabled, and unchanged in public order.
- Existing `verified` host evidence cannot be weakened without a newer recorded checkpoint.
- Compatibility, site publication, direct installation, package distribution, and store state remain independent.
- A new route may be `preview_noindex`; it cannot become `live` or indexable without recorded host evidence and owner approval.
- No external submission, store write, namespace claim, deployment, or real spend is authorized by this plan.
- All new public-facing editorial content is complete in English, French, and Spanish.
- Never hard-code current model rosters, model counts, fixed prices, credentials, or approval-bypassing generation paths in integration copy or distribution artifacts.
- `prepare_generation` never authorizes spend; accepted jobs are recovered instead of resubmitted.
- Every production-code change follows RED, GREEN, REFACTOR and ends in a focused commit.

---

### Task 1: Register the complete host roadmap without changing the live floor

**Files:**
- Modify: `frontend/config/mcp-integrations.json`
- Modify: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify: `docs/marketing/mcp-directory-submissions.md`
- Test: `tests/mcp-integration-registry.test.ts`
- Test: `tests/mcp-integration-public-baseline.test.ts`

**Interfaces:**
- Consumes: `parseMcpIntegrationRegistry(value)` and the immutable current public fixture.
- Produces: registry IDs `openclaw`, `n8n`, `cursor`, `githubCopilot`, `geminiCli`, and `microsoftCopilot`, plus their exact host records.

- [ ] **Step 1: Write the failing registry-roadmap test**

Add assertions that the complete order is:

```ts
assert.deepEqual(getMcpIntegrationIds(), [
  'claude', 'chatgpt', 'codex', 'openclaw', 'n8n',
  'cursor', 'githubCopilot', 'geminiCli', 'microsoftCopilot',
]);
assert.deepEqual(getMcpVisibleIntegrationIds(), [
  'claude', 'chatgpt', 'codex', 'openclaw', 'n8n',
]);
assert.deepEqual(getMcpPublicIntegrationPaths(), [
  '/integrations/claude', '/integrations/chatgpt', '/integrations/codex',
]);
```

Also assert that every new host is `not-run`, every later host is `hidden`, and only OpenClaw/n8n are `preview_noindex`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-integration-registry.test.ts tests/mcp-integration-public-baseline.test.ts
```

Expected: FAIL because the new integration IDs do not exist; the old baseline test still passes.

- [ ] **Step 3: Add exact non-public registry records**

Use display orders 40–90 and categories from the approved design. Configure OpenClaw and n8n as `preview_noindex`, non-indexable, acquisition-disabled, and direct-MCP available but not evidence-verified. Configure Cursor, GitHub Copilot, Gemini CLI, and Microsoft Copilot as hidden and acquisition-disabled. Use store targets `clawhub`, `n8n-template-library`, `cursor-mcp-catalog`, `github-mcp-registry`, `gemini-cli-extension-gallery`, and `microsoft-mcp-certification`; keep store status `eligible` only where the official policy review in the documentation supports it, otherwise `not_applicable` or `preparing` with matching evidence notes.

- [ ] **Step 4: Record the 2026-09-12 official-source review and non-claims**

Add matrix rows for OpenClaw, n8n MCP Client, n8n MCP Client Tool, Cursor, the GitHub Copilot host family, Gemini CLI, Copilot Studio, and Agents 365. Each row must state `Not run` and link to primary documentation. Add directory rows describing local preparation only and explicitly preserving the active Official MCP Registry record `com.maxvideoai/maxvideoai` version 0.3.3.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the same command from Step 2. Expected: both files pass and the existing public fixture remains byte-for-byte unchanged.

- [ ] **Step 6: Commit**

```bash
git add frontend/config/mcp-integrations.json docs/operations/mcp-host-compatibility-matrix.md docs/marketing/mcp-directory-submissions.md tests/mcp-integration-registry.test.ts
git commit -m "feat: register MCP ecosystem roadmap"
```

### Task 2: Derive integration-specific preview publication safely

**Files:**
- Modify: `frontend/lib/mcp-publication.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-page-data.ts`
- Test: `tests/mcp-publication.test.ts`

**Interfaces:**
- Consumes: `getMcpPublicationState(inputs)` and `getMcpIntegration(id)`.
- Produces: `getMcpIntegrationPublicationState(id, globalState): McpPublicationState`.

- [ ] **Step 1: Write the failing per-integration publication test**

```ts
assert.deepEqual(
  getMcpIntegrationPublicationState('openclaw', liveGlobalState),
  {
    ...liveGlobalState,
    renderPublicPage: true,
    connectionAvailable: false,
    indexable: false,
    showTrialClaim: false,
    showPaidGenerationClaim: false,
    showReferenceClaim: false,
  },
);
assert.equal(getMcpIntegrationPublicationState('cursor', liveGlobalState).renderPublicPage, false);
assert.deepEqual(
  getMcpIntegrationPublicationState('claude', liveGlobalState),
  liveGlobalState,
);
```

- [ ] **Step 2: Run and verify RED**

Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-publication.test.ts`.

Expected: FAIL because `getMcpIntegrationPublicationState` is not exported.

- [ ] **Step 3: Implement the minimal projection**

The function must return a hidden state when the registry publication is `hidden`; preserve the global state for a live integration; and for `preview_noindex`, allow rendering while forcing connection, indexing, paid, trial, and reference claims off. Update the page-data builder to reject accidental indexation whenever its client registry state is not live.

- [ ] **Step 4: Run and verify GREEN**

Run the focused publication and registry tests. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/mcp-publication.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/integrations/_lib/integration-page-data.ts tests/mcp-publication.test.ts
git commit -m "feat: gate MCP integration previews independently"
```

### Task 3: Generalize localized integration copy for first-wave previews

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/types.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/openclaw.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/n8n.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/en.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/fr.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/es.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/shared.ts`
- Test: `tests/mcp-marketing-copy.test.ts`

**Interfaces:**
- Consumes: `McpClientId`, `McpCompatibilityHostId`, `MCP_PRODUCTION_RESOURCE_URL`.
- Produces: complete `IntegrationPageCopy` values for OpenClaw and n8n in EN/FR/ES through the existing `getIntegrationCopy(locale, client)` facade.

- [ ] **Step 1: Write failing copy-completeness and claim-safety tests**

Extend the locale/client matrix to include `openclaw` and `n8n`. Assert:

```ts
assert.match(JSON.stringify(openclaw), /OpenClaw/);
assert.match(JSON.stringify(n8n), /MCP Client/);
assert.match(JSON.stringify(n8n), /MCP Client Tool/);
assert.doesNotMatch(JSON.stringify({ openclaw, n8n }), /verified|certified|official partner/i);
assert.doesNotMatch(JSON.stringify({ openclaw, n8n }), /\$\d|\d+ models/i);
```

Also assert that OpenClaw explains shared versus per-requester OAuth and that n8n separates deterministic steps from AI Agent tools, exact approval, stable idempotency, and accepted-job recovery.

- [ ] **Step 2: Run and verify RED**

Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-marketing-copy.test.ts`.

Expected: FAIL because the locale builders do not handle the two IDs.

- [ ] **Step 3: Add focused first-wave copy builders**

Keep generic labels/actions in `shared.ts`. Put OpenClaw-specific and n8n-specific semantic copy in separate focused modules, with locale dictionaries passed into pure builders. Content must describe the documented setup as a validation preview, show the public endpoint, identify evidence as not run, preserve account/OAuth/quote/recovery/disconnect boundaries, and never imply store listing or endorsement.

- [ ] **Step 4: Extend the three locale dispatchers**

Each locale builder branches to the focused OpenClaw/n8n builder before its existing Claude/ChatGPT/Codex logic. Do not change any existing strings for those three clients.

- [ ] **Step 5: Run and verify GREEN**

Run the marketing-copy, registry, baseline, and architecture tests. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/'(localized)'/'[locale]'/'(marketing)'/integrations/_content tests/mcp-marketing-copy.test.ts
git commit -m "feat: add localized OpenClaw and n8n preview copy"
```

### Task 4: Add explicit OpenClaw and n8n preview routes with complete SEO isolation

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/openclaw/page.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/n8n/page.tsx`
- Modify: `frontend/i18n/routing.ts`
- Test: `tests/mcp-marketing-route-architecture.test.ts`
- Test: `tests/mcp-seo-signals.test.ts`
- Test: `tests/mcp-publication.test.ts`

**Interfaces:**
- Consumes: `getMcpIntegrationPublicationState`, `buildIntegrationMetadata`, `buildIntegrationPageData`, `IntegrationPageView`, and `IntegrationJsonLdScripts`.
- Produces: explicit EN/FR/ES routes for `/integrations/openclaw` and `/integrations/n8n`, with Spanish `/es/integraciones/...`, canonical/hreflang, and `noindex,follow` metadata.

- [ ] **Step 1: Write failing route and metadata tests**

Assert that both explicit route owners exist, remain at or below 45 lines, use the shared builder, and contain no client-side directive. For all three locales, assert exact canonical URLs, reciprocal alternates, `robots.index === false`, and absence from `getMcpPublicIntegrationPaths()` and sitemap projections.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-marketing-route-architecture.test.ts tests/mcp-seo-signals.test.ts tests/mcp-publication.test.ts
```

Expected: FAIL because the two route owners and localized pathnames are absent.

- [ ] **Step 3: Implement thin explicit route owners**

Copy the established orchestrator shape but set `CLIENT` to the relevant literal and call `getMcpIntegrationPublicationState(CLIENT, getMcpPublicationState(FEATURES.mcp))`. Hidden routes call `notFound`; preview routes render with noindex metadata and truthful preview content.

- [ ] **Step 4: Add localized routing entries**

Map both English paths to `/integrations/<slug>` in EN/FR and `/integraciones/<slug>` in ES. Do not change the existing route mappings.

- [ ] **Step 5: Run and verify GREEN**

Run the focused tests from Step 2 plus the public baseline. Expected: PASS and the indexable path list still contains exactly the original three integrations.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/'(localized)'/'[locale]'/'(marketing)'/integrations/openclaw frontend/app/'(localized)'/'[locale]'/'(marketing)'/integrations/n8n frontend/i18n/routing.ts tests/mcp-marketing-route-architecture.test.ts tests/mcp-seo-signals.test.ts tests/mcp-publication.test.ts
git commit -m "feat: add noindex MCP integration previews"
```

### Task 5: Expand the MCP hub below the existing primary choices

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-types.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpEcosystemSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpPageView.tsx`
- Test: `tests/mcp-marketing-copy.test.ts`
- Test: `tests/mcp-marketing-route-architecture.test.ts`

**Interfaces:**
- Consumes: `getMcpVisibleIntegrationIds()` and localized integration paths.
- Produces: `McpPageCopy.ecosystem` and a server-rendered secondary section for OpenClaw and n8n.

- [ ] **Step 1: Write failing hub hierarchy tests**

Preserve the exact hero assertions for Claude, ChatGPT, and Codex. Add assertions that OpenClaw and n8n appear only after those primary actions, are labelled as validation previews, and are grouped under autonomous agents and automation. Assert that no unowned third-party logo asset is required.

- [ ] **Step 2: Run and verify RED**

Run the two focused test files. Expected: FAIL because `ecosystem` and its component are absent.

- [ ] **Step 3: Add localized ecosystem copy**

Add EN/FR/ES headings, explanation, category labels, availability labels, and the two exact localized destinations. Do not change the existing hero title, description, action order, or card copy.

- [ ] **Step 4: Implement the server component**

Render restrained text-first cards after the existing primary workflow/hero region. Use registry labels/state for factual availability and authored copy for customer intent. Do not render hidden later-host records.

- [ ] **Step 5: Run and verify GREEN**

Run the copy, architecture, SEO-signal, and baseline tests. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/'(localized)'/'[locale]'/'(marketing)'/mcp tests/mcp-marketing-copy.test.ts tests/mcp-marketing-route-architecture.test.ts
git commit -m "feat: surface MCP ecosystem previews on hub"
```

### Task 6: Prepare an auditable ClawHub skill without publishing it

**Files:**
- Create: `distribution/clawhub/maxvideoai/SKILL.md`
- Create: `distribution/clawhub/maxvideoai/references/safe-generation.md`
- Create: `distribution/clawhub/maxvideoai/.clawhubignore`
- Create: `docs/operations/mcp-distribution-artifacts.md`
- Test: `tests/mcp-clawhub-artifact.test.ts`

**Interfaces:**
- Consumes: the production MCP URL and the server-owned live catalogue/tool contract.
- Produces: a thin, inspectable ClawHub skill candidate with no credentials, model roster, prices, or executable installer.

- [ ] **Step 1: Write the failing artifact contract**

Assert that `SKILL.md` has valid frontmatter, points only to `https://api.maxvideoai.com/mcp` and first-party help destinations, names discovery/budget/prepare/confirm/recovery boundaries, and contains no token, secret, shell installer, fixed price, or hard-coded model roster. Assert `.clawhubignore` excludes operating notes and local evidence.

- [ ] **Step 2: Run and verify RED**

Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-clawhub-artifact.test.ts`.

Expected: FAIL because the artifact does not exist.

- [ ] **Step 3: Create the minimal skill candidate**

The skill guides an OpenClaw agent to connect through the host-supported remote MCP/OAuth flow, begin with discovery, prepare but not confirm without explicit approval, recover accepted jobs, and use canonical MaxVideoAI result/library links. It must not install code, proxy the MCP, handle credentials, or duplicate product facts.

- [ ] **Step 4: Document reproducibility and the external-write boundary**

Record exact included files, permissions (none beyond host MCP access), primary ClawHub sources, dry-run command, clean-install checklist, update/uninstall checklist, scan review, MIT-0 implication, and the rule that only an owner-authorized future action may publish.

- [ ] **Step 5: Run and verify GREEN**

Run the focused artifact test. If a locally available ClawHub CLI supports unauthenticated `--dry-run`, run it and record the sanitized result; otherwise record the exact unavailable validation as pending without changing store status to submitted/listed.

- [ ] **Step 6: Commit**

```bash
git add distribution/clawhub docs/operations/mcp-distribution-artifacts.md tests/mcp-clawhub-artifact.test.ts
git commit -m "feat: prepare auditable ClawHub skill"
```

### Task 7: Prepare approval-safe n8n workflow templates

**Files:**
- Create: `distribution/n8n/brief-to-approved-generation.json`
- Create: `distribution/n8n/campaign-queue.json`
- Create: `distribution/n8n/completion-notification.json`
- Create: `distribution/n8n/README.md`
- Test: `tests/mcp-n8n-workflows.test.ts`

**Interfaces:**
- Consumes: n8n MCP Client node conventions and the existing MaxVideoAI tool names.
- Produces: three import candidates with no credentials and machine-testable approval/idempotency invariants.

- [ ] **Step 1: Write failing workflow invariants**

Parse all three JSON files and assert unique node IDs, valid connection targets, no embedded credentials, endpoint equality with `https://api.maxvideoai.com/mcp`, finite wait/poll bounds, and no fixed price/model roster. For generation flows, assert the graph orders `prepare_generation` before a human approval gate and `confirm_generation`, carries one stable idempotency key, and never routes timeout recovery back into confirmation. For completion notification, assert there is no `confirm_generation` node and notifications occur only for completion, refund/failure, or required user action.

- [ ] **Step 2: Run and verify RED**

Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-n8n-workflows.test.ts`.

Expected: FAIL because the workflow files do not exist.

- [ ] **Step 3: Create the three minimal import candidates**

Use only built-in control/data nodes plus `n8n-nodes-langchain.mcpClient` for deterministic MaxVideoAI calls. Store the MCP credential by reference only; never include a credential ID or secret in exported JSON. Use explicit manual approval/webhook boundaries, bounded batches, stable per-item keys, and wait/status branches that recover the accepted job.

- [ ] **Step 4: Document import and validation scope**

The README must distinguish n8n Cloud and self-hosted credential ownership, describe MCP Client versus MCP Client Tool, identify the required OAuth credential setup, explain why templates are drafts until imported on a recorded n8n version, and keep template-library submission owner-authorized and separate.

- [ ] **Step 5: Run and verify GREEN**

Run the workflow test. If a compatible local n8n CLI is already available, perform a read-only/import validation against a disposable local instance; otherwise retain `not-run` evidence and `preview_noindex` publication.

- [ ] **Step 6: Commit**

```bash
git add distribution/n8n tests/mcp-n8n-workflows.test.ts
git commit -m "feat: prepare approval-safe n8n workflows"
```

### Task 8: Lock later-host readiness and full non-regression

**Files:**
- Modify: `docs/engineering/mcp-integration-registry.md`
- Modify: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify: `docs/marketing/mcp-directory-submissions.md`
- Test: `tests/mcp-host-proof.test.ts`
- Test: `tests/mcp-seo-signals.test.ts`
- Test: `tests/mcp-integration-public-baseline.test.ts`

**Interfaces:**
- Consumes: all registry, route, copy, and distribution changes from Tasks 1–7.
- Produces: exact promotion checklists for Cursor, GitHub Copilot, Gemini CLI, and Microsoft, plus an unchanged live-floor proof.

- [ ] **Step 1: Write failing documentation/readiness assertions**

Assert that each later host has an exact primary source, transport/OAuth limitation, clean-host checklist, store/discovery target, and explicit `not-run`/hidden state. Assert GitHub Copilot desktop/IDE/CLI support is not conflated with cloud-agent OAuth support, Gemini records RFC 9207 issuer requirements, and Microsoft remains an enterprise certification track.

- [ ] **Step 2: Run and verify RED**

Run the three focused tests. Expected: FAIL until the new readiness sections exist.

- [ ] **Step 3: Complete ownership and promotion documentation**

Document the one-host-at-a-time promotion sequence: controlled install, OAuth denial/approval/refresh/revoke/reconnect, discovery, budget, fresh quote, separately authorized minimal confirmation, accepted-job recovery, output/library path, sanitized evidence, localized copy, owner publication approval, and separate store action.

- [ ] **Step 4: Run the complete MCP suite**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-*.test.ts
```

Expected: every test passes; the frozen public baseline still reports exactly fifteen current live localized owners.

- [ ] **Step 5: Run repository checks**

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
npm --prefix frontend run build
```

Expected: all commands pass. A repository Node-version advisory is acceptable only if it is unchanged and the build completes successfully.

- [ ] **Step 6: Smoke-test all live and preview routes**

Start the production build locally and verify:

- all existing fifteen owners return 200 with their unchanged canonical/index/follow behavior;
- OpenClaw and n8n return 200 in EN/FR/ES with exact canonical, reciprocal hreflang, one `main`, and `noindex,follow`;
- OpenClaw and n8n are absent from every sitemap and `llms.txt` indexable projection;
- hidden Cursor, Copilot, Gemini, and Microsoft paths return 404 because no route exists;
- no preview or hidden integration becomes an enabled acquisition client.

- [ ] **Step 7: Commit the final readiness lock**

```bash
git add docs/engineering/mcp-integration-registry.md docs/operations/mcp-host-compatibility-matrix.md docs/marketing/mcp-directory-submissions.md tests/mcp-host-proof.test.ts tests/mcp-seo-signals.test.ts tests/mcp-integration-public-baseline.test.ts
git commit -m "docs: lock MCP ecosystem promotion gates"
```

- [ ] **Step 8: Stop before push or merge**

Report the branch, commit list, full verification results, remaining real-host evidence, and every external action that still needs owner authorization. Do not push, merge, submit, publish, claim a namespace, or spend credits.
