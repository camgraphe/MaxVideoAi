import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  MAX_CANONICAL_PROMPT_CHARS,
  MAX_CANONICAL_SETTINGS_JSON_BYTES,
  MAX_CANONICAL_SETTING_COUNT,
  hashCanonicalGenerationRequest,
  normalizeGenerationRequest,
  serializeCanonicalGenerationRequest,
} from '../frontend/src/server/agent-api/generation-normalization';

const modes = [
  { mode: 't2v', surface: 'video' },
  { mode: 'i2v', surface: 'video' },
  { mode: 'ref2v', surface: 'video' },
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
        settings: { resolution: '  1080p  ', audio: false, seed: -0 },
      })
    );

    assert.deepEqual(actual, {
      schemaVersion: 1,
      surface: entry.surface,
      engineId: 'model-alpha',
      mode: entry.mode,
      prompt: 'Caf\u00e9 launch with soft light',
      settings: { audio: false, resolution: '1080p', seed: 0 },
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
    { kind: 'https', url: 'https://CDN.Example.com/end.png', role: 'last_frame' },
    { kind: 'asset', assetId: 'asset-source', role: 'source' },
    { kind: 'https', url: 'https://cdn.example.com/start.png', role: 'first_frame' },
    { kind: 'asset', assetId: 'asset-reference-a', role: 'reference' },
  ];
  const first = normalizeGenerationRequest(request({ mode: 'ref2v', references }));
  const second = normalizeGenerationRequest(request({ mode: 'ref2v', references: [...references].reverse() }));

  assert.deepEqual(first.references, [
    { kind: 'asset', assetId: 'asset-source', role: 'source' },
    { kind: 'https', url: 'https://cdn.example.com/start.png', role: 'first_frame' },
    { kind: 'https', url: 'https://cdn.example.com/end.png', role: 'last_frame' },
    { kind: 'asset', assetId: 'asset-reference-a', role: 'reference' },
    { kind: 'asset', assetId: 'asset-reference-z', role: 'reference' },
  ]);
  assert.deepEqual(first, second);
});

test('serializes every object level with stable keys and hashes schema version plus canonical JSON', () => {
  const canonical = normalizeGenerationRequest(
    request({
      settings: { zeta: true, alpha: 'value', middle: 3 },
      references: [{ role: 'reference', assetId: 'asset-a', kind: 'asset' }],
    })
  );
  const reordered = {
    outputCount: canonical.outputCount,
    references: canonical.references.map(({ role, assetId, kind }) => ({ role, assetId, kind })),
    settings: { middle: 3, zeta: true, alpha: 'value' },
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
    '{"engineId":"seedance-2-0-mini","mode":"t2v","outputCount":1,"prompt":"A product reveal","references":[{"assetId":"asset-a","kind":"asset","role":"reference"}],"schemaVersion":1,"settings":{"alpha":"value","middle":3,"zeta":true},"surface":"video"}'
  );
  assert.equal(
    hashCanonicalGenerationRequest(canonical),
    createHash('sha256').update(`1${canonicalJson}`, 'utf8').digest('hex')
  );
});

test('rejects unsupported modes and surface-mode mismatches', () => {
  for (const mode of ['v2v', 'extend', 'retake']) {
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

  const oversizedValue = 'x'.repeat(Math.ceil(MAX_CANONICAL_SETTINGS_JSON_BYTES / 4));
  assert.throws(
    () =>
      normalizeGenerationRequest(
        request({ settings: { settingA: oversizedValue, settingB: oversizedValue, settingC: oversizedValue, settingD: oversizedValue } })
      ),
    /settings.*size|settings.*limit/i
  );
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
    { kind: 'https', url: 'http://cdn.example.com/image.png', role: 'reference' },
    { kind: 'https', url: 'https://user:secret@cdn.example.com/image.png', role: 'reference' },
    { kind: 'https', url: 'https://cdn.example.com/image.png#private', role: 'reference' },
    { kind: 'audio', url: 'https://cdn.example.com/audio.wav', role: 'reference' },
    { kind: 'https', url: 'https://cdn.example.com/image.png', role: 'audio' },
  ]) {
    assert.throws(() => normalizeGenerationRequest(request({ references: [reference] })), /reference|asset|https|role/i);
  }
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
