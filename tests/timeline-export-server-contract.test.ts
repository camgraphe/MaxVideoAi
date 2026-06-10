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
const ecsRunnerPath = join(root, 'frontend/src/server/timeline-exports/ecs-runner.ts');
const workerPreflightPath = join(root, 'frontend/src/server/timeline-exports/worker-preflight.ts');
const rendererPath = join(root, 'frontend/src/server/timeline-exports/renderer.ts');
const workerPath = join(root, 'frontend/scripts/run-timeline-export-worker.ts');
const compositionPath = join(root, 'frontend/src/remotion/timeline-export/TimelineComposition.tsx');
const operationsGuidePath = join(root, 'docs/engineering/maxvideoai-editor-server-render.md');
const workerDockerfilePath = join(root, 'Dockerfile.timeline-worker');
const envExamplePath = join(root, 'frontend/.env.local.example');

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
  assert.match(source, /claimQueuedTimelineExportById/);
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
  assert.match(createRouteSource, /export const runtime = 'nodejs'/);
  assert.match(createRouteSource, /readTimelineExportJobByIdempotencyKey/);
  assert.match(createRouteSource, /assertTimelineExportWorkerLauncherConfigured/);
  assert.match(createRouteSource, /TIMELINE_EXPORT_WORKER_NOT_CONFIGURED/);
  assert.match(createRouteSource, /launchTimelineExportWorkerTask/);
  assert.match(createRouteSource, /!result\.reused && result\.job\.status === 'queued'/);
  assert.match(createRouteSource, /releaseFailedTimelineExportBilling/);
  assert.match(createRouteSource, /failTimelineExportJob/);
  assert.doesNotMatch(createRouteSource, /reserveTimelineExportBilling/, 'route should not reserve billing separately from job creation');
});

test('timeline export ECS runner starts one Fargate task without long route rendering', () => {
  assert.ok(existsSync(ecsRunnerPath), 'ECS runner should exist');
  const source = readFileSync(ecsRunnerPath, 'utf8');
  assert.match(source, /import 'server-only'/, 'ECS runner should stay server-only');
  assert.match(source, /@aws-sdk\/client-ecs/, 'ECS runner should use the ECS SDK');
  assert.match(source, /RunTaskCommand/, 'ECS runner should launch tasks with RunTask');
  assert.match(source, /assertTimelineExportWorkerLauncherConfigured/, 'ECS runner should expose a non-launching config preflight');
  assert.match(source, /launchType:\s*'FARGATE'/, 'ECS runner should launch Fargate tasks');
  assert.match(source, /assignPublicIp:\s*'ENABLED'/, 'ECS runner should use public subnets without NAT');
  assert.match(source, /containerOverrides/, 'ECS runner should pass export targeting into the worker container');
  assert.match(source, /TIMELINE_EXPORT_TARGET_ID/, 'ECS runner should target the export that triggered the task');
  assert.match(source, /TIMELINE_EXPORT_ECS_CONTAINER_NAME/, 'ECS runner should allow task definition container name overrides');
  assert.match(source, /TIMELINE_EXPORT_ECS_CLUSTER/);
  assert.match(source, /TIMELINE_EXPORT_ECS_TASK_DEFINITION/);
  assert.match(source, /TIMELINE_EXPORT_ECS_SUBNETS/);
  assert.match(source, /TIMELINE_EXPORT_ECS_SECURITY_GROUP/);
  assert.match(source, /TIMELINE_EXPORT_ECS_REGION/);
  assert.match(source, /NODE_ENV === 'test'/, 'tests should not launch real ECS tasks');
  assert.doesNotMatch(source, /CreateServiceCommand|UpdateServiceCommand/, 'exports should not create or update an always-on ECS service');
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
  assert.ok(existsSync(workerPreflightPath), 'worker preflight should exist');
  assert.ok(existsSync(compositionPath), 'Remotion composition should exist');
  const rendererSource = readFileSync(rendererPath, 'utf8');
  const workerSource = readFileSync(workerPath, 'utf8');
  const preflightSource = readFileSync(workerPreflightPath, 'utf8');
  assert.match(rendererSource, /renderTimelineExportJob/);
  assert.match(rendererSource, /renderMedia/);
  assert.match(rendererSource, /uploadFileBuffer/);
  assert.match(rendererSource, /TIMELINE_EXPORT_OUTPUT_MISSING/);
  assert.match(rendererSource, /TIMELINE_EXPORT_OUTPUT_EMPTY/);
  assert.match(workerSource, /claimNextQueuedTimelineExport/);
  assert.match(workerSource, /claimQueuedTimelineExportById/);
  assert.match(workerSource, /TIMELINE_EXPORT_TARGET_ID/);
  assert.match(workerSource, /--export-id/);
  assert.match(workerSource, /assertTimelineExportWorkerEnvironment/);
  assert.match(preflightSource, /TIMELINE_EXPORT_WORKER_REQUIRES_ONCE/);
  assert.match(preflightSource, /isDatabaseConfigured/);
  assert.match(preflightSource, /isStorageConfigured/);
  assert.match(preflightSource, /CHROME_BIN/);
  assert.match(readFileSync(compositionPath, 'utf8'), /<Sequence/);
  assert.match(readFileSync(compositionPath, 'utf8'), /<Video/);
  assert.match(readFileSync(compositionPath, 'utf8'), /<Audio/);
});

