# Project Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MaxVideoAI codebase easier to understand, safer to modify, and guided by explicit architecture rules.

**Architecture:** Start with documentation guardrails, then split large files one responsibility at a time. Keep route files as orchestration layers and move rendering, builders, and browser-only behavior into focused files.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Tailwind CSS, Vercel, Neon Postgres, Supabase Auth, Fal.ai, Stripe.

---

## File Structure

- Create: `AGENTS.md` for repository-wide engineering instructions.
- Create: `docs/engineering/project-structure.md` for folder ownership and placement rules.
- Create: `docs/engineering/page-architecture.md` for Next.js page decomposition rules.
- Create: `docs/engineering/refactor-roadmap.md` for phased cleanup order.
- Modify: `README.md` to link the guide entry points.
- Modify: `CONTRIBUTING.md` to point contributors to architecture rules.

Future refactor phases should modify these areas:

- `frontend/app/(core)/dashboard/page.tsx`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx`
- `frontend/app/(core)/admin/insights/page.tsx`

### Task 1: Add Architecture Guides

**Files:**
- Create: `AGENTS.md`
- Create: `docs/engineering/project-structure.md`
- Create: `docs/engineering/page-architecture.md`
- Create: `docs/engineering/refactor-roadmap.md`

- [ ] **Step 1: Create repository guide**

Create `AGENTS.md` with sections for product shape, folder responsibilities, page file rules, component placement, server/client boundaries, refactor style, verification, and documentation.

- [ ] **Step 2: Create structure guide**

Create `docs/engineering/project-structure.md` with a table covering `frontend/app`, `frontend/components`, `frontend/lib`, `frontend/server`, `frontend/config`, `docs`, `neon/migrations`, and `supabase`.

- [ ] **Step 3: Create page architecture guide**

Create `docs/engineering/page-architecture.md` with server page, client page, data builder, section component, JSON-LD, and refactor checklist patterns.

- [ ] **Step 4: Create roadmap**

Create `docs/engineering/refactor-roadmap.md` with phases for docs, dashboard, model detail, comparison detail, and admin insights.

- [ ] **Step 5: Verify files exist**

Run:

```bash
test -f AGENTS.md
test -f docs/engineering/project-structure.md
test -f docs/engineering/page-architecture.md
test -f docs/engineering/refactor-roadmap.md
```

Expected: all commands exit with status `0`.

### Task 2: Link Guides From Entry Docs

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Update README**

Add an "Engineering Guides" section near the repository layout/licensing area with links to:

```markdown
- [`AGENTS.md`](AGENTS.md)
- [`docs/engineering/project-structure.md`](docs/engineering/project-structure.md)
- [`docs/engineering/page-architecture.md`](docs/engineering/page-architecture.md)
- [`docs/engineering/refactor-roadmap.md`](docs/engineering/refactor-roadmap.md)
```

- [ ] **Step 2: Update CONTRIBUTING**

Add a short "Architecture Guidelines" section instructing contributors to read `AGENTS.md` and the engineering guides before modifying large routes or client pages.

- [ ] **Step 3: Verify links**

Run:

```bash
rg -n "Engineering Guides|Architecture Guidelines|docs/engineering" README.md CONTRIBUTING.md AGENTS.md docs/engineering
```

Expected: the command prints the new guide links and headings.

### Task 3: Split Dashboard Page

**Files:**
- Modify: `frontend/app/(core)/dashboard/page.tsx`
- Create: `frontend/app/(core)/dashboard/_lib/dashboard-storage.ts`
- Create: `frontend/app/(core)/dashboard/_lib/dashboard-media.ts`
- Create: `frontend/app/(core)/dashboard/_lib/dashboard-formatters.ts`
- Create: `frontend/app/(core)/dashboard/_components/CreateHero.tsx`
- Create: `frontend/app/(core)/dashboard/_components/InProgressList.tsx`
- Create: `frontend/app/(core)/dashboard/_components/RecentGrid.tsx`
- Create: `frontend/app/(core)/dashboard/_components/InsightsPanel.tsx`
- Create: `frontend/app/(core)/dashboard/_components/ToolsPanel.tsx`

- [ ] **Step 1: Move storage helpers**

Move `readStoredForm`, `readStoredImageForm`, `persistVideoSelection`, `persistImageSelection`, `readTemplates`, and `writeTemplates` into `dashboard-storage.ts`.

- [ ] **Step 2: Run lint**

Run:

```bash
npm --prefix frontend run lint
```

Expected: PASS or existing unrelated lint failures documented before continuing.

- [ ] **Step 3: Move media helpers**

Move `resolveWorkspaceJobHref`, `resolveRemixEntryHref`, `buildEntriesFromJob`, `buildEntriesFromGroup`, and preview helper logic into `dashboard-media.ts`.

- [ ] **Step 4: Move formatters**

Move `formatDateTime`, `formatCurrencyLocal`, and `formatRunway` into `dashboard-formatters.ts`.

- [ ] **Step 5: Extract dashboard sections**

Move visual components one by one into `_components`, keeping props explicit and behavior unchanged.

- [ ] **Step 6: Verify dashboard manually**

Run the app and check dashboard loading, create actions, recent grid, lightbox, remix, template, and refresh actions.

### Task 4: Split Model Detail Page

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`
- Create route-local `_lib` helpers for schema, pricing, specs, links, and page data.
- Create route-local `_components` for hero, specs, pricing, examples, FAQ, and related sections.

