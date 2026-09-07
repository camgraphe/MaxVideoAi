import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { matchesAcceptedToolQuote } from '../frontend/src/lib/toolbox/quote';

test('acceptance rejects changed currency, amount and malformed quotes; legacy callers retain canonical execution', () => {
  const current = { totalCents: 42, currency: 'USD' };
  assert.equal(matchesAcceptedToolQuote(undefined, current), true);
  assert.equal(matchesAcceptedToolQuote({ ...current }, current), true);
  for (const value of [null, {}, { ...current, totalCents: 41 }, { ...current, currency: 'EUR' }, { ...current, totalCents: '42' }, { ...current, totalCents: NaN }]) assert.equal(matchesAcceptedToolQuote(value, current), false);
});
test('both services check accepted quote after canonical pricing and before any job/debit', () => {
  for (const name of ['upscale', 'background-removal']) {
    const source = readFileSync(`frontend/src/server/tools/${name}.ts`, 'utf8');
    const check = source.indexOf('if (!matchesAcceptedToolQuote');
    const quote = source.indexOf(name === 'upscale' ? 'await resolveUpscalePricingContext' : 'await resolveBackgroundRemovalPricingContext');
    const debit = source.indexOf(name === 'upscale' ? 'await createAtomicInitialUpscaleJob' : 'await createAtomicInitialBackgroundRemovalJob');
    assert.ok(quote > 0 && quote < check && check < debit);
  }
  const source = readFileSync('frontend/src/server/tools/toolbox-quote.ts', 'utf8');
  assert.match(source, /resolveUpscalePricingContext/);
  assert.match(source, /resolveBackgroundRemovalPricingContext/);
  assert.doesNotMatch(source, /computeBillingProductSnapshot|createAtomic|subscribe|query\(/);
});
