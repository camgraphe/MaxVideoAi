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
