# Server Render Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reliable server-render export path for MaxVideoAI Editor with two free server exports per user, paid exports after quota, progress tracking, MP4 output, and media-library persistence.

**Architecture:** Keep the editor timeline as the source of truth by reusing `WorkspaceTimelineVideoExportRequest` and moving only privileged work to server modules. Next.js route handlers create/read export jobs, but the actual Remotion/FFmpeg render runs in a separate Node worker process so HTTP requests do not block or timeout. Billing is modeled separately from generation jobs using `app_timeline_exports` plus `app_receipts`, while final MP4 assets are saved through the existing media-library/storage path.

**Tech Stack:** Next.js App Router route handlers, Neon/Postgres, existing `app_receipts` wallet ledger, S3 storage via `uploadFileBuffer`, media library via `ensureReusableAsset`, Remotion + `@remotion/renderer` + `@remotion/media`, FFmpeg/FFprobe, route-local editor tests and Playwright.

---

## Product Decisions

- Server render is the only real final MP4 export path in this pass.
- First two server export jobs per authenticated user are free.
- Free quota is reserved when a job is queued and released if the job fails before output is produced.
- After the free quota, exports charge the existing wallet ledger using `app_receipts.type = 'charge'`.
- Export price is shown before render and depends on duration, resolution, fps, and quality preset.
- The export button must create a real server job, not only write to `localStorage`.
- The worker must save the rendered MP4 into storage and media library so it appears in the user's app assets.
- EDL export stays client-side for now because it does not need server resources.

## File Structure

- Create `frontend/src/server/timeline-exports/contracts.ts`
  - Server-safe request/response types, parser helpers, status constants.
- Create `frontend/src/server/timeline-exports/pricing.ts`
  - Export pricing, free quota calculation, estimate formatting.
- Create `frontend/src/server/timeline-exports/schema.ts`
  - Idempotent DB schema creation for `app_timeline_exports`.
- Create `frontend/src/server/timeline-exports/repository.ts`
  - Insert, claim, update, list, and read export jobs.
- Create `frontend/src/server/timeline-exports/billing.ts`
  - Free quota reservation, wallet balance check, charge receipt, refund/release.
- Create `frontend/src/server/timeline-exports/render-request.ts`
  - Server validation and normalization of `WorkspaceTimelineVideoExportRequest`.
- Create `frontend/src/server/timeline-exports/renderer.ts`
  - Render job orchestration, storage upload, media-library save.
- Create `frontend/src/remotion/timeline-export/Root.tsx`
  - Remotion root and composition registration.
- Create `frontend/src/remotion/timeline-export/TimelineComposition.tsx`
  - Manifest-to-video/audio/image composition renderer.
- Create `frontend/src/remotion/timeline-export/types.ts`
  - Render props shared by worker and Remotion composition.
- Create `frontend/scripts/run-timeline-export-worker.ts`
  - CLI worker that claims and renders queued exports.
- Create `frontend/app/api/studio/timeline-exports/estimate/route.ts`
  - Authenticated estimate endpoint.
- Create `frontend/app/api/studio/timeline-exports/route.ts`
  - Authenticated create/list endpoint.
- Create `frontend/app/api/studio/timeline-exports/[exportId]/route.ts`
  - Authenticated status endpoint.
- Modify `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render.ts`
  - Add `serverRenderMode` and stable export request ids.
- Modify `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`
  - Replace local-only export with server estimate/create/poll.
- Modify `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceExportDialog.tsx`
  - Show server render quota, estimate, progress, and download state.
- Modify `frontend/app/(core)/(workspace)/app/studio/workspace/maxvideoai-editor.module.css`
  - Add export job/progress styling.
- Modify `frontend/package.json`
  - Add Remotion dependencies and worker script.
- Test `tests/timeline-export-server-contract.test.ts`
  - Server schema, pricing, request validation, billing behavior.
- Test `tests/maxvideoai-editor-workspace-architecture.test.ts`
  - Editor wiring and server export contract.
- Test `tests/e2e/editor/editor-timeline.spec.ts`
  - Export popup creates a job and shows queued/rendering/ready states with mocked API.
- Create `docs/engineering/maxvideoai-editor-server-render.md`
  - Operational notes for worker, pricing, quota, and failure handling.

---

### Task 1: Server Export Contract And Request IDs

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render.ts`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] **Step 1: Write the failing architecture test**

Add assertions that the export request contains an idempotency key and server render mode:

```ts
const timelineRenderSource = source(timelineRenderPath);
assert.match(timelineRenderSource, /WorkspaceTimelineVideoExportRequest[\s\S]*idempotencyKey/, 'video export requests should include an idempotency key');
assert.match(timelineRenderSource, /serverRenderMode:\s*'server'/, 'video export settings should explicitly target server rendering');
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test:editor
```

Expected: FAIL because `idempotencyKey` and `serverRenderMode` do not exist yet.

- [ ] **Step 3: Extend the export request type**

In `workspace-timeline-render.ts`, change the export settings and request shape:

```ts
export type WorkspaceTimelineVideoExportSettings = {
  format: WorkspaceTimelineVideoExportFormat;
  qualityPreset: WorkspaceTimelineExportQualityPreset;
  includeAudio: boolean;
  serverRenderMode: 'server';
};

export type WorkspaceTimelineVideoExportRequest = {
  version: 1;
  source: 'maxvideoai-editor';
  idempotencyKey: string;
  createdAt: string;
  status: WorkspaceTimelineRenderManifest['status'];
  manifest: WorkspaceTimelineRenderManifest;
  exportSettings: WorkspaceTimelineVideoExportSettings;
};
```

Update `buildWorkspaceTimelineVideoExportRequest`:

```ts
export function buildWorkspaceTimelineVideoExportRequest(
  manifest: WorkspaceTimelineRenderManifest,
  options?: {
    qualityPreset?: WorkspaceTimelineExportQualityPreset;
    includeAudio?: boolean;
    createdAt?: string;
    idempotencyKey?: string;
  }
): WorkspaceTimelineVideoExportRequest {
  return {
    version: 1,
    source: 'maxvideoai-editor',
    idempotencyKey: options?.idempotencyKey ?? crypto.randomUUID(),
    createdAt: options?.createdAt ?? new Date().toISOString(),
    status: manifest.status,
    manifest,
    exportSettings: {
      format: 'mp4-h264',
      qualityPreset: options?.qualityPreset ?? 'standard',
      includeAudio: options?.includeAudio ?? true,
      serverRenderMode: 'server',
    },
  };
}
```

Use `globalThis.crypto?.randomUUID?.()` fallback if TypeScript complains about `crypto` in the browser:

```ts
function createExportIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `export_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm run test:editor
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/maxvideoai-editor-workspace-architecture.test.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-timeline-render.ts
git commit -m "feat: add server timeline export request contract"
```

