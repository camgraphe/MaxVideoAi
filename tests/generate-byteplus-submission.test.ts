import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { deriveGenerationAttachmentReferences } from '../frontend/app/api/generate/_lib/attachment-references';
import { submitBytePlusGenerateTask } from '../frontend/app/api/generate/_lib/byteplus-submission';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { ENV } from '../frontend/src/lib/env';
import type { PendingReceipt } from '../frontend/app/api/generate/_lib/initial-video-job';
import { buildGenerateValidationPayload } from '../frontend/app/api/generate/_lib/validation-payload';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/attachments';
import type { EngineInputSchema } from '../frontend/types/engines';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/byteplus-submission.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = existsSync(helperPath) ? readFileSync(helperPath, 'utf8') : '';

const pendingReceipt: PendingReceipt = {
  userId: 'user_123',
  amountCents: 1200,
  currency: 'USD',
  description: 'Run Seedance - 8s',
  jobId: 'job_123',
  snapshot: { totalCents: 1200 },
  applicationFeeCents: null,
  vendorAccountId: null,
};

const baseParams = {
  jobId: 'job_123',
  userId: 'user_123',
  engineId: 'seedance-2-0',
  engineLabel: 'Seedance 2.0',
  prompt: 'A cinematic mountain shot',
  durationSec: 8,
  mode: 'ref2v' as const,
  initialImageUrl: null,
  endImageUrl: null,
  normalizedReferenceImages: ['https://cdn.maxvideoai.com/ref.jpg'],
  videoUrls: ['https://cdn.maxvideoai.com/ref.mp4'],
  resolvedAudioUrl: 'https://cdn.maxvideoai.com/ref.wav',
  audioUrls: ['https://cdn.maxvideoai.com/ref.wav', 'https://cdn.maxvideoai.com/alt.wav'],
  effectiveResolution: '720p',
  aspectRatio: '16:9',
  audioEnabled: true,
  placeholderThumb: '/assets/frames/thumb-16x9.svg',
  pricing: { totalCents: 1200, currency: 'USD' } as never,
  paymentStatus: 'paid_wallet',
  pendingReceipt: null,
  paymentMode: 'wallet' as const,
  walletChargeReserved: true,
  batchId: 'batch_123',
  groupId: 'group_123',
  iterationIndex: 0,
  iterationCount: 2,
  renderIds: ['job_123', 'job_456'],
  heroRenderId: 'job_123',
  localKey: 'local_123',
};

