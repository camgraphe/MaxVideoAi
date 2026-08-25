import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  MAX_CANONICAL_PROMPT_CHARS,
  MAX_CANONICAL_SETTINGS_JSON_BYTES,
  MAX_CANONICAL_SETTING_COUNT,
  GenerationNormalizationError,
  hashCanonicalGenerationRequest,
  normalizeGenerationRequest,
  serializeCanonicalGenerationRequest,
} from '../frontend/src/server/agent-api/generation-normalization';

const modes = [
  { mode: 't2v', surface: 'video' },
  { mode: 'i2v', surface: 'video' },
  { mode: 'ref2v', surface: 'video' },
  { mode: 'v2v', surface: 'video' },
  { mode: 'extend', surface: 'video' },
  { mode: 't2i', surface: 'image' },
  { mode: 'i2i', surface: 'image' },
] as const;

function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    surface: 'video',
    engineId: 'seedance-2-0-mini',
    mode: 't2v',
    prompt: 'A product reveal',
    settings: {},
    references: [],
    outputCount: 1,
    ...overrides,
  };
}

for (const entry of modes) {
  test(`normalizes the narrow ${entry.mode} request`, () => {
    const actual = normalizeGenerationRequest(
      request({
        surface: entry.surface,
        engineId: '  model-alpha  ',
        mode: entry.mode,
        prompt: '  Cafe\u0301\tlaunch\n\nwith   soft light  ',
        settings: { resolution: '  1080p  ', seed: -0 },
      })
    );

    assert.deepEqual(actual, {
      schemaVersion: 1,
      surface: entry.surface,
      engineId: 'model-alpha',
      mode: entry.mode,
      prompt: 'Caf\u00e9 launch with soft light',
      settings: { resolution: '1080p', seed: 0 },
      references: [],
      outputCount: 1,
    });
  });
}

test('defaults optional canonical collections and the single output count', () => {
  assert.deepEqual(
    normalizeGenerationRequest({
      schemaVersion: 1,
      surface: 'image',
      engineId: 'gpt-image-2',
      mode: 't2i',
      prompt: 'Portrait',
    }),
    {
      schemaVersion: 1,
      surface: 'image',
      engineId: 'gpt-image-2',
      mode: 't2i',
      prompt: 'Portrait',
      settings: {},
      references: [],
      outputCount: 1,
    }
  );
});

test('sorts references deterministically within an explicit semantic role order', () => {
  const references = [
    { kind: 'asset', assetId: 'asset-reference-z', role: 'reference' },
    { kind: 'https', url: 'https://CDN.Example.com/end.png', role: 'last_frame', mediaKind: 'image' },
    { kind: 'asset', assetId: 'asset-source', role: 'source' },
    { kind: 'https', url: 'https://cdn.example.com/start.png', role: 'first_frame', mediaKind: 'image' },
    { kind: 'asset', assetId: 'asset-reference-a', role: 'reference' },
  ];
  const first = normalizeGenerationRequest(request({ mode: 'ref2v', references }));
  const second = normalizeGenerationRequest(request({ mode: 'ref2v', references: [...references].reverse() }));

  assert.deepEqual(first.references, [
    { kind: 'asset', assetId: 'asset-source', role: 'source' },
    { kind: 'https', url: 'https://cdn.example.com/start.png', role: 'first_frame', mediaKind: 'image' },
    { kind: 'https', url: 'https://cdn.example.com/end.png', role: 'last_frame', mediaKind: 'image' },
    { kind: 'asset', assetId: 'asset-reference-a', role: 'reference' },
    { kind: 'asset', assetId: 'asset-reference-z', role: 'reference' },
  ]);
  assert.deepEqual(first, second);
});

