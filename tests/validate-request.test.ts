import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { deriveGenerationAttachmentReferences } from '../frontend/app/api/generate/_lib/attachment-references.ts';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/attachments.ts';
import {
  buildFalInputs,
  buildFalRequestParts,
} from '../frontend/app/api/generate/_lib/fal-request.ts';
import { buildGenerateValidationPayload } from '../frontend/app/api/generate/_lib/validation-payload.ts';
import { validateModeMediaInputs } from '../frontend/app/api/generate/_lib/validate-media-inputs.ts';
import { validateRequest } from '../frontend/app/api/generate/_lib/validate.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import {
  buildReferenceMediaItems,
  resolveEngineReferenceBudget,
} from '../frontend/lib/reference-budget.ts';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body.ts';
import {
  buildSoraFalInput,
  type SoraRequest,
} from '../frontend/src/lib/sora.ts';
import type { MaxVideoProviderElement } from '../frontend/src/lib/video-provider-elements.ts';
import { buildBytePlusSeedancePayload } from '../frontend/src/server/video-providers/byteplus-modelark.ts';
import { resolveKlingDirectSubmissionMediaInputs } from '../frontend/app/api/generate/_lib/kling-direct-submission.ts';
import { buildKlingDirectPayload } from '../frontend/src/server/video-providers/kling-direct/payload.ts';
import { resolveGoogleVertexOmniSupport } from '../frontend/src/server/video-providers/google-vertex-omni/model-map.ts';
import { buildGoogleVertexOmniPayload } from '../frontend/src/server/video-providers/google-vertex-omni/payload.ts';
import type { EngineInputSchema, Mode } from '../frontend/types/engines.ts';

const root = process.cwd();
const validatePath = join(root, 'frontend/app/api/generate/_lib/validate.ts');
const mediaInputsPath = join(root, 'frontend/app/api/generate/_lib/validate-media-inputs.ts');
const typesPath = join(root, 'frontend/app/api/generate/_lib/validate-types.ts');
const OK = { ok: true } as const;
const budgetedRef2vSchema = {
  optional: [
    {
      id: 'image_urls',
      type: 'image',
      label: 'References',
      modes: ['ref2v'],
    },
    {
      id: 'audio_urls',
      type: 'audio',
      label: 'Reference audio',
      modes: ['v2v'],
    },
  ],
  referenceBudget: {
    fieldIds: ['image_urls'],
    modes: ['ref2v'],
    maxTotal: 1,
    countUniqueUrls: true,
  },
} satisfies EngineInputSchema;
const typedReferenceV2vFields = [
  {
    id: 'reference_image_urls',
    type: 'image',
    label: 'References',
    modes: ['v2v'],
  },
  {
    id: 'audio_urls',
    type: 'audio',
    label: 'Reference audio',
    modes: ['v2v'],
  },
  {
    id: 'video_url',
    type: 'video',
    label: 'Source video',
    modes: ['v2v'],
  },
] satisfies NonNullable<EngineInputSchema['optional']>;
const typedReferenceBudgetV2vSchema = {
  optional: typedReferenceV2vFields,
  referenceBudget: {
    fieldIds: ['reference_image_urls', 'audio_urls'],
    modes: ['v2v'],
    maxTotal: 1,
    countUniqueUrls: true,
  },
} satisfies EngineInputSchema;
const falReferenceFields = [
  {
    id: 'image_urls',
    type: 'image',
    label: 'References',
    modes: ['ref2v'],
  },
  {
    id: 'video_urls',
    type: 'video',
    label: 'Reference video',
    modes: ['ref2v'],
  },
  {
    id: 'audio_urls',
    type: 'audio',
    label: 'Reference audio',
    modes: ['ref2v'],
  },
] satisfies NonNullable<EngineInputSchema['optional']>;
const budgetedFalReferenceSchema = {
  optional: falReferenceFields,
  referenceBudget: {
    fieldIds: ['image_urls', 'video_urls', 'audio_urls'],
    modes: ['ref2v'],
    maxTotal: 1,
    countUniqueUrls: true,
  },
} satisfies EngineInputSchema;
const kindlessFalReferenceSchema = {
  optional: falReferenceFields,
  referenceBudget: {
    fieldIds: ['image_urls', 'video_urls', 'audio_urls'],
    modes: ['ref2v'],
    maxTotal: 2,
    countUniqueUrls: true,
  },
} satisfies EngineInputSchema;
const unbudgetedFalReferenceSchema = {
  optional: falReferenceFields,
} satisfies EngineInputSchema;

function attachment(
  kind: 'image' | 'video' | 'audio',
  slotId: string,
  url: string
): NormalizedAttachment {
  return {
    name: `${kind}-asset`,
    type: `${kind}/test`,
    size: 1,
    kind,
    slotId,
    url,
  };
}

function incompleteAttachment(
  overrides: Partial<NormalizedAttachment> & { url: string }
): NormalizedAttachment {
  return {
    name: 'incomplete-asset',
    type: 'application/octet-stream',
    size: 1,
    ...overrides,
  };
}

function deriveFalReferences(
  extraAttachments: NormalizedAttachment[],
  inputSchema: EngineInputSchema
) {
  const attachments = [
    attachment('image', 'image_urls', 'valid-image'),
    ...extraAttachments,
  ];
  return {
    attachments,
    references: deriveGenerationAttachmentReferences({
      engineId: 'seedance-2-0',
      mode: 'ref2v',
      inputSchema,
      referenceImages: [],
      rawAudioUrl: null,
      attachments,
    }),
  };
}

function buildFalReferenceValidation(
  references: ReturnType<typeof deriveGenerationAttachmentReferences>,
  inputSchema: EngineInputSchema
) {
  return buildGenerateValidationPayload({
    engineId: 'seedance-2-0',
    mode: 'ref2v',
    prompt: 'Keep the same subject and motion',
    multiPrompt: null,
    supportsResolution: false,
    effectiveResolution: '720p',
    supportsAspectRatio: false,
    aspectRatio: null,
    audioEnabled: undefined,
    isBytePlusV1a: false,
    supportsDuration: true,
    numFrames: null,
    validationDuration: 4,
    maxUploadedBytes: references.maxUploadedBytes,
    resolvedFirstFrameUrl: null,
    lastFrameUrl: null,
    normalizedReferenceImages: references.normalizedReferenceImages,
    videoUrls: references.videoUrls,
    audioUrls: references.audioUrls,
    resolvedAudioUrl: references.resolvedAudioUrl,
    sourceInputVideoUrl: null,
    elements: null,
    endImageUrl: null,
    startImageUrl: null,
    isLumaRay2: false,
    initialImageUrl: null,
    inputSchema,
    referenceValuesByField: references.referenceValuesByField,
    referenceMediaItems: references.referenceMediaItems,
    referenceProvenanceIssues: references.referenceProvenanceIssues,
  });
}

function buildFalReferenceRequest(
  attachments: NormalizedAttachment[],
  references: ReturnType<typeof deriveGenerationAttachmentReferences>
) {
  return buildFalGenerationRequest(
    {
      engineId: 'seedance-2-0',
      prompt: 'Keep the same subject and motion',
      mode: 'ref2v',
      durationSec: 4,
      inputs: buildFalInputs(attachments),
      referenceImages: references.normalizedReferenceImages,
    },
    'fal-ai/bytedance/seedance/v2/reference-to-video'
  );
}

type FalMediaPipelineParams = {
  engineId: string;
  defaultModel: string;
  mode: Mode;
  inputSchema: EngineInputSchema;
  attachments?: NormalizedAttachment[];
  referenceImages?: string[];
  imageUrl?: string;
  image_url?: string;
  rawAudioUrl?: string | null;
  endImageUrl?: string | null;
  soraRequest?: SoraRequest | null;
  elements?: MaxVideoProviderElement[] | null;
  isBytePlusV1a?: boolean;
  validationDuration?: number | string;
  captureValidationContext?: boolean;
};

function buildFalMediaPipeline(params: FalMediaPipelineParams) {
  const attachments = params.attachments ?? [];
  const derivationParams = {
    attachments,
    engineId: params.engineId,
    mode: params.mode,
    inputSchema: params.inputSchema,
    soraImageUrl:
      params.soraRequest?.mode === 'i2v'
        ? params.soraRequest.image_url
        : undefined,
    imageUrl: params.imageUrl,
    image_url: params.image_url,
    referenceImages: params.referenceImages ?? [],
    rawAudioUrl: params.rawAudioUrl ?? null,
    endImageUrl: params.endImageUrl ?? null,
    isBytePlusV1a: params.isBytePlusV1a ?? false,
  };
  const references =
    deriveGenerationAttachmentReferences(derivationParams);
  let capturedValidationContext: unknown;
  const validation = buildGenerateValidationPayload({
    engineId: params.engineId,
    mode: params.mode,
    prompt: 'Keep the same subject and motion',
    multiPrompt: null,
    supportsResolution: false,
    effectiveResolution: '720p',
    supportsAspectRatio: false,
    aspectRatio: null,
    audioEnabled: undefined,
    isBytePlusV1a: params.isBytePlusV1a ?? false,
    supportsDuration: true,
    numFrames: null,
    validationDuration: params.validationDuration ?? 4,
    maxUploadedBytes: references.maxUploadedBytes,
    resolvedFirstFrameUrl: references.resolvedFirstFrameUrl,
    lastFrameUrl: references.lastFrameUrl,
    normalizedReferenceImages: references.normalizedReferenceImages,
    videoUrls: references.videoUrls,
    audioUrls: references.audioUrls,
    resolvedAudioUrl: references.resolvedAudioUrl,
    sourceInputVideoUrl: references.sourceInputVideoUrl,
    elements: params.elements ?? null,
    endImageUrl: params.endImageUrl ?? null,
    startImageUrl: references.startImageUrl,
    isLumaRay2: false,
    initialImageUrl: references.initialImageUrl,
    inputSchema: params.inputSchema,
    referenceValuesByField: references.referenceValuesByField,
    referenceMediaItems: references.referenceMediaItems,
    referenceProvenanceIssues: references.referenceProvenanceIssues,
    deps: params.captureValidationContext
      ? {
          validateRequestFn: (engineId, mode, payload, context) => {
            capturedValidationContext = context;
            return validateRequest(engineId, mode, payload, context);
          },
        }
      : undefined,
  });
  const falParts = buildFalRequestParts({
    attachments,
    engineId: params.engineId,
    prompt: 'Keep the same subject and motion',
    mode: params.mode,
    apiKey: undefined,
    jobId: 'job-provider-media-contract',
    localKey: null,
    needsImage: params.mode === 'i2v' || params.mode === 'i2i',
    needsFirstLastFrames: params.mode === 'fl2v',
    initialImageUrl: references.initialImageUrl,
    resolvedFirstFrameUrl: references.resolvedFirstFrameUrl,
    lastFrameUrl: references.lastFrameUrl,
    resolvedAudioUrl: references.resolvedAudioUrl,
    normalizedReferenceImages: references.normalizedReferenceImages,
    videoUrls: references.videoUrls,
    audioUrls: references.audioUrls,
    soraRequest: params.soraRequest ?? null,
    isLumaRay2: false,
    loop: false,
    multiPrompt: null,
    shotType: null,
    seed: null,
    cameraFixed: null,
    safetyChecker: null,
    voiceIds: [],
    elements: params.elements ?? null,
    endImageUrl: params.endImageUrl ?? null,
    extraInputValues: {},
    supportsDuration: true,
    durationSec: 4,
    durationOption: 4,
    numFrames: null,
    supportsAspectRatio: false,
    aspectRatio: null,
    supportsResolution: false,
    resolution: '720p',
    audioEnabled: undefined,
    supportsFps: false,
    fps: undefined,
    cfgScale: undefined,
  });
  const falRequest = buildFalGenerationRequest(
    falParts.falPayload,
    params.defaultModel
  );

  return {
    attachments,
    references,
    validation,
    falPayload: falParts.falPayload,
    falRequest,
    capturedValidationContext,
  };
}

test('Gemini Omni workspace first/last attachments survive the real Fal request path', async () => {
  const entry = listFalEngines().find((candidate) => candidate.id === 'gemini-omni-flash');
  assert.ok(entry?.engine.inputSchema);
  const firstUrl = 'https://media.maxvideoai.com/omni-first.png';
  const lastUrl = 'https://media.maxvideoai.com/omni-last.png';
  const scenario = buildFalMediaPipeline({
    engineId: entry.id,
    defaultModel: entry.defaultFalModelId,
    mode: 'fl2v',
    inputSchema: entry.engine.inputSchema,
    attachments: [
      attachment('image', 'image_url', firstUrl),
      attachment('image', 'end_image_url', lastUrl),
    ],
  });

  assert.equal(scenario.validation.ok, true, JSON.stringify(scenario.validation));
  assert.equal(scenario.references.resolvedFirstFrameUrl, firstUrl);
  assert.equal(scenario.references.lastFrameUrl, lastUrl);
  assert.equal(scenario.falPayload.imageUrl, firstUrl);
  assert.equal(scenario.falPayload.endImageUrl, lastUrl);
  const support = resolveGoogleVertexOmniSupport({
    engineId: entry.id,
    mode: 'fl2v',
    aspectRatio: '16:9',
    falPayload: scenario.falPayload,
  });
  assert.equal(support.supported, true);

  const payload = await buildGoogleVertexOmniPayload({
    engineId: entry.id,
    mode: 'fl2v',
    prompt: scenario.falPayload.prompt,
    aspectRatio: '16:9',
    durationSec: 4,
    resolution: '720p',
    outputGcsUri: 'gs://maxvideoai-vertex/omni-outputs/workspace-fl2v/',
    falPayload: scenario.falPayload,
  });
  assert.deepEqual(payload.input.filter((item) => item.type === 'image'), [
    { type: 'image', uri: firstUrl, mime_type: 'image/png' },
    { type: 'image', uri: lastUrl, mime_type: 'image/png' },
  ]);
});

