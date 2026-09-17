# MCP Checked-In Truth Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make active MCP claims, support procedures, and distribution readiness documents agree with the enabled production publication source and the fourteen-model-visible-plus-one-app-only tool inventory.

**Architecture:** Keep runtime configuration and tool registration authoritative. Add red-first contract assertions against known pre-production phrases, then update only active truth documents; preserve dated staging evidence and historical plans. Split claims, support, and distribution changes into independently reviewable commits.

**Tech Stack:** Markdown, JSON publication sources, TypeScript Node test runner, pnpm, Next.js repository contracts.

**Spec:** `docs/superpowers/specs/2026-09-16-mcp-convergence-release-design.md`

## Global Constraints

- Do not change runtime MCP flags, model identity, pricing, provider routing, Audio publication, or Studio montage publication.
- Treat `frontend/config/mcp-publication.json` as the shared publication source and the live server registry as the inventory source.
- Describe fourteen model-visible tools plus the app-only `get_generation_download` helper.
- Preserve host-specific limitations and never infer universal compatibility from one host.
- Preserve historical staging checkpoints as dated evidence; remove stale wording only where it acts as current guidance.
- Keep trial disabled and keep OpenAI and Anthropic directory blockers explicit.
- Work only in the isolated `codex/mcp-convergence-034` worktree based on `origin/main`.

---

### Task 1: Lock Current Production Truth With a Red Contract

**Files:**
- Modify: `tests/mcp-legal-support-readiness.test.ts:557-576`
- Verify: `frontend/config/mcp-publication.json`
- Verify: `docs/marketing/mcp-public-claims-matrix.md`
- Verify: `docs/operations/mcp-support-runbook.md`
- Verify: `docs/marketing/mcp-directory-submissions.md`

**Interfaces:**
- Consumes: parsed `publication`, `claims`, `support`, and `directory` fixtures already loaded by the test file.
- Produces: one contract named `active MCP truth records follow the enabled production boundary` that fails on known stale current-state wording.

- [ ] **Step 1: Add the failing current-truth test**

Add this test immediately before `directory facts do not outrun checked-in claims or host evidence`:

```ts
test('active MCP truth records follow the enabled production boundary', () => {
  assert.deepEqual(publication, {
    publicMarketing: true,
    publicIndexing: true,
    transport: true,
    oauth: true,
    discovery: true,
    paidGeneration: true,
    trial: false,
    referenceUploads: true,
    montagePreparation: false,
    audioGeneration: false,
    studioMontageCreation: false,
  });

  assert.doesNotMatch(
    claims,
    /publicMarketing=false|publicIndexing=false|Production transport disabled|MCP production disabled|Production OAuth disabled|public marketing off/i,
  );
  assert.match(claims, /fourteen model-visible tools plus one app-only helper/i);
  assert.match(claims, /trial=false/i);
  assert.doesNotMatch(
    support,
    /production OAuth is off|no quote tool is public|generation enforcement is future-gated/i,
  );
  assert.match(support, /fourteen model-visible tools plus one app-only/i);
  assert.doesNotMatch(directory, /launch product is a 13-tool|every publication flag is false/i);
  assert.match(directory, /fourteen model-visible tools plus one app-only/i);
});
```

