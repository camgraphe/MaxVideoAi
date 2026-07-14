# Admin Transactions Server Refactor Design

## Goal

Replace the 793-line `frontend/server/admin-transactions.ts` mixed-responsibility module with a thin stable facade and focused server modules, while preserving every current admin route, API response, ledger field, eligibility rule, amount, currency, and manual wallet operation.

The same delivery corrects the existing manual-refund transaction boundary so every eligibility read, refund receipt insert, and linked-job update uses one database connection and cannot partially commit.

## Evidence and Current Problem

The live architecture audit on 2026-07-14 reports `frontend/server/admin-transactions.ts` at 793 lines and identifies it as the next medium-risk server split.

The file currently owns five different responsibilities:

1. fetching and mapping the admin ledger;
2. resolving Supabase identities for ledger rows;
3. querying transaction anomaly summaries;
4. selecting, validating, and issuing manual wallet refunds through two historical paths;
5. issuing manual wallet top-ups.

The two refund paths duplicate receipt metadata, refund insertion, job-state updates, and transaction control. They cannot simply be collapsed into one eligibility rule because the receipt-based path was intentionally added to support historical charges whose job record is missing.

There is also a correctness defect in both refund implementations. They call the shared `query()` helper separately for `BEGIN`, reads/writes, and `COMMIT`. That helper checks out and releases a pool client for every call, so the statements are not guaranteed to run on the same connection. The apparent transaction therefore does not provide atomicity and can leave an idle pooled connection inside an open transaction.

## Scope

This refactor covers:

- the public `admin-transactions` server facade;
- ledger reads and mapping;
- transaction anomaly reads and mapping;
- manual refund selection, validation, locking, insertion, and linked-job update;
- manual top-up validation and insertion;
- shared number and currency normalization;
- dependency seams needed for deterministic write-command tests;
- architecture and behavior contracts for the new boundaries.

## Non-Goals

The refactor must not:

- change any displayed, quoted, stored, or charged price;
- change refund or top-up amounts;
- change accepted currencies or currency normalization;
- change the `/admin/transactions` UI or local search/filter behavior;
- change the request or response shape of any admin API route;
- rename or remove any current public export from `@/server/admin-transactions`;
- unify the two historical refund selectors into a new public API;
- change refund eligibility policy beyond making its execution atomic and concurrency-safe;
- change anomaly thresholds or time windows;
- redesign identity lookup, add pagination, or optimize Supabase concurrency in this batch;
- refactor unrelated admin, pricing, wallet, Stripe, or job modules.

No pricing configuration, catalog, policy, membership, billing-product, checkout, or Stripe file belongs in this change.

## Public Contract

`frontend/server/admin-transactions.ts` remains the only supported import surface for current consumers. It continues to export:

- `AdminTransactionRecord`;
- `TransactionAnomalies`;
- `fetchAdminTransactions`;
- `fetchTransactionAnomalies`;
- `issueManualWalletRefund`;
- `issueManualWalletRefundByReceipt`;
- `issueManualWalletTopUp`.

Current page and route imports remain unchanged. Error text used by route-level HTTP status classification remains unchanged.

The facade contains re-exports only, owns no SQL or environment checks, and stays at or below 25 lines.

## Chosen Architecture

```text
frontend/server/admin-transactions.ts
frontend/server/admin-transactions/
  types.ts
  normalizers.ts
  read-model.ts
  refunds.ts
  topups.ts
```

This is intentionally a small domain split rather than a generic repository/service/controller stack. Each operation has one owner and there are no compatibility wrappers beyond the existing public facade.

### `admin-transactions.ts`

Owns only stable public re-exports. It must not contain SQL, mapping, validation, environment access, or transaction control.

### `types.ts`

Owns public response DTOs and internal database row/context types shared by more than one focused module. Types used by only one module remain local to that module.

### `normalizers.ts`

Owns the two shared pure conversions:

- nullable database numbers or numeric strings to finite numbers with the current zero fallback;
- nullable currency values to uppercase currency codes with the current `USD` fallback.

