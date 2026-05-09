import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const copyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-copy.ts');
const defaultCopyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-default-copy.ts');
const helperPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-copy-helpers.ts');

const copySource = readFileSync(copyPath, 'utf8');
const defaultCopySource = readFileSync(defaultCopyPath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

test('model page copy delegates defaults and comparison helpers', () => {
  assert.ok(existsSync(defaultCopyPath), 'default model copy should live in a focused module');
  assert.ok(existsSync(helperPath), 'model copy comparison helpers should live in a focused module');
  assert.match(copySource, /from '\.\/model-page-default-copy'/);
  assert.match(copySource, /from '\.\/model-page-copy-helpers'/);
  assert.match(copySource, /export function buildSoraCopy/);
});

test('model page copy does not regain default copy or comparison ownership', () => {
  const lineCount = copySource.split('\n').length;
  assert.ok(lineCount <= 340, `model-page-copy.ts should stay below 340 lines after extraction, got ${lineCount}`);
  assert.doesNotMatch(copySource, /export const DEFAULT_VIDEO_TROUBLESHOOTING =/);
  assert.doesNotMatch(copySource, /export const MODEL_OG_IMAGE_MAP/);
  assert.doesNotMatch(copySource, /getSuggestedOpponentSlugs/);
});

test('model page copy helper modules expose the expected contract', () => {
  assert.match(defaultCopySource, /export const DEFAULT_VIDEO_TROUBLESHOOTING/);
  assert.match(defaultCopySource, /export const DEFAULT_DETAIL_COPY/);
  assert.match(defaultCopySource, /export const MODEL_OG_IMAGE_MAP/);
  assert.match(defaultCopySource, /export function getDefaultGenericSafety/);
  assert.match(helperSource, /export function pickCompareEngines/);
  assert.match(helperSource, /export function buildVideoBoundaries/);
});
