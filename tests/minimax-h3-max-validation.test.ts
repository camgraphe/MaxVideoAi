import assert from 'node:assert/strict';
import test from 'node:test';

import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import { buildMinimaxH3MaxFalRequest } from '../frontend/src/lib/minimax-h3-max';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';

test('MiniMax H3 Max rejects image-to-video without a start image', () => {
  assert.throws(() => buildMinimaxH3MaxFalRequest({
    mode: 'i2v',
    prompt: 'The still life starts to move.',
    durationSec: 5,
  }), /start image/i);
});

test('MiniMax H3 Max rejects reference media outside image, video, and audio', () => {
  assert.throws(() => buildMinimaxH3MaxFalRequest({
    mode: 'ref2v',
    prompt: 'Use the references.',
    durationSec: 5,
    references: [
      { type: 'document', url: 'https://media.maxvideoai.com/notes.pdf' },
    ],
  }), /image, video, or audio/i);
});

test('MiniMax H3 Max rejects unsupported duration and resolution values', () => {
  assert.throws(() => buildMinimaxH3MaxFalRequest({
    mode: 't2v',
    prompt: 'A lighthouse rotates through fog.',
    durationSec: 16,
  }), /5 through 15 seconds/i);
  assert.throws(() => buildMinimaxH3MaxFalRequest({
    mode: 't2v',
    prompt: 'A lighthouse rotates through fog.',
    durationSec: 5,
    resolution: '1080P',
  }), /480P or 768P/);
});

test('MiniMax H3 Max exact reference quotes fail closed without trusted token metadata', () => {
  const context = {
    engine: MINIMAX_H3_MAX_ENGINE,
    durationSec: 5,
    resolution: '768P',
    mode: 'ref2v' as const,
  };

  assert.throws(
    () => buildBillingPricingFacts(context, MINIMAX_H3_MAX_ENGINE.pricingDetails, 'USD'),
    /trusted reference token count/i,
  );
  assert.throws(
    () => buildPublicPricingFacts(context),
    /trusted reference token count/i,
  );
});
