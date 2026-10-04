import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { PricingPolicyRule } from '@maxvideoai/pricing';

import {
  assertVersionedByteDanceParity,
  quoteByteDanceBaselineRows,
  type ByteDanceBaselineScenario,
} from '../frontend/scripts/pricing-effective-bytedance-baseline';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/bytedance-versioned-price-baseline-2026-09-28.json', import.meta.url),
  'utf8',
)) as { rows: ByteDanceBaselineScenario[] };

test('the 202 frozen ByteDance scenarios still reproduce their original versioned customer totals', async () => {
  const quotes = await quoteByteDanceBaselineRows(fixture.rows, []);
  assert.equal(quotes.length, 202);
  assertVersionedByteDanceParity(fixture.rows, quotes);
  assert.ok(quotes.every((quote) => quote.policySource === 'versioned'));
  assert.ok(quotes.every((quote) => Number.isSafeInteger(quote.customerTotalCents)));
});

test('effective database rules are recorded separately from versioned customer amounts', async () => {
  const rows = fixture.rows.filter((row) => row.engineId === 'seedance-2-5').slice(0, 2);
  assert.equal(rows.length, 2);
  const versioned = await quoteByteDanceBaselineRows(rows, []);
  const changedRule: PricingPolicyRule = {
    id: 'local-override', engineId: 'seedance-2-5', marginPercent: 0.5,
    marginFlatCents: 0, surchargeAudioPercent: 0, surchargeUpscalePercent: 0, currency: 'USD',
  };
  const effective = await quoteByteDanceBaselineRows(rows, [changedRule]);
  assert.deepEqual(effective.map((row) => row.policySource), ['database', 'database']);
  assert.deepEqual(effective.map((row) => row.ruleId), ['local-override', 'local-override']);
  assert.ok(effective.every((row, index) => row.customerTotalCents > versioned[index]!.customerTotalCents));
  assert.throws(() => assertVersionedByteDanceParity(rows, effective), /Frozen versioned baseline drift/);
});

test('the parity guard rejects incomplete or duplicated source scenarios', async () => {
  const rows = fixture.rows.slice(0, 1);
  const quotes = await quoteByteDanceBaselineRows(rows, []);
  assert.throws(() => assertVersionedByteDanceParity(rows, []), /missing quote/);
  assert.throws(() => assertVersionedByteDanceParity([rows[0]!, rows[0]!], quotes), /duplicate scenario/);
});