test('serializes every object level with stable keys and hashes schema version plus canonical JSON', () => {
  const canonical = normalizeGenerationRequest(
    request({
      settings: { seed: 3, resolution: '1080p', aspectRatio: '16:9' },
      references: [{ role: 'reference', assetId: 'asset-a', kind: 'asset' }],
    })
  );
  const reordered = {
    outputCount: canonical.outputCount,
    references: canonical.references.map(({ role, assetId, kind }) => ({ role, assetId, kind })),
    settings: { aspectRatio: '16:9', seed: 3, resolution: '1080p' },
    prompt: canonical.prompt,
    mode: canonical.mode,
    engineId: canonical.engineId,
    surface: canonical.surface,
    schemaVersion: canonical.schemaVersion,
  } as typeof canonical;

  const canonicalJson = serializeCanonicalGenerationRequest(canonical);
  assert.equal(canonicalJson, serializeCanonicalGenerationRequest(reordered));
  assert.equal(
    canonicalJson,
    '{"engineId":"seedance-2-0-mini","mode":"t2v","outputCount":1,"prompt":"A product reveal","references":[{"assetId":"asset-a","kind":"asset","role":"reference"}],"schemaVersion":1,"settings":{"aspectRatio":"16:9","resolution":"1080p","seed":3},"surface":"video"}'
  );
  assert.equal(
    hashCanonicalGenerationRequest(canonical),
    createHash('sha256').update(`1${canonicalJson}`, 'utf8').digest('hex')
  );
});

test('rejects unsupported modes and surface-mode mismatches', () => {
  for (const mode of ['retake']) {
    assert.throws(() => normalizeGenerationRequest(request({ mode })), /mode/i);
  }
  assert.throws(
    () => normalizeGenerationRequest(request({ surface: 'image', mode: 't2v' })),
    /surface.*mode|mode.*surface/i
  );
  assert.throws(
    () => normalizeGenerationRequest(request({ surface: 'video', mode: 't2i' })),
    /surface.*mode|mode.*surface/i
  );
});

test('normalizes v2v and extend source workflows as canonical video modes', () => {
  for (const mode of ['v2v', 'extend'] as const) {
    const normalized = normalizeGenerationRequest({
      schemaVersion: 1,
      surface: 'video',
      engineId: 'seedance-2-5',
      mode,
      prompt: 'Continue the cinematic scene.',
      settings: { durationSec: 4, resolution: '480p', audio: true },
      references: [{ kind: 'asset', assetId: 'video-1', role: 'source' }],
      outputCount: 1,
    });
    assert.equal(normalized.mode, mode);
  }
});

test('rejects source-video, audio-reference, provider, identity, price, payment, and job fields', () => {
  for (const field of [
    'sourceVideo',
    'sourceVideoUrl',
    'audioReference',
    'audioUrl',
    'provider',
    'providerParameters',
    'paymentMode',
    'price',
    'priceCents',
    'jobId',
    'userId',
  ]) {
    assert.throws(
      () => normalizeGenerationRequest(request({ [field]: field === 'priceCents' ? 12 : 'forbidden' })),
      /unknown|unsupported|field/i,
      field
    );
  }
});

test('rejects unknown nested reference fields and non-plain or prototype-polluted objects', () => {
  assert.throws(
    () =>
      normalizeGenerationRequest(
        request({ references: [{ kind: 'asset', assetId: 'asset-a', role: 'source', mimeType: 'image/png' }] })
      ),
    /unknown|field/i
  );

  const inherited = Object.create({ userId: 'another-user' }) as Record<string, unknown>;
  Object.assign(inherited, request());
  assert.throws(() => normalizeGenerationRequest(inherited), /plain|prototype/i);

  const polluted = JSON.parse(
    '{"surface":"video","engineId":"model","mode":"t2v","prompt":"ok","__proto__":{"userId":"x"}}'
  ) as unknown;
  assert.throws(() => normalizeGenerationRequest(polluted), /unknown|field|prototype/i);
});

test('rejects excessive, empty, and non-string prompts after canonical whitespace normalization', () => {
  assert.throws(() => normalizeGenerationRequest(request({ prompt: 'x'.repeat(MAX_CANONICAL_PROMPT_CHARS + 1) })), /prompt/i);
  assert.throws(() => normalizeGenerationRequest(request({ prompt: '\u2003\n\t' })), /prompt/i);
  assert.throws(() => normalizeGenerationRequest(request({ prompt: 42 })), /prompt/i);
});

