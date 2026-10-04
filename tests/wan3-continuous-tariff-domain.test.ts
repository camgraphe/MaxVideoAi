import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { validateWan3ContinuousTariffDomain } from '../frontend/server/pricing/wan3-continuous-tariff-domain';

const context = { engine: getFalEngineById('wan-3')!.engine, mode: 'v2v' as const, durationSec: 5,
  resolution: '720p', aspectRatio: '16:9', inputVideoDurationSec: 3.25 };
const price = (flatCents: number, centsPerUnit: number) => ({ kind: 'unit_components' as const, rounding: 'nearest' as const,
  components: [{ id: 'retail', flatCents, rounding: 'none' as const, terms: [{ unit: 'input_video_seconds', centsPerUnit }] }] });

test('domain validation catches a loss between safe-looking endpoints instead of checking only the displayed source', () => {
  assert.throws(() => validateWan3ContinuousTariffDomain({ context, price: price(50, 10) }), /below.cost/i);
  const accepted = validateWan3ContinuousTariffDomain({ context, price: price(65, 13) });
  assert.equal(accepted.maxInputSeconds, 15);
  assert.ok(accepted.checkedBoundaries > 150);
  assert.ok(accepted.minimumGrossCents >= 0);
});

test('the range validator permits lower unit rates when the output price covers every source length', () => {
  assert.ok(validateWan3ContinuousTariffDomain({ context, price: price(250, 0) }).minimumGrossCents >= 50);
  assert.throws(() => validateWan3ContinuousTariffDomain({ context, price: price(190, 0) }), /below.cost/i);
  const maximum = validateWan3ContinuousTariffDomain({ context: { ...context, durationSec: 29, inputVideoDurationSec: 0.75 }, price: price(310, 0) }).maxInputSeconds;
  assert.ok(maximum >= 1 && maximum < 1.00000000000001);
  assert.equal(29 + maximum, 30, 'the guard includes the existing validator’s representable end point');
});

test('a constant or malformed price cannot claim continuous source coverage', () => {
  assert.throws(() => validateWan3ContinuousTariffDomain({ context, price: { kind: 'fixed', customerCents: 500 } }), /unit|continuous/i);
  assert.throws(() => validateWan3ContinuousTariffDomain({ context, price: price(100, -1) }), /invalid/i);
  assert.throws(() => validateWan3ContinuousTariffDomain({ context: { ...context, durationSec: 30 }, price: price(100, 1) }), /duration/i);
});