- [ ] **Step 1: Move schema helpers**

Move product, offer, breadcrumb, FAQ, and JSON-LD builders into `_lib/model-page-schema.ts`.

- [ ] **Step 2: Move pricing/spec helpers**

Move price-per-second, marketing price points, spec row, and spec section builders into `_lib/model-page-pricing.ts` and `_lib/model-page-specs.ts`.

- [ ] **Step 3: Move link helpers**

Move canonical, localized path, compare path, and examples href helpers into `_lib/model-page-links.ts`.

- [ ] **Step 4: Extract rendering sections**

Move JSX sections into `_components`, starting with smaller sections before the hero.

- [ ] **Step 5: Verify public route behavior**

Check model page, localized variants, redirects, canonical output, hreflang output, and JSON-LD.

### Task 5: Split Comparison Detail Page

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx`
- Create route-local `_lib` helpers for routing, specs, data, and schemas.
- Create route-local `_components` for hero, score summary, spec table, media showdown, and FAQ.

- [ ] **Step 1: Extract routing and canonical helpers**

Move slug reversal, canonical compare slug, excluded redirect, and locale path helpers into `_lib/compare-page-routing.ts`.

- [ ] **Step 2: Extract data builders**

Move engine resolution, score loading, specs loading, and showdown hydration into `_lib/compare-page-data.ts`.

- [ ] **Step 3: Extract rendering sections**

Move comparison JSX into `_components` with explicit props.

- [ ] **Step 4: Verify route behavior**

Check normal compare pages, reversed order, excluded redirects, localized paths, metadata, and FAQ copy.

### Task 6: Split Admin Insights Page

**Files:**
- Modify: `frontend/app/(core)/admin/insights/page.tsx`
- Create: `frontend/app/(core)/admin/insights/_components/*`
- Create: `frontend/app/(core)/admin/insights/_lib/insights-builders.ts`
- Create: `frontend/app/(core)/admin/insights/_lib/insights-formatters.ts`

- [ ] **Step 1: Move formatters**

Move currency, percent, compact number, date, delta, and range description helpers into `_lib/insights-formatters.ts`.

- [ ] **Step 2: Move builders**

Move executive metrics, priority signals, revenue rows, pulse cards, quick insights, ledger rows, monthly rows, behavior stats, funnel steps, and focus metric data into `_lib/insights-builders.ts`.

- [ ] **Step 3: Move visual panels**

Move chart, tables, grid, panel, and empty state components into `_components`.

- [ ] **Step 4: Verify admin behavior**

Check admin authorization, `range`, `focus`, and `excludeAdmin` search params.

## Final Verification

Run:

```bash
npm --prefix frontend run lint
npm run lint:exposure
```

Expected: PASS, or any pre-existing unrelated failures documented with file paths and error summaries.

