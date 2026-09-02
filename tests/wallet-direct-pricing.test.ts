import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import {
  getWalletDirectPricingRefusal,
  resolveWalletDirectGenerationMode,
} from '../frontend/src/lib/wallet-direct-pricing.ts';

function engine(id: string) {
  const value = listFalEngines().find((entry) => entry.id === id)?.engine;
  assert.ok(value, id);
  return value;
}

test('legacy wallet direct pricing resolves a separate generation mode', () => {
  const grok = engine('grok-imagine-video-1-5');
  assert.equal(resolveWalletDirectGenerationMode(grok, 'ref2v'), 'ref2v');
  assert.equal(resolveWalletDirectGenerationMode(grok, 'unsupported'), 't2v');
  assert.equal(resolveWalletDirectGenerationMode(grok, undefined), 't2v');
});

test('legacy wallet direct pricing fails closed when validated media facts are required', () => {
  const grok = engine('grok-imagine-video-1-5');
  const ltx = engine('ltx-2-5-fast');

  assert.equal(getWalletDirectPricingRefusal(grok, 't2v'), null);
  assert.equal(getWalletDirectPricingRefusal(grok, 'ref2v'), 'validated_reference_count_required');
  assert.equal(getWalletDirectPricingRefusal(ltx, 'a2v'), 'trusted_input_audio_duration_required');
});
