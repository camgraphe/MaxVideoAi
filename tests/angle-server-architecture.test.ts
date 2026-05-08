import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const serverPath = join(root, 'frontend/src/server/tools/angle.ts');
const requestUtilsPath = join(root, 'frontend/src/server/tools/angle-request-utils.ts');
const outputPersistencePath = join(root, 'frontend/src/server/tools/angle-output-persistence.ts');

const serverSource = readFileSync(serverPath, 'utf8');
const requestUtilsSource = readFileSync(requestUtilsPath, 'utf8');
const outputPersistenceSource = readFileSync(outputPersistencePath, 'utf8');

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
  assert.ok(lineCount <= 700, `angle server orchestrator should stay below 700 lines after helper extraction, got ${lineCount}`);
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
