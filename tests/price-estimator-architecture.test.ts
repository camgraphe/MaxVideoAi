import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const estimatorPath = join(root, 'frontend/components/marketing/PriceEstimator.tsx');
const optionsPath = join(root, 'frontend/components/marketing/price-estimator/price-estimator-options.ts');

const estimatorSource = readFileSync(estimatorPath, 'utf8');
const optionsSource = readFileSync(optionsPath, 'utf8');

test('price estimator delegates engine option pricing helpers', () => {
  assert.ok(existsSync(optionsPath), 'price estimator option helpers should live in a focused module');
  assert.match(estimatorSource, /from '@\/components\/marketing\/price-estimator\/price-estimator-options'/);
  assert.match(optionsSource, /export const MEMBER_ORDER/);
  assert.match(optionsSource, /export const FAL_ENGINE_REGISTRY/);
  assert.match(optionsSource, /export const PER_IMAGE_ENGINE_IDS/);
  assert.match(optionsSource, /export function buildAudioAddonPayload/);
  assert.match(optionsSource, /export function buildEngineOption/);
  assert.match(optionsSource, /export function formatCurrency/);
});

test('price estimator component does not regain option builder ownership', () => {
  assert.doesNotMatch(estimatorSource, /const PER_IMAGE_ENGINE_CONFIG =/, 'per-image display rates belong in price-estimator-options.ts');
  assert.doesNotMatch(estimatorSource, /function centsToDollars\(/, 'pricing value conversion belongs in price-estimator-options.ts');
  assert.doesNotMatch(estimatorSource, /function applyPerImageDisplayMargin\(/, 'per-image display margins belong in price-estimator-options.ts');
  assert.doesNotMatch(estimatorSource, /function resolveAudioAddonKey\(/, 'audio addon resolution belongs in price-estimator-options.ts');
  assert.doesNotMatch(estimatorSource, /function getDurationField\(/, 'duration field parsing belongs in price-estimator-options.ts');
  assert.doesNotMatch(estimatorSource, /function collectDurationOptions\(/, 'duration option collection belongs in price-estimator-options.ts');
  assert.doesNotMatch(estimatorSource, /function buildEngineOption\(/, 'engine option building belongs in price-estimator-options.ts');
  assert.doesNotMatch(estimatorSource, /function formatCurrency\(/, 'currency formatting belongs in price-estimator-options.ts');

  const lineCount = estimatorSource.split('\n').length;
  assert.ok(lineCount <= 620, `PriceEstimator.tsx should stay below 620 lines after option helper extraction, got ${lineCount}`);
});
