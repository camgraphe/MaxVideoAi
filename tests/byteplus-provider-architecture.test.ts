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
  normalizeBytePlusTask,
  shouldRoutePublicSeedanceFastToBytePlus,
  shouldRoutePublicSeedanceMiniToBytePlus,
} from '../frontend/src/server/video-providers/byteplus-modelark';
import { listFalEngines } from '../frontend/src/config/falEngines';
import {
  isBytePlusSeedanceHiddenEngine,
  requiresBytePlusSeedanceEarlyGate,
} from '../frontend/src/server/video-providers/byteplus-modelark-profile-policy';
import {
  expectedBytePlusTokens,
  getBytePlusAccounting,
  getBytePlusUnitPriceUsdPer1kTokens,
} from '../frontend/server/byteplus-accounting';

const pollPath = 'frontend/server/byteplus-poll.ts';
const pollFailurePath = 'frontend/server/byteplus-poll-failure.ts';
const accountingPath = 'frontend/server/byteplus-accounting.ts';
const storageCopyPath = 'frontend/server/byteplus-storage-copy.ts';
const pollTypesPath = 'frontend/server/byteplus-poll-types.ts';
const providerPath = 'frontend/src/server/video-providers/byteplus-modelark.ts';
const providerConstantsPath = 'frontend/src/server/video-providers/byteplus-modelark-constants.ts';
const providerErrorPath = 'frontend/src/server/video-providers/byteplus-modelark-error.ts';
const providerPayloadPath = 'frontend/src/server/video-providers/byteplus-modelark-payload.ts';
const providerResponsePath = 'frontend/src/server/video-providers/byteplus-modelark-response.ts';
const envPath = 'frontend/src/lib/env.ts';

