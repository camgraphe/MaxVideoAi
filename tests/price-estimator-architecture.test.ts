import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const estimatorPath = join(root, 'frontend/components/marketing/PriceEstimator.tsx');
const optionsPath = join(root, 'frontend/components/marketing/price-estimator/price-estimator-options.ts');
const selectGroupPath = join(root, 'frontend/components/marketing/price-estimator/PriceEstimatorSelectGroup.tsx');
const summaryPanelPath = join(root, 'frontend/components/marketing/price-estimator/PriceEstimatorSummaryPanel.tsx');
const summaryLabelsPath = join(root, 'frontend/components/marketing/price-estimator/price-estimator-summary-labels.ts');

const estimatorSource = readFileSync(estimatorPath, 'utf8');
const optionsSource = readFileSync(optionsPath, 'utf8');
const selectGroupSource = readFileSync(selectGroupPath, 'utf8');
const summaryPanelSource = readFileSync(summaryPanelPath, 'utf8');
const summaryLabelsSource = readFileSync(summaryLabelsPath, 'utf8');

test('price estimator delegates engine option pricing helpers', () => {
  assert.ok(existsSync(optionsPath), 'price estimator option helpers should live in a focused module');
  assert.ok(existsSync(selectGroupPath), 'price estimator select groups should live in a focused component');
  assert.ok(existsSync(summaryPanelPath), 'price estimator summary should live in a focused component');
  assert.ok(existsSync(summaryLabelsPath), 'price estimator summary labels should live in a focused helper');
  assert.match(estimatorSource, /from '@\/components\/marketing\/price-estimator\/price-estimator-options'/);
  assert.match(estimatorSource, /PriceEstimatorSelectGroup/);
  assert.match(estimatorSource, /PriceEstimatorSummaryPanel/);
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
  assert.doesNotMatch(estimatorSource, /function SelectGroup\(/, 'select group rendering belongs in PriceEstimatorSelectGroup.tsx');
  assert.doesNotMatch(estimatorSource, /member-status-pill/, 'member tier summary controls belong in PriceEstimatorSummaryPanel.tsx');

  const lineCount = estimatorSource.split('\n').length;
  assert.ok(lineCount <= 500, `PriceEstimator.tsx should stay below 500 lines after summary extraction, got ${lineCount}`);
  assert.match(selectGroupSource, /export function PriceEstimatorSelectGroup/);
  assert.match(summaryPanelSource, /export function PriceEstimatorSummaryPanel/);
  assert.match(summaryLabelsSource, /export function buildPriceEstimatorSummaryLabels/);
});
