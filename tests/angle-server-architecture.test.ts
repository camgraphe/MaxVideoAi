import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const serverPath = join(root, 'frontend/src/server/tools/angle.ts');
const requestUtilsPath = join(root, 'frontend/src/server/tools/angle-request-utils.ts');
const outputPersistencePath = join(root, 'frontend/src/server/tools/angle-output-persistence.ts');
const angleErrorPath = join(root, 'frontend/src/server/tools/angle-error.ts');
const angleReceiptsPath = join(root, 'frontend/src/server/tools/angle-receipts.ts');
const angleInitialJobPath = join(root, 'frontend/src/server/tools/angle-initial-job.ts');
const angleEventLogPath = join(root, 'frontend/src/server/tools/angle-event-log.ts');

const serverSource = readFileSync(serverPath, 'utf8');
const requestUtilsSource = readFileSync(requestUtilsPath, 'utf8');
const outputPersistenceSource = readFileSync(outputPersistencePath, 'utf8');
const angleErrorSource = readFileSync(angleErrorPath, 'utf8');
const angleReceiptsSource = readFileSync(angleReceiptsPath, 'utf8');
const angleInitialJobSource = readFileSync(angleInitialJobPath, 'utf8');
const angleEventLogSource = readFileSync(angleEventLogPath, 'utf8');

test('angle server delegates request and provider normalization helpers', () => {
  assert.ok(existsSync(requestUtilsPath), 'angle request helpers should live in a server-local utility module');
  assert.match(
    serverSource,
    /from '\.\/angle-request-utils'/,
    'angle server orchestration should import request/provider helpers'
  );

  for (const implementationName of [
    'getAngleBillingProductKeyForEngine',
    'buildAnglePromptSummary',
    'buildAngleSettingsSnapshot',
    'normalizeFalUrl',
    'toAngleOutput',
    'extractOutputs',
    'parseRequestId',
    'extractActualCostUsd',
    'buildFalInput',
    'toValidationMessage',
  ]) {
    assert.doesNotMatch(
      serverSource,
      new RegExp(`function ${implementationName}\\(`),
      `${implementationName} belongs in angle-request-utils.ts`
    );
  }

  assert.doesNotMatch(serverSource, /normalizeMediaUrl/, 'Fal output URL normalization belongs in angle-request-utils.ts');

  const lineCount = serverSource.split('\n').length;
  assert.ok(lineCount <= 460, `angle server orchestrator should stay below 460 lines after helper extraction, got ${lineCount}`);
});

test('angle server delegates output persistence to a focused helper', () => {
  assert.ok(existsSync(outputPersistencePath), 'angle output persistence should live in a server-local helper module');
  assert.match(
    serverSource,
    /from '\.\/angle-output-persistence'/,
    'angle server orchestration should import output persistence helpers'
  );
  assert.doesNotMatch(
    serverSource,
    /async function persistAngleOutput/,
    'single-output persistence should not live in the route-level orchestrator'
  );
  assert.match(
    outputPersistenceSource,
    /export async function persistAngleOutputs/,
    'angle output persistence helper should export the batch persistence contract'
  );
  assert.match(
    outputPersistenceSource,
    /recordUserAsset/,
    'angle output persistence helper should own media-library asset recording'
  );
  assert.match(
    outputPersistenceSource,
    /uploadImageToStorage/,
    'angle output persistence helper should own storage upload details'
  );
});

test('angle request utils expose the expected pure helper contract', () => {
  for (const exportName of [
    'ANGLE_SURFACE',
    'ANGLE_MULTI_OUTPUT_COUNT',
    'getAngleBillingProductKeyForEngine',
    'buildAnglePromptSummary',
    'buildAngleSettingsSnapshot',
    'extractAngleOutputs',
    'parseAngleRequestId',
    'extractAngleActualCostUsd',
    'buildAngleFalInput',
    'toAngleValidationMessage',
  ]) {
    assert.match(
      requestUtilsSource,
      new RegExp(`export (const|function) ${exportName}`),
      `${exportName} should be exported by angle-request-utils.ts`
    );
  }

  assert.match(requestUtilsSource, /function normalizeFalUrl\(/, 'Fal URL normalization should be private to request helpers');
  assert.match(requestUtilsSource, /function toAngleOutput\(/, 'provider output mapping should be private to request helpers');
});

test('angle server delegates wallet, receipt, and event-log responsibilities', () => {
  for (const [path, label] of [
    [angleErrorPath, 'angle error helper'],
    [angleReceiptsPath, 'angle receipt helper'],
    [angleInitialJobPath, 'angle initial job helper'],
    [angleEventLogPath, 'angle event log helper'],
  ] as const) {
    assert.ok(existsSync(path), `${label} should live in a server-local helper module`);
  }

  for (const importName of ['angle-error', 'angle-receipts', 'angle-initial-job', 'angle-event-log']) {
    assert.match(serverSource, new RegExp(`from '\\./${importName}'`), `angle server should import ${importName}`);
  }

  assert.match(serverSource, /export \{ AngleToolError \} from '\.\/angle-error'/, 'legacy error export should stay stable');
  assert.match(
    serverSource,
    /export \{ createAngleInitialJobInExecutor \} from '\.\/angle-initial-job'/,
    'legacy initial-job export should stay stable'
  );

  for (const implementationPattern of [
    /export class AngleToolError/,
    /reserveWalletChargeInExecutor/,
    /withDbTransaction/,
    /async function insertProvisionalAngleJob/,
    /async function recordAngleRefundReceipt/,
    /async function insertToolEvent/,
  ]) {
    assert.doesNotMatch(serverSource, implementationPattern, 'angle.ts should stay focused on run orchestration');
  }

  assert.match(angleErrorSource, /export class AngleToolError/, 'angle-error should own the public error class');
  assert.match(angleReceiptsSource, /export type PendingAngleReceipt/, 'angle-receipts should export pending receipt data');
  assert.match(
    angleReceiptsSource,
    /export async function recordAngleRefundReceipt/,
    'angle-receipts should own refund receipt persistence'
  );
  assert.match(angleInitialJobSource, /export const PLACEHOLDER_THUMB/, 'angle-initial-job should own placeholder metadata');
  assert.match(
    angleInitialJobSource,
    /export async function createAngleInitialJobInExecutor/,
    'angle-initial-job should export the testable transaction inner contract'
  );
  assert.match(
    angleInitialJobSource,
    /export async function createAtomicInitialAngleJob/,
    'angle-initial-job should export atomic initial-job persistence'
  );
  assert.match(
    angleInitialJobSource,
    /reserveWalletChargeInExecutor/,
    'angle-initial-job should own wallet reservation preflight'
  );
  assert.match(angleInitialJobSource, /withDbTransaction/, 'angle-initial-job should own the transaction boundary');
  assert.match(angleEventLogSource, /export const TOOL_EVENT_NAME/, 'angle-event-log should own the event name');
  assert.match(
    angleEventLogSource,
    /export async function insertAngleToolEvent/,
    'angle-event-log should own Fal queue event persistence'
  );
});
