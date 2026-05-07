# Refactor Roadmap

This roadmap turns large-file cleanup into small, testable PRs.

## Audit Command

Run the current large-file audit before choosing a refactor target:

```bash
npm run architecture:audit -- --min-lines 900
```

For scripts or Codex context, use JSON:

```bash
npm run architecture:audit -- --json --min-lines 900
```

The audit scans `frontend` source files, ignores build/generated folders, and sorts files by line count.

## Recently Completed

The first architecture cleanup wave has landed:

- Comparison detail page: split copy, helpers, overrides, types, and media/spec components.
- Admin insights page: split route-local types, helpers, and panels.
- Billing page: split route server wrapper, client orchestrator, wallet top-up panel, receipts panel, copy, types, helpers, Stripe Express Checkout, Turnstile, and analytics.

These areas now have contract tests:

```txt
tests/compare-page-architecture.test.ts
tests/admin-insights-architecture.test.ts
tests/billing-page-architecture.test.ts
```

## Current High-Signal Candidates

Snapshot from `npm run architecture:audit -- --min-lines 900` after the first cleanup wave:

| File | Lines | Recommended approach |
| --- | ---: | --- |
| `frontend/src/config/falEngines.ts` | 7677 | Split only with strong model-registry tests. High blast radius. |
| `frontend/src/components/tools/CharacterBuilderWorkspace.tsx` | 3962 | Split into tool-local hooks, panels, preview/runtime modules. |
| `frontend/app/api/generate/route.ts` | 3203 | Split request parsing, auth/preflight, provider dispatch, response projection. High blast radius. |
| `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx` | 1934 | Split catalog copy, filters, cards, and SEO-oriented sections. |
| `frontend/src/components/tools/AngleWorkspace.tsx` | 1833 | Split tool state, canvas/runtime, prompt form, examples/results panels. |
| `frontend/src/server/images/execute-image-generation.ts` | 1813 | Split validation, provider payloads, persistence, polling/projection. |
| `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/page.tsx` | 1609 | Split localized copy, ranking builders, schema helpers, route sections. |
| `frontend/app/(core)/(workspace)/app/image/ImageWorkspace.tsx` | 1660 | Continue route-local hook/component extraction with contract tests. |
| `frontend/app/(core)/(workspace)/app/audio/AudioWorkspace.tsx` | 1559 | Split audio form state, provider options, uploads, preview/progress surfaces. |
| `frontend/app/(core)/login/page.tsx` | 1135 | Low-risk next split: copy and auth/browser helpers first. |
| `frontend/app/(core)/admin/pricing/page.tsx` | 921 | Low-risk next split: types, helpers, and card components. |

Line counts change over time. Treat the table as a dated snapshot, not source of truth.

## Next Cleanup Sequence

Prefer this order unless product work changes the risk profile:

1. Login page helpers and copy.
2. Admin pricing cards/helpers.
3. Tool workspace split, starting with Angle or Character Builder.
4. Best-for usecase marketing page split.
5. API/generate split with broader regression coverage.
6. `falEngines.ts` registry split after a dedicated model-registry plan.

## Definition Of Done

A cleanup PR is complete when:

- behavior is unchanged
- the route or feature owner file is materially shorter
- extracted files have clear names and responsibilities
- a contract test guards the architectural boundary
- focused tests pass
- `npm --prefix frontend run lint`, `npm run lint:exposure`, `pnpm --prefix frontend exec tsc --noEmit --pretty false`, and `git diff --check` pass
- a full build passes before merge when the PR touches routes, app-level components, or provider logic
