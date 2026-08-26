import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { normalizeBytePlusOptions } from '../frontend/app/api/generate/_lib/request-options-byteplus';
import {
  applyBytePlusSeedanceRuntimeOptions,
  buildBytePlusSeedancePayload,
  getBytePlusUserSafeErrorMessage,
  getBytePlusUserSafeTaskFailureMessage,
  getBytePlusTaskFailureCode,
  getBytePlusModelArkClient,
  resolveBytePlusPollTransport,
  getBytePlusSeedanceAllowedResolutions,
  normalizeBytePlusTask,
  shouldRoutePublicSeedanceFastToBytePlus,
  shouldRoutePublicSeedanceMiniToBytePlus,
} from '../frontend/src/server/video-providers/byteplus-modelark';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { ENV } from '../frontend/src/lib/env';
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

test('BytePlus selects ModelArk for proven Seedance 2.5 T2V and LAS for advanced modes', { concurrency: false }, async () => {
  const providerModule = await import('../frontend/src/server/video-providers/byteplus-modelark');
  const resolveTransport = (
    providerModule as unknown as {
      resolveBytePlusTransport?: (engineId: string, mode: string) => 'modelark' | 'las';
    }
  ).resolveBytePlusTransport;
  assert.equal(typeof resolveTransport, 'function');
  assert.equal(resolveTransport?.('seedance-2-5', 't2v'), 'modelark');
  assert.equal(resolveTransport?.('seedance-2-5', 'i2v'), 'las');
  assert.equal(resolveTransport?.('seedance-2-5', 'ref2v'), 'las');
  assert.equal(resolveTransport?.('seedance-2-5', 'v2v'), 'las');
  assert.equal(resolveTransport?.('seedance-2-5', 'extend'), 'las');
  assert.equal(resolveTransport?.('seedance-2-0', 'v2v'), 'modelark');

  const mutableEnv = ENV as typeof ENV & Record<string, string | undefined>;
  const original = {
    arkApiKey: mutableEnv.BYTEPLUS_ARK_API_KEY,
    arkBaseUrl: mutableEnv.BYTEPLUS_ARK_BASE_URL,
    lasApiKey: mutableEnv.BYTEPLUS_LAS_API_KEY,
    lasBaseUrl: mutableEnv.BYTEPLUS_LAS_BASE_URL,
    fetch: globalThis.fetch,
  };
  const calls: Array<{ url: string; authorization: string | null }> = [];
  const payload = {
    model: 'dreamina-seedance-2-5-260628',
    content: [{ type: 'text', text: 'A cinematic landscape.' }],
    resolution: '480p',
    ratio: '16:9',
    duration: 4,
    generate_audio: false,
    watermark: false,
  };

  try {
    mutableEnv.BYTEPLUS_ARK_API_KEY = 'ark-test-key';
    mutableEnv.BYTEPLUS_ARK_BASE_URL = 'https://ark.example.test/api/v3';
    mutableEnv.BYTEPLUS_LAS_API_KEY = 'las-test-key';
    mutableEnv.BYTEPLUS_LAS_BASE_URL = 'https://operator.las.example.test/api/v1';
    globalThis.fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        authorization: headers.get('authorization'),
      });
      return new Response(JSON.stringify({ id: `task_${calls.length}`, status: 'queued' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    await (getBytePlusModelArkClient as unknown as (transport: string) => ReturnType<typeof getBytePlusModelArkClient>)(
      'modelark'
    ).createSeedanceFastTask(payload as never);
    await (getBytePlusModelArkClient as unknown as (transport: string) => ReturnType<typeof getBytePlusModelArkClient>)(
      'las'
    ).createSeedanceFastTask(payload as never);

    assert.deepEqual(calls, [
      {
        url: 'https://ark.example.test/api/v3/contents/generations/tasks',
        authorization: 'Bearer ark-test-key',
      },
      {
        url: 'https://operator.las.example.test/api/v1/contents/generations/tasks',
        authorization: 'Bearer las-test-key',
      },
    ]);
  } finally {
    mutableEnv.BYTEPLUS_ARK_API_KEY = original.arkApiKey;
    mutableEnv.BYTEPLUS_ARK_BASE_URL = original.arkBaseUrl;
    mutableEnv.BYTEPLUS_LAS_API_KEY = original.lasApiKey;
    mutableEnv.BYTEPLUS_LAS_BASE_URL = original.lasBaseUrl;
    globalThis.fetch = original.fetch;
  }
});

test('BytePlus polling reuses the persisted transport and safely classifies legacy task ids', () => {
  assert.equal(resolveBytePlusPollTransport({
    providerJobId: 'lsd-new-task',
    settingsSnapshot: { byteplusTransport: 'modelark' },
  }), 'modelark');
  assert.equal(resolveBytePlusPollTransport({
    providerJobId: 'cgt-old-task',
    settingsSnapshot: { byteplusTransport: 'las' },
  }), 'las');
  assert.equal(resolveBytePlusPollTransport({
    providerJobId: 'lsd-legacy-las-task',
    settingsSnapshot: {},
  }), 'las');
  assert.equal(resolveBytePlusPollTransport({
    providerJobId: 'cgt-legacy-modelark-task',
    settingsSnapshot: null,
  }), 'modelark');
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

test('BytePlus Seedance makes video edit and extension intent explicit without rewriting creative prompts', () => {
  const base = {
    modelId: 'dreamina-seedance-2-5-260628',
    durationSec: 4,
    referenceVideoUrls: ['https://cdn.maxvideoai.com/source.mp4'],
    resolution: '480p',
    ratio: '16:9',
    allowedResolutions: ['480p'] as const,
    allowedDurationOptions: [4] as const,
  };

  const edit = buildBytePlusSeedancePayload({
    ...base,
    prompt: 'Create a subtle cinematic variation while preserving the composition.',
    mode: 'v2v',
  });
  assert.equal(
    edit.content[0]?.type === 'text' ? edit.content[0].text : null,
    'Edit Video 1 according to this instruction: Create a subtle cinematic variation while preserving the composition.'
  );

  const explicitEditPrompt = 'Strictly edit Video 1 and replace its background with a moonlit studio.';
  const explicitEdit = buildBytePlusSeedancePayload({
    ...base,
    prompt: explicitEditPrompt,
    mode: 'v2v',
  });
  assert.equal(
    explicitEdit.content[0]?.type === 'text' ? explicitEdit.content[0].text : null,
    explicitEditPrompt
  );

  const extension = buildBytePlusSeedancePayload({
    ...base,
    prompt: 'Continue the camera move into the next shot.',
    mode: 'extend',
  });
  assert.equal(
    extension.content[0]?.type === 'text' ? extension.content[0].text : null,
    'Extend or continue Video 1 according to this instruction: Continue the camera move into the next shot.'
  );

  const referencePrompt = 'Use the motion as inspiration for a new product shot.';
  const reference = buildBytePlusSeedancePayload({
    ...base,
    prompt: referencePrompt,
    mode: 'ref2v',
  });
  assert.equal(
    reference.content[0]?.type === 'text' ? reference.content[0].text : null,
    referencePrompt
  );
});

test('BytePlus Seedance maps provider task-type constraints to safe actionable guidance', () => {
  const providerCode = 'InvalidParameter.TaskTypeConstraint';
  assert.equal(
    getBytePlusTaskFailureCode(null, providerCode),
    'seedance_task_type_constraint'
  );
  assert.equal(
    getBytePlusUserSafeTaskFailureMessage(null, providerCode),
    'Seedance could not identify the intended video edit or extension. Refer to the source directly as Video 1, then prepare a new quote before retrying.'
  );
});

test('BytePlus ModelArk explains provider pixel-floor and inherited-ratio rejections precisely', () => {
  const pixelMessage =
    'The parameter content[1] video pixel count must be >= 407696 for model dreamina-seedance-2-5 in r2v.';
  assert.equal(
    getBytePlusUserSafeErrorMessage(pixelMessage),
    'The source video is too small for Seedance. Use a video with at least 407,696 total pixels and try again.'
  );
  assert.equal(
    getBytePlusTaskFailureCode(pixelMessage),
    'seedance_input_video_too_small'
  );

  const ratioMessage =
    'The parameter ratio specified in the request is not valid. For first-frame or first-last-frame generation, the output ratio follows the first-frame image.';
  assert.equal(
    getBytePlusUserSafeErrorMessage(ratioMessage),
    "Seedance follows the start image's aspect ratio automatically. Re-upload the start image and try again."
  );
  assert.equal(
    getBytePlusTaskFailureCode(ratioMessage),
    'seedance_i2v_ratio_rejected'
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
    modelId: 'dreamina-seedance-2-5-250815',
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
    modelId: 'dreamina-seedance-2-5-250815',
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
  assert.equal(
    Object.hasOwn(startOnly, 'ratio'),
    false,
    'first-frame generation must let BytePlus inherit the source image ratio'
  );
  assert.equal(
    Object.hasOwn(startAndEnd, 'ratio'),
    false,
    'first/last-frame generation must let BytePlus inherit the source image ratio'
  );

  const seedance20Payload = buildBytePlusSeedancePayload({
    modelId: 'dreamina-seedance-2-0-260128',
    prompt,
    durationSec: 5,
    mode: 'i2v',
    imageUrl: 'https://cdn.maxvideoai.com/start.png',
    resolution: '720p',
    ratio: '16:9',
    allowedResolutions: ['720p'],
    allowedDurationOptions: [5],
  });
  assert.equal(
    seedance20Payload.ratio,
    '16:9',
    'the Seedance 2.5 provider workaround must not change older payload contracts'
  );

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