test('BytePlus poll delegates accounting, failure handling, storage-copy retry, and shared types', () => {
  for (const path of [pollPath, pollFailurePath, accountingPath, storageCopyPath, pollTypesPath]) {
    assert.equal(existsSync(path), true, `${path} should exist`);
  }

  const pollSource = readFileSync(pollPath, 'utf8');
  const pollFailureSource = readFileSync(pollFailurePath, 'utf8');
  const accountingSource = readFileSync(accountingPath, 'utf8');
  const storageCopySource = readFileSync(storageCopyPath, 'utf8');
  const pollTypesSource = readFileSync(pollTypesPath, 'utf8');

  assert.ok(pollSource.split('\n').length < 430, 'byteplus-poll.ts should stay under 430 lines');
  assert.match(pollSource, /from '\.\/byteplus-accounting'/);
  assert.match(pollSource, /from '\.\/byteplus-poll-failure'/);
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
  assert.match(pollFailureSource, /providerErrorCode/);
  assert.match(pollFailureSource, /providerFailure/);
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

test('BytePlus ModelArk preserves and explains output copyright policy failures', () => {
  const providerCode = 'OutputVideoSensitiveContentDetected.PolicyViolation';
  const providerMessage =
    'The request failed because the output video may be related to copyright restrictions. Request id: req_123';
  const task = normalizeBytePlusTask({
    id: 'cgt_123',
    status: 'failed',
    error: {
      code: providerCode,
      message: providerMessage,
    },
  });

  assert.equal(task.errorCode, providerCode);
  assert.equal(
    getBytePlusUserSafeTaskFailureMessage(task.message, task.errorCode),
    'Seedance stopped this render after it started because its output checks detected possible copyright-restricted content. Change recognizable characters, brands, logos, franchise references, or source media before trying again.'
  );
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

test('BytePlus payload respects explicit empty capabilities while omitted capabilities keep defaults', () => {
  const basePayload = {
    modelId: 'dreamina-seedance-2-0-fast-260128',
    prompt: 'A profile capability test.',
    durationSec: 5,
    mode: 't2v' as const,
    resolution: '720p',
    ratio: '16:9',
  };

  assert.throws(
    () => buildBytePlusSeedancePayload({ ...basePayload, allowedModes: [] }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_MODE_UNSUPPORTED'
  );
  assert.throws(
    () => buildBytePlusSeedancePayload({ ...basePayload, allowedAspectRatios: [] }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_RATIO_UNSUPPORTED'
  );
  assert.throws(
    () => buildBytePlusSeedancePayload({ ...basePayload, allowedResolutions: [] }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code ===
        'BYTEPLUS_RESOLUTION_UNSUPPORTED'
  );
  assert.throws(
    () =>
      buildBytePlusSeedancePayload({
        ...basePayload,
        allowedDurationOptions: [],
      }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code ===
        'BYTEPLUS_DURATION_UNSUPPORTED'
  );

  const payload = buildBytePlusSeedancePayload(basePayload);
  assert.equal(payload.resolution, '720p');
  assert.equal(payload.ratio, '16:9');
});

test('BytePlus payload counts typed budget items before URL deduplication', () => {
  assert.throws(
    () =>
      buildBytePlusSeedancePayload({
        modelId: 'current-model-id',
        prompt: 'A reference-guided scene',
        durationSec: 5,
        mode: 'ref2v',
        resolution: '720p',
        ratio: '16:9',
        allowedResolutions: ['720p'],
        allowedDurationOptions: [5],
        referenceBudget: {
          fieldIds: ['image_urls'],
          maxTotal: 1,
          countUniqueUrls: false,
        },
        referenceMediaItems: [
          { fieldId: 'image_urls', kind: 'image', url: 'same' },
          { fieldId: 'image_urls', kind: 'image', url: 'same' },
        ],
      }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_REFERENCE_BUDGET_EXCEEDED'
  );
});

test('BytePlus image-to-video uses first and last frame roles without rewriting the prompt', () => {
  const prompt = 'A dancer crosses the room while the camera slowly pulls back.';
  const startOnly = buildBytePlusSeedancePayload({
    modelId: 'current-model-id',
    prompt,
    durationSec: 5,
    mode: 'i2v',
    imageUrl: 'https://cdn.maxvideoai.com/start.png',
    resolution: '720p',
    ratio: '16:9',
    allowedResolutions: ['720p'],
    allowedDurationOptions: [5],
  });
  const startAndEnd = buildBytePlusSeedancePayload({
    modelId: 'current-model-id',
    prompt,
    durationSec: 5,
    mode: 'i2v',
    imageUrl: 'https://cdn.maxvideoai.com/start.png',
    endImageUrl: 'https://cdn.maxvideoai.com/end.png',
    resolution: '720p',
    ratio: '16:9',
    allowedResolutions: ['720p'],
    allowedDurationOptions: [5],
  });

  assert.deepEqual(startOnly.content, [
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: { url: 'https://cdn.maxvideoai.com/start.png' },
      role: 'first_frame',
    },
  ]);
  assert.deepEqual(startAndEnd.content, [
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: { url: 'https://cdn.maxvideoai.com/start.png' },
      role: 'first_frame',
    },
    {
      type: 'image_url',
      image_url: { url: 'https://cdn.maxvideoai.com/end.png' },
      role: 'last_frame',
    },
  ]);

  const referencePayload = buildBytePlusSeedancePayload({
    modelId: 'current-model-id',
    prompt,
    durationSec: 5,
    mode: 'ref2v',
    referenceImageUrls: ['https://cdn.maxvideoai.com/reference.png'],
    resolution: '720p',
    ratio: '16:9',
    allowedResolutions: ['720p'],
    allowedDurationOptions: [5],
  });
  assert.deepEqual(referencePayload.content[1], {
    type: 'image_url',
    image_url: { url: 'https://cdn.maxvideoai.com/reference.png' },
    role: 'reference_image',
  });
});

test('BytePlus typed provenance preserves a non-budget V2V source video', () => {
  const payload = buildBytePlusSeedancePayload({
    modelId: 'current-model-id',
    prompt: 'Edit the source',
    durationSec: 5,
    mode: 'v2v',
    resolution: '720p',
    ratio: '16:9',
    allowedResolutions: ['720p'],
    allowedDurationOptions: [5],
    referenceImageUrls: ['reference-image'],
    referenceVideoUrls: ['source-video'],
    referenceBudget: {
      fieldIds: ['reference_image_urls'],
      maxTotal: 1,
      countUniqueUrls: true,
    },
    referenceMediaItems: [
      {
        fieldId: 'reference_image_urls',
        kind: 'image',
        url: 'reference-image',
      },
      { fieldId: 'video_url', kind: 'video', url: 'source-video' },
    ],
  });

  assert.deepEqual(
    payload.content
      .filter((item) => item.type !== 'text')
      .map((item) =>
        item.type === 'image_url'
          ? item.image_url.url
          : item.type === 'video_url'
            ? item.video_url.url
            : item.audio_url.url
      ),
    ['reference-image', 'source-video']
  );
});

test('BytePlus rejects a budgeted item omitted from provider-selected arrays', () => {
  assert.throws(
    () =>
      buildBytePlusSeedancePayload({
        modelId: 'current-model-id',
        prompt: 'A reference-guided scene',
        durationSec: 5,
        mode: 'ref2v',
        resolution: '720p',
        ratio: '16:9',
        allowedResolutions: ['720p'],
        allowedDurationOptions: [5],
        referenceBudget: {
          fieldIds: ['image_urls'],
          maxTotal: 2,
          countUniqueUrls: true,
        },
        referenceMediaItems: [
          { fieldId: 'image_urls', kind: 'image', url: 'missing-image' },
        ],
      }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code ===
        'BYTEPLUS_REFERENCE_BUDGET_INPUT_MISMATCH'
  );
});

test('BytePlus Standard 4k accounting uses 4k dimensions and input-aware official rates', () => {
  assert.equal(
    expectedBytePlusTokens({
      engine_id: 'seedance-2-0',
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
      engine_id: 'seedance-2-0',
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

test('Seedance 2.5 accounting selects the factual rate class from video input presence', () => {
  const cases = [
    {
      name: 'text to video',
      mode: 't2v',
      refs: {},
      expectedClass: 'no_video_input',
      expectedRate: 0.0107,
    },
    {
      name: 'image to video',
      mode: 'i2v',
      refs: { imageUrl: 'https://cdn.maxvideoai.com/start.png' },
      expectedClass: 'no_video_input',
      expectedRate: 0.0107,
    },
    {
      name: 'image-only reference to video',
      mode: 'ref2v',
      refs: { referenceImages: ['https://cdn.maxvideoai.com/reference.png'] },
      expectedClass: 'no_video_input',
      expectedRate: 0.0107,
    },
    {
      name: 'video reference to video',
      mode: 'ref2v',
      refs: { videoUrls: ['https://cdn.maxvideoai.com/reference.mp4'] },
      expectedClass: 'video_input',
      expectedRate: 0.0064,
    },
    {
      name: 'video edit',
      mode: 'v2v',
      refs: { videoUrls: ['https://cdn.maxvideoai.com/source.mp4'] },
      expectedClass: 'video_input',
      expectedRate: 0.0064,
    },
    {
      name: 'video extension',
      mode: 'extend',
      refs: { videoUrls: ['https://cdn.maxvideoai.com/source.mp4'] },
      expectedClass: 'video_input',
      expectedRate: 0.0064,
    },
  ] as const;

  for (const scenario of cases) {
    const accounting = getBytePlusAccounting({
      has_audio: false,
      settings_snapshot: {
        inputMode: scenario.mode,
        refs: scenario.refs,
      },
    });
    assert.equal(
      accounting.byteplusBillingInputType,
      scenario.expectedClass,
      scenario.name
    );
    assert.equal(
      getBytePlusUnitPriceUsdPer1kTokens(
        'seedance-2-5',
        accounting.byteplusBillingInputType
      ),
      scenario.expectedRate,
      scenario.name
    );
  }
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

test('hidden direct Fast keeps its narrow raw runtime caps by default', () => {
  const hiddenEntry = listFalEngines().find(
    (entry) => entry.id === 'seedance-2-0-fast-byteplus'
  );
  assert.ok(hiddenEntry);
  const runtimeEngine = applyBytePlusSeedanceRuntimeOptions(hiddenEntry.engine);
  assert.deepEqual(runtimeEngine.modes, ['t2v']);
  assert.deepEqual(runtimeEngine.resolutions, ['720p']);
  assert.deepEqual(runtimeEngine.aspectRatios, ['16:9']);
  assert.deepEqual(hiddenEntry.modes[0]?.ui.resolution, ['720p']);
  assert.equal(hiddenEntry.modes[0]?.ui.audioToggle, false);
});

test('Seedance early gating is independent from hidden-engine resolution', () => {
  assert.equal(requiresBytePlusSeedanceEarlyGate('seedance-2-5'), true);
  assert.equal(requiresBytePlusSeedanceEarlyGate('seedance-2-0-fast-byteplus'), true);
  assert.equal(requiresBytePlusSeedanceEarlyGate('seedance-2-0'), false);
  assert.equal(isBytePlusSeedanceHiddenEngine('seedance-2-5'), false);
  assert.equal(isBytePlusSeedanceHiddenEngine('seedance-2-0-fast-byteplus'), true);
});

test('profile policy is separated from the thin provider facade', () => {
  const facade = readFileSync(
    'frontend/src/server/video-providers/byteplus-modelark.ts',
    'utf8'
  );
  const policy = readFileSync(
    'frontend/src/server/video-providers/byteplus-modelark-profile-policy.ts',
    'utf8'
  );
  assert.ok(facade.split('\n').length < 430);
  assert.match(facade, /from '\.\/byteplus-modelark-profile-policy'/);
  assert.match(policy, /export function applyBytePlusSeedanceRuntimeOptions/);
  assert.match(policy, /export function resolveBytePlusSeedanceRouteProfile/);
  assert.doesNotMatch(facade, /function filterInputFieldsForModes/);
});
