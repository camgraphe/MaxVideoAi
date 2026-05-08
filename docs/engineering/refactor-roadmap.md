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
- Client workspace/billing/library routes: workspace route-form state hook, billing session/receipts/top-up quote hooks, and library SWR/mutation hooks.
- Admin audit/jobs routes: server pages now delegate filters, shortcut metrics, tables, and page views to route-local modules.
- Localized docs index route: server page now delegates docs fallback loading, TOC view-models, section rendering, library/feedback sections, and JSON-LD builders to route-local modules.

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

Snapshot from `npm run architecture:audit -- --min-lines 500` on 2026-05-08:

| File | Lines | Recommended approach |
| --- | ---: | --- |
| `frontend/src/config/falEngines.ts` | 7677 | Split only with strong model-registry tests. High blast radius. |
| `frontend/middleware.ts` | 983 | Split locale/auth/legal helpers only with redirect regression tests. |
| `frontend/src/lib/schema.ts` | 975 | Split schema builders by domain when touching SEO/schema work. |
| `frontend/src/lib/pricing.ts` | 969 | Split pricing helpers only with pricing acceptance coverage. |
| `frontend/lib/i18n/dictionaries.ts` | 958 | Split dictionary loading helpers carefully; localization blast radius. |
| `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-utils.ts` | 896 | Split catalog copy/filter/metadata helpers. |
| `frontend/app/api/jobs/route.ts` | 836 | Split handlers and query builders with API contract tests. |
| `frontend/components/groups/CompositePreviewDock.tsx` | 818 | Split preview rendering, status controls, and media actions. |
| `frontend/app/(core)/(workspace)/app/AppClient.tsx` | 743 | Continue with grouped composer/shell view-model extraction. |
| `frontend/app/(core)/billing/_components/BillingClient.tsx` | 525 | Continue with currency state, checkout session flow, and top-up selection hooks. |
| `frontend/app/(core)/(workspace)/app/library/_components/LibraryPageClient.tsx` | 445 | Optional follow-up: extract `AssetLibraryBrowser` prop assembly if the page grows again. |

Line counts change over time. Treat the table as a dated snapshot, not source of truth.

## Next Cleanup Sequence

Prefer this order unless product work changes the risk profile:

1. Workspace `AppClient.tsx`: grouped composer/shell view-model extraction without changing generation behavior.
2. Billing client: split currency state, checkout session flow, and top-up selection hooks.
3. Higher-blast-radius helpers (`middleware.ts`, `pricing.ts`, `schema.ts`, `falEngines.ts`) only after dedicated regression plans.

## Definition Of Done

A cleanup PR is complete when:

- behavior is unchanged
- the route or feature owner file is materially shorter
- extracted files have clear names and responsibilities
- a contract test guards the architectural boundary
- focused tests pass
- `npm --prefix frontend run lint`, `npm run lint:exposure`, `pnpm --prefix frontend exec tsc --noEmit --pretty false`, and `git diff --check` pass
- a full build passes before merge when the PR touches routes, app-level components, or provider logic
