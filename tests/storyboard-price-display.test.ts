import assert from 'node:assert/strict';
import test from 'node:test';

test('storyboard visible tier prices include the Kling first-frame pass', async () => {
  const module = await import('../frontend/src/components/tools/storyboard/_lib/storyboard-price-display.ts');

  const boardPrice = { cents: 33, currency: 'USD' };
  const firstFramePrice = { cents: 12, currency: 'USD' };

  assert.deepEqual(
    module.resolveStoryboardVisiblePrice({
      targetModel: 'seedance',
      tierPrice: boardPrice,
      klingFirstFramePrice: firstFramePrice,
    }),
    boardPrice
  );
  assert.deepEqual(
    module.resolveStoryboardVisiblePrice({
      targetModel: 'kling',
      tierPrice: boardPrice,
      klingFirstFramePrice: firstFramePrice,
    }),
    { cents: 45, currency: 'USD' }
  );
  assert.equal(
    module.resolveStoryboardVisiblePrice({
      targetModel: 'kling',
      tierPrice: boardPrice,
      klingFirstFramePrice: null,
    }),
    null
  );
});

test('storyboard prices use locale currency formatting and preserve the existing fallback', async () => {
  const { formatStoryboardPrice } = await import(
    '../frontend/src/components/tools/storyboard/_hooks/useStoryboardPricing.ts'
  );

  assert.equal(formatStoryboardPrice(null, 'en-US'), '...');
  assert.equal(formatStoryboardPrice({ cents: 1234, currency: 'USD' }, 'en-US'), '$12.34');
  assert.equal(formatStoryboardPrice({ cents: 1234, currency: 'EUR' }, 'fr-FR'), '12,34 €');
  assert.equal(formatStoryboardPrice({ cents: 1234, currency: 'INVALID' }, 'en-US'), 'INVALID 12.34');
});
