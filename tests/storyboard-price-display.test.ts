import assert from 'node:assert/strict';
import test from 'node:test';

test('storyboard prices use locale currency formatting and preserve the existing fallback', async () => {
  const { formatStoryboardPrice } = await import(
    '../frontend/src/components/tools/storyboard/_hooks/useStoryboardPricing.ts'
  );

  assert.equal(formatStoryboardPrice(null, 'en-US'), '...');
  assert.equal(formatStoryboardPrice({ cents: 1234, currency: 'USD' }, 'en-US'), '$12.34');
  assert.equal(formatStoryboardPrice({ cents: 1234, currency: 'EUR' }, 'fr-FR'), '12,34 €');
  assert.equal(formatStoryboardPrice({ cents: 1234, currency: 'INVALID' }, 'en-US'), 'INVALID 12.34');
});
