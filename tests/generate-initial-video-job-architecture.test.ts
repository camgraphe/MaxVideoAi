import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/initial-video-job.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');
const preparedSource = readFileSync(join(root, 'frontend/src/server/video-generation/execute-prepared-video-generation.ts'), 'utf8');
const reservationSource = readFileSync(join(root, 'frontend/src/server/generations/initial-job-reservation.ts'), 'utf8');

test('generate route delegates initial video job persistence', () => {
  assert.ok(existsSync(helperPath), 'initial video job persistence should live in the generate route _lib folder');
  assert.match(preparedSource, /generate\/_lib\/initial-video-job/);

  for (const typeName of [
    'PendingReceipt',
    'ExistingVideoJobRow',
    'ExistingVideoChargeRow',
    'ProvisionalVideoJobInsert',
    'CreateVideoInitialJobParams',
    'VideoInitialJobResult',
  ]) {
    assert.doesNotMatch(routeSource, new RegExp(`type ${typeName} =`), `${typeName} belongs in initial-video-job.ts`);
  }

  for (const implementationName of [
    'buildResponseFromExistingVideoJob',
    'insertProvisionalVideoJob',
    'createInitialVideoJobInExecutor',
    'createAtomicInitialVideoJob',
  ]) {
    assert.doesNotMatch(
      routeSource,
      new RegExp(`function ${implementationName}\\(`),
      `${implementationName} belongs in initial-video-job.ts`
    );
  }

  assert.doesNotMatch(routeSource, /class VideoInitialJobError/, 'VideoInitialJobError belongs in initial-video-job.ts');
  assert.doesNotMatch(routeSource, /reserveWalletChargeInExecutor/, 'wallet reservation belongs in initial-video-job.ts');
  assert.doesNotMatch(routeSource, /withDbTransaction/, 'initial job transaction wrapper belongs in initial-video-job.ts');
  assert.doesNotMatch(routeSource, /QueryExecutor/, 'initial job executor type belongs in initial-video-job.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 2600, `/api/generate route should stay below 2600 lines after initial job extraction, got ${lineCount}`);
});

test('initial video job helper exposes the route contract', () => {
  assert.match(helperSource, /export class VideoInitialJobError/, 'VideoInitialJobError should be exported');
  assert.match(helperSource, /export type PendingReceipt =/, 'PendingReceipt should be exported for rollback paths');
  assert.match(helperSource, /export type ExistingVideoJobRow =/, 'ExistingVideoJobRow should be exported for idempotency lookup');
  assert.match(helperSource, /export type PaymentMode =/, 'PaymentMode should be exported for route payment branching');
  assert.match(helperSource, /export function buildResponseFromExistingVideoJob/, 'existing job response helper should be exported');
  assert.match(helperSource, /export async function createAtomicInitialVideoJob/, 'atomic initial job creator should be exported');

  assert.match(helperSource, /reserveWalletChargeInExecutor/, 'wallet reservation should stay with initial job creation');
  assert.match(helperSource, /lockInitialJobReservation/, 'initial job creation should use the shared transaction lock');
  assert.match(reservationSource, /pg_advisory_xact_lock/, 'shared reservation owner should hold the advisory lock');
  assert.match(helperSource, /INSERT INTO app_jobs/, 'provisional job insert should stay with initial job creation');
});
