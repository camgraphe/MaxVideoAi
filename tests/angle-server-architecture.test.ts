import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const serverPath = join(root, 'frontend/src/server/tools/angle.ts');
const requestUtilsPath = join(root, 'frontend/src/server/tools/angle-request-utils.ts');

const serverSource = readFileSync(serverPath, 'utf8');
const requestUtilsSource = readFileSync(requestUtilsPath, 'utf8');

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
  assert.ok(lineCount <= 820, `angle server orchestrator should stay below 820 lines after helper extraction, got ${lineCount}`);
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
