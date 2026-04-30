# SEO Cockpit Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build proprietary MaxVideoAI SEO decision tools from owned/free data: stronger opportunity scoring, Codex-ready action generation, family prioritization, CTR diagnosis, missing-content suggestions, internal-link recommendations, and content-decay signals.

**Architecture:** Keep Google credentials and private SEO data server-side. Expand the current `gsc-analysis` layer into focused pure modules that operate on GSC rows plus local site metadata, then compose those modules in a new SEO cockpit page. Keep `/admin/seo/gsc` as the raw Search Console view and add action-first routes for the command center and action queue.

**Tech Stack:** Next.js App Router, existing admin shell/components, TypeScript pure utilities, Node test runner via `tsx --test`, official Google Search Console API only, local sitemap/model/content files, optional protected downloads instead of production filesystem writes.

---

## File Structure

- Modify: `frontend/server/seo/gsc.ts`
  - Fetch richer current/previous datasets needed by Phase 2: query/page current, query/page previous, date trend, page-only current/previous, query-only current/previous.
  - Expose raw current and previous rows without leaking credentials.
- Split or extend: `frontend/lib/seo/gsc-analysis.ts`
  - Keep existing types/date parsing/summarization.
  - Add richer intent detection and query clustering if the file remains manageable.
- Create: `frontend/lib/seo/internal-seo-types.ts`
  - Shared types for opportunities, CTR Doctor findings, missing-content suggestions, link suggestions, family tracker rows, decay findings, and Codex action items.
- Create: `frontend/lib/seo/seo-intents.ts`
  - Intent classifier for pricing, prompt examples, prompt guide, comparison, specs, max length, image-to-video, text-to-video, no subscription, pay-as-you-go, examples, best AI video generator, camera movement, first/last frame, product advertisement, realistic humans, and model size/parameters.
- Create: `frontend/lib/seo/seo-opportunity-engine.ts`
  - Query clustering, Opportunity Finder 2.0, expected-impact estimation, and Codex task drafting.
- Create: `frontend/lib/seo/ctr-doctor.ts`
  - CTR-specific diagnosis using GSC rows plus extracted page title/meta/H1/hero intro.
- Create: `frontend/lib/seo/site-content-index.ts`
  - Local route/content index from sitemap, model content JSON, compare-hub data, examples family config, and app route paths.
- Create: `frontend/lib/seo/missing-content-detector.ts`
  - Decide new page vs section vs FAQ vs comparison/specs/pricing/examples block vs no action.
- Create: `frontend/lib/seo/internal-link-builder.ts`
  - Source/target/anchor/reason/priority recommendations from GSC opportunities and local route graph.
- Create: `frontend/lib/seo/model-family-tracker.ts`
  - Business-priority weighted family tracker with next recommended actions.
- Create: `frontend/lib/seo/content-decay.ts`
  - Current vs previous page/query/family decay signals.
- Create: `frontend/lib/seo/codex-action-queue.ts`
  - Merge all findings into deduped, prioritized, markdown-ready action items.
- Create: `frontend/server/seo/cockpit.ts`
  - Server composition layer that calls `fetchGscDashboardData`, builds the local content index, runs analysis modules, and returns a single cockpit payload.
- Create: `frontend/app/(core)/admin/seo/cockpit/page.tsx`
  - Main command center: overview, urgent actions, family tracker, opportunity cards, action queue preview.
- Create: `frontend/app/(core)/admin/seo/actions/page.tsx`
  - Dedicated Codex action queue view with copy-ready markdown.
- Create: `frontend/app/api/admin/seo/actions/export/route.ts`
  - Protected downloadable markdown/json export. Do not write production files by default.
- Modify: `frontend/app/(core)/admin/seo/gsc/page.tsx`
  - Keep as raw GSC diagnostics; add links to Cockpit and Actions.
- Modify: `frontend/lib/admin/navigation.ts` and `frontend/components/admin/SidebarNav.tsx`
  - Prefer `SEO cockpit` as primary nav link. Keep GSC raw as a secondary page link from the cockpit.
- Create or extend tests:
  - `tests/seo-intents.test.ts`
  - `tests/seo-opportunity-engine.test.ts`
  - `tests/ctr-doctor.test.ts`
  - `tests/missing-content-detector.test.ts`
  - `tests/internal-link-builder.test.ts`
  - `tests/model-family-tracker.test.ts`
  - `tests/content-decay.test.ts`
  - `tests/codex-action-queue.test.ts`

## Task 1: Rich Intent Classifier

**Files:**
- Create: `frontend/lib/seo/seo-intents.ts`
- Test: `tests/seo-intents.test.ts`

- [ ] **Step 1: Write failing tests**

Cover at least these inputs:

```ts
assert.equal(classifySeoIntent('ltx 2.3 prompts'), 'prompt_examples');
assert.equal(classifySeoIntent('seedance 2.0 prompt guide'), 'prompt_guide');
assert.equal(classifySeoIntent('kling vs veo'), 'comparison');
assert.equal(classifySeoIntent('ai video pay as you go no subscription'), 'pay_as_you_go');
assert.equal(classifySeoIntent('veo 3 max length'), 'max_length');
assert.equal(classifySeoIntent('best ai video generator for product ads'), 'product_advertisement');
assert.equal(classifySeoIntent('first last frame video generator'), 'first_last_frame');
assert.equal(classifySeoIntent('realistic human ai video'), 'realistic_humans');
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seo-intents.test.ts`