test('timeline export worker has a dedicated Docker image and documented env', () => {
  assert.ok(existsSync(workerDockerfilePath), 'dedicated worker Dockerfile should exist');
  const dockerfile = readFileSync(workerDockerfilePath, 'utf8');
  assert.match(dockerfile, /pnpm.*timeline-exports:worker:once/, 'worker image should run one queued export and exit');
  assert.match(dockerfile, /chromium/, 'worker image should install Chromium for Remotion');
  assert.match(dockerfile, /ffmpeg/, 'worker image should install FFmpeg for MP4 rendering');
  assert.doesNotMatch(dockerfile, /mock-server\.js/, 'worker image must not reuse the mock API runtime');

  const envSource = readFileSync(envExamplePath, 'utf8');
  assert.match(envSource, /TIMELINE_EXPORT_ECS_REGION=us-east-1/);
  assert.match(envSource, /TIMELINE_EXPORT_ECS_CLUSTER=maxvideoai-timeline-exports/);
  assert.match(envSource, /TIMELINE_EXPORT_ECS_TASK_DEFINITION=maxvideoai-timeline-export-worker:2/);
  assert.match(envSource, /TIMELINE_EXPORT_ECS_CONTAINER_NAME=timeline-export-worker/);
  assert.match(envSource, /TIMELINE_EXPORT_ECS_SECURITY_GROUP=sg-04be7e4806ef5f77a/);
  assert.match(envSource, /TIMELINE_EXPORT_ECS_SUBNETS=/);
  assert.doesNotMatch(envSource, /videohub-uploader/, 'worker docs should not reuse broad uploader credentials');
});

test('server render operations guide exists', () => {
  assert.ok(existsSync(operationsGuidePath), 'server render operations guide should exist');
  const source = readFileSync(operationsGuidePath, 'utf8');
  assert.match(source, /timeline-exports:worker/);
  assert.match(source, /preflight rejects loop mode/);
  assert.match(source, /DATABASE_URL/);
  assert.match(source, /Empty or missing MP4 output/);
  assert.match(source, /RunTask/);
  assert.match(source, /TIMELINE_EXPORT_TARGET_ID/);
  assert.match(source, /TIMELINE_EXPORT_ECS_CONTAINER_NAME/);
  assert.match(source, /Dockerfile\.timeline-worker/);
  assert.match(source, /ecs:RunTask/);
  assert.match(source, /iam:PassRole/);
  assert.match(source, /two free server exports/i);
  assert.match(source, /app_timeline_exports/);
});
