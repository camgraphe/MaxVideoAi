# SEO-Safe Site Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the confirmed semantic, accessibility, structured-data, and native image-runtime issues without changing public content, pricing, URLs, localization, or conversion behavior.

**Architecture:** The localized marketing layout remains the single owner of the page `<main>` landmark, while route views render neutral containers inside it. Pricing tables share one route-local accessible horizontal-scroll wrapper. Homepage JSON-LD uses one canonical Organization entity, and the direct Sharp dependency is aligned with the version used by Next.js. The long-page and workspace-latency observations remain measurement items until production evidence shows that a behavior change would be beneficial.

**Tech Stack:** Next.js 15 App Router, React Server Components, TypeScript, next-intl, JSON-LD, Tailwind CSS, Sharp, Node test runner.

## Global Constraints

- Do not change the size of mobile navigation, media, or action controls in this plan.
- Preserve every public URL, redirect, canonical URL, hreflang alternate, sitemap assumption, metadata title, and metadata description.
- Preserve all visible copy, headings, links, section order, pricing values, pricing calculations, and localized paths.
- Preserve the complete mobile and desktop content set; do not remove, shorten, or client-only render indexable content.
- Preserve workspace generation, wallet, member, job, upload, and billing behavior.
- Keep `frontend/app/(localized)/[locale]/(marketing)/layout.tsx` as the only `<main>` owner for localized marketing pages.
- Make one independently reviewable commit per task.
- Run the focused SEO contracts after every public-route change and a full build before completion.

## Explicitly Deferred

- **Mobile control sizing:** excluded at the user's request.
- **Homepage and pricing-page length:** do not change yet. Google permits equivalent mobile content to be placed in tabs or accordions, but there is no conversion or Search Console evidence yet that collapsing these sections would be a net gain. Preserve the current server-rendered content and revisit only as a measured experiment.
- **Workspace API latency:** the 12–17 second observation came from a cold local development run. Do not alter database or billing behavior from that signal alone. First compare production p50/p95 timings for `/api/wallet`, `/api/member-status`, `/api/user/exports/summary`, and `/api/jobs?limit=24&type=video`. If p95 exceeds 1 second outside cold starts, create a separate migration plan to remove request-time `ensureBillingSchema()` DDL from read paths.

---

### Task 1: Enforce one marketing `<main>` landmark

**Files:**
- Create: `tests/marketing-landmark-accessibility.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/about/_components/AboutView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForDetailView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkLabView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/blog/page.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/company/_components/CompanyTrustView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsIndexView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_components/EditorialStandardsView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-page-view.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx`

**Interfaces:**
- Consumes: the existing `<main className="flex-1">` in the localized marketing layout.
- Produces: exactly one main landmark per localized marketing document, with no changes to descendants, classes, IDs, content, or route behavior.

- [x] **Step 1: Write the failing landmark contract**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layoutPath = 'frontend/app/(localized)/[locale]/(marketing)/layout.tsx';
const childSurfacePaths = [
  'frontend/app/(localized)/[locale]/(marketing)/about/_components/AboutView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForDetailView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkLabView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/blog/page.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/company/_components/CompanyTrustView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsIndexView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_components/EditorialStandardsView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-page-view.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx',
] as const;

test('localized marketing layout owns the only main landmark', () => {
  const layoutSource = readFileSync(layoutPath, 'utf8');
  assert.equal((layoutSource.match(/<main\b/g) ?? []).length, 1);
  assert.equal((layoutSource.match(/<\/main>/g) ?? []).length, 1);

  for (const path of childSurfacePaths) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /<\/?main\b/, `${path} must render inside the layout main`);
  }
});
```

- [x] **Step 2: Run the contract and verify it fails**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/marketing-landmark-accessibility.test.ts
```

Expected: FAIL on the first child surface that still contains `<main>`.

- [x] **Step 3: Replace only nested landmark tag names**

In every listed child surface, preserve all props, classes, IDs, children, and branch conditions. Change only paired tag names:

