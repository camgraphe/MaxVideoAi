# Admin Transactions Server Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 793-line admin transaction server module into focused owners and make manual refunds atomic and concurrency-safe without changing prices or public behavior.

**Architecture:** Keep `frontend/server/admin-transactions.ts` as a re-export-only public facade. Put DTOs, pure value helpers, read projections, refund commands, and top-up commands in one focused `frontend/server/admin-transactions/` domain folder; preserve both historical refund selectors while routing them through one locked transaction workflow.

**Tech Stack:** TypeScript, Next.js server modules, PostgreSQL via `pg`, `QueryExecutor`/`withDbTransaction`, Node test runner through `tsx`, ESLint.

## Global Constraints

- Work from the existing `main` worktree at `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/kling-image-dimension-validation`.
- Preserve unrelated concurrent Seedream and environment changes already present in the worktree; stage only files named by the current task.
- Keep every current public export from `@/server/admin-transactions` and every current consumer import unchanged.
- Do not change any displayed, quoted, stored, or charged price.
- Do not change refund or top-up amounts, currencies, anomaly thresholds, API shapes, admin UI, route behavior, or selector-specific error text.
- Preserve receipt-based refunds for charges whose job is missing and for surviving jobs whose payment status is null.
- Use one `withDbTransaction` callback and one `QueryExecutor` for every refund read and write after schema readiness.
- Lock the target charge with `FOR UPDATE` before duplicate-refund validation or mutation.
- Keep the public facade at or below 25 lines and each focused module below 350 lines.
- Do not add repository, controller, compatibility, pricing, Stripe, membership, billing-product, or catalog layers.
- Use `apply_patch` for source and test edits. Use focused red-green tests before each commit.

---

## File Map

### Create

- `frontend/server/admin-transactions/types.ts` — public DTOs plus shared command parameter/result and raw ledger row types.
- `frontend/server/admin-transactions/normalizers.ts` — number/currency normalization and the single paid-wallet predicate.
- `frontend/server/admin-transactions/read-model.ts` — ledger and anomaly reads, identity enrichment, and pure ledger mapping.
- `frontend/server/admin-transactions/topups.ts` — manual top-up command and its test dependency seam.
- `frontend/server/admin-transactions/refunds.ts` — both refund selectors, shared locked write flow, and its test dependency seam.
- `tests/admin-transactions-architecture.test.ts` — file ownership, facade, line cap, and transaction-boundary contracts.
- `tests/admin-transactions-contract.test.ts` — pure mapping and fake-database command contracts.

### Modify

- `frontend/server/admin-transactions.ts` — progressively remove moved responsibilities, ending as the stable facade.

### Must Not Modify

- `frontend/app/api/admin/transactions/route.ts`
- `frontend/app/api/admin/transactions/refund/route.ts`
- `frontend/app/api/admin/users/[userId]/wallet/route.ts`
- `frontend/app/(core)/admin/transactions/page.tsx`
- `frontend/components/admin/TransactionTable.tsx`
- every pricing, billing-product, membership, checkout-price, Stripe-price, and product-catalog file

---

### Task 1: Establish shared types and pure value contracts

**Files:**
- Create: `tests/admin-transactions-architecture.test.ts`
- Create: `tests/admin-transactions-contract.test.ts`
- Create: `frontend/server/admin-transactions/types.ts`
- Create: `frontend/server/admin-transactions/normalizers.ts`

**Interfaces:**
- Produces: `AdminTransactionRecord`, `TransactionAnomalies`, `RawTransactionRow`, `ManualWalletRefundParams`, `ManualWalletRefundByReceiptParams`, `ManualWalletTopUpParams`, `ManualRefundResult`, and `ManualWalletTopUpResult` from `types.ts`.
- Produces: `coerceNumber(value)`, `normalizeCurrency(value)`, and `isRefundablePaymentStatus(value)` from `normalizers.ts`.

- [ ] **Step 1: Write the failing architecture and normalizer tests**

Create `tests/admin-transactions-architecture.test.ts` with the first boundary:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const modulesDir = join(root, 'frontend/server/admin-transactions');

function readModule(name: string) {
  return readFileSync(join(modulesDir, name), 'utf8');
}

test('admin transaction shared contracts live in focused modules', () => {
  for (const name of ['types.ts', 'normalizers.ts']) {
    assert.ok(existsSync(join(modulesDir, name)), `${name} should exist`);
    assert.ok(readModule(name).split('\n').length <= 350, `${name} should stay below 350 lines`);
  }

  assert.match(readModule('types.ts'), /export type AdminTransactionRecord/);
  assert.match(readModule('types.ts'), /export type TransactionAnomalies/);
  assert.match(readModule('normalizers.ts'), /export function coerceNumber/);
  assert.match(readModule('normalizers.ts'), /export function normalizeCurrency/);
  assert.match(readModule('normalizers.ts'), /export function isRefundablePaymentStatus/);
});
```

Create `tests/admin-transactions-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coerceNumber,
  isRefundablePaymentStatus,
  normalizeCurrency,
} from '../frontend/server/admin-transactions/normalizers.ts';

test('admin transaction value helpers preserve legacy database fallbacks', () => {
  assert.equal(coerceNumber(125), 125);
  assert.equal(coerceNumber('250'), 250);
  assert.equal(coerceNumber('not-a-number'), 0);
  assert.equal(coerceNumber(null), 0);
  assert.equal(normalizeCurrency('eur'), 'EUR');
  assert.equal(normalizeCurrency(null), 'USD');
  assert.equal(isRefundablePaymentStatus('paid_wallet'), true);
  assert.equal(isRefundablePaymentStatus('refunded_wallet'), false);
  assert.equal(isRefundablePaymentStatus(null), false);
});
```

- [ ] **Step 2: Run the focused tests and confirm the expected red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-transactions-architecture.test.ts \
  tests/admin-transactions-contract.test.ts
```

Expected: FAIL because `frontend/server/admin-transactions/types.ts` and `normalizers.ts` do not exist.

- [ ] **Step 3: Add the shared types**

Create `frontend/server/admin-transactions/types.ts` with the current public DTO fields and narrow command types:

```ts
export type RawTransactionRow = {
  receipt_id: number;
  user_id: string | null;
  type: string;
  amount_cents: number | string | null;
  currency: string | null;
  description: string | null;
  job_id: string | null;
  created_at: string;
  job_status: string | null;
  job_payment_status: string | null;
  job_engine_label: string | null;
  job_video_url: string | null;
  job_thumb_url: string | null;
  job_message: string | null;
  job_progress: number | null;
  job_created_at: string | null;
  job_duration_sec: number | null;
  has_refund: boolean;
  latest_charge_id: number | null;
};

export type AdminTransactionRecord = {
  receiptId: number;
  userId: string | null;
  userEmail: string | null;
  type: 'topup' | 'charge' | 'refund' | 'discount' | 'tax';
  amountCents: number;
  currency: string;
  description: string | null;
  jobId: string | null;
  jobStatus: string | null;
  jobPaymentStatus: string | null;
  jobEngineLabel: string | null;
  jobVideoUrl: string | null;
  jobDurationSec: number | null;
  jobCreatedAt: string | null;
  jobProgress: number | null;
  jobMessage: string | null;
  createdAt: string;
  hasRefund: boolean;
  latestChargeId: number | null;
  isLatestCharge: boolean;
  canRefund: boolean;
};

export type TransactionAnomalies = {
  largeRefunds: Array<{
    receiptId: number;
    userId: string | null;
    amountCents: number;
    currency: string;
    jobId: string | null;
    createdAt: string;
    description: string | null;
  }>;
  frequentRefundUsers: Array<{
    userId: string | null;
    refundCount: number;
    totalCents: number;
    lastRefundAt: string | null;
  }>;
  invalidCharges: Array<{
    receiptId: number;
    userId: string | null;
    amountCents: number;
    jobId: string | null;
    createdAt: string;
    description: string | null;
  }>;
};

export type ManualWalletRefundParams = {
  jobId: string;
  adminUserId: string;
  adminEmail?: string | null;
  note?: string | null;
};

export type ManualWalletRefundByReceiptParams = {
  receiptId: number;
  adminUserId: string;
  adminEmail?: string | null;
  note?: string | null;
};

export type ManualRefundResult = { refundReceiptId: number; createdAt: string };

export type ManualWalletTopUpParams = {
  userId: string;
  amountCents: number;
  currency?: string | null;
  description?: string | null;
  adminUserId: string;
  adminEmail?: string | null;
  note?: string | null;
};

export type ManualWalletTopUpResult = {
  receiptId: number;
  createdAt: string;
  amountCents: number;
  currency: string;
};
```

- [ ] **Step 4: Add the pure value helpers**

Create `frontend/server/admin-transactions/normalizers.ts`:

```ts
export function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? 'USD').toUpperCase();
}

export function isRefundablePaymentStatus(value: string | null | undefined): boolean {
  return value === 'paid_wallet';
}
```

- [ ] **Step 5: Run focused tests and TypeScript**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-transactions-architecture.test.ts \
  tests/admin-transactions-contract.test.ts
pnpm --dir frontend exec tsc --noEmit --pretty false
```

Expected: both focused tests PASS; TypeScript PASS.

- [ ] **Step 6: Commit only Task 1 files**

```bash
git add \
  tests/admin-transactions-architecture.test.ts \
  tests/admin-transactions-contract.test.ts \
  frontend/server/admin-transactions/types.ts \
  frontend/server/admin-transactions/normalizers.ts
git diff --cached --check
git commit -m "test: define admin transaction contracts"
```

Expected: one commit containing only the four listed files.

---

### Task 2: Extract the ledger and anomaly read model

**Files:**
- Modify: `tests/admin-transactions-architecture.test.ts`
- Modify: `tests/admin-transactions-contract.test.ts`
- Create: `frontend/server/admin-transactions/read-model.ts`
- Modify: `frontend/server/admin-transactions.ts`

**Interfaces:**
- Consumes: `RawTransactionRow`, `AdminTransactionRecord`, `TransactionAnomalies`, and the three pure helpers from Task 1.
- Produces: `normalizeTransactionLimit(limit: number): number`, `mapAdminTransactionRow(row, userEmail): AdminTransactionRecord`, `fetchAdminTransactions(limit?): Promise<AdminTransactionRecord[]>`, and `fetchTransactionAnomalies(): Promise<TransactionAnomalies>`.

- [ ] **Step 1: Add failing read-model contracts**

Append to `tests/admin-transactions-architecture.test.ts`:

```ts
test('admin transaction reads have one focused owner', () => {
  const source = readModule('read-model.ts');
  assert.ok(source.split('\n').length <= 350, 'read-model.ts should stay below 350 lines');
  assert.match(source, /export function mapAdminTransactionRow/);
  assert.match(source, /export async function fetchAdminTransactions/);
  assert.match(source, /export async function fetchTransactionAnomalies/);
});
```

Append to `tests/admin-transactions-contract.test.ts`:

```ts
import { mapAdminTransactionRow, normalizeTransactionLimit } from '../frontend/server/admin-transactions/read-model.ts';
import type { RawTransactionRow } from '../frontend/server/admin-transactions/types.ts';

function rawTransaction(overrides: Partial<RawTransactionRow> = {}): RawTransactionRow {
  return {
    receipt_id: 10,
    user_id: 'user_1',
    type: 'charge',
    amount_cents: '900',
    currency: 'usd',
    description: 'Generation',
    job_id: 'job_1',
    created_at: '2026-07-14T10:00:00.000Z',
    job_status: 'completed',
    job_payment_status: 'paid_wallet',
    job_engine_label: 'Veo',
    job_video_url: 'renders/video.mp4',
    job_thumb_url: null,
    job_message: null,
    job_progress: 100,
    job_created_at: '2026-07-14T09:59:00.000Z',
    job_duration_sec: 8,
    has_refund: false,
    latest_charge_id: 10,
    ...overrides,
  };
}

test('ledger mapper preserves latest paid-wallet refund eligibility and DTO shape', () => {
  const record = mapAdminTransactionRow(rawTransaction(), 'member@example.com');
  assert.equal(record.userEmail, 'member@example.com');
  assert.equal(record.amountCents, 900);
  assert.equal(record.currency, 'USD');
  assert.equal(record.jobVideoUrl, '/renders/video.mp4');
  assert.equal(record.isLatestCharge, true);
  assert.equal(record.canRefund, true);
});

test('ledger mapper preserves rejection and historical missing-job behavior', () => {
  assert.equal(mapAdminTransactionRow(rawTransaction({ latest_charge_id: 9 }), null).canRefund, false);
  assert.equal(mapAdminTransactionRow(rawTransaction({ has_refund: true }), null).canRefund, false);
  assert.equal(mapAdminTransactionRow(rawTransaction({ user_id: null }), null).canRefund, false);
  assert.equal(mapAdminTransactionRow(rawTransaction({ job_payment_status: 'paid_stripe' }), null).canRefund, false);

  const missingJob = rawTransaction({
    job_status: null,
    job_payment_status: null,
    job_engine_label: null,
    job_video_url: null,
    job_thumb_url: null,
    latest_charge_id: null,
  });
  assert.equal(mapAdminTransactionRow(missingJob, null).canRefund, true);

  const orphanReceipt = rawTransaction({ job_id: null, latest_charge_id: null });
  assert.equal(mapAdminTransactionRow(orphanReceipt, null).canRefund, true);
});

