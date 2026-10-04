import assert from 'node:assert/strict';
import test from 'node:test';
import * as direct from '../frontend/server/wallet-direct-checkout';
import { getFalEngineById } from '../frontend/src/config/falEngines';

test('direct checkout and generation use the same default aspect, duration and BytePlus audio options', () => {
  const normalize = direct.normalizeWalletDirectOptions;
  const pika = getFalEngineById('pika-text-to-video')!;
  const seedance = getFalEngineById('seedance-2-0')!;
  const pikaOptions = normalize(pika.engine, 't2v', {});
  assert.equal(pikaOptions.ok, true);
  assert.equal(pikaOptions.options.aspectRatio, '16:9');
  const seedanceOptions = normalize({ ...seedance.engine, providerMeta: { ...seedance.engine.providerMeta, provider: 'byteplus_modelark' } }, 't2v', { durationSec: 5, resolution: '720p', aspectRatio: '16:9' });
  assert.equal(seedanceOptions.ok, true);
  assert.equal(seedanceOptions.options.audioEnabled, true);
  assert.equal(seedanceOptions.options.aspectRatio, '16:9');
});