```tsx
// Before
<main className="existing classes" id="existing-id">
  {children}
</main>

// After
<div className="existing classes" id="existing-id">
  {children}
</div>
```

`blog/page.tsx` has two mutually exclusive `<main>` branches; convert both pairs. Do not change the `<main>` in `marketing/layout.tsx`.

- [x] **Step 4: Run focused architecture and SEO checks**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/marketing-landmark-accessibility.test.ts \
  tests/pricing-page-architecture.test.ts \
  tests/examples-route-architecture.test.ts \
  tests/models-catalog-architecture.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/payg-page-architecture.test.ts \
  tests/home-seo-signals.test.ts \
  tests/hreflang-variants.test.ts \
  tests/premerge-seo-routes.test.ts
```

Expected: PASS with no content, metadata, or route contract changes.

- [x] **Step 5: Commit the landmark correction**

```bash
git add tests/marketing-landmark-accessibility.test.ts \
  'frontend/app/(localized)/[locale]/(marketing)'
git commit -m "fix: keep one main landmark on marketing pages"
```

---

### Task 2: Make pricing table scrollers keyboard-accessible

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingTableScrollRegion.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingVideoMatrixSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingPopularChecksSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingOtherSurfacesSection.tsx`
- Modify: `tests/pricing-page-architecture.test.ts`

**Interfaces:**
- Produces: `PricingTableScrollRegion({ children, className?, id?, labelledBy })`.
- Preserves: all tables, rows, anchors, prices, labels, links, and indexable text.

- [x] **Step 1: Add a failing pricing accessibility contract**

Append to `tests/pricing-page-architecture.test.ts`:

```ts
const tableScrollRegionPath = join(
  root,
  'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingTableScrollRegion.tsx'
);

test('pricing tables use labelled keyboard-focusable scroll regions', () => {
  assert.ok(existsSync(tableScrollRegionPath));
  const source = readFileSync(tableScrollRegionPath, 'utf8');

  assert.match(source, /role="region"/);
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /aria-labelledby=\{labelledBy\}/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(videoMatrixSource, /labelledBy="video-pricing-table-title"/);
  assert.match(popularChecksSource, /labelledBy="popular-pricing-checks-title"/);
  assert.match(otherSurfacesSource, /labelledBy="image-pricing-title"/);
  assert.match(otherSurfacesSource, /labelledBy="audio-pricing-title"/);
  assert.match(otherSurfacesSource, /labelledBy="tool-pricing-title"/);
});
```

- [x] **Step 2: Run the test and verify it fails**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-page-architecture.test.ts
```

Expected: FAIL because `PricingTableScrollRegion.tsx` does not exist.

- [x] **Step 3: Create the shared route-local wrapper**

```tsx
import type { ReactNode } from 'react';

type PricingTableScrollRegionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy: string;
};

export function PricingTableScrollRegion({
  children,
  className = '',
  id,
  labelledBy,
}: PricingTableScrollRegionProps) {
  return (
    <div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      tabIndex={0}
      className={`${className} overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg`}
    >
      {children}
    </div>
  );
}
```

- [x] **Step 4: Wire all five pricing tables without changing their content**

Add stable IDs to the existing headings:

```tsx
<h2 id="video-pricing-table-title">{copy.video.title}</h2>
<h2 id="popular-pricing-checks-title">{copy.popularChecks.title}</h2>
<h3 id="image-pricing-title">{copy.otherSurfaces.imageTitle}</h3>
<h3 id="audio-pricing-title">{copy.otherSurfaces.audioTitle}</h3>
<h3 id="tool-pricing-title">{copy.otherSurfaces.toolTitle}</h3>
```

Replace each direct `overflow-x-auto` table wrapper with the shared component. Preserve existing wrapper IDs and classes:

```tsx
<PricingTableScrollRegion
  id="full-video-pricing-table"
  labelledBy="video-pricing-table-title"
  className="order-2 scroll-mt-24 md:order-1"
