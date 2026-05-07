import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const executorPath = join(root, 'frontend/src/server/images/execute-image-generation.ts');
const existingJobResponsePath = join(root, 'frontend/src/server/images/existing-image-job-response.ts');

const executorSource = readFileSync(executorPath, 'utf8');
const existingJobResponseSource = readFileSync(existingJobResponsePath, 'utf8');

test('image generation executor delegates existing job response rebuilding', () => {
  assert.ok(existsSync(existingJobResponsePath), 'existing image job response helpers should live in a focused module');
  assert.match(executorSource, /from '\.\/existing-image-job-response'/);
  assert.match(executorSource, /export \{ buildResponseFromExistingJob \} from '\.\/existing-image-job-response'/);
});

test('image generation executor does not regain existing job response ownership', () => {
  assert.doesNotMatch(executorSource, /function buildImagesFromExistingJob\(/, 'stored render parsing belongs in existing-image-job-response.ts');
  assert.doesNotMatch(executorSource, /function parseResolutionFromSettingsSnapshot\(/, 'settings snapshot resolution parsing belongs in existing-image-job-response.ts');
  assert.doesNotMatch(executorSource, /parseStoredImageRenders/, 'stored render parsing belongs in existing-image-job-response.ts');

  const lineCount = executorSource.split('\n').length;
  assert.ok(lineCount <= 1740, `image generation executor should stay below 1740 lines after existing-job response extraction, got ${lineCount}`);
});

test('existing image job response module exposes the expected contract', () => {
  assert.match(existingJobResponseSource, /export type ExistingImageJobRow/);
  assert.match(existingJobResponseSource, /export function parseResolutionFromSettingsSnapshot/);
  assert.match(existingJobResponseSource, /export function buildResponseFromExistingJob/);
  assert.match(existingJobResponseSource, /parseStoredImageRenders/);
});
