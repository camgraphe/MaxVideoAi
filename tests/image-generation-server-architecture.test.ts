import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const executorPath = join(root, 'frontend/src/server/images/execute-image-generation.ts');
const existingJobResponsePath = join(root, 'frontend/src/server/images/existing-image-job-response.ts');
const referenceNormalizationPath = join(root, 'frontend/src/server/images/image-reference-normalization.ts');

const executorSource = readFileSync(executorPath, 'utf8');
const existingJobResponseSource = readFileSync(existingJobResponsePath, 'utf8');
const referenceNormalizationSource = readFileSync(referenceNormalizationPath, 'utf8');

test('image generation executor delegates existing job response rebuilding', () => {
  assert.ok(existsSync(existingJobResponsePath), 'existing image job response helpers should live in a focused module');
  assert.ok(existsSync(referenceNormalizationPath), 'image reference normalization should live in a focused module');
  assert.match(executorSource, /from '\.\/existing-image-job-response'/);
  assert.match(executorSource, /from '\.\/image-reference-normalization'/);
  assert.match(executorSource, /export \{ buildResponseFromExistingJob \} from '\.\/existing-image-job-response'/);
});

test('image generation executor does not regain existing job response ownership', () => {
  assert.doesNotMatch(executorSource, /function buildImagesFromExistingJob\(/, 'stored render parsing belongs in existing-image-job-response.ts');
  assert.doesNotMatch(executorSource, /function parseResolutionFromSettingsSnapshot\(/, 'settings snapshot resolution parsing belongs in existing-image-job-response.ts');
  assert.doesNotMatch(executorSource, /parseStoredImageRenders/, 'stored render parsing belongs in existing-image-job-response.ts');
  assert.doesNotMatch(executorSource, /function pickNormalizedReferenceMime\(/, 'reference mime selection belongs in image-reference-normalization.ts');
  assert.doesNotMatch(executorSource, /function isReferenceImageSupported\(/, 'reference format checks belong in image-reference-normalization.ts');
  assert.doesNotMatch(executorSource, /async function normalizeReferenceImageForEngine\(/, 'reference normalization belongs in image-reference-normalization.ts');

  const lineCount = executorSource.split('\n').length;
  assert.ok(lineCount <= 1620, `image generation executor should stay below 1620 lines after reference normalization extraction, got ${lineCount}`);
});

test('existing image job response module exposes the expected contract', () => {
  assert.match(existingJobResponseSource, /export type ExistingImageJobRow/);
  assert.match(existingJobResponseSource, /export function parseResolutionFromSettingsSnapshot/);
  assert.match(existingJobResponseSource, /export function buildResponseFromExistingJob/);
  assert.match(existingJobResponseSource, /parseStoredImageRenders/);
  assert.match(referenceNormalizationSource, /export type StoredAssetInfo/);
  assert.match(referenceNormalizationSource, /export async function getStoredAssetInfoByUrl/);
  assert.match(referenceNormalizationSource, /export function isReferenceImageSupported/);
  assert.match(referenceNormalizationSource, /export function pickNormalizedReferenceMime/);
  assert.match(referenceNormalizationSource, /export async function normalizeReferenceImageForEngine/);
});