>
```

Keep the current `<table className="min-w-[1460px] border-separate border-spacing-0 text-left text-sm">` and all of its descendants immediately after that opening tag, then replace the wrapper's current closing `</div>` with:

```tsx
</PricingTableScrollRegion>
```

Use the corresponding heading ID for the popular, image, audio, and tool tables. Do not add visible instructional copy.

- [x] **Step 5: Run pricing and public SEO tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/pricing-page-architecture.test.ts \
  tests/pricing-model-links.test.ts \
  tests/pricing-public-projection.test.ts \
  tests/pricing-canonical-kernel.test.ts \
  tests/hreflang-variants.test.ts
```

Expected: PASS; pricing rows, links, values, and localized URLs remain unchanged.

- [x] **Step 6: Commit the accessible scrollers**

```bash
git add \
  tests/pricing-page-architecture.test.ts \
  'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingTableScrollRegion.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingVideoMatrixSection.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingPopularChecksSection.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingOtherSurfacesSection.tsx'
git commit -m "fix: label keyboard-scrollable pricing tables"
```

---

### Task 3: Give homepage preview controls unique accessible names

**Files:**
- Modify: `frontend/components/marketing/home/HeroVideoShowcase.tsx`
- Modify: `tests/home-redesign-architecture.test.ts`

**Interfaces:**
- Preserves: playback state, pointer behavior, keyboard behavior, localization, layout, and all control dimensions.
- Produces: a selected-engine-aware label for the large overlay control.

- [ ] **Step 1: Add the failing source contract**

Add these declarations beside the existing homepage component paths and sources in `tests/home-redesign-architecture.test.ts`:

```ts
const heroVideoShowcasePath = join(root, 'frontend/components/marketing/home/HeroVideoShowcase.tsx');
const heroVideoShowcaseSource = readFileSync(heroVideoShowcasePath, 'utf8');
```

Then add the contract:

```ts
test('homepage hero overlay and toolbar expose distinct playback names', () => {
  assert.match(heroVideoShowcaseSource, /aria-label=\{`\$\{selected\.name\} — \$\{playLabel\}`\}/);
  assert.match(heroVideoShowcaseSource, /aria-label=\{isPlaying \? pauseLabel : playLabel\}/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/home-redesign-architecture.test.ts
```

Expected: FAIL because both paused controls currently use `playLabel`.

- [ ] **Step 3: Change only the overlay accessible name**

```tsx
aria-label={`${selected.name} — ${playLabel}`}
```

Replace only the current overlay line `aria-label={playLabel}` with the line above. Keep the toolbar `aria-label={isPlaying ? pauseLabel : playLabel}` and every `h-9 w-9`/`h-[72px] w-[72px]` class unchanged.

- [ ] **Step 4: Run homepage contracts**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/home-redesign-architecture.test.ts \
  tests/home-redesign-sections-architecture.test.ts \
  tests/home-route-architecture.test.ts \
  tests/home-seo-signals.test.ts
