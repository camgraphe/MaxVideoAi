import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const falPath = join(root, 'frontend/src/lib/fal.ts');
const errorPath = join(root, 'frontend/src/lib/fal-error.ts');
const modelHelpersPath = join(root, 'frontend/src/lib/fal-model-helpers.ts');
const requestBodyPath = join(root, 'frontend/src/lib/fal-request-body.ts');
const responsePath = join(root, 'frontend/src/lib/fal-response.ts');
const typesPath = join(root, 'frontend/src/lib/fal-types.ts');
const webhookUrlPath = join(root, 'frontend/src/lib/fal-webhook-url.ts');

const falSource = readFileSync(falPath, 'utf8');
const errorSource = readFileSync(errorPath, 'utf8');
const modelHelpersSource = readFileSync(modelHelpersPath, 'utf8');
const requestBodySource = readFileSync(requestBodyPath, 'utf8');
const responseSource = readFileSync(responsePath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');
const webhookUrlSource = readFileSync(webhookUrlPath, 'utf8');

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

test('fal generation delegates payload, model, webhook, error, and type ownership', () => {
  assert.ok(existsSync(requestBodyPath), 'FAL request body construction should live in a focused lib module');
  assert.ok(existsSync(modelHelpersPath), 'FAL model helpers should live in a focused lib module');
  assert.ok(existsSync(webhookUrlPath), 'FAL webhook URL resolution should live in a focused lib module');
  assert.ok(existsSync(errorPath), 'FAL generation error type should live in a focused lib module');
  assert.ok(existsSync(typesPath), 'FAL public types should live in a focused lib module');

  assert.match(falSource, /from '@\/lib\/fal-request-body'/);
  assert.match(falSource, /from '@\/lib\/fal-model-helpers'/);
  assert.match(falSource, /from '@\/lib\/fal-webhook-url'/);
  assert.match(falSource, /from '@\/lib\/fal-error'/);
  assert.match(falSource, /from '@\/lib\/fal-types'/);

  assert.match(requestBodySource, /export function buildFalGenerationRequest/);
  assert.match(modelHelpersSource, /export function resolveFalModelSlug/);
  assert.match(modelHelpersSource, /export function normalizeFalDurationValueForModel/);
  assert.match(modelHelpersSource, /export function resolveFalVideoResolutionInput/);
  assert.match(webhookUrlSource, /export function getFalWebhookUrl/);
  assert.match(errorSource, /export class FalGenerationError/);
  assert.match(typesSource, /export type GeneratePayload/);
  assert.match(typesSource, /export type GenerateResult/);
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
  assert.ok(lineCount <= 220, `fal.ts should stay below 220 lines after helper extraction, got ${lineCount}`);
});

test('fal generation file stays an orchestration module', () => {
  assert.doesNotMatch(falSource, /type GeneratePayload =/, 'public request types belong in fal-types.ts');
  assert.doesNotMatch(falSource, /class FalGenerationError/, 'provider error type belongs in fal-error.ts');
  assert.doesNotMatch(falSource, /function getFalWebhookUrl\(/, 'webhook URL resolution belongs in fal-webhook-url.ts');
  assert.doesNotMatch(
    falSource,
    /function normalizeFalDurationValueForModel\(/,
    'duration normalization belongs in fal-model-helpers.ts'
  );
  assert.doesNotMatch(
    falSource,
    /function resolveFalVideoResolutionInput\(/,
    'resolution normalization belongs in fal-model-helpers.ts'
  );
  assert.doesNotMatch(falSource, /function resolveFalModelSlug\(/, 'model slug routing belongs in fal-model-helpers.ts');
  assert.doesNotMatch(
    falSource,
    /function buildFalGenerationRequest\(/,
    'request body construction belongs in fal-request-body.ts'
  );
});
