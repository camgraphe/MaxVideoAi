# Refactor Roadmap

This roadmap turns large-file cleanup into testable local batches or PRs.

## Audit Command

Run the current large-file audit before choosing a refactor target:

```bash
npm run architecture:audit -- --min-lines 500
```

For scripts or Codex context, use JSON:

```bash
npm run architecture:audit -- --json --min-lines 500
```

The audit scans `frontend` source files, ignores build/generated folders, and sorts files by line count.

## Recently Completed

The architecture cleanup waves have landed across the main route categories:

- Workspace/app routes: shell, runtime modals, composer surface, generation runner, wallet preflight, assets/reference/Kling hooks, gallery/library contracts.
- Jobs routes: jobs page shell, controller hooks, route types, and SEO/video route controllers.
- Marketing/SEO routes: examples, blog posts, legal/marketing views, video watch pages, compare detail route modules.
- Admin routes: dashboard helpers, insights panels, SEO cockpit, SEO GSC, engines view model, users list, user detail, and video SEO inventory.
- Auth/login routes: login controller hooks and hydration/auth contracts.
- Generate/API routes: provider dispatch, validation payloads, billing preflight, final persistence/response, request options, and media helpers.
- Client workspace/billing/library routes: workspace app bootstrap, load-state, ready view, job refresh, and route-form hooks; billing session/receipts/top-up quote hooks; billing currency/top-up selection hooks; and library SWR/mutation hooks.
- Admin audit/jobs routes: server pages now delegate filters, shortcut metrics, tables, and page views to route-local modules.
- Localized docs index route: server page now delegates docs fallback loading, TOC view-models, section rendering, library/feedback sections, and JSON-LD builders to route-local modules.
- Storyboard workspace: `StoryboardWorkspace.tsx` is now 488 physical lines (489 by the live audit metric) and remains the workflow orchestrator. Focused owners now cover the builder UI (`StoryboardBuilderPanel.tsx`), reference state and uploads (`useStoryboardReferences.ts`), pricing estimates (`useStoryboardPricing.ts`), workspace configuration (`storyboard-workspace-config.ts`), and Kling first-frame persistence (`storyboard-kling-first-frame-storage.ts`).

Representative contract tests:

```txt
tests/compare-page-architecture.test.ts
tests/admin-insights-architecture.test.ts
tests/admin-user-detail-architecture.test.ts
tests/billing-page-architecture.test.ts
tests/jobs-page-architecture.test.ts
tests/blog-post-route-architecture.test.ts
tests/workspace-library-page-architecture.test.ts
tests/workspace-app-client-architecture.test.ts
tests/admin-audit-architecture.test.ts
tests/admin-jobs-audit-architecture.test.ts
tests/docs-index-route-architecture.test.ts
```

## Current High-Signal Candidates

Snapshot from `npm run architecture:audit -- --min-lines 500` on 2026-07-14:

| File | Lines | Risk and responsibility |
| --- | ---: | --- |
| `model-page-template-copy-additional.ts` | 6278 | content organization |
| `ModelDecisionPromptingSection.tsx` | 3114 | large marketing component |
| `compare-page-overrides-en.ts` | 2840 | localized content organization |
| `compare-page-overrides-es.ts` | 2757 | localized content organization |
| `compare-page-overrides-fr.ts` | 2757 | localized content organization |
| `model-page-template-copy.ts` | 1887 | content organization |
| `ModelExamplesSection.tsx` | 1589 | large marketing component |
| `pricingHubData.ts` | 1226 | pricing-sensitive configuration |
| `admin-transactions.ts` | 793 | next medium-risk server split |
| `pricingHubCopy.ts` | 737 | localized pricing content |
| `policy-service.ts` | 735 | server policy boundary |
| `StoryboardBuilderPanel.tsx` | 519 | focused Storyboard builder UI |

Line counts change over time. The audit command, not this dated table, is authoritative.

## Next Cleanup Sequence

Prefer this order unless product work changes the risk profile:

1. Treat `admin-transactions.ts` as the next medium-risk server split.
2. Approach pricing and pricing-admin work as price-sensitive: require dedicated price acceptance tests, and do not change live prices incidentally while moving configuration or policy boundaries.
3. Treat the large locale and model copy files as content-organization work rather than immediate runtime refactors.

## Definition Of Done

A cleanup PR is complete when:

- behavior is unchanged
- the route or feature owner file is materially shorter
- extracted files have clear names and responsibilities
- a contract test guards the architectural boundary
- focused tests pass
- `npm --prefix frontend run lint`, `npm run lint:exposure`, `pnpm --prefix frontend exec tsc --noEmit --pretty false`, and `git diff --check` pass
- a full build passes before merge when the PR touches routes, app-level components, or provider logic