```

Expected: PASS with no visible-copy or SEO changes.

- [ ] **Step 5: Commit the label correction**

```bash
git add frontend/components/marketing/home/HeroVideoShowcase.tsx tests/home-redesign-architecture.test.ts
git commit -m "fix: distinguish homepage preview controls"
```

---

### Task 4: Consolidate Organization JSON-LD without losing fields

**Files:**
- Create: `frontend/lib/seo/site-organization-schema.ts`
- Modify: `frontend/app/_components/LocaleRuntime.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-jsonld.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx`
- Modify: `tests/home-seo-signals.test.ts`
- Modify: `tests/marketing-jsonld-schema-audit.test.ts`

**Interfaces:**
- Produces: `buildSiteOrganizationSchema()` as the single source of the Organization entity.
- Preserves: name variants, URL, logo, social profiles, and homepage description currently spread across the two entities.
- Changes intentionally: homepage emits one complete Organization root instead of two conflicting roots.

- [ ] **Step 1: Add failing JSON-LD ownership tests**

Add the runtime source beside the current homepage sources in `tests/home-seo-signals.test.ts`:

```ts
const localeRuntimeSource = readFileSync('frontend/app/_components/LocaleRuntime.tsx', 'utf8');
```

Replace the existing `homepage structured data keeps Organization schema alongside WebApplication schema` test with:

```ts
test('the locale runtime owns one canonical site organization entity', () => {
  assert.match(homeSource, /home-webapp-jsonld/);
  assert.match(localeRuntimeSource, /buildSiteOrganizationSchema/);
  assert.doesNotMatch(homeSource, /home-organization-jsonld/);
  assert.doesNotMatch(homeJsonLdSource, /buildOrganizationSchema/);
});
```

Update the schema audit import to:

```ts
import { buildSiteOrganizationSchema } from '../frontend/lib/seo/site-organization-schema.ts';
```

Include `buildSiteOrganizationSchema()` in the existing schema cases and assert:

```ts
const organization = buildSiteOrganizationSchema();
assert.equal(organization['@id'], 'https://maxvideoai.com/#organization');
assert.equal(organization.name, 'MaxVideoAI');
assert.equal(organization.alternateName, 'MaxVideo AI');
assert.ok(organization.sameAs.length >= 4);
```

- [ ] **Step 2: Run the SEO tests and verify they fail**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/home-seo-signals.test.ts \
  tests/marketing-jsonld-schema-audit.test.ts
```

Expected: FAIL because the homepage still emits a second Organization script and the shared builder does not exist.

- [ ] **Step 3: Create the canonical Organization builder**

```ts
import { SITE_ORIGIN } from '@/lib/siteOrigin';

export function buildSiteOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: 'MaxVideoAI',
    alternateName: 'MaxVideo AI',
    url: `${SITE_ORIGIN}/`,
    logo: `${SITE_ORIGIN}/favicon-512.png`,
    description:
      'Independent hub for AI video generation. Price before you generate. Works with Seedance, Kling, Veo, LTX, Wan, Pika, Sora and more.',
    sameAs: [
      'https://x.com/MaxVideoAI',
      'https://www.linkedin.com/company/maxvideoai/',
      'https://github.com/camgraphe/maxvideoai',
      'https://www.producthunt.com/products/maxvideoai',
    ],
  };
}
```

- [ ] **Step 4: Switch the runtime to the shared builder and remove only the duplicate homepage root**

In `LocaleRuntime.tsx`:

```tsx
import { buildSiteOrganizationSchema } from '@/lib/seo/site-organization-schema';

const orgSchema = buildSiteOrganizationSchema();
```

Remove the inline `orgSchema` object. In the homepage route and helper, remove `buildOrganizationSchema`, `organizationSchema`, and the `home-organization-jsonld` script. Do not touch WebSite, WebApplication, ItemList, FAQ, metadata, or visible homepage content.

- [ ] **Step 5: Run the complete structured-data and homepage SEO suite**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/home-seo-signals.test.ts \
  tests/marketing-jsonld-schema-audit.test.ts \
  tests/seo-signal-architecture.test.ts \
  tests/schema-sitemap-architecture.test.ts \
  tests/hreflang-variants.test.ts \
  tests/premerge-seo-routes.test.ts
```

Expected: PASS. The rendered homepage contains one Organization entity plus the unchanged WebSite, WebApplication, ItemList, and FAQ entities.

- [ ] **Step 6: Commit structured-data consolidation separately**

```bash
git add \
  frontend/lib/seo/site-organization-schema.ts \
  frontend/app/_components/LocaleRuntime.tsx \
  'frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-jsonld.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx' \
  tests/home-seo-signals.test.ts \
  tests/marketing-jsonld-schema-audit.test.ts
git commit -m "fix: consolidate site organization schema"
```

---

### Task 5: Align the Sharp native runtime with Next.js

**Files:**
- Create: `tests/sharp-runtime-version.test.ts`
- Modify: `frontend/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Preserves: the `sharp` package API used by upload normalization, reference normalization, and thumbnail generation.
- Produces: one Sharp/libvips native version in the workspace dependency graph.