- [ ] **Step 2: Run the focused test and record the red state**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-legal-support-readiness.test.ts
```

Expected: FAIL in the new test because all three active documents still contain pre-production wording.

### Task 2: Correct the Public Claims Matrix

**Files:**
- Modify: `docs/marketing/mcp-public-claims-matrix.md:10-47`
- Test: `tests/mcp-legal-support-readiness.test.ts`
- Test: `tests/mcp-publication.test.ts`

**Interfaces:**
- Consumes: exact booleans from `frontend/config/mcp-publication.json` and host limitations from `docs/operations/mcp-host-compatibility-matrix.md`.
- Produces: the current allowed/prohibited acquisition contract without changing runtime behavior.

- [ ] **Step 1: Replace stale live-state cells with exact current values**

Use these exact decisions:

```text
publicMarketing=true — direct first-party MCP and integration pages are live; no marketplace approval is implied.
publicIndexing=true — owned localized MCP pages may be indexed when their integration record is indexable.
transport=true — https://api.maxvideoai.com/mcp is the live Streamable HTTP resource.
discovery=true — account, model, recommendation, and project-budget tools are public after OAuth.
paidGeneration=true — prepare_generation returns a fresh exact quote without debit; confirm_generation requires explicit approval.
oauth=true — production OAuth is live; exact host lifecycle claims remain limited to recorded versions.
trial=false — no promotional MCP trial claim is allowed.
referenceUploads=true — private upload handoff and authorized host-file import are public; attachment support remains host-specific.
montagePreparation=false, audioGeneration=false, studioMontageCreation=false — no live Audio-generation or montage claim.
Production registers fourteen model-visible tools plus one app-only helper, get_generation_download.
```

Keep these prohibitions explicit: universal-client compatibility, payment-card collection in chat, fixed prices, universal reference support, live MCP Audio generation, live Studio montage, and ChatGPT/Claude directory availability.

- [ ] **Step 2: Make the publication rule match the resolver**

Replace the final rule with:

```text
`indexable` requires `publicIndexing`, transport, OAuth, discovery, paid generation, and reference uploads. Trial remains an independent claim and stays disabled. Integration-specific publication and indexation remain owned by `frontend/config/mcp-integrations.json`. Paid-generation, reference, Audio, and montage claims are independently gated and must not be inferred from a public page alone.
```

- [ ] **Step 3: Run claims and publication contracts**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-legal-support-readiness.test.ts \
  tests/mcp-publication.test.ts \
  tests/mcp-config.test.ts
```

Expected: the combined truth test still fails only on support and directory wording.

- [ ] **Step 4: Commit the claims boundary**

```bash
git add docs/marketing/mcp-public-claims-matrix.md tests/mcp-legal-support-readiness.test.ts
git commit -m "docs: align MCP claims with production"
```

### Task 3: Make the Support Runbook Operationally Current

**Files:**
- Modify: `docs/operations/mcp-support-runbook.md`
- Test: `tests/mcp-legal-support-readiness.test.ts`
- Verify: `docs/operations/mcp-host-compatibility-matrix.md`

**Interfaces:**
- Consumes: the production checkpoint and exact host limitations from the compatibility matrix.
- Produces: current support decisions for OAuth, verification, quotes, recovery, references, top-up, failures, and revocation.

- [ ] **Step 1: Update the header and inventory labels**

Set `Checked` to `2026-09-16`, readiness to `DIRECT PRODUCTION RELEASE LIVE`, and rename `Operational staging` to `Production model-visible tools`. Keep the exact fourteen-tool list and separate app-only helper row.

- [ ] **Step 2: Rewrite current availability statements**

Use these operational rules while preserving dated host evidence:

```text
OAuth: production OAuth is live. A 401 starts discovery and browser authorization; denial leaves protected tools unavailable. Host-specific refresh, logout, and reconnect claims require their own checkpoint.
Account: get_account_status reports the connected account state; support never bypasses verification.
Quotes: prepare_generation is public and creates no job or debit. An expired quote requires a fresh server quote.
Confirmation: confirm_generation is public only after explicit approval. A timeout is recovered through list_recent_generations and get_generation_status; never advise duplicate confirmation.
References: list_media, import_reference_files, and create_reference_upload_link are public. Private assets remain account-scoped; raw local paths and base64 never enter MCP.
Top-up: create_topup_link returns a first-party billing handoff. Card data stays outside chat; top-up requires a fresh account read and quote.
Audio and montage: existing Audio may be used as a reference where supported. Paid Audio generation and montage creation remain unpublished.
```

