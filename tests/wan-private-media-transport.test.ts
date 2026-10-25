import assert from 'node:assert/strict';
import test from 'node:test';
import { createWanMediaTransport } from '../frontend/src/server/video-providers/alibaba-model-studio/media-access';
import { classifyAlibabaModelStudioError } from '../frontend/src/server/video-providers/alibaba-model-studio/errors';
import type { AlibabaVideoPayload } from '../frontend/src/server/video-providers/alibaba-model-studio/types';

const source = 'https://media.example/media-assets/user_123/video-excerpts-private-v3-source.mp4';
const grant = `${source}?X-Amz-Signature=secret&X-Amz-Expires=3600`;
function payload(model: AlibabaVideoPayload['model']): AlibabaVideoPayload {
  return { model, input: { prompt: 'Keep the person', media: [
    { type: 'reference_video', url: source }, { type: 'reference_image', url: source },
    { type: 'reference_audio', url: source }, { type: 'first_frame', url: source },
    { type: 'last_frame', url: source }, { type: 'link', url: 'https://example.com/page' },
    { type: 'file', url: 'https://example.com/doc.pdf' },
  ] }, parameters: { resolution: '720P', duration: 6, watermark: false, audio: true } };
}

for (const model of ['wan3.0-video', 'wan3.0-video-prime'] as const) {
  test(`${model} signs a disposable transport only, deduplicates and cleans echoed diagnostics`, async () => {
    const original = payload(model);
    const snapshot = structuredClone(original);
    const reads: unknown[] = [];
    const transport = await createWanMediaTransport({ payload: original, userId: 'user_123' }, {
      read: async input => { reads.push(input); return grant; },
    });
    assert.deepEqual(reads, [{ url: source, userId: 'user_123', expiresInSeconds: 3600 }]);
    assert.deepEqual(original, snapshot);
    assert.deepEqual(transport.payload.parameters, original.parameters);
    assert.equal(transport.payload.input.prompt, original.input.prompt);
    assert.deepEqual(transport.payload.input.media?.map(item => item.url), [grant, grant, grant, grant, grant, 'https://example.com/page', 'https://example.com/doc.pdf']);
    assert.deepEqual(transport.sanitize({ message: `Failed to download ${grant}`, nested: [encodeURIComponent(grant)] }), {
      message: `Failed to download ${source}`, nested: [encodeURIComponent(source)],
    });
  });
}

test('HappyHorse payloads bypass the Wan transport entirely', async () => {
  for (const model of ['happyhorse-1.1-t2v', 'happyhorse-1.1-i2v', 'happyhorse-1.1-r2v'] as const) {
    const original = payload(model);
    const transport = await createWanMediaTransport({ payload: original, userId: 'user_123' }, { read: async () => { throw new Error('must not read'); } });
    assert.equal(transport.payload, original);
    assert.equal(transport.sanitize(grant), grant);
  }
});

test('Wan text-only submission needs no media access', async () => {
  const original = payload('wan3.0-video');
  delete original.input.media;
  const transport = await createWanMediaTransport({ payload: original, userId: 'user_123' }, { read: async () => { throw new Error('must not read'); } });
  assert.deepEqual(transport.payload, original);
});

test('both ownership refusals and signing infrastructure errors stop before a provider fallback', async () => {
  for (const message of ['MEDIA_NOT_AVAILABLE', 'network timeout signing']) {
    await assert.rejects(createWanMediaTransport({ payload: payload('wan3.0-video'), userId: 'other' }, {
      read: async () => { throw new Error(message); },
    }), error => {
      const classified = classifyAlibabaModelStudioError(error);
      assert.equal(classified.fallbackEligible, false);
      assert.equal(classified.code, message === 'MEDIA_NOT_AVAILABLE' ? 'REFERENCE_INVALID' : 'REFERENCE_ACCESS_FAILED');
      return true;
    });
  }
});
