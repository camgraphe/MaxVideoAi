import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAIImageClient } from '../frontend/src/server/images/openai-image-client';
import { buildOpenAIImagePayload } from '../frontend/src/server/images/openai-image-payload';
import { extractOpenAIImages, parseOpenAIImageUsage } from '../frontend/src/server/images/openai-image-response';
import { prepareOpenAIImageReferences } from '../frontend/src/server/images/openai-image-references';
import { normalizeGptImage26Settings } from '../frontend/lib/image/gptImage26';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWKsAAAAASUVORK5CYII=';
const base = { modelId: 'gpt-image-2.6-flare', mode: 't2i' as const, prompt: 'An original image', settings: normalizeGptImage26Settings({}), referenceUrls: [] };
const response = { created: 1, data: [{ b64_json: png }], output_format: 'png' };

test('OpenAI uses exact 2.6 model IDs, explicit raster controls and JSON edit references', async () => {
  for (const modelId of ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst']) for (const mode of ['t2i', 'i2i'] as const) {
    const payload = buildOpenAIImagePayload({ ...base, modelId, mode, referenceUrls: mode === 'i2i' ? ['https://media.maxvideoai.com/signed-original'] : [] });
    let calls = 0;
    const client = new OpenAIImageClient({ apiKey: 'offline-only', fetchFn: async (url, init) => {
      calls++; assert.equal(String(url), `https://api.openai.com/v1/images/${mode === 'i2i' ? 'edits' : 'generations'}`);
      assert.equal(init?.method, 'POST'); assert.equal(init?.redirect, 'error');
      const body = JSON.parse(init?.body as string);
      assert.equal(body.model, modelId); assert.equal(body.complexity, 'high'); assert.equal(body.size, '1024x1024');
      assert.equal(body.quality, 'high'); assert.equal(body.n, 1); assert.equal(body.output_format, 'png');
      assert.equal(body.response_format, undefined);
      assert.deepEqual(body.images, mode === 'i2i' ? [{ image_url: 'https://media.maxvideoai.com/signed-original' }] : undefined);
      return new Response(JSON.stringify(response), { headers: { 'x-request-id': 'req_offline' } });
    } });
    const result = await client.generate(mode, payload);
    assert.equal(result.requestId, 'req_offline'); assert.equal(calls, 1);
  }
});

test('2.6 accepts explicit raster tiers and refuses deferred formats, masks and unbounded settings', () => {
  for (const quality of ['low', 'medium', 'high', 'xhigh', 'max'] as const) for (const complexity of ['low', 'medium', 'high'] as const) {
    assert.equal(normalizeGptImage26Settings({ quality, complexity }).quality, quality);
  }
  for (const value of [{ outputFormat: 'svg' }, { outputFormat: 'gif' }, { maskUrl: 'https://example.test/mask' }, { markup: 'x' }, { complexity: 'auto' }, { resolution: 'custom' }, { numImages: 1.5 }, { numImages: 11 }, { background: 'transparent', outputFormat: 'jpeg' }, { seed: 1 }, { frameCount: 4 }]) {
    assert.throws(() => normalizeGptImage26Settings(value as never), JSON.stringify(value));
  }
  assert.throws(() => buildOpenAIImagePayload({ ...base, modelId: 'gpt-image-2.5-flare' }));
  assert.throws(() => buildOpenAIImagePayload({ ...base, mode: 'i2i' }));
  assert.throws(() => buildOpenAIImagePayload({ ...base, referenceUrls: ['https://example.test/reference'] }));
  assert.throws(() => buildOpenAIImagePayload({ ...base, prompt: 'x'.repeat(32001) }));
});

test('OpenAI never retries POSTs and does not leak provider errors, prompts, keys or image data', async () => {
  for (const failure of ['network', '429', '500', 'bad-json']) {
    let calls = 0;
    const client = new OpenAIImageClient({ apiKey: 'sk-private', fetchFn: async () => {
      calls++;
      if (failure === 'network') throw new Error('private prompt sk-private');
      if (failure === 'bad-json') return new Response('private prompt sk-private');
      return new Response(JSON.stringify({ error: { message: 'private prompt sk-private', code: 'invalid_request_error' } }), { status: Number(failure), headers: { 'x-request-id': 'req_offline' } });
    } });
    await assert.rejects(client.generate('t2i', buildOpenAIImagePayload(base)), (error: unknown) => {
      assert.doesNotMatch(JSON.stringify(error), /sk-private|private prompt/);
      assert.equal((error as { submissionState: string }).submissionState, failure === '429' ? 'definitive' : 'uncertain');
      return true;
    });
    assert.equal(calls, 1);
  }
});

test('decoded outputs are raster bytes and partial or malformed responses never establish full completion', () => {
  const full = extractOpenAIImages(response, 'png', 1);
  assert.equal(full.complete, true); assert.equal(full.images[0].mimeType, 'image/png');
  assert.deepEqual(full.images[0].data, Buffer.from(png, 'base64'));
  const partial = extractOpenAIImages({ ...response, data: [{ b64_json: png }, { b64_json: 'invalid' }] }, 'png', 2);
  assert.equal(partial.complete, false); assert.equal(partial.images.length, 1);
  assert.equal(extractOpenAIImages({ ...response, output_format: 'svg' }, 'png', 1).complete, false);
  assert.equal(extractOpenAIImages({ data: [{ url: 'https://untrusted.test/image' }] }, 'png', 1).images.length, 0);
  const excess = extractOpenAIImages({ data: Array.from({ length: 10 }, () => ({ b64_json: png })) }, 'png', 1);
  assert.equal(excess.complete, false); assert.equal(excess.images.length, 1);
});

test('usage stores validated token facts and a supplier estimate, never invents an invoice or reuses fal prices', () => {
  const usage = parseOpenAIImageUsage({ usage: { input_tokens: 300, input_tokens_details: { text_tokens: 100, image_tokens: 200 }, output_tokens: 1000, total_tokens: 1300 } });
  assert.equal(usage?.listEstimateUsd, 0.0321);
  assert.equal(usage?.invoiceCostUsd, null);
  assert.equal(parseOpenAIImageUsage({ usage: { input_tokens: -1 } }), null);
});

test('only verified owned originals with raster MIME and bounded size are signed for provider fetching', async () => {
  const url = 'https://media.maxvideoai.com/user-assets/owner/ref.png';
  let signed = 0;
  const row = { url, mime_type: 'image/png', size_bytes: 1024, width: 1024, height: 1024 };
  for (const rows of [[], [{ ...row, size_bytes: 26 * 1024 * 1024 }], [{ ...row, mime_type: 'image/svg+xml' }], [row]]) {
    const result = prepareOpenAIImageReferences({ userId: 'owner', urls: [url] }, {
      ownedKeyFn: () => 'user-assets/owner/ref.png',
      queryFn: async <T>(sql: string, args?: readonly unknown[]) => { assert.match(sql, /user_id = \$1/); assert.equal(args?.[0], 'owner'); return rows as T[]; },
      signFn: async () => { signed++; return 'https://media.maxvideoai.com/signed-original'; },
    });
    if (rows === undefined || rows[0] !== row) await assert.rejects(result); else assert.deepEqual(await result, ['https://media.maxvideoai.com/signed-original']);
  }
  assert.equal(signed, 1);
  await assert.rejects(prepareOpenAIImageReferences({ userId: 'owner', urls: [url] }, { ownedKeyFn: () => null, queryFn: async () => { throw new Error('Must not query'); }, signFn: async () => { throw new Error('Must not sign'); } }));
});