- [ ] **Step 1: Add a failing dependency contract**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const frontendPackage = JSON.parse(readFileSync('frontend/package.json', 'utf8')) as {
  dependencies?: Record<string, string>;
};
const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');

test('frontend uses the same Sharp release as Next 15.5.18', () => {
  assert.equal(frontendPackage.dependencies?.sharp, '0.34.5');
  assert.doesNotMatch(lockfile, /^  sharp@0\.33\./m);
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/sharp-runtime-version.test.ts
```

Expected: FAIL because `frontend/package.json` declares `^0.33.5`.

- [ ] **Step 3: Align the dependency and refresh the lockfile**

Change only this dependency:

```json
"sharp": "0.34.5"
```

Then run:

```bash
pnpm install
```

- [ ] **Step 4: Verify the native dependency graph and image boundaries**

```bash
pnpm list -r sharp --depth 5
pnpm --prefix frontend exec node -e "const sharp=require('sharp'); console.log(sharp.versions.sharp)"
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/sharp-runtime-version.test.ts \
  tests/media-library-contract.test.ts \
  tests/image-generation-server-architecture.test.ts \
  tests/upscale-route-bundling.test.ts
```

Expected: dependency output and the Node smoke command report Sharp 0.34.5; all tests pass; no duplicate libvips warning appears when starting the app.

- [ ] **Step 5: Commit dependency alignment**

```bash
git add frontend/package.json pnpm-lock.yaml tests/sharp-runtime-version.test.ts
git commit -m "fix: align sharp native runtime"
```

---

### Task 6: Run final SEO and visual non-regression gates

**Files:**
- Modify only if a verification failure identifies a defect in Tasks 1–5.

**Interfaces:**
- Consumes: all preceding commits.
- Produces: buildable, localized pages with unchanged indexable content and metadata.

- [ ] **Step 1: Run focused contracts as one batch**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/marketing-landmark-accessibility.test.ts \
  tests/pricing-page-architecture.test.ts \
  tests/home-redesign-architecture.test.ts \
  tests/home-seo-signals.test.ts \
  tests/marketing-jsonld-schema-audit.test.ts \
  tests/hreflang-variants.test.ts \
  tests/premerge-seo-routes.test.ts \
  tests/sharp-runtime-version.test.ts
```

Expected: PASS with no failures.

- [ ] **Step 2: Run repository quality gates**

```bash
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run seo:check
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 3: Build the production application**

```bash
npm --prefix frontend run build
```

Expected: build and sitemap generation complete successfully, with no Sharp/libvips duplication warning.

- [ ] **Step 4: Smoke-test representative localized routes**

Test desktop and 390px mobile layouts for:

```text
/
/fr
/es
/pricing
/fr/tarifs
/es/precios
/models/seedance-2-0
/fr/modeles/seedance-2-0
/es/modelos/seedance-2-0
```

For every route, verify status 200, one `<main>`, one H1 where already expected, no unintended horizontal page overflow, and unchanged visible copy. For the pricing routes, verify that each table region receives keyboard focus and can scroll horizontally. For the homepage, verify hero playback and engine selection still work.

- [ ] **Step 5: Compare SEO output against the baseline**

Verify for each representative public route:

```text
canonical URL: unchanged
hreflang EN/FR/ES/x-default: unchanged
title and meta description: unchanged
robots directives: unchanged
visible headings and links: unchanged
JSON-LD: unchanged except homepage Organization roots decrease from two to one complete entity
```

- [ ] **Step 6: Final review checkpoint**

Do not proceed to page-length changes or database hot-path changes in this batch. Report production workspace timing separately after deployment; open a dedicated migration plan only if production p95 confirms the local latency signal.

## Expected Outcome

- Real gain: cleaner landmarks for assistive technology, keyboard-operable pricing matrices, unambiguous media controls, consistent Organization structured data, and one stable Sharp native runtime.
- SEO risk: low, because indexed text, page hierarchy, links, URLs, metadata, canonicals, hreflang, and pricing projections remain unchanged and are covered by existing contracts plus new focused tests.
- Deferred risk: no speculative page-content collapse and no database migration based only on cold local timings.