function deriveAndValidateBudgetedRef2v(
  extraAttachment: NormalizedAttachment
) {
  const references = deriveGenerationAttachmentReferences({
    engineId: 'contract-test-engine',
    mode: 'ref2v',
    inputSchema: budgetedRef2vSchema,
    referenceImages: [],
    rawAudioUrl: null,
    attachments: [
      attachment('image', 'image_urls', 'valid-image'),
      extraAttachment,
    ],
  });
  return {
    references,
    validation: validateModeMediaInputs({
      engineId: 'contract-test-engine',
      normalizedMode: 'ref2v',
      inputSchema: budgetedRef2vSchema,
      referenceValuesByField: references.referenceValuesByField,
      referenceMediaItems: references.referenceMediaItems,
      payload: {
        image_urls: references.normalizedReferenceImages,
        video_urls: references.videoUrls,
        audio_urls: references.audioUrls,
      },
    }),
  };
}

test('generate request validation delegates media mode rules', () => {
  assert.equal(existsSync(mediaInputsPath), true);
  assert.equal(existsSync(typesPath), true);

  const validateSource = readFileSync(validatePath, 'utf8');
  const mediaInputsSource = readFileSync(mediaInputsPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');

  assert.match(validateSource, /from '\.\/validate-media-inputs'/);
  assert.match(validateSource, /validateModeMediaInputs/);
  assert.doesNotMatch(validateSource, /function validateKlingElements/);
  assert.doesNotMatch(validateSource, /const ENGINE_REF2V_LIMITS/);
  assert.match(mediaInputsSource, /function validateKlingElements/);
  assert.match(mediaInputsSource, /const ENGINE_REF2V_LIMITS/);
  assert.match(typesSource, /export type ValidationResult/);

  const lineCount = validateSource.split('\n').length;
  assert.ok(lineCount <= 300, `validate.ts should stay below 300 lines after media-rule extraction, got ${lineCount}`);
});

test('server aggregate validation uses original slot ids instead of projected keys', () => {
  const result = validateModeMediaInputs({
    engineId: 'contract-test-engine',
    normalizedMode: 'v2v',
    inputSchema: {
      optional: [
        { id: 'reference_image_urls', type: 'image', label: 'Images', modes: ['v2v'] },
        { id: 'video_url', type: 'video', label: 'Source', modes: ['v2v'] },
        { id: 'audio_urls', type: 'audio', label: 'Audio', modes: ['v2v'] },
      ],
      referenceBudget: {
        fieldIds: ['reference_image_urls', 'audio_urls'],
        modes: ['v2v'],
        maxTotal: 2,
        countUniqueUrls: true,
      },
    },
    referenceValuesByField: {
      reference_image_urls: ['a', 'b'],
      audio_urls: ['c'],
      video_url: ['source'],
    },
    payload: {
      reference_image_urls: ['a', 'b'],
      audio_url: 'c',
      video_url: 'source',
    },
  });
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: 'ENGINE_CONSTRAINT',
      field: 'referenceBudget',
      message: 'Up to 2 total references are supported for this engine mode',
      allowed: [0, 2],
      value: 3,
    },
  });
});

test('server aggregate validation rejects provider video projected from an unknown attachment slot', () => {
  const { references, validation } = deriveAndValidateBudgetedRef2v(
    attachment('video', 'forged_video_slot', 'forged-video')
  );

  assert.deepEqual(references.videoUrls, ['forged-video']);
  assert.deepEqual(validation, {
    ok: false,
    error: {
      code: 'ENGINE_CONSTRAINT',
      field: 'forged_video_slot',
      message:
        'Media input "forged_video_slot" is not supported for this engine mode',
    },
  });
});

test('server aggregate validation rejects provider audio projected from a mode-inactive attachment slot', () => {
  const { references, validation } = deriveAndValidateBudgetedRef2v(
    attachment('audio', 'audio_urls', 'inactive-audio')
  );

  assert.deepEqual(references.audioUrls, ['inactive-audio']);
  assert.deepEqual(validation, {
    ok: false,
    error: {
      code: 'ENGINE_CONSTRAINT',
      field: 'audio_urls',
      message: 'Media input "audio_urls" is not supported for this engine mode',
    },
  });
});

test('budgeted route validation counts singular direct audio that Fal would submit', () => {
  const inputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
      { id: 'audio_url', type: 'audio', label: 'Audio', modes: ['ref2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls', 'audio_url'],
      modes: ['ref2v'],
      maxTotal: 1,
      countUniqueUrls: true,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/reference-to-video',
    mode: 'ref2v',
    inputSchema,
    attachments: [
      attachment('image', 'image_urls', 'valid-image'),
    ],
    rawAudioUrl: 'direct-audio',
  });

  assert.deepEqual(scenario.falRequest.requestBody.image_urls, [
    'valid-image',
  ]);
  assert.equal(scenario.falRequest.requestBody.audio_url, 'direct-audio');
  assert.deepEqual(scenario.references.referenceValuesByField, {
    image_urls: ['valid-image'],
    audio_url: ['direct-audio'],
  });
  assert.deepEqual(scenario.references.referenceMediaItems, [
    { fieldId: 'image_urls', kind: 'image', url: 'valid-image' },
    { fieldId: 'audio_url', kind: 'audio', url: 'direct-audio' },
  ]);
  assert.equal(scenario.validation.ok, false);
  if (scenario.validation.ok) {
    assert.fail('budgeted validation accepted singular direct audio selected by Fal');
  }
  assert.equal(scenario.validation.status, 400);
  assert.deepEqual(scenario.validation.body, {
    ok: false,
    error: 'ENGINE_CONSTRAINT',
    message: 'Up to 1 total references are supported for this engine mode',
    field: 'referenceBudget',
    allowed: [0, 1],
    value: 2,
  });
});

test('budgeted route validation rejects a direct audio alias that is inactive for the mode', () => {
  const inputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
      { id: 'audio_urls', type: 'audio', label: 'Audio', modes: ['v2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls'],
      modes: ['ref2v'],
      maxTotal: 1,
      countUniqueUrls: true,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/reference-to-video',
    mode: 'ref2v',
    inputSchema,
    attachments: [
      attachment('image', 'image_urls', 'valid-image'),
    ],
    rawAudioUrl: 'direct-audio',
  });

  assert.equal(scenario.falRequest.requestBody.audio_url, 'direct-audio');
  assert.equal(scenario.validation.ok, false);
  if (scenario.validation.ok) {
    assert.fail('budgeted validation dropped a mode-inactive direct audio alias');
  }
  assert.deepEqual(scenario.validation.body, {
    ok: false,
    error: 'ENGINE_CONSTRAINT',
    message:
      'Media input "audio_urls" is not supported for this engine mode',
    field: 'audio_urls',
    allowed: undefined,
    value: undefined,
  });
});

