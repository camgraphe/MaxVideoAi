# Three Large Architecture PRs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce three independent architecture PRs that continue reducing large MaxVideoAI route files without changing behavior.

**Architecture:** Each PR targets one large route area and extracts route-local `_lib` helpers and `_components` surfaces. Public SEO routes must preserve canonical URLs, localized paths, JSON-LD, redirects, and noindex rules. Client/admin routes must preserve auth, search params, loading states, and browser behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vercel, Supabase Auth, Neon Postgres.

---

## PR Sequence

1. `codex/compare-engine-page-split`
   - Target: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx`
   - Goal: extract compare page copy, routing, data builders, specs/pricing helpers, and focused rendering sections.
   - Required checks: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/compare-page-architecture.test.ts tests/nofollow.test.ts tests/seedance-prelaunch.test.ts`, `npm --prefix frontend run lint`, `npm run lint:exposure`.

2. `codex/admin-insights-page-split`
   - Target: `frontend/app/(core)/admin/insights/page.tsx`
   - Goal: extract admin insight formatters, data builders, panel/table components, and keep the page focused on auth + params + composition.
   - Required checks: targeted admin insights contract test, `npm --prefix frontend run lint`, `npm run lint:exposure`.

3. `codex/billing-page-split`
   - Target: `frontend/app/(core)/billing/page.tsx`
   - Goal: extract billing display helpers, panels, invoice/top-up surfaces, and keep checkout/account behavior unchanged.
   - Required checks: targeted billing tests, `npm --prefix frontend run lint`, `npm run lint:exposure`.

## PR 1 Detailed Steps

- [ ] Create `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-copy.ts` exporting `ComparePageCopy`.
- [ ] Create `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts` exporting localized page overrides and `getComparePageOverride`.
- [ ] Create `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-routing.ts` for canonical slug, reverse slug, excluded redirects, engine resolution, and generate href helpers.
- [ ] Create `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-data.ts` for score/spec file loading, pricing display, key spec values, showdown hydration, and related links.
- [ ] Create `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components` sections only after helper extraction compiles.
- [ ] Add a static contract test requiring route-local `_lib` and `_components` ownership and keeping `page.tsx` under the agreed threshold for this PR.
- [ ] Run targeted tests, lint, exposure check, and smoke representative localized compare pages before creating the PR.

## PR 2 Detailed Steps

- [ ] Create admin insights route-local `_lib/insights-formatters.ts`.
- [ ] Create admin insights route-local `_lib/insights-builders.ts`.
- [ ] Move repeated panels/tables into `frontend/app/(core)/admin/insights/_components`.
- [ ] Add or update an admin insights architecture contract test.
- [ ] Run targeted tests, lint, exposure check, and smoke `/admin/insights` search params.

## PR 3 Detailed Steps

- [ ] Create billing route-local `_lib` helpers for currency/date/status/top-up display.
- [ ] Move billing cards, balance surfaces, receipt tables, and account panels into route-local `_components`.
- [ ] Add or update billing architecture contract tests.
- [ ] Run targeted billing tests, lint, exposure check, and smoke `/billing`.
