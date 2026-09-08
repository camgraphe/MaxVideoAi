# Task 1 — Billing lifecycle completion

Implementation commit: `c453e604b` (`fix(billing): isolate account reads and defer checkout returns until auth`).

Starting brief base: `e38206609`; archived implementation and red checkpoint `4e62dd9b3` were already imported. Work was performed in the principal worktree on `codex/app-catalogue-validation`; root integrated unrelated work concurrently with a serialized Git window. Only the 13 Billing source/test files listed by the implementation commit were staged. No unrelated dirty file was included.

## Changes and self-review

- Added the route-local `useBillingRequestOwner` hook. Wallet, receipts, quotes and reconciliation store their exact owner alongside state. Render projections synchronously hide unmatched values, statuses, errors, cursors and derived receipt rows. Same-account refresh retains usable data, including after a non-destructive refresh failure.
- Owner identity changes on each committed account/input transition, so A→B→A cannot revive an old owner. Layout-effect ownership commits retire callbacks and requests before browser events/passive effects; render masking does not depend on cleanup. Identity creation does not mutate a shared ref during speculative rendering, so abandoned renders cannot disable the still-visible tree. Unmount invalidates the active owner and request scope.
- Refresh, pagination and CSV callbacks check owner validity before starting work. Responses check both owner validity and the existing monotonically increasing request token before publishing state, writing the wallet cache or reporting detected currency.
- Quote identity covers confirmed account, normalized charge currency, preset/custom amount collection, custom amount and validity. Duplicate amounts are sent once. Scalar effect inputs prevent equivalent recreated session objects from starting repeated requests. No quote arithmetic or pricing policy was added.
- Successful Checkout returns remain in the URL until auth is resolved with an account. BillingClient passes only a confirmed account into reconciliation. The existing immediate and 1800ms follow-up rounds, amount restoration, return destination, URL cleanup and analytics calls remain. Cancellation can resolve while auth is pending. A return still does not claim webhook settlement.
- Receipt document/support links now have 44px minimum height. Root's additional currency hydration finding is addressed by a disabled selected option for the current currency when the enabled-option list has not yet caught up. The select therefore cannot visually fall back to USD while an EUR quote is displayed.
- Architecture contracts now lock shared read-owner usage and confirmed-auth composition. Existing historical receipt fields, CSV formatting, hosted/express checkout owners, captcha/rate limits, custom USD minimum and commercial/canonical behavior were retained.

Self-review inspected the complete source diff, the new lifecycle helper, exact staged-file inventory, source ownership and all assertions. No remaining defect identified within this assignment's scope. Independent review and real-route visual qualification remain with root.

## Reproduced failures

All executable validation below used the sanitized launcher:

```sh
node .superpowers/artifacts/2026-09-07-connected-app-review/run-validation.cjs pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern='first render for a new account|successful Checkout return' tests/billing-account-ownership-render.test.ts tests/billing-auth-and-quote-render.test.ts
```

Before the fix: exit 1, **2 tests, 0 passed, 2 failed**. Actual first account-B render contained `balance: 123` and `descriptions: ['private-A-receipt']`; expected null/empty. The pending-auth return emitted `status, toast, amount, success, target, conversion`; expected no calls. The inherited quote test also supplied a fresh session object each render; scalar production dependencies remove the resulting repeated-request loop, and its unfinished module-global root fixture was replaced with a local test root.

## Final focused verification

```sh
node .superpowers/artifacts/2026-09-07-connected-app-review/run-validation.cjs pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/billing-account-ownership-render.test.ts tests/billing-auth-and-quote-render.test.ts tests/billing-request-scope.test.ts tests/billing-checkout-reconciliation.test.ts tests/billing-page-architecture.test.ts tests/billing-wallet-presentation.test.ts tests/billing-intent-integration.test.ts tests/billing-intent.test.ts tests/billing-rate-limit-message.test.ts tests/billing-topup-selection.test.ts tests/billing-utils.test.ts
```

Final output: exit 0, **42 tests, 42 passed, 0 failed, 0 cancelled, 0 skipped**, duration 1478.798041ms.

Coverage:

| Test file | Covered behavior |
| --- | --- |
| `billing-account-ownership-render.test.ts` | Every-render account switch masking; same-owner refresh and failure retention; superseded refresh results; pending auth with old session still supplied; account ABA; late pagination/reads; stale refresh/pagination/CSV callbacks; logout; unmount responses and callbacks. |
| `billing-auth-and-quote-render.test.ts` | Success URL retained for loading/null and loading/non-null auth; actual return/reconciliation hook composition; both bounded refresh rounds; exactly-once conversion/amount/destination; query/hash preservation; StrictMode; cancellation under pending auth; reconciliation callback ABA and pending-auth follow-up cancellation; first-render currency/custom/validity/account masking; late currency/account ABA responses; equivalent-session request de-duplication; logout quote rejection. |
| `billing-request-scope.test.ts` | Same-account request supersession, account switch, full invalidation. |
| `billing-checkout-reconciliation.test.ts` | Two ordered refresh rounds, invalidated follow-up, delayed status on final read failure. |
| `billing-page-architecture.test.ts` | Existing page/module boundaries plus shared owner/auth wiring. |
| `billing-wallet-presentation.test.ts` | Wallet/ledger/summary presentation, localized payment-versus-credit copy, current currency during option hydration, exact receipt-link 44px rule. |
| Remaining five Billing intent/selection/utility/rate-limit files | Existing URL return/amount behavior, custom minimum/precision, signs/formatting and rate-limit copy contracts. |

```sh
node .superpowers/artifacts/2026-09-07-connected-app-review/run-validation.cjs pnpm --dir frontend exec eslint 'app/(core)/billing/_hooks/useBillingRequestOwner.ts' 'app/(core)/billing/_hooks/useBillingSessionState.ts' 'app/(core)/billing/_hooks/useBillingReceipts.ts' 'app/(core)/billing/_hooks/useBillingTopupQuotes.ts' 'app/(core)/billing/_hooks/useBillingCheckoutReturnToast.ts' 'app/(core)/billing/_hooks/useBillingCheckoutReconciliation.ts' 'app/(core)/billing/_components/BillingClient.tsx' 'app/(core)/billing/_components/WalletTopupPanel.tsx'
```

Final output: exit 0; no diagnostics.

```sh
node .superpowers/artifacts/2026-09-07-connected-app-review/run-validation.cjs pnpm --dir frontend exec tsc --noEmit --incremental false
```

Final output: exit 0; no diagnostics. This uses the actual frontend tsconfig, as requested by root. An earlier root `pnpm exec tsc` attempt found no root executable; a temporary narrowed tsconfig then omitted project declarations and could not resolve root test types. Its diagnostics were configuration artifacts, **not established baseline defects**. The temporary config was removed; actual project configuration passed twice, including after the final helper revision.

```sh
git diff --check
git diff --cached --check
```

Both exited 0 with no output before the implementation commit.

## Limits and handoff

All hook requests and return-composition refreshes were local mocks. Presentation tests used local React/JSDOM markup. No full suite/build, remote/provider/payment call, payment submission, database access, secret change, push or deployment was performed by this worker. The frontend TypeScript check was explicitly requested by root after narrowed-config diagnostics.

Root owns desktop/mobile light/dark real `/billing` browser QA, independent re-review, combined validation and any integration outside Billing. Browser-reported currency hydration is covered by a rendered-control regression here; final live-route visual confirmation remains root's evidence.
