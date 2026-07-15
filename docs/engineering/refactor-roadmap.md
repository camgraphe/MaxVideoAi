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
- Admin transactions: the public server module is a thin facade over focused read-model, top-up, refund, normalization, and type owners; manual refund writes remain transactionally serialized by job.
- Pricing policy administration: the public policy service is a thin facade over focused contract, dependency, deterministic rule, preview, confirmation, and read-model owners; preview fingerprints and transactional apply semantics remain unchanged.
- Localized comparison content: 47 per-slug JSON documents now own adjacent EN/FR/ES projections behind the unchanged route-facing loader; strict parity and validation contracts replace the three giant locale maps.

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

Snapshot from `npm run architecture:audit -- --min-lines 500` on 2026-07-15:

| File | Lines | Risk and responsibility |
| --- | ---: | --- |
| `model-page-template-copy-additional.ts` | 6278 | content organization |
| `ModelDecisionPromptingSection.tsx` | 3114 | large marketing component |
| `model-page-template-copy.ts` | 1887 | content organization |
| `ModelExamplesSection.tsx` | 1589 | large marketing component |
| `pricingHubData.ts` | 1226 | pricing-sensitive presentation data |
| `pricingHubCopy.ts` | 737 | localized pricing content |
| `PayAsYouGoPageView.tsx` | 708 | marketing page composition |
| `WorkspaceComposerSurface.tsx` | 692 | workspace composer UI |
| `frontend/app/api/generate/route.ts` | 690 | high-blast-radius generation orchestration |

Line counts change over time. The audit command, not this dated table, is authoritative.

## Next Cleanup Sequence

Prefer this order unless product work changes the risk profile:

1. Treat the pricing policy and admin transaction server boundaries as complete; do not add another layer without a concrete behavior or ownership problem.
2. Treat comparison content organization as complete; model decision copy remains the next independent content-organization project and requires its own parity and migration proof.
3. Approach pricing hub presentation data as price-sensitive and require the immutable pricing acceptance guards for any structural change.
4. Refactor generation routes, webhooks, polling, storage, or wallet APIs only through dedicated regression plans because they have higher runtime blast radius.

## Definition Of Done

A cleanup PR is complete when:

- behavior is unchanged
- the route or feature owner file is materially shorter
- extracted files have clear names and responsibilities
- a contract test guards the architectural boundary
- focused tests pass
- `npm --prefix frontend run lint`, `npm run lint:exposure`, `pnpm --prefix frontend exec tsc --noEmit --pretty false`, and `git diff --check` pass
- a full build passes before merge when the PR touches routes, app-level components, or provider logic