It contains no database, environment, or application-service dependency.

### `read-model.ts`

Owns both read-only admin transaction projections:

- `fetchAdminTransactions` and its ledger SQL;
- ledger limit clamping, identity enrichment, and row mapping;
- `fetchTransactionAnomalies` and its three anomaly queries;
- anomaly result mapping.

The ledger query may stop selecting raw columns that are neither mapped nor used to determine refundability. The returned `AdminTransactionRecord` shape and every derived flag remain unchanged.

The pure ledger mapper is exported from this internal module for focused contract tests, but is not added to the public facade.

### `refunds.ts`

Owns both existing public refund commands and one shared refund-writing workflow.

It keeps two selector-specific resolvers because their current policies differ:

- the job selector requires an existing job with a user, the latest charge, no existing refund for the job, and `paid_wallet` payment status;
- the receipt selector requires a charge receipt with a user, rejects an existing refund linked either by job or original receipt metadata, validates a linked job when it has a non-null payment status, and continues to permit a charge whose job is missing or whose surviving job has a null payment status.

After selection, both paths use shared helpers for:

- trimmed optional note handling;
- admin audit metadata;
- pricing snapshot serialization;
- refund receipt insertion;
- optional linked-job status/message update;
- response shaping.

The module exposes a narrow dependency-injected command factory to internal tests. The public facade exports only the production commands created with `ensureBillingSchema` and `withDbTransaction`.

### `topups.ts`

Owns `issueManualWalletTopUp`, including current input validation, amount rounding, currency normalization, audit metadata, default description, receipt insertion, and response shaping.

The command remains a single SQL insert, which PostgreSQL already executes atomically. A narrow dependency seam permits deterministic tests without a live database. No surrounding multi-statement transaction is introduced.

## Ledger Behavior Preservation

The read-model refactor preserves:

- default limit `100`;
- limit clamping to `1...500`;
- empty results when `DATABASE_URL` is unavailable;
- the call to `ensureBillingSchema` before querying;
- newest-first receipt ordering;
- Supabase email lookup only when the service-role key is available;
- media URL normalization;
- all current job fields and refund flags;
- the legacy rule that a valid charge with a missing job record can still be refundable by receipt;
- all anomaly thresholds, grouping, sorting, limits, and output fields.

## Atomic Refund Flow

Both public refund commands preserve their current parameter validation, database-unavailable behavior, response shape, descriptions, metadata keys, and error messages.

After schema readiness, each command executes its database work through one `withDbTransaction` callback and one `QueryExecutor`:

1. resolve the selector-specific job or receipt context;
2. select and lock the target charge row with `FOR UPDATE`;
3. check for an existing refund after the lock is held;
4. validate the selector-specific payment and ownership rules;
5. insert the refund receipt with the existing amount, currency, description, pricing snapshot, vendor account, and audit metadata;
6. update the linked job when the current path requires it;
7. return the inserted receipt id and timestamp;
8. let `withDbTransaction` commit, roll back, and release the same client.

The charge-row lock serializes simultaneous refund attempts. A second attempt waits for the first transaction, then observes the newly committed refund and fails before inserting another receipt.

All refund paths acquire the charge lock before any write or linked-job update. This consistent ordering avoids introducing competing lock orders between the job-based and receipt-based entry points.

No refund module may call `query('BEGIN')`, `query('COMMIT')`, or `query('ROLLBACK')` directly.

## Error and Compatibility Behavior

The following externally observed behavior remains stable:

- missing or invalid selectors fail before mutation;
- missing jobs or charges retain their current selector-specific messages;
- charges without wallet users remain ineligible;
- already-refunded charges fail before insertion;
- non-wallet job payments remain ineligible;
- receipt-based fallback still supports charges without a surviving job row;
- manual refund metadata keeps `reason`, `admin_user_id`, `admin_email`, `original_receipt_id`, and optional `note`;
- manual top-up metadata keeps its current keys;
- completed jobs remain completed after refund;
- non-completed linked jobs keep the current failed/progress/message update behavior;
- any error after the transaction starts rolls back both the inserted receipt and job update.

