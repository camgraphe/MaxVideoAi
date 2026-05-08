import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const falPath = join(root, 'frontend/src/lib/fal.ts');
const responsePath = join(root, 'frontend/src/lib/fal-response.ts');

const falSource = readFileSync(falPath, 'utf8');
const responseSource = readFileSync(responsePath, 'utf8');

test('fal generation delegates response parsing and video asset shaping', () => {
  assert.ok(existsSync(responsePath), 'FAL response helpers should live in a focused lib module');
  assert.match(falSource, /from '@\/lib\/fal-response'/);
  assert.match(responseSource, /export function unwrapFalResponse/);
  assert.match(responseSource, /export function normalizePendingStatus/);
  assert.match(responseSource, /export function normalizePendingProgress/);
  assert.match(responseSource, /export function extractVideoAsset/);
  assert.match(responseSource, /export function ensureAssetShape/);
  assert.match(responseSource, /export function getThumbForAspectRatio/);
});

test('fal generation file does not regain response helper ownership', () => {
  assert.doesNotMatch(falSource, /type FalVideoCandidate =/, 'video response candidate parsing belongs in fal-response.ts');
  assert.doesNotMatch(falSource, /type FalRunResponse =/, 'FAL run response parsing belongs in fal-response.ts');
  assert.doesNotMatch(falSource, /function unwrapFalResponse\(/, 'response unwrapping belongs in fal-response.ts');
  assert.doesNotMatch(falSource, /function extractVideoAsset\(/, 'video extraction belongs in fal-response.ts');
  assert.doesNotMatch(falSource, /function normalizeVideoCandidate\(/, 'video candidate normalization belongs in fal-response.ts');
  assert.doesNotMatch(falSource, /function ensureAssetShape\(/, 'video asset shaping belongs in fal-response.ts');
  assert.doesNotMatch(falSource, /function normalizePendingStatus\(/, 'pending status mapping belongs in fal-response.ts');
  assert.doesNotMatch(falSource, /function normalizePendingProgress\(/, 'pending progress mapping belongs in fal-response.ts');
  assert.doesNotMatch(falSource, /function getThumbForAspectRatio\(/, 'fallback thumbnail selection belongs in fal-response.ts');

  const lineCount = falSource.split('\n').length;
  assert.ok(lineCount <= 760, `fal.ts should stay below 760 lines after response helper extraction, got ${lineCount}`);
});