test('ledger limit remains clamped to the public 1 through 500 range', () => {
  assert.equal(normalizeTransactionLimit(-1), 1);
  assert.equal(normalizeTransactionLimit(100), 100);
  assert.equal(normalizeTransactionLimit(900), 500);
});
```

- [ ] **Step 2: Run the focused suite and confirm it fails for the missing read model**

Run the two-test command from Task 1.

Expected: FAIL because `read-model.ts` does not exist.

- [ ] **Step 3: Create the read model with the pure mapper**

Create `frontend/server/admin-transactions/read-model.ts` with this complete content:

```ts
import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { ensureBillingSchema } from '@/lib/schema';
import { getUserIdentity } from '@/server/supabase-admin';
import { coerceNumber, isRefundablePaymentStatus, normalizeCurrency } from './normalizers';
import type { AdminTransactionRecord, RawTransactionRow, TransactionAnomalies } from './types';

const LARGE_REFUND_THRESHOLD_CENTS = 50_000;
const FREQUENT_REFUND_WINDOW_DAYS = 30;
const FREQUENT_REFUND_MIN_COUNT = 3;

export function normalizeTransactionLimit(limit: number): number {
  return Math.min(500, Math.max(1, limit));
}

export function mapAdminTransactionRow(
  row: RawTransactionRow,
  userEmail: string | null
): AdminTransactionRecord {
  const type = row.type as AdminTransactionRecord['type'];
  const jobExists = Boolean(
    row.job_status ||
      row.job_payment_status ||
      row.job_engine_label ||
      row.job_video_url ||
      row.job_thumb_url
  );
  const isLatestCharge =
    type === 'charge' &&
    (row.job_id ? (jobExists ? row.latest_charge_id === row.receipt_id : true) : true);
  const refundableStatus = row.job_id
    ? jobExists
      ? isRefundablePaymentStatus(row.job_payment_status)
      : true
    : true;

  return {
    receiptId: row.receipt_id,
    userId: row.user_id,
    userEmail,
    type,
    amountCents: coerceNumber(row.amount_cents),
    currency: normalizeCurrency(row.currency),
    description: row.description,
    jobId: row.job_id,
    jobStatus: row.job_status,
    jobPaymentStatus: row.job_payment_status,
    jobEngineLabel: row.job_engine_label,
    jobVideoUrl: row.job_video_url ? normalizeMediaUrl(row.job_video_url) ?? row.job_video_url : null,
    jobDurationSec: row.job_duration_sec ?? null,
    jobCreatedAt: row.job_created_at,
    jobProgress: row.job_progress ?? null,
    jobMessage: row.job_message,
    createdAt: row.created_at,
    hasRefund: row.has_refund,
    latestChargeId: row.latest_charge_id,
    isLatestCharge,
    canRefund:
      type === 'charge' &&
      !row.has_refund &&
      Boolean(row.user_id) &&
      isLatestCharge &&
      refundableStatus,
  };
}

export async function fetchAdminTransactions(limit = 100): Promise<AdminTransactionRecord[]> {
  if (!process.env.DATABASE_URL) return [];

  await ensureBillingSchema();
  const rows = await query<RawTransactionRow>(
    `SELECT
       r.id AS receipt_id,
       r.user_id,
       r.type,
       r.amount_cents,
       r.currency,
       r.description,
       r.job_id,
       r.created_at,
       j.status AS job_status,
       j.payment_status AS job_payment_status,
       j.engine_label AS job_engine_label,
       j.video_url AS job_video_url,
       j.thumb_url AS job_thumb_url,
       j.message AS job_message,
       j.progress AS job_progress,
       j.created_at AS job_created_at,
       j.duration_sec AS job_duration_sec,
       EXISTS (
         SELECT 1
         FROM app_receipts r2
         WHERE r2.type = 'refund'
           AND (
             (r.job_id IS NOT NULL AND r2.job_id = r.job_id)
             OR ((r2.metadata ->> 'original_receipt_id')::bigint = r.id)
           )
       ) AS has_refund,
       (
         SELECT id
         FROM app_receipts r3
         WHERE r3.job_id = r.job_id
           AND r3.type = 'charge'
         ORDER BY r3.created_at DESC
         LIMIT 1
       ) AS latest_charge_id
     FROM app_receipts r
     LEFT JOIN app_jobs j ON j.job_id = r.job_id
     ORDER BY r.created_at DESC
     LIMIT $1`,
    [normalizeTransactionLimit(limit)]
  );

  const uniqueUserIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
  );
  const userEmailMap = new Map<string, string | null>();
  if (uniqueUserIds.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const identity = await getUserIdentity(userId);
        userEmailMap.set(userId, identity?.email ?? null);
      })
    );
  }

  return rows.map((row) =>
    mapAdminTransactionRow(row, row.user_id ? userEmailMap.get(row.user_id) ?? null : null)
  );
}

