import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { normalizeBytePlusOptions } from '../frontend/app/api/generate/_lib/request-options-byteplus';
import {
  applyBytePlusSeedanceRuntimeOptions,
  buildBytePlusSeedancePayload,
  getBytePlusUserSafeErrorMessage,
  getBytePlusUserSafeTaskFailureMessage,
  getBytePlusSeedanceAllowedResolutions,
  shouldRoutePublicSeedanceFastToBytePlus,
  shouldRoutePublicSeedanceMiniToBytePlus,
} from '../frontend/src/server/video-providers/byteplus-modelark';
import { listFalEngines } from '../frontend/src/config/falEngines';
import {
  expectedBytePlusTokens,
  getBytePlusAccounting,
  getBytePlusUnitPriceUsdPer1kTokens,
} from '../frontend/server/byteplus-accounting';

const pollPath = 'frontend/server/byteplus-poll.ts';
const accountingPath = 'frontend/server/byteplus-accounting.ts';
const storageCopyPath = 'frontend/server/byteplus-storage-copy.ts';
const pollTypesPath = 'frontend/server/byteplus-poll-types.ts';
const providerPath = 'frontend/src/server/video-providers/byteplus-modelark.ts';
const providerConstantsPath = 'frontend/src/server/video-providers/byteplus-modelark-constants.ts';
const providerErrorPath = 'frontend/src/server/video-providers/byteplus-modelark-error.ts';
const providerPayloadPath = 'frontend/src/server/video-providers/byteplus-modelark-payload.ts';
const providerResponsePath = 'frontend/src/server/video-providers/byteplus-modelark-response.ts';
const envPath = 'frontend/src/lib/env.ts';

test('BytePlus poll delegates accounting, storage-copy retry, and shared types', () => {
  for (const path of [pollPath, accountingPath, storageCopyPath, pollTypesPath]) {
    assert.equal(existsSync(path), true, `${path} should exist`);
  }

  const pollSource = readFileSync(pollPath, 'utf8');
  const accountingSource = readFileSync(accountingPath, 'utf8');
  const storageCopySource = readFileSync(storageCopyPath, 'utf8');
  const pollTypesSource = readFileSync(pollTypesPath, 'utf8');

  assert.ok(pollSource.split('\n').length < 430, 'byteplus-poll.ts should stay under 430 lines');
  assert.match(pollSource, /from '\.\/byteplus-accounting'/);
  assert.match(pollSource, /from '\.\/byteplus-storage-copy'/);
  assert.match(pollSource, /from '\.\/byteplus-poll-types'/);
  assert.doesNotMatch(pollSource, /const BYTEPLUS_TOKEN_DIMENSIONS/);
  assert.doesNotMatch(pollSource, /const BYTEPLUS_STORAGE_COPY_RETRY_DELAYS_MS/);

  assert.match(accountingSource, /export function expectedBytePlusTokens/);
  assert.match(accountingSource, /export function getBytePlusAccounting/);
  assert.match(accountingSource, /export function getBytePlusUnitPriceUsdPer1kTokens/);
  assert.match(storageCopySource, /export function getBytePlusStorageCopyState/);
  assert.match(storageCopySource, /export function shouldRetryBytePlusStorageCopy/);
  assert.match(pollTypesSource, /export type BytePlusPendingJob/);
});

test('BytePlus ModelArk provider delegates payload and response normalization', () => {
  for (const path of [providerPath, providerConstantsPath, providerErrorPath, providerPayloadPath, providerResponsePath]) {
    assert.equal(existsSync(path), true, `${path} should exist`);
  }

  const providerSource = readFileSync(providerPath, 'utf8');
  const payloadSource = readFileSync(providerPayloadPath, 'utf8');
  const responseSource = readFileSync(providerResponsePath, 'utf8');

  assert.ok(providerSource.split('\n').length < 430, 'byteplus-modelark.ts should stay under 430 lines');
  assert.match(providerSource, /from '\.\/byteplus-modelark-constants'/);
  assert.match(providerSource, /from '\.\/byteplus-modelark-payload'/);
  assert.match(providerSource, /from '\.\/byteplus-modelark-response'/);
  assert.doesNotMatch(providerSource, /function extractVideoUrl/);
  assert.doesNotMatch(providerSource, /function uniqueNonEmptyUrls/);
  assert.doesNotMatch(providerSource, /export function buildBytePlusSeedancePayload/);

  assert.match(payloadSource, /export function buildBytePlusSeedancePayload/);
  assert.match(payloadSource, /export function buildBytePlusSeedanceFastPayload/);
  assert.match(responseSource, /export function normalizeBytePlusTask/);
  assert.match(responseSource, /export function scrubBytePlusError/);
  assert.match(responseSource, /recognizable person/);
  assert.match(responseSource, /export async function parseJsonResponse/);
});

