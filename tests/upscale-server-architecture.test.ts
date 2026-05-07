import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const serverPath = join(root, 'frontend/src/server/tools/upscale.ts');
const requestUtilsPath = join(root, 'frontend/src/server/tools/upscale-request-utils.ts');

const serverSource = readFileSync(serverPath, 'utf8');
const requestUtilsSource = readFileSync(requestUtilsPath, 'utf8');

test('upscale server delegates request and provider normalization helpers', () => {
  assert.ok(existsSync(requestUtilsPath), 'upscale request helpers should live in a server-local utility module');
  assert.match(
    serverSource,
    /from '\.\/upscale-request-utils'/,
    'upscale server orchestration should import request/provider helpers'
  );

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
  ]) {
    assert.doesNotMatch(
      serverSource,
      new RegExp(`function ${implementationName}\\(`),
      `${implementationName} belongs in upscale-request-utils.ts`
    );
  }

  const lineCount = serverSource.split('\n').length;
  assert.ok(lineCount <= 900, `upscale server orchestrator should stay below 900 lines after helper extraction, got ${lineCount}`);
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
