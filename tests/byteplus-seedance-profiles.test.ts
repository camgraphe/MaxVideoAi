import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getBytePlusSeedanceProfile,
  requireBytePlusSeedanceProfile,
} from '../frontend/src/server/video-providers/byteplus-modelark-profiles';
import {
  applyBytePlusSeedanceRuntimeOptions,
  assertBytePlusSeedanceSubmissionEnabled,
  getBytePlusSeedanceAllowedAspectRatios,
  getBytePlusSeedanceAllowedResolutions,
  getBytePlusSeedanceDurationOptions,
  isBytePlusSeedanceAdminOnly,
  isBytePlusSeedanceHiddenEngine,
  resolveBytePlusSeedanceModelId,
  resolveBytePlusSeedanceRouteProfile,
} from '../frontend/src/server/video-providers/byteplus-modelark';
import { ENV } from '../frontend/src/lib/env';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { normalizeBytePlusOptions } from '../frontend/app/api/generate/_lib/request-options-byteplus';

const expected = [
  {
    engineId: 'seedance-2-0',
    modelConfigKey: 'seedanceModelId',
    pricingProfileKey: 'standard',
    defaultDurationSec: 5,
    defaultResolution: '720p',
    defaultAspectRatio: '16:9',
    motionControls: true,
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
    defaultDurationSec: 5,
    defaultResolution: '720p',
    defaultAspectRatio: '16:9',
    motionControls: true,
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
    defaultDurationSec: 5,
    defaultResolution: '720p',
    defaultAspectRatio: '16:9',
    motionControls: true,
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
    defaultDurationSec: 5,
    defaultResolution: '720p',
    defaultAspectRatio: '16:9',
    motionControls: true,
    resolutions: ['480p', '720p'],
    durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    alwaysDirect: true,
    providerOverrideKey: 'SEEDANCE_FAST_PROVIDER',
    adminOnlyKey: 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY',
    allowedModesKey: 'SEEDANCE_FAST_BYTEPLUS_MODES',
  },
  {
    engineId: 'seedance-2-5',
    modelConfigKey: 'seedance25ModelId',
    pricingProfileKey: 'seedance25',
    defaultDurationSec: 4,
    defaultResolution: '480p',
    defaultAspectRatio: '16:9',
    motionControls: false,
    resolutions: ['480p', '720p'],
    durations: Array.from({ length: 27 }, (_, index) => index + 4),
    alwaysDirect: false,
    providerOverrideKey: 'SEEDANCE_2_5_PROVIDER',
    adminOnlyKey: 'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY',
    allowedModesKey: 'SEEDANCE_2_5_BYTEPLUS_MODES',
  },
] as const;