test('accepts only the integer literal one as output count', () => {
  for (const outputCount of [0, 2, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1', null]) {
    assert.throws(() => normalizeGenerationRequest(request({ outputCount })), /outputCount|output count/i);
  }
  assert.equal(normalizeGenerationRequest(request({ outputCount: 1 })).outputCount, 1);
});

test('bounds settings and accepts only finite scalar values with safe unique keys', () => {
  const tooManySettings = Object.fromEntries(
    Array.from({ length: MAX_CANONICAL_SETTING_COUNT + 1 }, (_, index) => [`setting${index}`, index])
  );
  assert.throws(() => normalizeGenerationRequest(request({ settings: tooManySettings })), /settings/i);

  for (const settings of [
    { nested: { provider: 'fal' } },
    { list: ['1080p'] },
    { invalid: Number.NaN },
    { invalid: Number.POSITIVE_INFINITY },
    { providerParameters: 'bypass' },
    { sourceVideoUrl: 'https://example.com/video.mp4' },
    { userId: 'another-user' },
    { '__proto__.polluted': true },
    { constructor: 'pollution-vector' },
    { prototype: 'pollution-vector' },
  ]) {
    assert.throws(() => normalizeGenerationRequest(request({ settings })), /settings|setting/i);
  }

  const oversizedValue = 'x'.repeat(Math.ceil(MAX_CANONICAL_SETTINGS_JSON_BYTES / 6));
  assert.throws(
    () =>
      normalizeGenerationRequest(
        request({
          surface: 'image',
          mode: 't2i',
          settings: {
            aspectRatio: oversizedValue,
            outputFormat: oversizedValue,
            quality: oversizedValue,
            resolution: oversizedValue,
            style: oversizedValue,
            thinkingLevel: oversizedValue,
          },
        })
      ),
    /settings.*size|settings.*limit/i
  );
});

test('allows only the closed transport-neutral settings for each canonical mode', () => {
  const cases = [
    {
      surface: 'video',
      mode: 't2v',
      settings: {
        aspectRatio: '16:9',
        audio: true,
        cameraFixed: false,
        durationSec: 5,
        fps: 24,
        loop: false,
        negativePrompt: '  blur  ',
        numFrames: 121,
        resolution: '720p',
        safetyChecker: true,
        seed: 7,
      },
    },
    {
      surface: 'video',
      mode: 'i2v',
      settings: { aspectRatio: '9:16', audio: false, durationSec: 6, resolution: '1080p', seed: 8 },
    },
    {
      surface: 'video',
      mode: 'ref2v',
      settings: { audio: true, durationSec: 10, fps: 25, resolution: '1080p' },
    },
    {
      surface: 'video',
      mode: 'v2v',
      settings: { audio: true, durationSec: 8, resolution: '720p' },
    },
    {
      surface: 'video',
      mode: 'extend',
      settings: { audio: false, durationSec: 12, resolution: '480p' },
    },
    {
      surface: 'image',
      mode: 't2i',
      settings: {
        aspectRatio: '1:1',
        enableWebSearch: true,
        limitGenerations: false,
        outputFormat: 'png',
        quality: 'high',
        resolution: '2048x2048',
        seed: 9,
        style: 'natural',
        thinkingLevel: 'high',
        watermark: false,
      },
    },
    {
      surface: 'image',
      mode: 'i2i',
      settings: { aspectRatio: 'source', outputFormat: 'webp', quality: 'medium', resolution: 'auto', seed: 10 },
    },
  ] as const;

  for (const entry of cases) {
    const normalized = normalizeGenerationRequest(
      request({ surface: entry.surface, mode: entry.mode, settings: entry.settings })
    );
    assert.deepEqual(normalized.settings, {
      ...Object.fromEntries(
        Object.entries(entry.settings)
          .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
          .sort(([left], [right]) => String(left).localeCompare(String(right)))
      ),
    });
  }

  assert.throws(
    () => normalizeGenerationRequest(request({ mode: 't2v', settings: { quality: 'high' } })),
    /settings/i
  );
  assert.throws(
    () =>
      normalizeGenerationRequest(
        request({ surface: 'image', mode: 't2i', settings: { audio: true } })
      ),
    /settings/i
  );
});

test('accepts canonical cfgScale for video modes while rejecting provider spellings', () => {
  for (const mode of ['t2v', 'i2v'] as const) {
    assert.deepEqual(
      normalizeGenerationRequest(request({ mode, settings: { cfgScale: 0.75, resolution: '1080p' } })).settings,
      { cfgScale: 0.75, resolution: '1080p' }
    );
  }

  for (const key of ['cfg_scale', 'guidance_scale']) {
    assert.throws(
      () => normalizeGenerationRequest(request({ mode: 'i2v', settings: { [key]: 0.75 } })),
      /settings/i,
      key
    );
  }
  assert.throws(
    () =>
      normalizeGenerationRequest(
        request({ surface: 'image', mode: 'i2i', settings: { cfgScale: 0.75 } })
      ),
    /settings/i
  );
});

test('fails closed for arbitrary and normalized provider, payment, identity, job, video, and audio aliases', () => {
  const aliases = [
    'providerOptions',
    'provider_options',
    ' Provider.Options ',
    'rawProviderParameters',
    'billingMode',
    'billing_mode',
    'ownerUserId',
    'owner_user_id',
    'externalJobId',
    'external_job_id',
    'inputVideoUrl',
    'input_video_url',
    'sourceAudioUrl',
    'source_audio_url',
    'audioReferenceUrl',
    'callbackUrl',
    'anythingElse',
  ];

  for (const key of aliases) {
    let error: unknown;
    try {
      normalizeGenerationRequest(request({ settings: { [key]: 'private-value' } }));
    } catch (caught) {
      error = caught;
    }
    assert.ok(error instanceof GenerationNormalizationError, key);
    assert.equal(error.field, 'settings', key);
    assert.doesNotMatch(error.message, /private-value/i, key);
  }
});

test('rejects symbol, accessor, and non-enumerable fields without evaluating or disclosing them', () => {
  const symbolRequest = request();
  Object.defineProperty(symbolRequest, Symbol('private-token'), { enumerable: true, value: 'secret-symbol' });

  let getterCalls = 0;
  const accessorRequest = request();
  Object.defineProperty(accessorRequest, 'providerOptions', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'secret-accessor';
    },
  });

  const hiddenRequest = request();
  Object.defineProperty(hiddenRequest, 'ownerUserId', { enumerable: false, value: 'secret-hidden' });

  for (const input of [symbolRequest, accessorRequest, hiddenRequest]) {
    let error: unknown;
    try {
      normalizeGenerationRequest(input);
    } catch (caught) {
      error = caught;
    }
    assert.ok(error instanceof GenerationNormalizationError);
    assert.equal(error.field, 'generation request');
    assert.doesNotMatch(error.message, /secret|token|ownerUserId|providerOptions/i);
  }
  assert.equal(getterCalls, 0);
});

