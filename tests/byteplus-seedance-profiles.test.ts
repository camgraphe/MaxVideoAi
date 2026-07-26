import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getBytePlusSeedanceProfile,
  requireBytePlusSeedanceProfile,
} from '../frontend/src/server/video-providers/byteplus-modelark-profiles';
import {
  getBytePlusSeedanceAllowedAspectRatios,
  getBytePlusSeedanceAllowedResolutions,
  getBytePlusSeedanceDurationOptions,
  isBytePlusSeedanceAdminOnly,
  resolveBytePlusSeedanceModelId,
  resolveBytePlusSeedanceRouteProfile,
} from '../frontend/src/server/video-providers/byteplus-modelark';

const expected = [
  {
    engineId: 'seedance-2-0',
    modelConfigKey: 'seedanceModelId',
    pricingProfileKey: 'standard',
    resolutions: ['480p', '720p', '1080p', '4k'],
    durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    alwaysDirect: false,
    providerOverrideKey: 'SEEDANCE_2_PROVIDER',
    adminOnlyKey: 'SEEDANCE_2_BYTEPLUS_ADMIN_ONLY',
    allowedModesKey: 'SEEDANCE_2_BYTEPLUS_MODES',
  },
  {
    engineId: 'seedance-2-0-fast',
    modelConfigKey: 'seedanceFastModelId',
    pricingProfileKey: 'fast',
    resolutions: ['480p', '720p'],
    durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    alwaysDirect: false,
    providerOverrideKey: 'SEEDANCE_FAST_PROVIDER',
    adminOnlyKey: 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY',
    allowedModesKey: 'SEEDANCE_FAST_BYTEPLUS_MODES',
  },
  {
    engineId: 'seedance-2-0-mini',
    modelConfigKey: 'seedanceMiniModelId',
    pricingProfileKey: 'mini',
    resolutions: ['480p', '720p'],
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    alwaysDirect: true,
    providerOverrideKey: null,
    adminOnlyKey: 'SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY',
    allowedModesKey: 'SEEDANCE_MINI_BYTEPLUS_MODES',
  },
  {
    engineId: 'seedance-2-0-fast-byteplus',
    modelConfigKey: 'seedanceFastModelId',
    pricingProfileKey: 'fast',
    resolutions: ['480p', '720p'],
    durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    alwaysDirect: true,
    providerOverrideKey: 'SEEDANCE_FAST_PROVIDER',
    adminOnlyKey: 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY',
    allowedModesKey: 'SEEDANCE_FAST_BYTEPLUS_MODES',
  },
] as const;

test('every current BytePlus Seedance engine has an explicit parity profile', () => {
  for (const entry of expected) {
    const profile = requireBytePlusSeedanceProfile(entry.engineId);
    assert.equal(profile.modelConfigKey, entry.modelConfigKey);
    assert.equal(profile.pricingProfileKey, entry.pricingProfileKey);
    assert.deepEqual(profile.resolutions, entry.resolutions);
    assert.deepEqual(profile.durationOptions, entry.durations);
    assert.equal(profile.routing.alwaysDirect, entry.alwaysDirect);
    assert.equal(profile.routing.providerOverrideKey, entry.providerOverrideKey);
    assert.equal(profile.routing.adminOnlyKey, entry.adminOnlyKey);
    assert.equal(profile.routing.allowedModesKey, entry.allowedModesKey);
    assert.deepEqual(profile.supportedModes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
    assert.deepEqual(profile.aspectRatios, ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
    assert.equal(profile.framesPerSecond, 24);
    assert.equal(profile.generatedAudio, true);
  }
});

test('Seedance 2.5 has no pre-release provider profile', () => {
  assert.equal(getBytePlusSeedanceProfile('seedance-2-5'), null);
  assert.throws(
    () => requireBytePlusSeedanceProfile('seedance-2-5'),
    (error: unknown) =>
      error instanceof Error &&
      error.name === 'BytePlusModelArkError' &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_ENGINE_PROFILE_MISSING'
  );
});

test('strict capability and model helpers reject an unknown engine', () => {
  const config = {
    seedanceModelId: 'standard-id',
    seedanceFastModelId: 'fast-id',
    seedanceMiniModelId: 'mini-id',
  } as never;
  assert.throws(() => getBytePlusSeedanceAllowedResolutions('seedance-2-5'));
  assert.throws(() => getBytePlusSeedanceDurationOptions('seedance-2-5'));
  assert.throws(() => resolveBytePlusSeedanceModelId('seedance-2-5', config));
  assert.equal(isBytePlusSeedanceAdminOnly('seedance-2-5'), false);
  assert.equal(resolveBytePlusSeedanceRouteProfile('luma-ray-2', 'fal'), null);
  assert.throws(
    () => resolveBytePlusSeedanceRouteProfile('seedance-2-5', 'byteplus_modelark'),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_ENGINE_PROFILE_MISSING'
  );
});

test('recognized model selection preserves all current config keys', () => {
  const config = {
    seedanceModelId: 'standard-id',
    seedanceFastModelId: 'fast-id',
    seedanceMiniModelId: 'mini-id',
  } as never;
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0', config), 'standard-id');
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0-fast', config), 'fast-id');
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0-mini', config), 'mini-id');
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0-fast-byteplus', config), 'fast-id');
  assert.deepEqual(
    getBytePlusSeedanceAllowedAspectRatios('seedance-2-0'),
    ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']
  );
});

test('recognized engine with an empty configured model id fails before submission', () => {
  const config = {
    seedanceModelId: '',
    seedanceFastModelId: 'fast-id',
    seedanceMiniModelId: 'mini-id',
  } as never;
  assert.throws(
    () => resolveBytePlusSeedanceModelId('seedance-2-0', config),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_MODEL_ID_MISSING'
  );
});