test('budgeted route validation counts direct start and end images that Fal would submit', () => {
  const inputSchema = {
    optional: [
      { id: 'image_url', type: 'image', label: 'Start image', modes: ['i2v'] },
      { id: 'end_image_url', type: 'image', label: 'End image', modes: ['i2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_url', 'end_image_url'],
      modes: ['i2v'],
      maxTotal: 1,
      countUniqueUrls: true,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/image-to-video',
    mode: 'i2v',
    inputSchema,
    imageUrl: 'direct-start',
    endImageUrl: 'direct-end',
  });

  assert.equal(scenario.falRequest.requestBody.image_url, 'direct-start');
  assert.equal(scenario.falRequest.requestBody.end_image_url, 'direct-end');
  assert.equal(scenario.validation.ok, false);
  if (scenario.validation.ok) {
    assert.fail('budgeted validation accepted direct start and end images selected by Fal');
  }
  assert.deepEqual(scenario.validation.body, {
    ok: false,
    error: 'ENGINE_CONSTRAINT',
    message: 'Up to 1 total references are supported for this engine mode',
    field: 'referenceBudget',
    allowed: [0, 1],
    value: 2,
  });
});

test('direct image and frame surfaces retain exact typed provenance through real Fal projection', () => {
  const i2vSchema = {
    optional: [
      { id: 'image_url', type: 'image', label: 'Image', modes: ['i2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_url'],
      modes: ['i2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const directImage = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/image-to-video',
    mode: 'i2v',
    inputSchema: i2vSchema,
    image_url: 'direct-image',
  });
  assert.equal(directImage.validation.ok, true);
  assert.equal(directImage.falRequest.requestBody.image_url, 'direct-image');
  assert.deepEqual(directImage.references.referenceMediaItems, [
    { fieldId: 'image_url', kind: 'image', url: 'direct-image' },
  ]);

  const firstLastSchema = {
    optional: [
      {
        id: 'first_frame_url',
        type: 'image',
        label: 'First frame',
        modes: ['fl2v'],
      },
      {
        id: 'last_frame_url',
        type: 'image',
        label: 'Last frame',
        modes: ['fl2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['first_frame_url'],
      modes: ['fl2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const firstLastFrames = buildFalMediaPipeline({
    engineId: 'veo-3-1-fast',
    defaultModel: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
    mode: 'fl2v',
    inputSchema: firstLastSchema,
    imageUrl: 'direct-first-frame',
    attachments: [
      attachment('image', 'last_frame_url', 'attachment-last-frame'),
    ],
  });
  assert.equal(firstLastFrames.validation.ok, true);
  assert.equal(
    firstLastFrames.falRequest.requestBody.first_frame_url,
    'direct-first-frame'
  );
  assert.equal(
    firstLastFrames.falRequest.requestBody.last_frame_url,
    'attachment-last-frame'
  );
  assert.deepEqual(firstLastFrames.references.referenceMediaItems, [
    {
      fieldId: 'last_frame_url',
      kind: 'image',
      url: 'attachment-last-frame',
    },
    {
      fieldId: 'first_frame_url',
      kind: 'image',
      url: 'direct-first-frame',
    },
  ]);

  const startFrameSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
      {
        id: 'start_image_url',
        type: 'image',
        label: 'Start frame',
        modes: ['ref2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['start_image_url'],
      modes: ['ref2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const startFrame = buildFalMediaPipeline({
    engineId: 'kling-o3-standard',
    defaultModel: 'fal-ai/kling-video/o3/standard/reference-to-video',
    mode: 'ref2v',
    inputSchema: startFrameSchema,
    attachments: [
      attachment('image', 'image_urls', 'valid-image'),
      attachment('image', 'start_image_url', 'attachment-start-frame'),
    ],
  });
  assert.equal(startFrame.validation.ok, true);
  assert.equal(
    startFrame.falRequest.requestBody.start_image_url,
    'attachment-start-frame'
  );
  assert.deepEqual(
    startFrame.references.referenceValuesByField['start_image_url'],
    ['attachment-start-frame']
  );
});

test('direct media remain provider-compatible when no reference budget resolves', () => {
  const directAudio = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/reference-to-video',
    mode: 'ref2v',
    inputSchema: {
      optional: [
        { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
        { id: 'audio_url', type: 'audio', label: 'Audio', modes: ['ref2v'] },
      ],
    },
    attachments: [
      attachment('image', 'image_urls', 'valid-image'),
    ],
    rawAudioUrl: 'direct-audio',
  });
  assert.equal(directAudio.validation.ok, true);
  assert.equal(directAudio.falRequest.requestBody.audio_url, 'direct-audio');

  const directEndImage = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/image-to-video',
    mode: 'i2v',
    inputSchema: {
      optional: [
        { id: 'image_url', type: 'image', label: 'Image', modes: ['i2v'] },
        {
          id: 'end_image_url',
          type: 'image',
          label: 'End image',
          modes: ['i2v'],
        },
      ],
    },
    imageUrl: 'direct-start',
    endImageUrl: 'direct-end',
  });
  assert.equal(directEndImage.validation.ok, true);
  assert.equal(
    directEndImage.falRequest.requestBody.end_image_url,
    'direct-end'
  );
});

test('direct scalar projections do not double-count matching attachment values', () => {
  const inputSchema = {
    optional: [
      { id: 'image_url', type: 'image', label: 'Image', modes: ['i2v'] },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        modes: ['i2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['end_image_url'],
      modes: ['i2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/image-to-video',
    mode: 'i2v',
    inputSchema,
    imageUrl: 'direct-start',
    endImageUrl: 'same-end',
    attachments: [
      attachment('image', 'end_image_url', 'same-end'),
    ],
  });

  assert.equal(scenario.validation.ok, true);
  assert.deepEqual(
    scenario.references.referenceValuesByField['end_image_url'],
    ['same-end']
  );
  assert.equal(scenario.falRequest.requestBody.end_image_url, 'same-end');
});

test('direct audio remains distinct from a matching non-overwriting audio array attachment', () => {
  const inputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
      { id: 'audio_url', type: 'audio', label: 'Audio', modes: ['ref2v'] },
      {
        id: 'audio_urls',
        type: 'audio',
        label: 'Reference audio',
        modes: ['ref2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['audio_url', 'audio_urls'],
      modes: ['ref2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/reference-to-video',
    mode: 'ref2v',
    inputSchema,
    attachments: [
      attachment('image', 'image_urls', 'valid-image'),
      attachment('audio', 'audio_urls', 'same-audio'),
    ],
    rawAudioUrl: 'same-audio',
  });

  assert.equal(scenario.falRequest.requestBody.audio_url, 'same-audio');
  assert.deepEqual(scenario.falRequest.requestBody.audio_urls, ['same-audio']);
  assert.deepEqual(scenario.references.referenceValuesByField['audio_url'], [
    'same-audio',
  ]);
  assert.deepEqual(scenario.references.referenceValuesByField['audio_urls'], [
    'same-audio',
  ]);
  assert.equal(scenario.validation.ok, false);
  if (scenario.validation.ok) {
    assert.fail('budgeted validation merged distinct Fal audio fields');
  }
  assert.equal(scenario.validation.body.field, 'referenceBudget');
  assert.equal(scenario.validation.body.value, 2);
});

test('an exact audio_url attachment replaces direct audio without double counting', () => {
  const inputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
      { id: 'audio_url', type: 'audio', label: 'Audio', modes: ['ref2v'] },
    ],
    referenceBudget: {
      fieldIds: ['audio_url'],
      modes: ['ref2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/reference-to-video',
    mode: 'ref2v',
    inputSchema,
    attachments: [
      attachment('image', 'image_urls', 'valid-image'),
      attachment('audio', 'audio_url', 'attachment-audio'),
    ],
    rawAudioUrl: 'direct-audio',
  });

  assert.equal(
    scenario.falRequest.requestBody.audio_url,
    'attachment-audio'
  );
  assert.equal(scenario.validation.ok, true);
  assert.deepEqual(scenario.references.referenceValuesByField['audio_url'], [
    'attachment-audio',
  ]);
  assert.deepEqual(
    scenario.references.referenceMediaItems.filter(
      (item) => item.fieldId === 'audio_url'
    ),
    [
      {
        fieldId: 'audio_url',
        kind: 'audio',
        url: 'attachment-audio',
      },
    ]
  );
});

test('direct image remains distinct from a non-overwriting input_image attachment', () => {
  const inputSchema = {
    optional: [
      { id: 'image_url', type: 'image', label: 'Image', modes: ['i2v'] },
      {
        id: 'input_image',
        type: 'image',
        label: 'Input image',
        modes: ['i2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['image_url', 'input_image'],
      modes: ['i2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/image-to-video',
    mode: 'i2v',
    inputSchema,
    imageUrl: 'direct-image',
    attachments: [
      attachment('image', 'input_image', 'attachment-image'),
    ],
  });

  assert.equal(scenario.falRequest.requestBody.image_url, 'direct-image');
  assert.equal(
    scenario.falRequest.requestBody.input_image,
    'attachment-image'
  );
  assert.deepEqual(scenario.references.referenceValuesByField['image_url'], [
    'direct-image',
  ]);
  assert.deepEqual(
    scenario.references.referenceValuesByField['input_image'],
    ['attachment-image']
  );
  assert.equal(scenario.validation.ok, false);
  if (scenario.validation.ok) {
    assert.fail('budgeted validation merged distinct Fal image fields');
  }
  assert.equal(scenario.validation.body.field, 'referenceBudget');
  assert.equal(scenario.validation.body.value, 2);
});

test('Sora I2V budgets the two distinct images that survive its real alias serialization', () => {
  const inputSchema = {
    optional: [
      {
        id: 'image_url',
        type: 'image',
        label: 'Image input',
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
  const soraRequest = {
    variant: 'sora2',
    mode: 'i2v',
    prompt: 'Keep the same subject and motion',
    duration: 4,
    resolution: '720p',
    aspect_ratio: '16:9',
    image_url: 'https://example.com/direct-sora.png',
  } satisfies SoraRequest;

  const seededSoraInput = buildSoraFalInput(soraRequest);
  assert.equal(
    seededSoraInput.input.image_url,
    'https://example.com/direct-sora.png'
  );
  assert.equal(
    seededSoraInput.input.input_image,
    'https://example.com/direct-sora.png'
  );

  const scenario = buildFalMediaPipeline({
    engineId: 'sora-2',
    defaultModel: 'fal-ai/sora-2/image-to-video',
    mode: 'i2v',
    inputSchema,
    soraRequest,
    attachments: [
      attachment(
        'image',
        'image_url',
        'https://example.com/attachment-sora.png'
      ),
    ],
  });

  assert.equal(
    scenario.falRequest.requestBody.image_url,
    'https://example.com/attachment-sora.png'
  );
  assert.equal(
    scenario.falRequest.requestBody.input_image,
    'https://example.com/direct-sora.png'
  );
  assert.deepEqual(scenario.references.referenceValuesByField, {
    image_url: [
      'https://example.com/attachment-sora.png',
      'https://example.com/direct-sora.png',
    ],
  });
  assert.deepEqual(scenario.references.referenceMediaItems, [
    {
      fieldId: 'image_url',
      kind: 'image',
      url: 'https://example.com/attachment-sora.png',
    },
    {
      fieldId: 'image_url',
      kind: 'image',
      url: 'https://example.com/direct-sora.png',
    },
  ]);
  assert.equal(scenario.validation.ok, false);
  if (scenario.validation.ok) {
    assert.fail('Sora accepted two distinct provider-selected images under a max-one budget');
  }
  assert.equal(scenario.validation.body.field, 'referenceBudget');
  assert.equal(scenario.validation.body.value, 2);
});

test('Sora workspace same-image compatibility aliases consume one non-unique budget unit', () => {
  const imageUrl = 'https://example.com/workspace-primary.png';
  const inputSchema = {
    optional: [
      {
        id: 'image_url',
        type: 'image',
        label: 'Image input',
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
  const soraRequest = {
    variant: 'sora2',
    mode: 'i2v',
    prompt: 'Animate the uploaded workspace image',
    duration: 4,
    resolution: '720p',
    aspect_ratio: '16:9',
    image_url: imageUrl,
  } satisfies SoraRequest;

  const scenario = buildFalMediaPipeline({
    engineId: 'sora-2',
    defaultModel: 'fal-ai/sora-2/image-to-video',
    mode: 'i2v',
    inputSchema,
    soraRequest,
    attachments: [attachment('image', 'image_url', imageUrl)],
  });

  assert.deepEqual(scenario.references.referenceValuesByField, {
    image_url: [imageUrl],
  });
  assert.deepEqual(scenario.references.referenceMediaItems, [
    { fieldId: 'image_url', kind: 'image', url: imageUrl },
  ]);
  assert.equal(scenario.validation.ok, true);
  assert.equal(scenario.falRequest.requestBody.image_url, imageUrl);
  assert.equal(scenario.falRequest.requestBody.input_image, imageUrl);
});

test('Sora direct-only aliases are one logical medium and no-budget alias behavior is unchanged', () => {
  const soraRequest = {
    variant: 'sora2',
    mode: 'i2v',
    prompt: 'Keep the same subject and motion',
    duration: 4,
    resolution: '720p',
    aspect_ratio: '16:9',
    image_url: 'https://example.com/direct-sora.png',
  } satisfies SoraRequest;
  const budgetedSchema = {
    optional: [
      {
        id: 'image_url',
        type: 'image',
        label: 'Image input',
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

  const directOnly = buildFalMediaPipeline({
    engineId: 'sora-2',
    defaultModel: 'fal-ai/sora-2/image-to-video',
    mode: 'i2v',
    inputSchema: budgetedSchema,
    soraRequest,
  });
  assert.equal(directOnly.validation.ok, true);
  assert.deepEqual(directOnly.references.referenceValuesByField, {
    image_url: ['https://example.com/direct-sora.png'],
  });
  assert.equal(
    directOnly.falRequest.requestBody.image_url,
    'https://example.com/direct-sora.png'
  );
  assert.equal(
    directOnly.falRequest.requestBody.input_image,
    'https://example.com/direct-sora.png'
  );

  const noBudget = buildFalMediaPipeline({
    engineId: 'sora-2',
    defaultModel: 'fal-ai/sora-2/image-to-video',
    mode: 'i2v',
    inputSchema: {
      optional: budgetedSchema.optional,
    },
    soraRequest,
    attachments: [
      attachment(
        'image',
        'image_url',
        'https://example.com/attachment-sora.png'
      ),
    ],
  });
  assert.equal(noBudget.validation.ok, true);
  assert.equal(
    noBudget.falRequest.requestBody.image_url,
    'https://example.com/attachment-sora.png'
  );
  assert.equal(
    noBudget.falRequest.requestBody.input_image,
    'https://example.com/direct-sora.png'
  );
});

test('an attachment-only input_image remains one logical medium when Fal repeats its URL', () => {
  const inputSchema = {
    optional: [
      { id: 'image_url', type: 'image', label: 'Image', modes: ['i2v'] },
      {
        id: 'input_image',
        type: 'image',
        label: 'Input image',
        modes: ['i2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['image_url', 'input_image'],
      modes: ['i2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/image-to-video',
    mode: 'i2v',
    inputSchema,
    attachments: [
      attachment(
        'image',
        'input_image',
        'https://example.com/attachment-only.png'
      ),
    ],
  });

  assert.equal(scenario.validation.ok, true);
  assert.equal(
    scenario.falRequest.requestBody.image_url,
    'https://example.com/attachment-only.png'
  );
  assert.equal(
    scenario.falRequest.requestBody.input_image,
    'https://example.com/attachment-only.png'
  );
  assert.deepEqual(scenario.references.referenceValuesByField, {
    input_image: ['https://example.com/attachment-only.png'],
  });
  assert.deepEqual(scenario.references.referenceMediaItems, [
    {
      fieldId: 'input_image',
      kind: 'image',
      url: 'https://example.com/attachment-only.png',
    },
  ]);
});

test('Kling O3 does not budget a direct ref2v start image that its real Fal path drops', () => {
  const inputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'References', modes: ['ref2v'] },
      {
        id: 'start_image_url',
        type: 'image',
        label: 'Start image',
        modes: ['ref2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['image_urls', 'start_image_url'],
      modes: ['ref2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'kling-o3-pro',
    defaultModel: 'fal-ai/kling-video/o3/pro/reference-to-video',
    mode: 'ref2v',
    inputSchema,
    imageUrl: 'https://example.com/dropped-direct-start.png',
    attachments: [
      attachment(
        'image',
        'image_urls',
        'https://example.com/selected-reference.png'
      ),
    ],
  });

  assert.equal(scenario.references.startImageUrl, undefined);
  assert.deepEqual(scenario.references.referenceValuesByField, {
    image_urls: ['https://example.com/selected-reference.png'],
  });
  assert.equal(scenario.validation.ok, true);
  assert.equal(scenario.falRequest.requestBody.image_url, undefined);
  assert.equal(scenario.falRequest.requestBody.start_image_url, undefined);
  assert.deepEqual(scenario.falRequest.requestBody.image_urls, [
    'https://example.com/selected-reference.png',
  ]);
});

test('Kling O3 rejects an end frame when only a dropped direct start fallback exists', () => {
  const inputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'References', modes: ['ref2v'] },
      {
        id: 'start_image_url',
        type: 'image',
        label: 'Start image',
        modes: ['ref2v'],
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        modes: ['ref2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['image_urls', 'start_image_url', 'end_image_url'],
      modes: ['ref2v'],
      maxTotal: 3,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'kling-o3-pro',
    defaultModel: 'fal-ai/kling-video/o3/pro/reference-to-video',
    mode: 'ref2v',
    inputSchema,
    imageUrl: 'https://example.com/dropped-direct-start.png',
    endImageUrl: 'https://example.com/end.png',
    attachments: [
      attachment(
        'image',
        'image_urls',
        'https://example.com/selected-reference.png'
      ),
    ],
  });

  assert.equal(scenario.validation.ok, false);
  if (scenario.validation.ok) {
    assert.fail('Kling O3 accepted an end frame without a provider-selected start frame');
  }
  assert.deepEqual(scenario.validation.body, {
    ok: false,
    error: 'End frame requires a start frame for Kling 3.0 Omni reference-to-video.',
  });
  assert.equal(scenario.falRequest.requestBody.start_image_url, undefined);
  assert.equal(
    scenario.falRequest.requestBody.end_image_url,
    'https://example.com/end.png'
  );
});

test('Kling O3 unified image_url attachment supplies the validated Fal and direct opening frame', () => {
  const startImageUrl = 'https://example.com/unified-start.png';
  const endImageUrl = 'https://example.com/unified-end.png';
  const referenceImageUrl = 'https://example.com/reference.png';
  const inputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'References', modes: ['ref2v'] },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        modes: ['ref2v'],
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        modes: ['ref2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['image_urls', 'image_url', 'end_image_url'],
      modes: ['ref2v'],
      maxTotal: 3,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'kling-o3-pro',
    defaultModel: 'fal-ai/kling-video/o3/pro/reference-to-video',
    mode: 'ref2v',
    inputSchema,
    endImageUrl,
    attachments: [
      attachment('image', 'image_url', startImageUrl),
      attachment('image', 'image_urls', referenceImageUrl),
      attachment('image', 'end_image_url', endImageUrl),
    ],
  });

  assert.equal(scenario.references.startImageUrl, startImageUrl);
  assert.equal(scenario.validation.ok, true);
  assert.equal(scenario.falRequest.requestBody.start_image_url, startImageUrl);
  assert.equal(scenario.falRequest.requestBody.end_image_url, endImageUrl);

  const directMedia = resolveKlingDirectSubmissionMediaInputs({
    imageUrl: scenario.references.initialImageUrl,
    falPayload: scenario.falPayload,
  });
  const directPayload = buildKlingDirectPayload({
    engineId: 'kling-o3-pro',
    jobId: 'job-kling-unified-opening',
    mode: 'ref2v',
    prompt: 'Use @Image1 as style guidance and animate between the frames',
    durationSec: 5,
    startImageUrl: directMedia.startImageUrl,
    endImageUrl,
    referenceImageUrls: directMedia.referenceImageUrls,
  });
  assert.deepEqual(directPayload.body.image_list, [
    { image_url: referenceImageUrl },
    { image_url: startImageUrl, type: 'first_frame' },
    { image_url: endImageUrl, type: 'end_frame' },
  ]);
});

test('Kling O3 explicit opening alias wins in both attachment orders and every provider payload', () => {
  const unifiedStartUrl = 'https://example.com/unified-start.png';
  const explicitStartUrl = 'https://example.com/explicit-start.png';
  const referenceImageUrl = 'https://example.com/reference.png';
  const endImageUrl = 'https://example.com/end.png';
  const inputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'References', modes: ['ref2v'] },
      {
        id: 'image_url',
        type: 'image',
        label: 'Unified start image',
        modes: ['ref2v'],
      },
      {
        id: 'start_image_url',
        type: 'image',
        label: 'Explicit start image',
        modes: ['ref2v'],
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        modes: ['ref2v'],
      },
    ],
    referenceBudget: {
      fieldIds: [
        'image_urls',
        'image_url',
        'start_image_url',
        'end_image_url',
      ],
      modes: ['ref2v'],
      maxTotal: 3,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const openingOrders = [
    [
      attachment('image', 'image_url', unifiedStartUrl),
      attachment('image', 'start_image_url', explicitStartUrl),
    ],
    [
      attachment('image', 'start_image_url', explicitStartUrl),
      attachment('image', 'image_url', unifiedStartUrl),
    ],
  ];

  for (const openingAttachments of openingOrders) {
    const scenario = buildFalMediaPipeline({
      engineId: 'kling-o3-pro',
      defaultModel: 'fal-ai/kling-video/o3/pro/reference-to-video',
      mode: 'ref2v',
      inputSchema,
      endImageUrl,
      attachments: [
        ...openingAttachments,
        attachment('image', 'image_urls', referenceImageUrl),
        attachment('image', 'end_image_url', endImageUrl),
      ],
    });

    assert.equal(scenario.references.startImageUrl, explicitStartUrl);
    assert.deepEqual(scenario.references.referenceValuesByField, {
      start_image_url: [explicitStartUrl],
      image_urls: [referenceImageUrl],
      end_image_url: [endImageUrl],
    });
    assert.deepEqual(scenario.references.referenceMediaItems, [
      {
        fieldId: 'start_image_url',
        kind: 'image',
        url: explicitStartUrl,
      },
      { fieldId: 'image_urls', kind: 'image', url: referenceImageUrl },
      { fieldId: 'end_image_url', kind: 'image', url: endImageUrl },
    ]);
    assert.equal(scenario.validation.ok, true);
    assert.equal(
      scenario.falRequest.requestBody.start_image_url,
      explicitStartUrl
    );
    assert.equal(scenario.falRequest.requestBody.end_image_url, endImageUrl);

    const directMedia = resolveKlingDirectSubmissionMediaInputs({
      imageUrl: scenario.references.initialImageUrl,
      falPayload: scenario.falPayload,
    });
    assert.equal(directMedia.startImageUrl, explicitStartUrl);
    const directPayload = buildKlingDirectPayload({
      engineId: 'kling-o3-pro',
      jobId: 'job-kling-explicit-opening-priority',
      mode: 'ref2v',
      prompt: 'Use @Image1 as style guidance and animate between the frames',
      durationSec: 5,
      startImageUrl: directMedia.startImageUrl,
      endImageUrl,
      referenceImageUrls: directMedia.referenceImageUrls,
    });
    assert.deepEqual(directPayload.body.image_list, [
      { image_url: referenceImageUrl },
      { image_url: explicitStartUrl, type: 'first_frame' },
      { image_url: endImageUrl, type: 'end_frame' },
    ]);
  }
});

test('Kling O3 uses the final explicit opening attachment selected by Fal', () => {
  const firstUnifiedUrl = 'https://example.com/unified-first.png';
  const secondUnifiedUrl = 'https://example.com/unified-second.png';
  const firstExplicitUrl = 'https://example.com/explicit-first.png';
  const finalExplicitUrl = 'https://example.com/explicit-final.png';
  const referenceImageUrl = 'https://example.com/reference.png';
  const inputSchema = {
    optional: [
      {
        id: 'image_urls',
        type: 'image',
        label: 'References',
        modes: ['ref2v'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Unified start image',
        modes: ['ref2v'],
      },
      {
        id: 'start_image_url',
        type: 'image',
        label: 'Explicit start image',
        modes: ['ref2v'],
      },
    ],
    referenceBudget: {
      fieldIds: ['image_urls', 'image_url', 'start_image_url'],
      modes: ['ref2v'],
      maxTotal: 2,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'kling-o3-standard',
    defaultModel: 'fal-ai/kling-video/o3/standard/reference-to-video',
    mode: 'ref2v',
    inputSchema,
    attachments: [
      attachment('image', 'image_url', firstUnifiedUrl),
      attachment('image', 'start_image_url', firstExplicitUrl),
      attachment('image', 'image_url', secondUnifiedUrl),
      attachment('image', 'start_image_url', finalExplicitUrl),
      attachment('image', 'image_urls', referenceImageUrl),
    ],
  });

  assert.equal(scenario.references.startImageUrl, finalExplicitUrl);
  assert.deepEqual(scenario.references.referenceValuesByField, {
    start_image_url: [finalExplicitUrl],
    image_urls: [referenceImageUrl],
  });
  assert.deepEqual(scenario.references.referenceMediaItems, [
    {
      fieldId: 'start_image_url',
      kind: 'image',
      url: finalExplicitUrl,
    },
    {
      fieldId: 'image_urls',
      kind: 'image',
      url: referenceImageUrl,
    },
  ]);
  assert.equal(scenario.validation.ok, true);
  assert.equal(
    scenario.falRequest.requestBody.start_image_url,
    finalExplicitUrl
  );
  assert.equal(
    resolveKlingDirectSubmissionMediaInputs({
      imageUrl: scenario.references.initialImageUrl,
      falPayload: scenario.falPayload,
    }).startImageUrl,
    finalExplicitUrl
  );
});

test('BytePlus I2V accepts budgeted direct start and end images selected by its real payload', () => {
  const inputSchema = {
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
  const scenario = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/image-to-video',
    mode: 'i2v',
    inputSchema,
    imageUrl: 'https://example.com/start.png',
    endImageUrl: 'https://example.com/end.png',
    isBytePlusV1a: true,
  });
  assert.equal(scenario.validation.ok, true);

  const referenceBudget = resolveEngineReferenceBudget(inputSchema, 'i2v');
  if (!referenceBudget) {
    assert.fail('test schema must resolve its I2V reference budget');
  }
  const providerMediaItems = buildReferenceMediaItems(
    inputSchema,
    'i2v',
    scenario.references.referenceValuesByField
  );
  assert.deepEqual(
    providerMediaItems,
    scenario.references.referenceMediaItems
  );
  const providerPayload = buildBytePlusSeedancePayload({
    modelId: 'current-model-id',
    prompt: 'Animate between the supplied frames',
    durationSec: 5,
    mode: 'i2v',
    imageUrl: scenario.references.initialImageUrl,
    endImageUrl: 'https://example.com/end.png',
    resolution: '720p',
    ratio: '16:9',
    allowedResolutions: ['720p'],
    allowedDurationOptions: [5],
    referenceBudget,
    referenceMediaItems: providerMediaItems,
  });

  assert.deepEqual(
    providerPayload.content
      .filter((item) => item.type === 'image_url')
      .map((item) => item.image_url.url),
    ['https://example.com/start.png', 'https://example.com/end.png']
  );
});

test('BytePlus budget defense rejects every emitted I2V scalar without typed provenance', () => {
  const buildPrimary = (
    referenceMediaItems: Parameters<
      typeof buildBytePlusSeedancePayload
    >[0]['referenceMediaItems']
  ) =>
    buildBytePlusSeedancePayload({
      modelId: 'current-model-id',
      prompt: 'Animate the supplied opening frame',
      durationSec: 5,
      mode: 'i2v',
      imageUrl: 'https://example.com/start.png',
      resolution: '720p',
      ratio: '16:9',
      allowedResolutions: ['720p'],
      allowedDurationOptions: [5],
      referenceBudget: {
        fieldIds: ['image_url', 'input_image', 'image'],
        maxTotal: 2,
        countUniqueUrls: false,
      },
      referenceMediaItems,
    });
  const invalidPrimaryProvenance = [
    [],
    [
      {
        fieldId: 'end_image_url',
        kind: 'image',
        url: 'https://example.com/start.png',
      },
    ],
    [
      {
        fieldId: 'image_url',
        kind: 'video',
        url: 'https://example.com/start.png',
      },
    ],
    [
      {
        fieldId: 'image_url',
        kind: 'image',
        url: 'https://example.com/other.png',
      },
    ],
    [
      {
        fieldId: 'image_url',
        kind: 'image',
        url: 'https://example.com/start.png',
      },
      {
        fieldId: 'input_image',
        kind: 'image',
        url: 'https://example.com/start.png',
      },
    ],
  ] satisfies Array<
    NonNullable<
      Parameters<typeof buildBytePlusSeedancePayload>[0]['referenceMediaItems']
    >
  >;
  for (const referenceMediaItems of invalidPrimaryProvenance) {
    assert.throws(
      () => buildPrimary(referenceMediaItems),
      (error: unknown) =>
        error instanceof Error &&
        (error as Error & { code?: string }).code ===
          'BYTEPLUS_REFERENCE_BUDGET_INPUT_MISMATCH'
    );
  }

  const build = (
    referenceMediaItems: Parameters<
      typeof buildBytePlusSeedancePayload
    >[0]['referenceMediaItems']
  ) =>
    buildBytePlusSeedancePayload({
      modelId: 'current-model-id',
      prompt: 'Animate between the supplied frames',
      durationSec: 5,
      mode: 'i2v',
      imageUrl: 'https://example.com/start.png',
      endImageUrl: 'https://example.com/end.png',
      resolution: '720p',
      ratio: '16:9',
      allowedResolutions: ['720p'],
      allowedDurationOptions: [5],
      referenceBudget: {
        fieldIds: ['end_image_url'],
        maxTotal: 1,
        countUniqueUrls: false,
      },
      referenceMediaItems,
    });

  assert.throws(
    () => build([]),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code ===
        'BYTEPLUS_REFERENCE_BUDGET_INPUT_MISMATCH'
  );
  assert.throws(
    () =>
      build([
        {
          fieldId: 'image_url',
          kind: 'image',
          url: 'https://example.com/start.png',
        },
      ]),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code ===
        'BYTEPLUS_REFERENCE_BUDGET_INPUT_MISMATCH'
  );
  assert.throws(
    () =>
      buildBytePlusSeedancePayload({
        modelId: 'current-model-id',
        prompt: 'Hold on the same supplied frame',
        durationSec: 5,
        mode: 'i2v',
        imageUrl: 'https://example.com/same-frame.png',
        endImageUrl: 'https://example.com/same-frame.png',
        resolution: '720p',
        ratio: '16:9',
        allowedResolutions: ['720p'],
        allowedDurationOptions: [5],
        referenceBudget: {
          fieldIds: ['image_url', 'end_image_url'],
          maxTotal: 2,
          countUniqueUrls: false,
        },
        referenceMediaItems: [
          {
            fieldId: 'image_url',
            kind: 'image',
            url: 'https://example.com/same-frame.png',
          },
        ],
      }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code ===
        'BYTEPLUS_REFERENCE_BUDGET_INPUT_MISMATCH'
  );
});

test('active budgets reject non-Kling elements while Kling and no-budget Fal behavior stay intact', () => {
  const budgetedSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'References', modes: ['ref2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls'],
      modes: ['ref2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const elements = [
    {
      frontalImageUrl: 'https://example.com/front.png',
      referenceImageUrls: [
        'https://example.com/ref-1.png',
        'https://example.com/ref-2.png',
        'https://example.com/ref-3.png',
      ],
    },
  ] satisfies MaxVideoProviderElement[];
  const attachments = [
    attachment(
      'image',
      'image_urls',
      'https://example.com/base-reference.png'
    ),
  ];

  const unsupported = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/reference-to-video',
    mode: 'ref2v',
    inputSchema: budgetedSchema,
    attachments,
    elements,
  });
  assert.deepEqual(unsupported.falRequest.requestBody.image_urls, [
    'https://example.com/base-reference.png',
  ]);
  assert.deepEqual(unsupported.falRequest.requestBody.elements, [
    {
      frontal_image_url: 'https://example.com/front.png',
      reference_image_urls: [
        'https://example.com/ref-1.png',
        'https://example.com/ref-2.png',
        'https://example.com/ref-3.png',
      ],
      video_url: undefined,
    },
  ]);
  assert.equal(unsupported.validation.ok, false);
  if (unsupported.validation.ok) {
    assert.fail('a non-Kling budget accepted nested provider-selected element media');
  }
  assert.deepEqual(unsupported.validation.body, {
    ok: false,
    error: 'ENGINE_CONSTRAINT',
    message:
      'Elements are not supported for this engine mode when a reference budget is active.',
    field: 'elements',
    allowed: undefined,
    value: undefined,
  });

  const kling = buildFalMediaPipeline({
    engineId: 'kling-o3-pro',
    defaultModel: 'fal-ai/kling-video/o3/pro/reference-to-video',
    mode: 'ref2v',
    inputSchema: budgetedSchema,
    attachments,
    elements,
  });
  assert.equal(kling.validation.ok, true);
  assert.deepEqual(kling.references.referenceValuesByField, {
    image_urls: ['https://example.com/base-reference.png'],
  });
  assert.deepEqual(kling.falRequest.requestBody.elements, [
    {
      frontal_image_url: 'https://example.com/front.png',
      reference_image_urls: [
        'https://example.com/ref-1.png',
        'https://example.com/ref-2.png',
        'https://example.com/ref-3.png',
      ],
      video_url: undefined,
    },
  ]);

  const noBudget = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/reference-to-video',
    mode: 'ref2v',
    inputSchema: {
      optional: budgetedSchema.optional,
    },
    attachments,
    elements,
  });
  assert.equal(noBudget.validation.ok, true);
  assert.deepEqual(
    noBudget.falRequest.requestBody.elements,
    unsupported.falRequest.requestBody.elements
  );
});

test('inherited-key slots reach deterministic unknown-field rejection without mutation', () => {
  const inputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls'],
      modes: ['ref2v'],
      maxTotal: 1,
      countUniqueUrls: true,
    },
  } satisfies EngineInputSchema;

  for (const fieldId of ['__proto__', 'constructor'] as const) {
    const scenario = buildFalMediaPipeline({
      engineId: 'seedance-2-0',
      defaultModel: 'fal-ai/bytedance/seedance/v2/reference-to-video',
      mode: 'ref2v',
      inputSchema,
      attachments: [
        attachment('image', 'image_urls', 'valid-image'),
        attachment('audio', fieldId, `${fieldId}-audio`),
      ],
      captureValidationContext: true,
    });

    assert.equal(
      scenario.falRequest.requestBody.audio_url,
      `${fieldId}-audio`
    );
    assert.equal(
      Object.hasOwn(scenario.references.referenceValuesByField, fieldId),
      true
    );
    assert.equal(scenario.validation.ok, false);
    if (scenario.validation.ok) {
      assert.fail(`budgeted validation accepted inherited-key slot ${fieldId}`);
    }
    assert.equal(scenario.validation.body.field, fieldId);
    assert.equal(
      scenario.validation.body.message,
      `Media input "${fieldId}" is not supported for this engine mode`
    );
    const context = scenario.capturedValidationContext as {
      referenceValuesByField?: unknown;
      referenceMediaItems?: unknown;
      referenceProvenanceIssues?: unknown;
    };
    assert.strictEqual(
      context.referenceValuesByField,
      scenario.references.referenceValuesByField
    );
    assert.strictEqual(
      context.referenceMediaItems,
      scenario.references.referenceMediaItems
    );
    assert.strictEqual(
      context.referenceProvenanceIssues,
      scenario.references.referenceProvenanceIssues
    );
    assert.deepEqual(scenario.references.referenceMediaItems, [
      { fieldId: 'image_urls', kind: 'image', url: 'valid-image' },
      {
        fieldId,
        kind: 'audio',
        url: `${fieldId}-audio`,
      },
    ]);
    assert.deepEqual(scenario.references.referenceProvenanceIssues, []);
  }
});

test('unknown inherited-key fields reject before incomplete provenance and budget without mutation', () => {
  const inputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls'],
      modes: ['ref2v'],
      maxTotal: 1,
      countUniqueUrls: false,
    },
  } satisfies EngineInputSchema;
  const scenario = buildFalMediaPipeline({
    engineId: 'seedance-2-0',
    defaultModel: 'fal-ai/bytedance/seedance/v2/reference-to-video',
    mode: 'ref2v',
    inputSchema,
    attachments: [
      attachment('image', 'image_urls', 'valid-image'),
      attachment('audio', 'constructor', 'constructor-audio'),
      attachment('audio', '__proto__', 'proto-audio'),
      incompleteAttachment({ kind: 'audio', url: 'slotless-audio' }),
      attachment('audio', 'image_urls', 'wrong-kind-audio'),
    ],
    captureValidationContext: true,
  });

  assert.equal(scenario.validation.ok, false);
  if (scenario.validation.ok) {
    assert.fail('budgeted validation accepted unknown inherited-key fields');
  }
  assert.equal(scenario.validation.body.field, '__proto__');
  assert.equal(
    scenario.validation.body.message,
    'Media input "__proto__" is not supported for this engine mode'
  );
  assert.deepEqual(scenario.references.referenceMediaItems, [
    { fieldId: 'image_urls', kind: 'image', url: 'valid-image' },
    {
      fieldId: 'constructor',
      kind: 'audio',
      url: 'constructor-audio',
    },
    { fieldId: '__proto__', kind: 'audio', url: 'proto-audio' },
    {
      fieldId: 'image_urls',
      kind: 'audio',
      url: 'wrong-kind-audio',
    },
  ]);
  assert.deepEqual(scenario.references.referenceProvenanceIssues, [
    {
      reason: 'missing-field-id',
      kind: 'audio',
      url: 'slotless-audio',
    },
  ]);
});

test('typed attachment provenance rejects actual media kind hidden under an active non-budget field', () => {
  const references = deriveGenerationAttachmentReferences({
    engineId: 'seedance-2-0',
    mode: 'v2v',
    inputSchema: typedReferenceBudgetV2vSchema,
    referenceImages: [],
    rawAudioUrl: null,
    attachments: [
      attachment('image', 'reference_image_urls', 'valid-image'),
      attachment('audio', 'video_url', 'forged-audio'),
    ],
  });

  assert.deepEqual(references.audioUrls, ['forged-audio']);
  const result = validateRequest(
    'seedance-2-0',
    'v2v',
    {
      reference_image_urls: ['valid-image'],
      video_url: 'source-video',
      duration: 4,
    },
    {
      inputSchema: typedReferenceBudgetV2vSchema,
      referenceValuesByField: references.referenceValuesByField,
      referenceMediaItems: references.referenceMediaItems,
    }
  );

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: 'ENGINE_CONSTRAINT',
      field: 'video_url',
      message: 'Media input "video_url" expects video, not audio',
    },
  });
});

test('budgeted route validation rejects deterministic slotless references that Fal would submit', () => {
  const { attachments, references } = deriveFalReferences(
    [
      incompleteAttachment({
        kind: 'video',
        url: 'slotless-video',
      }),
      incompleteAttachment({
        kind: 'audio',
        url: 'slotless-audio',
      }),
      incompleteAttachment({
        kind: 'audio',
        url: 'slotless-audio',
      }),
    ],
    budgetedFalReferenceSchema
  );
  const falRequest = buildFalReferenceRequest(attachments, references);

  assert.deepEqual(falRequest.requestBody.video_urls, ['slotless-video']);
  assert.deepEqual(falRequest.requestBody.audio_urls, ['slotless-audio']);

  const validation = buildFalReferenceValidation(
    references,
    budgetedFalReferenceSchema
  );
  if (validation.ok) {
    assert.fail(
      'budgeted validation accepted slotless references selected by Fal'
    );
  }
  assert.equal(validation.body.field, 'inputs');
  assert.equal(
    validation.body.message,
    'Media input of kind "audio" is missing a field assignment'
  );
  assert.deepEqual(references.referenceProvenanceIssues, [
    {
      reason: 'missing-field-id',
      kind: 'video',
      url: 'slotless-video',
    },
    {
      reason: 'missing-field-id',
      kind: 'audio',
      url: 'slotless-audio',
    },
    {
      reason: 'missing-field-id',
      kind: 'audio',
      url: 'slotless-audio',
    },
  ]);

  const reversed = deriveFalReferences(
    [
      incompleteAttachment({
        kind: 'audio',
        url: 'slotless-audio',
      }),
      incompleteAttachment({
        kind: 'audio',
        url: 'slotless-audio',
      }),
      incompleteAttachment({
        kind: 'video',
        url: 'slotless-video',
      }),
    ],
    budgetedFalReferenceSchema
  );
  const reversedFalRequest = buildFalReferenceRequest(
    reversed.attachments,
    reversed.references
  );
  assert.deepEqual(reversedFalRequest.requestBody.video_urls, [
    'slotless-video',
  ]);
  assert.deepEqual(reversedFalRequest.requestBody.audio_urls, [
    'slotless-audio',
  ]);

  const reversedValidation = buildFalReferenceValidation(
    reversed.references,
    budgetedFalReferenceSchema
  );
  if (reversedValidation.ok) {
    assert.fail(
      'budgeted validation accepted reversed slotless references selected by Fal'
    );
  }
  assert.equal(reversedValidation.body.field, 'inputs');
  assert.equal(
    reversedValidation.body.message,
    'Media input of kind "audio" is missing a field assignment'
  );
  assert.deepEqual(reversed.references.referenceProvenanceIssues, [
    {
      reason: 'missing-field-id',
      kind: 'audio',
      url: 'slotless-audio',
    },
    {
      reason: 'missing-field-id',
      kind: 'audio',
      url: 'slotless-audio',
    },
    {
      reason: 'missing-field-id',
      kind: 'video',
      url: 'slotless-video',
    },
  ]);
});

test('budgeted route validation independently rejects a slotless video selected by Fal', () => {
  const { attachments, references } = deriveFalReferences(
    [
      incompleteAttachment({
        kind: 'video',
        url: 'slotless-video',
      }),
    ],
    budgetedFalReferenceSchema
  );
  const falRequest = buildFalReferenceRequest(attachments, references);

  assert.deepEqual(falRequest.requestBody.video_urls, ['slotless-video']);

  const validation = buildFalReferenceValidation(
    references,
    budgetedFalReferenceSchema
  );
  if (validation.ok) {
    assert.fail('budgeted validation accepted a slotless video selected by Fal');
  }
  assert.equal(validation.body.field, 'inputs');
  assert.equal(
    validation.body.message,
    'Media input of kind "video" is missing a field assignment'
  );
});

test('budgeted route validation rejects an active Fal slot without an explicit kind', () => {
  const { attachments, references } = deriveFalReferences(
    [
      incompleteAttachment({
        slotId: 'audio_urls',
        url: 'kindless-audio',
      }),
    ],
    kindlessFalReferenceSchema
  );
  const falRequest = buildFalReferenceRequest(attachments, references);

  assert.deepEqual(falRequest.requestBody.audio_urls, ['kindless-audio']);

  const validation = buildFalReferenceValidation(
    references,
    kindlessFalReferenceSchema
  );
  if (validation.ok) {
    assert.fail('budgeted validation accepted an active slot without a kind');
  }
  assert.equal(validation.body.field, 'audio_urls');
  assert.equal(
    validation.body.message,
    'Media input "audio_urls" is missing an explicit media kind'
  );
});

test('incomplete Fal attachment provenance remains compatible without a budget', () => {
  const cases: NormalizedAttachment[][] = [
    [
      incompleteAttachment({
        kind: 'audio',
        url: 'slotless-audio',
      }),
    ],
    [
      incompleteAttachment({
        slotId: 'audio_urls',
        url: 'kindless-audio',
      }),
    ],
  ];

  for (const extraAttachments of cases) {
    const { references } = deriveFalReferences(
      extraAttachments,
      unbudgetedFalReferenceSchema
    );
    assert.equal(
      buildFalReferenceValidation(
        references,
        unbudgetedFalReferenceSchema
      ).ok,
      true
    );
  }
});

test('attachment slot provenance remains backward compatible without an aggregate budget', () => {
  const inputSchema = {
    optional: typedReferenceV2vFields,
  } satisfies EngineInputSchema;
  const references = deriveGenerationAttachmentReferences({
    engineId: 'seedance-2-0',
    mode: 'v2v',
    inputSchema,
    referenceImages: [],
    rawAudioUrl: null,
    attachments: [
      attachment('image', 'reference_image_urls', 'valid-image'),
      attachment('audio', 'video_url', 'forged-audio'),
    ],
  });
  const result = validateRequest(
    'seedance-2-0',
    'v2v',
    {
      reference_image_urls: ['valid-image'],
      video_url: 'source-video',
      duration: 4,
    },
    {
      inputSchema,
      referenceValuesByField: references.referenceValuesByField,
      referenceMediaItems: references.referenceMediaItems,
    }
  );

  assert.deepEqual(result, OK);
});

test('active schema media outside the aggregate budget remains valid', () => {
  const references = deriveGenerationAttachmentReferences({
    engineId: 'seedance-2-0',
    mode: 'v2v',
    inputSchema: typedReferenceBudgetV2vSchema,
    referenceImages: [],
    rawAudioUrl: null,
    attachments: [
      attachment('image', 'reference_image_urls', 'valid-image'),
      attachment('video', 'video_url', 'source-video'),
    ],
  });
  const result = validateRequest(
    'seedance-2-0',
    'v2v',
    {
      reference_image_urls: ['valid-image'],
      video_url: 'source-video',
      duration: 4,
    },
    {
      inputSchema: typedReferenceBudgetV2vSchema,
      referenceValuesByField: references.referenceValuesByField,
      referenceMediaItems: references.referenceMediaItems,
    }
  );

  assert.deepEqual(result, OK);
});

test('Pika 2.2 rejects duration under 5 seconds', () => {
  const result = validateRequest('pika-text-to-video', 't2v', {
    duration: 4,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error?.field, 'duration');
});

test('Pika 2.2 accepts 5 second duration', () => {
  const result = validateRequest('pika-text-to-video', 't2v', {
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(result, OK);
});

test('Pika 2.2 accepts 10 second duration', () => {
  const result = validateRequest('pika-text-to-video', 't2v', {
    duration: 10,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(result, OK);
});

test('Pika 2.2 rejects 8 second duration', () => {
  const result = validateRequest('pika-text-to-video', 't2v', {
    duration: 8,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error?.field, 'duration');
});

test('Sora image-to-video only allows 4/8/12 seconds', () => {
  const invalid = validateRequest('sora-2', 'i2v', {
    duration: 6,
    resolution: '720p',
    aspect_ratio: 'auto',
    image_url: 'https://example.com/frame.png',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'duration');

  const valid = validateRequest('sora-2', 'i2v', {
    duration: 8,
    resolution: '720p',
    aspect_ratio: 'auto',
    image_url: 'https://example.com/frame.png',
  });
  assert.deepEqual(valid, OK);
});

test('Sora 2 Pro enforces Pro duration and resolution options', () => {
  const invalidDuration = validateRequest('sora-2-pro', 't2v', {
    duration: 6,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalidDuration.ok, false);
  assert.equal(invalidDuration.error?.field, 'duration');

  const invalidResolution = validateRequest('sora-2-pro', 't2v', {
    duration: 8,
    resolution: '1440p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalidResolution.ok, false);
  assert.equal(invalidResolution.error?.field, 'resolution');

  const valid = validateRequest('sora-2-pro', 't2v', {
    duration: 8,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 Fast T2V accepts string durations and audio toggle', () => {
  const valid = validateRequest('veo-3-1-fast', 't2v', {
    duration: '6s',
    resolution: '1080p',
    aspect_ratio: '16:9',
    generate_audio: true,
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 T2V supports 4-8 second prompts', () => {
  const valid = validateRequest('veo-3-1', 't2v', {
    duration: '6s',
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 Fast T2V supports text prompts', () => {
  const valid = validateRequest('veo-3-1-fast', 't2v', {
    duration: '4s',
    resolution: '720p',
    aspect_ratio: '9:16',
  });
  assert.deepEqual(valid, OK);
});

test('Kling multi-prompt scenes use the provider 512 character scene limit', () => {
  const valid = validateRequest('kling-3-pro', 't2v', {
    multi_prompt: [{ prompt: 'x'.repeat(512), duration: 5 }],
    duration: 5,
    aspect_ratio: '16:9',
  });
  assert.deepEqual(valid, OK);

  const invalid = validateRequest('kling-3-pro', 't2v', {
    multi_prompt: [{ prompt: 'x'.repeat(513), duration: 5 }],
    duration: 5,
    aspect_ratio: '16:9',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'multi_prompt[0].prompt');
  assert.deepEqual(invalid.error?.allowed, [512]);
  assert.equal(invalid.error?.value, 513);
});

test('Kling rejects an end frame combined with a multi-prompt shot plan', () => {
  const invalid = validateRequest('kling-3-standard', 'i2v', {
    multi_prompt: [{ prompt: 'Open on the product and push in slowly.', duration: 5 }],
    duration: 5,
    resolution: '1080p',
    image_url: 'https://example.com/start.png',
    end_image_url: 'https://example.com/end.png',
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'end_image_url');
  assert.match(invalid.error?.message ?? '', /end frame.*multi-prompt/i);
});

test('Veo 3.1 Fast I2V requires image_url', () => {
  const invalid = validateRequest('veo-3-1-fast', 'i2v', {
    prompt: 'Animate this still',
    duration: '8s',
    resolution: '720p',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'image_url');

  const valid = validateRequest('veo-3-1-fast', 'i2v', {
    prompt: 'Animate this still',
    image_url: 'https://example.com/test.png',
    duration: '8s',
    resolution: '720p',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 FL2V requires both frames', () => {
  const missing = validateRequest('veo-3-1', 'fl2v', {
    prompt: 'Bridge frames',
    duration: '8s',
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.error?.field, 'first_frame_url');

  const partial = validateRequest('veo-3-1', 'fl2v', {
    prompt: 'Bridge frames',
    first_frame_url: 'https://example.com/frame1.png',
    duration: '8s',
  });
  assert.equal(partial.ok, false);
  assert.equal(partial.error?.field, 'last_frame_url');

  const valid = validateRequest('veo-3-1', 'fl2v', {
    prompt: 'Bridge frames',
    first_frame_url: 'https://example.com/frame1.png',
    last_frame_url: 'https://example.com/frame2.png',
    duration: '8s',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 FL2V rejects identical frames', () => {
  const invalid = validateRequest('veo-3-1', 'fl2v', {
    prompt: 'Bridge frames',
    first_frame_url: 'https://example.com/frame.png',
    last_frame_url: 'https://example.com/frame.png',
    duration: '8s',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'last_frame_url');
});

test('Veo 3.1 REF2V requires reference images', () => {
  const invalid = validateRequest('veo-3-1', 'ref2v', {
    prompt: 'Keep the subject consistent',
    duration: '8s',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'image_urls');

  const valid = validateRequest('veo-3-1', 'ref2v', {
    prompt: 'Keep the subject consistent',
    image_urls: ['https://example.com/ref-1.png', 'https://example.com/ref-2.png'],
    duration: '8s',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 Fast REF2V requires 1-3 reference images', () => {
  const missing = validateRequest('veo-3-1-fast', 'ref2v', {
    prompt: 'Keep the campaign subject consistent',
    duration: '8s',
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.error?.field, 'image_urls');

  const valid = validateRequest('veo-3-1-fast', 'ref2v', {
    prompt: 'Keep the campaign subject consistent',
    image_urls: ['https://example.com/ref-1.png', 'https://example.com/ref-2.png'],
    duration: '8s',
    resolution: '1080p',
    aspect_ratio: '16:9',
    generate_audio: true,
  });
  assert.deepEqual(valid, OK);

  const tooMany = validateRequest('veo-3-1-fast', 'ref2v', {
    prompt: 'Keep the campaign subject consistent',
    image_urls: Array.from({ length: 4 }, (_, index) => `https://example.com/ref-${index + 1}.png`),
    duration: '8s',
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.error?.field, 'image_urls');
  assert.deepEqual(tooMany.error?.allowed, [1, 3]);
});

test('Seedance 2.0 REF2V accepts Fal-style multimodal references and keeps audio gated behind image/video refs', () => {
  const promptOnly = validateRequest('seedance-2-0', 'ref2v', {
    prompt: 'Keep the same hero and outfit',
    duration: 'auto',
  });
  assert.deepEqual(promptOnly, OK);

  const valid = validateRequest('seedance-2-0', 'ref2v', {
    prompt: 'Keep the same hero and outfit',
    image_urls: Array.from({ length: 6 }, (_, index) => `https://example.com/ref-${index + 1}.png`),
    video_urls: ['https://example.com/ref-video.mp4'],
    audio_urls: ['https://example.com/ref-audio.wav'],
    duration: '10',
  });
  assert.deepEqual(valid, OK);

  const tooMany = validateRequest('seedance-2-0', 'ref2v', {
    prompt: 'Keep the same hero and outfit',
    image_urls: Array.from({ length: 10 }, (_, index) => `https://example.com/ref-${index + 1}.png`),
    duration: '10',
  });
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.error?.field, 'image_urls');
  assert.deepEqual(tooMany.error?.allowed, [1, 9]);

  const audioOnly = validateRequest('seedance-2-0', 'ref2v', {
    prompt: 'Use the soundtrack reference only',
    audio_urls: ['https://example.com/ref-audio.wav'],
    duration: '10',
  });
  assert.equal(audioOnly.ok, false);
  assert.equal(audioOnly.error?.field, 'audio_urls');
});

test('Seedance 2.5 validates each unified input family and its aggregate reference budget', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'seedance-2-5')?.engine;
  assert.ok(engine?.inputSchema);

  const validateSeedance25 = (
    mode: Mode,
    payload: Record<string, unknown>,
    referenceValuesByField: Record<string, string[]> = {}
  ) =>
    validateRequest('seedance-2-5', mode, { duration: 4, ...payload }, {
      inputSchema: engine.inputSchema,
      referenceValuesByField,
    });

  for (const [label, mode, payload, expectedField] of [
    ['i2v requires image_url', 'i2v', {}, 'image_url'],
    ['ref2v accepts image_urls', 'ref2v', { image_urls: ['https://cdn.test/ref.png'] }, null],
    ['v2v requires video_url', 'v2v', {}, 'video_url'],
    ['extend requires extension_source_videos', 'extend', {}, 'extension_source_videos'],
  ] as const) {
    const result = validateSeedance25(mode, payload);
    assert.equal(result.ok, expectedField === null, label);
    if (expectedField) {
      assert.equal(result.error?.field, expectedField, label);
    }
  }

  const imageUrls = Array.from(
    { length: 31 },
    (_, index) => `https://cdn.test/reference-${index + 1}.png`
  );
  const tooManyImages = validateSeedance25('ref2v', { image_urls: imageUrls }, { image_urls: imageUrls });
  assert.equal(tooManyImages.ok, false);
  assert.equal(tooManyImages.error?.field, 'image_urls');
  assert.deepEqual(tooManyImages.error?.allowed, [1, 30]);

  const combinedReferences = Array.from(
    { length: 51 },
    (_, index) => `https://cdn.test/combined-${index + 1}.png`
  );
  const overBudget = validateSeedance25(
    'ref2v',
    { image_urls: combinedReferences.slice(0, 30) },
    {
      image_urls: combinedReferences.slice(0, 30),
      video_urls: combinedReferences.slice(30, 40),
      audio_urls: combinedReferences.slice(40),
    }
  );
  assert.equal(overBudget.ok, false);
  assert.equal(overBudget.error?.field, 'audio_urls');
  assert.deepEqual(overBudget.error?.allowed, [0, 10]);
  assert.equal(overBudget.error?.value, 11);
});

test('Seedance 2.5 production validation enforces each V2V and Extend field cap', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'seedance-2-5')?.engine;
  assert.ok(engine?.inputSchema);

  const media = (
    kind: 'image' | 'video' | 'audio',
    slotId: string,
    count: number
  ) =>
    Array.from(
      { length: count },
      (_, index) => attachment(kind, slotId, `https://cdn.test/${slotId}-${index + 1}.${kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'wav'}`)
    );
  const validateV2v = (attachments: NormalizedAttachment[]) =>
    buildFalMediaPipeline({
      engineId: 'seedance-2-5',
      defaultModel: 'byteplus/dreamina-seedance-2.5/video-to-video',
      mode: 'v2v',
      inputSchema: engine.inputSchema,
      attachments,
    }).validation;
  const validateExtend = (attachments: NormalizedAttachment[]) =>
    buildFalMediaPipeline({
      engineId: 'seedance-2-5',
      defaultModel: 'byteplus/dreamina-seedance-2.5/extend',
      mode: 'extend',
      inputSchema: engine.inputSchema,
      attachments,
    }).validation;
  const sourceVideo = media('video', 'video_url', 1);

  assert.equal(validateV2v([...media('image', 'image_urls', 30), ...sourceVideo]).ok, true);
  const tooManyImages = validateV2v([...media('image', 'image_urls', 31), ...sourceVideo]);
  assert.equal(tooManyImages.ok, false);
  if (!tooManyImages.ok) assert.equal(tooManyImages.body.field, 'image_urls');

  assert.equal(validateV2v([...sourceVideo, ...media('audio', 'audio_urls', 10)]).ok, true);
  const tooManyAudio = validateV2v([...sourceVideo, ...media('audio', 'audio_urls', 11)]);
  assert.equal(tooManyAudio.ok, false);
  if (!tooManyAudio.ok) assert.equal(tooManyAudio.body.field, 'audio_urls');

  assert.equal(validateV2v(sourceVideo).ok, true);
  const tooManySources = validateV2v(media('video', 'video_url', 2));
  assert.equal(tooManySources.ok, false);
  if (!tooManySources.ok) assert.equal(tooManySources.body.field, 'video_url');

  assert.equal(validateExtend(media('video', 'extension_source_videos', 3)).ok, true);
  const tooManyExtensionSources = validateExtend(
    media('video', 'extension_source_videos', 4)
  );
  assert.equal(tooManyExtensionSources.ok, false);
  if (!tooManyExtensionSources.ok) {
    assert.equal(tooManyExtensionSources.body.field, 'extension_source_videos');
  }
});

test('Veo 3.1 Fast FL2V requires both frames', () => {
  const invalid = validateRequest('veo-3-1-fast', 'fl2v', {
    prompt: 'Bridge frames',
    first_frame_url: 'https://example.com/frame1.png',
    duration: '8s',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'last_frame_url');

  const valid = validateRequest('veo-3-1-fast', 'fl2v', {
    prompt: 'Bridge frames',
    first_frame_url: 'https://example.com/frame1.png',
    last_frame_url: 'https://example.com/frame2.png',
    duration: '8s',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 Extend uses Google direct fixed 7 second caps by model', () => {
  const missingSource = validateRequest('veo-3-1-fast', 'extend', {
    duration: '7s',
  });
  assert.equal(missingSource.ok, false);
  assert.equal(missingSource.error?.field, 'video_url');

  const valid = validateRequest('veo-3-1-fast', 'extend', {
    video_url: 'https://example.com/source.mp4',
    duration: '7s',
    resolution: '4k',
    aspect_ratio: '16:9',
    generate_audio: false,
  });
  assert.deepEqual(valid, OK);

  const invalidDuration = validateRequest('veo-3-1-fast', 'extend', {
    video_url: 'https://example.com/source.mp4',
    duration: '8s',
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalidDuration.ok, false);
  assert.equal(invalidDuration.error?.field, 'duration');

  const validLiteExtend = validateRequest('veo-3-1-lite', 'extend', {
    video_url: 'https://example.com/source.mp4',
    duration: '7s',
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(validLiteExtend, OK);

  const invalidResolution = validateRequest('veo-3-1-lite', 'extend', {
    video_url: 'https://example.com/source.mp4',
    duration: '7s',
    resolution: '4k',
    aspect_ratio: '16:9',
  });
  assert.equal(invalidResolution.ok, false);
  assert.equal(invalidResolution.error?.field, 'resolution');
});

test('Veo 3.1 Lite T2V supports 4-8 second prompts with optional audio', () => {
  const valid = validateRequest('veo-3-1-lite', 't2v', {
    duration: '6s',
    resolution: '1080p',
    aspect_ratio: '16:9',
    generate_audio: false,
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 Lite I2V requires a start image', () => {
  const invalid = validateRequest('veo-3-1-lite', 'i2v', {
    prompt: 'Animate this still',
    duration: '8s',
    resolution: '720p',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'image_url');

  const valid = validateRequest('veo-3-1-lite', 'i2v', {
    prompt: 'Animate this still',
    image_url: 'https://example.com/test.png',
    duration: '8s',
    resolution: '1080p',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 Lite FL2V requires both frames', () => {
  const invalid = validateRequest('veo-3-1-lite', 'fl2v', {
    prompt: 'Bridge frames',
    first_frame_url: 'https://example.com/frame1.png',
    duration: '8s',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'last_frame_url');

  const valid = validateRequest('veo-3-1-lite', 'fl2v', {
    prompt: 'Bridge frames',
    first_frame_url: 'https://example.com/frame1.png',
    last_frame_url: 'https://example.com/frame2.png',
    duration: '8s',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3 I2V rejects durations other than 8s', () => {
  const invalid = validateRequest('veo-3-1', 'i2v', {
    duration: '6s',
    resolution: '1080p',
    aspect_ratio: 'auto',
    image_url: 'https://example.com/frame.png',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'duration');

  const valid = validateRequest('veo-3-1', 'i2v', {
    duration: '8s',
    resolution: '1080p',
    aspect_ratio: '16:9',
    image_url: 'https://example.com/frame.png',
  });
  assert.deepEqual(valid, OK);
});

test('Luma Ray 2 modify and reframe validate the new workflow surface', () => {
  const missingSource = validateRequest('lumaRay2', 'v2v', {
    prompt: 'Refresh the wardrobe texture',
  });
  assert.equal(missingSource.ok, false);
  assert.equal(missingSource.error?.field, 'video_url');

  const validModify = validateRequest('lumaRay2', 'v2v', {
    video_url: 'https://example.com/source.mp4',
    prompt: 'Refresh the wardrobe texture',
    mode: 'flex_2',
  });
  assert.deepEqual(validModify, OK);

  const validReframe = validateRequest('lumaRay2', 'reframe', {
    video_url: 'https://example.com/source.mp4',
    aspect_ratio: '1:1',
  });
  assert.deepEqual(validReframe, OK);

  const invalidGenerateAspect = validateRequest('lumaRay2', 't2v', {
    prompt: 'Generate a cinematic shot',
    duration: '5s',
    resolution: '1080p',
    aspect_ratio: '1:1',
  });
  assert.equal(invalidGenerateAspect.ok, false);
  assert.equal(invalidGenerateAspect.error?.field, 'aspect_ratio');
});

test('Hailuo-02 Std enforces duration and resolution', () => {
  const invalid = validateRequest('minimax-hailuo-02-text', 'i2v', {
    duration: 12,
    resolution: '1080p',
    aspect_ratio: '16:9',
    image_url: 'https://example.com/frame.png',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'duration');

  const invalidResolution = validateRequest('minimax-hailuo-02-text', 'i2v', {
    duration: 6,
    resolution: '1080p',
    aspect_ratio: '16:9',
    image_url: 'https://example.com/frame.png',
  });
  assert.equal(invalidResolution.ok, false);
  assert.equal(invalidResolution.error?.field, 'resolution');

  const valid = validateRequest('minimax-hailuo-02-text', 'i2v', {
    duration: 10,
    resolution: '768P',
    _uploadedFileMB: 10,
    image_url: 'https://example.com/frame.png',
  });
  assert.deepEqual(valid, OK);
});

test('Hailuo-02 Std rejects 512P image-to-video with an end frame', () => {
  const invalid = validateRequest('minimax-hailuo-02-text', 'i2v', {
    duration: 6,
    resolution: '512P',
    aspect_ratio: '16:9',
    image_url: 'https://example.com/start.png',
    end_image_url: 'https://example.com/end.png',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'resolution');
  assert.match(invalid.error?.message ?? '', /end frame.*768P/i);

  const valid = validateRequest('minimax-hailuo-02-text', 'i2v', {
    duration: 6,
    resolution: '768P',
    aspect_ratio: '16:9',
    image_url: 'https://example.com/start.png',
    end_image_url: 'https://example.com/end.png',
  });
  assert.deepEqual(valid, OK);
});

test('Wan 2.6 R2V requires reference videos', () => {
  const missing = validateRequest('wan-2-6', 'r2v', {
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.error?.field, 'video_urls');

  const valid = validateRequest('wan-2-6', 'r2v', {
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
    video_urls: ['https://example.com/ref1.mp4'],
  });
  assert.deepEqual(valid, OK);

  const invalidLong = validateRequest('wan-2-6', 'r2v', {
    duration: 15,
    resolution: '1080p',
    aspect_ratio: '16:9',
    video_urls: ['https://example.com/ref1.mp4'],
  });
  assert.equal(invalidLong.ok, false);
  assert.equal(invalidLong.error?.field, 'duration');
});

test('Kling 3 prompt length is capped before provider submission', () => {
  const invalid = validateRequest('kling-3-pro', 't2v', {
    prompt: 'x'.repeat(2501),
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'prompt');

  const valid = validateRequest('kling-3-standard', 't2v', {
    prompt: 'x'.repeat(2500),
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(valid, OK);
});

test('Kling O3 applies its prompt limit after normalizing media references', () => {
  const rawPromptAtLimit = `${'x'.repeat(2492)} @Image1`;
  assert.equal(rawPromptAtLimit.length, 2500);

  const invalid = validateRequest('kling-o3-pro', 'i2v', {
    prompt: rawPromptAtLimit,
    duration: 5,
    resolution: '1080p',
    image_url: 'https://example.com/start.png',
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'prompt');
  assert.equal(invalid.error?.value, 2506);
  assert.deepEqual(invalid.error?.allowed, [2500]);
});

test('Kling 3 4K accepts multi-prompt shot plans', () => {
  const valid = validateRequest('kling-3-4k', 't2v', {
    prompt: '',
    multi_prompt: [
      { prompt: 'Wide establishing shot of the product on a graphite table.', duration: 3 },
      { prompt: 'Macro push-in across the lens and metal edge.', duration: 3 },
    ],
    duration: 6,
    resolution: '4k',
    aspect_ratio: '16:9',
  });

  assert.deepEqual(valid, OK);
});

test('Happy Horse 1.0 validates text, image, R2V, and V2V workflow inputs', () => {
  const textValid = validateRequest('happy-horse-1-0', 't2v', {
    prompt: 'Native audio product launch with a talking creator',
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '16:9',
    seed: 12345,
    enable_safety_checker: true,
  });
  assert.deepEqual(textValid, OK);

  const missingImage = validateRequest('happy-horse-1-0', 'i2v', {
    prompt: 'Animate the campaign still',
    duration: 5,
    resolution: '1080p',
  });
  assert.equal(missingImage.ok, false);
  assert.equal(missingImage.error?.field, 'image_url');

  const imageValid = validateRequest('happy-horse-1-0', 'i2v', {
    image_url: 'https://example.com/start.png',
    duration: 5,
    resolution: '720p',
  });
  assert.deepEqual(imageValid, OK);

  const imageAspectInvalid = validateRequest('happy-horse-1-0', 'i2v', {
    image_url: 'https://example.com/start.png',
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(imageAspectInvalid.ok, false);
  assert.equal(imageAspectInvalid.error?.field, 'aspect_ratio');

  const missingReferences = validateRequest('happy-horse-1-0', 'ref2v', {
    prompt: 'Use character1 in a studio launch clip',
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(missingReferences.ok, false);
  assert.equal(missingReferences.error?.field, 'image_urls');

  const tooManyReferences = validateRequest('happy-horse-1-0', 'ref2v', {
    prompt: 'Use the characters in the references',
    image_urls: Array.from({ length: 10 }, (_, index) => `https://example.com/ref-${index + 1}.png`),
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(tooManyReferences.ok, false);
  assert.equal(tooManyReferences.error?.field, 'image_urls');
  assert.deepEqual(tooManyReferences.error?.allowed, [1, 9]);

  const r2vValid = validateRequest('happy-horse-1-0', 'ref2v', {
    prompt: 'Use character1 and character2 in a short product demo',
    image_urls: ['https://example.com/ref-1.png', 'https://example.com/ref-2.png'],
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(r2vValid, OK);

  const missingVideo = validateRequest('happy-horse-1-0', 'v2v', {
    prompt: 'Warm studio relight',
    resolution: '1080p',
  });
  assert.equal(missingVideo.ok, false);
  assert.equal(missingVideo.error?.field, 'video_url');

  const tooManyEditReferences = validateRequest('happy-horse-1-0', 'v2v', {
    video_url: 'https://example.com/source.mp4',
    prompt: 'Warm studio relight',
    reference_image_urls: Array.from({ length: 6 }, (_, index) => `https://example.com/edit-ref-${index + 1}.png`),
    resolution: '1080p',
  });
  assert.equal(tooManyEditReferences.ok, false);
  assert.equal(tooManyEditReferences.error?.field, 'reference_image_urls');
  assert.deepEqual(tooManyEditReferences.error?.allowed, [0, 5]);

  const v2vValid = validateRequest('happy-horse-1-0', 'v2v', {
    video_url: 'https://example.com/source.mp4',
    prompt: 'Warm studio relight',
    reference_image_urls: Array.from({ length: 5 }, (_, index) => `https://example.com/edit-ref-${index + 1}.png`),
    resolution: '1080p',
    audio_setting: 'auto',
    seed: 12345,
    enable_safety_checker: false,
  });
  assert.deepEqual(v2vValid, OK);

  const engine = listFalEngines().find((entry) => entry.id === 'happy-horse-1-0')?.engine;
  assert.ok(engine);
  const fields = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])];
  assert.ok(fields.some((field) => field.id === 'seed' && field.modes?.length === 4));
  assert.ok(fields.some((field) => field.id === 'enable_safety_checker' && field.default === true));
  assert.equal(fields.find((field) => field.id === 'image_urls')?.slotLabelPattern, 'character{n}');
  assert.equal(fields.find((field) => field.id === 'reference_image_urls')?.slotLabelPattern, '@Image{n}');
});

test('Happy Horse 1.1 validates text, image, and reference workflow inputs only', () => {
  const expectedDurations = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const expectedRatios = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21', '5:4', '4:5'];

  const textValid = validateRequest('happy-horse-1-1', 't2v', {
    prompt: 'Native audio presenter in a modern studio',
    duration: 15,
    resolution: '1080p',
    aspect_ratio: '9:21',
    seed: 2147483647,
    enable_safety_checker: false,
  });
  assert.deepEqual(textValid, OK);

  expectedDurations.forEach((duration) => {
    assert.deepEqual(
      validateRequest('happy-horse-1-1', 't2v', {
        prompt: `Duration ${duration}`,
        duration,
        resolution: '720p',
        aspect_ratio: '16:9',
      }),
      OK,
      `Happy Horse 1.1 should accept ${duration}s`
    );
  });
  expectedRatios.forEach((aspectRatio) => {
    assert.deepEqual(
      validateRequest('happy-horse-1-1', 'ref2v', {
        prompt: `Use character1 in ${aspectRatio}`,
        image_urls: ['https://example.com/ref-1.png'],
        duration: 5,
        resolution: '1080p',
        aspect_ratio: aspectRatio,
      }),
      OK,
      `Happy Horse 1.1 should accept ${aspectRatio}`
    );
  });

  const tooShort = validateRequest('happy-horse-1-1', 't2v', {
    prompt: 'Too short',
    duration: 2,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(tooShort.ok, false);
  assert.equal(tooShort.error?.field, 'duration');

  const tooLong = validateRequest('happy-horse-1-1', 't2v', {
    prompt: 'Too long',
    duration: 16,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.error?.field, 'duration');

  const imageValid = validateRequest('happy-horse-1-1', 'i2v', {
    image_url: 'https://example.com/start.png',
    duration: 3,
    resolution: '720p',
    seed: 0,
    enable_safety_checker: true,
  });
  assert.deepEqual(imageValid, OK);

  const imageAspectInvalid = validateRequest('happy-horse-1-1', 'i2v', {
    image_url: 'https://example.com/start.png',
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(imageAspectInvalid.ok, false);
  assert.equal(imageAspectInvalid.error?.field, 'aspect_ratio');

  const invalidSeed = validateRequest('happy-horse-1-1', 'i2v', {
    image_url: 'https://example.com/start.png',
    duration: 5,
    resolution: '720p',
    seed: 2147483648,
  });
  assert.equal(invalidSeed.ok, false);
  assert.equal(invalidSeed.error?.field, 'seed');

  const invalidSafetyChecker = validateRequest('happy-horse-1-1', 'i2v', {
    image_url: 'https://example.com/start.png',
    duration: 5,
    resolution: '720p',
    enable_safety_checker: 'false',
  });
  assert.equal(invalidSafetyChecker.ok, false);
  assert.equal(invalidSafetyChecker.error?.field, 'enable_safety_checker');

  const r2vValid = validateRequest('happy-horse-1-1', 'ref2v', {
    prompt: 'Use character1 and character2 in a short product demo',
    image_urls: ['https://example.com/ref-1.png', 'https://example.com/ref-2.png'],
    duration: 12,
    resolution: '1080p',
    aspect_ratio: '4:5',
  });
  assert.deepEqual(r2vValid, OK);

  const unsupportedV2v = validateRequest('happy-horse-1-1', 'v2v', {
    video_url: 'https://example.com/source.mp4',
    prompt: 'Warm studio relight',
    resolution: '1080p',
  });
  assert.equal(unsupportedV2v.ok, false);

  const engine = listFalEngines().find((entry) => entry.id === 'happy-horse-1-1')?.engine;
  assert.ok(engine);
  assert.deepEqual(engine.modes, ['t2v', 'i2v', 'ref2v']);
  assert.deepEqual(engine.aspectRatios, expectedRatios);
  assert.deepEqual(engine.modeCaps?.t2v?.duration && 'options' in engine.modeCaps.t2v.duration ? engine.modeCaps.t2v.duration.options : [], expectedDurations);
  assert.deepEqual(engine.modeCaps?.i2v?.duration && 'options' in engine.modeCaps.i2v.duration ? engine.modeCaps.i2v.duration.options : [], expectedDurations);
  assert.deepEqual(engine.modeCaps?.ref2v?.duration && 'options' in engine.modeCaps.ref2v.duration ? engine.modeCaps.ref2v.duration.options : [], expectedDurations);
  assert.equal(engine.modeCaps?.i2v?.aspectRatio, undefined);
  const fields = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])];
  assert.equal(fields.find((field) => field.id === 'image_url')?.maxCount, 1);
  assert.equal(fields.find((field) => field.id === 'image_urls')?.maxCount, 9);
  assert.equal(fields.find((field) => field.id === 'seed')?.min, 0);
  assert.equal(fields.find((field) => field.id === 'seed')?.max, 2147483647);
  assert.equal(fields.some((field) => field.id === 'video_url'), false);
  assert.equal(fields.some((field) => field.id === 'reference_image_urls'), false);
});

test('Luma Ray 3.2 rejects looped 10 second public video requests', () => {
  const invalidStringDuration = validateRequest('luma-ray-3-2', 't2v', {
    prompt: 'Loop this shot',
    duration: '10s',
    resolution: '540p',
    aspect_ratio: '16:9',
    loop: true,
  });
  assert.equal(invalidStringDuration.ok, false);
  assert.equal(invalidStringDuration.error?.field, 'loop');

  const invalidNumericDuration = validateRequest('luma-ray-3-2', 'i2v', {
    prompt: 'Loop this still',
    image_url: 'https://example.com/start.png',
    duration_seconds: 10,
    resolution: '540p',
    aspect_ratio: '16:9',
    loop: true,
  });
  assert.equal(invalidNumericDuration.ok, false);
  assert.equal(invalidNumericDuration.error?.field, 'loop');

  const validFiveSecondLoop = validateRequest('luma-ray-3-2', 't2v', {
    prompt: 'Loop this short shot',
    duration: '5s',
    resolution: '540p',
    aspect_ratio: '16:9',
    loop: true,
  });
  assert.deepEqual(validFiveSecondLoop, OK);
});

test('Kling 3 i2v enforces valid element inputs before provider submission', () => {
  const basePayload = {
    prompt: 'Animate this still',
    image_url: 'https://example.com/frame.png',
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '9:16',
  };

  const referenceOnly = validateRequest('kling-3-pro', 'i2v', {
    ...basePayload,
    elements: [{ referenceImageUrls: ['https://example.com/ref.png'] }],
  });
  assert.equal(referenceOnly.ok, false);
  assert.equal(referenceOnly.error?.field, 'elements');

  const frontalOnly = validateRequest('kling-3-pro', 'i2v', {
    ...basePayload,
    elements: [{ frontalImageUrl: 'https://example.com/front.png' }],
  });
  assert.equal(frontalOnly.ok, false);
  assert.equal(frontalOnly.error?.field, 'elements');

  const imagePair = validateRequest('kling-3-pro', 'i2v', {
    ...basePayload,
    elements: [
      {
        frontalImageUrl: 'https://example.com/front.png',
        referenceImageUrls: ['https://example.com/ref.png'],
      },
    ],
  });
  assert.deepEqual(imagePair, OK);

  const videoOnly = validateRequest('kling-3-pro', 'i2v', {
    ...basePayload,
    elements: [{ videoUrl: 'https://example.com/ref.mp4' }],
  });
  assert.deepEqual(videoOnly, OK);
});

test('Kling 3.0 Omni scopes elements to reference-to-video provider support', () => {
  const validElement = {
    frontalImageUrl: 'https://example.com/front.png',
    referenceImageUrls: ['https://example.com/ref.png'],
  };

  const imageWithElement = validateRequest('kling-o3-pro', 'i2v', {
    prompt: 'Animate this still',
    image_url: 'https://example.com/frame.png',
    duration: '5',
    elements: [validElement],
  });
  assert.equal(imageWithElement.ok, false);
  assert.equal(imageWithElement.error?.field, 'elements');

  const referenceElementOnly = validateRequest('kling-o3-pro', 'ref2v', {
    prompt: 'Use @Element1 as the main character.',
    duration: '5',
    aspect_ratio: '16:9',
    elements: [validElement],
  });
  assert.deepEqual(referenceElementOnly, OK);

  const referenceStartFrameOnly = validateRequest('kling-o3-pro', 'ref2v', {
    prompt: 'Use the start frame as composition, then move into a new shot.',
    duration: '5',
    aspect_ratio: '16:9',
    start_image_url: 'https://example.com/start.png',
  });
  assert.deepEqual(referenceStartFrameOnly, OK);
});

test('Kling 3.0 Omni video-to-video requires one source video and accepts bounded visual references', () => {
  const validElement = {
    frontalImageUrl: 'https://example.com/front.png',
    referenceImageUrls: ['https://example.com/ref.png'],
  };

  const missingSource = validateRequest('kling-o3-pro', 'v2v', {
    prompt: 'Use @Image1 as style guidance.',
    duration: '5',
    aspect_ratio: '16:9',
    image_urls: ['https://example.com/style.png'],
  });
  assert.equal(missingSource.ok, false);
  assert.equal(missingSource.error?.field, 'video_url');

  const tooManyReferences = validateRequest('kling-o3-pro', 'v2v', {
    prompt: 'Use @Video1 for motion and the images for style.',
    video_url: 'https://example.com/source.mp4',
    duration: '5',
    aspect_ratio: '16:9',
    image_urls: [
      'https://example.com/ref-1.png',
      'https://example.com/ref-2.png',
      'https://example.com/ref-3.png',
      'https://example.com/ref-4.png',
      'https://example.com/ref-5.png',
    ],
  });
  assert.equal(tooManyReferences.ok, false);
  assert.equal(tooManyReferences.error?.field, 'image_urls');

  const validVideoReference = validateRequest('kling-o3-pro', 'v2v', {
    prompt: 'Use @Video1 for motion, @Image1 for style, and @Element1 as the subject.',
    video_url: 'https://example.com/source.mp4',
    duration: '5',
    aspect_ratio: '16:9',
    image_urls: ['https://example.com/style.png'],
    keep_audio: false,
    elements: [validElement],
  });
  assert.deepEqual(validVideoReference, OK);
});

test('Wan prompt length follows documented provider limits', () => {
  const invalid = validateRequest('wan-2-6', 't2v', {
    prompt: 'x'.repeat(801),
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'prompt');

  const valid = validateRequest('wan-2-5', 't2v', {
    prompt: 'x'.repeat(800),
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(valid, OK);
});

test('LTX 2.3 registry exposes unified mode mapping', () => {
  const registry = listFalEngines();
  const ltx23 = registry.find((entry) => entry.id === 'ltx-2-3');
  const ltx23Fast = registry.find((entry) => entry.id === 'ltx-2-3-fast');

  assert.ok(ltx23);
  assert.ok(ltx23Fast);
  assert.equal(ltx23?.modes.find((mode) => mode.mode === 't2v')?.falModelId, 'fal-ai/ltx-2.3/text-to-video');
  assert.equal(ltx23?.modes.find((mode) => mode.mode === 'i2v')?.falModelId, 'fal-ai/ltx-2.3/image-to-video');
  assert.equal(ltx23?.modes.find((mode) => mode.mode === 'a2v')?.falModelId, 'fal-ai/ltx-2.3/audio-to-video');
  assert.equal(ltx23?.modes.find((mode) => mode.mode === 'extend')?.falModelId, 'fal-ai/ltx-2.3/extend-video');
  assert.equal(ltx23?.modes.find((mode) => mode.mode === 'retake')?.falModelId, 'fal-ai/ltx-2.3/retake-video');
  assert.equal(ltx23Fast?.modes.find((mode) => mode.mode === 't2v')?.falModelId, 'fal-ai/ltx-2.3/text-to-video/fast');
  assert.equal(ltx23Fast?.modes.find((mode) => mode.mode === 'i2v')?.falModelId, 'fal-ai/ltx-2.3/image-to-video/fast');
  assert.equal(ltx23Fast?.modes.some((mode) => mode.mode === 'a2v'), false);
  assert.equal(ltx23Fast?.modes.some((mode) => mode.mode === 'extend'), false);
  assert.equal(ltx23Fast?.modes.some((mode) => mode.mode === 'retake'), false);
});

test('Veo 3.1 Lite registry exposes the unified lite mode mapping', () => {
  const registry = listFalEngines();
  const veoLite = registry.find((entry) => entry.id === 'veo-3-1-lite');

  assert.ok(veoLite);
  assert.equal(veoLite?.modes.find((mode) => mode.mode === 't2v')?.falModelId, 'fal-ai/veo3.1/lite');
  assert.equal(veoLite?.modes.find((mode) => mode.mode === 'i2v')?.falModelId, 'fal-ai/veo3.1/lite/image-to-video');
  assert.equal(
    veoLite?.modes.find((mode) => mode.mode === 'fl2v')?.falModelId,
    'fal-ai/veo3.1/lite/first-last-frame-to-video'
  );
  assert.equal(veoLite?.modes.find((mode) => mode.mode === 'extend')?.falModelId, 'fal-ai/veo3.1/lite/extend-video');
  assert.equal(veoLite?.modes.some((mode) => mode.mode === 'ref2v'), false);
  assert.equal(veoLite?.modes.some((mode) => mode.mode === 'extend'), true);
  assert.equal(veoLite?.engine.inputSchema?.optional?.some((field) => field.id === 'generate_audio'), true);
  assert.equal(veoLite?.modes.every((mode) => mode.ui.audioToggle === true), true);
});

test('Veo 3.1 registry exposes Google direct resolution support by model', () => {
  const registry = listFalEngines();
  const standard = registry.find((entry) => entry.id === 'veo-3-1');
  const fast = registry.find((entry) => entry.id === 'veo-3-1-fast');
  const lite = registry.find((entry) => entry.id === 'veo-3-1-lite');

  assert.ok(standard);
  assert.ok(fast);
  assert.ok(lite);

  assert.deepEqual(standard?.engine.resolutions, ['720p', '1080p', '4k']);
  assert.deepEqual(fast?.engine.resolutions, ['720p', '1080p', '4k']);
  assert.deepEqual(lite?.engine.resolutions, ['720p', '1080p']);

  assert.equal(
    validateRequest('veo-3-1', 't2v', {
      duration: '8s',
      resolution: '4k',
      aspect_ratio: '16:9',
    }).ok,
    true
  );
  assert.equal(
    validateRequest('veo-3-1-fast', 't2v', {
      duration: '8s',
      resolution: '4k',
      aspect_ratio: '9:16',
    }).ok,
    true
  );
  assert.equal(
    validateRequest('veo-3-1-lite', 't2v', {
      duration: '8s',
      resolution: '4k',
      aspect_ratio: '16:9',
    }).ok,
    false
  );
});

test('Veo 3.1 Google-first catalog avoids Fal-only direct-incompatible options', () => {
  const registry = listFalEngines();
  const engines = ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite']
    .map((id) => registry.find((entry) => entry.id === id))
    .filter(Boolean);

  for (const entry of engines) {
    assert.deepEqual(entry?.engine.aspectRatios, ['16:9', '9:16']);
    assert.deepEqual(entry?.engine.inputSchema?.constraints?.supportedFormats, ['jpg', 'jpeg', 'png']);
    assert.equal(entry?.engine.inputSchema?.optional?.some((field) => field.id === 'auto_fix'), false);
  }
});

test('Veo 3.1 Fast registry exposes unified reference-to-video mapping', () => {
  const registry = listFalEngines();
  const veoFast = registry.find((entry) => entry.id === 'veo-3-1-fast');

  assert.ok(veoFast);
  assert.equal(veoFast?.engine.modes.includes('ref2v'), true);
  assert.equal(
    veoFast?.modes.find((mode) => mode.mode === 'ref2v')?.falModelId,
    'fal-ai/veo3.1/fast/reference-to-video'
  );
  assert.equal(
    veoFast?.engine.inputSchema?.required?.some(
      (field) =>
        field.id === 'image_urls' &&
        field.modes?.includes('ref2v') &&
        field.requiredInModes?.includes('ref2v') &&
        field.minCount === 1 &&
        field.maxCount === 3
    ),
    true
  );
});

test('Luma Ray 2 registry keeps the two public models with generate, modify, and reframe workflows', () => {
  const registry = listFalEngines();
  const lumaRay2 = registry.find((entry) => entry.id === 'lumaRay2');
  const lumaRay2Flash = registry.find((entry) => entry.id === 'lumaRay2_flash');

  assert.ok(lumaRay2);
  assert.ok(lumaRay2Flash);
  assert.equal(lumaRay2?.modes.find((mode) => mode.mode === 't2v')?.falModelId, 'fal-ai/luma-dream-machine/ray-2');
  assert.equal(
    lumaRay2?.modes.find((mode) => mode.mode === 'i2v')?.falModelId,
    'fal-ai/luma-dream-machine/ray-2/image-to-video'
  );
  assert.equal(
    lumaRay2?.modes.find((mode) => mode.mode === 'v2v')?.falModelId,
    'fal-ai/luma-dream-machine/ray-2/modify'
  );
  assert.equal(
    lumaRay2?.modes.find((mode) => mode.mode === 'reframe')?.falModelId,
    'fal-ai/luma-dream-machine/ray-2/reframe'
  );
  assert.equal(
    lumaRay2Flash?.modes.find((mode) => mode.mode === 'v2v')?.falModelId,
    'fal-ai/luma-dream-machine/ray-2-flash/modify'
  );
  assert.equal(
    lumaRay2Flash?.modes.find((mode) => mode.mode === 'reframe')?.falModelId,
    'fal-ai/luma-dream-machine/ray-2-flash/reframe'
  );
  assert.equal(lumaRay2?.engine.audio, false);
  assert.equal(lumaRay2Flash?.engine.audio, false);
  assert.equal(registry.some((entry) => entry.id === 'lumaRay2_modify'), false);
  assert.equal(registry.some((entry) => entry.id === 'lumaRay2_reframe'), false);
});

test('Nano Banana 2 registry exposes image mappings and schema caps', () => {
  const registry = listFalEngines();
  const nanoBanana2 = registry.find((entry) => entry.id === 'nano-banana-2');

  assert.ok(nanoBanana2);
  assert.equal(nanoBanana2?.modes.find((mode) => mode.mode === 't2i')?.falModelId, 'gemini-3.1-flash-image');
  assert.equal(nanoBanana2?.modes.find((mode) => mode.mode === 'i2i')?.falModelId, 'gemini-3.1-flash-image');
  assert.deepEqual(nanoBanana2?.engine.resolutions, ['0.5k', '1k', '2k', '4k']);
  assert.ok(nanoBanana2?.engine.aspectRatios.includes('4:1'));
  assert.ok(nanoBanana2?.engine.aspectRatios.includes('8:1'));
  const numImagesField = nanoBanana2?.engine.inputSchema?.optional?.find((field) => field.id === 'num_images');
  const imageUrlsField = nanoBanana2?.engine.inputSchema?.optional?.find(
    (field) => field.id === 'image_urls' && field.modes?.includes('i2i')
  );
  assert.equal(numImagesField?.max, 4);
  assert.equal(imageUrlsField?.maxCount, 14);
});

test('GPT Image 2 registry exposes unified generation and edit mappings', () => {
  const registry = listFalEngines();
  const gptImage2 = registry.find((entry) => entry.id === 'gpt-image-2');

  assert.ok(gptImage2);
  assert.equal(gptImage2?.modes.find((mode) => mode.mode === 't2i')?.falModelId, 'openai/gpt-image-2');
  assert.equal(gptImage2?.modes.find((mode) => mode.mode === 'i2i')?.falModelId, 'openai/gpt-image-2/edit');
  assert.deepEqual(
    gptImage2?.engine.inputSchema?.optional?.find((field) => field.id === 'quality')?.values,
    ['low', 'medium', 'high']
  );
  assert.equal(
    gptImage2?.engine.inputSchema?.optional?.find((field) => field.id === 'resolution' && field.modes?.includes('t2i'))?.engineParam,
    'image_size'
  );
  assert.ok(
    gptImage2?.engine.inputSchema?.optional
      ?.find((field) => field.id === 'resolution' && field.modes?.includes('t2i'))
      ?.values?.includes('3840x2160')
  );
  assert.equal(
    gptImage2?.engine.inputSchema?.optional?.find((field) => field.id === 'image_width')?.engineParam,
    'image_size.width'
  );
});

test('LTX 2.3 A2V requires audio input', () => {
  const missing = validateRequest('ltx-2-3', 'a2v', {});
  assert.equal(missing.ok, false);
  assert.equal(missing.error?.field, 'audio_url');

  const valid = validateRequest('ltx-2-3', 'a2v', {
    audio_url: 'https://example.com/audio.mp3',
  });
  assert.deepEqual(valid, OK);
});

test('LTX 2.3 extend and retake require a source video', () => {
  const missingExtend = validateRequest('ltx-2-3', 'extend', { duration: 5 });
  assert.equal(missingExtend.ok, false);
  assert.equal(missingExtend.error?.field, 'video_url');

  const validExtend = validateRequest('ltx-2-3', 'extend', {
    duration: 5,
    video_url: 'https://example.com/source.mp4',
  });
  assert.deepEqual(validExtend, OK);

  const missingRetake = validateRequest('ltx-2-3', 'retake', { duration: 5, prompt: 'Retake the shot' });
  assert.equal(missingRetake.ok, false);
  assert.equal(missingRetake.error?.field, 'video_url');

  const validRetake = validateRequest('ltx-2-3', 'retake', {
    duration: 5,
    prompt: 'Retake the shot',
    video_url: 'https://example.com/source.mp4',
  });
  assert.deepEqual(validRetake, OK);
});

test('LTX 2.3 image-to-video supports auto aspect ratio only on i2v', () => {
  const i2vValid = validateRequest('ltx-2-3', 'i2v', {
    prompt: 'Animate this still',
    image_url: 'https://example.com/frame.png',
    duration: 6,
    resolution: '1080p',
    aspect_ratio: 'auto',
  });
  assert.deepEqual(i2vValid, OK);

  const t2vInvalid = validateRequest('ltx-2-3', 't2v', {
    prompt: 'Generate from text',
    duration: 6,
    resolution: '1080p',
    aspect_ratio: 'auto',
  });
  assert.equal(t2vInvalid.ok, false);
  assert.equal(t2vInvalid.error?.field, 'aspect_ratio');
});
