import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  MAX_FREE_TIMELINE_SERVER_EXPORTS,
  estimateTimelineExportPrice,
  resolveTimelineExportQuota,
} from '../frontend/src/server/timeline-exports/pricing';

const root = process.cwd();
const schemaPath = join(root, 'frontend/src/server/timeline-exports/schema.ts');
const repositoryPath = join(root, 'frontend/src/server/timeline-exports/repository.ts');
const billingPath = join(root, 'frontend/src/server/timeline-exports/billing.ts');
const rendererPath = join(root, 'frontend/src/server/timeline-exports/renderer.ts');
const workerPath = join(root, 'frontend/scripts/run-timeline-export-worker.ts');
const compositionPath = join(root, 'frontend/src/remotion/timeline-export/TimelineComposition.tsx');
const operationsGuidePath = join(root, 'docs/engineering/maxvideoai-editor-server-render.md');

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

test('timeline export schema defines durable export jobs with quota and billing fields', () => {
  assert.ok(existsSync(schemaPath), 'schema helper should exist');
  const source = readFileSync(schemaPath, 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS app_timeline_exports/);
  assert.match(source, /idempotency_key TEXT NOT NULL/);
  assert.match(source, /billing_status TEXT NOT NULL/);
  assert.match(source, /render_manifest JSONB NOT NULL/);
  assert.match(source, /output_url TEXT/);
});

test('timeline export repository owns job creation and claim operations', () => {
  assert.ok(existsSync(repositoryPath), 'repository helper should exist');
  const source = readFileSync(repositoryPath, 'utf8');
  assert.match(source, /createTimelineExportJob/);
  assert.match(source, /claimNextQueuedTimelineExport/);
  assert.match(source, /completeTimelineExportJob/);
  assert.match(source, /failTimelineExportJob/);
});

test('timeline export billing reserves free quota before paid wallet charge', () => {
  assert.ok(existsSync(billingPath), 'billing helper should exist');
  const source = readFileSync(billingPath, 'utf8');
  assert.match(source, /reserveTimelineExportBilling/);
  assert.match(source, /free_reserved/);
  assert.match(source, /paid_reserved/);
  assert.match(source, /INSERT INTO app_receipts/);
  assert.match(source, /surface,\s*billing_product_key/);
});

test('timeline export creation reserves billing and inserts the job atomically', () => {
  const billingSource = readFileSync(billingPath, 'utf8');
  const createRouteSource = readFileSync(join(root, 'frontend/app/api/studio/timeline-exports/route.ts'), 'utf8');
  assert.match(billingSource, /createTimelineExportJobWithReservation/);
  assert.match(billingSource, /withDbTransaction/);
  assert.match(billingSource, /pg_advisory_xact_lock/);
  assert.match(billingSource, /INSERT INTO app_timeline_exports/);
  assert.match(createRouteSource, /createTimelineExportJobWithReservation/);
  assert.doesNotMatch(createRouteSource, /reserveTimelineExportBilling/, 'route should not reserve billing separately from job creation');
});

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

test('timeline export worker uses Remotion renderer outside route handlers', () => {
  assert.ok(existsSync(rendererPath), 'renderer should exist');
  assert.ok(existsSync(workerPath), 'worker script should exist');
  assert.ok(existsSync(compositionPath), 'Remotion composition should exist');
  assert.match(readFileSync(rendererPath, 'utf8'), /renderTimelineExportJob/);
  assert.match(readFileSync(rendererPath, 'utf8'), /renderMedia/);
  assert.match(readFileSync(rendererPath, 'utf8'), /uploadFileBuffer/);
  assert.match(readFileSync(workerPath, 'utf8'), /claimNextQueuedTimelineExport/);
  assert.match(readFileSync(compositionPath, 'utf8'), /<Sequence/);
  assert.match(readFileSync(compositionPath, 'utf8'), /<Video/);
  assert.match(readFileSync(compositionPath, 'utf8'), /<Audio/);
});

test('server render operations guide exists', () => {
  assert.ok(existsSync(operationsGuidePath), 'server render operations guide should exist');
  const source = readFileSync(operationsGuidePath, 'utf8');
  assert.match(source, /timeline-exports:worker/);
  assert.match(source, /two free server exports/i);
  assert.match(source, /app_timeline_exports/);
});