test('detects duplicates after canonical URL normalization with a stable error field', () => {
  let error: unknown;
  try {
    normalizeGenerationRequest(
      request({
        references: [
          { kind: 'https', url: 'https://CDN.Example.com:443/image.png', role: 'reference', mediaKind: 'image' },
          { kind: 'https', url: 'https://cdn.example.com/image.png', role: 'reference', mediaKind: 'image' },
        ],
      })
    );
  } catch (caught) {
    error = caught;
  }

  assert.ok(error instanceof GenerationNormalizationError);
  assert.equal(error.field, 'references');
  assert.doesNotMatch(error.message, /cdn\.example|image\.png/i);
});

test('returns detached canonical objects without mutating or aliasing caller input', () => {
  const settings = { resolution: '  1080p  ', seed: -0 };
  const reference = { kind: 'asset', assetId: '  asset-a  ', role: 'reference' };
  const references = [reference];
  const input = request({ settings, references });
  const normalized = normalizeGenerationRequest(input);

  assert.deepEqual(settings, { resolution: '  1080p  ', seed: -0 });
  assert.deepEqual(reference, { kind: 'asset', assetId: '  asset-a  ', role: 'reference' });
  assert.equal(normalized.settings === settings, false);
  assert.equal(normalized.references === references, false);
  assert.equal(normalized.references[0] === reference, false);

  settings.resolution = '480p';
  reference.assetId = 'asset-b';
  references.length = 0;
  assert.deepEqual(normalized.settings, { resolution: '1080p', seed: 0 });
  assert.deepEqual(normalized.references, [{ kind: 'asset', assetId: 'asset-a', role: 'reference' }]);
});