---

### Task 2: Export Pricing And Free Quota

**Files:**
- Create: `frontend/src/server/timeline-exports/pricing.ts`
- Create: `frontend/src/server/timeline-exports/contracts.ts`
- Test: `tests/timeline-export-server-contract.test.ts`

- [ ] **Step 1: Write failing pricing tests**

Create `tests/timeline-export-server-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_FREE_TIMELINE_SERVER_EXPORTS,
  estimateTimelineExportPrice,
  resolveTimelineExportQuota,
} from '../frontend/src/server/timeline-exports/pricing';

test('timeline server export grants two free exports before paid pricing', () => {
  assert.equal(MAX_FREE_TIMELINE_SERVER_EXPORTS, 2);
  assert.deepEqual(resolveTimelineExportQuota({ usedFreeExports: 0 }), {
    freeLimit: 2,
    usedFreeExports: 0,
    freeExportsRemaining: 2,
    billingKind: 'free',
  });
  assert.deepEqual(resolveTimelineExportQuota({ usedFreeExports: 2 }), {
    freeLimit: 2,
    usedFreeExports: 2,
    freeExportsRemaining: 0,
    billingKind: 'paid',
  });
});

test('timeline server export estimate scales with duration, resolution, fps, and preset', () => {
  const standard = estimateTimelineExportPrice({
    durationSec: 30,
    resolution: '1080p',
    fps: 30,
    qualityPreset: 'standard',
    freeExportsRemaining: 0,
  });
  assert.equal(standard.amountCents, 180);
  assert.equal(standard.currency, 'USD');
  assert.equal(standard.billingKind, 'paid');

  const free = estimateTimelineExportPrice({
    durationSec: 30,
    resolution: '1080p',
    fps: 30,
    qualityPreset: 'standard',
    freeExportsRemaining: 1,
  });
  assert.equal(free.amountCents, 0);
  assert.equal(free.billingKind, 'free');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
```

Expected: FAIL because the files do not exist.

- [ ] **Step 3: Add server contracts**

Create `frontend/src/server/timeline-exports/contracts.ts`:

```ts
import type { WorkspaceTimelineExportQualityPreset } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';

export type TimelineExportStatus = 'queued' | 'rendering' | 'completed' | 'failed' | 'canceled';
export type TimelineExportBillingKind = 'free' | 'paid';
export type TimelineExportBillingStatus =
  | 'free_reserved'
  | 'free_completed'
  | 'free_released'
  | 'paid_reserved'
  | 'paid_completed'
  | 'refunded'
  | 'platform';

export type TimelineExportEstimateInput = {
  durationSec: number;
  resolution: string | null | undefined;
  fps: number | null | undefined;
  qualityPreset: WorkspaceTimelineExportQualityPreset;
  freeExportsRemaining: number;
};

export type TimelineExportPriceEstimate = {
  billingKind: TimelineExportBillingKind;
  amountCents: number;
  currency: 'USD';
  freeExportsRemaining: number;
  unitCentsPerSecond: number;
  multiplier: number;
};
```

- [ ] **Step 4: Add pricing implementation**

Create `frontend/src/server/timeline-exports/pricing.ts`:

```ts
import type { TimelineExportEstimateInput, TimelineExportPriceEstimate } from './contracts';

export const MAX_FREE_TIMELINE_SERVER_EXPORTS = 2;

const QUALITY_CENTS_PER_SECOND = {
  draft: 2,
  standard: 4,
  high: 7,
} as const;

function resolutionMultiplier(resolution: string | null | undefined): number {
  const normalized = String(resolution ?? '').toLowerCase();
  if (normalized.includes('2160') || normalized.includes('4k')) return 3;
  if (normalized.includes('1080')) return 1.5;
  return 1;
}

function fpsMultiplier(fps: number | null | undefined): number {
  if (!fps || fps <= 30) return 1;
  if (fps <= 60) return 1.35;
  return 1.6;
}

export function resolveTimelineExportQuota(params: { usedFreeExports: number }) {
  const usedFreeExports = Math.max(0, Math.min(MAX_FREE_TIMELINE_SERVER_EXPORTS, params.usedFreeExports));
  const freeExportsRemaining = Math.max(0, MAX_FREE_TIMELINE_SERVER_EXPORTS - usedFreeExports);
  return {
    freeLimit: MAX_FREE_TIMELINE_SERVER_EXPORTS,
    usedFreeExports,
    freeExportsRemaining,
    billingKind: freeExportsRemaining > 0 ? 'free' as const : 'paid' as const,
  };
}

export function estimateTimelineExportPrice(input: TimelineExportEstimateInput): TimelineExportPriceEstimate {
  const unitCentsPerSecond = QUALITY_CENTS_PER_SECOND[input.qualityPreset];
  const multiplier = resolutionMultiplier(input.resolution) * fpsMultiplier(input.fps);
  const durationSec = Math.max(1, Math.ceil(input.durationSec));
  const paidAmountCents = Math.max(15, Math.round(durationSec * unitCentsPerSecond * multiplier));
  const billingKind = input.freeExportsRemaining > 0 ? 'free' : 'paid';
  return {
    billingKind,
    amountCents: billingKind === 'free' ? 0 : paidAmountCents,
    currency: 'USD',
    freeExportsRemaining: input.freeExportsRemaining,
    unitCentsPerSecond,
    multiplier,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/timeline-export-server-contract.test.ts frontend/src/server/timeline-exports/contracts.ts frontend/src/server/timeline-exports/pricing.ts
git commit -m "feat: add timeline export pricing"
```

---

### Task 3: Database Schema And Repository

**Files:**
- Create: `frontend/src/server/timeline-exports/schema.ts`
- Create: `frontend/src/server/timeline-exports/repository.ts`
- Test: `tests/timeline-export-server-contract.test.ts`

- [ ] **Step 1: Add failing schema/repository source tests**

Append:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const schemaPath = join(root, 'frontend/src/server/timeline-exports/schema.ts');
const repositoryPath = join(root, 'frontend/src/server/timeline-exports/repository.ts');