test('BytePlus ModelArk safety failures use precise Seedance customer copy', () => {
  const message = getBytePlusUserSafeErrorMessage(
    'The request failed because the input image may contain real person. Request id: abc'
  );

  assert.equal(
    message,
    'Seedance blocked a reference image because it may contain a recognizable person or private content. Use a non-identifiable, stylized, or generated reference image and try again.'
  );
  assert.doesNotMatch(message, /BytePlus|ModelArk|request id/i);
});

test('BytePlus ModelArk non-safety start failures stay specific without provider wording', () => {
  assert.equal(
    getBytePlusUserSafeErrorMessage('Invalid request: aspect ratio is not supported by this model.'),
    'The selected Seedance prompt, media, or settings were not accepted. Adjust the reference media or settings and try again.'
  );
  assert.equal(
    getBytePlusUserSafeErrorMessage('Quota exceeded: resource pack exhausted.'),
    'The render queue is temporarily busy. Please retry in a few moments.'
  );
});

test('BytePlus ModelArk task failures say when a Seedance render stopped after starting', () => {
  const message = getBytePlusUserSafeTaskFailureMessage('Request failed.');

  assert.equal(
    message,
    'Seedance started this render but did not deliver a video. Retry with a simpler prompt or fewer reference assets.'
  );
  assert.doesNotMatch(message, /BytePlus|ModelArk|request failed/i);
});

test('BytePlus Mini runtime uses Mini caps and input-specific accounting rates', () => {
  assert.deepEqual(getBytePlusSeedanceAllowedResolutions('seedance-2-0-mini'), ['480p', '720p']);
  assert.equal(
    (getBytePlusUnitPriceUsdPer1kTokens as (engineId: string, billingInputType?: string) => number)(
      'seedance-2-0-mini',
      'no_video_input'
    ),
    0.0035
  );
  assert.equal(
    (getBytePlusUnitPriceUsdPer1kTokens as (engineId: string, billingInputType?: string) => number)(
      'seedance-2-0-mini',
      'video_input'
    ),
    0.0021
  );
  assert.equal(getBytePlusAccounting({
    has_audio: false,
    settings_snapshot: {
      inputMode: 'extend',
      refs: { videoUrls: ['https://cdn.maxvideoai.com/source.mp4'] },
    },
  }).byteplusBillingInputType, 'video_input');

  const options = normalizeBytePlusOptions({
    engineId: 'seedance-2-0-mini',
    durationSec: 4,
    requestedResolution: '480p',
    aspectRatio: '16:9',
  });
  assert.equal(options.ok, true);
  const miniEntry = listFalEngines().find((entry) => entry.id === 'seedance-2-0-mini');
  assert.ok(miniEntry);
  assert.equal(miniEntry.engine.audio, true);
  assert.equal(miniEntry.modes.every((mode) => mode.ui.audioToggle === true), true);
  assert.equal(miniEntry.engine.inputSchema?.optional?.some((field) => field.id === 'generate_audio'), true);
  const miniRuntimeEngine = applyBytePlusSeedanceRuntimeOptions(miniEntry.engine, {
    provider: 'byteplus_modelark',
    allowedModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
  });
  assert.equal(miniRuntimeEngine.audio, true);
  assert.equal(miniRuntimeEngine.modeCaps ? Object.values(miniRuntimeEngine.modeCaps).every((caps) => caps?.audioToggle === true) : true, true);

  const payload = buildBytePlusSeedancePayload({
    modelId: 'dreamina-seedance-2-0-mini-260615',
    prompt: 'Edit this source video',
    durationSec: 4,
    mode: 'v2v',
    referenceVideoUrls: ['https://cdn.maxvideoai.com/source.mp4'],
    resolution: '480p',
    ratio: '16:9',
    generateAudio: false,
    allowedResolutions: ['480p', '720p'],
  });
  assert.equal(payload.duration, 4);
  assert.equal(payload.generate_audio, false);
  assert.equal(payload.model, 'dreamina-seedance-2-0-mini-260615');
});

