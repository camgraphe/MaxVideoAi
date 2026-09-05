import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCompareSpecRows } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-rows.ts';
import { CATALOG_BY_SLUG } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config.ts';
import { buildSpecValues } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values.ts';

const base = {
  left: { ...CATALOG_BY_SLUG.get('seedance-2-0')!, engine: { avgDurationMs: 411000 } },
  right: { ...CATALOG_BY_SLUG.get('seedance-2-0-fast')!, engine: { avgDurationMs: 618000 } },
  leftSpecs: buildSpecValues(CATALOG_BY_SLUG.get('seedance-2-0')!),
  rightSpecs: buildSpecValues(CATALOG_BY_SLUG.get('seedance-2-0-fast')!),
  leftPricingDisplay: { headline: '$0.38/s', subline: null, prices: [0.38] },
  rightPricingDisplay: { headline: '$0.30/s', subline: null, prices: [0.30] },
  pairHasNativeAudio: true,
  specLabels: { observedMedian: 'Observed median (30 days)' },
  activeLocale: 'en' as const,
};

test('comparison uses qualified benchmark medians with dated P90 context and never substitutes an unqualified average', () => {
  const rows = buildCompareSpecRows({
    ...base,
    leftLatency: {
      engineId: 'seedance-2-0', modelSlug: 'seedance-2-0',
      medianDurationMs: 338000, p90DurationMs: 462000, asOf: '2026-09-04T12:00:00Z',
    },
    rightLatency: null,
  });
  const latency = rows.find((row) => row.label === 'Observed median (30 days)');
  assert.ok(latency);
  assert.equal(latency.left, '338s');
  assert.equal(latency.right, 'Data pending');
  assert.match(latency.subline ?? '', /P90: 462s/);
  assert.match(latency.subline ?? '', /Sep 4, 2026/);
  assert.equal(JSON.stringify(rows).includes('618s'), false);
});

test('comparison omits observed speed when neither model has a qualified benchmark sample', () => {
  const rows = buildCompareSpecRows({ ...base, leftLatency: null, rightLatency: null });
  assert.equal(rows.some((row) => /render time|median/i.test(row.label)), false);
  assert.equal(JSON.stringify(rows).includes('411s'), false);
});
