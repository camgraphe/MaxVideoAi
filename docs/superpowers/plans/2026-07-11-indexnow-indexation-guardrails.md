# IndexNow Indexation Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure IndexNow submits only published, canonical comparison URLs and correct localized hubs, without silently dropping URLs through alphabetical truncation.

**Architecture:** Extract pure comparison-publication selection into a Node-compatible module under `scripts/`. Keep Git change detection and HTTP submission in the existing command. Test the pure module against the sitemap’s TypeScript source of truth so future catalog changes cannot make IndexNow broader than the sitemap.

**Tech Stack:** Node.js ESM, TypeScript Node test runner through `tsx`, Next.js sitemap helpers, JSON model catalog.

## Global Constraints

- Preserve all existing public URLs and current sitemap behavior.
- Do not modify the authenticated workspace or the user’s existing editor changes.
- Do not submit private render jobs, parameter variants, redirects, or `noindex` comparison URLs.
- Use test-first development and observe the new tests failing before changing production code.
- Do not mass-deindex comparison pages in this batch.

---

### Task 1: Published comparison URL selector

**Files:**
- Create: `scripts/indexnow-url-selection.mjs`
- Create: `tests/indexnow-url-selection.test.ts`

**Interfaces:**
- Consumes: engine catalog entries containing `modelSlug` and `surfaces.compare.publishedPairs`.
- Produces: `getPublishedComparisonSlugs(catalog)`, `getPublishedComparisonSlugsForModels(catalog, changedModelSlugs)`, `addComparisonUrls(urls, site, slug)`, and `addComparisonHubUrls(urls, site)`.

- [x] **Step 1: Write the failing behavioral tests**

```ts
test('IndexNow comparison slugs are exactly the sitemap publication set', async () => {
  const actual = getPublishedComparisonSlugs(engineCatalog);
  const expected = getHubComparisonSlugsForSitemap();
  assert.deepEqual(actual, expected);
});

test('changed models only select published comparisons involving that model', () => {
  const slugs = getPublishedComparisonSlugsForModels(fixtureCatalog, new Set(['alpha']));
  assert.deepEqual(slugs, ['alpha-vs-beta']);
});

test('localized comparison and hub URLs use canonical public paths', () => {
  const urls = new Set<string>();
  addComparisonHubUrls(urls, 'https://maxvideoai.com');
  addComparisonUrls(urls, 'https://maxvideoai.com', 'alpha-vs-beta');
  assert.ok(urls.has('https://maxvideoai.com/fr/comparatif'));
  assert.ok(urls.has('https://maxvideoai.com/es/comparativa'));
  assert.ok(!urls.has('https://maxvideoai.com/fr/ai-video-engines'));
});
```

- [x] **Step 2: Run the focused test and confirm RED**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/indexnow-url-selection.test.ts
```

Expected: failure because `scripts/indexnow-url-selection.mjs` does not exist.

- [x] **Step 3: Implement the minimal selector**

```js
export function getPublishedComparisonSlugs(catalog) {
  const validSlugs = new Set(catalog.map((entry) => entry?.modelSlug).filter(Boolean));
  const published = new Set();
  for (const entry of catalog) {
    const left = entry?.modelSlug;
    if (!left || EXCLUDED_ENGINE_SLUGS.has(left)) continue;
    for (const right of entry?.surfaces?.compare?.publishedPairs ?? []) {
      if (!validSlugs.has(right) || right === left || EXCLUDED_ENGINE_SLUGS.has(right)) continue;
      published.add(canonicalCompareSlug(left, right));
    }
  }
  return [...published].sort((a, b) => a.localeCompare(b));
}
```

- [x] **Step 4: Run the focused test and confirm GREEN**

Run the command from Step 2. Expected: all tests pass with zero failures.

### Task 2: Integrate the selector into the IndexNow command

**Files:**
- Modify: `scripts/indexnow-submit-changed.mjs`
- Modify: `tests/indexnow-url-selection.test.ts`

**Interfaces:**
- Consumes: selector functions from Task 1.
- Produces: a dry-run URL list limited to published comparisons and canonical localized hubs.

- [x] **Step 1: Add failing integration-contract assertions**

```ts
test('IndexNow delegates publication selection and does not synthesize combinations', () => {
  const source = readFileSync('scripts/indexnow-submit-changed.mjs', 'utf8');
  assert.match(source, /getPublishedComparisonSlugsForModels/);
  assert.doesNotMatch(source, /collectCatalogComparisonSlugsForModels/);
  assert.doesNotMatch(source, /\.slice\(0,.*MAX_URLS/);
});
```

- [x] **Step 2: Run the focused test and confirm RED**

Expected: failure because the command still generates all live/early-access combinations and truncates the sorted list.

- [x] **Step 3: Replace generated combinations with published comparisons**

```js
import {
  addComparisonHubUrls,
  addComparisonUrls,
  getPublishedComparisonSlugs,
  getPublishedComparisonSlugsForModels,
} from './indexnow-url-selection.mjs';
```

Use the full published set when comparison configuration changes and the changed-model subset when model content changes. Route hub additions through `addComparisonHubUrls`.

- [x] **Step 4: Remove silent alphabetical truncation**

Pass the complete deterministic URL list to dry-run/submission. The receiving API already handles one URL per request, so no new batching abstraction is required.

- [x] **Step 5: Run the focused test and confirm GREEN**

Run the focused command from Task 1. Expected: all selector and integration-contract tests pass.

### Task 3: Verification and documentation alignment

**Files:**
- Modify: `ACTION-PLAN.md`
- Verify: `scripts/indexnow-submit-changed.mjs`
- Verify: `scripts/indexnow-url-selection.mjs`
- Verify: `tests/indexnow-url-selection.test.ts`

**Interfaces:**
- Consumes: completed implementation from Tasks 1–2.
- Produces: a checked-off P0 IndexNow action and fresh validation evidence.

- [x] **Step 1: Run focused SEO contracts**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/indexnow-url-selection.test.ts tests/schema-sitemap-architecture.test.ts
```

Expected: zero failures.

- [x] **Step 2: Run repository checks proportionate to the change**

```bash
npm run lint:exposure
npm --prefix frontend run lint
git diff --check
```

Expected: every command exits successfully.

- [x] **Step 3: Run a safe dry-run and inspect its invariants**

```bash
node scripts/indexnow-submit-changed.mjs --dry-run
```

Expected: no `/app`, `/video/job_`, query-string comparison, `/fr/ai-video-engines`, `/es/ai-video-engines`, or unpublished comparison URL.

- [x] **Step 4: Mark only the completed IndexNow action in the action plan**

Update the report to distinguish implemented safeguards from later work on private jobs, application routes and controlled comparison consolidation.
