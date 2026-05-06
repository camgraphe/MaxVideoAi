# Refactor Roadmap

This roadmap turns the current large-page problem into small, testable work.

## Current Signals

The largest route files are:

| File | Lines | Risk |
| --- | ---: | --- |
| `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx` | 4936 | Very high maintainability risk. Server-side, but mixes route, SEO, pricing, schemas, and rendering. |
| `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx` | 3572 | Very high maintainability risk. Comparison logic and rendering are tightly coupled. |
| `frontend/app/(core)/dashboard/page.tsx` | 2284 | High client-side complexity. This should be split before adding dashboard behavior. |
| `frontend/app/(core)/admin/insights/page.tsx` | 1939 | High maintainability risk. Good candidate for extracting charts/tables/builders. |
| `frontend/app/(core)/billing/page.tsx` | 1597 | Client-side page; likely worth extracting panels and hooks. |

## Phase 1: Documentation and Guardrails

Goal: make the target structure explicit before large moves.

- Add `AGENTS.md`.
- Add `docs/engineering/project-structure.md`.
- Add `docs/engineering/page-architecture.md`.
- Add this roadmap.
- Link these guides from `README.md` and `CONTRIBUTING.md`.

Expected result: future work has a shared standard.

## Phase 2: Dashboard Split

Goal: reduce the largest client page without changing behavior.

Target files:

```txt
frontend/app/(core)/dashboard/
  page.tsx
  _components/
    CreateHero.tsx
    InProgressList.tsx
    RecentGrid.tsx
    InsightsPanel.tsx
    ToolsPanel.tsx
  _hooks/
    useDashboardSelections.ts
    useDashboardTemplates.ts
  _lib/
    dashboard-storage.ts
    dashboard-media.ts
    dashboard-formatters.ts
```

Order:

1. Move browser storage helpers into `_lib/dashboard-storage.ts`.
2. Move media/lightbox helper functions into `_lib/dashboard-media.ts`.
3. Move formatting helpers into `_lib/dashboard-formatters.ts`.
4. Move visual sections into `_components`.
5. Move selection/template state into hooks only after the helper extraction is stable.

Verification:

```bash
npm --prefix frontend run lint
```

Manual smoke test:

- open `/dashboard` or the route that maps to it
- confirm auth/loading state
- confirm create video/image actions
- confirm recent grid opens media lightbox
- confirm template/remix actions still route correctly

## Phase 3: Model Detail Page Split

Goal: turn the model detail page into route orchestration plus named builders/sections.

Target files:

```txt
frontend/app/(localized)/[locale]/(marketing)/models/[slug]/
  page.tsx
  _components/
    ModelHeroSection.tsx
    ModelSpecSections.tsx
    ModelPricingSection.tsx
    ModelExamplesSection.tsx
    ModelFaqSection.tsx
  _lib/
    model-page-data.ts
    model-page-pricing.ts
    model-page-specs.ts
    model-page-schema.ts
    model-page-links.ts
```

Order:

1. Move schema helpers.
2. Move pricing/spec helpers.
3. Move link/canonical helpers.
4. Move small rendering sections.
5. Move hero and examples only after props are stable.

Verification:

```bash
npm --prefix frontend run lint
```

Manual smoke test:

- `/models/veo-3-1`
- localized variants for French and Spanish
- legacy redirects such as `veo-3-1-first-last`
- JSON-LD script output
- canonical and hreflang output

## Phase 4: Comparison Detail Page Split

Goal: isolate comparison data preparation from comparison rendering.

Target files:

```txt
frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/
  page.tsx
  _components/
    CompareHero.tsx
    CompareScoreSummary.tsx
    CompareSpecTable.tsx
    CompareMediaShowdown.tsx
    CompareFaq.tsx
  _lib/
    compare-page-data.ts
    compare-page-schema.ts
    compare-page-specs.ts
    compare-page-routing.ts
```

Verification should cover canonical order, reversed slugs, excluded redirects, and localized copy.

## Phase 5: Admin Insights Split

Goal: keep the admin page server-driven while extracting chart/table surfaces.

Target files:

```txt
frontend/app/(core)/admin/insights/
  page.tsx
  _components/
    PrioritySignalPanel.tsx
    WindowPulseGrid.tsx
    ComparisonChart.tsx
    RevenueBoardTable.tsx
    HealthPanel.tsx
  _lib/
    insights-builders.ts
    insights-formatters.ts
```

Verification should cover range/focus search params and admin access behavior.

## Definition of Done

A refactor phase is complete when:

- behavior is unchanged
- route file is materially shorter
- extracted files have clear names and responsibilities
- lint passes
- manual smoke checks pass
- the roadmap is updated if the actual structure differs from this plan