test('rejects sparse or decorated reference arrays instead of ignoring hidden input', () => {
  const sparseReferences = new Array(1);
  assert.throws(
    () => normalizeGenerationRequest(request({ references: sparseReferences })),
    /references.*dense|references.*field/i
  );

  const decoratedReferences: unknown[] & { userId?: string } = [];
  decoratedReferences.userId = 'another-user';
  assert.throws(
    () => normalizeGenerationRequest(request({ references: decoratedReferences })),
    /references.*field/i
  );
});

test('validates asset identifiers and HTTPS references without credentials or fragments', () => {
  for (const reference of [
    { kind: 'asset', assetId: '../private', role: 'reference' },
    { kind: 'asset', assetId: '', role: 'reference' },
    { kind: 'https', url: 'http://cdn.example.com/image.png', role: 'reference', mediaKind: 'image' },
    { kind: 'https', url: 'https://user:secret@cdn.example.com/image.png', role: 'reference', mediaKind: 'image' },
    { kind: 'https', url: 'https://cdn.example.com/image.png#private', role: 'reference', mediaKind: 'image' },
    { kind: 'audio', url: 'https://cdn.example.com/audio.wav', role: 'reference' },
    { kind: 'https', url: 'https://cdn.example.com/image.png', role: 'audio', mediaKind: 'image' },
    { kind: 'https', url: 'https://cdn.example.com/image.png', role: 'reference' },
    { kind: 'https', url: 'https://cdn.example.com/image.png', role: 'reference', mediaKind: 'document' },
    { kind: 'asset', assetId: 'asset-a', role: 'reference', mediaKind: 'image' },
  ]) {
    assert.throws(() => normalizeGenerationRequest(request({ references: [reference] })), /reference|asset|https|role/i);
  }
});

test('includes declared HTTPS media kind in canonical identity, serialization, and hashing', () => {
  const imageRequest = normalizeGenerationRequest(request({
    mode: 'ref2v',
    references: [{ kind: 'https', url: 'https://cdn.example.com/reference', role: 'reference', mediaKind: 'image' }],
  }));
  const videoRequest = normalizeGenerationRequest(request({
    mode: 'ref2v',
    references: [{ kind: 'https', url: 'https://cdn.example.com/reference', role: 'reference', mediaKind: 'video' }],
  }));

  assert.deepEqual(imageRequest.references, [
    { kind: 'https', url: 'https://cdn.example.com/reference', role: 'reference', mediaKind: 'image' },
  ]);
  assert.notEqual(serializeCanonicalGenerationRequest(imageRequest), serializeCanonicalGenerationRequest(videoRequest));
  assert.notEqual(hashCanonicalGenerationRequest(imageRequest), hashCanonicalGenerationRequest(videoRequest));
  assert.doesNotThrow(() => normalizeGenerationRequest(request({
    mode: 'ref2v',
    references: [imageRequest.references[0], videoRequest.references[0]],
  })));
});

test('rejects duplicate canonical references instead of silently changing request intent', () => {
  assert.throws(
    () =>
      normalizeGenerationRequest(
        request({
          references: [
            { kind: 'asset', assetId: 'asset-a', role: 'reference' },
            { role: 'reference', assetId: 'asset-a', kind: 'asset' },
          ],
        })
      ),
    /duplicate.*reference/i
  );
});