- [ ] **Step 3: Implement `classifySeoIntent` and `deriveIntentActionKind`**

Return explicit enum-like string literals and keep the classifier regex-based, deterministic, and fully local.

- [ ] **Step 4: Verify**

Run the same test and confirm all cases pass.

## Task 2: Local Site Content Index

**Files:**
- Create: `frontend/lib/seo/site-content-index.ts`
- Test: `tests/site-content-index.test.ts`

- [ ] **Step 1: Write failing tests**

Use local fixtures or real small samples to assert:

```ts
const index = await buildSiteContentIndex();
assert.ok(index.byPath.get('/models/seedance-2-0'));
assert.ok(index.byPath.get('/examples/seedance'));
assert.ok(index.byPath.get('/ai-video-engines/seedance-2-0-vs-veo-3-1'));
assert.equal(index.byPath.get('/models/seedance-2-0')?.pageType, 'model');
assert.match(index.byPath.get('/models/seedance-2-0')?.title ?? '', /Seedance/i);
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/site-content-index.test.ts`

- [ ] **Step 3: Implement index builder**

Read from:

- `content/models/en/*.json`
- `frontend/config/model-families.ts`
- `frontend/lib/compare-hub/data.ts`
- `frontend/lib/sitemapData.ts` where feasible

Store title, meta description, H1/hero title, hero intro, page type, family, model slug, known outgoing links from JSON fields, and likely edit files.

- [ ] **Step 4: Verify**

Run the new test and `pnpm --prefix frontend exec tsc --noEmit --project tsconfig.json`.

## Task 3: Opportunity Finder 2.0 and Codex Tasks

**Files:**
- Create: `frontend/lib/seo/internal-seo-types.ts`
- Create: `frontend/lib/seo/seo-opportunity-engine.ts`
- Test: `tests/seo-opportunity-engine.test.ts`

- [ ] **Step 1: Write failing tests**

Assert query clustering and task drafting:

```ts
const result = buildSeoOpportunities({
  currentRows,
  previousRows,
  siteIndex,
  businessPriorityOrder: ['Seedance', 'Kling', 'Veo', 'LTX', 'Pika', 'Wan', 'Hailuo / Minimax', 'Sora'],
});
assert.equal(result[0].priority, 'P1');
assert.match(result[0].codexTaskDraft, /Acceptance criteria:/);
assert.match(result[0].expectedImpact, /CTR|click|ranking|internal link/i);
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seo-opportunity-engine.test.ts`

- [ ] **Step 3: Implement the engine**

Generate action-oriented opportunities with:

- priority
- affected page
- query cluster
- model family
- intent type
- observed issue
- suggested action
- expected impact
- Codex task draft

Support: high impressions low CTR, strong position zero clicks, position 4-12, gaining pages, losing pages, missing sections, missing pages, internal-link actions.

- [ ] **Step 4: Verify**

Run opportunity tests and existing `tests/gsc-analysis.test.ts`.

## Task 4: CTR Doctor

**Files:**
- Create: `frontend/lib/seo/ctr-doctor.ts`
- Test: `tests/ctr-doctor.test.ts`

- [ ] **Step 1: Write failing tests**

Use a page title/meta/hero fixture where query intent is absent:

```ts
const findings = buildCtrDoctorFindings(rows, siteIndex);
assert.equal(findings[0].problem, 'Strong position but weak CTR');
assert.match(findings[0].titleDirection, /prompt/i);
assert.equal(findings[0].makeIntentVisibleAboveFold, true);
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/ctr-doctor.test.ts`

- [ ] **Step 3: Implement CTR diagnosis**

Compare query-cluster tokens and intent against page title, meta description, H1/hero title, and hero intro. Do not auto-edit content.

- [ ] **Step 4: Verify**

Run the CTR tests.

## Task 5: Missing Section/Page Detector

**Files:**
- Create: `frontend/lib/seo/missing-content-detector.ts`
- Test: `tests/missing-content-detector.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- LTX prompt queries recommend section/FAQ, not new page.
- A high-volume unpublished `model-a vs model-b` query recommends comparison page only if no route exists.
- Tiny one-off query returns `no_action`.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/missing-content-detector.test.ts`

- [ ] **Step 3: Implement recommendation rules**

Prefer strengthening existing model/example/compare pages. Gate new pages behind meaningful impressions, clustered query count, and route absence.

- [ ] **Step 4: Verify**

Run missing-content tests.

## Task 6: Internal Link Builder

**Files:**
- Create: `frontend/lib/seo/internal-link-builder.ts`
- Test: `tests/internal-link-builder.test.ts`

- [ ] **Step 1: Write failing tests**

Assert recommendations like:

```ts
assert.deepEqual(link.targetPath, '/models/ltx-2-3-pro');
assert.equal(link.sourcePath, '/examples/ltx');
assert.match(link.suggestedAnchor, /LTX 2.3 prompt examples and specs/i);
assert.match(link.reason, /GSC.*prompt|example intent/i);
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/internal-link-builder.test.ts`

- [ ] **Step 3: Implement link suggestions**

Use GSC opportunities, site index, model-family config, compare relationships, and scanned outgoing links when available. Flag weak/generic anchors only when the source content is available locally.

- [ ] **Step 4: Verify**

Run link-builder tests.

## Task 7: Model Family Tracker 2.0

**Files:**
- Create: `frontend/lib/seo/model-family-tracker.ts`
- Test: `tests/model-family-tracker.test.ts`

- [ ] **Step 1: Write failing tests**

Assert configured business priority ranks Seedance before Sora even if Sora has more impressions, unless urgent decay/CTR issues dominate.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-family-tracker.test.ts`

- [ ] **Step 3: Implement family tracker**

For each family return clicks, impressions, CTR, average position, top queries, rising/declining queries, zero-click opportunities, pages to strengthen, missing sections, link suggestions, and recommended next Codex actions.

- [ ] **Step 4: Verify**

Run family tracker tests.

## Task 8: Content Decay Detector

**Files:**
- Create: `frontend/lib/seo/content-decay.ts`
- Test: `tests/content-decay.test.ts`

- [ ] **Step 1: Write failing tests**

Cover pages losing impressions/clicks, query clusters losing position, families losing momentum, and outdated model versions still receiving impressions.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/content-decay.test.ts`

- [ ] **Step 3: Implement decay findings**

Generate suggested actions: update title/meta, add current model references, add comparison block, add pricing/specs clarity, add latest examples, add internal links, de-emphasize outdated models.

- [ ] **Step 4: Verify**

Run decay tests.

## Task 9: Codex Action Queue and Exports

**Files:**
- Create: `frontend/lib/seo/codex-action-queue.ts`
- Create: `frontend/app/(core)/admin/seo/actions/page.tsx`
- Create: `frontend/app/api/admin/seo/actions/export/route.ts`
- Test: `tests/codex-action-queue.test.ts`

- [ ] **Step 1: Write failing tests**

Assert markdown includes title, source, problem, recommended implementation, files likely to inspect/edit, and acceptance criteria.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/codex-action-queue.test.ts`

- [ ] **Step 3: Implement action queue**

Deduplicate overlapping signals and preserve source data. Prefer protected download response over production file writes. Add optional local script later for writing `data/seo/*.json` and markdown files during local runs.

- [ ] **Step 4: Verify**

Run action queue tests.

## Task 10: SEO Cockpit UI

**Files:**
- Create: `frontend/server/seo/cockpit.ts`
- Create: `frontend/app/(core)/admin/seo/cockpit/page.tsx`
- Modify: `frontend/app/(core)/admin/seo/gsc/page.tsx`
- Modify: `frontend/lib/admin/navigation.ts`
- Modify: `frontend/components/admin/SidebarNav.tsx`

- [ ] **Step 1: Add server composition**

Compose `fetchGscDashboardData`, `buildSiteContentIndex`, opportunity engine, CTR Doctor, missing-content detector, internal-link builder, family tracker, content decay, and Codex action queue.

- [ ] **Step 2: Add page layout**

Use existing admin hub visual language:

- overview deck
- urgent actions next
- family tracker
- opportunity cards
- Codex action queue
- expandable detail tables only below the action surfaces

- [ ] **Step 3: Adjust navigation**

Make `/admin/seo/cockpit` the primary nav item. Keep `/admin/seo/gsc` as raw data diagnostics and `/admin/seo/actions` as the queue.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seo-intents.test.ts tests/seo-opportunity-engine.test.ts tests/ctr-doctor.test.ts tests/missing-content-detector.test.ts tests/internal-link-builder.test.ts tests/model-family-tracker.test.ts tests/content-decay.test.ts tests/codex-action-queue.test.ts
pnpm --prefix frontend exec tsc --noEmit --project tsconfig.json
pnpm test:validate
```

## Route Decision

- `/admin/seo/cockpit`: main SEO command center and default admin nav destination.
- `/admin/seo/gsc`: raw GSC Search Analytics dashboard and refresh diagnostics.
- `/admin/seo/actions`: Codex Action Queue and protected export/download surface.
- `/admin/seo/internal-links`: defer until link builder needs a dedicated review workflow.

## Storage Decision

Do not write private SEO exports into repo-tracked `data/seo` from production. Phase 2 should use protected downloadable exports first. Add a local-only script later if committed or local files are needed:

- `scripts/export-seo-action-queue.ts`
- Writes to `data/seo/*.json` and `data/seo/*.md`
- Guarded by `NODE_ENV !== 'production'` or an explicit `--allow-private-seo-export` flag

## Validation Checklist

- All new analysis behavior has pure utility tests.
- Admin routes remain under `frontend/app/(core)/admin` and inherit noindex metadata.
- API exports call `requireAdmin(req)`.
- No paid SEO APIs are introduced.
- Google credentials remain in `frontend/server/**` or API route server code only.
- The UI prioritizes action cards and Codex tasks over charts.