export async function fetchTransactionAnomalies(): Promise<TransactionAnomalies> {
  if (!process.env.DATABASE_URL) {
    return { largeRefunds: [], frequentRefundUsers: [], invalidCharges: [] };
  }

  await ensureBillingSchema();
  const [largeRefundRows, frequentRefundRows, invalidChargeRows] = await Promise.all([
    query<{
      id: number;
      user_id: string | null;
      job_id: string | null;
      amount_cents: number | string | null;
      currency: string | null;
      description: string | null;
      created_at: string;
    }>(
      `SELECT id, user_id, job_id, amount_cents, currency, description, created_at
       FROM app_receipts
       WHERE type = 'refund'
         AND amount_cents >= $1
       ORDER BY amount_cents DESC
       LIMIT 10`,
      [LARGE_REFUND_THRESHOLD_CENTS]
    ),
    query<{
      user_id: string | null;
      refund_count: number | string | null;
      total_cents: number | string | null;
      last_refund_at: string | null;
    }>(
      `SELECT
         user_id,
         COUNT(*)::bigint AS refund_count,
         COALESCE(SUM(amount_cents), 0)::bigint AS total_cents,
         MAX(created_at) AS last_refund_at
       FROM app_receipts
       WHERE type = 'refund'
         AND created_at >= NOW() - INTERVAL '${FREQUENT_REFUND_WINDOW_DAYS} days'
       GROUP BY user_id
       HAVING COUNT(*) >= $1
       ORDER BY refund_count DESC, total_cents DESC
       LIMIT 10`,
      [FREQUENT_REFUND_MIN_COUNT]
    ),
    query<{
      id: number;
      user_id: string | null;
      job_id: string | null;
      amount_cents: number | string | null;
      created_at: string;
      description: string | null;
    }>(
      `SELECT id, user_id, job_id, amount_cents, created_at, description
       FROM app_receipts
       WHERE type = 'charge'
         AND amount_cents <= 0
       ORDER BY created_at DESC
       LIMIT 10`
    ),
  ]);

  return {
    largeRefunds: largeRefundRows.map((row) => ({
      receiptId: row.id,
      userId: row.user_id,
      amountCents: coerceNumber(row.amount_cents),
      currency: normalizeCurrency(row.currency),
      jobId: row.job_id,
      createdAt: row.created_at,
      description: row.description,
    })),
    frequentRefundUsers: frequentRefundRows.map((row) => ({
      userId: row.user_id,
      refundCount: coerceNumber(row.refund_count),
      totalCents: coerceNumber(row.total_cents),
      lastRefundAt: row.last_refund_at,
    })),
    invalidCharges: invalidChargeRows.map((row) => ({
      receiptId: row.id,
      userId: row.user_id,
      amountCents: coerceNumber(row.amount_cents),
      jobId: row.job_id,
      createdAt: row.created_at,
      description: row.description,
    })),
  };
}
```

- [ ] **Step 4: Delegate reads from the legacy facade without moving writes yet**

In `frontend/server/admin-transactions.ts`:

1. remove `RawTransactionRow`, `AdminTransactionRecord`, `TransactionAnomalies`, the anomaly constants, local normalizers, `fetchAdminTransactions`, and `fetchTransactionAnomalies`;
2. remove the now-unused `normalizeMediaUrl` and `getUserIdentity` imports;
3. keep `JobChargeContext` and all write functions temporarily;
4. add this exact header around the remaining write implementation:

```ts
import { query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { coerceNumber, normalizeCurrency } from './admin-transactions/normalizers';

export { fetchAdminTransactions, fetchTransactionAnomalies } from './admin-transactions/read-model';
export type { AdminTransactionRecord, TransactionAnomalies } from './admin-transactions/types';

const REFUNDABLE_PAYMENT_STATUSES = new Set(['paid_wallet']);
```

Do not alter any remaining refund/top-up SQL in this task.

- [ ] **Step 5: Run focused tests, typecheck, and the existing admin smoke test source contracts**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-transactions-architecture.test.ts \
  tests/admin-transactions-contract.test.ts \
  tests/admin-users-architecture.test.ts \
  tests/admin-user-detail-architecture.test.ts
pnpm --dir frontend exec tsc --noEmit --pretty false
```

Expected: all selected tests PASS; TypeScript PASS.

- [ ] **Step 6: Commit only the read-model extraction**

```bash
git add \
  frontend/server/admin-transactions.ts \
  frontend/server/admin-transactions/read-model.ts \
  tests/admin-transactions-architecture.test.ts \
  tests/admin-transactions-contract.test.ts
git diff --cached --check
git commit -m "refactor: extract admin transaction reads"
```

---

### Task 3: Extract and contract-test manual top-ups

**Files:**
- Modify: `tests/admin-transactions-architecture.test.ts`
- Modify: `tests/admin-transactions-contract.test.ts`
- Create: `frontend/server/admin-transactions/topups.ts`
- Modify: `frontend/server/admin-transactions.ts`

**Interfaces:**
- Consumes: `ManualWalletTopUpParams`, `ManualWalletTopUpResult`, `coerceNumber`, `normalizeCurrency`, `QueryExecutor`, `query`, and `ensureBillingSchema`.
- Produces: `AdminTopUpDependencies` and `issueManualWalletTopUp(params, dependencies?): Promise<ManualWalletTopUpResult>`.

- [ ] **Step 1: Add failing top-up ownership and command tests**

Append to the architecture test:

```ts
test('manual top-ups have one focused owner', () => {
  const source = readModule('topups.ts');
  assert.ok(source.split('\n').length <= 350, 'topups.ts should stay below 350 lines');
  assert.match(source, /export async function issueManualWalletTopUp/);
  assert.doesNotMatch(source, /\bBEGIN\b|\bCOMMIT\b|\bROLLBACK\b/);
});
```

Append imports and this test to the contract test:

```ts
import type { QueryExecutor } from '../frontend/src/lib/db.ts';
import { issueManualWalletTopUp } from '../frontend/server/admin-transactions/topups.ts';

test('manual top-up preserves validation, metadata, normalization, and response shape', async () => {
  const calls: Array<{ text: string; params?: ReadonlyArray<unknown> }> = [];
  const executor: QueryExecutor = {
    query: async <TRecord>(text: string, params?: ReadonlyArray<unknown>) => {
      calls.push({ text, params });
      return [{ id: 77, created_at: '2026-07-14T12:00:00.000Z', amount_cents: '1250', currency: 'eur' }] as TRecord[];
    },
  };
  let schemaCalls = 0;

  const result = await issueManualWalletTopUp(
    {
      userId: ' user_1 ',
      amountCents: 1249.7,
      currency: 'eur',
      description: null,
      adminUserId: 'admin_1',
      adminEmail: 'admin@example.com',
      note: ' goodwill ',
    },
    {
      databaseConfigured: () => true,
      ensureSchema: async () => { schemaCalls += 1; },
      executor,
      now: () => 'fallback-time',
    }
  );

  assert.equal(schemaCalls, 1);
  assert.deepEqual(result, {
    receiptId: 77,
    createdAt: '2026-07-14T12:00:00.000Z',
    amountCents: 1250,
    currency: 'EUR',
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.text, /INSERT INTO app_receipts/);
  assert.equal(calls[0]!.params?.[0], 'user_1');
  assert.equal(calls[0]!.params?.[1], 1250);
  assert.equal(calls[0]!.params?.[2], 'EUR');
  assert.match(String(calls[0]!.params?.[3]), /Manual wallet credit issued by admin@example\.com/);
  assert.deepEqual(JSON.parse(String(calls[0]!.params?.[4])), {
    reason: 'manual_admin_topup',
    admin_user_id: 'admin_1',
    admin_email: 'admin@example.com',
    note: 'goodwill',
  });
});

test('manual top-up rejects unavailable database and invalid values before SQL', async () => {
  const executor: QueryExecutor = { query: async () => { throw new Error('must not query'); } };
  const base = {
    ensureSchema: async () => undefined,
    executor,
    now: () => 'fallback-time',
  };
  await assert.rejects(
    issueManualWalletTopUp(
      { userId: 'user', amountCents: 100, adminUserId: 'admin' },
      { ...base, databaseConfigured: () => false }
    ),
    /Database unavailable/
  );
  await assert.rejects(
    issueManualWalletTopUp(
      { userId: ' ', amountCents: 100, adminUserId: 'admin' },
      { ...base, databaseConfigured: () => true }
    ),
    /Missing userId/
  );
  await assert.rejects(
    issueManualWalletTopUp(
      { userId: 'user', amountCents: 0, adminUserId: 'admin' },
      { ...base, databaseConfigured: () => true }
    ),
    /Invalid amountCents/
  );
});
```

- [ ] **Step 2: Run focused tests and confirm `topups.ts` is missing**

Run the two-test command from Task 1.

Expected: FAIL because `topups.ts` does not exist.

- [ ] **Step 3: Implement the focused top-up command**

Create `frontend/server/admin-transactions/topups.ts` by moving the current function and adding this dependency boundary:

```ts
import { query, type QueryExecutor } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { coerceNumber, normalizeCurrency } from './normalizers';
import type { ManualWalletTopUpParams, ManualWalletTopUpResult } from './types';

export type AdminTopUpDependencies = {
  databaseConfigured(): boolean;
  ensureSchema(): Promise<void>;
  executor: QueryExecutor;
  now(): string;
};

const DEFAULT_DEPENDENCIES: AdminTopUpDependencies = {
  databaseConfigured: () => Boolean(process.env.DATABASE_URL),
  ensureSchema: ensureBillingSchema,
  executor: { query },
  now: () => new Date().toISOString(),
};

export async function issueManualWalletTopUp(
  params: ManualWalletTopUpParams,
  dependencies: AdminTopUpDependencies = DEFAULT_DEPENDENCIES
): Promise<ManualWalletTopUpResult> {
  if (!dependencies.databaseConfigured()) throw new Error('Database unavailable');

  const targetUserId = params.userId.trim();
  if (!targetUserId) throw new Error('Missing userId');

  const normalizedAmount = Math.round(Number(params.amountCents ?? 0));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('Invalid amountCents');
  }

  await dependencies.ensureSchema();
  const currency = normalizeCurrency(params.currency ?? 'USD');
  const metadata: Record<string, unknown> = {
    reason: 'manual_admin_topup',
    admin_user_id: params.adminUserId,
    admin_email: params.adminEmail ?? null,
  };
  if (params.note && params.note.trim().length) metadata.note = params.note.trim();

  const description = params.description && params.description.trim().length
    ? params.description.trim()
    : `Manual wallet credit issued by ${params.adminEmail ?? params.adminUserId}`;

  const inserted = await dependencies.executor.query<{
    id: number;
    created_at: string;
    amount_cents: number | string | null;
    currency: string | null;
  }>(
    `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, metadata)
     VALUES ($1, 'topup', $2, $3, $4, $5::jsonb)
     RETURNING id, created_at, amount_cents, currency`,
    [targetUserId, normalizedAmount, currency, description, JSON.stringify(metadata)]
  );
  const row = inserted.at(0);
  return {
    receiptId: row?.id ?? 0,
    createdAt: row?.created_at ?? dependencies.now(),
    amountCents: coerceNumber(row?.amount_cents ?? normalizedAmount),
    currency: normalizeCurrency(row?.currency ?? currency),
  };
}
```

