# Billing read latency — 8 September 2026

The Wallet's currency and receipt GETs still ran the global billing bootstrap in a fresh server runtime. Root observed 15–19 second responses during development compilation. Those observations are not a controlled comparison, and they are not browser Core Web Vitals.

Both GETs now read the initialized, migrated schema directly. Currency POST and all payment mutation owners are unchanged. A configured database error returns 503 instead of a successful empty receipt ledger or an apparent missing currency. Only this currency GET opts into strict errors in the shared helpers; their other callers retain their existing fallbacks. The intentional no-database local receipt response remains explicitly marked `mock: true`.

## Comparable measurement

The baseline route sources were captured at `eccf8da02` before the correction. Real GET handlers were bundled with only authentication replaced by a local fixture. Each measured call ran in a fresh Node23.9 process; module loading was outside the timer, first database connection and JSON response serialization inside. Stripe credentials were absent; the exact stored invoice/receipt fallback was exercised without a network request.

Both versions ran alternately against the same explicitly initialized disposable PostgreSQL database, fixture account and receipts, on warm local compute. The candidate used PostgreSQL read-only transactions. No inherited remote database, provider, payment, uploaded media or account data was used. The helper-owned external `profiles` table was explicitly created in the local fixture before application bootstrap.

| Route | Run | Baseline | Candidate |
| --- | ---: | ---: | ---: |
| Currency | 1 | 18.37 ms | 8.23 ms |
| Currency | 2 | 18.24 ms | 7.91 ms |
| Currency | 3 | 17.82 ms | 7.69 ms |
| Receipts | 1 | 18.33 ms | 8.18 ms |
| Receipts | 2 | 18.21 ms | 8.12 ms |
| Receipts | 3 | 19.42 ms | 9.55 ms |

Median server handler time was **18.24 → 7.91 ms** for currency and **18.33 → 8.18 ms** for receipts. Local socket timing deliberately excludes internet round trips and database wake, so it cannot predict the reduction on the remote preview or production. It verifies the removed initialization cost under comparable conditions; no CWV claim is made.

Measurement harness, captured bundles and raw samples are retained in the root qualification artifacts at `.superpowers/artifacts/2026-09-08-billing-read-latency/`. The sanitized command was:

```sh
node .superpowers/artifacts/2026-09-07-connected-app-review/run-validation.cjs pnpm exec tsx --tsconfig frontend/tsconfig.json .superpowers/artifacts/2026-09-08-billing-read-latency/benchmark.ts compare
```

## Behavior and limits

`tests/billing-read-routes-postgres.test.ts` executes the actual two handlers against disposable PostgreSQL. Its database wrapper records statements without replacing query execution. The candidate proves zero database work for unauthenticated reads, exactly two SELECTs for the currency/balance response, one SELECT per receipts page, original cents, account filtering, cursor behavior and stored invoice precedence. Missing tables prove explicit 503s; shared helper callers without strict mode retain their fallbacks. The local unconfigured contract is checked separately.

Before the correction, four subtests failed: unauthenticated receipts returned a mock200 on schema failure, currency attempted DDL, receipts returned an empty mock under read-only enforcement, and a missing currency table still produced200. After the correction all six test entries pass. Sixteen related read-route, wallet, Billing request-scope/formatting and Stripe-document checks pass. Targeted ESLint and diff whitespace checks pass. Currency POST's source is unchanged. The full frontend typecheck, lint and combined build are performed with the other active draft increment once its source is stable; this report does not claim a check over unfinished files.

The bound read route still resolves missing Stripe documents through its existing optional Stripe reader when configured. This change does not remove external invoice lookup latency or add a cache. The receipt response preserves all original payment values and document behavior.