test('every current BytePlus Seedance engine has an explicit parity profile', () => {
  for (const entry of expected) {
    const profile = requireBytePlusSeedanceProfile(entry.engineId);
    assert.equal(profile.modelConfigKey, entry.modelConfigKey);
    assert.equal(profile.pricingProfileKey, entry.pricingProfileKey);
    assert.equal(profile.defaultDurationSec, entry.defaultDurationSec);
    assert.equal(profile.defaultResolution, entry.defaultResolution);
    assert.equal(profile.defaultAspectRatio, entry.defaultAspectRatio);
    assert.equal(profile.motionControls, entry.motionControls);
    assert.deepEqual(profile.resolutions, entry.resolutions);
    assert.deepEqual(profile.durationOptions, entry.durations);
    assert.equal(profile.routing.alwaysDirect, entry.alwaysDirect);
    assert.equal(profile.routing.providerOverrideKey, entry.providerOverrideKey);
    assert.equal(profile.routing.adminOnlyKey, entry.adminOnlyKey);
    assert.equal(profile.routing.allowedModesKey, entry.allowedModesKey);
    assert.deepEqual(profile.supportedModes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
    assert.deepEqual(
      profile.aspectRatios,
      entry.engineId === 'seedance-2-5'
        ? ['16:9']
        : ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']
    );
    assert.equal(profile.framesPerSecond, 24);
    assert.equal(profile.generatedAudio, true);
  }
});

test('Seedance 2.5 has a dedicated disabled-by-default provider profile', () => {
  const original = {
    enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    provider: ENV.SEEDANCE_2_5_PROVIDER,
  };
  try {
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false';
    ENV.SEEDANCE_2_5_PROVIDER = 'disabled';
    assert.equal(getBytePlusSeedanceProfile('seedance-2-5')?.engineId, 'seedance-2-5');
    assert.throws(
      () => assertBytePlusSeedanceSubmissionEnabled('seedance-2-5'),
      (error: unknown) =>
        error instanceof Error &&
        error.name === 'BytePlusModelArkError' &&
        (error as Error & { code?: string }).code === 'BYTEPLUS_ENGINE_DISABLED'
    );

    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
    ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
    assert.doesNotThrow(() => assertBytePlusSeedanceSubmissionEnabled('seedance-2-5'));
  } finally {
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.provider;
  }
});

test('admin-only policy preserves profile defaults and treats malformed values as restricted', { concurrency: false }, () => {
  const original = {
    standard: ENV.SEEDANCE_2_BYTEPLUS_ADMIN_ONLY,
    fast: ENV.SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY,
    mini: ENV.SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY,
    seedance25: ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY,
  };

  try {
    ENV.SEEDANCE_2_BYTEPLUS_ADMIN_ONLY = undefined;
    ENV.SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY = undefined;
    ENV.SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY = undefined;
    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = undefined;
    assert.equal(isBytePlusSeedanceAdminOnly('seedance-2-0'), true);
    assert.equal(isBytePlusSeedanceAdminOnly('seedance-2-0-fast'), true);
    assert.equal(isBytePlusSeedanceAdminOnly('seedance-2-0-mini'), false);
    assert.equal(isBytePlusSeedanceAdminOnly('seedance-2-5'), true);

    for (const explicitFalse of ['0', 'false', 'no', 'off']) {
      ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = explicitFalse;
      assert.equal(isBytePlusSeedanceAdminOnly('seedance-2-5'), false);
    }
    for (const explicitTrue of ['1', 'true', 'yes', 'on']) {
      ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = explicitTrue;
      assert.equal(isBytePlusSeedanceAdminOnly('seedance-2-5'), true);
    }

    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = 'ture';
    ENV.SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY = 'flase';
    assert.equal(isBytePlusSeedanceAdminOnly('seedance-2-5'), true);
    assert.equal(isBytePlusSeedanceAdminOnly('seedance-2-0-mini'), true);
  } finally {
    ENV.SEEDANCE_2_BYTEPLUS_ADMIN_ONLY = original.standard;
    ENV.SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY = original.fast;
    ENV.SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY = original.mini;
    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = original.seedance25;
  }
});

test('Seedance 2.5 runtime keeps the smallest confirmed canary defaults', () => {
  const entry = getFalEngineById('seedance-2-5');
  assert.ok(entry);
  const profile = requireBytePlusSeedanceProfile('seedance-2-5');

  const runtime = applyBytePlusSeedanceRuntimeOptions(entry.engine, {
    provider: 'byteplus_modelark',
    allowedModes: ['t2v'],
  });
  const fields = [
    ...(runtime.inputSchema?.required ?? []),
    ...(runtime.inputSchema?.optional ?? []),
  ];

  assert.equal(fields.find((field) => field.id === 'duration')?.default, '4');
  assert.equal(fields.find((field) => field.id === 'resolution')?.default, '480p');
  assert.equal(fields.find((field) => field.id === 'aspect_ratio')?.default, '16:9');
  assert.deepEqual(runtime.modes, ['t2v']);
  assert.equal(profile.generatedAudio, true);
  assert.equal(runtime.audio, true);
  assert.equal(runtime.extend, false);
  assert.equal(runtime.motionControls, false);

  assert.deepEqual(
    normalizeBytePlusOptions({
      engineId: 'seedance-2-5',
      durationSec: 15,
      requestedResolution: '720p',
      aspectRatio: '16:9',
    }),
    {
      ok: true,
      durationSec: 15,
      resolution: '720p',
      aspectRatio: '16:9',
      generatedAudio: true,
    },
  );
});

test('strict capability and model helpers reject an unknown engine', () => {
  const config = {
    seedanceModelId: 'standard-id',
    seedanceFastModelId: 'fast-id',
    seedanceMiniModelId: 'mini-id',
    seedance25ModelId: 'seedance-25-id',
  } as never;
  assert.throws(() => getBytePlusSeedanceAllowedResolutions('seedance-9-9'));
  assert.throws(() => getBytePlusSeedanceDurationOptions('seedance-9-9'));
  assert.throws(() => resolveBytePlusSeedanceModelId('seedance-9-9', config));
  assert.equal(isBytePlusSeedanceAdminOnly('seedance-9-9'), false);
  assert.equal(resolveBytePlusSeedanceRouteProfile('luma-ray-2', 'fal'), null);
  assert.throws(
    () => resolveBytePlusSeedanceRouteProfile('seedance-9-9', 'byteplus_modelark'),
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
    seedance25ModelId: 'seedance-25-id',
  } as never;
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0', config), 'standard-id');
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0-fast', config), 'fast-id');
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0-mini', config), 'mini-id');
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-0-fast-byteplus', config), 'fast-id');
  assert.equal(resolveBytePlusSeedanceModelId('seedance-2-5', config), 'seedance-25-id');
  assert.equal(isBytePlusSeedanceHiddenEngine('seedance-2-5'), false);
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
    seedance25ModelId: 'seedance-25-id',
  } as never;
  assert.throws(
    () => resolveBytePlusSeedanceModelId('seedance-2-0', config),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_MODEL_ID_MISSING'
  );
});