- [ ] **Step 4: Remove the old top-up body and delegate from the facade**

Delete the old `issueManualWalletTopUp` implementation from `frontend/server/admin-transactions.ts` and add:

```ts
export { issueManualWalletTopUp } from './admin-transactions/topups';
```

Do not change either refund implementation in this task.

- [ ] **Step 5: Run focused tests and TypeScript**

Run the Task 2 focused command.

Expected: all selected tests PASS; TypeScript PASS.

- [ ] **Step 6: Commit only the top-up extraction**

```bash
git add \
  frontend/server/admin-transactions.ts \
  frontend/server/admin-transactions/topups.ts \
  tests/admin-transactions-architecture.test.ts \
  tests/admin-transactions-contract.test.ts
git diff --cached --check
git commit -m "refactor: extract admin wallet topups"
```

---

### Task 4: Replace duplicated refund writes with one locked transaction workflow

**Files:**
- Modify: `tests/admin-transactions-architecture.test.ts`
- Modify: `tests/admin-transactions-contract.test.ts`
- Create: `frontend/server/admin-transactions/refunds.ts`
- Modify: `frontend/server/admin-transactions.ts`

**Interfaces:**
- Consumes: `QueryExecutor`, `withDbTransaction`, shared normalizers, refund parameter/result types, and `ensureBillingSchema`.
- Produces: `AdminRefundDependencies`, `issueManualWalletRefund(params, dependencies?)`, and `issueManualWalletRefundByReceipt(params, dependencies?)`.

- [ ] **Step 1: Add the failing facade and transaction architecture contract**

Append to the architecture test:

```ts
test('refund commands use one focused real transaction owner', () => {
  const source = readModule('refunds.ts');
  assert.ok(source.split('\n').length <= 350, 'refunds.ts should stay below 350 lines');
  assert.match(source, /withDbTransaction/);
  assert.match(source, /QueryExecutor/);
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /export async function issueManualWalletRefund/);
  assert.match(source, /export async function issueManualWalletRefundByReceipt/);
  assert.doesNotMatch(source, /query\(['"]BEGIN|query\(['"]COMMIT|query\(['"]ROLLBACK/);
});

test('admin transactions public module is a thin stable facade', () => {
  const facadePath = join(root, 'frontend/server/admin-transactions.ts');
  const source = readFileSync(facadePath, 'utf8');
  assert.ok(source.split('\n').length <= 25, 'admin-transactions.ts should stay below 25 lines');
  for (const publicName of [
    'fetchAdminTransactions',
    'fetchTransactionAnomalies',
    'issueManualWalletRefund',
    'issueManualWalletRefundByReceipt',
    'issueManualWalletTopUp',
    'AdminTransactionRecord',
    'TransactionAnomalies',
  ]) {
    assert.match(source, new RegExp(publicName));
  }
  assert.doesNotMatch(source, /SELECT|INSERT|UPDATE|DATABASE_URL|coerceNumber|normalizeCurrency/);
});
```

- [ ] **Step 2: Add fake-executor refund behavior tests**

Append these helpers and tests to `tests/admin-transactions-contract.test.ts`:

```ts
import {
  issueManualWalletRefund,
  issueManualWalletRefundByReceipt,
  type AdminRefundDependencies,
} from '../frontend/server/admin-transactions/refunds.ts';

type SqlCall = { text: string; params?: ReadonlyArray<unknown> };

function refundHarness(responses: Array<unknown[] | Error>) {
  const calls: SqlCall[] = [];
  let transactions = 0;
  let rollbacks = 0;
  const executor: QueryExecutor = {
    query: async <TRecord>(text: string, params?: ReadonlyArray<unknown>) => {
      calls.push({ text, params });
      const response = responses.shift() ?? [];
      if (response instanceof Error) throw response;
      return response as TRecord[];
    },
  };
  const dependencies: AdminRefundDependencies = {
    databaseConfigured: () => true,
    ensureSchema: async () => undefined,
    withTransaction: async (callback) => {
      transactions += 1;
      try {
        return await callback(executor);
      } catch (error) {
        rollbacks += 1;
        throw error;
      }
    },
    now: () => 'fallback-time',
  };
  return {
    calls,
    dependencies,
    transactionCount: () => transactions,
    rollbackCount: () => rollbacks,
  };
}

test('job refund locks the latest charge and performs every write in one transaction', async () => {
  const harness = refundHarness([
    [{ job_id: 'job_1', user_id: 'user_1', payment_status: 'paid_wallet', pricing_snapshot: { total: 900 }, vendor_account_id: 'vendor', message: null, engine_label: 'Veo', duration_sec: 8, currency: 'usd' }],
    [{ id: 10, amount_cents: '900', currency: 'usd', description: 'Generation' }],
    [],
    [{ id: 20, created_at: '2026-07-14T12:00:00.000Z' }],
    [],
  ]);

  const result = await issueManualWalletRefund(
    { jobId: ' job_1 ', adminUserId: 'admin_1', adminEmail: 'admin@example.com', note: ' support ' },
    harness.dependencies
  );

  assert.deepEqual(result, { refundReceiptId: 20, createdAt: '2026-07-14T12:00:00.000Z' });
  assert.equal(harness.transactionCount(), 1);
  assert.equal(harness.calls.length, 5);
  assert.match(harness.calls[1]!.text, /FOR UPDATE/);
  assert.match(harness.calls[2]!.text, /type = 'refund'/);
  assert.match(harness.calls[3]!.text, /INSERT INTO app_receipts/);
  assert.match(harness.calls[4]!.text, /UPDATE app_jobs/);
  const metadata = JSON.parse(String(harness.calls[3]!.params?.[7]));
  assert.deepEqual(metadata, {
    reason: 'manual_admin_refund',
    admin_user_id: 'admin_1',
    admin_email: 'admin@example.com',
    original_receipt_id: 10,
    note: 'support',
  });
});

test('receipt refund preserves orphan-charge fallback and skips job update', async () => {
  const harness = refundHarness([
    [{ id: 30, user_id: 'user_2', job_id: null, amount_cents: 500, currency: null, description: null, vendor_account_id: null, pricing_snapshot: null }],
    [],
    [{ id: 31, created_at: '2026-07-14T13:00:00.000Z' }],
  ]);

  const result = await issueManualWalletRefundByReceipt(
    { receiptId: 30, adminUserId: 'admin_1' },
    harness.dependencies
  );

  assert.deepEqual(result, { refundReceiptId: 31, createdAt: '2026-07-14T13:00:00.000Z' });
  assert.equal(harness.transactionCount(), 1);
  assert.equal(harness.calls.length, 3);
  assert.match(harness.calls[0]!.text, /FOR UPDATE/);
  assert.match(harness.calls[2]!.text, /INSERT INTO app_receipts/);
  assert.equal(harness.calls.some((call) => /UPDATE app_jobs/.test(call.text)), false);
  assert.equal(harness.calls[2]!.params?.[3], 'Manual refund for receipt 30');
});

test('duplicate refund is rejected after the charge lock and before insert', async () => {
  const harness = refundHarness([
    [{ job_id: 'job_1', user_id: 'user_1', payment_status: 'paid_wallet', pricing_snapshot: null, vendor_account_id: null, message: null, engine_label: null, duration_sec: null, currency: 'USD' }],
    [{ id: 10, amount_cents: 900, currency: 'USD', description: null }],
    [{ id: 99 }],
  ]);

  await assert.rejects(
    issueManualWalletRefund({ jobId: 'job_1', adminUserId: 'admin_1' }, harness.dependencies),
    /Job or wallet charge not found, or refund already issued\./
  );
  assert.match(harness.calls[1]!.text, /FOR UPDATE/);
  assert.equal(harness.calls.some((call) => /INSERT INTO app_receipts/.test(call.text)), false);
});

test('receipt selector preserves null-status acceptance and non-wallet rejection', async () => {
  const nullable = refundHarness([
    [{ id: 40, user_id: 'user', job_id: 'job', amount_cents: 100, currency: 'USD', description: null, vendor_account_id: null, pricing_snapshot: null }],
    [],
    [{ payment_status: null }],
    [{ id: 41, created_at: 'created' }],
    [],
  ]);
  await issueManualWalletRefundByReceipt(
    { receiptId: 40, adminUserId: 'admin' },
    nullable.dependencies
  );

  const nonWallet = refundHarness([
    [{ id: 40, user_id: 'user', job_id: 'job', amount_cents: 100, currency: 'USD', description: null, vendor_account_id: null, pricing_snapshot: null }],
    [],
    [{ payment_status: 'paid_stripe' }],
  ]);
  await assert.rejects(
    issueManualWalletRefundByReceipt(
      { receiptId: 40, adminUserId: 'admin' },
      nonWallet.dependencies
    ),
    /This charge is not a wallet payment or has already been refunded\./
  );
});

test('refund write failure propagates through the transaction without updating the job', async () => {
  const harness = refundHarness([
    [{ job_id: 'job_1', user_id: 'user_1', payment_status: 'paid_wallet', pricing_snapshot: null, vendor_account_id: null, message: null, engine_label: null, duration_sec: null, currency: 'USD' }],
    [{ id: 10, amount_cents: 900, currency: 'USD', description: null }],
    [],
    new Error('insert failed'),
  ]);

  await assert.rejects(
    issueManualWalletRefund({ jobId: 'job_1', adminUserId: 'admin_1' }, harness.dependencies),
    /insert failed/
  );
  assert.equal(harness.transactionCount(), 1);
  assert.equal(harness.rollbackCount(), 1);
  assert.equal(harness.calls.some((call) => /UPDATE app_jobs/.test(call.text)), false);
});
```

- [ ] **Step 3: Run focused tests and confirm the missing refund module/facade failures**

Run the two-test command from Task 1.

Expected: FAIL because `refunds.ts` is absent and the current facade is still large.

- [ ] **Step 4: Implement selector-specific locked contexts and one shared write**

Create `frontend/server/admin-transactions/refunds.ts` with this complete content:

```ts
import { withDbTransaction, type QueryExecutor } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { coerceNumber, isRefundablePaymentStatus, normalizeCurrency } from './normalizers';
import type {
  ManualRefundResult,
  ManualWalletRefundByReceiptParams,
  ManualWalletRefundParams,
} from './types';

export type AdminRefundDependencies = {
  databaseConfigured(): boolean;
  ensureSchema(): Promise<void>;
  withTransaction<TResult>(callback: (executor: QueryExecutor) => Promise<TResult>): Promise<TResult>;
  now(): string;
};

const DEFAULT_DEPENDENCIES: AdminRefundDependencies = {
  databaseConfigured: () => Boolean(process.env.DATABASE_URL),
  ensureSchema: ensureBillingSchema,
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
  now: () => new Date().toISOString(),
};

type RefundContext = {
  chargeId: number;
  userId: string;
  jobId: string | null;
  amountCents: number;
  currency: string;
  description: string;
  pricingSnapshotJson: string | null;
  vendorAccountId: string | null;
  updateLinkedJob: boolean;
};

type JobRow = {
  job_id: string;
  user_id: string | null;
  payment_status: string | null;
  pricing_snapshot: unknown;
  vendor_account_id: string | null;
  message: string | null;
  engine_label: string | null;
  duration_sec: number | null;
  currency: string | null;
};

type JobChargeRow = {
  id: number;
  amount_cents: number | string | null;
  currency: string | null;
  description: string | null;
};

type ReceiptChargeRow = JobChargeRow & {
  user_id: string | null;
  job_id: string | null;
  vendor_account_id: string | null;
  pricing_snapshot: unknown;
};

type RefundAuditParams = {
  adminUserId: string;
  adminEmail?: string | null;
  note?: string | null;
};

async function resolveJobRefundContext(
  executor: QueryExecutor,
  jobId: string
): Promise<RefundContext> {
  const jobRows = await executor.query<JobRow>(
    `SELECT job_id, user_id, payment_status, pricing_snapshot, vendor_account_id,
            message, engine_label, duration_sec, currency
     FROM app_jobs
     WHERE job_id = $1
     LIMIT 1`,
    [jobId]
  );
  const job = jobRows.at(0);
  if (!job || !job.user_id) {
    throw new Error('Job or wallet charge not found, or refund already issued.');
  }

  const chargeRows = await executor.query<JobChargeRow>(
    `SELECT id, amount_cents, currency, description
     FROM app_receipts
     WHERE job_id = $1
       AND type = 'charge'
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [jobId]
  );
  const charge = chargeRows.at(0);
  if (!charge) {
    throw new Error('Job or wallet charge not found, or refund already issued.');
  }

  const refundRows = await executor.query<{ id: number }>(
    `SELECT id
     FROM app_receipts
     WHERE job_id = $1
       AND type = 'refund'
     LIMIT 1`,
    [jobId]
  );
  if (refundRows.length) {
    throw new Error('Job or wallet charge not found, or refund already issued.');
  }
  if (!isRefundablePaymentStatus(job.payment_status)) {
    throw new Error('This job was not charged via wallet or has already been refunded.');
  }

  return {
    chargeId: charge.id,
    userId: job.user_id,
    jobId: job.job_id,
    amountCents: coerceNumber(charge.amount_cents),
    currency: normalizeCurrency(charge.currency ?? job.currency ?? 'USD'),
    description: charge.description
      ? `${charge.description} (manual refund)`
      : `Manual refund for job ${job.job_id}`,
    pricingSnapshotJson:
      job.pricing_snapshot == null ? null : JSON.stringify(job.pricing_snapshot),
    vendorAccountId: job.vendor_account_id,
    updateLinkedJob: true,
  };
}

async function resolveReceiptRefundContext(
  executor: QueryExecutor,
  receiptId: number
): Promise<RefundContext> {
  const chargeRows = await executor.query<ReceiptChargeRow>(
    `SELECT id, user_id, job_id, amount_cents, currency, description,
            vendor_account_id, pricing_snapshot
     FROM app_receipts
     WHERE id = $1 AND type = 'charge'
     LIMIT 1
     FOR UPDATE`,
    [receiptId]
  );
  const charge = chargeRows.at(0);
  if (!charge) throw new Error('Charge receipt not found.');
  if (!charge.user_id) throw new Error('Charge does not belong to a wallet user.');

  const existingRefund = await executor.query<{ id: number }>(
    `SELECT id
     FROM app_receipts
     WHERE type = 'refund'
       AND (
         (($1::text IS NOT NULL) AND job_id = $1)
         OR ((metadata ->> 'original_receipt_id')::bigint = $2)
       )
     LIMIT 1`,
    [charge.job_id, receiptId]
  );
  if (existingRefund.length) throw new Error('This charge already has a refund.');

  const jobRows = charge.job_id
    ? await executor.query<{ payment_status: string | null }>(
        `SELECT payment_status
         FROM app_jobs
         WHERE job_id = $1
         LIMIT 1`,
        [charge.job_id]
      )
    : [];
  const jobInfo = jobRows.at(0) ?? null;
  if (
    jobInfo &&
    jobInfo.payment_status &&
    !isRefundablePaymentStatus(jobInfo.payment_status)
  ) {
    throw new Error('This charge is not a wallet payment or has already been refunded.');
  }

  return {
    chargeId: charge.id,
    userId: charge.user_id,
    jobId: charge.job_id,
    amountCents: coerceNumber(charge.amount_cents),
    currency: normalizeCurrency(charge.currency),
    description: charge.description
      ? `${charge.description} (manual refund)`
      : `Manual refund for receipt ${charge.id}`,
    pricingSnapshotJson:
      charge.pricing_snapshot == null
        ? null
        : typeof charge.pricing_snapshot === 'string'
          ? charge.pricing_snapshot
          : JSON.stringify(charge.pricing_snapshot),
    vendorAccountId: charge.vendor_account_id,
    updateLinkedJob: Boolean(charge.job_id && jobInfo),
  };
}

function buildRefundMetadata(params: RefundAuditParams, chargeId: number) {
  const metadata: Record<string, unknown> = {
    reason: 'manual_admin_refund',
    admin_user_id: params.adminUserId,
    admin_email: params.adminEmail ?? null,
    original_receipt_id: chargeId,
  };
  if (params.note && params.note.trim().length) metadata.note = params.note.trim();
  return metadata;
}