test('generate route delegates BytePlus submission', () => {
  assert.ok(existsSync(helperPath), 'BytePlus submission should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/byteplus-submission'/);
  assert.doesNotMatch(routeSource, /isPublicSeedanceBytePlus/);
  assert.doesNotMatch(routeSource, /buildBytePlusSeedancePayload/, 'BytePlus payload construction belongs in byteplus-submission.ts');
  assert.doesNotMatch(routeSource, /createSeedanceFastTask/, 'BytePlus task creation belongs in byteplus-submission.ts');
  assert.doesNotMatch(routeSource, /\[byteplus\] task submission failed/, 'BytePlus failure handling belongs in byteplus-submission.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 1475, `/api/generate route should stay below 1475 lines after BytePlus extraction, got ${lineCount}`);
});

test('BytePlus submission helper exposes the route contract', () => {
  assert.match(helperSource, /export type BytePlusSubmissionResult/, 'BytePlusSubmissionResult should be exported');
  assert.match(helperSource, /export async function submitBytePlusGenerateTask/, 'submitBytePlusGenerateTask should be exported');
  assert.doesNotMatch(helperSource, /isPublicSeedanceBytePlus/);
});

test('BytePlus submission helper creates task, updates job, logs, and returns queued response', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const persistedProviderIds: string[] = [];
  const logs: Array<{ kind: string; options: Record<string, unknown> }> = [];
  const builtPayloads: Record<string, unknown>[] = [];

  const result = await submitBytePlusGenerateTask({
    ...baseParams,
    deps: {
      getBytePlusArkConfigFn: () => ({ seedanceModelId: 'model-public', seedanceFastModelId: 'model-fast' }),
      buildBytePlusSeedancePayloadFn: (payload) => {
        builtPayloads.push(payload);
        return { ...payload, normalized: true };
      },
      getBytePlusModelArkClientFn: () => ({
        createSeedanceFastTask: async () => ({ providerJobId: 'provider_123', status: 'queued' }),
      }),
      getBytePlusSeedanceAllowedResolutionsFn: () => ['720p', '1080p'] as never,
      getBytePlusSeedanceDurationOptionsFn: () => [8] as never,
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
      },
      persistProviderJobIdFn: async (providerJobId) => {
        persistedProviderIds.push(providerJobId);
      },
      logMetricFn: (kind, options) => {
        logs.push({ kind, options });
      },
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(builtPayloads[0], {
    modelId: 'model-public',
    prompt: 'A cinematic mountain shot',
    durationSec: 8,
    mode: 'ref2v',
    imageUrl: null,
    endImageUrl: null,
    referenceImageUrls: ['https://cdn.maxvideoai.com/ref.jpg'],
    referenceVideoUrls: ['https://cdn.maxvideoai.com/ref.mp4'],
    referenceAudioUrls: ['https://cdn.maxvideoai.com/ref.wav', 'https://cdn.maxvideoai.com/alt.wav'],
    resolution: '720p',
    ratio: '16:9',
    generateAudio: true,
    allowedModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
    allowedAspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    allowedResolutions: ['720p', '1080p'],
    allowedDurationOptions: [8],
  });
  assert.deepEqual(persistedProviderIds, ['provider_123']);
  assert.match(queries[0]?.sql ?? '', /UPDATE app_jobs/);
  assert.deepEqual(queries[0]?.params, [
    'job_123',
    'queued',
    10,
    'Render submitted.',
    'byteplus_modelark',
    'provider_123',
  ]);
  assert.equal(logs[0]?.kind, 'accepted');
  assert.deepEqual(result.body, {
    ok: true,
    jobId: 'job_123',
    videoUrl: null,
    video: null,
    thumbUrl: '/assets/frames/thumb-16x9.svg',
    status: 'queued',
    progress: 10,
    pricing: { totalCents: 1200, currency: 'USD' },
    paymentStatus: 'paid_wallet',
    provider: 'byteplus_modelark',
    providerJobId: 'provider_123',
    batchId: 'batch_123',
    groupId: 'group_123',
    iterationIndex: 0,
    iterationCount: 2,
    renderIds: ['job_123', 'job_456'],
    heroRenderId: 'job_123',
    localKey: 'local_123',
  });
});

test('BytePlus submission helper chooses the Mini model id for Seedance 2.0 Mini', async () => {
  const builtPayloads: Record<string, unknown>[] = [];

  const result = await submitBytePlusGenerateTask({
    ...baseParams,
    engineId: 'seedance-2-0-mini',
    engineLabel: 'Seedance 2.0 Mini',
    durationSec: 4,
    mode: 'v2v',
    normalizedReferenceImages: [],
    videoUrls: ['https://cdn.maxvideoai.com/source.mp4'],
    audioEnabled: true,
    deps: {
      getBytePlusArkConfigFn: () =>
        ({
          seedanceModelId: 'model-public',
          seedanceFastModelId: 'model-fast',
          seedanceMiniModelId: 'model-mini',
        }) as never,
      buildBytePlusSeedancePayloadFn: (payload) => {
        builtPayloads.push(payload);
        return { ...payload, normalized: true };
      },
      getBytePlusModelArkClientFn: () => ({
        createSeedanceFastTask: async () => ({ providerJobId: 'provider_mini', status: 'queued' }),
      }),
      getBytePlusSeedanceAllowedResolutionsFn: () => ['480p', '720p'] as never,
      queryFn: async () => undefined,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(builtPayloads[0]?.modelId, 'model-mini');
  assert.equal(builtPayloads[0]?.durationSec, 4);
  assert.equal(builtPayloads[0]?.mode, 'v2v');
  assert.equal(builtPayloads[0]?.generateAudio, true);
  assert.deepEqual(builtPayloads[0]?.allowedModes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
  assert.deepEqual(builtPayloads[0]?.allowedAspectRatios, ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
  assert.deepEqual(builtPayloads[0]?.allowedResolutions, ['480p', '720p']);
});

test('BytePlus submission helper marks failed tasks, rolls back payments, and returns provider error', async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const rollbacks: Array<{ refundDescription: string }> = [];
  const logs: Array<{ kind: string; options: Record<string, unknown> }> = [];

  try {
    const result = await submitBytePlusGenerateTask({
      ...baseParams,
      pendingReceipt,
      deps: {
        getBytePlusArkConfigFn: () => ({ seedanceModelId: 'model-public', seedanceFastModelId: 'model-fast' }),
        buildBytePlusSeedancePayloadFn: (payload) => payload,
        getBytePlusModelArkClientFn: () => ({
          createSeedanceFastTask: async () => {
            throw new Error('provider down');
          },
        }),
        getBytePlusSeedanceAllowedResolutionsFn: () => ['720p'] as never,
        getBytePlusUserSafeErrorMessageFn: () => 'Provider is temporarily unavailable',
        scrubBytePlusErrorFn: () => 'raw provider error',
        queryFn: async (sql, params) => {
          queries.push({ sql, params });
        },
        rollbackPendingPaymentFn: async ({ refundDescription }) => {
          rollbacks.push({ refundDescription });
        },
        logMetricFn: (kind, options) => {
          logs.push({ kind, options });
        },
      },
    });

    assert.equal(result.ok, false);
    assert.match(queries[0]?.sql ?? '', /UPDATE app_jobs/);
    assert.deepEqual(queries[0]?.params, [
      'job_123',
      'The render queue is temporarily busy. Please retry in a few moments.',
      'byteplus_modelark',
      'refunded_wallet',
    ]);
    assert.deepEqual(rollbacks, [{ refundDescription: 'Refund Seedance 2.0 - 8s - Render queue was temporarily busy.' }]);
    assert.equal(logs[0]?.kind, 'failed');
    assert.deepEqual(result.body, {
      ok: false,
      error: 'BYTEPLUS_PROVIDER_ERROR',
      message: 'The render queue is temporarily busy. Please retry in a few moments.',
    });
    assert.equal(result.status, 503);
  } finally {
    console.warn = originalWarn;
  }
});

test('BytePlus I2V canonicalizes a direct image before validation and provider submission', async () => {
  const directImageUrl = 'https://cdn.maxvideoai.com/direct-start.png';
  const unselectedAttachmentUrl =
    'https://cdn.maxvideoai.com/unselected-attachment.png';
  const inputSchema = {
    optional: [
      { id: 'image_url', type: 'image', label: 'Start image', modes: ['i2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_url'],
      modes: ['i2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const attachments: NormalizedAttachment[] = [
    {
      name: 'attachment-image-url.png',
      type: 'image/png',
      size: 1200,
      kind: 'image',
      slotId: 'image_url',
      url: unselectedAttachmentUrl,
    },
    {
      name: 'attachment-input-image.png',
      type: 'image/png',
      size: 1200,
      kind: 'image',
      slotId: 'input_image',
      url: 'https://cdn.maxvideoai.com/unselected-input-image.png',
    },
    {
      name: 'attachment-image.png',
      type: 'image/png',
      size: 1200,
      kind: 'image',
      slotId: 'image',
      url: 'https://cdn.maxvideoai.com/unselected-image.png',
    },
  ];
  const references = deriveGenerationAttachmentReferences({
    attachments,
    engineId: 'seedance-2-0',
    mode: 'i2v',
    imageUrl: directImageUrl,
    inputSchema,
    isBytePlusV1a: true,
  });
  const validation = buildGenerateValidationPayload({
    engineId: 'seedance-2-0',
    mode: 'i2v',
    prompt: 'Animate the direct image',
    multiPrompt: null,
    supportsResolution: false,
    effectiveResolution: '720p',
    supportsAspectRatio: false,
    aspectRatio: '16:9',
    audioEnabled: true,
    isBytePlusV1a: true,
    supportsDuration: true,
    numFrames: null,
    validationDuration: 8,
    maxUploadedBytes: references.maxUploadedBytes,
    resolvedFirstFrameUrl: references.resolvedFirstFrameUrl,
    lastFrameUrl: references.lastFrameUrl,
    normalizedReferenceImages: references.normalizedReferenceImages,
    videoUrls: references.videoUrls,
    audioUrls: references.audioUrls,
    resolvedAudioUrl: references.resolvedAudioUrl,
    sourceInputVideoUrl: references.sourceInputVideoUrl,
    elements: null,
    endImageUrl: null,
    startImageUrl: references.startImageUrl,
    isLumaRay2: false,
    initialImageUrl: references.initialImageUrl,
    inputSchema,
    referenceValuesByField: references.referenceValuesByField,
    referenceMediaItems: references.referenceMediaItems,
    referenceProvenanceIssues: references.referenceProvenanceIssues,
  });
  assert.deepEqual(references.referenceValuesByField, {
    image_url: [directImageUrl],
  });
  assert.deepEqual(references.referenceMediaItems, [
    { fieldId: 'image_url', kind: 'image', url: directImageUrl },
  ]);
  assert.equal(validation.ok, true);

  let providerCalls = 0;
  let providerImageUrls: string[] = [];
  let rollbacks = 0;
  const result = await submitBytePlusGenerateTask({
    ...baseParams,
    mode: 'i2v',
    initialImageUrl: references.initialImageUrl,
    endImageUrl: null,
    normalizedReferenceImages: [],
    videoUrls: [],
    resolvedAudioUrl: null,
    audioUrls: [],
    inputSchema,
    referenceValuesByField: references.referenceValuesByField,
    pendingReceipt,
    deps: {
      getBytePlusArkConfigFn: () => ({
        seedanceModelId: 'model-public',
        seedanceFastModelId: 'model-fast',
      }),
      getBytePlusModelArkClientFn: () => ({
        createSeedanceFastTask: async (payload) => {
          providerCalls += 1;
          providerImageUrls = payload.content
            .filter((item) => item.type === 'image_url')
            .map((item) => item.image_url.url);
          return { providerJobId: 'provider_direct_start', status: 'queued' };
        },
      }),
      getBytePlusSeedanceAllowedResolutionsFn: () => ['720p'] as never,
      getBytePlusSeedanceDurationOptionsFn: () => [8] as never,
      queryFn: async () => undefined,
      rollbackPendingPaymentFn: async () => {
        rollbacks += 1;
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(providerCalls, 1);
  assert.deepEqual(providerImageUrls, [directImageUrl]);
  assert.equal(rollbacks, 0);
});

test(
  'BytePlus I2V canonicalizes one attachment-only primary before validation and submission',
  async (t) => {
    const firstUrl = 'https://cdn.maxvideoai.com/selected-start.png';
    const secondUrl = 'https://cdn.maxvideoai.com/unselected-start.png';
    const cases = [
      {
        name: 'distinct canonical attachments retain only the first scalar',
        activeFieldId: 'image_url',
        slots: [
          ['image_url', firstUrl],
          ['image_url', secondUrl],
        ],
        maxTotal: 2,
      },
      {
        name: 'duplicate canonical attachments count as one emitted scalar',
        activeFieldId: 'image_url',
        slots: [
          ['image_url', firstUrl],
          ['image_url', firstUrl],
        ],
        maxTotal: 1,
      },
      {
        name: 'active input_image remains exact provenance for the provider scalar',
        activeFieldId: 'input_image',
        slots: [
          ['input_image', firstUrl],
          ['input_image', secondUrl],
        ],
        maxTotal: 2,
      },
      {
        name: 'active image remains exact provenance for the provider scalar',
        activeFieldId: 'image',
        slots: [
          ['image', firstUrl],
          ['image', secondUrl],
        ],
        maxTotal: 2,
      },
      {
        name: 'no-budget submission keeps the first attachment scalar',
        activeFieldId: 'image_url',
        slots: [
          ['input_image', firstUrl],
          ['image_url', secondUrl],
        ],
        maxTotal: null,
      },
    ] as const;

    for (const [caseIndex, scenario] of cases.entries()) {
      await t.test(scenario.name, async () => {
        const attachments: NormalizedAttachment[] = scenario.slots.map(
          ([slotId, url], index) => ({
            name: `attachment-start-${index}.png`,
            type: 'image/png',
            size: 1200,
            kind: 'image',
            slotId,
            url,
          })
        );
        const inputSchema: EngineInputSchema = {
          optional: [
            {
              id: scenario.activeFieldId,
              type: 'image',
              label: 'Start image',
              modes: ['i2v'],
            },
          ],
          ...(scenario.maxTotal === null
            ? {}
            : {
                referenceBudget: {
                  fieldIds: [scenario.activeFieldId],
                  modes: ['i2v'],
                  maxTotal: scenario.maxTotal,
                  countUniqueUrls: false,
                },
              }),
        };
        const references = deriveGenerationAttachmentReferences({
          attachments,
          engineId: 'seedance-2-0',
          mode: 'i2v',
          inputSchema,
          isBytePlusV1a: true,
        });
        const validation = buildGenerateValidationPayload({
          engineId: 'seedance-2-0',
          mode: 'i2v',
          prompt: 'Animate the selected attachment',
          multiPrompt: null,
          supportsResolution: false,
          effectiveResolution: '720p',
          supportsAspectRatio: false,
          aspectRatio: '16:9',
          audioEnabled: true,
          isBytePlusV1a: true,
          supportsDuration: true,
          numFrames: null,
          validationDuration: 8,
          maxUploadedBytes: references.maxUploadedBytes,
          resolvedFirstFrameUrl: references.resolvedFirstFrameUrl,
          lastFrameUrl: references.lastFrameUrl,
          normalizedReferenceImages: references.normalizedReferenceImages,
          videoUrls: references.videoUrls,
          audioUrls: references.audioUrls,
          resolvedAudioUrl: references.resolvedAudioUrl,
          sourceInputVideoUrl: references.sourceInputVideoUrl,
          elements: null,
          endImageUrl: null,
          startImageUrl: references.startImageUrl,
          isLumaRay2: false,
          initialImageUrl: references.initialImageUrl,
          inputSchema,
          referenceValuesByField: references.referenceValuesByField,
          referenceMediaItems: references.referenceMediaItems,
          referenceProvenanceIssues: references.referenceProvenanceIssues,
        });

        assert.equal(references.initialImageUrl, firstUrl, scenario.name);
        assert.deepEqual(
          references.referenceValuesByField,
          { [scenario.slots[0][0]]: [firstUrl] },
          scenario.name
        );
        assert.deepEqual(
          references.referenceMediaItems,
          [
            {
              fieldId: scenario.slots[0][0],
              kind: 'image',
              url: firstUrl,
            },
          ],
          scenario.name
        );
        assert.equal(validation.ok, true, scenario.name);

        let providerCalls = 0;
        let providerImageUrls: string[] = [];
        let rollbacks = 0;
        const result = await submitBytePlusGenerateTask({
          ...baseParams,
          mode: 'i2v',
          initialImageUrl: references.initialImageUrl,
          endImageUrl: null,
          normalizedReferenceImages: [],
          videoUrls: [],
          resolvedAudioUrl: null,
          audioUrls: [],
          inputSchema,
          referenceValuesByField: references.referenceValuesByField,
          pendingReceipt,
          deps: {
            getBytePlusModelArkClientFn: () => ({
              createSeedanceFastTask: async (payload) => {
                providerCalls += 1;
                providerImageUrls = payload.content
                  .filter((item) => item.type === 'image_url')
                  .map((item) => item.image_url.url);
                return {
                  providerJobId: `provider_attachment_primary_${caseIndex}`,
                  status: 'queued',
                };
              },
            }),
            queryFn: async () => undefined,
            rollbackPendingPaymentFn: async () => {
              rollbacks += 1;
            },
          },
        });

        assert.equal(result.ok, true, scenario.name);
        assert.equal(providerCalls, 1, scenario.name);
        assert.deepEqual(providerImageUrls, [firstUrl], scenario.name);
        assert.equal(rollbacks, 0, scenario.name);
      });
    }
  }
);

test('BytePlus I2V rejects an inactive primary alias before submission', () => {
  const inputSchema = {
    optional: [
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        modes: ['i2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['image_url'],
      modes: ['i2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const attachments: NormalizedAttachment[] = [
    {
      name: 'inactive-input-image.png',
      type: 'image/png',
      size: 1200,
      kind: 'image',
      slotId: 'input_image',
      url: 'https://cdn.maxvideoai.com/inactive-input-image.png',
    },
  ];
  const references = deriveGenerationAttachmentReferences({
    attachments,
    engineId: 'seedance-2-0',
    mode: 'i2v',
    inputSchema,
    isBytePlusV1a: true,
  });
  const validation = buildGenerateValidationPayload({
    engineId: 'seedance-2-0',
    mode: 'i2v',
    prompt: 'Animate the selected attachment',
    multiPrompt: null,
    supportsResolution: false,
    effectiveResolution: '720p',
    supportsAspectRatio: false,
    aspectRatio: '16:9',
    audioEnabled: true,
    isBytePlusV1a: true,
    supportsDuration: true,
    numFrames: null,
    validationDuration: 8,
    maxUploadedBytes: references.maxUploadedBytes,
    resolvedFirstFrameUrl: references.resolvedFirstFrameUrl,
    lastFrameUrl: references.lastFrameUrl,
    normalizedReferenceImages: references.normalizedReferenceImages,
    videoUrls: references.videoUrls,
    audioUrls: references.audioUrls,
    resolvedAudioUrl: references.resolvedAudioUrl,
    sourceInputVideoUrl: references.sourceInputVideoUrl,
    elements: null,
    endImageUrl: null,
    startImageUrl: references.startImageUrl,
    isLumaRay2: false,
    initialImageUrl: references.initialImageUrl,
    inputSchema,
    referenceValuesByField: references.referenceValuesByField,
    referenceMediaItems: references.referenceMediaItems,
    referenceProvenanceIssues: references.referenceProvenanceIssues,
  });

  assert.equal(validation.ok, false);
  if (validation.ok) {
    assert.fail('inactive input_image must reject before BytePlus submission');
  }
  assert.equal(validation.body.field, 'input_image');
  assert.equal(validation.body.error, 'ENGINE_CONSTRAINT');
});

test('BytePlus I2V canonicalizes its direct end frame before validation and real submission', async () => {
  const directStartUrl = 'https://cdn.maxvideoai.com/direct-start.png';
  const directEndUrl = 'https://cdn.maxvideoai.com/direct-end.png';
  const distinctAttachmentEndUrl =
    'https://cdn.maxvideoai.com/unselected-end.png';
  const budgetedSchema = {
    optional: [
      { id: 'image_url', type: 'image', label: 'Start image', modes: ['i2v'] },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        modes: ['i2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['image_url', 'end_image_url'],
      modes: ['i2v'],
      maxTotal: 2,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const noBudgetSchema = {
    optional: budgetedSchema.optional,
  } satisfies EngineInputSchema;

  const cases = [
    {
      name: 'distinct direct and attachment end frames',
      inputSchema: budgetedSchema,
      directEndImageUrl: directEndUrl,
      attachmentEndImageUrl: distinctAttachmentEndUrl,
      expectedProviderImageUrls: [directStartUrl, directEndUrl],
      expectedReferenceMediaItems: [
        { fieldId: 'image_url', kind: 'image', url: directStartUrl },
        { fieldId: 'end_image_url', kind: 'image', url: directEndUrl },
      ],
    },
    {
      name: 'matching direct and attachment end frames',
      inputSchema: budgetedSchema,
      directEndImageUrl: directEndUrl,
      attachmentEndImageUrl: directEndUrl,
      expectedProviderImageUrls: [directStartUrl, directEndUrl],
      expectedReferenceMediaItems: [
        { fieldId: 'image_url', kind: 'image', url: directStartUrl },
        { fieldId: 'end_image_url', kind: 'image', url: directEndUrl },
      ],
    },
    {
      name: 'attachment-only end frame',
      inputSchema: budgetedSchema,
      directEndImageUrl: null,
      attachmentEndImageUrl: distinctAttachmentEndUrl,
      expectedProviderImageUrls: [directStartUrl],
      expectedReferenceMediaItems: [
        { fieldId: 'image_url', kind: 'image', url: directStartUrl },
      ],
    },
    {
      name: 'no-budget direct end frame',
      inputSchema: noBudgetSchema,
      directEndImageUrl: directEndUrl,
      attachmentEndImageUrl: distinctAttachmentEndUrl,
      expectedProviderImageUrls: [directStartUrl, directEndUrl],
      expectedReferenceMediaItems: [
        { fieldId: 'image_url', kind: 'image', url: directStartUrl },
        { fieldId: 'end_image_url', kind: 'image', url: directEndUrl },
      ],
    },
  ] as const;

  for (const scenario of cases) {
    const attachments: NormalizedAttachment[] = [
      {
        name: 'attachment-end.png',
        type: 'image/png',
        size: 1200,
        kind: 'image',
        slotId: 'end_image_url',
        url: scenario.attachmentEndImageUrl,
      },
    ];
    const references = deriveGenerationAttachmentReferences({
      attachments,
      engineId: 'seedance-2-0',
      mode: 'i2v',
      imageUrl: directStartUrl,
      endImageUrl: scenario.directEndImageUrl,
      inputSchema: scenario.inputSchema,
      isBytePlusV1a: true,
    });
    const validation = buildGenerateValidationPayload({
      engineId: 'seedance-2-0',
      mode: 'i2v',
      prompt: 'Animate between the selected frames',
      multiPrompt: null,
      supportsResolution: false,
      effectiveResolution: '720p',
      supportsAspectRatio: false,
      aspectRatio: '16:9',
      audioEnabled: true,
      isBytePlusV1a: true,
      supportsDuration: true,
      numFrames: null,
      validationDuration: 8,
      maxUploadedBytes: references.maxUploadedBytes,
      resolvedFirstFrameUrl: references.resolvedFirstFrameUrl,
      lastFrameUrl: references.lastFrameUrl,
      normalizedReferenceImages: references.normalizedReferenceImages,
      videoUrls: references.videoUrls,
      audioUrls: references.audioUrls,
      resolvedAudioUrl: references.resolvedAudioUrl,
      sourceInputVideoUrl: references.sourceInputVideoUrl,
      elements: null,
      endImageUrl: scenario.directEndImageUrl,
      startImageUrl: references.startImageUrl,
      isLumaRay2: false,
      initialImageUrl: references.initialImageUrl,
      inputSchema: scenario.inputSchema,
      referenceValuesByField: references.referenceValuesByField,
      referenceMediaItems: references.referenceMediaItems,
      referenceProvenanceIssues: references.referenceProvenanceIssues,
    });
    assert.equal(validation.ok, true, scenario.name);
    assert.deepEqual(
      references.referenceMediaItems,
      scenario.expectedReferenceMediaItems,
      scenario.name
    );

    let providerCalls = 0;
    let providerImageUrls: string[] = [];
    let rollbacks = 0;
    const result = await submitBytePlusGenerateTask({
      ...baseParams,
      mode: 'i2v',
      initialImageUrl: references.initialImageUrl,
      endImageUrl: scenario.directEndImageUrl,
      normalizedReferenceImages: [],
      videoUrls: [],
      resolvedAudioUrl: null,
      audioUrls: [],
      inputSchema: scenario.inputSchema,
      referenceValuesByField: references.referenceValuesByField,
      pendingReceipt,
      deps: {
        getBytePlusArkConfigFn: () => ({
          seedanceModelId: 'model-public',
          seedanceFastModelId: 'model-fast',
        }),
        getBytePlusModelArkClientFn: () => ({
          createSeedanceFastTask: async (payload) => {
            providerCalls += 1;
            providerImageUrls = payload.content
              .filter((item) => item.type === 'image_url')
              .map((item) => item.image_url.url);
            return {
              providerJobId: `provider_${scenario.name.replaceAll(' ', '_')}`,
              status: 'queued',
            };
          },
        }),
        getBytePlusSeedanceAllowedResolutionsFn: () => ['720p'] as never,
        getBytePlusSeedanceDurationOptionsFn: () => [8] as never,
        queryFn: async () => undefined,
        rollbackPendingPaymentFn: async () => {
          rollbacks += 1;
        },
      },
    });

    assert.equal(result.ok, true, scenario.name);
    assert.equal(providerCalls, 1, scenario.name);
    assert.deepEqual(
      providerImageUrls,
      scenario.expectedProviderImageUrls,
      scenario.name
    );
    assert.equal(rollbacks, 0, scenario.name);
  }
});

test('BytePlus submission budget overflow stops before provider access and rolls back', async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  let clientRequests = 0;
  let rollbacks = 0;
  try {
    const result = await submitBytePlusGenerateTask({
      ...baseParams,
      inputSchema: {
        optional: [
          { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
          { id: 'video_urls', type: 'video', label: 'Videos', modes: ['ref2v'] },
        ],
        referenceBudget: {
          fieldIds: ['image_urls', 'video_urls'],
          modes: ['ref2v'],
          maxTotal: 2,
          countUniqueUrls: true,
        },
      },
      referenceValuesByField: {
        image_urls: ['a', 'b'],
        video_urls: ['c'],
      },
      pendingReceipt,
      deps: {
        getBytePlusArkConfigFn: () =>
          ({
            seedanceModelId: 'standard-id',
            seedanceFastModelId: 'fast-id',
            seedanceMiniModelId: 'mini-id',
          }) as never,
        getBytePlusModelArkClientFn: () => ({
          createSeedanceFastTask: async () => {
            clientRequests += 1;
            return { providerJobId: 'must_not_exist', status: 'queued' };
          },
        }),
        getBytePlusSeedanceAllowedResolutionsFn: () => ['720p'] as never,
        getBytePlusUserSafeErrorMessageFn: () => 'Reference limit exceeded',
        scrubBytePlusErrorFn: () => 'reference budget exceeded',
        queryFn: async () => undefined,
        rollbackPendingPaymentFn: async () => {
          rollbacks += 1;
        },
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.body.error, 'BYTEPLUS_REFERENCE_BUDGET_EXCEEDED');
    assert.equal(clientRequests, 0);
    assert.equal(rollbacks, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('unknown BytePlus Seedance engine fails before provider submission and rolls back', async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  let configReads = 0;
  let payloadBuilds = 0;
  let clientRequests = 0;
  let rollbacks = 0;

  try {
    const result = await submitBytePlusGenerateTask({
      ...baseParams,
      engineId: 'seedance-9-9',
      engineLabel: 'Seedance 9.9',
      pendingReceipt,
      deps: {
        getBytePlusArkConfigFn: () => {
          configReads += 1;
          return ({
            seedanceModelId: 'standard-id',
            seedanceFastModelId: 'fast-id',
            seedanceMiniModelId: 'mini-id',
          }) as never;
        },
        buildBytePlusSeedancePayloadFn: (payload) => {
          payloadBuilds += 1;
          return payload;
        },
        getBytePlusModelArkClientFn: () => ({
          createSeedanceFastTask: async () => {
            clientRequests += 1;
            return { providerJobId: 'must_not_exist', status: 'queued' };
          },
        }),
        scrubBytePlusErrorFn: () => 'unsupported profile',
        queryFn: async () => undefined,
        rollbackPendingPaymentFn: async () => {
          rollbacks += 1;
        },
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'BYTEPLUS_ENGINE_PROFILE_MISSING');
    assert.equal(
      result.body.message,
      'This engine is not configured for BytePlus.'
    );
    assert.equal(configReads, 0);
    assert.equal(payloadBuilds, 0);
    assert.equal(clientRequests, 0);
    assert.equal(rollbacks, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('disabled Seedance 2.5 fails before config, payload, provider, and charge', { concurrency: false }, async () => {
  const originalWarn = console.warn;
  const originalEnabled = ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED;
  const originalProvider = ENV.SEEDANCE_2_5_PROVIDER;
  console.warn = () => undefined;
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false';
  ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
  let configReads = 0;
  let payloadBuilds = 0;
  let clientRequests = 0;
  let rollbacks = 0;

  try {
    const result = await submitBytePlusGenerateTask({
      ...baseParams,
      engineId: 'seedance-2-5',
      engineLabel: 'Seedance 2.5',
      pendingReceipt,
      deps: {
        getBytePlusArkConfigFn: () => {
          configReads += 1;
          return {
            seedanceModelId: 'standard-id',
            seedanceFastModelId: 'fast-id',
            seedanceMiniModelId: 'mini-id',
            seedance25ModelId: 'seedance-25-id',
          } as never;
        },
        buildBytePlusSeedancePayloadFn: (payload) => {
          payloadBuilds += 1;
          return payload;
        },
        getBytePlusModelArkClientFn: () => ({
          createSeedanceFastTask: async () => {
            clientRequests += 1;
            return { providerJobId: 'must_not_exist', status: 'queued' };
          },
        }),
        scrubBytePlusErrorFn: () => 'disabled',
        queryFn: async () => undefined,
        rollbackPendingPaymentFn: async () => {
          rollbacks += 1;
        },
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 404);
    assert.equal(result.body.error, 'BYTEPLUS_ENGINE_DISABLED');
    assert.equal(configReads, 0);
    assert.equal(payloadBuilds, 0);
    assert.equal(clientRequests, 0);
    assert.equal(rollbacks, 1);
  } finally {
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = originalEnabled;
    ENV.SEEDANCE_2_5_PROVIDER = originalProvider;
    console.warn = originalWarn;
  }
});

test('Seedance 2.5 forwards each optional generated-audio selection to ModelArk', { concurrency: false }, async () => {
  const original = {
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    seedance25Enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    seedance25Provider: ENV.SEEDANCE_2_5_PROVIDER,
    warn: console.warn,
  };
  const capturedGenerateAudioValues: boolean[] = [];
  let providerRequests = 0;
  let rollbacks = 0;

  ENV.BYTEPLUS_ARK_ENABLED = 'true';
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
  ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
  console.warn = () => undefined;

  try {
    for (const audioEnabled of [true, false]) {
      const result = await submitBytePlusGenerateTask({
        ...baseParams,
        engineId: 'seedance-2-5',
        engineLabel: 'Seedance 2.5',
        durationSec: 15,
        mode: 't2v',
        normalizedReferenceImages: [],
        videoUrls: [],
        resolvedAudioUrl: null,
        audioUrls: [],
        audioEnabled,
        effectiveResolution: '720p',
        pendingReceipt,
        deps: {
          getBytePlusArkConfigFn: () =>
            ({
              seedanceModelId: 'standard-id',
              seedanceFastModelId: 'fast-id',
              seedanceMiniModelId: 'mini-id',
              seedance25ModelId: 'seedance-25-id',
            }) as never,
          buildBytePlusSeedancePayloadFn: (payload) => {
            assert.notEqual(payload.generateAudio, undefined);
            capturedGenerateAudioValues.push(payload.generateAudio);
            return payload;
          },
          getBytePlusModelArkClientFn: () => ({
            createSeedanceFastTask: async () => {
              providerRequests += 1;
              return { providerJobId: 'audio-contract-job', status: 'queued' };
            },
          }),
          getBytePlusSeedanceAllowedResolutionsFn: () => ['480p', '720p'] as never,
          getBytePlusSeedanceDurationOptionsFn: () => [15] as never,
          queryFn: async () => undefined,
          rollbackPendingPaymentFn: async () => {
            rollbacks += 1;
          },
        },
      });
      assert.equal(result.ok, true);
    }

    assert.deepEqual(capturedGenerateAudioValues, [true, false]);
    assert.equal(providerRequests, 2);
    assert.equal(rollbacks, 0);
  } finally {
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.seedance25Enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.seedance25Provider;
    console.warn = original.warn;
  }
});

test('Seedance 2.5 submits every advertised aspect ratio to ModelArk', { concurrency: false }, async () => {
  const original = {
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    seedance25Enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    seedance25Provider: ENV.SEEDANCE_2_5_PROVIDER,
  };
  const advertisedAspectRatios = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;
  const capturedRatios: string[] = [];

  ENV.BYTEPLUS_ARK_ENABLED = 'true';
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
  ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';

  try {
    for (const aspectRatio of advertisedAspectRatios) {
      const result = await submitBytePlusGenerateTask({
        ...baseParams,
        engineId: 'seedance-2-5',
        engineLabel: 'Seedance 2.5',
        durationSec: 8,
        mode: 't2v',
        normalizedReferenceImages: [],
        videoUrls: [],
        resolvedAudioUrl: null,
        audioUrls: [],
        aspectRatio,
        pendingReceipt,
        deps: {
          getBytePlusArkConfigFn: () =>
            ({ seedance25ModelId: 'seedance-25-id' }) as never,
          getBytePlusModelArkClientFn: () => ({
            createSeedanceFastTask: async (payload) => {
              capturedRatios.push(payload.ratio);
              return {
                providerJobId: `provider_seedance_25_${aspectRatio.replace(':', '_')}`,
                status: 'queued',
              };
            },
          }),
          queryFn: async () => undefined,
          rollbackPendingPaymentFn: async () => undefined,
        },
      });

      assert.equal(result.ok, true, aspectRatio);
    }

    assert.deepEqual(capturedRatios, advertisedAspectRatios);
  } finally {
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.seedance25Enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.seedance25Provider;
  }
});

test('Seedance 2.5 submits the exact provider content for every public mode', { concurrency: false }, async () => {
  const inputSchema = getFalEngineById('seedance-2-5')?.engine.inputSchema;
  assert.ok(inputSchema);
  const original = {
    seedance25Enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    seedance25Provider: ENV.SEEDANCE_2_5_PROVIDER,
  };
  const imageUrl = 'https://cdn.maxvideoai.com/seedance-25-image.png';
  const videoUrl = 'https://cdn.maxvideoai.com/seedance-25-video.mp4';
  const audioUrl = 'https://cdn.maxvideoai.com/seedance-25-audio.wav';
  const cases = [
    {
      mode: 't2v' as const,
      initialImageUrl: null,
      normalizedReferenceImages: [],
      videoUrls: [],
      resolvedAudioUrl: null,
      audioUrls: [],
      referenceValuesByField: {},
      expectedTypes: ['text'],
    },
    {
      mode: 'i2v' as const,
      initialImageUrl: imageUrl,
      normalizedReferenceImages: [],
      videoUrls: [],
      resolvedAudioUrl: null,
      audioUrls: [],
      referenceValuesByField: { image_url: [imageUrl] },
      expectedTypes: ['text', 'image_url'],
    },
    {
      mode: 'ref2v' as const,
      initialImageUrl: null,
      normalizedReferenceImages: [imageUrl],
      videoUrls: [videoUrl],
      resolvedAudioUrl: audioUrl,
      audioUrls: [audioUrl],
      referenceValuesByField: {
        image_urls: [imageUrl],
        video_urls: [videoUrl],
        audio_urls: [audioUrl],
      },
      expectedTypes: ['text', 'image_url', 'video_url', 'audio_url'],
    },
    {
      mode: 'v2v' as const,
      initialImageUrl: null,
      normalizedReferenceImages: [imageUrl],
      videoUrls: [videoUrl],
      resolvedAudioUrl: audioUrl,
      audioUrls: [audioUrl],
      referenceValuesByField: {
        image_urls: [imageUrl],
        video_url: [videoUrl],
        audio_urls: [audioUrl],
      },
      expectedTypes: ['text', 'image_url', 'video_url', 'audio_url'],
    },
    {
      mode: 'extend' as const,
      initialImageUrl: null,
      normalizedReferenceImages: [],
      videoUrls: [videoUrl],
      resolvedAudioUrl: audioUrl,
      audioUrls: [audioUrl],
      referenceValuesByField: { extension_source_videos: [videoUrl] },
      expectedTypes: ['text', 'video_url'],
    },
  ];
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
  ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';

  try {
    for (const scenario of cases) {
      let contentTypes: string[] = [];
      const result = await submitBytePlusGenerateTask({
        ...baseParams,
        engineId: 'seedance-2-5',
        engineLabel: 'Seedance 2.5',
        durationSec: 8,
        mode: scenario.mode,
        initialImageUrl: scenario.initialImageUrl,
        endImageUrl: null,
        normalizedReferenceImages: scenario.normalizedReferenceImages,
        videoUrls: scenario.videoUrls,
        resolvedAudioUrl: scenario.resolvedAudioUrl,
        audioUrls: scenario.audioUrls,
        inputSchema,
        referenceValuesByField: scenario.referenceValuesByField,
        deps: {
          getBytePlusArkConfigFn: () =>
            ({ seedance25ModelId: 'seedance-25-id' }) as never,
          getBytePlusModelArkClientFn: () => ({
            createSeedanceFastTask: async (payload) => {
              contentTypes = payload.content.map((item) => item.type);
              return {
                providerJobId: `provider_seedance_25_${scenario.mode}`,
                status: 'queued',
              };
            },
          }),
          queryFn: async () => undefined,
        },
      });

      assert.equal(result.ok, true, scenario.mode);
      assert.deepEqual(contentTypes, scenario.expectedTypes, scenario.mode);
    }
  } finally {
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.seedance25Enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.seedance25Provider;
  }
});