- [ ] **Step 3: Run the support contract**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-legal-support-readiness.test.ts
```

Expected: the new test fails only on the directory record.

- [ ] **Step 4: Commit the support correction**

```bash
git add docs/operations/mcp-support-runbook.md
git commit -m "docs: refresh MCP production support runbook"
```

### Task 4: Correct the Distribution Readiness Record

**Files:**
- Modify: `docs/marketing/mcp-directory-submissions.md`
- Modify: `tests/mcp-legal-support-readiness.test.ts:557-576`
- Test: `tests/mcp-host-proof.test.ts`
- Test: `tests/mcp-integration-registry.test.ts`

**Interfaces:**
- Consumes: current flags, inventory, production Codex evidence, policy blockers, and pre-publication 0.3.4 status.
- Produces: an internally consistent record that still identifies public release and Registry version 0.3.3 until publication succeeds.

- [ ] **Step 1: Update the product summary and canonical payload**

Replace `13-tool conversational production profile` with:

```text
The launch product exposes fourteen model-visible tools plus the app-only `get_generation_download` helper.
```

Keep the existing fourteen model-visible names and state that `get_generation_download` is not a model-visible workflow choice. Distinguish the production Codex checkpoint from dated Claude Desktop staging evidence.

- [ ] **Step 2: Remove resolved blockers without weakening policy blockers**

Replace `every publication flag is false` with:

```text
The direct production MCP path is live, but the platform-directory policy blocker remains independent and unresolved.
```

Replace `no live release or monitored MCP health feed exists` with:

```text
The direct MCP release is live. The owned status page does not yet expose a dedicated MCP component or first-party monitored health feed.
```

Replace the proof row with:

```text
Current public product screenshots and Claude-specific UI evidence exist. `getMcpProof()` remains null for a standalone job-and-audit-backed end-to-end proof bundle, so product captures are not universal native-host proof.
```

Retain `DO NOT SUBMIT` for OpenAI and Anthropic. Keep Official Registry and observed downstream rows at 0.3.3 until Milestone B.

- [ ] **Step 3: Update the old 13-tool test assertion**

```ts
assert.match(
  directory,
  /fourteen model-visible tools plus one app-only[\s\S]{0,500}Claude Desktop\s+1\.37937\.1[\s\S]{0,260}Codex CLI/i,
);
```

- [ ] **Step 4: Run distribution truth tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-legal-support-readiness.test.ts \
  tests/mcp-host-proof.test.ts \
  tests/mcp-integration-registry.test.ts \
  tests/mcp-docs-content.test.ts
```

Expected: PASS with no skips.

- [ ] **Step 5: Commit the distribution correction**

```bash
git add docs/marketing/mcp-directory-submissions.md tests/mcp-legal-support-readiness.test.ts
git commit -m "docs: converge MCP distribution readiness"
```

### Task 5: Run the Complete Checked-In Gate and Prepare Review

**Files:**
- Verify: `docs/marketing/mcp-public-claims-matrix.md`
- Verify: `docs/operations/mcp-support-runbook.md`
- Verify: `docs/marketing/mcp-directory-submissions.md`
- Verify: `tests/mcp-legal-support-readiness.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: one reviewable source branch; no tag, release, registry publish, or external message.

- [ ] **Step 1: Scan for forbidden stale phrases**

```bash
rg -n 'publicMarketing=false|publicIndexing=false|Production transport disabled|MCP production disabled|Production OAuth disabled|public marketing off|launch product is a 13-tool|every publication flag is false|production OAuth is off|no quote tool is public' \
  docs/marketing/mcp-public-claims-matrix.md \
  docs/operations/mcp-support-runbook.md \
  docs/marketing/mcp-directory-submissions.md
```

Expected: no matches.

- [ ] **Step 2: Run the focused MCP and plugin matrix**

```bash
pnpm github:assets:release-check
node scripts/check-github-content.mjs plugins/maxvideoai/README.md
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-legal-support-readiness.test.ts \
  tests/mcp-docs-content.test.ts \
  tests/mcp-config.test.ts \
  tests/mcp-publication.test.ts \
  tests/mcp-host-proof.test.ts \
  tests/mcp-integration-registry.test.ts \
  tests/mcp-plugin-contract.test.ts \
  tests/mcp-public-release-bundle.test.ts \
  tests/maxvideoai-plugin-mirror.test.ts \
  tests/github-content-contract.test.ts \
  tests/github-assets.test.ts
```

Expected: every test passes with no skips.

- [ ] **Step 3: Run repository gates**

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
git status --short --branch
```

Expected: lint and exposure lint exit zero, diff check is clean, and only intended commits are ahead of `origin/main`.

- [ ] **Step 4: Push and open the source PR**

```bash
git push -u origin codex/mcp-convergence-034
gh pr create \
  --base main \
  --head codex/mcp-convergence-034 \
  --title "docs: converge MCP production truth" \
  --body "Aligns active MCP claims, support guidance, and distribution readiness with the enabled production flags and fourteen-model-visible-plus-one-app-only inventory. Preserves historical evidence and policy blockers. No runtime capability change or external publication is included."
```

Expected: one PR limited to the spec, plans, active truth documents, and focused contracts.