test('BytePlus Standard exposes 4k while Fast and Mini stay capped below 4k', () => {
  assert.deepEqual(getBytePlusSeedanceAllowedResolutions('seedance-2-0'), ['480p', '720p', '1080p', '4k']);
  assert.deepEqual(getBytePlusSeedanceAllowedResolutions('seedance-2-0-fast'), ['480p', '720p']);
  assert.deepEqual(getBytePlusSeedanceAllowedResolutions('seedance-2-0-mini'), ['480p', '720p']);

  const standardEntry = listFalEngines().find((entry) => entry.id === 'seedance-2-0');
  assert.ok(standardEntry);
  const runtimeEngine = applyBytePlusSeedanceRuntimeOptions(standardEntry.engine, {
    provider: 'byteplus_modelark',
    allowedModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
  });
  const fields = [...(runtimeEngine.inputSchema?.required ?? []), ...(runtimeEngine.inputSchema?.optional ?? [])];
  const resolutionField = fields.find((field) => field.id === 'resolution');
  assert.deepEqual(runtimeEngine.resolutions, ['480p', '720p', '1080p', '4k']);
  assert.deepEqual(resolutionField?.values, ['480p', '720p', '1080p', '4k']);

  const payload = buildBytePlusSeedancePayload({
    modelId: 'dreamina-seedance-2-0-260128',
    prompt: 'Render this approved cinematic master in native 4K.',
    durationSec: 5,
    mode: 't2v',
    resolution: '4k',
    ratio: '16:9',
    generateAudio: true,
    allowedResolutions: ['480p', '720p', '1080p', '4k'],
  });
  assert.equal(payload.resolution, '4k');

  assert.throws(
    () =>
      buildBytePlusSeedancePayload({
        modelId: 'dreamina-seedance-2-0-fast-260128',
        prompt: 'Fast should remain capped below native 4K.',
        durationSec: 5,
        mode: 't2v',
        resolution: '4k',
        ratio: '16:9',
        allowedResolutions: ['480p', '720p'],
      }),
    /resolution is not supported/
  );
});

test('BytePlus Standard 4k accounting uses 4k dimensions and input-aware official rates', () => {
  assert.equal(
    expectedBytePlusTokens({
      duration_sec: 1,
      settings_snapshot: {
        core: {
          resolution: '4k',
          aspectRatio: '16:9',
        },
      },
    }),
    194400
  );
  assert.equal(
    expectedBytePlusTokens({
      duration_sec: 1,
      settings_snapshot: {
        core: {
          resolution: '4k',
          aspectRatio: '4:3',
        },
      },
    }),
    194415.09375
  );
  assert.equal(getBytePlusUnitPriceUsdPer1kTokens('seedance-2-0', 'no_video_input', '4k'), 0.004);
  assert.equal(getBytePlusUnitPriceUsdPer1kTokens('seedance-2-0', 'video_input', '4k'), 0.0024);
  assert.equal(getBytePlusUnitPriceUsdPer1kTokens('seedance-2-0', 'no_video_input', '1080p'), 0.007);
  assert.equal(getBytePlusUnitPriceUsdPer1kTokens('seedance-2-0-fast', 'no_video_input', '4k'), 0.0056);
});

test('BytePlus Mini cannot fall back to Fal through provider env override', () => {
  const providerSource = readFileSync(providerPath, 'utf8');
  const envSource = readFileSync(envPath, 'utf8');

  assert.doesNotMatch(envSource, /SEEDANCE_MINI_PROVIDER/);
  assert.doesNotMatch(providerSource, /seedanceMiniProviderOverride/);
  assert.equal(shouldRoutePublicSeedanceMiniToBytePlus('seedance-2-0-mini'), true);
  assert.equal(shouldRoutePublicSeedanceFastToBytePlus('seedance-2-0-fast'), false);
});

test('BytePlus runtime exposes Seedance 2.0 Standard and Fast video source workflows', () => {
  const seedanceEntries = ['seedance-2-0', 'seedance-2-0-fast']
    .map((engineId) => listFalEngines().find((entry) => entry.id === engineId))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  assert.equal(seedanceEntries.length, 2);

  for (const entry of seedanceEntries) {
    const runtimeEngine = applyBytePlusSeedanceRuntimeOptions(entry.engine, {
      provider: 'byteplus_modelark',
      allowedModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
    });
    const fields = [...(runtimeEngine.inputSchema?.required ?? []), ...(runtimeEngine.inputSchema?.optional ?? [])];
    const sourceVideoField = fields.find((field) => field.id === 'video_url');
    const extensionSourceField = fields.find((field) => field.id === 'extension_source_videos');
    const referenceVideoField = fields.find((field) => field.id === 'video_urls');

    assert.deepEqual(runtimeEngine.modes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
    assert.equal(runtimeEngine.extend, true);
    assert.equal(sourceVideoField?.label, 'Source video');
    assert.deepEqual(sourceVideoField?.modes, ['v2v']);
    assert.deepEqual(sourceVideoField?.requiredInModes, ['v2v']);
    assert.equal(sourceVideoField?.maxCount, 1);
    assert.equal(extensionSourceField?.label, 'Source clips to extend (up to 3)');
    assert.deepEqual(extensionSourceField?.modes, ['extend']);
    assert.deepEqual(extensionSourceField?.requiredInModes, ['extend']);
    assert.equal(extensionSourceField?.minCount, 1);
    assert.equal(extensionSourceField?.maxCount, 3);
    assert.deepEqual(referenceVideoField?.modes, ['ref2v']);
  }
});
