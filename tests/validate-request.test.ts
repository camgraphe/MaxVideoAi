import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { deriveGenerationAttachmentReferences } from '../frontend/app/api/generate/_lib/attachment-references.ts';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/attachments.ts';
import { buildFalInputs } from '../frontend/app/api/generate/_lib/fal-request.ts';
import { buildGenerateValidationPayload } from '../frontend/app/api/generate/_lib/validation-payload.ts';
import { validateModeMediaInputs } from '../frontend/app/api/generate/_lib/validate-media-inputs.ts';
import { validateRequest } from '../frontend/app/api/generate/_lib/validate.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body.ts';
import type { EngineInputSchema } from '../frontend/types/engines.ts';

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