function buildAdminNote(params: RefundAuditParams) {
  return [
    `Manual refund issued by ${params.adminEmail ?? params.adminUserId}`,
    params.note && params.note.trim().length ? `Note: ${params.note.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' — ');
}

async function insertRefund(
  executor: QueryExecutor,
  context: RefundContext,
  metadata: Record<string, unknown>
) {
  return executor.query<{ id: number; created_at: string }>(
    `INSERT INTO app_receipts (
       user_id, type, amount_cents, currency, description, job_id,
       pricing_snapshot, application_fee_cents, vendor_account_id,
       stripe_payment_intent_id, stripe_charge_id, metadata
     )
     VALUES ($1, 'refund', $2, $3, $4, $5, $6::jsonb, 0, $7, NULL, NULL, $8::jsonb)
     RETURNING id, created_at`,
    [
      context.userId,
      context.amountCents,
      context.currency,
      context.description,
      context.jobId,
      context.pricingSnapshotJson,
      context.vendorAccountId,
      JSON.stringify(metadata),
    ]
  );
}

async function updateLinkedJob(
  executor: QueryExecutor,
  jobId: string,
  adminNote: string
) {
  await executor.query(
    `UPDATE app_jobs
     SET payment_status = CASE
           WHEN payment_status = 'paid_wallet' THEN 'refunded_wallet'
           ELSE payment_status
         END,
         status = CASE WHEN status = 'completed' THEN status ELSE 'failed' END,
         progress = CASE WHEN status = 'completed' THEN progress ELSE 0 END,
         message = CASE
           WHEN $2::text IS NULL OR $2 = '' THEN message
           WHEN message IS NULL OR message = '' THEN $2
           ELSE message || E'\\n' || $2
         END,
         updated_at = NOW()
     WHERE job_id = $1`,
    [jobId, adminNote]
  );
}

async function persistManualRefund(
  executor: QueryExecutor,
  context: RefundContext,
  params: RefundAuditParams,
  now: () => string
): Promise<ManualRefundResult> {
  const inserted = await insertRefund(
    executor,
    context,
    buildRefundMetadata(params, context.chargeId)
  );
  if (context.updateLinkedJob && context.jobId) {
    await updateLinkedJob(executor, context.jobId, buildAdminNote(params));
  }
  const refund = inserted.at(0);
  return {
    refundReceiptId: refund?.id ?? 0,
    createdAt: refund?.created_at ?? now(),
  };
}

export async function issueManualWalletRefund(
  params: ManualWalletRefundParams,
  dependencies: AdminRefundDependencies = DEFAULT_DEPENDENCIES
): Promise<ManualRefundResult> {
  if (!dependencies.databaseConfigured()) throw new Error('Database unavailable');
  const jobId = params.jobId.trim();
  if (!jobId) throw new Error('Missing jobId');

  await dependencies.ensureSchema();
  return dependencies.withTransaction(async (executor) => {
    const context = await resolveJobRefundContext(executor, jobId);
    return persistManualRefund(executor, context, params, dependencies.now);
  });
}

export async function issueManualWalletRefundByReceipt(
  params: ManualWalletRefundByReceiptParams,
  dependencies: AdminRefundDependencies = DEFAULT_DEPENDENCIES
): Promise<ManualRefundResult> {
  if (!dependencies.databaseConfigured()) throw new Error('Database unavailable');
  const receiptId = Number(params.receiptId);
  if (!Number.isFinite(receiptId) || receiptId <= 0) throw new Error('Invalid receiptId');

  await dependencies.ensureSchema();
  return dependencies.withTransaction(async (executor) => {
    const context = await resolveReceiptRefundContext(executor, receiptId);
    return persistManualRefund(executor, context, params, dependencies.now);
  });
}
```

- [ ] **Step 5: Replace the legacy module with the final facade**

Replace the entire content of `frontend/server/admin-transactions.ts` with:

```ts
export { fetchAdminTransactions, fetchTransactionAnomalies } from './admin-transactions/read-model';
export { issueManualWalletRefund, issueManualWalletRefundByReceipt } from './admin-transactions/refunds';
export { issueManualWalletTopUp } from './admin-transactions/topups';

export type {
  AdminTransactionRecord,
  TransactionAnomalies,
} from './admin-transactions/types';
```

Run `rg -n "@/server/admin-transactions" frontend tests` and confirm all current routes/pages/components still import only from this facade.

- [ ] **Step 6: Run focused tests, TypeScript, lint, and diff validation**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-transactions-architecture.test.ts \
  tests/admin-transactions-contract.test.ts \
  tests/admin-users-architecture.test.ts \
  tests/admin-user-detail-architecture.test.ts
pnpm --dir frontend exec tsc --noEmit --pretty false
pnpm --dir frontend run lint
pnpm run lint:exposure
git diff --check
```

Expected: every command PASS. Confirm the refund tests report one transaction and a `FOR UPDATE` lock before duplicate checks.

- [ ] **Step 7: Commit only the refund/facade extraction**

```bash
git add \
  frontend/server/admin-transactions.ts \
  frontend/server/admin-transactions/refunds.ts \
  tests/admin-transactions-architecture.test.ts \
  tests/admin-transactions-contract.test.ts
git diff --cached --check
git commit -m "fix: make admin wallet refunds atomic"
```

---

### Task 5: Complete repository-wide verification and evidence review

**Files:**
- No planned source modification.
- Modify only a touched test/source file if a verification failure proves this batch caused the failure; do not absorb unrelated Seedream failures or edits.

**Interfaces:**
- Consumes: the final stable facade and all focused module contracts.
- Produces: a verified `main` history with no pricing changes and no admin transaction regression.

- [ ] **Step 1: Verify focused contracts independently**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-transactions-architecture.test.ts \
  tests/admin-transactions-contract.test.ts
```

Expected: all admin transaction tests PASS.

- [ ] **Step 2: Run the complete project test suite**

```bash
pnpm run test:validate
```

Expected: complete suite PASS. If an unrelated concurrent Seedream test fails, preserve the exact failure output, verify it reproduces without this batch, and do not modify those files.

- [ ] **Step 3: Run static and architecture checks**

```bash
pnpm --dir frontend exec tsc --noEmit --pretty false
pnpm --dir frontend run lint
pnpm run lint:exposure
git diff --check
npm run architecture:audit -- --min-lines 500
```

Expected:

- every command PASS;
- `frontend/server/admin-transactions.ts` no longer appears in the `>= 500` audit;
- facade is at most 25 lines;
- focused modules are each below 350 lines.

- [ ] **Step 4: Run the production build**

```bash
pnpm --dir frontend run build
```

Expected: build and sitemap generation PASS.

- [ ] **Step 5: Audit the final diff and public contract**

```bash
git diff origin/main...HEAD --name-only
git diff origin/main...HEAD -- frontend/server/admin-transactions.ts frontend/server/admin-transactions tests/admin-transactions-architecture.test.ts tests/admin-transactions-contract.test.ts
rg -n "@/server/admin-transactions" \
  frontend/app/api/admin \
  'frontend/app/(core)/admin' \
  frontend/components/admin
```

Expected:

- the implementation commits touch only the facade, focused modules, and two tests;
- the earlier approved design/plan documents may also appear in branch history;
- no pricing, billing-product, membership, checkout-price, Stripe-price, or catalog file appears;
- every current consumer still imports from `@/server/admin-transactions`.

- [ ] **Step 6: Record final evidence without creating a no-op commit**

Run:

```bash
git status --short --branch
git log --oneline -5
```

Expected: implementation files are clean. Unrelated concurrent Seedream/environment files may remain modified and must not be staged. Do not create an empty verification commit.

---

## Execution Notes

- Do not run a browser action that issues a refund or top-up against production or shared data.
- A read-only `/admin/transactions` browser smoke may cover load, search, filters, and refresh only when a safe authenticated environment is available.
- If the receipt-based and job-based selectors disagree for the same historical charge, preserve their current separate error and fallback behavior; do not invent a new canonical selector in this batch.
- If `FOR UPDATE` placement causes a PostgreSQL syntax issue, keep the lock on the selected `app_receipts` charge row and adjust clause placement only; do not weaken or remove the lock.
- If a focused module approaches 350 lines, remove duplication inside that owner. Do not add another architectural layer without revising and re-approving the design.
