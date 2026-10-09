# Comparison policy readers implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Remove repeated successful effective-policy reads within one comparison render while retaining exact current pricing and independent tariff transactions.

**Architecture:** Build one lazy scope in `buildCompareRouteData`. Use a lightweight contextual snapshot factory sharing the same successful-policy loader as the existing model reader. Feed that snapshot through the existing comparison scenario owner; never replace that owner's context with catalog-normalized `quoteModel` input. Keep existing scenario selection, output rendering, error fallback, concurrency and public timing ownership.

**Tech Stack:** Next.js 15, TypeScript, canonical public pricing, disposable PostgreSQL 17, node:test.

**Spec:** Root AGENTS.md; docs/engineering/pricing-engine.md; docs/engineering/core-web-vitals.md. User authorized prioritized CWV correction, Sol 6.1 xhigh implementation, root review and normal gated delivery. Diagnostic evidence: /Users/adrienmillot/.codex/artifacts/cwv-three-axes-2026-10-09/server/.

## Global Constraints

- Work only in /Users/adrienmillot/.codex/worktrees/cwv-audit-corrections/MaxVideoAi V2, branch codex/cwv-three-axes; baseline ec9976a56fae7e6c34fa7d2a67412b871b55ae04.
- No dependency installs, schema/production-data writes, pricing amounts/formulas, cache lifetimes, model policy, markup/SEO/localization changes, or cross-request caches.
- Root schedules every build/browser/PostgreSQL measurement to avoid CPU contention. Prepare tests first; request the slot before execution.
- Do not push/PR/merge/deploy or spawn subagents. Root owns independent review and release. Commit the bounded source, tests, relevant engineering documentation and this plan.
- SQL work reduction is not a measured LCP gain. Preserve every run and disclose machine/runtime, baseline and sample counts.

## Review Focus

- All price contexts, addons, membership, selected durations and resolutions retain byte-for-byte comparable canonical input/output.
- Each quote retains its own current/history tariff transaction; scoped policy must not cache tariff state, cells or complete quotes.
- Unavailable/rejected policy stays unavailable to affected concurrent work, later work in the same scope retries after a failed attempt, and later scopes read fresh policy. A shared transient attempt can make all six concurrent quotes unavailable where independent baseline reads could be mixed; document this intentional bounded consistency change, not strict transient-failure parity.
- Both pricing sides start with independent benchmark/spec/gallery reads; no added serial wait or eager policy I/O for empty/prelaunch cases.
- Real localized output and complete canonical snapshots remain equal for ordinary, partial and unavailable prices.

## Task 1: Share one comparison-render policy through contextual snapshot reads

**Root review ruling (2026-10-09):** The original mixed-factory import added nine
admission/coverage modules and 38,436 emitted CJS bytes in the real comparison
owner graph. The bounded loader extraction and contextual-only factory above
were authorized before commit. Preserve the mixed API and exact loader algorithm;
do not duplicate policy scoping or change model admission/tariff pricing.

**Files:**
- Modify `frontend/server/pricing/quote-public.ts` to expose `createScopedCurrentPublicSnapshot`; extract the unchanged lazy policy-success/retry loader into this lightweight owner or a focused `scoped-public-policy.ts` helper. Reuse it in `frontend/server/pricing/quote-public-model-scenario.ts` without changing its mixed-reader API or semantics.
- Modify `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-pricing-scenarios.ts` to accept a contextual snapshot seam without changing the existing optional quote callback semantics.
- Modify `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-route-data.ts` to construct and share the existing request-local reader.
- Extend relevant tests under `tests/compare-pricing-scenarios.test.ts`, `tests/compare-loading-performance.test.ts`; add `tests/compare-policy-postgres.test.ts` and a bounded helper only if needed for executing the real route owner.
- Update `docs/engineering/core-web-vitals.md` or the relevant pricing guide with ownership and measured limits.

**Interfaces:**
- Consume `createScopedCurrentPublicSnapshot()` from lightweight `frontend/server/pricing/quote-public.ts`, returning `(context: PricingContext) => Promise<PricingSnapshot>`. Model mixed readers reuse the exact same extracted lazy loader for both APIs; do not import model admission/coverage into the comparison route.
- Preserve `computeComparePricingPoints(engine, preferredDurationSec, quote?)` existing callers. Add an optional contextual reader after existing parameters, or export a small engine-bound adapter from the same owner; choose the least extra API surface and explain it.
- Supply `resolvePricingDisplay`'s existing quotePoints seam on both sides. One scope belongs to one `buildCompareRouteData` invocation, never module state or individual resolution.

- [ ] Read instructions and relevant current tests; record clean baseline. Add a regression invoking the real comparison owner with six admitted scenarios proving repeated successful policy reads currently occur; preserve a baseline execution using the default unscoped snapshot reader.
- [ ] Implement the bounded injection using the existing scoped reader. Preserve comparison `PricingContext` exactly, including variant pricing, t2v, member tier, video-input flags and audio addons. Keep error catches, exact amount checks and filtering unchanged.
- [ ] Verify with disposable PG17: a pair with three supported points per engine changes six policy SELECTs to one; six independent begin/state/selected/commit sequences remain. Compare complete snapshots, scenario inputs and localized EN/FR/ES outputs before/after, including zero-price valid behavior, partial unavailable data, policy failures, independent fresh scopes and a committed tariff update observed by a later quote without conflating policy consistency with tariff caching. Do not assert every pair has six quotes; record actual cardinalities.
- [ ] Run focused scenario, concurrency, scoped-reader and new PostgreSQL tests. Baseline tests establish unchanged outputs; changed regression must fail for the prior unscoped route. Run frontend lint, lint:exposure and git diff --check. Full required CI lanes remain mandatory before merge; do not run unrelated complete local suites repeatedly.
- [ ] Capture comparable owner measurements with same fixtures/environment in alternating baseline/candidate order, n>=3 each. Preserve counters and output parity. Use explicit imposed-latency fixtures only when labelled simulated; do not present owner timings as HTTP/LCP. Root handles browser/production route evidence separately unless delegated later.
- [ ] Verify the real esbuild route graph no longer adds the nine model admission/coverage modules discovered in the first candidate. Keep module count and output-size evidence distinct from Next production output or cold latency. Re-run model scoped-reader and model-page-policy PostgreSQL contracts after moving the shared loader.
- [ ] Self-review, commit and report DONE or DONE_WITH_CONCERNS. Report SHA, changed files, actual verification, raw evidence paths, limitations, and any unexpected semantics. Write `.superpowers/sdd/2026-10-09-compare-policy-readers/task-1-report.md` and stop for review.