test('timeline export schema defines durable export jobs with quota and billing fields', () => {
  assert.ok(existsSync(schemaPath));
  const source = readFileSync(schemaPath, 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS app_timeline_exports/);
  assert.match(source, /idempotency_key TEXT NOT NULL/);
  assert.match(source, /billing_status TEXT NOT NULL/);
  assert.match(source, /render_manifest JSONB NOT NULL/);
  assert.match(source, /output_url TEXT/);
});

test('timeline export repository owns job creation and claim operations', () => {
  assert.ok(existsSync(repositoryPath));
  const source = readFileSync(repositoryPath, 'utf8');
  assert.match(source, /createTimelineExportJob/);
  assert.match(source, /claimNextQueuedTimelineExport/);
  assert.match(source, /completeTimelineExportJob/);
  assert.match(source, /failTimelineExportJob/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
```

Expected: FAIL because schema/repository files do not exist.

- [ ] **Step 3: Add schema helper**

Create `frontend/src/server/timeline-exports/schema.ts`:

```ts
import { query } from '@/lib/db';

export async function ensureTimelineExportSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS app_timeline_exports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      project_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      progress INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      duration_sec NUMERIC NOT NULL DEFAULT 0,
      resolution TEXT,
      fps INTEGER,
      quality_preset TEXT NOT NULL DEFAULT 'standard',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      billing_kind TEXT NOT NULL,
      billing_status TEXT NOT NULL,
      render_manifest JSONB NOT NULL,
      export_settings JSONB NOT NULL,
      output_url TEXT,
      output_asset_id TEXT,
      output_size_bytes BIGINT,
      output_mime_type TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS app_timeline_exports_user_idempotency_idx
      ON app_timeline_exports (user_id, idempotency_key);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS app_timeline_exports_user_created_idx
      ON app_timeline_exports (user_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS app_timeline_exports_queue_idx
      ON app_timeline_exports (status, created_at ASC)
      WHERE status = 'queued';
  `);
}
```

- [ ] **Step 4: Add repository skeleton**

Create `frontend/src/server/timeline-exports/repository.ts` with typed functions:

```ts
import { randomUUID } from 'crypto';
import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import type { TimelineExportBillingKind, TimelineExportBillingStatus, TimelineExportStatus } from './contracts';
import { ensureTimelineExportSchema } from './schema';

export type TimelineExportJobRecord = {
  id: string;
  user_id: string;
  idempotency_key: string;
  project_name: string;
  status: TimelineExportStatus;
  progress: number;
  message: string | null;
  duration_sec: string | number;
  resolution: string | null;
  fps: number | null;
  quality_preset: string;
  amount_cents: number;
  currency: string;
  billing_kind: TimelineExportBillingKind;
  billing_status: TimelineExportBillingStatus;
  render_manifest: unknown;
  export_settings: unknown;
  output_url: string | null;
  output_asset_id: string | null;
  output_size_bytes: string | number | null;
  output_mime_type: string | null;
  created_at: string;
  updated_at: string;
};

export async function countUsedFreeTimelineExports(userId: string, executor: QueryExecutor = { query }): Promise<number> {
  await ensureTimelineExportSchema();
  const rows = await executor.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count
       FROM app_timeline_exports
      WHERE user_id = $1
        AND billing_status IN ('free_reserved','free_completed')`,
    [userId]
  );
  return Number(rows[0]?.count ?? 0);
}

export async function createTimelineExportJob(params: {
  userId: string;
  idempotencyKey: string;
  projectName: string;
  durationSec: number;
  resolution: string | null;
  fps: number | null;
  qualityPreset: string;
  amountCents: number;
  currency: string;
  billingKind: TimelineExportBillingKind;
  billingStatus: TimelineExportBillingStatus;
  renderManifest: unknown;
  exportSettings: unknown;
}): Promise<TimelineExportJobRecord> {
  await ensureTimelineExportSchema();
  const id = `tlx_${randomUUID()}`;
  const rows = await query<TimelineExportJobRecord>(
    `INSERT INTO app_timeline_exports (
        id, user_id, idempotency_key, project_name, duration_sec, resolution, fps,
        quality_preset, amount_cents, currency, billing_kind, billing_status,
        render_manifest, export_settings
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)
      ON CONFLICT (user_id, idempotency_key)
      DO UPDATE SET updated_at = app_timeline_exports.updated_at
      RETURNING *`,
    [
      id,
      params.userId,
      params.idempotencyKey,
      params.projectName,
      params.durationSec,
      params.resolution,
      params.fps,
      params.qualityPreset,
      params.amountCents,
      params.currency,
      params.billingKind,
      params.billingStatus,
      JSON.stringify(params.renderManifest),
      JSON.stringify(params.exportSettings),
    ]
  );
  return rows[0];
}

export async function readTimelineExportJob(params: { userId: string; exportId: string }): Promise<TimelineExportJobRecord | null> {
  await ensureTimelineExportSchema();
  const rows = await query<TimelineExportJobRecord>(
    `SELECT * FROM app_timeline_exports WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [params.exportId, params.userId]
  );
  return rows[0] ?? null;
}

export async function claimNextQueuedTimelineExport(): Promise<TimelineExportJobRecord | null> {
  await ensureTimelineExportSchema();
  return withDbTransaction(async (executor) => {
    const rows = await executor.query<TimelineExportJobRecord>(
      `UPDATE app_timeline_exports
          SET status = 'rendering',
              progress = 5,
              started_at = NOW(),
              updated_at = NOW()
        WHERE id = (
          SELECT id
            FROM app_timeline_exports
           WHERE status = 'queued'
           ORDER BY created_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1
        )
        RETURNING *`
    );
    return rows[0] ?? null;
  });
}

export async function updateTimelineExportProgress(params: { exportId: string; progress: number; message: string }): Promise<void> {
  await query(
    `UPDATE app_timeline_exports
        SET progress = $2,
            message = $3,
            updated_at = NOW()
      WHERE id = $1`,
    [params.exportId, Math.max(0, Math.min(99, Math.round(params.progress))), params.message]
  );
}

export async function completeTimelineExportJob(params: {
  exportId: string;
  outputUrl: string;
  outputAssetId: string | null;
  sizeBytes: number | null;
  mimeType: string;
  billingStatus: TimelineExportBillingStatus;
}): Promise<void> {
  await query(
    `UPDATE app_timeline_exports
        SET status = 'completed',
            progress = 100,
            message = 'Export ready.',
            output_url = $2,
            output_asset_id = $3,
            output_size_bytes = $4,
            output_mime_type = $5,
            billing_status = $6,
            completed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [params.exportId, params.outputUrl, params.outputAssetId, params.sizeBytes, params.mimeType, params.billingStatus]
  );
}

export async function failTimelineExportJob(params: { exportId: string; message: string; billingStatus: TimelineExportBillingStatus }): Promise<void> {
  await query(
    `UPDATE app_timeline_exports
        SET status = 'failed',
            message = $2,
            billing_status = $3,
            failed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [params.exportId, params.message, params.billingStatus]
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/timeline-export-server-contract.test.ts frontend/src/server/timeline-exports/schema.ts frontend/src/server/timeline-exports/repository.ts
git commit -m "feat: add timeline export persistence"
```

---

### Task 4: Billing Reservation And Receipt Handling

**Files:**
- Create: `frontend/src/server/timeline-exports/billing.ts`
- Modify: `frontend/src/server/timeline-exports/repository.ts`
- Test: `tests/timeline-export-server-contract.test.ts`

- [ ] **Step 1: Add failing billing tests**

Append source-level tests:

```ts
const billingPath = join(root, 'frontend/src/server/timeline-exports/billing.ts');

test('timeline export billing reserves free quota before paid wallet charge', () => {
  assert.ok(existsSync(billingPath));
  const source = readFileSync(billingPath, 'utf8');
  assert.match(source, /reserveTimelineExportBilling/);
  assert.match(source, /free_reserved/);
  assert.match(source, /paid_reserved/);
  assert.match(source, /INSERT INTO app_receipts/);
  assert.match(source, /surface,\s*billing_product_key/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
```

Expected: FAIL because `billing.ts` does not exist.

- [ ] **Step 3: Add billing reservation helper**

Create `frontend/src/server/timeline-exports/billing.ts`:

```ts
import { query, withDbTransaction } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { estimateTimelineExportPrice, resolveTimelineExportQuota } from './pricing';
import { countUsedFreeTimelineExports } from './repository';
import type { TimelineExportBillingStatus } from './contracts';

export type TimelineExportBillingReservation = {
  billingKind: 'free' | 'paid';
  billingStatus: TimelineExportBillingStatus;
  amountCents: number;
  currency: 'USD';
  freeLimit: number;
  freeExportsRemaining: number;
  usedFreeExports: number;
};

export async function reserveTimelineExportBilling(params: {
  userId: string;
  exportId: string;
  projectName: string;
  durationSec: number;
  resolution: string | null;
  fps: number | null;
  qualityPreset: 'draft' | 'standard' | 'high';
  pricingSnapshot: Record<string, unknown>;
}): Promise<TimelineExportBillingReservation> {
  await ensureBillingSchema();

  return withDbTransaction(async (executor) => {
    const usedFreeExports = await countUsedFreeTimelineExports(params.userId, executor);
    const quota = resolveTimelineExportQuota({ usedFreeExports });
    const estimate = estimateTimelineExportPrice({
      durationSec: params.durationSec,
      resolution: params.resolution,
      fps: params.fps,
      qualityPreset: params.qualityPreset,
      freeExportsRemaining: quota.freeExportsRemaining,
    });

    if (estimate.billingKind === 'free') {
      return {
        billingKind: 'free',
        billingStatus: 'free_reserved',
        amountCents: 0,
        currency: 'USD',
        freeLimit: quota.freeLimit,
        freeExportsRemaining: Math.max(0, quota.freeExportsRemaining - 1),
        usedFreeExports,
      };
    }

    const walletRows = await executor.query<{ balance_cents: string | number }>(
      `SELECT GREATEST(0,
          COALESCE(SUM(CASE WHEN type = 'topup' THEN amount_cents ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN type = 'refund' THEN amount_cents ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN type = 'charge' THEN amount_cents ELSE 0 END), 0)
      )::int AS balance_cents
       FROM app_receipts
      WHERE user_id = $1
        AND (currency IS NULL OR UPPER(currency) = 'USD')`,
      [params.userId]
    );
    const balanceCents = Number(walletRows[0]?.balance_cents ?? 0);
    if (balanceCents < estimate.amountCents) {
      throw new Error('INSUFFICIENT_WALLET_BALANCE');
    }

    await executor.query(
      `INSERT INTO app_receipts (
          user_id, type, amount_cents, currency, description, job_id, surface,
          billing_product_key, pricing_snapshot, metadata
        )
        VALUES ($1,'charge',$2,'USD',$3,$4,'timeline_export','server_render',$5::jsonb,$6::jsonb)
        ON CONFLICT DO NOTHING`,
      [
        params.userId,
        estimate.amountCents,
        `Server export ${params.projectName} - ${Math.ceil(params.durationSec)}s`,
        params.exportId,
        JSON.stringify(params.pricingSnapshot),
        JSON.stringify({ product: 'maxvideoai-editor-server-export' }),
      ]
    );

    return {
      billingKind: 'paid',
      billingStatus: 'paid_reserved',
      amountCents: estimate.amountCents,
      currency: 'USD',
      freeLimit: quota.freeLimit,
      freeExportsRemaining: 0,
      usedFreeExports,
    };
  });
}

export async function releaseFailedTimelineExportBilling(params: {
  userId: string;
  exportId: string;
  billingStatus: TimelineExportBillingStatus;
  amountCents: number;
}): Promise<TimelineExportBillingStatus> {
  if (params.billingStatus === 'free_reserved') return 'free_released';
  if (params.billingStatus !== 'paid_reserved' || params.amountCents <= 0) return params.billingStatus;
  await query(
    `INSERT INTO app_receipts (
        user_id, type, amount_cents, currency, description, job_id, surface,
        billing_product_key, metadata
      )
      VALUES ($1,'refund',$2,'USD','Refund failed server export',$3,'timeline_export','server_render',$4::jsonb)
      ON CONFLICT DO NOTHING`,
    [params.userId, params.amountCents, params.exportId, JSON.stringify({ reason: 'timeline_export_failed' })]
  );
  return 'refunded';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/timeline-export-server-contract.test.ts frontend/src/server/timeline-exports/billing.ts
git commit -m "feat: add timeline export billing reservation"
```

---

### Task 5: Estimate And Create API Routes

**Files:**
- Create: `frontend/src/server/timeline-exports/render-request.ts`
- Create: `frontend/app/api/studio/timeline-exports/estimate/route.ts`
- Create: `frontend/app/api/studio/timeline-exports/route.ts`
- Create: `frontend/app/api/studio/timeline-exports/[exportId]/route.ts`
- Test: `tests/timeline-export-server-contract.test.ts`

- [ ] **Step 1: Add failing API route tests**

Append:

```ts
for (const routePath of [
  'frontend/app/api/studio/timeline-exports/estimate/route.ts',
  'frontend/app/api/studio/timeline-exports/route.ts',
  'frontend/app/api/studio/timeline-exports/[exportId]/route.ts',
]) {
  test(`${routePath} exists and is authenticated`, () => {
    const absolute = join(root, routePath);
    assert.ok(existsSync(absolute), `${routePath} should exist`);
    const source = readFileSync(absolute, 'utf8');
    assert.match(source, /getRouteAuthContext/, `${routePath} should require workspace auth`);
    assert.match(source, /Cache-Control/, `${routePath} should disable response caching`);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
```

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Add request validation helper**

Create `frontend/src/server/timeline-exports/render-request.ts`:

```ts
import type { WorkspaceTimelineVideoExportRequest } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';

export function parseTimelineExportRequest(value: unknown): WorkspaceTimelineVideoExportRequest {
  const request = value as Partial<WorkspaceTimelineVideoExportRequest> | null;
  if (!request || request.version !== 1 || request.source !== 'maxvideoai-editor') {
    throw new Error('INVALID_EXPORT_REQUEST');
  }
  if (!request.idempotencyKey || typeof request.idempotencyKey !== 'string') {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  }
  if (request.status !== 'ready') {
    throw new Error('EXPORT_MANIFEST_BLOCKED');
  }
  if (!request.manifest || request.manifest.status !== 'ready' || request.manifest.durationSec <= 0) {
    throw new Error('EXPORT_MANIFEST_NOT_READY');
  }
  if (request.exportSettings?.format !== 'mp4-h264') {
    throw new Error('UNSUPPORTED_EXPORT_FORMAT');
  }
  if (request.exportSettings.serverRenderMode !== 'server') {
    throw new Error('SERVER_RENDER_REQUIRED');
  }
  return request as WorkspaceTimelineVideoExportRequest;
}

export function resolveTimelineExportResolution(request: WorkspaceTimelineVideoExportRequest): string | null {
  return request.manifest.projectSettings?.resolution ?? null;
}

export function resolveTimelineExportFps(request: WorkspaceTimelineVideoExportRequest): number | null {
  return request.manifest.projectSettings?.fps ?? null;
}
```

- [ ] **Step 4: Add estimate route**

Create `frontend/app/api/studio/timeline-exports/estimate/route.ts`:

```ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { parseTimelineExportRequest, resolveTimelineExportFps, resolveTimelineExportResolution } from '@/server/timeline-exports/render-request';
import { countUsedFreeTimelineExports } from '@/server/timeline-exports/repository';
import { estimateTimelineExportPrice, resolveTimelineExportQuota } from '@/server/timeline-exports/pricing';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const payload = await req.json().catch(() => null);
  try {
    const request = parseTimelineExportRequest(payload?.request ?? payload);
    const quota = resolveTimelineExportQuota({
      usedFreeExports: await countUsedFreeTimelineExports(userId),
    });
    const estimate = estimateTimelineExportPrice({
      durationSec: request.manifest.durationSec,
      resolution: resolveTimelineExportResolution(request),
      fps: resolveTimelineExportFps(request),
      qualityPreset: request.exportSettings.qualityPreset,
      freeExportsRemaining: quota.freeExportsRemaining,
    });
    return json({ ok: true, quota, estimate });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'ESTIMATE_FAILED' }, { status: 400 });
  }
}
```

- [ ] **Step 5: Add create/list route**

Create `frontend/app/api/studio/timeline-exports/route.ts`:

```ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { parseTimelineExportRequest, resolveTimelineExportFps, resolveTimelineExportResolution } from '@/server/timeline-exports/render-request';
import { createTimelineExportJob } from '@/server/timeline-exports/repository';
import { reserveTimelineExportBilling } from '@/server/timeline-exports/billing';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const payload = await req.json().catch(() => null);
  try {
    const request = parseTimelineExportRequest(payload?.request ?? payload);
    const projectName = request.manifest.projectName || 'MaxVideoAI Export';
    const resolution = resolveTimelineExportResolution(request);
    const fps = resolveTimelineExportFps(request);
    const provisionalExportId = `tlx_${request.idempotencyKey}`;
    const billing = await reserveTimelineExportBilling({
      userId,
      exportId: provisionalExportId,
      projectName,
      durationSec: request.manifest.durationSec,
      resolution,
      fps,
      qualityPreset: request.exportSettings.qualityPreset,
      pricingSnapshot: {
        source: 'timeline_export',
        durationSec: request.manifest.durationSec,
        resolution,
        fps,
        qualityPreset: request.exportSettings.qualityPreset,
      },
    });
    const job = await createTimelineExportJob({
      userId,
      idempotencyKey: request.idempotencyKey,
      projectName,
      durationSec: request.manifest.durationSec,
      resolution,
      fps,
      qualityPreset: request.exportSettings.qualityPreset,
      amountCents: billing.amountCents,
      currency: billing.currency,
      billingKind: billing.billingKind,
      billingStatus: billing.billingStatus,
      renderManifest: request.manifest,
      exportSettings: request.exportSettings,
    });
    return json({ ok: true, export: job, billing });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EXPORT_CREATE_FAILED';
    const status = message === 'INSUFFICIENT_WALLET_BALANCE' ? 402 : 400;
    return json({ ok: false, error: message }, { status });
  }
}
```

- [ ] **Step 6: Add status route**

Create `frontend/app/api/studio/timeline-exports/[exportId]/route.ts`:

```ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { readTimelineExportJob } from '@/server/timeline-exports/repository';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function GET(req: NextRequest, props: { params: Promise<{ exportId: string }> }) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const { exportId } = await props.params;
  const job = await readTimelineExportJob({ userId, exportId });
  if (!job) return json({ ok: false, error: 'EXPORT_NOT_FOUND' }, { status: 404 });
  return json({ ok: true, export: job });
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
npm run test:editor
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add tests/timeline-export-server-contract.test.ts frontend/src/server/timeline-exports/render-request.ts frontend/app/api/studio/timeline-exports
git commit -m "feat: add timeline export API"
```

---

### Task 6: Remotion Renderer And Worker

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/remotion/timeline-export/types.ts`
- Create: `frontend/src/remotion/timeline-export/Root.tsx`
- Create: `frontend/src/remotion/timeline-export/TimelineComposition.tsx`
- Create: `frontend/src/server/timeline-exports/renderer.ts`
- Create: `frontend/scripts/run-timeline-export-worker.ts`
- Test: `tests/timeline-export-server-contract.test.ts`

- [ ] **Step 1: Add dependencies**

Run:

```bash
pnpm --prefix frontend add remotion @remotion/renderer @remotion/media
```

Expected: `frontend/package.json` includes the three packages.

- [ ] **Step 2: Add failing worker/render architecture tests**

Append:

```ts
test('timeline export worker uses Remotion renderer outside route handlers', () => {
  const rendererPath = join(root, 'frontend/src/server/timeline-exports/renderer.ts');
  const workerPath = join(root, 'frontend/scripts/run-timeline-export-worker.ts');
  const compositionPath = join(root, 'frontend/src/remotion/timeline-export/TimelineComposition.tsx');
  assert.ok(existsSync(rendererPath));
  assert.ok(existsSync(workerPath));
  assert.ok(existsSync(compositionPath));
  assert.match(readFileSync(rendererPath, 'utf8'), /renderTimelineExportJob/);
  assert.match(readFileSync(rendererPath, 'utf8'), /renderMedia/);
  assert.match(readFileSync(rendererPath, 'utf8'), /uploadFileBuffer/);
  assert.match(readFileSync(workerPath, 'utf8'), /claimNextQueuedTimelineExport/);
  assert.match(readFileSync(compositionPath, 'utf8'), /<Sequence/);
  assert.match(readFileSync(compositionPath, 'utf8'), /<Video/);
  assert.match(readFileSync(compositionPath, 'utf8'), /<Audio/);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
```

Expected: FAIL because renderer/worker files do not exist.

- [ ] **Step 4: Add Remotion shared types**

Create `frontend/src/remotion/timeline-export/types.ts`:

```ts
import type { WorkspaceTimelineRenderManifest } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';

export type TimelineExportRenderProps = {
  manifest: WorkspaceTimelineRenderManifest;
  width: number;
  height: number;
  fps: number;
  includeAudio: boolean;
};
```

- [ ] **Step 5: Add composition root**

Create `frontend/src/remotion/timeline-export/Root.tsx`:

```tsx
import React from 'react';
import { Composition } from 'remotion';
import { TimelineComposition } from './TimelineComposition';
import type { TimelineExportRenderProps } from './types';

const defaultProps: TimelineExportRenderProps = {
  manifest: {
    version: 1,
    source: 'maxvideoai-editor',
    projectName: 'Timeline Export',
    createdAt: new Date(0).toISOString(),
    status: 'ready',
    durationSec: 1,
    exportRange: { mode: 'sequence', startSec: 0, endSec: 1, durationSec: 1 },
    tracks: [],
    issues: [],
  },
  width: 1920,
  height: 1080,
  fps: 30,
  includeAudio: true,
};

export function RemotionTimelineExportRoot() {
  return (
    <Composition
      id="MaxVideoAITimelineExport"
      component={TimelineComposition}
      durationInFrames={Math.max(1, Math.ceil(defaultProps.manifest.durationSec * defaultProps.fps))}
      fps={defaultProps.fps}
      width={defaultProps.width}
      height={defaultProps.height}
      defaultProps={defaultProps}
    />
  );
}
```

- [ ] **Step 6: Add timeline composition**

Create `frontend/src/remotion/timeline-export/TimelineComposition.tsx`:

```tsx
import React from 'react';
import { AbsoluteFill, Img, Sequence, useVideoConfig } from 'remotion';
import { Audio, Video } from '@remotion/media';
import type { TimelineExportRenderProps } from './types';

function secondsToFrames(seconds: number, fps: number): number {
  return Math.max(0, Math.round(seconds * fps));
}

function transformStyle(transform: NonNullable<TimelineExportRenderProps['manifest']['tracks'][number]['clips'][number]['transform']> | undefined) {
  const scale = transform?.scale ?? 1;
  const x = transform?.x ?? 0;
  const y = transform?.y ?? 0;
  const rotation = transform?.rotation ?? 0;
  const opacity = transform?.opacity ?? 1;
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    opacity,
    transform: `translate(${x}%, ${y}%) scale(${scale}) rotate(${rotation}deg)`,
  };
}

export function TimelineComposition(props: TimelineExportRenderProps) {
  const { fps } = useVideoConfig();
  const videoTracks = props.manifest.tracks.filter((track) => track.id.startsWith('video'));
  const audioTracks = props.manifest.tracks.filter((track) => track.id.startsWith('audio'));

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', overflow: 'hidden' }}>
      {videoTracks.map((track, trackIndex) =>
        track.clips.map((clip) => {
          const from = secondsToFrames(clip.startSec, fps);
          const durationInFrames = secondsToFrames(clip.durationSec, fps);
          const trimBefore = secondsToFrames(clip.sourceStartSec, fps);
          const trimAfter = secondsToFrames(clip.sourceEndSec, fps);
          return (
            <Sequence key={clip.id} from={from} durationInFrames={durationInFrames} premountFor={fps}>
              <AbsoluteFill style={{ zIndex: trackIndex + 1 }}>
                {clip.mediaKind === 'image' ? (
                  <Img src={clip.mediaUrl} style={transformStyle(clip.transform)} />
                ) : (
                  <Video
                    src={clip.mediaUrl}
                    trimBefore={trimBefore}
                    trimAfter={trimAfter}
                    muted={!props.includeAudio || clip.hasEmbeddedAudio === false}
                    volume={clip.audioMix?.muted ? 0 : (clip.audioMix?.volume ?? 100) / 100}
                    style={transformStyle(clip.transform)}
                  />
                )}
              </AbsoluteFill>
            </Sequence>
          );
        })
      )}
      {props.includeAudio &&
        audioTracks.map((track) =>
          track.clips.map((clip) => (
            <Sequence key={clip.id} from={secondsToFrames(clip.startSec, fps)} durationInFrames={secondsToFrames(clip.durationSec, fps)} premountFor={fps}>
              <Audio
                src={clip.mediaUrl}
                trimBefore={secondsToFrames(clip.sourceStartSec, fps)}
                trimAfter={secondsToFrames(clip.sourceEndSec, fps)}
                muted={clip.audioMix?.muted}
                volume={(clip.audioMix?.volume ?? 100) / 100}
              />
            </Sequence>
          ))
        )}
    </AbsoluteFill>
  );
}
```

- [ ] **Step 7: Add renderer**

Create `frontend/src/server/timeline-exports/renderer.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { uploadFileBuffer } from '@/server/storage';
import { ensureReusableAsset } from '@/server/media-library';
import { releaseFailedTimelineExportBilling } from './billing';
import {
  completeTimelineExportJob,
  failTimelineExportJob,
  updateTimelineExportProgress,
  type TimelineExportJobRecord,
} from './repository';
import type { TimelineExportRenderProps } from '@/remotion/timeline-export/types';

function parseResolution(resolution: string | null): { width: number; height: number } {
  if (resolution?.includes('2160')) return { width: 3840, height: 2160 };
  if (resolution?.includes('720')) return { width: 1280, height: 720 };
  return { width: 1920, height: 1080 };
}

export async function renderTimelineExportJob(job: TimelineExportJobRecord): Promise<void> {
  const outputDir = join(tmpdir(), 'maxvideoai-timeline-exports', job.id);
  const outputPath = join(outputDir, `${job.id}.mp4`);
  mkdirSync(outputDir, { recursive: true });

  try {
    await updateTimelineExportProgress({ exportId: job.id, progress: 15, message: 'Preparing server render.' });
    const dimensions = parseResolution(job.resolution);
    const fps = job.fps ?? 30;
    const inputProps: TimelineExportRenderProps = {
      manifest: job.render_manifest as TimelineExportRenderProps['manifest'],
      width: dimensions.width,
      height: dimensions.height,
      fps,
      includeAudio: Boolean((job.export_settings as { includeAudio?: boolean }).includeAudio ?? true),
    };
    const serveUrl = await bundle({
      entryPoint: require.resolve('@/remotion/timeline-export/Root'),
      webpackOverride: (config) => config,
    });
    const composition = await selectComposition({
      serveUrl,
      id: 'MaxVideoAITimelineExport',
      inputProps,
    });
    await updateTimelineExportProgress({ exportId: job.id, progress: 35, message: 'Rendering frames.' });
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      chromiumOptions: { gl: 'angle' },
      onProgress: ({ progress }) => {
        void updateTimelineExportProgress({
          exportId: job.id,
          progress: 35 + Math.round(progress * 55),
          message: 'Rendering MP4.',
        });
      },
    });
    const data = readFileSync(outputPath);
    await updateTimelineExportProgress({ exportId: job.id, progress: 95, message: 'Uploading export.' });
    const upload = await uploadFileBuffer({
      data,
      mime: 'video/mp4',
      userId: job.user_id,
      prefix: 'timeline-exports',
      fileName: `${job.project_name}.mp4`,
    });
    const asset = await ensureReusableAsset({
      userId: job.user_id,
      url: upload.url,
      kind: 'video',
      source: 'import',
      sourceJobId: job.id,
      label: `${job.project_name}.mp4`,
      mimeType: 'video/mp4',
      width: dimensions.width,
      height: dimensions.height,
      sizeBytes: data.length,
    });
    await completeTimelineExportJob({
      exportId: job.id,
      outputUrl: upload.url,
      outputAssetId: asset.id,
      sizeBytes: data.length,
      mimeType: 'video/mp4',
      billingStatus: job.billing_status === 'free_reserved' ? 'free_completed' : 'paid_completed',
    });
  } catch (error) {
    const nextBillingStatus = await releaseFailedTimelineExportBilling({
      userId: job.user_id,
      exportId: job.id,
      billingStatus: job.billing_status,
      amountCents: job.amount_cents,
    });
    await failTimelineExportJob({
      exportId: job.id,
      message: error instanceof Error ? error.message : 'RENDER_FAILED',
      billingStatus: nextBillingStatus,
    });
  } finally {
    if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 8: Add worker script**

Create `frontend/scripts/run-timeline-export-worker.ts`:

```ts
import 'dotenv/config';
import { claimNextQueuedTimelineExport } from '../src/server/timeline-exports/repository';
import { renderTimelineExportJob } from '../src/server/timeline-exports/renderer';

async function main() {
  const once = process.argv.includes('--once');
  do {
    const job = await claimNextQueuedTimelineExport();
    if (job) {
      await renderTimelineExportJob(job);
    } else if (once) {
      break;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  } while (!once);
}

main().catch((error) => {
  console.error('[timeline-export-worker] fatal', error);
  process.exit(1);
});
```

Update `frontend/package.json` scripts:

```json
"timeline-exports:worker": "tsx scripts/run-timeline-export-worker.ts",
"timeline-exports:worker:once": "tsx scripts/run-timeline-export-worker.ts --once"
```

- [ ] **Step 9: Run tests**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
npm run qa:editor
```

Expected: PASS. If TypeScript fails on Remotion imports, fix path aliases before moving on.

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml tests/timeline-export-server-contract.test.ts frontend/src/remotion/timeline-export frontend/src/server/timeline-exports/renderer.ts frontend/scripts/run-timeline-export-worker.ts
git commit -m "feat: add server timeline render worker"
```

---

### Task 7: Editor Export Dialog Server Flow

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceExportDialog.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/maxvideoai-editor.module.css`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`
- Test: `tests/e2e/editor/editor-timeline.spec.ts`

- [ ] **Step 1: Add failing editor architecture tests**

In `tests/maxvideoai-editor-workspace-architecture.test.ts`, assert server endpoint usage:

```ts
assert.match(workspaceSource, /\/api\/studio\/timeline-exports\/estimate/, 'editor should estimate server export cost');
assert.match(workspaceSource, /\/api\/studio\/timeline-exports/, 'editor should create server export jobs');
assert.doesNotMatch(workspaceSource, /Render backend pending/, 'export button should no longer say render backend is pending');
```

- [ ] **Step 2: Add failing E2E mock test**

In `tests/e2e/editor/editor-timeline.spec.ts`, mock the endpoints:

```ts
await page.route('**/api/studio/timeline-exports/estimate', async (route) => {
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      quota: { freeLimit: 2, usedFreeExports: 0, freeExportsRemaining: 2, billingKind: 'free' },
      estimate: { billingKind: 'free', amountCents: 0, currency: 'USD', freeExportsRemaining: 2 },
    }),
  });
});
await page.route('**/api/studio/timeline-exports', async (route) => {
  if (route.request().method() !== 'POST') return route.continue();
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      export: { id: 'tlx_test', status: 'queued', progress: 0, output_url: null },
      billing: { billingKind: 'free', freeExportsRemaining: 1 },
    }),
  });
});
await page.route('**/api/studio/timeline-exports/tlx_test', async (route) => {
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      export: { id: 'tlx_test', status: 'completed', progress: 100, output_url: 'https://cdn.maxvideoai.com/timeline-exports/test.mp4' },
    }),
  });
});
```

Expected UI assertions:

```ts
await expect(page.getByText('Server render')).toBeVisible();
await page.getByRole('button', { name: /Export video/i }).click();
await expect(page.getByRole('status')).toContainText(/queued|Export ready/i);
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm run test:editor
playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-timeline.spec.ts -g "export"
```

Expected: FAIL because the UI still uses the local-only export flow.

- [ ] **Step 4: Implement estimate/create/poll in `WorkspacePage.client.tsx`**

Replace `handleExportTimelineVideo` localStorage-only behavior with:

```ts
const [activeExportJobId, setActiveExportJobId] = useState<string | null>(null);
const [exportEstimate, setExportEstimate] = useState<null | {
  billingKind: 'free' | 'paid';
  amountCents: number;
  currency: string;
  freeExportsRemaining: number;
}>(null);

async function estimateTimelineServerExport(request: WorkspaceTimelineVideoExportRequest) {
  const response = await fetch('/api/studio/timeline-exports/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'EXPORT_ESTIMATE_FAILED');
  setExportEstimate(payload.estimate);
}

async function handleExportTimelineVideo() {
  const request = buildWorkspaceTimelineVideoExportRequest(exportManifest, {
    qualityPreset: exportQualityPreset,
    includeAudio: true,
  });
  const response = await fetch('/api/studio/timeline-exports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    setExportVideoFeedback(payload.error ?? 'Export failed to start.');
    return;
  }
  setActiveExportJobId(payload.export.id);
  setExportVideoFeedback('Server export queued.');
}
```

Add a `useEffect` that polls `activeExportJobId` every 2 seconds until `completed` or `failed`.

- [ ] **Step 5: Update the export dialog UI**

`WorkspaceExportDialog.tsx` should render:

```tsx
<section className={styles.exportSection}>
  <h3>Server render</h3>
  <p>{estimate.billingKind === 'free' ? `Free export ${estimate.freeExportsRemaining}/2 remaining` : `Estimated cost $${(estimate.amountCents / 100).toFixed(2)}`}</p>
  <button type="button" onClick={onExportVideo}>Export video</button>
</section>
```

Keep EDL as a separate secondary action.

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test:editor
playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-timeline.spec.ts -g "export"
npm run qa:editor
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/WorkspacePage.client.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceExportDialog.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/maxvideoai-editor.module.css tests/maxvideoai-editor-workspace-architecture.test.ts tests/e2e/editor/editor-timeline.spec.ts
git commit -m "feat: connect editor export to server render jobs"
```

---

### Task 8: Operational Documentation And QA

**Files:**
- Create: `docs/engineering/maxvideoai-editor-server-render.md`
- Modify: `package.json`
- Test: `tests/timeline-export-server-contract.test.ts`

- [ ] **Step 1: Add documentation test**

Append:

```ts
test('server render operations guide exists', () => {
  const docPath = join(root, 'docs/engineering/maxvideoai-editor-server-render.md');
  assert.ok(existsSync(docPath));
  const source = readFileSync(docPath, 'utf8');
  assert.match(source, /timeline-exports:worker/);
  assert.match(source, /two free server exports/i);
  assert.match(source, /app_timeline_exports/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
```

Expected: FAIL because the guide does not exist.

- [ ] **Step 3: Write the operations guide**

Create `docs/engineering/maxvideoai-editor-server-render.md`:

```md
# MaxVideoAI Editor Server Render

The editor export flow creates `app_timeline_exports` jobs from the route-local timeline manifest.

## User Billing

- Every authenticated user receives two free server exports.
- Free exports are reserved while queued or rendering.
- Paid exports create an `app_receipts` charge with `surface = timeline_export` and `billing_product_key = server_render`.
- Failed paid exports create a refund receipt.

## Worker

Run one job:

```bash
pnpm --prefix frontend run timeline-exports:worker:once
```

Run continuously:

```bash
pnpm --prefix frontend run timeline-exports:worker
```

The worker claims one queued job with `FOR UPDATE SKIP LOCKED`, renders the Remotion composition to MP4, uploads it under `timeline-exports/`, and saves it into media library.

## Failure Policy

- Missing media blocks the API before queueing.
- Worker render failures mark the job failed.
- Free quota is released when a free job fails.
- Paid jobs are refunded when they fail before completion.
```

- [ ] **Step 4: Add root convenience script**

In root `package.json`, add:

```json
"timeline-exports:worker": "pnpm --prefix frontend run timeline-exports:worker",
"timeline-exports:worker:once": "pnpm --prefix frontend run timeline-exports:worker:once"
```

- [ ] **Step 5: Run final validation**

Run:

```bash
npm run test:validate -- tests/timeline-export-server-contract.test.ts
npm run test:editor
npm run test:editor:e2e
npm run qa:editor
git diff --check
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/engineering/maxvideoai-editor-server-render.md package.json tests/timeline-export-server-contract.test.ts
git commit -m "docs: document editor server render operations"
```

---

## Rollout Plan

1. Ship API + UI behind the existing editor route only.
2. Deploy DB schema first.
3. Run one worker instance with low concurrency.
4. Keep quality presets to `draft`, `standard`, `high`; do not add codec menus yet.
5. Monitor queue duration, render duration, storage upload failures, failed/refunded exports, and paid conversion.
6. After stable operation, expose export history in the library/dashboard.

## Risks And Controls

- **HTTP timeout:** render runs in worker, not route handler.
- **Quota abuse:** free quota is reserved while jobs are active and only released on failure.
- **Wallet mismatch:** paid export charges use existing `app_receipts`.
- **Media CORS / private URLs:** worker should render only stable public or signed URLs; request validation should block unresolved placeholders.
- **Huge renders:** pricing and endpoint should reject exports over a first-pass limit, for example 10 minutes or 4K high until infrastructure is proven.
- **Worker crash:** jobs left in `rendering` need a future stale-job recovery command; add it after first worker pass if needed.

## Self-Review

- Spec coverage: server render, two free exports, paid cost after quota, real MP4 worker, media-library persistence, UI state, and testing are covered.
- Placeholder scan: no task depends on an undefined "later" implementation; each task has file paths, commands, expected results, and code shape.
- Type consistency: the plan consistently uses `WorkspaceTimelineVideoExportRequest`, `app_timeline_exports`, `TimelineExportJobRecord`, `billingKind`, and `billingStatus`.
