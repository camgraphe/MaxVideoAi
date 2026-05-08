import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const serverPath = join(root, 'frontend/src/server/tools/upscale.ts');
const requestUtilsPath = join(root, 'frontend/src/server/tools/upscale-request-utils.ts');
const jobPersistencePath = join(root, 'frontend/src/server/tools/upscale-job-persistence.ts');
const outputPersistencePath = join(root, 'frontend/src/server/tools/upscale-output-persistence.ts');
const errorsPath = join(root, 'frontend/src/server/tools/upscale-errors.ts');
const constantsPath = join(root, 'frontend/src/server/tools/upscale-constants.ts');

const serverSource = readFileSync(serverPath, 'utf8');
const requestUtilsSource = readFileSync(requestUtilsPath, 'utf8');
const jobPersistenceSource = readFileSync(jobPersistencePath, 'utf8');
const outputPersistenceSource = readFileSync(outputPersistencePath, 'utf8');
const errorsSource = readFileSync(errorsPath, 'utf8');
const constantsSource = readFileSync(constantsPath, 'utf8');

test('upscale server delegates request and provider normalization helpers', () => {
  assert.ok(existsSync(requestUtilsPath), 'upscale request helpers should live in a server-local utility module');
  assert.ok(existsSync(jobPersistencePath), 'upscale job persistence should live in a focused server module');
  assert.ok(existsSync(outputPersistencePath), 'upscale output persistence should live in a focused server module');
  assert.ok(existsSync(errorsPath), 'upscale errors should live in a small shared server module');
  assert.ok(existsSync(constantsPath), 'upscale constants should live in a small shared server module');
  assert.match(
    serverSource,
    /from '\.\/upscale-request-utils'/,
    'upscale server orchestration should import request/provider helpers'
  );
  assert.match(serverSource, /from '\.\/upscale-job-persistence'/);
  assert.match(serverSource, /from '\.\/upscale-output-persistence'/);
  assert.match(serverSource, /from '\.\/upscale-errors'/);
  assert.match(serverSource, /from '\.\/upscale-constants'/);

  for (const implementationName of [
    'normalizeFalUrl',
    'seedVideoFormat',
    'toUpscaleOutput',
    'extractOutput',
    'parseRequestId',
    'extractActualCostUsd',
    'resolveTopazTargetFactor',
    'buildFalInput',
    'buildPromptSummary',
    'buildSettingsSnapshot',
    'clonePricingWithDynamicTotal',
    'toValidationMessage',
    'recordUpscaleRefundReceipt',
    'insertProvisionalUpscaleJob',
    'createUpscaleInitialJobInExecutor',
    'createAtomicInitialUpscaleJob',
    'insertUpscaleToolEvent',
    'persistUpscaleOutput',
  ]) {
    assert.doesNotMatch(
      serverSource,
      new RegExp(`function ${implementationName}\\(`),
      `${implementationName} belongs in upscale-request-utils.ts`
    );
  }

  const lineCount = serverSource.split('\n').length;
  assert.ok(lineCount <= 560, `upscale server orchestrator should stay below 560 lines after persistence extraction, got ${lineCount}`);
});

test('upscale request utils expose the expected pure helper contract', () => {
  for (const exportName of [
    'UPSCALE_SURFACE',
    'formatToImageMime',
    'formatToVideoMime',
    'extractUpscaleOutput',
    'parseUpscaleRequestId',
    'extractUpscaleActualCostUsd',
    'buildUpscaleFalInput',
    'buildUpscalePromptSummary',
    'buildUpscaleSettingsSnapshot',
    'cloneUpscalePricingWithDynamicTotal',
    'toUpscaleValidationMessage',
  ]) {
    assert.match(
      requestUtilsSource,
      new RegExp(`export (const|function) ${exportName}`),
      `${exportName} should be exported by upscale-request-utils.ts`
    );
  }

  assert.match(requestUtilsSource, /export type VideoMetadata =/, 'VideoMetadata should move with provider request helpers');
  assert.match(requestUtilsSource, /function normalizeFalUrl\(/, 'Fal URL normalization should be private to request helpers');
  assert.match(requestUtilsSource, /function seedVideoFormat\(/, 'video format mapping should be private to request helpers');
});

test('upscale persistence modules expose job, event, output, and error contracts', () => {
  for (const exportName of ['recordUpscaleRefundReceipt', 'createAtomicInitialUpscaleJob', 'insertUpscaleToolEvent']) {
    assert.match(jobPersistenceSource, new RegExp(`export async function ${exportName}`));
  }
  assert.match(jobPersistenceSource, /export type PendingUpscaleReceipt/);
  assert.match(jobPersistenceSource, /export type CreateUpscaleInitialJobParams/);
  assert.match(outputPersistenceSource, /export async function persistUpscaleOutput/);
  assert.match(errorsSource, /export class UpscaleToolError/);
  assert.match(constantsSource, /export const UPSCALE_TOOL_EVENT_NAME/);
  assert.match(constantsSource, /export const UPSCALE_PLACEHOLDER_THUMB/);
});
