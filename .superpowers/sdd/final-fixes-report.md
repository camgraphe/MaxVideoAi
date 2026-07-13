# Final Pricing Admin Review Fixes

Date: 2026-07-13
Base reviewed head: `47489595`
Branch: `main`
Push: none

## Findings closed

1. Policy rollback fingerprints now bind `rollbackEventId` in server-owned projection state. A regression proves that a fingerprint previewed for event A cannot confirm event B when both events otherwise carry identical target and historical state.
2. Policy and Membership now use durable post-commit refresh recovery matching Billing Products: committed state is reported separately from refresh failure, stale selection/draft/preview state is removed, edits/preview/rollback/hydration remain locked behind a visible warning, manual refresh remains available, and only successful inventory plus history refresh clears the warning.
3. Policy renders the server-supplied operational context: representative supplier subtotals, billing/public canonical totals, effective source/specificity/rule ID, matched versioned and database rule state, last actor/timestamp, and read-only vendor routing. The new projection-status filter distinguishes quoted from unavailable server projections and performs no client pricing calculation.
4. Membership rejects normalized update no-ops with typed `invalid_payload` before a preview can be confirmed.
5. Membership has a non-mutating Playwright preview/cancel flow covering all three tiers, a strict timeout, inventory-scoped selectors, pending-preview locks, cancellation, and zero confirm requests.

## TDD evidence

- Policy rollback substitution regression: RED with “Missing expected rejection”; GREEN 25/25 policy-service tests.
- Policy/Membership recovery contracts: RED with missing `post_commit_refresh_failed`; GREEN 40/40 commercial architecture tests plus TypeScript.
- Policy operational context/status: RED in inspector, filter, and representative-surface assertions; GREEN 46/46 policy service/architecture tests.
- Membership normalized no-op: RED with “Missing expected rejection”; GREEN 15/15 membership service tests.
- Membership E2E contract: RED with missing flow; GREEN 21/21 commercial route architecture tests and Playwright discovery lists the new flow.

## Verification

- Focused pricing admin suites: 96/96 passed.
- `pnpm test:validate`: 2089/2089 passed.
- `pnpm --prefix frontend run lint`: passed.
- `pnpm lint:exposure`: passed.
- `pnpm --prefix frontend exec tsc --noEmit --pretty false`: passed.
- `pnpm architecture:audit --min-lines 500`: passed and reported current inventory.
- `pnpm pricing:baseline`: current, 178 rows.
- `pnpm pricing:public-baseline`: current, 492 rows.
- `pnpm pricing:audit`: 178 scenarios, 178 matches, 0 mismatches, 4 compatibility profiles.
- `pnpm --prefix frontend run build`: passed, including registry/catalog/roster checks and 713 static pages.
- `pnpm exec playwright test tests/e2e/admin-critical-flows.spec.ts --list`: passed; 7 flows discovered including Membership preview/cancel.
- `git diff --check`: passed.
- Pricing policy and both frozen fixtures are unchanged from `47489595`.
- Obsolete references remain absent except intentional guide/test guards and canonical membership target IDs.

No authenticated database write or push was performed.

## Residual review round — 2026-07-13

- Membership now rejects every normalized no-effect preview, including rollback whose immutable `previousState` already equals current tier state.
- Preview and confirmation both return typed `invalid_payload` before transaction, upsert, event insertion, cache invalidation, or path revalidation.
- The rollback event-ID substitution regression now uses a genuine historical change (`plus` discount 0.06 versus current 0.05), preserving fingerprint coverage without relying on a no-op preview.
- TDD evidence: the new rollback test was RED with “Missing expected rejection”, then GREEN at 16/16 Membership tests.
- Full verification after the residual fix: `pnpm test:validate` 2090/2090; lint, exposure, TypeScript, architecture audit and build passed; pricing baseline 178, public baseline 492, pricing audit 178/178 with 0 mismatches.