The existing refund API route continues to try the job selector first and the receipt selector second when both identifiers are present. Its error precedence and HTTP status classification do not change.

## Architecture Contracts and TDD

Implementation begins with failing contracts.

### `tests/admin-transactions-architecture.test.ts`

The architecture contract requires:

- the five focused modules to exist;
- the facade to stay at or below 25 lines;
- the facade to export the current public API;
- the facade to contain no SQL, environment checks, normalizers, or refund logic;
- each focused module to remain below 350 lines;
- refund writes to use `withDbTransaction` and `QueryExecutor`;
- no manual `BEGIN`, `COMMIT`, or `ROLLBACK` calls in the transaction domain;
- routes and page consumers to continue importing from the facade.

### `tests/admin-transactions-contract.test.ts`

Pure mapping tests cover:

- numeric and currency normalization;
- ledger limit normalization;
- latest-charge detection;
- paid-wallet eligibility;
- already-refunded, missing-user, older-charge, and non-wallet rejection;
- the current orphan-job and missing-job refundability behavior;
- media URL and ledger DTO mapping;
- anomaly DTO mapping where helpers are extracted.

Fake-executor command tests cover:

- exactly one transaction per refund command;
- all command reads and writes using the transaction executor;
- the target charge being selected with `FOR UPDATE`;
- no insert when eligibility or duplicate checks fail;
- job-based metadata, description, receipt insert, and job update;
- receipt-based fallback with and without a linked job;
- existing-refund rejection after charge locking;
- transaction failure propagation without a successful result;
- top-up validation, normalization, metadata, insert parameters, and response shape.

The tests use no production database, Stripe account, Supabase mutation, real refund, or real top-up.

Each responsibility moves through a red-green cycle: add the failing boundary or behavior assertion, perform the smallest extraction or correction, then rerun the focused suite before continuing.

## Verification

Required checks after implementation:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-transactions-architecture.test.ts \
  tests/admin-transactions-contract.test.ts
pnpm run test:validate
pnpm --dir frontend exec tsc --noEmit --pretty false
pnpm --dir frontend run lint
pnpm run lint:exposure
git diff --check
npm run architecture:audit -- --min-lines 500
pnpm --dir frontend run build
```

The existing read-only admin smoke coverage for `/admin/transactions` remains applicable. Automated or manual smoke verification must not click refund or top-up actions against production data. If a browser environment with safe seeded admin data is available, it may verify page loading, search, filters, and refresh only.

The final diff must contain no pricing, billing-product, membership, checkout-price, Stripe-price, or product-catalog change.

## Risks and Mitigations

- **Historical orphan charges:** preserve the receipt selector as a distinct resolver and test it explicitly.
- **Error-message drift:** assert selector-specific messages used by the API route's status classification.
- **Double refund race:** lock the charge and perform the duplicate check inside one real transaction.
- **Partial receipt/job update:** execute both writes through the same transaction executor.
- **Over-fragmentation:** keep one read model, one refund owner, one top-up owner, one type module, and one pure normalizer module; do not add repository or controller layers.
- **Concurrent unrelated work on `main`:** stage and commit only files owned by this batch, preserving all unrelated worktree changes.

## Acceptance Criteria

- `frontend/server/admin-transactions.ts` is a re-export-only facade of at most 25 lines.
- No focused admin-transactions module exceeds 350 lines.
- Every current public export and consumer import remains valid.
- Ledger and anomaly response shapes and rules are unchanged.
- Both historical refund selectors retain their current eligibility behavior.
- Refund selection, duplicate detection, receipt insertion, and linked-job update run on one database connection inside one transaction.
- Concurrent attempts cannot insert two manual refunds for the same charge.
- Manual top-up behavior is unchanged.
- No price, amount, currency policy, route response, admin UI, or unrelated domain changes.
- Focused contracts, the complete test suite, TypeScript, lint, exposure checks, architecture audit, diff validation, and production build pass.
